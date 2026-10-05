'use strict';
// r27 collaboration: a verified name lease keeps its Google uid while its
// holder edits.
//
// A display name is leased: signing in takes it, real edits refresh it, and
// for NAME_LEASE_MS anyone else who signs in under it is hard-blocked. A
// verified sign-in records the Google uid on the lease, so the SAME account
// on a second device is let through (applySignIn's sameVerifiedPerson).
// Reproduced before the fix: diffAndStamp refreshed the lease as
// { by, ts } and dropped the uid, so once the first device had made a single
// edit, the second device was told the name was "in use by someone else"
// for up to ten minutes.
//
// Two peers, a real sync engine over the memory transport: the lease reaches
// the second device through the wire, as it does in a shared room.
//
// Guards that must hold after the fix:
//   - a different Google account under the same name is still blocked;
//   - a typed sign-in (no uid) under the same name is still blocked;
//   - an unverified lease refreshes in its old shape, { by, ts } (no uid
//     key), so its saved JSON is unchanged, and a verified account cannot
//     take that name over while it is in use.
//
// Run:  node collab-r27-name-lease-test.js [argument-mapper-r27.html]
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
    const errors = [], alerts = [];
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
        win.alert = msg => { alerts.push(String(msg)); };
        win.confirm = () => true; win.prompt = () => null; win.open = () => null;
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, alerts, get win() { return dom.window; } };
}

const wins = [];
async function device(label, store) {
    const W = makeWin(label);
    wins.push(W);
    await sleep(300);
    const G = W.win.__argmap;
    await G.initSync(G.createMemoryTransport({ store }), { pollInterval: 1e9, pushDebounce: 1e9 });
    await G.engine.pullNow();
    return W;
}
const claimOf = (W, name) => JSON.parse(W.win.eval(`JSON.stringify((state._nameClaims || {})[${JSON.stringify(name)}] || null)`));
const wireClaimOf = (store, name) => ((JSON.parse(store.content || '{}')._nameClaims) || {})[name] || null;
const clientIdOf = W => W.win.eval('_clientId');
const userOf = W => W.win.eval('currentUser');
const BLOCK = 'is in use by someone else';

// The holder signs in, then makes ONE real edit, which the sync engine stamps
// and pushes. The shadow is settled first, so the edit is the only thing the
// stamp pass sees: any lease refresh comes from that edit alone.
async function holderSignsInAndEdits(H, name, uid) {
    if (uid) H.win.applySignIn(name, uid); else H.win.applySignIn(name);
    H.win.eval('_shadowSnapshot = JSON.stringify(state);');
    const signedIn = claimOf(H, name);
    await sleep(5);   // so the edit's stamp is a later millisecond than the sign-in
    H.win.eval(`state.trees[0].texts[0] = 'edited by ' + ${JSON.stringify(name)}; render();`);
    await H.win.__argmap.engine.pushNow();
    return { signedIn, refreshed: claimOf(H, name) };
}

(async () => {
    console.log('=== r27 collaboration: a verified name lease keeps its uid while its holder edits ===');

    console.log('\n-- One Google account, two devices --');
    {
        const store = { content: null, version: 0, subs: new Set() };
        const laptop = await device('vera-laptop', store);
        const { signedIn, refreshed } = await holderSignsInAndEdits(laptop, 'Vera', 'uid-vera');
        ok(signedIn && signedIn.by === clientIdOf(laptop) && signedIn.uid === 'uid-vera',
            'setup: the laptop signs in with Google and takes a verified lease', JSON.stringify(signedIn));
        ok(refreshed && refreshed.ts > signedIn.ts && refreshed.by === clientIdOf(laptop),
            "the laptop's edit refreshes its lease", JSON.stringify([signedIn, refreshed]));
        ok(refreshed && refreshed.uid === 'uid-vera',
            'the refreshed lease still names the Google account', JSON.stringify(refreshed));
        const wire = wireClaimOf(store, 'Vera');
        ok(wire && wire.ts === refreshed.ts && wire.uid === 'uid-vera',
            'and so does the copy the room holds', JSON.stringify(wire));

        // Another person, or the same person typing the name: still blocked.
        const other = await device('mallory', store);
        ok(JSON.stringify(claimOf(other, 'Vera')) === JSON.stringify(refreshed),
            "setup: a second device holds the laptop's refreshed lease, through the sync", JSON.stringify(claimOf(other, 'Vera')));
        other.win.applySignIn('Vera', 'uid-mallory');
        ok(userOf(other) === '' && other.alerts.length === 1 && other.alerts[0].includes(BLOCK),
            'a different Google account under the same name is blocked', JSON.stringify({ user: userOf(other), alerts: other.alerts }));
        other.alerts.length = 0;
        other.win.applySignIn('Vera');
        ok(userOf(other) === '' && other.alerts.length === 1 && other.alerts[0].includes(BLOCK),
            'a typed sign-in (no Google account) under the same name is blocked', JSON.stringify({ user: userOf(other), alerts: other.alerts }));
        ok(JSON.stringify(claimOf(other, 'Vera')) === JSON.stringify(refreshed),
            'and neither attempt touched the lease', JSON.stringify(claimOf(other, 'Vera')));

        // The regression: the same account on a second device.
        const phone = await device('vera-phone', store);
        phone.win.applySignIn('Vera', 'uid-vera');
        ok(userOf(phone) === 'Vera' && phone.alerts.length === 0,
            'the same Google account on a second device signs in, after the first device has edited',
            JSON.stringify({ user: userOf(phone), alerts: phone.alerts, claim: claimOf(phone, 'Vera') }));
        const taken = claimOf(phone, 'Vera');
        ok(taken && taken.by === clientIdOf(phone) && taken.uid === 'uid-vera',
            'the phone now holds the lease, still verified', JSON.stringify(taken));
    }

    console.log('\n-- A typed name (no Google account) --');
    {
        const store = { content: null, version: 0, subs: new Set() };
        const laptop = await device('ned-laptop', store);
        const { signedIn, refreshed } = await holderSignsInAndEdits(laptop, 'Ned');
        ok(signedIn && Object.keys(signedIn).sort().join() === 'by,ts',
            'setup: a typed sign-in takes a lease with no uid', JSON.stringify(signedIn));
        ok(refreshed && refreshed.ts > signedIn.ts && Object.keys(refreshed).sort().join() === 'by,ts',
            'the edit refreshes it in the same shape: no uid key', JSON.stringify(refreshed));
        const wire = wireClaimOf(store, 'Ned');
        ok(wire && wire.ts === refreshed.ts && Object.keys(wire).sort().join() === 'by,ts',
            "and the room's copy has no uid key either", JSON.stringify(wire));
        const other = await device('ned-other', store);
        other.win.applySignIn('Ned', 'uid-ned');
        ok(userOf(other) === '' && other.alerts.length === 1 && other.alerts[0].includes(BLOCK),
            'a Google account cannot take a typed name while it is in use', JSON.stringify({ user: userOf(other), alerts: other.alerts }));
    }

    const errors = wins.flatMap(W => W.errors);
    ok(errors.length === 0, 'no script errors on any device', errors.slice(0, 3).join(' | '));

    console.log(`\n${pass} passed, ${fail} failed`);
    wins.forEach(W => { try { W.win.close(); } catch (e) {} });
    process.exit(fail ? 1 : 0);
})().catch(err => {
    console.error('HARNESS ERROR', err && err.stack || err);
    process.exit(2);
});
