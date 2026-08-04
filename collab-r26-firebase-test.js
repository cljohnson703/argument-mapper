'use strict';
// r26 collaboration regression: Firebase RTDB transport, rooms, roles,
// presence, resilience, and boot flows — against a FAKE Firebase SDK.
//
// The fake implements exactly the modular surface the app uses
// (initializeApp/getAuth/onAuthStateChanged/signInWithPopup/signOut,
// getDatabase/ref/get/set/update/remove/onValue/runTransaction/onDisconnect)
// over one shared in-memory cloud, INCLUDING a mirror of the production
// Security Rules (owner cascade, token joins, editor-only document writes,
// own-presence-only writes) — so the client code is exercised against the
// same acceptance/rejection behavior the deployed rules produce. What the
// fake cannot prove: the real rules file itself (deploy + emulator test
// that separately), real network jitter, and real OAuth.
//
// Run:  node collab-r26-firebase-test.js [argument-mapper-r26.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || (__dirname + '/argument-mapper-r26.html'), 'utf8');

const sleep = ms => new Promise(r => setTimeout(r, ms));
let _idish = 0;
const collabRandIdish = () => 'x' + (++_idish);
async function waitFor(fn, label, ms = 4000, step = 25) {
    const t0 = Date.now();
    for (;;) {
        let v;
        try { v = fn(); } catch (e) { v = false; }
        if (v) return v;
        if (Date.now() - t0 > ms) throw new Error('waitFor timeout: ' + label);
        await sleep(step);
    }
}

// ---------------------------------------------------------------------------
// Fake cloud (one per test run, shared by every window = every "device").
// ---------------------------------------------------------------------------
function createFakeCloud() {
    const cloud = {
        tree: {},
        listeners: new Set(),     // {segs, cb, errCb, alive}
        connectedVal: true,
        disconnectOps: new Map(), // path -> 'remove'
        docWrites: [],            // log of committed document-path writes {path, uid}
    };
    const segsOf = p => String(p).split('/').filter(Boolean);
    const getAt = (segs) => {
        let n = cloud.tree;
        for (const s of segs) { if (n == null || typeof n !== 'object') return null; n = n[s]; }
        return n === undefined ? null : n;
    };
    const clone = v => v == null ? null : JSON.parse(JSON.stringify(v));
    const setAt = (segs, val) => {
        if (!segs.length) { cloud.tree = (val == null ? {} : val); return; }
        let n = cloud.tree;
        for (let i = 0; i < segs.length - 1; i++) {
            if (typeof n[segs[i]] !== 'object' || n[segs[i]] == null) n[segs[i]] = {};
            n = n[segs[i]];
        }
        if (val == null) delete n[segs[segs.length - 1]];
        else n[segs[segs.length - 1]] = val;
    };
    const isPrefix = (a, b) => a.length <= b.length && a.every((s, i) => s === b[i]);
    // Deliveries are guarded: a listener whose window has been CLOSED throws
    // on first touch (real Firebase listeners die with the page; the fake's
    // live in Node) — mark it dead instead of crashing the harness.
    const deliver = (l, v) => {
        if (!l.alive) return;
        try { l.cb(snap(v)); } catch (e) { l.alive = false; cloud.listeners.delete(l); }
    };
    const notify = (changedSegs) => {
        for (const l of [...cloud.listeners]) {
            if (!l.alive) continue;
            if (isPrefix(l.segs, changedSegs) || isPrefix(changedSegs, l.segs)) {
                const v = clone(getAt(l.segs));
                setTimeout(() => deliver(l, v), 0);
            }
        }
    };
    const snap = v => ({ exists: () => v != null, val: () => v });

    // --- Mirror of database.rules.json (write side) ----------------------
    // isAnon mirrors auth.token.firebase.sign_in_provider === 'anonymous'.
    cloud.ruleCheck = (uid, segs, val, isAnon) => {
        if (segs[0] === '.info') return false;            // client-local, never written
        if (segs[0] !== 'rooms') return false;
        const roomId = segs[1];
        const room = getAt(['rooms', roomId]) || {};
        const owner = room.meta && room.meta.ownerUid;
        if (segs.length === 2) {                          // whole-room create/delete
            if (!room.meta) return !!(val && val.meta && val.meta.ownerUid === uid);
            return owner === uid;
        }
        if (owner === uid) return true;                   // owner cascade
        const sect = segs[2];
        if (sect === 'members' && segs[3] === uid && segs.length === 4) {
            if (val === null) return !!(room.members || {})[uid];   // self-leave
            const invites = room.invites || {};
            const meta = room.meta || {};
            // Mirror of the guest clause: an anonymous joiner needs the
            // owner's permission for that role. Provider comes from the token,
            // not the client, so the app cannot lie about it.
            // Missing field = the documented default: viewing allowed,
            // editing not. Keeps pre-feature rooms working without migration.
            const guestOk = !isAnon
                || (val && val.role === 'viewer' && meta.guestViewers !== false)
                || (val && val.role === 'editor' && meta.guestEditors === true);
            return !!val && invites[val.viaToken] === val.role
                && meta.accessMode === 'open'
                && guestOk
                && !(room.members || {})[uid];
        }
        if (sect === 'document') {
            const role = room.members && room.members[uid] && room.members[uid].role;
            return role === 'owner' || role === 'editor';
        }
        if (sect === 'presence' && segs[3] && String(segs[3]).indexOf(uid + '|') === 0) {
            return !!(room.members && room.members[uid]);
        }
        return false;
    };

    cloud._segsOf = segsOf; cloud._getAt = getAt; cloud._setAt = setAt;
    cloud._notify = notify; cloud._snap = snap; cloud._clone = clone;

    cloud.setPath = (p, v) => { setAt(segsOf(p), v); notify(segsOf(p)); };      // test backdoor (no rules)
    cloud.getPath = (p) => clone(getAt(segsOf(p)));
    cloud.setConnected = (on) => {
        cloud.connectedVal = !!on;
        for (const l of [...cloud.listeners]) {
            if (l.alive && l.segs.length === 2 && l.segs[0] === '.info' && l.segs[1] === 'connected') {
                setTimeout(() => deliver(l, cloud.connectedVal), 0);
            }
        }
    };
    cloud._deliver = deliver;
    // Simulates the RTDB server detecting a client's disconnect and running
    // its queued onDisconnect ops. `filter` limits it to one client's ops
    // (real RTDB scopes ops per connection; this map is global).
    cloud.fireDisconnectOps = (filter) => {
        for (const [p, op] of [...cloud.disconnectOps]) {
            if (filter && !filter(p)) continue;
            if (op === 'remove') { setAt(segsOf(p), null); notify(segsOf(p)); }
            cloud.disconnectOps.delete(p);
        }
    };
    return cloud;
}

// Anonymous uids are minted per BROWSER in real Firebase, so the counter must
// live outside the per-window factory — otherwise two guest windows would
// share one uid and "already a member" would masquerade as a guest refusal.
let anonSeq = 0;
// Per-window fake module set (own auth identity, shared cloud).
function createFakeModules(cloud, initialUser) {
    const authObj = { currentUser: initialUser || null, popupUser: null, watchers: new Set() };
    const permErr = () => { const e = new Error('PERMISSION_DENIED: rules rejected the write'); e.code = 'PERMISSION_DENIED'; return e; };
    const netErr = () => { const e = new Error('network unavailable'); e.code = 'network-error'; return e; };
    const uidNow = () => authObj.currentUser ? authObj.currentUser.uid : null;
    const anonNow = () => !!(authObj.currentUser && authObj.currentUser.isAnonymous);

    const appMod = { initializeApp: (cfg) => ({ cfg }) };
    const authMod = {
        getAuth: () => authObj,
        onAuthStateChanged: (auth, cb) => {
            auth.watchers.add(cb);
            setTimeout(() => cb(auth.currentUser), 0);
            return () => auth.watchers.delete(cb);
        },
        GoogleAuthProvider: function GoogleAuthProvider() {},
        signInWithPopup: (auth) => {
            if (!auth.popupUser) { const e = new Error('popup blocked'); e.code = 'auth/popup-blocked'; return Promise.reject(e); }
            auth.currentUser = auth.popupUser;
            auth.watchers.forEach(cb => setTimeout(() => cb(auth.currentUser), 0));
            return Promise.resolve({ user: auth.currentUser });
        },
        signInAnonymously: (auth) => {
            if (auth.anonymousDisabled) {
                const e = new Error('anonymous sign-in disabled'); e.code = 'auth/operation-not-allowed';
                return Promise.reject(e);
            }
            // Real Firebase mints a fresh uid per anonymous sign-in and
            // persists it per browser; the fake reuses one per window.
            if (!auth.anonUser) auth.anonUser = { uid: 'anon' + (++anonSeq), isAnonymous: true, displayName: null, email: null };
            auth.currentUser = auth.anonUser;
            auth.watchers.forEach(cb => setTimeout(() => cb(auth.currentUser), 0));
            return Promise.resolve({ user: auth.currentUser });
        },
        signOut: (auth) => {
            auth.currentUser = null;
            auth.watchers.forEach(cb => setTimeout(() => cb(null), 0));
            return Promise.resolve();
        },
    };
    const write = (segs, val) => {
        if (!cloud.connectedVal) return Promise.reject(netErr());
        if (!cloud.ruleCheck(uidNow(), segs, val, anonNow())) return Promise.reject(permErr());
        cloud._setAt(segs, val == null ? null : cloud._clone(val));
        if (segs[2] === 'document') cloud.docWrites.push({ path: segs.join('/'), uid: uidNow() });
        cloud._notify(segs);
        return Promise.resolve();
    };
    const dbMod = {
        getDatabase: () => ({ cloud }),
        ref: (db, path) => ({ segs: cloud._segsOf(path), path: String(path) }),
        get: (ref) => {
            if (!cloud.connectedVal) return Promise.reject(netErr());
            // Read-side rule mirror: owner reads all; joinInfo needs auth;
            // members/document/presence/meta need membership; invites owner.
            const segs = ref.segs;
            if (segs[0] === 'rooms') {
                const uid = uidNow();
                const room = cloud._getAt(['rooms', segs[1]]) || {};
                const owner = room.meta && room.meta.ownerUid;
                const member = uid && room.members && room.members[uid];
                const sect = segs[2];
                let allowed = false;
                if (uid && owner === uid) allowed = true;
                else if (sect === 'joinInfo') allowed = !!uid;
                else if (sect === 'members' || sect === 'document' || sect === 'presence' || sect === 'meta') allowed = !!member;
                if (!allowed) return Promise.reject(permErr());
            }
            return Promise.resolve(cloud._snap(cloud._clone(cloud._getAt(ref.segs))));
        },
        set: (ref, val) => write(ref.segs, val),
        update: (ref, values) => {
            const jobs = Object.keys(values).map(k => write(ref.segs.concat(cloud._segsOf(k)), values[k]));
            return Promise.all(jobs).then(() => {});
        },
        remove: (ref) => write(ref.segs, null),
        onValue: (ref, cb, errCb) => {
            const l = { segs: ref.segs, cb, errCb: errCb || (() => {}), alive: true };
            cloud.listeners.add(l);
            const v = ref.segs[0] === '.info' && ref.segs[1] === 'connected'
                ? cloud.connectedVal
                : cloud._clone(cloud._getAt(ref.segs));
            setTimeout(() => cloud._deliver(l, v), 0);
            return () => { l.alive = false; cloud.listeners.delete(l); };
        },
        runTransaction: (ref, fn) => {
            if (!cloud.connectedVal) return Promise.reject(netErr());
            const cur = cloud._clone(cloud._getAt(ref.segs));
            const next = fn(cur);
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: cloud._snap(cur) });
            if (!cloud.ruleCheck(uidNow(), ref.segs, next, anonNow())) return Promise.reject(permErr());
            cloud._setAt(ref.segs, cloud._clone(next));
            if (ref.segs[2] === 'document') cloud.docWrites.push({ path: ref.segs.join('/'), uid: uidNow() });
            cloud._notify(ref.segs);
            return Promise.resolve({ committed: true, snapshot: cloud._snap(cloud._clone(next)) });
        },
        onDisconnect: (ref) => ({
            remove: () => { cloud.disconnectOps.set(ref.segs.join('/'), 'remove'); return Promise.resolve(); },
            cancel: () => { cloud.disconnectOps.delete(ref.segs.join('/')); return Promise.resolve(); },
        }),
    };
    return { app: appMod, auth: authMod, db: dbMod, _auth: authObj };
}

// ---------------------------------------------------------------------------
// Window factory (stub set copied from multidrag-r25-sync-test.js).
// ---------------------------------------------------------------------------
const FAKE_CONFIG = JSON.stringify({ apiKey: 'fake', authDomain: 'fake.local', databaseURL: 'https://fake-rtdb.local', projectId: 'fake-proj', appId: 'fake' });

function makeWin(label, cloud, opts) {
    opts = opts || {};
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e))));
    const mods = createFakeModules(cloud, opts.user || null);
    function stubs(win) {
        const { webcrypto } = require('crypto');
        if (!win.crypto || !win.crypto.randomUUID) {
            Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
        }
        win.matchMedia = win.matchMedia || (() => ({
            matches: false, media: '', addListener() {}, removeListener() {},
            addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
        }));
        win.ResizeObserver = win.ResizeObserver || function () {
            return { observe() {}, unobserve() {}, disconnect() {} };
        };
        const ctx = new Proxy({}, {
            get: (_t, prop) => prop === 'measureText' ? (() => ({ width: 0 })) : (() => ctx)
        });
        win.HTMLCanvasElement.prototype.getContext = () => ctx;
        win.indexedDB = win.indexedDB || {
            open() { const req = {}; setTimeout(() => req.onerror && req.onerror({ target: { error: new Error('idb off') } }), 0); return req; },
            deleteDatabase() { const req = {}; setTimeout(() => req.onsuccess && req.onsuccess({}), 0); return req; }
        };
        win.requestAnimationFrame = win.requestAnimationFrame || (cb => win.setTimeout(() => cb(Date.now()), 0));
        win.cancelAnimationFrame = win.cancelAnimationFrame || win.clearTimeout;
        win.scrollTo = () => {};
        win.alert = () => {};
        win.confirm = () => true;
        win.prompt = () => null;
        win.open = () => null;
        win.__argmapFirebaseModules = { app: mods.app, auth: mods.auth, db: mods.db };
        if (!opts.noConfig) { try { win.localStorage.setItem('argmap-firebase-config', FAKE_CONFIG); } catch (e) {} }
        if (opts.seedLocal) for (const [k, v] of Object.entries(opts.seedLocal)) { try { win.localStorage.setItem(k, v); } catch (e) {} }
        if (opts.seedSession) for (const [k, v] of Object.entries(opts.seedSession)) { try { win.sessionStorage.setItem(k, v); } catch (e) {} }
    }
    const dom = new JSDOM(HTML, {
        runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
        url: `https://localhost/${label}.html${opts.hash || ''}`, beforeParse: stubs
    });
    return { dom, errors, mods, get win() { return dom.window; } };
}

const N = (id, children = [], text = id, extra = {}) => Object.assign({
    id, type: 'support', texts: [text], collapsed: [], children
}, extra);

function seedMap(W, trees, name) {
    W.win.eval(`
        state.trees = ${JSON.stringify(trees)};
        state.name = ${JSON.stringify(name)};
        ensureCollabFields(state);
        _shadowSnapshot = JSON.stringify({});
        diffAndStamp(state);
        _shadowSnapshot = JSON.stringify(state);
        render();
    `);
}
function addNode(W, parentId, id, text) {
    W.win.eval(`
        (function () {
            function find(ns) { for (const n of ns) { if (n.id === ${JSON.stringify(parentId)}) return n; const r = find(n.children || []); if (r) return r; } return null; }
            const p = find(state.trees);
            p.children.push(${JSON.stringify(N(id, [], text))});
            diffAndStamp(state);
            render();
        })();
    `);
}
const fp = W => W.win.eval('__argmap.syncFingerprint(__argmap.state)');
const texts = W => {
    const out = [];
    const walk = ns => (ns || []).forEach(n => { out.push((n.texts || []).join('|')); walk(n.children); });
    walk(W.win.__argmap.state.trees);
    return out.sort().join(';');
};
const chip = W => W.win.document.getElementById('sync-indicator').getAttribute('data-state');
const defocus = W => { try { W.win.document.activeElement && W.win.document.activeElement.blur(); } catch (e) {} };
async function syncRound(A, B) {
    // The fake cloud delivers cross-client notifications on macrotasks
    // (setTimeout 0, like real network); yield between steps so each
    // client's cache actually hears the other's write.
    defocus(A); defocus(B);
    await A.win.__argmap.engine.pushNow(); await sleep(5);
    await B.win.__argmap.engine.syncNow(); await sleep(5);
    await B.win.__argmap.engine.pushNow(); await sleep(5);
    await A.win.__argmap.engine.syncNow(); await sleep(5);
}

// ---------------------------------------------------------------------------
let pass = 0, fail = 0;
function ok(cond, label, detail) {
    if (cond) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

(async () => {
    const cloud = createFakeCloud();
    const teacher = { uid: 't1', displayName: 'Prof. Turing', email: 'turing@school.edu' };
    const bella = { uid: 's1', displayName: 'Bella Ideas', email: 'bella@school.edu' };
    const carla = { uid: 's2', displayName: 'Carla Reader', email: 'carla@school.edu' };
    const dave = { uid: 's3', displayName: 'Dave Newcomer', email: 'dave@school.edu' };

    const wins = [];
    const A = makeWin('teacher', cloud, { user: teacher }); wins.push(A);
    await sleep(340);

    console.log('=== r26 Firebase collaboration (fake SDK + mirror rules) ===');

    // --- 1. Create room from the teacher's canvas -----------------------
    seedMap(A, [N('root', [N('kidA', [], 'Premise A')], 'Shared contention', { type: 'contention' })], 'Physics Debate');
    const fbA = await A.win.__argmap.collab.firebase();
    const userA = await A.win.__argmap.collab.signIn();
    const { roomId } = await A.win.__argmap.collab.createRoom(fbA, userA);
    const room = () => cloud.getPath('rooms/' + roomId);
    {
        const r = room();
        ok(r && r.meta && r.meta.ownerUid === 't1' && r.meta.accessMode === 'open', 'create: meta has owner + open access');
        const roles = Object.values(r.invites || {}).sort().join(',');
        ok(roles === 'editor,viewer', 'create: one editor + one viewer invite token', roles);
        ok(r.members && r.members.t1 && r.members.t1.role === 'owner', 'create: owner membership written');
        ok(r.document && r.document.version === 1 && typeof r.document.content === 'string', 'create: document v1 uploaded atomically');
        const doc = JSON.parse(r.document.content);
        ok(doc.name === 'Physics Debate' && doc.trees[0].texts[0] === 'Shared contention', 'create: uploaded content is the canvas');
        ok(doc._clientId === undefined && doc._syncBase === undefined, 'create: wire form strips local-only fields');
        ok(r.joinInfo && r.joinInfo.title === 'Physics Debate', 'create: joinInfo preview title present');
    }

    // --- 2. Owner session ------------------------------------------------
    await A.win.__argmap.collab.startSession(fbA, userA, roomId, { role: 'owner' });
    await waitFor(() => A.win.__argmap.engine && A.win.__argmap.engine.getStatus() === 'idle', 'owner engine idle');
    ok(A.win.__argmap.collab.session && A.win.__argmap.collab.session.role === 'owner', 'owner: session active with owner role');
    ok(chip(A) === 'idle', 'owner: sync chip shows Synced', chip(A));
    ok(A.win.document.getElementById('collab-btn').textContent === 'Shared · Editing', 'owner: Collaborate button says Shared · Editing');
    ok(Object.keys(A.win.__argmap.state._presence || {}).length === 0, 'owner: durable doc carries NO presence entries');
    await waitFor(() => {
        const p = room().presence || {};
        return Object.keys(p).some(k => k.indexOf('t1|') === 0);
    }, 'owner presence entry on the ephemeral path');
    ok(true, 'owner: presence lives on the ephemeral RTDB path');
    await waitFor(() => cloud.disconnectOps.size >= 1, 'onDisconnect armed');
    ok(true, 'owner: onDisconnect cleanup armed');
    ok(A.win.eval('currentUser') === 'Prof. Turing', 'owner: Google display name signed in');

    // --- 3. Editor joins via token, adopts the document ------------------
    const tokE = Object.keys(room().invites).find(t => room().invites[t] === 'editor');
    const tokV = Object.keys(room().invites).find(t => room().invites[t] === 'viewer');
    const B = makeWin('bella', cloud, { user: bella }); wins.push(B);
    await sleep(340);
    const fbB = await B.win.__argmap.collab.firebase();
    const userB = await B.win.__argmap.collab.signIn();
    const memB = await B.win.__argmap.collab.joinRoom(fbB, userB, roomId, tokE, 'e');
    ok(memB.role === 'editor' && room().members.s1 && room().members.s1.viaToken === tokE, 'join: token join recorded with editor role');
    await B.win.__argmap.collab.startSession(fbB, userB, roomId, memB);
    await waitFor(() => texts(B) === texts(A), 'editor adopts the shared document');
    ok(true, 'join: pristine editor window adopted the shared map');
    ok(B.win.eval('currentUser') === 'Bella Ideas', 'join: editor signed in under Google name');

    // --- 4. Concurrent edits: CAS conflict -> merge -> convergence -------
    addNode(A, 'root', 'nA', 'Teacher point');
    addNode(B, 'root', 'nB', 'Student point');
    defocus(A); defocus(B);
    await Promise.all([A.win.__argmap.engine.pushNow(), B.win.__argmap.engine.pushNow()]);
    await sleep(10);
    await syncRound(A, B);
    await syncRound(A, B);
    if (fp(A) !== fp(B)) {
        console.log('  [debug] texts(A) =', texts(A));
        console.log('  [debug] texts(B) =', texts(B));
        console.log('  [debug] status A/B =', A.win.__argmap.engine.getStatus(), B.win.__argmap.engine.getStatus());
        console.log('  [debug] debug A =', JSON.stringify(A.win.__argmap.engine._debug()));
        console.log('  [debug] debug B =', JSON.stringify(B.win.__argmap.engine._debug()));
        console.log('  [debug] doc version =', room().document.version);
        console.log('  [debug] conflicts A =', JSON.stringify(A.win.__argmap.state._conflicts));
        console.log('  [debug] conflicts B =', JSON.stringify(B.win.__argmap.state._conflicts));
    }
    ok(fp(A) === fp(B), 'concurrent: fingerprints converge after CAS retry');
    ok(texts(A).includes('Teacher point') && texts(A).includes('Student point'), 'concurrent: both edits survive the race');
    ok((room().document.version || 0) >= 3, 'concurrent: document version advanced monotonically', String(room().document.version));

    // --- 5. Transport-level stale write is rejected ----------------------
    {
        let code = null;
        try { await B.win.__argmap.collab.session.transport.write('junk', '1'); }
        catch (e) { code = e && e.code; }
        ok(code === 'conflict', 'transport: stale expectedVersion rejected with code=conflict', String(code));
    }

    // --- 6. Push notification without polling ----------------------------
    addNode(A, 'root', 'nNotify', 'Live update');
    defocus(A); defocus(B);
    await A.win.__argmap.engine.pushNow();
    await waitFor(() => texts(B).includes('Live update'), 'subscribe-driven pull on the editor');
    ok(true, 'subscribe: remote change arrives without manual pull');

    // --- 7. Presence roster + selections ---------------------------------
    B.win.__argmap.selectedIds = ['nNotify-0'];
    B.win.__argmap.collab.publishPresence(true);
    await waitFor(() => A.win.__argmap.livePresence().some(p => p.label === 'Bella Ideas' && !p.me), 'teacher sees Bella in presence');
    const rosterA = A.win.__argmap.livePresence();
    ok(rosterA.some(p => p.label === 'Prof. Turing' && p.me), 'presence: self entry present');
    await waitFor(() => {
        const p = A.win.__argmap.livePresence().find(x => x.label === 'Bella Ideas');
        return p && p.sel.indexOf('nNotify-0') >= 0;
    }, 'peer selection propagates');
    ok(true, 'presence: peer selection travels');
    ok(Object.keys(A.win.__argmap.state._presence || {}).length === 0, 'presence: still zero entries in the durable doc');

    // --- 8. Viewer: server-refused writes + client read-only guard -------
    const C = makeWin('carla', cloud, { user: carla }); wins.push(C);
    await sleep(340);
    const fbC = await C.win.__argmap.collab.firebase();
    const userC = await C.win.__argmap.collab.signIn();
    const memC = await C.win.__argmap.collab.joinRoom(fbC, userC, roomId, tokV, 'v');
    ok(memC.role === 'viewer', 'viewer: token join yields viewer role');
    await C.win.__argmap.collab.startSession(fbC, userC, roomId, memC);
    await waitFor(() => texts(C) === texts(A), 'viewer adopts the shared document');
    ok(C.win.__argmap.collab.readOnly() === true, 'viewer: collabReadOnly() is true');
    ok(C.win.document.body.classList.contains('viewer-mode'), 'viewer: body carries viewer-mode class');
    ok(C.win.document.getElementById('collab-btn').textContent === 'Shared · View only', 'viewer: button says Shared · View only');
    {
        const before = texts(C);
        C.win.eval('addChild("support")');
        C.win.eval('deleteSelected()');
        C.win.eval('cycleEvaluation()');
        ok(texts(C) === before, 'viewer: structural verbs are inert');
        const ev = new C.win.KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Delete', key: 'Delete' });
        C.win.document.dispatchEvent(ev);
        ok(texts(C) === before, 'viewer: Delete key is inert');
        ok(C.win.eval('canDeleteComment({author:"Carla Reader"})') === false, 'viewer: comment affordances denied');
        const writesBefore = cloud.docWrites.length;
        C.win.eval('state.trees[0].texts[0] = "vandalism"; diffAndStamp(state); render();');
        await C.win.__argmap.engine.pushNow();
        await sleep(50);
        ok(cloud.docWrites.length === writesBefore, 'viewer: read-only engine never attempts a document write');
        let code = null;
        try { await C.win.__argmap.collab.session.transport.write('{"trees":[]}', String(room().document.version)); }
        catch (e) { code = e && e.code; }
        ok(code === 'permission', 'viewer: direct transport write refused by rules (code=permission)', String(code));
        await C.win.__argmap.engine.pullNow();   // resync the vandalized local copy
    }

    // --- 9. Live role promotion ------------------------------------------
    await A.win.__argmap.collab.setMemberRole('s2', 'editor');
    await waitFor(() => C.win.__argmap.collab.session && C.win.__argmap.collab.session.role === 'editor', 'role change reaches the viewer');
    ok(C.win.__argmap.collab.readOnly() === false, 'promotion: read-only guard lifts live');
    ok(!C.win.document.body.classList.contains('viewer-mode'), 'promotion: viewer-mode class removed');

    // --- 10. Closing joins + token rotation ------------------------------
    await A.win.__argmap.collab.setAccessMode('closed');
    const F = makeWin('freddy', cloud, { user: dave }); wins.push(F);
    await sleep(340);
    {
        const fbF = await F.win.__argmap.collab.firebase();
        const userF = await F.win.__argmap.collab.signIn();
        let code = null;
        try { await F.win.__argmap.collab.joinRoom(fbF, userF, roomId, tokE, 'e'); }
        catch (e) { code = e && e.code; }
        ok(code === 'closed', 'closed room: join rejected with a named reason', String(code));
    }
    await A.win.__argmap.collab.setAccessMode('open');
    await waitFor(() => A.win.__argmap.collab.session.invites && Object.keys(A.win.__argmap.collab.session.invites).length === 2, 'owner invite mirror loads');
    await A.win.__argmap.collab.rotateInvite('editor');
    await waitFor(() => !((room().invites || {})[tokE]), 'old editor token revoked');
    const tokE2 = Object.keys(room().invites).find(t => room().invites[t] === 'editor');
    ok(!!tokE2 && tokE2 !== tokE, 'rotate: fresh editor token minted');
    {
        const fbF = await F.win.__argmap.collab.firebase();
        const userF = await F.win.__argmap.collab.signIn();
        let code = null;
        try { await F.win.__argmap.collab.joinRoom(fbF, userF, roomId, tokE, 'e'); }
        catch (e) { code = e && e.code; }
        ok(code === 'closed', 'rotate: dead token cannot join', String(code));
        const memF = await F.win.__argmap.collab.joinRoom(fbF, userF, roomId, tokE2, 'e');
        ok(memF.role === 'editor', 'rotate: fresh token joins fine');
        await F.win.__argmap.collab.startSession(fbF, userF, roomId, memF);
        await waitFor(() => texts(F) === texts(A), 'fresh-token member adopts the doc');
    }

    // --- 11. Member removal = live access loss ---------------------------
    await A.win.__argmap.collab.removeMember('s3');
    await waitFor(() => F.win.__argmap.collab.session && F.win.__argmap.collab.session.accessLost === 'removed', 'removed member notices');
    ok(chip(F) === 'access', 'removal: chip names the access loss', chip(F));
    ok(texts(F) === texts(A), 'removal: last synced copy stays on screen');

    // --- 12. Malformed remote content is survivable ----------------------
    {
        const good = room().document.content;
        const v = room().document.version;
        cloud.setPath('rooms/' + roomId + '/document', { version: v + 1, content: '{broken json', updatedAt: 1, updatedBy: 'x' });
        await waitFor(() => B.win.__argmap.collab.session.transport._debug().cache.version === String(v + 1), 'broken content reaches the cache');
        await B.win.__argmap.engine.pullNow();
        ok(B.win.__argmap.engine.getStatus() === 'error', 'malformed: engine reports error, does not crash');
        ok(chip(B) === 'malformed', 'malformed: chip names unreadable data', chip(B));
        cloud.setPath('rooms/' + roomId + '/document', { version: v + 2, content: good, updatedAt: 1, updatedBy: 'x' });
        await B.win.__argmap.engine.pullNow();
        await waitFor(() => ['idle', 'conflicts'].includes(B.win.__argmap.engine.getStatus()), 'malformed: recovery after repair');
        ok(true, 'malformed: engine recovers once content is valid again');
    }

    // --- 13. Offline: named state, edits queue, reconnect ----------------
    {
        cloud.setConnected(false);
        await waitFor(() => A.win.__argmap.collab.session.connected === false, 'connectivity flag drops');
        await waitFor(() => chip(A) === 'offline', 'offline chip');
        ok(chip(A) === 'offline', 'offline: chip says changes are waiting', chip(A));
        addNode(A, 'root', 'nOff', 'Written while offline');
        A.win.eval('autosaveNow()');
        const cacheKey = A.win.__argmap.collab.cacheKey(roomId, 't1');
        const cached = A.win.localStorage.getItem(cacheKey);
        ok(!!cached && cached.includes('Written while offline'), 'offline: per-room offline copy holds the pending edit');
        defocus(A);
        await A.win.__argmap.engine.pushNow();   // fails against the dead network, engine survives
        cloud.setConnected(true);
        await waitFor(() => A.win.__argmap.collab.session.connected === true, 'connectivity returns');
        await A.win.__argmap.engine.syncNow();
        await waitFor(() => (JSON.parse(room().document.content).trees[0].children || []).some(n => n.id === 'nOff'), 'queued edit lands after reconnect');
        ok(true, 'offline: pending edit syncs on reconnect');
        await waitFor(() => texts(B).includes('Written while offline'), 'peers receive the reconnect push');
    }

    // --- 14. Join-link boot: local autosave must NOT leak into the room --
    {
        const decoy = JSON.stringify({ name: 'Decoy Local Map', trees: [N('decoy', [], 'Decoy secret')], _nodeVersions: { decoy: { ts: 5, by: 'x' } } });
        const D = makeWin('dave2', cloud, {
            hash: '#join=' + roomId + '.' + tokE2 + '.e',
            seedLocal: { 'argmap-autosave': decoy },
        });
        wins.push(D);
        D.mods._auth.popupUser = dave;   // sign-in happens via the Join button
        await sleep(400);
        ok(!texts(D).includes('Decoy secret'), 'join boot: local autosave NOT restored into the shared context');
        ok(D.win.__argmap.collab.bootIntent && D.win.__argmap.collab.bootIntent.kind === 'join', 'join boot: intent parsed from #fragment');
        ok(D.win.location.hash === '', 'join boot: secret stripped from the URL');
        ok(D.win.document.getElementById('collab-modal-backdrop').classList.contains('open'), 'join boot: Collaborate panel opened');
        await sleep(80);
        ok(D.win.__argmap.collab.bootIntent.info === undefined, 'join boot: signed-out window shows generic invite (no preview fetch)');
        D.win.__argmap.collab.confirmJoin();
        await waitFor(() => D.win.__argmap.collab.session && !D.win.__argmap.collab.bootIntent, 'confirmJoin completes');
        await waitFor(() => texts(D) === texts(A), 'joined window adopts the doc');
        ok(true, 'join boot: sign-in + join + adopt all from one link');
        ok(room().members.s3 && room().members.s3.role === 'editor', 'join boot: membership re-created after earlier removal');
        // capture Dave's storage for the rejoin test BEFORE closing
        var daveCache = {
            marker: D.win.sessionStorage.getItem('argmap-room-session'),
            cacheKey: D.win.__argmap.collab.cacheKey(roomId, 's3'),
        };
        addNode(D, 'root', 'nRejoin', 'Edit before reload');
        D.win.eval('autosaveNow()');
        daveCache.cacheVal = D.win.localStorage.getItem(daveCache.cacheKey);
        const dKey = D.win.__argmap.collab.session.presence.key;
        D.win.close();
        // The tab died without leaving: the SERVER's onDisconnect op is what
        // retires its presence entry. Simulate that detection.
        cloud.fireDisconnectOps(p => p.indexOf(dKey) >= 0);
        await waitFor(() => !Object.keys(room().presence || {}).some(k => k === dKey), 'onDisconnect retires the dead tab');
        ok(true, 'onDisconnect: dead tab presence entry removed server-side');
    }

    // --- 15. Reload/rejoin: marker + offline copy restore + merge --------
    {
        const E = makeWin('dave3', cloud, {
            user: dave,
            seedLocal: { [daveCache.cacheKey]: daveCache.cacheVal },
            seedSession: { 'argmap-room-session': daveCache.marker || roomId },
        });
        wins.push(E);
        await sleep(400);
        await waitFor(() => E.win.__argmap.collab.session && E.win.__argmap.engine, 'rejoin session auto-starts', 6000);
        ok(true, 'rejoin: tab marker reconnects without any link');
        ok(texts(E).includes('Edit before reload'), 'rejoin: offline copy restored (pending edit present)');
        defocus(E);
        await E.win.__argmap.engine.syncNow();
        await waitFor(() => texts(A).includes('Edit before reload'), 'pending edit merges out to the room');
        ok(true, 'rejoin: pre-reload edit merged into the shared doc');
        // --- 16. Leave with cache removal (shared computers) -------------
        await E.win.__argmap.collab.leave({ keepCache: false });
        ok(E.win.__argmap.collab.session === null || E.win.__argmap.collab.session === undefined || !E.win.__argmap.collab.active(), 'leave: session torn down');
        ok(E.win.sessionStorage.getItem('argmap-room-session') === null, 'leave: rejoin marker cleared');
        ok(E.win.localStorage.getItem(daveCache.cacheKey) === null, 'leave: offline copy removed');
        ok(E.win.document.getElementById('collab-btn').textContent === 'Collaborate', 'leave: button back to local state');
        try {
            await waitFor(() => !Object.keys(room().presence || {}).some(k => k.indexOf('s3|') === 0), 'leave: presence entry gone');
            ok(true, 'leave: ephemeral presence cleaned up');
        } catch (e) {
            console.log('  [debug] remaining presence keys:', Object.keys(room().presence || {}));
            console.log('  [debug] disconnect ops:', [...cloud.disconnectOps.keys()]);
            ok(false, 'leave: ephemeral presence cleaned up', Object.keys(room().presence || {}).join(','));
        }
    }

    // --- 17. Self-contained links (bring-your-own-backend) ---------------
    const tokE3 = Object.keys(room().invites).find(t => room().invites[t] === 'editor');
    {
        const linkE = A.win.__argmap.collab.buildLink(roomId, tokE3, 'editor');
        ok(linkE.indexOf('&fb=') > 0, 'links: non-baked backend config is embedded in the fragment');
        ok(linkE.indexOf('?') === -1 || linkE.indexOf('?') > linkE.indexOf('#'), 'links: nothing secret in the query string');
        const parsed = A.win.__argmap.collab.parseJoinHash('#' + linkE.split('#')[1]);
        ok(!!parsed && parsed.token === tokE3 && parsed.roleHint === 'e', 'links: room/token/role round-trip');
        ok(!!parsed.cfg && parsed.cfg.projectId === 'fake-proj' && !!parsed.cfg.databaseURL, 'links: backend config round-trips');
    }

    // --- 18. Zero-setup member: joins via link in a window with NO config -
    {
        const grace = { uid: 's5', displayName: 'Grace Linkfollower', email: 'grace@school.edu' };
        const linkE = A.win.__argmap.collab.buildLink(roomId, tokE3, 'editor');
        const G = makeWin('grace', cloud, { user: grace, noConfig: true, hash: '#' + linkE.split('#')[1] });
        wins.push(G);
        await sleep(400);
        ok(G.win.localStorage.getItem('argmap-firebase-config') === null, 'BYO link: member window has no configuration of its own');
        ok(G.win.__argmap.collab.bootIntent && G.win.__argmap.collab.bootIntent.cfg
            && G.win.__argmap.collab.bootIntent.cfg.projectId === 'fake-proj', 'BYO link: backend arrives via the link');
        await waitFor(() => G.win.__argmap.collab.bootIntent && G.win.__argmap.collab.bootIntent.info, 'signed-in preview loads');
        ok(G.win.__argmap.collab.bootIntent.info.title === 'Physics Debate', 'BYO link: signed-in member sees the map title before joining');
        G.win.__argmap.collab.confirmJoin();
        await waitFor(() => G.win.__argmap.collab.session && !G.win.__argmap.collab.bootIntent, 'link-only member joins');
        await waitFor(() => texts(G) === texts(A), 'link-only member adopts the doc');
        ok(true, 'BYO link: click → join → adopt with zero member setup');
        const reg = G.win.__argmap.collab.registryEntry(roomId);
        ok(!!reg && !!reg.cfg && reg.cfg.projectId === 'fake-proj', 'BYO link: recent-rooms entry remembers the backend for rejoin');
        await G.win.__argmap.collab.leave({ keepCache: false });
    }

    // --- 19. Setup wizard verifier ---------------------------------------
    {
        const hana = { uid: 'w1', displayName: 'Hana Leader', email: 'hana@x' };
        const H = makeWin('hana', cloud, { noConfig: true });
        wins.push(H);
        await sleep(340);
        H.mods._auth.popupUser = hana;
        const okv = await H.win.__argmap.collab.verifySetup(JSON.parse(FAKE_CONFIG));
        ok(okv === true, 'wizard: verifySetup passes against a correctly configured backend');
        ok(H.win.localStorage.getItem('argmap-firebase-config') !== null, 'wizard: verified config saved as this browser default');
        const probes = Object.keys((cloud.tree.rooms || {})).filter(k => k.indexOf('probe') === 0);
        ok(probes.length === 0, 'wizard: throwaway probe room cleaned up', probes.join(','));

        const H2 = makeWin('hana2', cloud, { noConfig: true });
        wins.push(H2);
        await sleep(340);
        let code = null;
        try { await H2.win.__argmap.collab.verifySetup(JSON.parse(FAKE_CONFIG)); }
        catch (e) { code = e && e.code; }
        ok(code === 'auth/popup-blocked', 'wizard: sign-in failure surfaces with a named, fixable error', String(code));
        ok(H2.win.localStorage.getItem('argmap-firebase-config') === null, 'wizard: failed verification saves nothing');
    }

    // --- 20. Remote edits land WHILE typing (no more deferral) ------------
    {
        A.win.eval(`
            (function () {
                const host = document.querySelector('.node[data-node-id="kidA"][data-node-idx="0"]');
                const ta = host.querySelector('textarea');
                const rd = host.querySelector('.rendered-text');
                rd.style.display = 'none';
                ta.style.display = ''; ta.readOnly = false;
                ta.focus();
                ta.value = 'Premise A plus my typing';
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                ta.setSelectionRange(ta.value.length, ta.value.length);
            })();
        `);
        addNode(B, 'root', 'nLive', 'Live while typing');
        defocus(B);
        await B.win.__argmap.engine.pushNow();
        await waitFor(() => texts(A).includes('Live while typing'), 'remote edit lands mid-typing');
        ok(true, 'live-typing: peer edit appears while a textbox is being edited');
        const st = A.win.eval(`(function () {
            const a = document.activeElement;
            return { isTa: !!(a && a.tagName && a.tagName.toLowerCase() === 'textarea'),
                     id: a && a.getAttribute && a.getAttribute('data-id'),
                     ro: a ? a.readOnly : null, val: a && a.value, sel: a && a.selectionStart };
        })()`);
        ok(st.isTa && st.id === 'kidA' && st.ro === false, 'live-typing: same box still in edit mode after the merge', JSON.stringify(st));
        ok(st.val === 'Premise A plus my typing', 'live-typing: in-progress text survived the merge', String(st.val));
        ok(st.sel === 'Premise A plus my typing'.length, 'live-typing: caret position preserved', String(st.sel));
        A.win.eval('document.activeElement && document.activeElement.blur()');
        await syncRound(A, B);
        ok(texts(B).includes('Premise A plus my typing'), 'live-typing: the typed text reaches the peer too');
    }

    // --- 21. Unsubmitted comment drafts survive a merge -------------------
    {
        B.win.eval('addComment({ kind: "box", id: "kidA", idx: 0 }, "seed comment for a row")');
        defocus(B);
        await B.win.__argmap.engine.pushNow();
        await waitFor(() => JSON.stringify(A.win.__argmap.state.trees).includes('seed comment for a row'), 'seed comment arrives');
        A.win.eval('if (!evalOverviewOpen) toggleEvalOverview();');
        await sleep(60);
        const drafted = A.win.eval(`(function () {
            const c = document.querySelector('.eval-composer[data-loc-key="box|kidA|0||ov"]');
            if (!c) return false;
            c.value = 'half-typed reply'; c.focus();
            return true;
        })()`);
        ok(drafted, 'draft: overview row composer present');
        addNode(B, 'root', 'nDraft', 'Another live edit');
        defocus(B);
        await B.win.__argmap.engine.pushNow();
        await waitFor(() => texts(A).includes('Another live edit'), 'second remote edit lands');
        const after = A.win.eval(`(function () {
            const c = document.querySelector('.eval-composer[data-loc-key="box|kidA|0||ov"]');
            return { val: c && c.value, focused: document.activeElement === c };
        })()`);
        ok(after.val === 'half-typed reply', 'draft: unsubmitted overview draft survives the merge', String(after.val));
        ok(after.focused === true, 'draft: composer keeps focus through the merge');
        A.win.eval('document.activeElement && document.activeElement.blur(); if (evalOverviewOpen) toggleEvalOverview();');
    }

    // --- 22. Map title is a shared, newest-wins edit ----------------------
    {
        A.win.eval(`
            const mn = document.getElementById('map-name');
            mn.value = 'Physics Debate II';
            mn.dispatchEvent(new Event('blur'));
        `);
        defocus(A);
        await A.win.__argmap.engine.pushNow();
        await waitFor(() => B.win.__argmap.state.name === 'Physics Debate II', 'rename reaches the peer');
        ok(B.win.document.getElementById('map-name').value === 'Physics Debate II', 'title: peer header updates live');
        B.win.eval(`
            const mn = document.getElementById('map-name');
            mn.value = 'Physics Debate III';
            mn.dispatchEvent(new Event('blur'));
        `);
        defocus(B);
        await B.win.__argmap.engine.pushNow();
        await waitFor(() => A.win.__argmap.state.name === 'Physics Debate III', 'rename works from the other side too');
        ok(true, 'title: renames are global in both directions (newest wins, not remote-always)');
    }

    // --- 23. @mentions know everyone in the room --------------------------
    {
        const users = A.win.eval('collectMapUsers()');
        ok(users.indexOf('Bella Ideas') >= 0 && users.indexOf('Prof. Turing') >= 0,
            'mentions: live collaborators are @mentionable without having commented', JSON.stringify(users));
    }

    // --- 24. "Save now" works with Autosave off ---------------------------
    {
        const L = makeWin('localsave', cloud, {});
        wins.push(L);
        await sleep(340);
        // Maps are stored per-map now (argmap-map:<id>), indexed by
        // argmap-maps — not in the old single argmap-autosave slot.
        const storedText = () => L.win.eval(`
            (function () {
                var raw = localStorage.getItem('argmap-maps');
                var list = raw ? JSON.parse(raw) : [];
                return list.map(function (e) { return localStorage.getItem('argmap-map:' + e.id) || ''; }).join('|');
            })();
        `);
        L.win.eval('setAutosaveEnabled(false)');
        L.win.eval(`
            (function () {
                var raw = localStorage.getItem('argmap-maps');
                (raw ? JSON.parse(raw) : []).forEach(function (e) { localStorage.removeItem('argmap-map:' + e.id); });
                localStorage.removeItem('argmap-maps');
                localStorage.removeItem('argmap-autosave');
            })();
        `);
        L.win.eval('state.trees[0].texts[0] = "Manual save test"; diffAndStamp(state); render();');
        await sleep(600);   // the (disabled) autosave debounce passes without writing
        ok(storedText().indexOf('Manual save test') === -1, 'manual save: autosave off writes nothing on its own');
        L.win.eval('manualLocalSave()');
        ok(storedText().indexOf('Manual save test') >= 0, 'manual save: Save now persists with Autosave off');
    }

    // --- 25. Automatic backup + reversible restore ------------------------
    {
        await A.win.__argmap.collab.maybeBackup(true);
        const b1 = cloud.getPath('rooms/' + roomId + '/backup');
        ok(!!b1 && typeof b1.content === 'string' && b1.content.indexOf('Shared contention') >= 0,
            'backup: owner snapshot captures the current document');
        let code = null;
        try { await B.mods.db.get(B.mods.db.ref(null, 'rooms/' + roomId + '/backup')); }
        catch (e) { code = e && e.code; }
        ok(String(code).indexOf('PERMISSION') >= 0, 'backup: non-owners cannot read the backup', String(code));

        // Simulate the reported failure: a client wipes a textbox and the
        // wipe syncs everywhere with the newest stamp.
        B.win.eval(`
            (function () {
                function find(ns) { for (const n of ns) { if (n.id === 'root') return n; const r = find(n.children || []); if (r) return r; } return null; }
                find(state.trees).texts[0] = '';
                diffAndStamp(state); render();
            })();
        `);
        defocus(B);
        await B.win.__argmap.engine.pushNow();
        await waitFor(() => !texts(A).includes('Shared contention'), 'wipe reaches the owner');

        await A.win.__argmap.collab.restoreBackup();
        await waitFor(() => String(room().document.content).indexOf('Shared contention') >= 0, 'restore lands on the server');
        ok(true, 'backup: restore puts the content back on the server');
        await waitFor(() => texts(A).includes('Shared contention'), 'owner canvas restored');
        await waitFor(() => texts(B).includes('Shared contention'), 'wiping client restored too');
        ok(true, 'backup: restored content wins newest-wins on every client (a plain rollback would have merged right back out)');
        const b2 = cloud.getPath('rooms/' + roomId + '/backup');
        ok(!!b2 && String(b2.content).indexOf('Shared contention') === -1,
            'backup: restore is reversible — the pre-restore document became the new backup');
    }

    // --- 26. Restore rolls back a comment DELETED after the backup -------
    // Review finding: node text rolled back but comment deletions did not,
    // because the deletion registry (delTs) out-dated the restored comment
    // on every client. The fix re-stamps live comments' editedTs to now so
    // they resurrect across clients.
    const liveComment = (W, text) => W.win.eval(`
        (function () {
            var found = false;
            (function walk(ns){ (ns||[]).forEach(function(n){ (n.evalThreads||[]).forEach(function(th){ (th||[]).forEach(function(c){ if (c && !c.deleted && c.text === ${JSON.stringify(text)}) found = true; }); }); walk(n.children||[]); }); })(state.trees);
            (state.overviewThread||[]).forEach(function(c){ if (c && !c.deleted && c.text === ${JSON.stringify(text)}) found = true; });
            return found;
        })();
    `);
    {
        // Editor B authors a comment so B is allowed to delete it later.
        B.win.eval(`addComment({ kind: 'box', id: 'root', idx: 0 }, 'resurrect me')`);
        defocus(B);
        await B.win.__argmap.engine.pushNow();
        await waitFor(() => liveComment(A, 'resurrect me'), 'comment reaches the owner');

        await A.win.__argmap.collab.maybeBackup(true);   // backup captures the comment
        const bc = cloud.getPath('rooms/' + roomId + '/backup');
        ok(bc && bc.content.indexOf('resurrect me') >= 0, 'backup: the comment is in the snapshot');

        const cid = B.win.eval(`
            (function(){ var id=null; (function walk(ns){(ns||[]).forEach(function(n){ if(n.id==='root'){ (n.evalThreads||[]).forEach(function(th){(th||[]).forEach(function(c){ if(c.text==='resurrect me') id=c.id; });}); } walk(n.children||[]); });})(state.trees); return id; })();
        `);
        B.win.eval(`deleteComment({ kind: 'box', id: 'root', idx: 0 }, ${JSON.stringify(cid)})`);
        defocus(B);
        await B.win.__argmap.engine.pushNow();
        await waitFor(() => !liveComment(A, 'resurrect me'), 'deletion reaches the owner');
        ok(!liveComment(A, 'resurrect me') && !liveComment(B, 'resurrect me'), 'comment: deleted on both clients before restore');

        await A.win.__argmap.collab.restoreBackup();
        await waitFor(() => liveComment(A, 'resurrect me'), 'restore brings the comment back on the owner');
        await waitFor(() => liveComment(B, 'resurrect me'), 'restore brings the comment back on the DELETING client too');
        ok(liveComment(A, 'resurrect me') && liveComment(B, 'resurrect me'),
            'backup fix: a comment deleted after the backup is resurrected on every client by restore');
    }

    // --- 27. Same-box popover + overview composers have distinct keys -----
    // Review finding: both carried loc-key "box|id|idx|", so a draft in one
    // was dropped in favour of the other during a merge. The surface tag
    // ('pop'/'ov') disambiguates them.
    {
        const P = makeWin('composerkeys', cloud, {});
        wins.push(P);
        await sleep(340);
        P.win.eval(`
            state.trees = [{ id:'m', type:'contention', texts:['main'], collapsed:[], children:[
                { id:'n', type:'support', texts:['premise'], collapsed:[], children:[] } ] }];
            ensureCollabFields(state);
            selectedIds = ['n-0'];
            render();
            addComment({ kind:'box', id:'n', idx:0 }, 'a note');   // makes the overview row appear
            if (!evalOverviewOpen) toggleEvalOverview();
            openEvalThreadPopover(document.body, 'n', 0);
        `);
        await sleep(80);
        const keys = P.win.eval(`
            Array.prototype.slice.call(document.querySelectorAll('.eval-composer[data-loc-key]'))
                .map(function (c) { return c.dataset.locKey; })
                .filter(function (k) { return k.indexOf('box|n|0|') === 0; })
        `);
        ok(keys.length >= 2, 'composer keys: both a popover and an overview composer exist for box n', JSON.stringify(keys));
        ok(new Set(keys).size === keys.length, 'composer keys: same-box composers now have DISTINCT loc-keys', JSON.stringify(keys));
    }

    // --- 28. collectMapUsers is memoized per generation ------------------
    // Review finding: called once per rendered box; now cached within a
    // render generation and invalidated by render()/renderPresence().
    {
        const M = makeWin('memo', cloud, {});
        wins.push(M);
        await sleep(340);
        M.win.eval(`
            state.trees = [{ id:'r', type:'contention', texts:['x'], collapsed:[], children:[] }];
            ensureCollabFields(state);
            render();
        `);
        const u1 = M.win.eval('JSON.stringify(collectMapUsers())');
        // Mutate an author directly, WITHOUT render(): same generation, so
        // the cache should still be returned.
        M.win.eval(`state.overviewThread = (state.overviewThread || []); state.overviewThread.push({ id:'zzz', author:'Ghost Author', ts:1, text:'x' });`);
        const u2 = M.win.eval('JSON.stringify(collectMapUsers())');
        ok(u1 === u2, 'memoization: repeated calls within a generation return the cached list');
        // render() bumps the generation → the new author appears.
        M.win.eval('render()');
        const u3 = M.win.eval('collectMapUsers()');
        ok(u3.indexOf('Ghost Author') >= 0, 'memoization: render() invalidates the cache (fresh authors appear)');
    }

    // --- 29. Guests: viewing with no Google account ----------------------
    {
        const meta0 = cloud.getPath('rooms/' + roomId + '/meta');
        ok(meta0.guestViewers === true && meta0.guestEditors === false,
            'guest defaults: viewing open to guests, editing is not', JSON.stringify(meta0));

        const tokV2 = Object.keys(room().invites).find(t => room().invites[t] === 'viewer');
        const linkV = A.win.__argmap.collab.buildLink(roomId, tokV2, 'viewer');
        // No `user` and no popupUser: a Google sign-in in this window would
        // fail outright, so anything that works here works WITHOUT an account.
        const GV = makeWin('guestviewer', cloud, { hash: '#' + linkV.split('#')[1] });
        wins.push(GV);
        await sleep(400);
        GV.win.__argmap.collab.confirmJoin('guest');
        await waitFor(() => GV.win.__argmap.collab.session, 'guest viewer joins');
        await waitFor(() => texts(GV) === texts(A), 'guest viewer adopts the shared doc');
        ok(true, 'guest: joined a view link and can read, with no Google account');
        ok(GV.win.__argmap.collab.readOnly() === true, 'guest: viewer is still read-only');
        const guid = GV.win.__argmap.collab.session.user.uid;
        const mem = room().members[guid];
        ok(mem && mem.role === 'viewer' && mem.displayName === 'Guest',
            'guest: member record is labelled Guest for the owner', JSON.stringify(mem));
        ok(GV.win.eval('currentUser') === '',
            'guest: no display name, so the app’s anonymous path applies');
        await waitFor(() => A.win.__argmap.livePresence().some(p => p.anon && !p.me), 'owner sees an anonymous peer');
        ok(true, 'guest: shows as “Anonymous” in everyone else’s roster');
        // Live edits still reach a guest viewer.
        addNode(A, 'root', 'nGuest', 'Visible to guests');
        defocus(A);
        await A.win.__argmap.engine.pushNow();
        await waitFor(() => texts(GV).includes('Visible to guests'), 'guest viewer receives live edits');
        ok(true, 'guest: receives collaborators’ edits live');
    }

    // --- 30. Guests may NOT edit unless the owner allows it --------------
    {
        const tokE4 = Object.keys(room().invites).find(t => room().invites[t] === 'editor');
        const GE = makeWin('guesteditor', cloud, {});
        wins.push(GE);
        await sleep(340);
        const fbG = await GE.win.__argmap.collab.firebase();
        const gu = await GE.win.__argmap.collab.signIn(null, { guest: true });
        ok(!!gu && gu.isAnonymous === true, 'guest: anonymous sign-in yields a real uid', gu && gu.uid);

        let code = null;
        try { await GE.win.__argmap.collab.joinRoom(fbG, gu, roomId, tokE4, 'e'); }
        catch (e) { code = e && e.code; }
        ok(code === 'guest-editor-denied', 'guest: editing refused by default, with a named reason', String(code));
        ok(!room().members[gu.uid], 'guest: no member record written when refused');

        await A.win.__argmap.collab.setGuestAccess('guestEditors', true);
        await waitFor(() => cloud.getPath('rooms/' + roomId + '/meta').guestEditors === true, 'owner enables guest editing');
        const m = await GE.win.__argmap.collab.joinRoom(fbG, gu, roomId, tokE4, 'e');
        ok(m && m.role === 'editor', 'guest: may edit once the owner allows it', JSON.stringify(m));
        await A.win.__argmap.collab.setGuestAccess('guestEditors', false);
    }

    // --- 31. Owner can close guest viewing too ---------------------------
    {
        await A.win.__argmap.collab.setGuestAccess('guestViewers', false);
        await waitFor(() => cloud.getPath('rooms/' + roomId + '/meta').guestViewers === false, 'guest viewing disabled');
        const tokV3 = Object.keys(room().invites).find(t => room().invites[t] === 'viewer');
        const GX = makeWin('guestblocked', cloud, {});
        wins.push(GX);
        await sleep(340);
        const fbX = await GX.win.__argmap.collab.firebase();
        const gx = await GX.win.__argmap.collab.signIn(null, { guest: true });
        let code = null;
        try { await GX.win.__argmap.collab.joinRoom(fbX, gx, roomId, tokV3, 'v'); }
        catch (e) { code = e && e.code; }
        ok(code === 'guest-viewer-denied', 'guest: viewing refused when the owner turns guests off', String(code));
        await A.win.__argmap.collab.setGuestAccess('guestViewers', true);
    }

    // --- 32. LEGACY room: created before guest access existed ------------
    // Regression: the first cut required meta.guestViewers === true, so every
    // room made before the feature refused guests — while the owner's panel,
    // reading a missing field as the default, showed guests as allowed. The
    // rules now treat missing as the default too.
    {
        const legacyId = 'legacyroom' + collabRandIdish();
        const now = Date.now();
        const legacy = {
            // NOTE: no guestViewers / guestEditors keys at all.
            meta: { ownerUid: 't1', accessMode: 'open', createdAt: now },
            joinInfo: { title: 'Legacy Map', ownerName: 'Prof. Turing' },
            invites: { legacyviewtok: 'viewer', legacyedittok: 'editor' },
            members: { t1: { role: 'owner', displayName: 'Prof. Turing', joinedAt: now } },
            document: { version: 1, content: '{"name":"Legacy Map","trees":[]}', updatedAt: now, updatedBy: 't1' }
        };
        cloud.setPath('rooms/' + legacyId, legacy);
        ok(cloud.getPath('rooms/' + legacyId + '/meta').guestViewers === undefined,
            'legacy room: has no guest settings at all');

        const GL = makeWin('guestlegacy', cloud, {});
        wins.push(GL);
        await sleep(340);
        const fbL = await GL.win.__argmap.collab.firebase();
        const gl = await GL.win.__argmap.collab.signIn(null, { guest: true });
        const mem = await GL.win.__argmap.collab.joinRoom(fbL, gl, legacyId, 'legacyviewtok', 'v');
        ok(mem && mem.role === 'viewer', 'legacy room: a guest can still VIEW without migration', JSON.stringify(mem));

        // ...but editing still needs the owner's explicit opt-in.
        const GL2 = makeWin('guestlegacy2', cloud, {});
        wins.push(GL2);
        await sleep(340);
        const fbL2 = await GL2.win.__argmap.collab.firebase();
        const gl2 = await GL2.win.__argmap.collab.signIn(null, { guest: true });
        let code = null;
        try { await GL2.win.__argmap.collab.joinRoom(fbL2, gl2, legacyId, 'legacyedittok', 'e'); }
        catch (e) { code = e && e.code; }
        ok(code === 'guest-editor-denied', 'legacy room: guest EDITING still refused by default', String(code));
    }

    // --- Runtime error audit ---------------------------------------------
    for (const W of wins) {
        // jsdom reports uncaught exceptions via the virtual console
    }
    const allErrors = wins.flatMap(W => W.errors);
    ok(allErrors.length === 0, 'no jsdom runtime errors across all windows', allErrors.slice(0, 3).join(' | '));

    console.log(`\n--- collab-r26-firebase: ${pass} passed, ${fail} failed ---`);
    wins.forEach(W => { try { W.win.close(); } catch (e) {} });
    process.exit(fail ? 1 : 0);
})().catch(err => {
    console.error('HARNESS ERROR', err && err.stack || err);
    process.exit(2);
});
