'use strict';
// r27 A note stands alone; untyped boxes are retired.
//
// A note is an aside. It connects to nothing, and nothing connects to it: no
// parent, no children, no co-premises.
//   - Adding: Add Support / Objection / Weak Objection and Add Co-Premise are
//     refused on a note (toolbar, keys, context menu), and a note gets no +
//     buttons. Add Note (Alt+Enter) puts a note of its own BESIDE the
//     selected box, pinned in the nearest free space.
//   - Turning boxes into notes (N) cuts their connections: each selected box
//     leaves its parent and co-premises as a note of its own, each box it held
//     becomes a tree of its own, and all of them stay where they were drawn,
//     pinned, stepping clear of anything the closed-up map puts under them.
//   - Dropping: a drag carrying a note just moves it; anything aimed at a note
//     is refused and stays where it was.
//   - Pasting: nothing pastes onto or into a note; a note pastes beside.
//   - Map text: a note written under a box, or with boxes under it or beside
//     it, comes in as a tree of its own.
// A refusal changes nothing, pushes no undo step, and explains itself once.
// Notes an older map still hangs from boxes stay until moved or retyped.
//
// Untyped ("neutral") boxes had no job another feature did not do better, so
// they were retired: New Node makes a support, and a saved one loads as one.
//
// Covers:
//   (1) adding to a note is refused, by function and by key;
//   (2) Add Note: beside the box, pinned, from button, key, menu and addChild;
//   (3) the toolbar, context menu and + buttons on a note;
//   (4) turning boxes into notes: a leaf, a box with children, one co-premise,
//       a whole group, a root, an older map's note, the contention; undo;
//   (5) stepping clear: freeSpotNear and settleClearOfMap;
//   (6) drops; (7) paste; (8) map text; (9) untyped boxes; (10) Help.
//
// Run:  node notes-r27-stand-alone-test.js [argument-mapper-r27.html]
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

const N = (id, type, children, extra) => Object.assign({ id, type, texts: [id], collapsed: [], children: children || [] }, extra || {});
// M  main contention
// ├─ S1 support
// │  ├─ O1 objection
// │  │  └─ R1 rebuttal
// │  └─ S2 support, implicit and given
// ├─ G  support with two co-premises, Ga and Gb
// │  └─ GB objection on Gb   (one child: a group with children under both
// │                            boxes takes jsdom's size-less layout seconds)
// └─ LN a note an older map hung from the contention
//    └─ LS a support hung from it
// FN a note of its own; FS a support of its own, holding FC
const TREES = [
    N('M', 'contention', [
        N('S1', 'support', [
            N('O1', 'objection', [ N('R1', 'rebuttal') ]),
            N('S2', 'support', [], { implicits: [true], givens: [true] })
        ]),
        N('G', 'support', [ N('GB', 'objection', [], { targetIndex: 1 }) ], { texts: ['Ga', 'Gb'] }),
        N('LN', 'note', [ N('LS', 'support') ])
    ], { x: 30000, y: 30000 }),
    N('FN', 'note', [], { x: 29000, y: 30600, freePosition: true }),
    N('FS', 'support', [ N('FC', 'support') ], { x: 31500, y: 30600, freePosition: true })
];

const HELPERS = `
    window.__n = {
        load(trees, sel) {
            if (typeof dragCtx !== 'undefined' && dragCtx) endDrag();
            state.trees = JSON.parse(JSON.stringify(trees));
            ensureCollabFields(state);
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            selectedIds = sel ? sel.slice() : [];
            undoStack = []; redoStack = []; _shadowSnapshot = JSON.stringify(state);
            clipboard = null;
            nodeActionExpanded = false;
            hideContextMenu();
            render();
        },
        key(code, key, opts) {
            document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ code: code, key: key, bubbles: true, cancelable: true }, opts || {})));
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        },
        node(id) { var c = findNodeContext(state.trees, id); return c ? c.node : null; },
        type(id) { var n = this.node(id); return n ? n.type : null; },
        parentOf(id) { var c = findNodeContext(state.trees, id); return c ? (c.parent ? c.parent.id : 'root') : null; },
        kids(id) { var n = this.node(id); return n ? n.children.map(function (c) { return c.id; }) : null; },
        root(id) {
            var t = state.trees.find(function (t) { return t.id === id; });
            return t ? { type: t.type, free: t.freePosition === true, x: t.x, y: t.y, kids: t.children.map(function (k) { return k.id; }),
                         texts: t.texts.slice(), imp: t.implicits || null, giv: t.givens || null, target: t.targetIndex } : null;
        },
        pos(id) { var g = document.getElementById('group-' + id); return g ? [Math.round(parseFloat(g.style.left)), Math.round(parseFloat(g.style.top))] : null; },
        trees() { return JSON.stringify(state.trees); },
        resetHint() {
            sessionSeenHints.delete('notes-stand-alone');
            try { localStorage.removeItem('argmap-hint-notes-stand-alone'); } catch (e) {}
            hideOneTimeHint();
            var el = document.getElementById('onetime-hint'); if (el) el.textContent = '';
        },
        hint() { var el = document.getElementById('onetime-hint'); return el ? el.textContent : ''; },
        disabled(ids) { var o = {}; ids.forEach(function (id) { o[id] = document.getElementById(id).disabled; }); return o; }
    };
`;
const T = (W, body) => {
    try { return JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`)); }
    catch (e) { return { __error: String((e && e.message) || e) }; }
};
const J = JSON.stringify;
const HINT = 'Notes stand alone: nothing connects to a note, and a note connects to nothing.';
const TR = J(TREES);

(async () => {
    console.log('=== r27 a note stands alone; untyped boxes retired ===');
    const W = makeWin('notes');
    await sleep(250);
    W.win.eval(HELPERS);

    /* ---------------- 1. adding to a note ---------------- */
    console.log('\n-- adding to a note --');
    {
        const a = T(W, `var out = {};
            __n.load(${TR}, ['FN-0']); __n.resetHint();
            var before = __n.trees();
            addChild('support');
            out.first = { same: __n.trees() === before, undo: undoStack.length, hint: __n.hint(), sel: selectedIds.slice() };
            ['objection', 'rebuttal', 'weak-objection', 'weak-rebuttal'].forEach(function (t) { selectedIds = ['FN-0']; addChild(t); });
            out.attacks = { same: __n.trees() === before, undo: undoStack.length };
            selectedIds = ['FN-0']; addCoPremise(); selectedIds = ['FN-0']; addCoPremise('left');
            out.coPremise = { same: __n.trees() === before, undo: undoStack.length };
            [['Enter', 'Enter', {}], ['Enter', 'Enter', { shiftKey: true }], ['Enter', 'Enter', { ctrlKey: true }], ['Tab', 'Tab', {}], ['Tab', 'Tab', { shiftKey: true }]]
                .forEach(function (k) { selectedIds = ['FN-0']; __n.key(k[0], k[1], k[2]); });
            out.keys = { same: __n.trees() === before, undo: undoStack.length };
            __n.load(${TR}, ['LN-0']); before = __n.trees();
            addChild('support'); selectedIds = ['LN-0']; addCoPremise();
            out.older = { same: __n.trees() === before, undo: undoStack.length };
            __n.load(${TR}, ['S2-0']); addChild('support'); out.plain = __n.kids('S2').length;
            return out;`);
        ok(a.first && a.first.same && a.first.undo === 0 && J(a.first.sel) === J(['FN-0']),
            'Add Support on a note changes nothing: no box, no undo step, the note stays selected', J(a.first));
        ok(a.first && a.first.hint === HINT, 'and explains why, once', J(a.first && a.first.hint));
        ok(a.attacks && a.attacks.same && a.attacks.undo === 0, 'objections and rebuttals, weak or not, are refused too', J(a.attacks));
        ok(a.coPremise && a.coPremise.same && a.coPremise.undo === 0, 'so is a co-premise, on either side', J(a.coPremise));
        ok(a.keys && a.keys.same && a.keys.undo === 0, 'and Enter, Shift+Enter, Ctrl+Enter, Tab and Shift+Tab on a note do nothing', J(a.keys));
        ok(a.older && a.older.same && a.older.undo === 0, 'the same for a note an older map hung from a box', J(a.older));
        ok(a.plain === 1, 'a support still takes a child', J(a.plain));
    }

    /* ---------------- 2. Add Note ---------------- */
    console.log('\n-- Add Note: beside the box --');
    {
        const n = T(W, `var out = {};
            __n.load(${TR}, ['S1-0']); var roots = state.trees.length; var at = renderedBoxRect('S1', 0);
            addNote();
            var made = state.trees[state.trees.length - 1];
            out.button = { roots: state.trees.length - roots, type: made.type, free: made.freePosition === true, children: made.children.length,
                           s1: __n.kids('S1'), sel: selectedIds.slice(), id: made.id, undo: undoStack.length, x: made.x, y: made.y, at: at };
            __n.load(${TR}, ['S2-0']); roots = state.trees.length; __n.key('Enter', 'Enter', { altKey: true });
            out.altEnter = { roots: state.trees.length - roots, type: state.trees[state.trees.length - 1].type, s2: __n.kids('S2') };
            __n.load(${TR}, ['S2-0']); roots = state.trees.length; addChild('note');
            out.viaAddChild = { roots: state.trees.length - roots, s2: __n.kids('S2'), type: state.trees[state.trees.length - 1].type };
            __n.load(${TR}, ['S2-0']); roots = state.trees.length; document.getElementById('btn-add-not').click();
            out.toolbar = state.trees.length - roots;
            __n.load(${TR}); roots = state.trees.length; showContextMenu(10, 10, 'O1', 0);
            var item = Array.prototype.slice.call(document.querySelectorAll('#context-menu .ctx-item')).find(function (b) { return /^Add Note/.test(b.textContent.trim()); });
            if (item) item.click();
            out.menu = { roots: state.trees.length - roots, o1: __n.kids('O1'), found: !!item };
            __n.load(${TR}, ['FN-0']); roots = state.trees.length; addNote();
            out.onNote = state.trees.length - roots;
            __n.load(${TR}, []); roots = state.trees.length; addNote();
            out.noSelection = state.trees.length - roots;
            return out;`);
        const b = n.button || {};
        ok(b.roots === 1 && b.type === 'note' && b.free === true && b.children === 0 && J(b.s1) === J(['O1', 'S2']),
            'Add Note makes a note of its own, pinned; the box keeps exactly the children it had', J(b));
        ok(b.at && b.x === Math.round(b.at.right + 30) && b.y === Math.round(b.at.top),
            'it goes beside the box: just right of it, level with its top, where nothing is drawn', J([b.x, b.y, b.at]));
        ok(J(b.sel) === J([b.id + '-0']) && b.undo === 1, 'the new note is selected for typing, and one undo removes it', J(b));
        ok(n.altEnter && n.altEnter.roots === 1 && n.altEnter.type === 'note' && J(n.altEnter.s2) === J([]),
            'Alt+Enter does the same', J(n.altEnter));
        ok(n.viaAddChild && n.viaAddChild.roots === 1 && n.viaAddChild.type === 'note' && J(n.viaAddChild.s2) === J([]),
            'and so does an old call to add a note child: it never hangs a note from the box', J(n.viaAddChild));
        ok(n.toolbar === 1 && n.menu && n.menu.found && n.menu.roots === 1 && J(n.menu.o1) === J(['R1']),
            "the toolbar's Add Note and the context menu's Add Note both put it beside the box", J([n.toolbar, n.menu]));
        ok(n.onNote === 1 && n.noSelection === 0, 'a note can have another note beside it; with nothing selected there is nothing to be beside', J([n.onNote, n.noSelection]));
    }

    /* ---------------- 3. toolbar, context menu, + buttons ---------------- */
    console.log('\n-- toolbar, context menu and + buttons on a note --');
    {
        const ADD = ['btn-add-sup', 'btn-add-obj', 'btn-add-weak', 'btn-add-co', 'btn-add-not'];
        const TYPE = ['btn-type-sup', 'btn-type-obj', 'btn-type-weak', 'btn-type-note', 'btn-main', 'btn-implicit', 'btn-given'];
        const b = T(W, `var out = {};
            function read(sel) { __n.load(${TR}, sel); return __n.disabled(${J(ADD.concat(TYPE))}); }
            out.FN = read(['FN-0']); out.S2 = read(['S2-0']); out.LN = read(['LN-0']);
            return out;`);
        const off = (k, ids) => ids.every(id => b[k] && b[k][id] === true);
        const on = (k, ids) => ids.every(id => b[k] && b[k][id] === false);
        ok(off('FN', ['btn-add-sup', 'btn-add-obj', 'btn-add-weak', 'btn-add-co']) && on('FN', ['btn-add-not']),
            'a note selected: Add Support, Objection, Weak Objection and Co-Premise gray out; Add Note stays', J(b.FN));
        ok(on('FN', ['btn-type-sup', 'btn-type-obj', 'btn-type-weak', 'btn-type-note', 'btn-main']) && off('FN', ['btn-implicit', 'btn-given']),
            'every Change Type stays (retyping a note needs no connection); Implicit and Given are still off', J(b.FN));
        ok(off('LN', ['btn-add-sup', 'btn-add-co']) && on('S2', ADD.concat(['btn-type-note', 'btn-type-sup'])),
            "an older map's note too; a support has everything, Note included", J([b.LN, b.S2]));

        const m = T(W, `var out = {};
            function read(id) {
                __n.load(${TR}); showContextMenu(10, 10, id, 0);
                var menu = document.getElementById('context-menu');
                var items = {}; Array.prototype.slice.call(menu.querySelectorAll('.ctx-item')).forEach(function (el) {
                    items[el.textContent.replace(/(Enter|Shift\\+Enter|Ctrl\\+Enter|Alt\\+Enter|Tab)$/, '').trim()] = el.disabled; });
                var chips = {}; Array.prototype.slice.call(menu.querySelectorAll('.ctx-types button')).forEach(function (el) { chips[el.textContent.trim()] = el.disabled; });
                hideContextMenu();
                return { items: items, chips: chips };
            }
            out.FN = read('FN'); out.S2 = read('S2');
            return out;`);
        const it = (k, name) => ((m[k] || {}).items || {})[name];
        ok(['Support', 'Objection', 'Weak Objection', 'Add Co-Premise'].every(x => it('FN', x) === true) && it('FN', 'Add Note') === false,
            'right-click a note: Support, Objection, Weak Objection and Add Co-Premise are grayed; Add Note is not', J(m.FN && m.FN.items));
        ok(Object.values((m.FN || {}).chips || {}).length === 5 && Object.values(m.FN.chips).every(v => v === false),
            'none of its Change Type chips is grayed', J(m.FN && m.FN.chips));
        ok(['Support', 'Objection', 'Weak Objection', 'Add Co-Premise', 'Add Note'].every(x => it('S2', x) === false) && it('S2', 'Note') === undefined,
            'on a support nothing is grayed, and Note is no longer offered as a child -- Add Note is its own item', J(m.S2 && m.S2.items));

        W.win.eval(`
            window.__realRect = Element.prototype.getBoundingClientRect;
            Element.prototype.getBoundingClientRect = function () {
                var r = function (l, t, w, h) { return { left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t }; };
                if (this.id === 'canvas') return r(0, 0, 1200, 800);
                if (this.id === 'surface') return r(0, 0, 60000, 60000);
                if (this.classList && (this.classList.contains('node') || this.classList.contains('node-group'))) return r(500, 300, 180, 60);
                return window.__realRect.call(this);
            };
        `);
        const plus = T(W, `var out = {};
            ['FN', 'LN', 'S2'].forEach(function (id) {
                [false, true].forEach(function (open) {
                    __n.load(${TR}, [id + '-0']); nodeActionExpanded = open; updateNodeActions();
                    out[id + (open ? '+' : '')] = document.querySelectorAll('.node-action-btn').length;
                });
            });
            nodeActionExpanded = false;
            return out;`);
        W.win.eval(`Element.prototype.getBoundingClientRect = window.__realRect;`);
        ok(plus.FN === 0 && plus['FN+'] === 0 && plus.LN === 0 && plus['LN+'] === 0,
            'a selected note gets no + buttons at all, the chooser opened or not', J(plus));
        ok(plus.S2 === 3 && plus['S2+'] === 5, 'a support still gets its chooser and both co-premise buttons', J(plus));
    }

    /* ---------------- 4. turning boxes into notes ---------------- */
    console.log('\n-- turning boxes into notes cuts their connections --');
    {
        const c = T(W, `var out = {};
            __n.load(${TR}, ['S2-0']); var was = __n.pos('S2');
            changeSelectedTypes('note');
            out.leaf = { root: __n.root('S2'), was: was, s1: __n.kids('S1'), sel: selectedIds.slice(), undo: undoStack.length };
            undo();
            out.leafUndo = { parent: __n.parentOf('S2'), type: __n.type('S2'), s1: __n.kids('S1') };

            __n.load(${TR}, ['S1-0']); var wS1 = __n.pos('S1'), wO1 = __n.pos('O1'), wS2 = __n.pos('S2');
            __n.key('KeyN', 'n');
            out.withKids = { S1: __n.root('S1'), O1: __n.root('O1'), S2: __n.root('S2'), R1: __n.parentOf('R1'),
                             M: __n.kids('M'), was: [wS1, wO1, wS2], sel: selectedIds.slice(), undo: undoStack.length };

            __n.load(${TR}, ['G-1']); var wGb = renderedBoxRect('G', 1), wGB = __n.pos('GB');
            changeSelectedTypes('note');
            var gb = state.trees.find(function (t) { return t.texts[0] === 'Gb'; });
            out.oneBox = { G: __n.node('G').texts.slice(), Gkids: __n.kids('G'), note: gb ? __n.root(gb.id) : null, wasGb: wGb,
                           GB: __n.root('GB'), wasGB: wGB, sel: selectedIds.slice(), id: gb && gb.id, M: __n.kids('M') };

            __n.load(${TR}, ['G']); changeSelectedTypes('note');
            out.wholeGroup = { notes: state.trees.filter(function (t) { return t.type === 'note' && (t.texts[0] === 'Ga' || t.texts[0] === 'Gb') && t.texts.length === 1; }).map(function (t) { return t.texts[0]; }).sort(),
                               kids: [__n.parentOf('GB')], M: __n.kids('M'), sel: selectedIds.length };

            __n.load(${TR}, ['FS-0']); var at = state.trees.findIndex(function (t) { return t.id === 'FS'; });
            changeSelectedTypes('note');
            out.freeRoot = { at: state.trees.findIndex(function (t) { return t.id === 'FS'; }), was: at, FS: __n.root('FS'), FC: __n.root('FC') };

            __n.load(${TR}, ['FN-0']); var before = __n.trees(); changeSelectedTypes('note');
            out.alone = { same: __n.trees() === before, undo: undoStack.length };

            __n.load(${TR}, ['LN-0']); changeSelectedTypes('note');
            out.older = { LN: __n.root('LN'), LS: __n.root('LS'), M: __n.kids('M') };

            __n.load(${TR}, ['M-0']); var wM = __n.pos('M'); changeSelectedTypes('note');
            out.main = { M: __n.root('M'), at: state.trees.findIndex(function (t) { return t.id === 'M'; }), was: wM, S1: __n.root('S1'), G: __n.root('G'), LN: __n.root('LN') };

            __n.load(${TR}, ['S2-0', 'O1-0']); changeSelectedTypes('note');
            out.two = { S2: __n.root('S2'), O1: __n.root('O1'), R1: __n.root('R1'), S1: __n.kids('S1'), undo: undoStack.length };
            return out;`);
        const l = c.leaf || {}, lr = l.root || {};
        ok(lr.type === 'note' && lr.free === true && J(l.s1) === J(['O1']), 'a leaf turned into a note leaves its parent: a note of its own, pinned', J(l));
        ok(l.was && lr.x === l.was[0] && lr.y === l.was[1], 'right where it was drawn', J([lr.x, lr.y, l.was]));
        ok(J(lr.imp) === J([false]) && J(lr.giv) === J([false]) && J(l.sel) === J(['S2-0']) && l.undo === 1,
            'no longer implicit or given, still selected, one undo step', J(lr));
        ok(c.leafUndo && c.leafUndo.parent === 'S1' && c.leafUndo.type === 'support' && J(c.leafUndo.s1) === J(['O1', 'S2']),
            'and undo puts it back as it was', J(c.leafUndo));

        const k = c.withKids || {};
        ok(k.S1 && k.S1.type === 'note' && k.S1.free && J(k.S1.kids) === J([]) && J(k.M) === J(['G', 'LN']),
            'N on a box with children (by key): the box becomes a note of its own, holding nothing', J(k));
        ok(k.O1 && k.O1.type === 'objection' && k.O1.free && J(k.O1.kids) === J(['R1']) && k.R1 === 'O1' && k.S2 && k.S2.type === 'support' && k.S2.free,
            'each box it held becomes the top of a tree of its own, pinned, keeping its own branch and type', J([k.O1, k.S2]));
        ok(k.was && k.S1 && k.S1.x === k.was[0][0] && k.S1.y === k.was[0][1] && k.O1.x === k.was[1][0] && k.O1.y === k.was[1][1] &&
           k.S2.x === k.was[2][0] && k.S2.y === k.was[2][1],
            'all of them where they were drawn', J(k.was));
        ok(J(k.sel) === J(['S1-0']) && k.undo === 1, 'the note stays selected, and it is all one undo step', J([k.sel, k.undo]));

        const o = c.oneBox || {};
        ok(J(o.G) === J(['Ga']) && J(o.Gkids) === J([]) && o.note && o.note.type === 'note' && o.note.free && J(o.note.kids) === J([]),
            'one co-premise turned into a note leaves its group; the other keeps its place', J(o));
        ok(o.note && o.wasGb && o.note.x === Math.round(o.wasGb.left) && o.note.y === Math.round(o.wasGb.top) &&
           o.GB && o.GB.type === 'objection' && o.GB.free && o.wasGB && o.GB.x === o.wasGB[0] && o.GB.y === o.wasGB[1] && o.GB.target === undefined,
            'the note sits where its box was, and the objection it held stands on its own where it was', J([o.note, o.wasGb, o.GB, o.wasGB]));
        ok(J(o.sel) === J([o.id + '-0']), 'the new note is selected', J(o.sel));
        ok(c.wholeGroup && J(c.wholeGroup.notes) === J(['Ga', 'Gb']) && J(c.wholeGroup.kids) === J(['root']) && J(c.wholeGroup.M) === J(['S1', 'LN']) && c.wholeGroup.sel === 2,
            'a whole group becomes two notes, one per box, and the objection it held stands alone', J(c.wholeGroup));
        ok(c.freeRoot && c.freeRoot.at === c.freeRoot.was && c.freeRoot.FS && c.freeRoot.FS.type === 'note' && c.freeRoot.FC && c.freeRoot.FC.free,
            'a tree of its own changes in place, keeping its order among the trees; its child stands alone', J(c.freeRoot));
        ok(c.alone && c.alone.same && c.alone.undo === 0, 'a note that already stands alone: nothing happens, no undo step', J(c.alone));
        ok(c.older && c.older.LN && c.older.LN.type === 'note' && c.older.LN.free && c.older.LS && c.older.LS.type === 'support' && J(c.older.M) === J(['S1', 'G']),
            "N on a note an older map hung from a box cuts it loose, and the support under it", J(c.older));
        ok(c.main && c.main.M && c.main.M.type === 'note' && c.main.at === 0 && c.main.S1 && c.main.G && c.main.LN &&
           c.main.was && c.main.M.x === c.main.was[0] && c.main.M.y === c.main.was[1],
            'even the main contention: it becomes a note in place, and its premises become trees of their own', J(c.main));
        ok(c.two && c.two.S2 && c.two.S2.type === 'note' && c.two.O1 && c.two.O1.type === 'note' && c.two.R1 && c.two.R1.type === 'rebuttal' &&
           J(c.two.S1) === J([]) && c.two.undo === 1,
            'several at once: each becomes a note, what they held stands alone, one undo step', J(c.two));
    }

    /* ---------------- 5. stepping clear ---------------- */
    console.log('\n-- stepping clear of the map --');
    {
        const s = T(W, `var out = {};
            __n.load(${TR});
            var surface = document.getElementById('surface');
            function fake(id, x, y, w, h) {
                var g = document.createElement('div'); g.className = 'node-group'; g.id = 'group-' + id;
                g.style.left = x + 'px'; g.style.top = y + 'px';
                Object.defineProperty(g, 'offsetWidth', { value: w, configurable: true });
                Object.defineProperty(g, 'offsetHeight', { value: h, configurable: true });
                surface.appendChild(g); return g;
            }
            function hits(x, y, w, h, gap) {
                return renderedGroupRects().filter(function (r) {
                    return !(x + w + gap <= r.left || x >= r.right + gap || y + h + gap <= r.top || y >= r.bottom + gap);
                }).length;
            }
            fake('blockA', 1000, 1000, 180, 60);
            fake('blockB', 1224, 1000, 180, 60);
            var spot = freeSpotNear(1010, 1010, 180, 60);
            out.spot = spot; out.clear = hits(spot.x, spot.y, 180, 60, 24);
            out.dist = Math.hypot(spot.x - 1010, spot.y - 1010);
            out.stays = freeSpotNear(2000, 2000, 180, 60);
            out.skip = freeSpotNear(1010, 1010, 180, 60, new Set(['blockA', 'blockB']));

            // A pinned note that the map now overlaps moves to the nearest clear spot.
            var fn = document.getElementById('group-FN');
            Object.defineProperty(fn, 'offsetWidth', { value: 180, configurable: true });
            Object.defineProperty(fn, 'offsetHeight', { value: 60, configurable: true });
            var fx = parseFloat(fn.style.left), fy = parseFloat(fn.style.top);
            fake('cover', fx + 20, fy + 10, 180, 60);
            var before = { x: __n.root('FN').x, y: __n.root('FN').y };
            settleClearOfMap(['FN']);
            var after = __n.root('FN');
            out.settle = { before: before, after: { x: after.x, y: after.y }, from: [fx, fy],
                           clear: !(after.x + 180 + 24 <= fx + 20 || after.x >= fx + 200 + 24 || after.y + 60 + 24 <= fy + 10 || after.y >= fy + 70 + 24) ? 0 : 1 };
            __n.load(${TR});
            var fn2 = document.getElementById('group-FN');
            Object.defineProperty(fn2, 'offsetWidth', { value: 180, configurable: true });
            Object.defineProperty(fn2, 'offsetHeight', { value: 60, configurable: true });
            var b2 = __n.root('FN'); settleClearOfMap(['FN']); var a2 = __n.root('FN');
            out.unmoved = a2.x === b2.x && a2.y === b2.y;
            return out;`);
        ok(s.clear === 0 && s.spot && (s.spot.x !== 1010 || s.spot.y !== 1010), 'freeSpotNear finds a spot that overlaps nothing drawn, gap included', J(s));
        ok(s.dist <= 160, 'and a near one, not a far corner', J(s.dist));
        ok(s.stays && s.stays.x === 2000 && s.stays.y === 2000 && s.skip && s.skip.x === 1010 && s.skip.y === 1010,
            'a spot already clear is kept, and the tree being placed does not count against itself', J([s.stays, s.skip]));
        ok(s.settle && (s.settle.after.x !== s.settle.before.x || s.settle.after.y !== s.settle.before.y) && s.settle.clear === 1,
            'a pinned note the closed-up map now covers steps clear of it', J(s.settle));
        ok(s.unmoved === true, 'one nothing covers stays exactly where it is', J(s.unmoved));
    }

    /* ---------------- 6. drops ---------------- */
    console.log('\n-- drops --');
    {
        const c = T(W, `var out = {};
            var T = function (o) { return Object.assign({ el: null, id: 'T', idx: 0, left: 0, top: 0, w: 180, h: 60, parentId: 'P', parentType: 'support', groupTextsLen: 1, nodeType: 'support' }, o); };
            var below = { left: 40, top: 70, w: 50, h: 40 }, inside = { left: 65, top: 10, w: 50, h: 40 }, beside = { left: 170, top: 10, w: 50, h: 40 }, above = { left: 40, top: -60, w: 50, h: 40 };
            var run = function (G, targets, o) { return classifyDrop(G, targets, Object.assign({ mode: 'group', draggedParentId: 'M' }, o || {})).type; };
            out.onNote = [run(below, [T({ nodeType: 'note' })]), run(inside, [T({ nodeType: 'note' })]), run(above, [T({ nodeType: 'note' })])];
            out.besideOlder = [run(beside, [T({ parentType: 'note' })]), run(above, [T({ parentType: 'note' })])];
            out.carrying = [run(below, [T({})], { carriesNote: true }), run(inside, [T({})], { carriesNote: true }), run(above, [T({})], { carriesNote: true })];
            out.plain = [run(below, [T({})]), run(inside, [T({})])];
            return out;`);
        ok(J(c.onNote) === J(['refused', 'refused', 'refused']), 'a box aimed below a note, into it, or above it is refused', J(c.onNote));
        ok(J(c.besideOlder) === J(['refused', 'refused']), "and beside or above a box an older map hung from a note", J(c.besideOlder));
        ok(J(c.carrying) === J(['detach', 'detach', 'detach']), 'a drag carrying a note never connects: wherever it is dropped, it just moves there', J(c.carrying));
        ok(J(c.plain) === J(['child', 'copremise']), 'other drops are as before', J(c.plain));

        const d = T(W, `var out = {};
            var geo = { FN: { left: 0, top: 0 }, S1: { left: 400, top: 0 } };
            var targetsFor = function () {
                return Object.keys(geo).map(function (id) {
                    var ctx = findNodeContext(state.trees, id);
                    return { el: document.querySelector('.node[data-node-id="' + id + '"][data-node-idx="0"]'), id: id, idx: 0,
                             left: geo[id].left, top: geo[id].top, w: 180, h: 60,
                             parentId: ctx.parent ? ctx.parent.id : null, parentType: ctx.parent ? ctx.parent.type : null,
                             groupTextsLen: ctx.node.texts.length, nodeType: ctx.node.type };
                });
            };
            var realGhost = ghostRectFor, realProbe = probeRectFor;
            var drop = function (ids, G) {
                selectedIds = ids.map(function (id) { return id + '-0'; });
                var node = findNodeContext(state.trees, ids[0]).node;
                var ghost = document.querySelector('.node[data-node-id="' + ids[0] + '"][data-node-idx="0"]');
                var e0 = { clientX: 0, clientY: 0, screenX: 0, screenY: 0 };
                if (ids.length > 1) startSelectedForestDrag(e0, node, 0, ghost, 'group', null, buildSelectedDragForest());
                else startDrag(e0, node, 0, ghost, 'group');
                var carries = dragCtx.carriesNote;
                dragCtx.targets = targetsFor();
                ghostRectFor = function () { return G; }; probeRectFor = function () { return G; };
                try { executeDrop({ shiftKey: false, altKey: false, clientX: 400, clientY: 400, screenX: 400, screenY: 400 }); }
                finally { ghostRectFor = realGhost; probeRectFor = realProbe; }
                return carries;
            };
            var belowFN = { left: 40, top: 70, w: 50, h: 40 }, belowS1 = { left: 440, top: 70, w: 50, h: 40 };

            __n.load(${TR}); __n.resetHint(); var before = __n.trees();
            out.flagSupport = drop(['S2'], belowFN);
            out.refused = { same: __n.trees() === before, undo: undoStack.length, dragging: !!dragCtx, hint: __n.hint() };
            __n.load(${TR});
            out.flagNote = drop(['FN'], belowS1);
            out.noteMoves = { parent: __n.parentOf('FN'), s1: __n.kids('S1'), undo: undoStack.length };
            __n.load(${TR});
            out.flagOlder = drop(['LN'], belowS1);
            out.olderMoves = { parent: __n.parentOf('LN'), M: __n.kids('M') };
            __n.load(${TR});
            out.flagMixed = drop(['S2', 'FN'], belowS1);
            out.mixed = { S2: __n.parentOf('S2'), FN: __n.parentOf('FN'), s1: __n.kids('S1') };
            return out;`);
        ok(d.flagSupport === false && d.flagNote === true && d.flagOlder === true && d.flagMixed === true,
            'a drag knows whether it carries a note, alone or in a multi-selection', J([d.flagSupport, d.flagNote, d.flagOlder, d.flagMixed]));
        ok(d.refused && d.refused.same && d.refused.undo === 0 && d.refused.dragging === false && d.refused.hint === HINT,
            'a support dropped below a note: nothing moves, no undo step, and the hint says why', J(d.refused));
        ok(d.noteMoves && d.noteMoves.parent === 'root' && J(d.noteMoves.s1) === J(['O1', 'S2']) && d.noteMoves.undo === 1,
            'a note dropped below a support does not hang from it: it just moves there', J(d.noteMoves));
        ok(d.olderMoves && d.olderMoves.parent === 'root' && J(d.olderMoves.M) === J(['S1', 'G']),
            "an older map's note dragged anywhere comes loose", J(d.olderMoves));
        ok(d.mixed && d.mixed.S2 === 'root' && d.mixed.FN === 'root' && J(d.mixed.s1) === J(['O1']),
            'a multi-selection carrying a note connects nothing either', J(d.mixed));
    }

    /* ---------------- 7. paste ---------------- */
    console.log('\n-- paste --');
    {
        const p = T(W, `var out = {};
            __n.load(${TR}, ['S2-0']); copyNode(); selectedIds = ['FN-0']; __n.resetHint(); var before = __n.trees();
            pasteNode(); out.onto = { same: __n.trees() === before, undo: undoStack.length, hint: __n.hint() };
            selectedIds = ['FN-0']; pasteAsCoPremise(); out.into = { same: __n.trees() === before, undo: undoStack.length };

            __n.load(${TR}, ['FN-0']); copyNode(); var roots = state.trees.length;
            selectedIds = ['S1-0']; pasteNode();
            var made = state.trees[state.trees.length - 1];
            out.noteBeside = { roots: state.trees.length - roots, type: made.type, free: made.freePosition === true, s1: __n.kids('S1') };
            selectedIds = ['S1-0']; before = __n.trees(); pasteAsCoPremise();
            out.noteJoins = { same: __n.trees() === before, texts: __n.node('S1').texts.length };

            __n.load(${TR}, ['S2-0', 'FN-0']); copyNode(); roots = state.trees.length;
            selectedIds = ['G-0']; pasteNode();
            out.mixed = { roots: state.trees.length - roots, g: __n.node('G').children.map(function (k) { return k.type; }) };
            return out;`);
        ok(p.onto && p.onto.same && p.onto.undo === 0 && p.onto.hint === HINT, 'a support pasted onto a note is refused, with the hint', J(p.onto));
        ok(p.into && p.into.same && p.into.undo === 0, 'and pasted into a note as a co-premise', J(p.into));
        ok(p.noteBeside && p.noteBeside.roots === 1 && p.noteBeside.type === 'note' && p.noteBeside.free && J(p.noteBeside.s1) === J(['O1', 'S2']),
            'a note pasted onto a box goes beside it, pinned, as Add Note puts one', J(p.noteBeside));
        ok(p.noteJoins && p.noteJoins.same && p.noteJoins.texts === 1, 'a note never joins a group as a co-premise', J(p.noteJoins));
        ok(p.mixed && p.mixed.roots === 1 && J((p.mixed.g || []).slice().sort()) === J(['objection', 'support']),
            'a support and a note pasted together: the support hangs from the box, the note goes beside it', J(p.mixed));
    }

    /* ---------------- 8. map text ---------------- */
    console.log('\n-- map text --');
    {
        const t = T(W, `var find = function (trees, text) { var hit = null; (function walk(ns) { ns.forEach(function (n) { if (n.texts.indexOf(text) >= 0) hit = n; walk(n.children); }); })(trees); return hit; };
            var roots = function (trees) { return trees.map(function (n) { return n.texts[0]; }); };
            var p = parseTextToState(['M1: Main', '  M1S1: Support', '    M1S1N1: A note under a support', '  M1N1: A note under the contention',
                                      '    M1N1S1: A support under a note', 'N1a: First', 'N1b: Second'].join('\\n'));
            var main = find(p.trees, 'Main'), sup = find(p.trees, 'Support');
            return { roots: roots(p.trees), mainKids: main.children.map(function (k) { return k.texts[0]; }), supKids: sup.children.length,
                     types: ['A note under a support', 'A note under the contention', 'A support under a note', 'First', 'Second'].map(function (x) { var n = find(p.trees, x); return n ? n.type + ':' + n.texts.length : null; }) };`);
        ok(t.roots && ['A note under a support', 'A note under the contention', 'A support under a note', 'First', 'Second'].every(x => t.roots.includes(x)),
            'map text: a note written under a box, a box written under a note, and co-premise notes all come in as trees of their own', J(t));
        ok(J(t.mainKids) === J(['Support']) && t.supKids === 0 && J(t.types) === J(['note:1', 'note:1', 'support:1', 'note:1', 'note:1']),
            'the argument keeps its boxes, and every note stays a single note', J(t));
    }

    /* ---------------- 9. untyped boxes ---------------- */
    console.log('\n-- untyped boxes retired --');
    {
        const u = T(W, `var out = {};
            var old = { name: 'Old map', trees: [
                { id: 'a', type: 'contention', texts: ['A'], collapsed: [], children: [ { id: 'b', type: 'neutral', texts: ['B'], collapsed: [], children: [
                    { id: 'c', type: 'objection', texts: ['C'], collapsed: [], children: [] } ] } ], x: 30000, y: 30000 },
                { id: 'd', type: 'neutral', texts: ['D'], collapsed: [], children: [], x: 29000, y: 30000, freePosition: true } ] };
            adoptMapData(old); render();
            out.loaded = [__n.type('b'), __n.type('d'), __n.type('c')];
            out.dom = { neutral: document.querySelectorAll('.type-neutral').length, support: document.querySelectorAll('.node.type-support').length };
            __n.load(${TR}, []);
            var n = createNodeAt(31000, 31000, undefined, false);
            var el = document.querySelector('.node[data-node-id="' + n.id + '"]');
            out.newNode = { type: n.type, cls: el ? el.className : null };
            out.letters = Object.keys(LABEL_LETTERS);
            out.kinds = (function () { var k = computeArgumentKinds([{ id: 'x', type: 'neutral', texts: ['x'], children: [] }]).get('x'); return [k.kind, k.color]; })();
            out.markers = !!document.getElementById('arrow-neutral');
            return out;`);
        ok(J(u.loaded) === J(['support', 'support', 'objection']), 'a map saved with untyped boxes loads them as supports, and what hangs from them keeps its type', J(u.loaded));
        ok(u.dom && u.dom.neutral === 0 && u.dom.support === 2, 'and draws them as supports', J(u.dom));
        ok(u.newNode && u.newNode.type === 'support' && /\btype-support\b/.test(u.newNode.cls || ''), 'New Node makes a support', J(u.newNode));
        ok(Array.isArray(u.letters) && !u.letters.includes('neutral') && J(u.kinds) === J(['support', 'support']) && u.markers === false,
            'no label letter, arrowhead or kind is left for them; one arriving from an older copy reads as a support', J(u));
        const CSS = HTML.slice(0, HTML.indexOf('</style>'));
        ok(!/neutral/i.test(CSS), 'the stylesheet has no untyped look left');
    }

    /* ---------------- 10. Help ---------------- */
    console.log('\n-- Help --');
    {
        const h = T(W, `return document.getElementById('help-panel').innerHTML;`);
        ok(/A <strong>note<\/strong> stands alone: it connects to nothing, and nothing connects to it/.test(h || '') &&
           /<kbd>Alt\+Enter<\/kbd> note beside the box/.test(h || '') && /<kbd>N<\/kbd> turn into a note/.test(h || '') && !/holds only other notes/.test(h || ''),
            'Help says a note stands alone, and what Add Note and N do');
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
