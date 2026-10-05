'use strict';
// r27.80 collaboration: display names that Object.prototype also has.
//
// A display name is whatever someone types, and the name leases
// (_nameClaims) are an object keyed by it. Reproduced before the fix:
//
//   (1) signing in as "__proto__" set the lease table's PROTOTYPE to the
//       claim instead of storing it: no lease was recorded (JSON drops it),
//       so anyone could take the name at once, and every other name looked
//       up in that table inherited the claim's fields.
//   (2) a name the table inherits ("constructor", "toString", ...) read back
//       as Object's own function. A merge where only one side held such a
//       name kept the function, which JSON drops: the lease vanished from
//       the shared map, and two peers never agreed on a fingerprint, so
//       each kept writing the map back to the other.
//   (3) the wire serializer and the adopt path (a window's first pull)
//       copied the table key by key into {}, which drops "__proto__" again.
//
// Guards: ordinary names behave as before, and the JSON a map is saved and
// shared as is byte for byte what it was. (The lease rules themselves -- one
// Google account on two devices, a refused switch -- are tested in
// collab-r27-name-lease-test.js.)
//
// Run:  node collab-r27-name-keys-test.js [argument-mapper-r27.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const SRC = process.argv[2] || (__dirname + '/argument-mapper-r27.html');
const HTML = fs.readFileSync(SRC, 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(cond, label, detail) {
    if (cond) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

function makeWin(label) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
    function stubs(win) {
        const { webcrypto } = require('crypto');
        if (!win.crypto || !win.crypto.randomUUID) Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
        win.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
        win.ResizeObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
        const ctx = new Proxy({}, { get: (_t, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        win.HTMLCanvasElement.prototype.getContext = () => ctx;
        win.indexedDB = {
            open() { const r = {}; setTimeout(() => r.onerror && r.onerror({ target: { error: new Error('idb off') } }), 0); return r; },
            deleteDatabase() { const r = {}; setTimeout(() => r.onsuccess && r.onsuccess({}), 0); return r; }
        };
        win.requestAnimationFrame = cb => win.setTimeout(() => cb(Date.now()), 0);
        win.cancelAnimationFrame = win.clearTimeout;
        win.scrollTo = () => {};
        win.__alerts = [];
        win.alert = m => { win.__alerts.push(String(m)); };
        win.confirm = () => true; win.prompt = () => null; win.open = () => null;
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}

// In the page. claim(): what a lease table holds for a name, counting OWN
// properties only -- an inherited member is not a lease. sound(): the
// table's prototype is still an ordinary one (or none), not a claim.
// doc(): a map whose lease table arrives as parsed JSON, the way a file or
// the server delivers it ("__proto__" is then an ordinary key; written in a
// literal it would set the prototype instead).
const HELPERS = `
  window.__t = {
    claim(t, name) {
      t = t || {};
      var own = Object.prototype.hasOwnProperty.call(t, name), v = own ? t[name] : undefined;
      return { own: own, kind: own ? typeof v : 'none', claim: v && typeof v === 'object' ? v : null };
    },
    sound(t) { var p = Object.getPrototypeOf(t || {}); return p === null || p === Object.prototype; },
    jsonKeys(t) { return Object.keys(JSON.parse(JSON.stringify(t || {}))).sort(); },
    doc(claimsJson) {
      return JSON.parse('{"name":"Keys","trees":[{"id":"root","type":"contention","texts":["A claim"],"collapsed":[],"children":[]}],' +
                        '"_nameClaims":' + claimsJson + '}');
    }
  };
`;
const E = (w, body) => JSON.parse(w.eval(`JSON.stringify((function () { ${body} })())`));
const q = s => JSON.stringify(s);
const claimOf = (w, name) => E(w, `return __t.claim(state._nameClaims, ${q(name)});`);
const userOf = w => w.eval('currentUser');
const cidOf = w => w.eval('_clientId');
const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
// A lease table as JSON text, built from [name, claim] pairs: an object
// literal in this file would turn a "__proto__" entry into a prototype.
const claimsJson = pairs => '{' + pairs.map(([n, c]) => q(n) + ':' + q(c)).join(',') + '}';
// Signing in while someone else holds the name: refused, with the alert.
function refused(w, name) {
    const before = userOf(w), alerts = w.__alerts.length;
    w.applySignIn(name);
    const said = w.__alerts.slice(alerts).join(' ');
    return { refused: userOf(w) === before && /is in use by someone else/.test(said), user: userOf(w), said };
}

const TRICKY = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];

async function scenario(name, fn) {
    console.log('\n-- ' + name + ' --');
    const wins = [];
    const open = async (label) => { const W = makeWin(label); wins.push(W); await sleep(300); W.win.eval(HELPERS); return W; };
    try {
        await fn(open);
        const errors = wins.flatMap(W => W.errors);
        ok(errors.length === 0, 'no script errors', errors.slice(0, 3).join(' | '));
    } catch (e) {
        ok(false, name + ' ran to completion', String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
    } finally {
        wins.forEach(W => { try { W.win.close(); } catch (e) {} });
    }
}

// Two windows on one shared map over the real sync engine (memory transport,
// as collab-r27-boxshift-test.js): A makes the map, B adopts it.
async function pair(open, labels) {
    const A = await open(labels[0]), B = await open(labels[1]);
    const GA = A.win.__argmap, GB = B.win.__argmap;
    const store = { content: null, version: 0, subs: new Set() };
    await GA.initSync(GA.createMemoryTransport({ store }), { pollInterval: 1e9, pushDebounce: 1e9 });
    await GB.initSync(GB.createMemoryTransport({ store }), { pollInterval: 1e9, pushDebounce: 1e9 });
    const defocus = w => { const a = w.document.activeElement; if (a && a.blur) a.blur(); };
    const sync = async (rounds = 1) => {
        defocus(A.win); defocus(B.win);
        for (let i = 0; i < rounds; i++) {
            await GA.engine.pushNow(); await GB.engine.syncNow();
            await GB.engine.pushNow(); await GA.engine.syncNow();
        }
    };
    A.win.eval(`(function () { state.trees[0].children = [{ id: 'P', type: 'support', texts: ['A premise'], collapsed: [], children: [] }]; render(); autosaveNow(); })();`);
    await sync(2);
    return { A, B, GA, GB, store, sync };
}

(async () => {
    console.log('=== r27 collaboration: display names that Object.prototype also has ===');

    await scenario('Signing in stores the lease under the name itself', async open => {
        const W = await open('signin');
        const cid = cidOf(W.win);
        for (const name of TRICKY) {
            W.win.applySignIn(name);
            const c = claimOf(W.win, name);
            ok(userOf(W.win) === name && c.own && c.claim && c.claim.by === cid && typeof c.claim.ts === 'number' && !c.claim.released,
                `"${name}": signed in, and the lease is the name's own entry`, JSON.stringify({ user: userOf(W.win), c }));
            ok(E(W.win, 'return __t.sound(state._nameClaims);'), `"${name}": the table's prototype is untouched`);
            ok(E(W.win, 'return __t.jsonKeys(state._nameClaims);').includes(name), `"${name}": the lease is in the JSON`);
        }
        // Each sign-in above released the name before it.
        const released = TRICKY.slice(0, -1).filter(n => { const c = claimOf(W.win, n); return c.claim && c.claim.released === true && c.claim.by === cid; });
        ok(released.length === TRICKY.length - 1, 'signing in as the next name released each one', JSON.stringify(released));
        // An ordinary name next to them still behaves as it did.
        W.win.applySignIn('Alice');
        const alice = claimOf(W.win, 'Alice');
        ok(userOf(W.win) === 'Alice' && alice.claim && alice.claim.by === cid && !alice.claim.released, 'an ordinary name signs in as before');
        ok(E(W.win, 'return Object.keys(state._nameClaims).sort();').join(',') === TRICKY.concat('Alice').sort().join(','),
            'and the table holds exactly the names signed in with');
    });

    await scenario('The lease is kept by a save and an open, and holds there', async open => {
        const A = await open('saver'), B = await open('opener');
        const cidA = cidOf(A.win), cidB = cidOf(B.win);
        A.win.applySignIn('__proto__');
        // The browser's own copy (Recent maps) and the .json file Save writes.
        A.win.eval('autosaveNow(true);');
        const stored = JSON.parse(A.win.eval('mapLoad(state._mapId)'));
        ok(has(stored._nameClaims, '__proto__') && stored._nameClaims['__proto__'].by === cidA, 'the browser\'s own copy keeps the "__proto__" lease');
        const file1 = await A.win.mapJsonBlob().text();
        ok(has(JSON.parse(file1)._nameClaims, '__proto__'), 'the saved file keeps it', file1.slice(0, 200));
        ok(B.win.openMapText(file1) === true, 'the file opens in another browser');
        const c1 = claimOf(B.win, '__proto__');
        ok(c1.claim && c1.claim.by === cidA && !c1.claim.released, 'which reads the lease back as the name\'s own entry', JSON.stringify(c1));
        const r1 = refused(B.win, '__proto__');
        ok(r1.refused, 'and is refused "__proto__" while the lease is held', JSON.stringify(r1));

        // Moving to "constructor" releases "__proto__"; save and open again.
        A.win.applySignIn('constructor');
        const file2 = await A.win.mapJsonBlob().text();
        B.win.openMapText(file2);
        const c2 = claimOf(B.win, 'constructor'), c3 = claimOf(B.win, '__proto__');
        ok(c2.claim && c2.claim.by === cidA && !c2.claim.released, 'the "constructor" lease is kept too', JSON.stringify(c2));
        ok(c3.claim && c3.claim.released === true, 'and "__proto__" is read back as released', JSON.stringify(c3));
        const r2 = refused(B.win, 'constructor');
        ok(r2.refused, 'the other browser is refused "constructor"', JSON.stringify(r2));
        B.win.applySignIn('__proto__');
        const c4 = claimOf(B.win, '__proto__');
        ok(userOf(B.win) === '__proto__' && c4.claim && c4.claim.by === cidB && !c4.claim.released,
            'but may take the released "__proto__"', JSON.stringify({ user: userOf(B.win), c4 }));
    });

    await scenario('Merging leases where one side has such a name', async open => {
        const W = await open('merge');
        const alice = ['Alice', { by: 'ca0', ts: 500 }];
        const mergeCase = (localPairs, remotePairs, name) => E(W.win, `
            var L = __t.doc(${q(claimsJson(localPairs))});
            var R = __t.doc(${q(claimsJson(remotePairs))});
            var m = __argmap.mergeStates(L, R, {});
            var wire = JSON.parse(syncStableStringify(__argmap.syncToWire(m)));
            return {
                merged: __t.claim(m._nameClaims, ${q(name)}),
                wire: __t.claim(wire._nameClaims, ${q(name)}),
                alice: __t.claim(m._nameClaims, 'Alice'),
                sound: __t.sound(m._nameClaims),
                keys: Object.keys(m._nameClaims).sort(),
                sameFP: __argmap.syncFingerprint(m) === __argmap.syncFingerprint(wire)
            };`);
        // The lease came through intact: an own entry, the expected holder,
        // the same in the JSON a peer reads, which also fingerprints the same
        // (so neither side has anything left to write). Alice is untouched.
        const intact = (r, name, by) => r.merged.claim && r.merged.claim.by === by && r.wire.claim && r.wire.claim.by === by
            && r.sound && r.sameFP && r.alice.claim && r.alice.claim.by === 'ca0' && r.keys.join(',') === ['Alice', name].sort().join(',');
        for (const name of TRICKY) {
            const remoteOnly = mergeCase([alice], [alice, [name, { by: 'cb', ts: 2000 }]], name);
            ok(intact(remoteOnly, name, 'cb'), `"${name}" only in the remote copy: kept, as the remote's lease`, JSON.stringify(remoteOnly));
            const localOnly = mergeCase([alice, [name, { by: 'ca', ts: 1000 }]], [alice], name);
            ok(intact(localOnly, name, 'ca'), `"${name}" only in the local copy: kept, as the local lease`, JSON.stringify(localOnly));
            const newerRemote = mergeCase([alice, [name, { by: 'ca', ts: 1000 }]], [alice, [name, { by: 'cb', ts: 2000 }]], name);
            const newerLocal = mergeCase([alice, [name, { by: 'ca', ts: 3000 }]], [alice, [name, { by: 'cb', ts: 2000 }]], name);
            ok(intact(newerRemote, name, 'cb') && intact(newerLocal, name, 'ca'), `"${name}" in both: the newer lease wins, either way round`,
                JSON.stringify({ newerRemote: newerRemote.merged, newerLocal: newerLocal.merged }));
        }
    });

    await scenario('The JSON a map is shared as is unchanged', async open => {
        const W = await open('wire');
        // The serializer before r27.80, for comparison.
        W.win.eval(`window.__oldStable = function (v) {
            return JSON.stringify(v, function (k, val) {
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                    var out = {};
                    Object.keys(val).sort().forEach(function (kk) { out[kk] = val[kk]; });
                    return out;
                }
                return val;
            });
        };`);
        W.win.eval(`(function () {
            state.trees[0].children = [
                { id: 'P1', type: 'support', texts: ['One', 'Two'], raw: { 0: 'One', 1: 'Two' }, collapsed: [], children: [],
                  evalThreads: [[{ id: 'c1', author: 'Alice', authorClient: 'x', ts: 1, text: 'note', parentId: null }], []] },
                { id: 'P2', type: 'objection', texts: ['Three'], collapsed: [], children: [] }];
            render(); autosaveNow();
        })();`);
        W.win.applySignIn('Bob');
        W.win.applySignIn('Alice');
        const same = E(W.win, 'var w = __argmap.syncToWire(state); return syncStableStringify(w) === __oldStable(w);');
        ok(same, 'a map without such names is shared byte for byte as before');
        W.win.applySignIn('__proto__');
        const r = E(W.win, `var w = __argmap.syncToWire(state), s = syncStableStringify(w), back = JSON.parse(s);
            return { lease: __t.claim(back._nameClaims, '__proto__'), keys: Object.keys(back._nameClaims), sorted: s.indexOf('"Alice":') < s.indexOf('"Bob":') && s.indexOf('"Bob":') < s.indexOf('"__proto__":') };`);
        ok(r.lease.claim && r.lease.claim.by === cidOf(W.win), 'a "__proto__" lease is shared as an ordinary key', JSON.stringify(r));
        ok(r.sorted && r.keys.length === 3, 'in its sorted place among the others', JSON.stringify(r.keys));
    });

    await scenario('Two windows over the sync engine', async open => {
        const { A, B, store, sync } = await pair(open, ['peer-a', 'peer-b']);
        const cidA = cidOf(A.win), cidB = cidOf(B.win);
        A.win.applySignIn('__proto__');
        B.win.applySignIn('constructor');
        await sync(2);
        for (const [W, who] of [[A, 'A'], [B, 'B']]) {
            const p = claimOf(W.win, '__proto__'), c = claimOf(W.win, 'constructor');
            ok(p.claim && p.claim.by === cidA && c.claim && c.claim.by === cidB, `window ${who} holds both leases, each as its holder's`, JSON.stringify({ p, c }));
        }
        const server = JSON.parse(store.content)._nameClaims || {};
        ok(has(server, '__proto__') && server['__proto__'].by === cidA && has(server, 'constructor') && server.constructor.by === cidB,
            'so does the shared copy', JSON.stringify(Object.keys(server)));
        const fpA = A.win.eval('__argmap.syncFingerprint(__argmap.state)'), fpB = B.win.eval('__argmap.syncFingerprint(__argmap.state)');
        ok(fpA === fpB, 'the two windows agree');
        const v0 = store.version;
        await sync(2);
        ok(store.version === v0, 'and stop writing: no back-and-forth over a lease', v0 + ' -> ' + store.version);
        const rA = refused(A.win, 'constructor'), rB = refused(B.win, '__proto__');
        ok(rA.refused && rB.refused, 'neither may take the name the other holds', JSON.stringify({ rA, rB }));
    });

    for (const name of ['__proto__', 'constructor']) {
        await scenario(`A window signed in as "${name}" before its first sync keeps the lease`, async open => {
            const A = await open('maker'), C = await open('newcomer');
            const GA = A.win.__argmap, GC = C.win.__argmap;
            const store = { content: null, version: 0, subs: new Set() };
            await GA.initSync(GA.createMemoryTransport({ store }), { pollInterval: 1e9, pushDebounce: 1e9 });
            A.win.applySignIn('Alice');
            A.win.eval(`(function () { state.trees[0].children = [{ id: 'P', type: 'support', texts: ['A premise'], collapsed: [], children: [] }]; render(); autosaveNow(); })();`);
            await GA.engine.pushNow();
            // C has never been edited: its first pull adopts the shared map
            // wholesale, carrying over only C's own lease.
            C.win.applySignIn(name);
            await GC.initSync(GC.createMemoryTransport({ store }), { pollInterval: 1e9, pushDebounce: 1e9 });
            const ids = E(C.win, 'var out = []; (function walk(ns) { ns.forEach(function (n) { out.push(n.id); walk(n.children || []); }); })(state.trees); return out;');
            const rootA = A.win.eval('state.trees[0].id');
            ok(ids.length === 2 && ids[0] === rootA && ids[1] === 'P', 'the new window adopted the shared map', JSON.stringify(ids));
            const cidC = cidOf(C.win), c = claimOf(C.win, name);
            ok(userOf(C.win) === name && c.claim && c.claim.by === cidC, `and kept its "${name}" lease`, JSON.stringify(c));
            ok(claimOf(C.win, 'Alice').claim !== null, 'beside the map\'s own leases');
            await GC.engine.pushNow();
            const server = JSON.parse(store.content)._nameClaims || {};
            ok(has(server, name) && typeof server[name] === 'object' && server[name].by === cidC, 'which it shares', JSON.stringify(Object.keys(server)));
            await GA.engine.pullNow();
            const r = refused(A.win, name);
            ok(r.refused, `the other window is refused "${name}"`, JSON.stringify(r));
        });
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
