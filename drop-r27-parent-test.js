'use strict';
// r27 Top-down drops: a box dropped above another becomes its parent.
//
// A drop below a box has always made the dropped box its child; a drop beside
// it, a co-premise or sibling. Now the mirror of the child drop builds upward:
// dropped just above a box (or over its top half), the dragged box takes that
// box's place -- in its parent's row, on the same premise box -- and the box,
// with everything under it, hangs from the dragged one. Above the top of a
// tree, the dragged box tops that tree where it stood; above a main
// contention it becomes the main contention, and the old one a support. The
// target shows a bar along its TOP edge (.drop-parent), as a child drop shows
// one along the bottom. Between a box and the one under it, the nearer edge
// wins. A multi-selection has no one box to be the parent, a co-premise group
// cannot top a main contention, and notes stand alone.
//
// Covers:
//   (1) classification: above, over the top half, too high, the nearer edge,
//       multi-selections, co-premise groups over a contention, notes;
//   (2) executed drops: into a row, over a tree's top, over a main
//       contention, a sibling, a box on a co-premise, a whole group, Alt,
//       a contention dragged in, one box out of a group, a group on top,
//       notes; undo;
//   (3) the highlight, and Help.
//
// Run:  node drop-r27-parent-test.js [argument-mapper-r27.html]
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
// │  └─ O1 objection
// ├─ S2 support
// └─ G  support with co-premises Ga, Gb
//    └─ GB objection on Gb
// X  a support of its own, pinned, holding XC
// C  a second main contention
// FO an objection of its own, pinned
// FN a note
const TREES = [
    N('M', 'contention', [
        N('S1', 'support', [ N('O1', 'objection') ]),
        N('S2', 'support'),
        N('G', 'support', [ N('GB', 'objection', [], { targetIndex: 1 }) ], { texts: ['Ga', 'Gb'] })
    ], { x: 30000, y: 30000 }),
    N('X', 'support', [ N('XC', 'support') ], { x: 29000, y: 30700, freePosition: true }),
    N('C', 'contention', [], { x: 32000, y: 30000 }),
    N('FO', 'objection', [], { x: 28000, y: 31000, freePosition: true }),
    N('FN', 'note', [], { x: 28500, y: 30400, freePosition: true })
];

const HELPERS = `
    window.__d = {
        load(trees, sel) {
            if (typeof dragCtx !== 'undefined' && dragCtx) endDrag();
            state.trees = JSON.parse(JSON.stringify(trees));
            ensureCollabFields(state);
            selectedIds = sel ? sel.slice() : [];
            undoStack = []; redoStack = []; _shadowSnapshot = JSON.stringify(state);
            render();
        },
        node(id) { var c = findNodeContext(state.trees, id); return c ? c.node : null; },
        parentOf(id) { var c = findNodeContext(state.trees, id); return c ? (c.parent ? c.parent.id : 'root') : null; },
        kids(id) { var n = this.node(id); return n ? n.children.map(function (c) { return c.id; }) : null; },
        trees() { return JSON.stringify(state.trees); },
        // Drag one unit and drop it with the probe at G, onto the targets
        // listed (each given fake geometry; jsdom lays nothing out).
        drop(id, idx, mode, G, targets, opts) {
            opts = opts || {};
            var node = findNodeContext(state.trees, id).node;
            var ghost = document.querySelector('.node[data-node-id="' + id + '"][data-node-idx="' + (idx || 0) + '"]');
            var e0 = { clientX: 0, clientY: 0, screenX: 0, screenY: 0 };
            startDrag(e0, node, idx || 0, ghost, mode || 'group', opts.idxs);
            dragCtx.targets = targets.map(function (t) {
                var ctx = findNodeContext(state.trees, t.id);
                return { el: document.querySelector('.node[data-node-id="' + t.id + '"][data-node-idx="' + (t.idx || 0) + '"]'), id: t.id, idx: t.idx || 0,
                         left: t.left, top: t.top, w: 180, h: 60,
                         parentId: ctx.parent ? ctx.parent.id : null, parentType: ctx.parent ? ctx.parent.type : null,
                         groupTextsLen: ctx.node.texts.length, nodeType: ctx.node.type };
            });
            var realGhost = ghostRectFor, realProbe = probeRectFor;
            ghostRectFor = function () { return G; }; probeRectFor = function () { return G; };
            try {
                if (opts.previewOnly) { previewDrop({ shiftKey: false, clientX: 400, clientY: 400, screenX: 400, screenY: 400 }); return dragCtx; }
                executeDrop({ shiftKey: !!opts.shift, altKey: !!opts.alt, clientX: 400, clientY: 400, screenX: 400, screenY: 400 });
            } finally { ghostRectFor = realGhost; probeRectFor = realProbe; }
        }
    };
`;
const T = (W, body) => {
    try { return JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`)); }
    catch (e) { return { __error: String((e && e.message) || e) }; }
};
const J = JSON.stringify;
const TR = J(TREES);
// A target at (0, 200); the probe just above it.
const TGT = { left: 0, top: 200 };
const ABOVE = { left: 40, top: 200 - 60, w: 50, h: 40 };

(async () => {
    console.log('=== r27 top-down drops: dropped above a box, the box becomes its parent ===');
    const W = makeWin('parentdrop');
    await sleep(250);
    W.win.eval(HELPERS);

    /* ---------------- 1. classification ---------------- */
    console.log('\n-- classification --');
    {
        const c = T(W, `var out = {};
            var T = function (o) { return Object.assign({ el: null, id: 'T', idx: 0, left: 0, top: 200, w: 180, h: 60, parentId: 'P', parentType: 'support', groupTextsLen: 1, nodeType: 'support' }, o || {}); };
            var run = function (G, targets, o) { return classifyDrop(G, targets, Object.assign({ mode: 'group', draggedParentId: 'Q' }, o || {})).type; };
            out.above = run({ left: 40, top: 140, w: 50, h: 40 }, [T()]);
            out.topHalf = run({ left: 40, top: 180, w: 50, h: 40 }, [T()]);
            out.center = run({ left: 65, top: 210, w: 50, h: 40 }, [T()]);
            out.below = run({ left: 40, top: 270, w: 50, h: 40 }, [T()]);
            out.tooHigh = run({ left: 40, top: 100, w: 50, h: 40 }, [T()]);
            out.sliver = run({ left: 170, top: 140, w: 50, h: 40 }, [T()]);
            out.forest = run({ left: 40, top: 140, w: 50, h: 40 }, [T()], { mode: 'forest' });
            out.groupOverMain = run({ left: 40, top: 140, w: 50, h: 40 }, [T({ nodeType: 'contention', parentId: null, parentType: null })], { multiBox: true });
            out.groupOverBox = run({ left: 40, top: 140, w: 50, h: 40 }, [T()], { multiBox: true });
            out.boxOverMain = run({ left: 40, top: 140, w: 50, h: 40 }, [T({ nodeType: 'contention', parentId: null, parentType: null })]);
            out.overNote = run({ left: 40, top: 140, w: 50, h: 40 }, [T({ nodeType: 'note' })]);
            out.carriesNote = run({ left: 40, top: 140, w: 50, h: 40 }, [T()], { carriesNote: true });
            // P above T, 80px apart: the nearer edge wins.
            var P = T({ id: 'P', top: 60, parentId: null, parentType: null });
            out.nearP = classifyDrop({ left: 40, top: 135, w: 50, h: 40 }, [P, T()], { mode: 'group' });
            out.nearT = classifyDrop({ left: 40, top: 145, w: 50, h: 40 }, [P, T()], { mode: 'group' });
            out.nearP = out.nearP.type + ':' + (out.nearP.T && out.nearP.T.id);
            out.nearT = out.nearT.type + ':' + (out.nearT.T && out.nearT.T.id);
            return out;`);
        ok(c.above === 'parent' && c.topHalf === 'parent', 'a probe just above a box, or over its top half, is a parent drop', J(c));
        ok(c.center === 'copremise' && c.below === 'child', 'the center is still a co-premise drop, and below still a child drop', J(c));
        ok(c.tooHigh === 'detach', 'more than the 30px halo above the box, it is a drop into empty space', J(c.tooHigh));
        ok(c.sliver === 'detach', 'a probe barely overlapping the box sideways is not a parent drop', J(c.sliver));
        ok(c.forest === 'detach', 'a multi-selection is never a parent: there is no one box to be it', J(c.forest));
        ok(c.groupOverMain === 'detach' && c.groupOverBox === 'parent' && c.boxOverMain === 'parent',
            'a co-premise group cannot top a main contention (it would have to become one), but can top any other box; one box can top a contention', J(c));
        ok(c.overNote === 'refused' && c.carriesNote === 'detach', 'notes stand alone: nothing tops a note, and a note tops nothing', J(c));
        ok(c.nearP === 'child:P' && c.nearT === 'parent:T', 'between a box and the box under it, the nearer edge wins: child of the upper, parent of the lower', J(c));
    }

    /* ---------------- 2. executed drops ---------------- */
    console.log('\n-- executed drops --');
    {
        const r = T(W, `var out = {};
            var above = ${J(ABOVE)}, tgt = ${J(TGT)};
            var at = function (id, idx) { return Object.assign({ id: id, idx: idx || 0 }, tgt); };

            __d.load(${TR}); var original = __d.trees();
            __d.drop('X', 0, 'group', above, [at('S1')]);
            var x = __d.node('X');
            out.row = { M: __d.kids('M'), X: __d.kids('X').slice().sort(), S1: __d.kids('S1'), parentX: __d.parentOf('X'),
                        coords: [x.x, x.y, x.freePosition], sel: selectedIds.slice(), undo: undoStack.length, trees: state.trees.map(function (t) { return t.id; }) };
            undo();
            out.undo = __d.trees() === original;

            __d.load(${TR}); __d.drop('X', 0, 'group', above, [at('M')]);
            var xm = state.trees[0], m = __d.node('M');
            out.overMain = { first: xm.id, type: xm.type, coords: [xm.x, xm.y, xm.freePosition], Mtype: m.type, Mparent: __d.parentOf('M'), Mcoords: [m.x, m.y],
                             kids: xm.children.map(function (k) { return k.id; }).sort() };

            __d.load(${TR}); var foAt = state.trees.findIndex(function (t) { return t.id === 'FO'; });
            __d.drop('X', 0, 'group', above, [at('FO')]);
            var xf = __d.node('X');
            out.overTree = { order: state.trees.map(function (t) { return t.id; }), coords: [xf.x, xf.y, xf.freePosition],
                             FO: __d.parentOf('FO'), FOtype: __d.node('FO').type, FOx: __d.node('FO').x };

            __d.load(${TR}); __d.drop('S2', 0, 'group', above, [at('S1')]);
            out.sibling = { M: __d.kids('M'), S2: __d.kids('S2'), S1: __d.parentOf('S1') };

            __d.load(${TR}); __d.drop('X', 0, 'group', above, [at('GB')]);
            out.onBox = { parent: __d.parentOf('X'), target: __d.node('X').targetIndex, GB: __d.parentOf('GB'), GBtarget: __d.node('GB').targetIndex, G: __d.kids('G') };

            __d.load(${TR}); __d.drop('X', 0, 'group', above, [at('G', 0)]);
            out.overGroup = { parent: __d.parentOf('X'), G: __d.parentOf('G'), texts: __d.node('G').texts, M: __d.kids('M') };

            __d.load(${TR}); __d.drop('X', 0, 'group', above, [at('S1')], { alt: true });
            out.alt = { X: __d.kids('X'), XC: __d.parentOf('XC') };

            __d.load(${TR}); __d.drop('C', 0, 'group', above, [at('S2')]);
            var cn = __d.node('C');
            out.contentionIn = { type: cn.type, parent: __d.parentOf('C'), coords: [cn.x, cn.y], S2: __d.parentOf('S2') };

            __d.load(${TR}); __d.drop('G', 1, 'text', above, [at('S1')]);
            var piece = __d.node('M').children[0];
            out.oneBox = { texts: piece.texts, kids: piece.children.map(function (k) { return k.id; }).sort(), G: __d.node('G').texts, Gkids: __d.kids('G') };

            __d.load(${TR}); __d.drop('G', 1, 'group', above, [at('S2')]);
            out.groupOnTop = { parent: __d.parentOf('G'), S2: __d.parentOf('S2'), S2target: __d.node('S2').targetIndex };

            __d.load(${TR}); var beforeFN = __d.trees();
            __d.drop('FN', 0, 'group', above, [at('S1')]);
            out.noteMoves = { parent: __d.parentOf('FN'), S1: __d.parentOf('S1'), M: __d.kids('M') };
            __d.load(${TR}); var before = __d.trees();
            __d.drop('X', 0, 'group', above, [at('FN')]);
            out.overNote = { same: __d.trees() === before, undo: undoStack.length };
            return out;`);
        const row = r.row || {};
        ok(J(row.M) === J(['X', 'S2', 'G']) && row.parentX === 'M', 'dropped above S1, X takes its place in the main row', J(row));
        ok(J(row.X) === J(['S1', 'XC']) && J(row.S1) === J(['O1']), 'and S1 hangs from X, bringing its own objection; X keeps its child', J(row));
        ok(row.coords && row.coords.every(v => v == null) && J(row.trees) === J(['M', 'C', 'FO', 'FN']),
            'X is no longer a tree of its own: its pinned position is gone', J(row));
        ok(J(row.sel) === J(['X-0']) && row.undo === 1 && r.undo === true, 'X is selected; one undo step puts everything back exactly', J([row.sel, row.undo, r.undo]));

        const om = r.overMain || {};
        ok(om.first === 'X' && om.type === 'contention' && om.coords && om.coords[0] === 30000 && om.coords[1] === 30000 && !om.coords[2],
            'dropped above the main contention, X becomes the main contention, where M stood, laid out rather than pinned', J(om));
        ok(om.Mtype === 'support' && om.Mparent === 'X' && om.Mcoords && om.Mcoords.every(v => v == null) && J(om.kids) === J(['M', 'XC']),
            'and M becomes a support under it', J(om));
        const ot = r.overTree || {};
        ok(J(ot.order) === J(['M', 'C', 'X', 'FN']) && ot.coords && ot.coords[0] === 28000 && ot.coords[1] === 31000 && ot.coords[2] === true && ot.FO === 'X' && ot.FOtype === 'objection' && ot.FOx == null,
            'above a separate, pinned tree, X tops it in the same place among the trees, pinned where it stood', J(ot));
        ok(r.sibling && J(r.sibling.M) === J(['S2', 'G']) && J(r.sibling.S2) === J(['S1']) && r.sibling.S1 === 'S2',
            'a box dropped above its sibling takes the sibling\'s slot, and the sibling hangs from it', J(r.sibling));
        ok(r.onBox && r.onBox.parent === 'G' && r.onBox.target === 1 && r.onBox.GB === 'X' && r.onBox.GBtarget === undefined && J(r.onBox.G) === J(['X']),
            'above a box hanging from a co-premise, X hangs from that same co-premise', J(r.onBox));
        ok(r.overGroup && r.overGroup.parent === 'M' && r.overGroup.G === 'X' && J(r.overGroup.texts) === J(['Ga', 'Gb']) && J(r.overGroup.M) === J(['S1', 'S2', 'X']),
            'above a co-premise group, the whole group hangs from X', J(r.overGroup));
        ok(r.alt && J(r.alt.X) === J(['S1']) && r.alt.XC === 'root', 'with Alt, X travels alone: its own child stays behind', J(r.alt));
        ok(r.contentionIn && r.contentionIn.type === 'support' && r.contentionIn.parent === 'M' && r.contentionIn.coords.every(v => v == null) && r.contentionIn.S2 === 'C',
            'a second main contention dropped above a box becomes a support in its place', J(r.contentionIn));
        ok(r.oneBox && J(r.oneBox.texts) === J(['Gb']) && J(r.oneBox.kids) === J(['GB', 'S1']) && J(r.oneBox.G) === J(['Ga']) && J(r.oneBox.Gkids) === J([]),
            'one co-premise dragged out of its group and above S1 takes S1\'s place, with its own objection, and S1 hangs from it', J(r.oneBox));
        ok(r.groupOnTop && r.groupOnTop.parent === 'M' && r.groupOnTop.S2 === 'G' && r.groupOnTop.S2target === 1,
            'a whole group dropped above a box: the box hangs from the co-premise that was grabbed', J(r.groupOnTop));
        ok(r.noteMoves && r.noteMoves.parent === 'root' && r.noteMoves.S1 === 'M' && J(r.noteMoves.M) === J(['S1', 'S2', 'G']),
            'a note dropped above a box connects to nothing: it just moves', J(r.noteMoves));
        ok(r.overNote && r.overNote.same && r.overNote.undo === 0, 'and a box dropped above a note is refused', J(r.overNote));
    }

    /* ---------------- 3. highlight and Help ---------------- */
    console.log('\n-- highlight and Help --');
    {
        const h = T(W, `__d.load(${TR});
            __d.drop('X', 0, 'group', ${J(ABOVE)}, [Object.assign({ id: 'S1' }, ${J(TGT)})], { previewOnly: true });
            var el = document.querySelector('.node[data-node-id="S1"][data-node-idx="0"]');
            var lit = el.classList.contains('drop-parent'), child = el.classList.contains('drop-child');
            clearDropHighlight(); var cleared = !el.classList.contains('drop-parent');
            endDrag();
            return { lit: lit, child: child, cleared: cleared, help: document.getElementById('help-panel').innerHTML };`);
        const CSS = HTML.slice(0, HTML.indexOf('</style>'));
        ok(h.lit === true && h.child === false && h.cleared === true, 'hovering above a box lights it as a parent drop, and the light clears', J([h.lit, h.child, h.cleared]));
        ok(/\.drop-parent\s*\{\s*box-shadow:\s*inset 0 6px 0 var\(--color-selected\) !important/.test(CSS) &&
           /\.drop-child\s*\{\s*box-shadow:\s*inset 0 -6px 0 var\(--color-selected\) !important/.test(CSS),
            'the light is a bar along the top edge, mirroring the child drop\'s bar along the bottom');
        ok(/Above-drop = parent/.test(h.help || ''), 'Help lists the above-drop');
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
