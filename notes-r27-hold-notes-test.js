'use strict';
// r27 A note holds only notes; untyped boxes are retired.
//
// A note annotates the argument. It can hang from any box -- a support, an
// objection, the contention, another note -- but it holds only other notes:
// supports, objections and rebuttals go under premises. Every way of putting
// a box under a note keeps to that, judged on the tree the change leaves:
//   - adding: Add Support / Objection / Weak Objection (toolbar, keys, the
//     context menu, the + chooser) are refused under a note; Add Note works;
//   - retyping: a note's child cannot become an argument box, and a box
//     holding an argument box cannot become a note -- unless what blocks it
//     is selected to change too;
//   - dropping: an argument box dropped onto a note (as its child, its
//     co-premise, or beside a box under it) is refused, and stays where it was;
//   - pasting: the same, for Paste and Paste as Co-Premise.
// A refusal changes nothing, pushes no undo step, and explains itself once.
// Maps saved before the rule are left as they are.
//
// Untyped ("neutral") boxes had no job another feature did not do better --
// a support is the plain box, a note the aside -- so they were retired: New
// Node makes a support, and an untyped box saved earlier loads as one.
//
// Covers:
//   (1) adding under a note, by function and by key;
//   (2) retyping, alone and together;
//   (3) the toolbar and context menu gray out what a note cannot take;
//   (4) drops, classified and executed, single and multi-selection;
//   (5) paste and paste as co-premise;
//   (6) untyped boxes: load, New Node, labels;
//   (7) Help.
//
// Run:  node notes-r27-hold-notes-test.js [argument-mapper-r27.html]
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
// │  └─ NT note
// │     └─ NN note            a note under a note
// ├─ S2 support               a leaf
// ├─ S3 support               a leaf (a drop target)
// ├─ S4 support
// │  └─ O4 objection
// │     └─ R4 rebuttal
// ├─ S5 support               a leaf
// └─ LN note                  saved before the rule:
//    └─ LS support            an argument box under a note
// FN a separate note; FM a separate note
const TREES = [
    N('M', 'contention', [
        N('S1', 'support', [ N('NT', 'note', [ N('NN', 'note') ]) ]),
        N('S2', 'support'),
        N('S3', 'support'),
        N('S4', 'support', [ N('O4', 'objection', [ N('R4', 'rebuttal') ]) ]),
        N('S5', 'support'),
        N('LN', 'note', [ N('LS', 'support') ])
    ], { x: 30000, y: 30000 }),
    N('FN', 'note', [], { x: 29000, y: 30500, freePosition: true }),
    N('FM', 'note', [], { x: 29000, y: 30800, freePosition: true })
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
        kids(id) { var n = this.node(id); return n ? n.children.map(function (c) { return c.type; }) : null; },
        trees() { return JSON.stringify(state.trees); },
        resetHint() {
            sessionSeenHints.delete('note-holds-notes');
            try { localStorage.removeItem('argmap-hint-note-holds-notes'); } catch (e) {}
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
const HINT = 'A note holds only notes: add argument boxes to a premise instead.';

(async () => {
    console.log('=== r27 a note holds only notes; untyped boxes retired ===');
    const W = makeWin('notes');
    await sleep(250);
    W.win.eval(HELPERS);

    /* ---------------- 1. adding ---------------- */
    console.log('\n-- adding under a note --');
    {
        const a = T(W, `var out = {};
            __n.load(${J(TREES)}, ['NT-0']); __n.resetHint();
            var before = __n.trees();
            addChild('support');
            out.sup = { same: __n.trees() === before, undo: undoStack.length, hint: __n.hint(), sel: selectedIds.slice() };
            ['objection', 'rebuttal', 'weak-objection', 'weak-rebuttal'].forEach(function (t) { addChild(t); });
            out.attacks = { same: __n.trees() === before, undo: undoStack.length };
            addChild('note');
            out.note = { kids: __n.kids('NT'), undo: undoStack.length };
            __n.load(${J(TREES)}, ['NN-0']); addChild('support'); out.deeper = __n.kids('NN');
            __n.load(${J(TREES)}, ['LN-0']); addChild('objection'); out.legacy = __n.kids('LN');
            out.plain = [];
            ['support', 'objection', 'weak-objection', 'note'].forEach(function (t) { __n.load(${J(TREES)}, ['S2-0']); addChild(t); out.plain.push(__n.kids('S2')[0]); });
            __n.load(${J(TREES)}, ['FN-0']); addChild('support'); out.freeNote = __n.kids('FN');
            return out;`);
        ok(a.sup && a.sup.same && a.sup.undo === 0 && J(a.sup.sel) === J(['NT-0']),
            'Add Support on a note changes nothing: no box, no undo step, the note stays selected', J(a.sup));
        ok(a.sup && a.sup.hint === HINT, 'and explains why, once', J(a.sup && a.sup.hint));
        ok(a.attacks && a.attacks.same && a.attacks.undo === 0, 'objections and rebuttals, weak or not, are refused too', J(a.attacks));
        ok(a.note && J(a.note.kids) === J(['note', 'note']) && a.note.undo === 1, 'Add Note on a note works', J(a.note));
        ok(J(a.deeper) === J([]) && J(a.legacy) === J(['support']) && J(a.freeNote) === J([]),
            'the same under a note under a note, a note saved before the rule, and a separate note', J([a.deeper, a.legacy, a.freeNote]));
        ok(J(a.plain) === J(['support', 'objection', 'weak-objection', 'note']), 'a support still takes every kind of box', J(a.plain));

        const k = T(W, `var out = {};
            __n.load(${J(TREES)}, ['NT-0']);
            var before = __n.trees();
            __n.key('Enter', 'Enter'); __n.key('Enter', 'Enter', { shiftKey: true }); __n.key('Enter', 'Enter', { ctrlKey: true });
            out.refused = { same: __n.trees() === before, undo: undoStack.length };
            selectedIds = ['NT-0']; __n.key('Enter', 'Enter', { altKey: true });
            out.alt = __n.kids('NT');
            __n.load(${J(TREES)}, ['S2-0']); __n.key('Enter', 'Enter'); out.enterOnSupport = __n.kids('S2');
            return out;`);
        ok(k.refused && k.refused.same && k.refused.undo === 0, 'Enter, Shift+Enter and Ctrl+Enter on a note add nothing', J(k.refused));
        ok(J(k.alt) === J(['note', 'note']), 'Alt+Enter adds a note to it', J(k.alt));
        ok(J(k.enterOnSupport) === J(['support']), 'Enter on a support still adds a support', J(k.enterOnSupport));
    }

    /* ---------------- 2. retyping ---------------- */
    console.log('\n-- retyping --');
    {
        const r = T(W, `var out = {};
            __n.load(${J(TREES)}, ['NN-0']); __n.resetHint();
            var before = __n.trees();
            ['support', 'objection', 'rebuttal', 'weak-objection', 'weak-rebuttal'].forEach(function (t) { changeSelectedTypes(t); });
            out.underNote = { same: __n.trees() === before, undo: undoStack.length, hint: __n.hint(), sel: selectedIds.slice() };
            ['KeyS', 'KeyO', 'KeyR', 'KeyW'].forEach(function (c) { selectedIds = ['NN-0']; __n.key(c, c.slice(3).toLowerCase()); });
            out.keys = { same: __n.trees() === before, undo: undoStack.length };
            selectedIds = ['NN-0']; changeSelectedTypes('contention');
            out.main = { type: __n.type('NN'), parent: __n.parentOf('NN') };

            __n.load(${J(TREES)}, ['S4-0']); before = __n.trees();
            changeSelectedTypes('note'); __n.key('KeyN', 'n');
            out.holdsArgument = { same: __n.trees() === before, undo: undoStack.length };
            __n.load(${J(TREES)}, ['S1-0']); changeSelectedTypes('note'); out.holdsNotes = __n.type('S1');
            __n.load(${J(TREES)}, ['S2-0']); changeSelectedTypes('note'); out.leaf = __n.type('S2');
            __n.load(${J(TREES)}, ['NT-0']); changeSelectedTypes('objection'); out.noteToAttack = [__n.type('NT'), __n.kids('NT')];

            __n.load(${J(TREES)}, ['NN-0', 'S2-0']); changeSelectedTypes('objection');
            out.mixed = { NN: __n.type('NN'), S2: __n.type('S2'), sel: selectedIds.slice(), undo: undoStack.length };
            __n.load(${J(TREES)}, ['S4-0', 'O4-0', 'R4-0']); changeSelectedTypes('note');
            out.subtreeToNote = [__n.type('S4'), __n.type('O4'), __n.type('R4')];
            __n.load(${J(TREES)}, ['S4-0', 'O4-0']); changeSelectedTypes('note');
            out.partialSubtree = [__n.type('S4'), __n.type('O4'), __n.type('R4')];
            __n.load(${J(TREES)}, ['NT-0', 'NN-0']); changeSelectedTypes('support');
            out.noteAndChild = [__n.type('NT'), __n.type('NN')];
            __n.load(${J(TREES)}, ['NN-0', 'S3-0']); changeSelectedTypes('note');
            out.alreadyFine = [__n.type('NN'), __n.type('S3')];
            return out;`);
        ok(r.underNote && r.underNote.same && r.underNote.undo === 0 && J(r.underNote.sel) === J(['NN-0']) && r.underNote.hint === HINT,
            "a note's child cannot become a support, objection or rebuttal, weak or not; nothing changes and the hint says why", J(r.underNote));
        ok(r.keys && r.keys.same && r.keys.undo === 0, 'nor by S, O, R or W', J(r.keys));
        ok(r.main && r.main.type === 'contention' && r.main.parent === 'root', 'Main still lifts it out into a tree of its own', J(r.main));
        ok(r.holdsArgument && r.holdsArgument.same && r.holdsArgument.undo === 0, 'a box holding an objection cannot become a note (the Note button or N)', J(r.holdsArgument));
        ok(r.holdsNotes === 'note' && r.leaf === 'note', 'a box holding only notes, or nothing, can', J([r.holdsNotes, r.leaf]));
        ok(r.noteToAttack && r.noteToAttack[0] === 'objection' && J(r.noteToAttack[1]) === J(['note']), 'a note under a support can become an argument box, keeping its notes', J(r.noteToAttack));
        ok(r.mixed && r.mixed.NN === 'note' && r.mixed.S2 === 'objection' && J(r.mixed.sel) === J(['NN-0', 'S2-0']) && r.mixed.undo === 1,
            'with a mixed selection the boxes that can change do, the rest stay, and both stay selected', J(r.mixed));
        ok(J(r.subtreeToNote) === J(['note', 'note', 'note']), 'a box and everything under it, selected together, all become notes', J(r.subtreeToNote));
        ok(J(r.partialSubtree) === J(['support', 'objection', 'rebuttal']),
            'but not while an argument box under them stays unselected: R4 blocks O4, and O4 then blocks S4', J(r.partialSubtree));
        ok(J(r.noteAndChild) === J(['support', 'support']), 'a note and its child, selected together, both become supports', J(r.noteAndChild));
        ok(J(r.alreadyFine) === J(['note', 'note']), 'retyping to note what is already a note is harmless', J(r.alreadyFine));
    }

    /* ---------------- 3. toolbar and context menu ---------------- */
    console.log('\n-- toolbar and context menu --');
    {
        const ADD = ['btn-add-sup', 'btn-add-obj', 'btn-add-weak', 'btn-add-not', 'btn-add-co'];
        const TYPE = ['btn-type-sup', 'btn-type-obj', 'btn-type-weak', 'btn-type-note', 'btn-main'];
        const b = T(W, `var out = {};
            function read(sel) { __n.load(${J(TREES)}, sel); return __n.disabled(${J(ADD.concat(TYPE))}); }
            out.NT = read(['NT-0']); out.NN = read(['NN-0']); out.S4 = read(['S4-0']); out.M = read(['M-0']); out.S2 = read(['S2-0']);
            out.NN_S2 = read(['NN-0', 'S2-0']); out.NT_NN = read(['NT-0', 'NN-0']); out.S4_O4_R4 = read(['S4-0', 'O4-0', 'R4-0']); out.S4_M = read(['S4-0', 'M-0']);
            return out;`);
        const off = (k, ids) => ids.every(id => b[k] && b[k][id] === true);
        const on = (k, ids) => ids.every(id => b[k] && b[k][id] === false);
        ok(off('NT', ['btn-add-sup', 'btn-add-obj', 'btn-add-weak']) && on('NT', ['btn-add-not', 'btn-add-co']),
            'a note selected: Add Support, Objection and Weak Objection gray out; Add Note and Add Co-Premise stay', J(b.NT));
        ok(on('NT', ['btn-type-sup', 'btn-type-obj', 'btn-type-weak', 'btn-type-note', 'btn-main']),
            'it hangs from a support and holds only a note, so every Change Type stays', J(b.NT));
        ok(off('NN', ['btn-type-sup', 'btn-type-obj', 'btn-type-weak']) && on('NN', ['btn-type-note', 'btn-main']),
            "a note's child: Support, Objection and Weak gray out; Note and Main stay", J(b.NN));
        ok(off('S4', ['btn-type-note']) && on('S4', ['btn-type-sup', 'btn-type-obj', 'btn-type-weak', 'btn-main', 'btn-add-sup', 'btn-add-not']),
            'a box holding an objection: only Note grays out', J(b.S4));
        ok(off('M', ['btn-type-note']), 'the contention holds supports, so Note is gray for it too', J(b.M));
        ok(on('S2', ADD.concat(TYPE)), 'a plain leaf support: everything available', J(b.S2));
        ok(on('NN_S2', ['btn-type-sup', 'btn-type-obj', 'btn-type-weak']) && on('NT_NN', ['btn-type-sup']) && on('S4_O4_R4', ['btn-type-note']),
            'a selection where some box can take the type keeps it available -- including boxes that change together', J([b.NN_S2, b.NT_NN, b.S4_O4_R4]));
        ok(off('S4_M', ['btn-type-note']), 'and grays it when not one can', J(b.S4_M));

        const m = T(W, `var out = {};
            function read(id, sel) {
                __n.load(${J(TREES)}, sel); showContextMenu(10, 10, id, 0);
                var menu = document.getElementById('context-menu');
                var items = {}; Array.prototype.slice.call(menu.querySelectorAll('.ctx-item')).forEach(function (el) {
                    items[el.textContent.replace(/(Enter|Shift\\+Enter|Ctrl\\+Enter|Alt\\+Enter|Tab)$/, '').trim()] = el.disabled; });
                var chips = {}; Array.prototype.slice.call(menu.querySelectorAll('.ctx-types button')).forEach(function (el) { chips[el.textContent.trim()] = el.disabled; });
                hideContextMenu();
                return { items: items, chips: chips };
            }
            out.NT = read('NT'); out.NN = read('NN'); out.S4 = read('S4'); out.S2 = read('S2'); out.NNsel = read('NN', ['NN-0', 'S2-0']);
            return out;`);
        const it = (k, name) => ((m[k] || {}).items || {})[name];
        const ch = (k, name) => ((m[k] || {}).chips || {})[name];
        ok(it('NT', 'Support') === true && it('NT', 'Objection') === true && it('NT', 'Weak Objection') === true && it('NT', 'Note') === false && it('NT', 'Add Co-Premise') === false,
            'right-click a note: Add Child Support, Objection and Weak Objection are grayed; Note and Add Co-Premise are not', J(m.NT && m.NT.items));
        ok(ch('NN', 'Sup') === true && ch('NN', 'Obj') === true && ch('NN', 'Weak Obj') === true && ch('NN', 'Note') === false && ch('NN', 'Main') === false,
            "right-click a note's child: the Sup, Obj and Weak Obj chips are grayed; Note and Main are not", J(m.NN && m.NN.chips));
        ok(ch('S4', 'Note') === true && ch('S4', 'Sup') === false && it('S4', 'Support') === false,
            'right-click a box holding an objection: the Note chip is grayed', J(m.S4));
        ok(Object.values((m.S2 || {}).chips || {}).every(v => v === false) && ['Support', 'Objection', 'Weak Objection', 'Note'].every(n => it('S2', n) === false),
            'right-click a plain support: nothing grayed', J(m.S2));
        ok(ch('NNsel', 'Sup') === false, 'the chips judge the selection they act on, like the toolbar', J(m.NNsel && m.NNsel.chips));
        const CSS = HTML.slice(0, HTML.indexOf('</style>'));
        ok(/#context-menu \.ctx-row button:disabled\s*\{\s*opacity:\s*0\.35;\s*cursor:\s*not-allowed/.test(CSS), 'a grayed chip looks unavailable');
    }

    /* ---------------- 4. drops ---------------- */
    console.log('\n-- drops --');
    {
        const c = T(W, `var out = {};
            var T = function (o) { return Object.assign({ el: null, id: 'T', idx: 0, left: 0, top: 0, w: 180, h: 60, parentId: 'P', parentType: 'support', groupTextsLen: 1, nodeType: 'support' }, o); };
            var below = { left: 40, top: 70, w: 50, h: 40 }, inside = { left: 65, top: 10, w: 50, h: 40 }, beside = { left: 170, top: 10, w: 50, h: 40 };
            var run = function (G, targets, o) { var r = classifyDrop(G, targets, Object.assign({ mode: 'group', draggedParentId: 'M' }, o || {})); return r.type; };
            out.childArg = run(below, [T({ nodeType: 'note' })]);
            out.childNote = run(below, [T({ nodeType: 'note' })], { notesOnly: true });
            out.coArg = run(inside, [T({ nodeType: 'note' })]);
            out.coNote = run(inside, [T({ nodeType: 'note' })], { notesOnly: true });
            out.besideArg = run(beside, [T({ nodeType: 'note', parentType: 'note' })]);
            out.besideNote = run(beside, [T({ nodeType: 'note', parentType: 'note' })], { notesOnly: true });
            out.besideNoteUnderSupport = run(beside, [T({ nodeType: 'note', parentType: 'support' })]);
            out.childSupport = run(below, [T({})]);
            out.empty = run({ left: 900, top: 900, w: 50, h: 40 }, [T({ nodeType: 'note' })]);
            out.shift = run(below, [T({ nodeType: 'note' })], { shift: true });
            out.validWins = run(below, [T({ id: 'A', nodeType: 'note' }), T({ id: 'B', left: 30 })]);
            return out;`);
        ok(c.childArg === 'refused' && c.coArg === 'refused' && c.besideArg === 'refused',
            'an argument box aimed below a note, into it, or beside a box under one is refused', J(c));
        ok(c.childNote === 'child' && c.coNote === 'copremise' && c.besideNote === 'insert-sibling', 'a note aimed the same ways lands', J(c));
        ok(c.besideNoteUnderSupport === 'insert-sibling' && c.childSupport === 'child', 'beside a note under a support, or below a support, anything lands', J(c));
        ok(c.empty === 'detach' && c.shift === 'detach', 'empty space is still a detach, and Shift still drops free anywhere', J([c.empty, c.shift]));
        ok(c.validWins === 'child', 'when the drop also meets a box that can take it, that box takes it', J(c.validWins));

        const d = T(W, `var out = {};
            var geo = { NT: { left: 0, top: 0 }, NN: { left: 0, top: 200 }, S3: { left: 400, top: 0 } };
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
            var drop = function (ids, G, shift) {
                selectedIds = ids.map(function (id) { return id + '-0'; });
                var node = findNodeContext(state.trees, ids[0]).node;
                var ghost = document.querySelector('.node[data-node-id="' + ids[0] + '"][data-node-idx="0"]');
                var e0 = { clientX: 0, clientY: 0, screenX: 0, screenY: 0 };
                if (ids.length > 1) startSelectedForestDrag(e0, node, 0, ghost, 'group', null, buildSelectedDragForest());
                else startDrag(e0, node, 0, ghost, 'group');
                var notesOnly = dragCtx.notesOnly;
                dragCtx.targets = targetsFor();
                ghostRectFor = function () { return G; }; probeRectFor = function () { return G; };
                try { executeDrop({ shiftKey: !!shift, altKey: false, clientX: 400, clientY: 400, screenX: 400, screenY: 400 }); }
                finally { ghostRectFor = realGhost; probeRectFor = realProbe; }
                return notesOnly;
            };
            var belowNT = { left: 40, top: 70, w: 50, h: 40 }, intoNT = { left: 65, top: 10, w: 50, h: 40 }, besideNN = { left: 170, top: 210, w: 50, h: 40 }, belowS3 = { left: 440, top: 70, w: 50, h: 40 };

            __n.load(${J(TREES)}); __n.resetHint(); var before = __n.trees();
            out.flagSupport = drop(['S2'], belowNT);
            out.child = { same: __n.trees() === before, undo: undoStack.length, dragging: !!dragCtx, hint: __n.hint() };
            drop(['S2'], intoNT); drop(['S2'], besideNN); drop(['S4'], belowNT);
            out.others = { same: __n.trees() === before, undo: undoStack.length };
            out.flagNote = drop(['FN'], belowNT);
            out.noteLands = { parent: __n.parentOf('FN'), undo: undoStack.length };
            __n.load(${J(TREES)}); drop(['S2'], belowS3); out.supportLands = __n.parentOf('S2');
            __n.load(${J(TREES)}); drop(['S2'], belowNT, true); out.shiftFree = __n.parentOf('S2');

            __n.load(${J(TREES)}); before = __n.trees();
            out.flagMixed = drop(['S2', 'S5'], belowNT);
            out.forest = { same: __n.trees() === before, undo: undoStack.length, dragging: !!dragCtx };
            __n.load(${J(TREES)});
            out.flagNotes = drop(['FN', 'FM'], belowNT);
            out.notesForest = [__n.parentOf('FN'), __n.parentOf('FM')];
            return out;`);
        ok(d.flagSupport === false && d.flagNote === true && d.flagMixed === false && d.flagNotes === true,
            'a drag knows whether it carries only notes, alone or as a multi-selection', J([d.flagSupport, d.flagNote, d.flagMixed, d.flagNotes]));
        ok(d.child && d.child.same && d.child.undo === 0 && d.child.dragging === false,
            'dropping a support below a note: nothing moves, no undo step, the drag ends', J(d.child));
        ok(d.child && d.child.hint === HINT, 'and the hint says why', J(d.child && d.child.hint));
        ok(d.others && d.others.same && d.others.undo === 0,
            'the same into a note, beside a note under a note, and for a support carrying an objection', J(d.others));
        ok(d.noteLands && d.noteLands.parent === 'NT' && d.noteLands.undo === 1, 'a separate note dropped below a note becomes its child', J(d.noteLands));
        ok(d.supportLands === 'S3', 'a support dropped below a support still lands', J(d.supportLands));
        ok(d.shiftFree === 'root', 'Shift over a note drops the support free, as over empty space', J(d.shiftFree));
        ok(d.forest && d.forest.same && d.forest.undo === 0 && d.forest.dragging === false, 'two supports dragged together onto a note are refused too', J(d.forest));
        ok(J(d.notesForest) === J(['NT', 'NT']), 'two notes dragged together land under it', J(d.notesForest));
    }

    /* ---------------- 5. paste ---------------- */
    console.log('\n-- paste --');
    {
        const p = T(W, `var out = {};
            __n.load(${J(TREES)}, ['S2-0']); copyNode(); selectedIds = ['NT-0']; __n.resetHint(); var before = __n.trees();
            pasteNode(); out.sup = { same: __n.trees() === before, undo: undoStack.length, hint: __n.hint() };
            selectedIds = ['NT-0']; pasteAsCoPremise(); out.supCo = { same: __n.trees() === before, undo: undoStack.length };
            selectedIds = ['S3-0']; pasteNode(); out.supOnSupport = __n.kids('S3');

            __n.load(${J(TREES)}, ['FN-0']); copyNode();
            selectedIds = ['NT-0']; pasteNode(); out.note = __n.kids('NT');
            selectedIds = ['NT-0']; pasteAsCoPremise(); out.noteCo = __n.node('NT').texts.length;

            __n.load(${J(TREES)}, ['LN-0']); copyNode(); selectedIds = ['NT-0']; before = __n.trees();
            pasteAsCoPremise(); out.legacyCo = { same: __n.trees() === before, undo: undoStack.length };

            __n.load(${J(TREES)}, ['S2-0', 'FN-0']); copyNode(); selectedIds = ['NN-0']; before = __n.trees();
            pasteNode(); out.mixed = { same: __n.trees() === before, undo: undoStack.length };
            return out;`);
        ok(p.sup && p.sup.same && p.sup.undo === 0 && p.sup.hint === HINT, 'pasting a support onto a note is refused, with the hint', J(p.sup));
        ok(p.supCo && p.supCo.same && p.supCo.undo === 0, 'and pasting it into the note as a co-premise', J(p.supCo));
        ok(J(p.supOnSupport) === J(['support']), 'a support still pastes onto a support', J(p.supOnSupport));
        ok(J(p.note) === J(['note', 'note']) && p.noteCo === 2, 'a note pastes onto a note, and into one as a co-premise', J([p.note, p.noteCo]));
        ok(p.legacyCo && p.legacyCo.same && p.legacyCo.undo === 0, 'a note carrying a support cannot join a note as its co-premise: the support would come under it', J(p.legacyCo));
        ok(p.mixed && p.mixed.same && p.mixed.undo === 0, 'a clipboard holding a support and a note pastes onto a note not at all', J(p.mixed));
    }

    /* ---------------- 6. untyped boxes ---------------- */
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
            __n.load(${J(TREES)}, []);
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

    /* ---------------- 7. Help ---------------- */
    console.log('\n-- Help --');
    {
        const h = T(W, `return document.getElementById('help-panel').innerHTML;`);
        ok(/A <strong>note<\/strong> can hang from any box, but holds only other notes/.test(h || ''), 'Help says a note holds only notes');
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
