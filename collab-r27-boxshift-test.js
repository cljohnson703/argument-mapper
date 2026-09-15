'use strict';
// r27 collaboration: boxes that shift index under a peer.
//
// Boxes have no stable identity -- per-box data is addressed by array index.
// Inserting a co-premise BEFORE an existing box (Shift+Tab always does; Tab
// does when the selected box is not the last) gives every later box a new
// index. Two peers, a real sync engine over the memory transport, and these
// regressions, all reproduced before the fix:
//
//   (1) mergeStates unioned comment threads slot by slot, so after one insert
//       the peer's stale copy re-created every moved comment at its OLD index:
//       each note was DUPLICATED onto the new box, on every peer, with no
//       concurrent edit at all. (Deleting that box later then orphaned the
//       duplicate and left the original box with no note.)
//   (2) a peer's open editor was reattached by index, so their next
//       keystrokes landed in the new box -- or, when the insert lost to their
//       concurrent edit, the INSERTER's typing was glued onto the peer's text.
//   (3) a peer's selection and unsent overview draft were likewise left on
//       the old index (the draft could be dropped outright).
//
// Guards that must hold after the fix:
//   - Paste as Co-Premise can legitimately put one comment id in two boxes of
//     a node; both copies survive a sync.
//   - a comment added concurrently to the shifting box lands on that box;
//   - a comment deleted concurrently stays deleted, not resurrected;
//   - a peer editing the same box in place keeps its editor (no shift).
//
// Run:  node collab-r27-boxshift-test.js [argument-mapper-r27.html]
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
        win.alert = () => {}; win.confirm = () => true; win.prompt = () => null; win.open = () => null;
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}

const HELPERS = `
  window.__t = {
    press(shift) {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', key: 'Tab', shiftKey: !!shift, bubbles: true, cancelable: true }));
    },
    key(code, key) {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: code, key: key, bubbles: true, cancelable: true }));
    },
    node(id) { const c = findNodeContext(state.trees, id); return c ? JSON.parse(JSON.stringify(c.node)) : null; },
    editing() {
      const a = document.activeElement;
      if (!a || a.tagName !== 'TEXTAREA' || a.readOnly) return null;
      const host = a.closest('.node');
      if (!host) return { other: a.className };
      return { id: host.getAttribute('data-node-id'), idx: +host.getAttribute('data-node-idx'), value: a.value };
    },
    commit(text) {
      const a = document.activeElement;
      a.value = text;
      a.dispatchEvent(new Event('input', { bubbles: true }));
      a.blur();
    },
    select(sel) { selectedIds = sel.slice(); updateSelectionVisuals(); }
  };
`;
const E = (w, body) => JSON.parse(w.eval(`JSON.stringify((function () { ${body} })())`));

async function pair() {
    const A = makeWin('peer-a'), B = makeWin('peer-b');
    await sleep(300);
    A.win.eval(HELPERS); B.win.eval(HELPERS);
    const GA = A.win.__argmap, GB = B.win.__argmap;
    const store = { content: null, version: 0, subs: new Set() };
    await GA.initSync(GA.createMemoryTransport({ store }), { pollInterval: 1e9, pushDebounce: 1e9 });
    await GB.initSync(GB.createMemoryTransport({ store }), { pollInterval: 1e9, pushDebounce: 1e9 });
    A.win.applySignIn('Alice');
    B.win.applySignIn('Bob');
    const defocus = w => { const a = w.document.activeElement; if (a && a.blur) a.blur(); };
    const sync = async (rounds = 1) => {
        defocus(A.win); defocus(B.win);
        for (let i = 0; i < rounds; i++) {
            await GA.engine.pushNow(); await GB.engine.syncNow();
            await GB.engine.pushNow(); await GA.engine.syncNow();
        }
    };
    await sync(2);
    const root = GA.state.trees[0].id;
    const close = () => { A.win.close(); B.win.close(); };
    return { A, B, GA, GB, sync, root, close };
}
async function seed(c, children) {
    c.A.win.eval(`(function(){ var root = findNodeContext(state.trees, ${JSON.stringify(c.root)}).node; root.children = ${JSON.stringify(children)}; render(); autosaveNow(); })();`);
    await c.sync(2);
    const fa = c.A.win.eval('__argmap.syncFingerprint(__argmap.state)');
    const fb = c.B.win.eval('__argmap.syncFingerprint(__argmap.state)');
    if (fa !== fb) throw new Error('seed did not converge');
    c.A.win.eval('undoStack = []; redoStack = []; _shadowSnapshot = JSON.stringify(state);');
    c.B.win.eval('undoStack = []; redoStack = []; _shadowSnapshot = JSON.stringify(state);');
}
const view = (w, id) => {
    const n = E(w, `return __t.node(${JSON.stringify(id)});`);
    return { texts: n.texts, threads: (n.evalThreads || []).map(t => (t || []).filter(c => !c.deleted).map(c => c.text)) };
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cm = (id, text) => ({ id, author: 'Bob', authorClient: 'bobc', ts: 1757700000000, text, parentId: null });
const errorsOf = c => c.A.errors.concat(c.B.errors);

async function scenario(name, fn) {
    console.log('\n-- ' + name + ' --');
    let c = null;
    try { c = await pair(); await fn(c); ok(errorsOf(c).length === 0, 'no script errors on either peer', errorsOf(c).slice(0, 3).join(' | ')); }
    catch (e) { ok(false, name + ' ran to completion', String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    finally { if (c) c.close(); }
}

(async () => {
    console.log('=== r27 collaboration: box indices shifting under a peer ===');

    await scenario('Shift+Tab before a commented box, no concurrent edit', async c => {
        await seed(c, [{ id: 'P', type: 'support', texts: ['P-text'], collapsed: [], children: [], evalThreads: [[cm('c1', 'note on P')]] }]);
        E(c.A.win, `__t.select(['P-0']); __t.press(true); __t.commit('Q-new'); autosaveNow(); return 1;`);
        await c.sync(2);
        const want = { texts: ['Q-new', 'P-text'], threads: [[], ['note on P']] };
        ok(same(view(c.A.win, 'P'), want), 'inserter: the note stays on P-text only (not duplicated onto the new box)', JSON.stringify(view(c.A.win, 'P')));
        ok(same(view(c.B.win, 'P'), want), 'peer: same', JSON.stringify(view(c.B.win, 'P')));

        E(c.A.win, `__t.select(['P-0']); deleteSelected(); autosaveNow(); return 1;`);
        await c.sync(2);
        const wantAfter = { texts: ['P-text'], threads: [['note on P']] };
        ok(same(view(c.A.win, 'P'), wantAfter) && same(view(c.B.win, 'P'), wantAfter),
            'deleting the new box afterwards leaves the note on P-text, on both peers',
            JSON.stringify([view(c.A.win, 'P'), view(c.B.win, 'P')]));
        const orphans = E(c.B.win, 'return Object.keys(state._orphanComments || {}).length;');
        ok(orphans === 0, 'and orphans nothing', 'orphans=' + orphans);
    });

    await scenario('Tab in the middle of a group (the pre-existing path)', async c => {
        await seed(c, [{ id: 'P', type: 'support', texts: ['X', 'Y'], collapsed: [], children: [], evalThreads: [[], [cm('c1', 'note on Y')]] }]);
        E(c.A.win, `__t.select(['P-0']); __t.press(false); __t.commit('Q-new'); autosaveNow(); return 1;`);
        await c.sync(2);
        const want = { texts: ['X', 'Q-new', 'Y'], threads: [[], [], ['note on Y']] };
        ok(same(view(c.A.win, 'P'), want) && same(view(c.B.win, 'P'), want),
            "Y's note stays on Y only, on both peers", JSON.stringify([view(c.A.win, 'P'), view(c.B.win, 'P')]));
    });

    await scenario('Paste as Co-Premise: one comment id in two boxes survives a sync', async c => {
        await seed(c, [{ id: 'P', type: 'support', texts: ['P-text'], collapsed: [], children: [], evalThreads: [[cm('c1', 'note on P')]] }]);
        const local = E(c.A.win, `__t.select(['P-0']); copyNode(); pasteAsCoPremise(); autosaveNow();
            var n = __t.node('P'); return { texts: n.texts, threads: n.evalThreads.map(t => t.map(x => x.id)) };`);
        ok(same(local.threads, [['c1'], ['c1']]), 'setup: the pasted box carries the same comment id', JSON.stringify(local));
        await c.sync(2);
        const want = { texts: ['P-text', 'P-text'], threads: [['note on P'], ['note on P']] };
        ok(same(view(c.A.win, 'P'), want) && same(view(c.B.win, 'P'), want),
            'both copies survive on both peers', JSON.stringify([view(c.A.win, 'P'), view(c.B.win, 'P')]));
    });

    await scenario('A peer adds a note to the box while it is being shifted', async c => {
        await seed(c, [{ id: 'P', type: 'support', texts: ['P-text'], collapsed: [], children: [], evalThreads: [[cm('c1', 'note on P')]] }]);
        E(c.B.win, `addComment({ kind: 'box', id: 'P', idx: 0 }, 'second note on P'); autosaveNow(); return 1;`);
        await sleep(20);
        E(c.A.win, `__t.select(['P-0']); __t.press(true); __t.commit('Q-new'); autosaveNow(); return 1;`);
        await c.sync(3);
        for (const [who, w] of [['inserter', c.A.win], ['peer', c.B.win]]) {
            const v = view(w, 'P');
            const onP = (v.threads[v.texts.indexOf('P-text')] || []).slice().sort();
            const all = v.threads.flat();
            ok(v.texts.length === 2 && same(onP, ['note on P', 'second note on P']) && all.length === 2,
                who + ': both notes on P-text, none on the new box, no duplicates', JSON.stringify(v));
        }
    });

    await scenario('A peer deletes a note while the box is being shifted', async c => {
        await seed(c, [{ id: 'P', type: 'support', texts: ['P-text'], collapsed: [], children: [], evalThreads: [[cm('c1', 'note on P')]] }]);
        E(c.B.win, `deleteComment({ kind: 'box', id: 'P', idx: 0 }, 'c1'); autosaveNow(); return 1;`);
        await sleep(20);
        E(c.A.win, `__t.select(['P-0']); __t.press(true); __t.commit('Q-new'); autosaveNow(); return 1;`);
        await c.sync(3);
        const a = view(c.A.win, 'P').threads.flat(), b = view(c.B.win, 'P').threads.flat();
        ok(!a.includes('note on P') && !b.includes('note on P'),
            'the deleted note is not resurrected at either index', JSON.stringify([view(c.A.win, 'P'), view(c.B.win, 'P')]));
    });

    await scenario("A peer's open editor follows its box", async c => {
        await seed(c, [{ id: 'P', type: 'support', texts: ['P-text'], collapsed: [], children: [] }]);
        E(c.B.win, `focusTextarea('P', 0); return 1;`);
        E(c.A.win, `__t.select(['P-0']); __t.press(true); __t.commit('Q-new'); autosaveNow(); return 1;`);
        await c.GA.engine.pushNow(); await c.GB.engine.pullNow(); await sleep(50);
        const ed = E(c.B.win, 'return __t.editing();');
        ok(ed && ed.id === 'P' && ed.idx === 1 && ed.value === 'P-text',
            "the peer's editor is now on P-text at index 1, not on the new box", JSON.stringify(ed));
        E(c.B.win, `var a = document.activeElement; if (a && a.tagName === 'TEXTAREA') { a.value = a.value + ' (Bob)'; a.dispatchEvent(new Event('input', { bubbles: true })); a.blur(); } autosaveNow(); return 1;`);
        await c.sync(2);
        const want = ['Q-new', 'P-text (Bob)'];
        ok(same(view(c.A.win, 'P').texts, want) && same(view(c.B.win, 'P').texts, want),
            "the peer's typing lands on P-text on both peers", JSON.stringify([view(c.A.win, 'P').texts, view(c.B.win, 'P').texts]));
    });

    await scenario("An insert that loses the race does not glue the inserter's typing onto a peer's text", async c => {
        await seed(c, [{ id: 'P', type: 'support', texts: ['P-text'], collapsed: [], children: [] }]);
        E(c.A.win, `__t.select(['P-0']); __t.press(true); autosaveNow(); return 1;`);
        await sleep(15);
        E(c.B.win, `focusTextarea('P', 0); __t.commit('edited by Bob'); autosaveNow(); return 1;`);
        await c.GB.engine.pushNow(); await c.GA.engine.pullNow(); await sleep(30);
        const ed = E(c.A.win, 'return __t.editing();');
        ok(ed === null, "the inserter's editor on the vanished box closes instead of reopening on Bob's premise", JSON.stringify(ed));
        E(c.A.win, `var a = document.activeElement; if (a && a.tagName === 'TEXTAREA' && !a.readOnly) { a.value = 'my new premise' + a.value; a.dispatchEvent(new Event('input', { bubbles: true })); a.blur(); } autosaveNow(); return 1;`);
        await c.sync(2);
        ok(same(view(c.B.win, 'P').texts, ['edited by Bob']), "Bob's text is intact", JSON.stringify(view(c.B.win, 'P').texts));
    });

    await scenario('Editing the same box in place (no shift) keeps the editor open', async c => {
        await seed(c, [{ id: 'P', type: 'support', texts: ['P-text'], collapsed: [], children: [] }]);
        E(c.B.win, `focusTextarea('P', 0); var a = document.activeElement; a.value = 'P-text by Bob'; a.dispatchEvent(new Event('input', { bubbles: true })); return 1;`);
        await sleep(20);
        E(c.A.win, `focusTextarea('P', 0); __t.commit('P-text by Alice'); autosaveNow(); return 1;`);
        await c.GA.engine.pushNow(); await c.GB.engine.pullNow(); await sleep(40);
        const ed = E(c.B.win, 'return __t.editing();');
        ok(ed && ed.id === 'P' && ed.idx === 0, "Bob's editor is still open on P (unchanged behavior)", JSON.stringify(ed));
    });

    await scenario("A peer's selection follows its box", async c => {
        await seed(c, [{ id: 'P', type: 'support', texts: ['P-text'], collapsed: [], children: [] }]);
        E(c.B.win, `__t.select(['P-0']); return 1;`);
        E(c.A.win, `__t.select(['P-0']); __t.press(true); __t.commit('Q-new'); autosaveNow(); return 1;`);
        await c.sync(2);
        const sel = E(c.B.win, 'return selectedIds;');
        ok(same(sel, ['P-1']), "the peer's selection moved to P-text at index 1", JSON.stringify(sel));
        E(c.B.win, `__t.key('KeyG', 'g'); autosaveNow(); return 1;`);
        await c.sync(2);
        const n = E(c.A.win, `return __t.node('P');`);
        ok(same(n.texts, ['Q-new', 'P-text']) && n.givens && n.givens[1] === true && !n.givens[0],
            'so a shortcut the peer presses next (G, Given) acts on P-text', JSON.stringify({ texts: n.texts, givens: n.givens }));
    });

    for (const withNote of [false, true]) {
        await scenario(`A peer's unsent overview draft follows its box (${withNote ? 'box has a note' : 'status only'})`, async c => {
            await seed(c, [{ id: 'P', type: 'support', texts: ['P-text'], statuses: ['contested'], statusAuthors: ['Bob'], collapsed: [], children: [],
                             evalThreads: [withNote ? [cm('c1', 'note on P-text')] : []] }]);
            const keys = E(c.B.win, `toggleEvalOverview();
                var cs = [...document.querySelectorAll('#eval-overview-list .eval-composer')];
                var comp = cs.find(x => x.dataset.locKey.indexOf('box|P|0|') === 0);
                comp.value = 'Bob draft about P-text'; comp.dispatchEvent(new Event('input')); comp.blur();
                return cs.map(x => x.dataset.locKey);`);
            ok(keys.some(k => k.indexOf('box|P|0|') === 0), 'setup: a draft sits in the P-text row', JSON.stringify(keys));
            E(c.A.win, `__t.select(['P-0']); __t.press(true); __t.commit('Q-new'); autosaveNow(); return 1;`);
            await c.GA.engine.pushNow(); await c.GB.engine.pullNow(); await sleep(30);
            const rows = E(c.B.win, `return [...document.querySelectorAll('#eval-overview-list .eval-composer')].map(x => [x.dataset.locKey, x.value]);`);
            const draft = rows.filter(r => r[1] === 'Bob draft about P-text');
            ok(draft.length === 1 && draft[0][0].indexOf('box|P|1|') === 0,
                'the draft is kept, once, in the row for P-text (now index 1)', JSON.stringify(rows));
        });
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
