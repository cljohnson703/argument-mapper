'use strict';
// r27 collaboration: a verified name lease belongs to its Google account.
//
// A display name is leased: signing in takes it, real edits refresh it, and
// for NAME_LEASE_MS anyone else who signs in under it is hard-blocked. A
// verified sign-in records the Google uid on the lease, so the SAME account
// on a second device is let through (applySignIn's sameVerifiedPerson).
// Reproduced before the fixes:
//   (1) r27.77: diffAndStamp refreshed the lease as { by, ts } and dropped
//       the uid, so once the first device had made a single edit, the second
//       device was told the name was "in use by someone else".
//   (2) r27.78: a lease names one holder (by), and only the holder's edits
//       renewed it. Once the second device had signed in, the first device's
//       edits never renewed it again: the name expired ten minutes after the
//       second device's last use while the account was busy on the first,
//       and anyone could then sign in under it. Signing out on the holder
//       freed the name the same way, the other device still signed in.
//
// Two peers, a real sync engine over the memory transport: the lease reaches
// the second device through the wire, as it does in a shared room. Every
// device reads one clock, which the test moves forward to age the leases.
//
// Guards that must hold after the fixes:
//   - a different Google account under the same name is still blocked;
//   - a typed sign-in (no uid) under the same name is still blocked;
//   - an unverified lease is refreshed and released in its old shapes,
//     { by, ts } and { by, ts, released } (no uid key), so its saved JSON is
//     unchanged, and a verified account cannot take that name over while it
//     is in use;
//   - a lease someone else took fairly, after the account's devices had been
//     quiet past the lease, is not taken back by the account's next edit.
//
// Run:  node collab-r27-name-lease-test.js [argument-mapper-r27.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const SRC = process.argv[2] || (__dirname + '/argument-mapper-r27.html');
const HTML = fs.readFileSync(SRC, 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// One clock for every device: Date.now() in each window reads real time plus
// CLOCK.skew, so advance() ages every lease at once, as minutes passing would.
const CLOCK = { skew: 0 };
const MIN = 60 * 1000;
const advance = ms => { CLOCK.skew += ms; };

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
        const realNow = win.Date.now.bind(win.Date);
        win.Date.now = () => realNow() + CLOCK.skew;
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
// Still signed out, and told why: exactly the simultaneous-use alert.
const turnedAway = W => userOf(W) === '' && W.alerts.length === 1 && W.alerts[0].includes(BLOCK);
const seen = W => JSON.stringify({ user: userOf(W), alerts: W.alerts });

// One real edit, which the sync engine stamps and pushes. The pause makes its
// stamp a later millisecond than whatever came before.
async function edit(W, text) {
    await sleep(5);
    W.win.eval(`state.trees[0].texts[0] = ${JSON.stringify(text)}; render();`);
    await W.win.__argmap.engine.pushNow();
}

// The holder signs in, then makes ONE real edit. The shadow is settled first,
// so the edit is the only thing the stamp pass sees: any lease refresh comes
// from that edit alone.
async function holderSignsInAndEdits(H, name, uid) {
    if (uid) H.win.applySignIn(name, uid); else H.win.applySignIn(name);
    H.win.eval('_shadowSnapshot = JSON.stringify(state);');
    const signedIn = claimOf(H, name);
    await edit(H, 'edited by ' + name);
    return { signedIn, refreshed: claimOf(H, name) };
}

// Vera signs in on her laptop and edits; then she signs in on her phone with
// the same Google account, which takes the lease, and the laptop hears of it.
async function laptopThenPhone(store, tag) {
    const laptop = await device(tag + '-laptop', store);
    await holderSignsInAndEdits(laptop, 'Vera', 'uid-vera');
    const phone = await device(tag + '-phone', store);
    phone.win.applySignIn('Vera', 'uid-vera');
    await phone.win.__argmap.engine.pushNow();
    await laptop.win.__argmap.engine.pullNow();
    return { laptop, phone };
}

(async () => {
    console.log('=== r27 collaboration: a verified name lease belongs to its Google account ===');

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
        laptop.win.applySignIn('');
        const rel = claimOf(laptop, 'Ned');
        ok(rel && rel.released === true && Object.keys(rel).sort().join() === 'by,released,ts',
            'signing out releases it in its old shape too: no uid key', JSON.stringify(rel));
    }

    console.log('\n-- One Google account, two devices, used in turn --');
    {
        const store = { content: null, version: 0, subs: new Set() };
        const { laptop, phone } = await laptopThenPhone(store, 'turn');
        const phoneLease = claimOf(laptop, 'Vera');
        ok(phoneLease && phoneLease.by === clientIdOf(phone) && phoneLease.uid === 'uid-vera',
            'setup: the phone signed in last, so the laptop sees the lease held by the phone', JSON.stringify(phoneLease));

        // Back to the laptop, six minutes on.
        advance(6 * MIN);
        await edit(laptop, 'Vera, back on the laptop');
        const renewed = claimOf(laptop, 'Vera');
        ok(renewed && renewed.by === clientIdOf(laptop) && renewed.ts > phoneLease.ts && renewed.uid === 'uid-vera',
            "the laptop's edit renews the account's lease, though the phone held it", JSON.stringify(renewed));
        const wire = wireClaimOf(store, 'Vera');
        ok(wire && wire.by === clientIdOf(laptop) && wire.ts === renewed.ts,
            "and the room's copy has the renewal", JSON.stringify(wire));

        // Eleven minutes after the phone's sign-in, five after the laptop's edit.
        advance(5 * MIN);
        const other = await device('turn-mallory', store);
        other.win.applySignIn('Vera', 'uid-mallory');
        ok(turnedAway(other), "eleven minutes after the phone's last use, the laptop busy, a different Google account is still blocked", seen(other));
        other.alerts.length = 0;
        other.win.applySignIn('Vera');
        ok(turnedAway(other), 'and so is the name typed', seen(other));

        // The phone, still signed in, takes the work up again.
        await phone.win.__argmap.engine.pullNow();
        await edit(phone, 'Vera, on the phone again');
        const back = claimOf(phone, 'Vera');
        ok(back && back.by === clientIdOf(phone) && back.ts > renewed.ts && back.uid === 'uid-vera',
            'and the phone, editing again, renews it in turn', JSON.stringify(back));
    }

    console.log('\n-- Signed out on one device, still signed in on the other --');
    {
        const store = { content: null, version: 0, subs: new Set() };
        const { laptop, phone } = await laptopThenPhone(store, 'out');
        // Done on the phone, which holds the lease; carrying on on the laptop.
        phone.win.applySignIn('');
        await phone.win.__argmap.engine.pushNow();
        const released = wireClaimOf(store, 'Vera');
        ok(released && released.released === true && released.by === clientIdOf(phone),
            'signing out on the phone releases the lease at once, as before', JSON.stringify(released));
        ok(released && released.uid === 'uid-vera',
            'and the release names the account', JSON.stringify(released));
        await laptop.win.__argmap.engine.pullNow();
        await edit(laptop, 'Vera, on after signing out of the phone');
        const retaken = claimOf(laptop, 'Vera');
        ok(retaken && retaken.by === clientIdOf(laptop) && !retaken.released && retaken.uid === 'uid-vera' && retaken.ts > released.ts,
            'the laptop, still signed in, takes the lease back with its next edit', JSON.stringify(retaken));
        const other = await device('out-mallory', store);
        other.win.applySignIn('Vera', 'uid-mallory');
        ok(turnedAway(other), 'so the name is not free while the laptop uses it', seen(other));
    }

    console.log('\n-- A lease someone else took fairly --');
    {
        const store = { content: null, version: 0, subs: new Set() };
        const laptop = await device('fair-laptop', store);
        await holderSignsInAndEdits(laptop, 'Vera', 'uid-vera');
        // Eleven quiet minutes: the name is free, and someone types it.
        advance(11 * MIN);
        const other = await device('fair-other', store);
        other.win.applySignIn('Vera');
        ok(userOf(other) === 'Vera' && other.alerts.length === 0,
            'setup: after eleven quiet minutes the name is free, and someone else signs in under it', seen(other));
        await other.win.__argmap.engine.pushNow();
        await laptop.win.__argmap.engine.pullNow();
        await edit(laptop, 'Vera, back after a break');
        const kept = claimOf(laptop, 'Vera');
        ok(kept && kept.by === clientIdOf(other) && !('uid' in kept),
            "the laptop's next edit leaves that lease alone: only the account's own leases follow it", JSON.stringify(kept));
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
