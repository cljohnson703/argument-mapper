'use strict';
// r27.243 Branches above: the map turned over, each viewer's own way.
//
// The user: "I'd like to be able to invert the tree as well. Some prefer to
// have the branches at the top rather than the bottom." Of which: above only,
// for now; of whose setting: each viewer's own; of the control: "Branches:
// Below / Above", "only so long as it doesn't require extra length in the
// panel" -- so a small picture of the tree after Theme, its name in its tip.
//
// Covers:
//   (1) the button: below by default; turned, it says so, the body says so,
//       and this browser keeps it; a new page opens as it was left;
//   (2) the layout: each tree mirrored about its root, which stays where it
//       stands; what answers a box stands above it; the lines worked out in
//       the map's own terms and drawn in a group that turns them over, the
//       arrow ending on the parent's top; their styles reach them there;
//   (3) the Depth view's rows, mirrored about the first;
//   (4) the step tags under a group, a verdict under its box, a theorem's tag
//       on the top edge, a crowded tag stepping away from the boxes;
//   (5) the + buttons: what is added goes above, a parent below;
//   (6) the keys: up goes to a reason, down to what it supports; Alt+Down
//       adds a parent, as Alt+Up does with branches below; the words that
//       name the key and where the parent goes;
//   (7) a drop above a box makes the dropped box its child, below its parent;
//       the bar on the edge it is dropped at;
//   (8) a dragged branch's lines, copied in their turn, alone and in a
//       selection.
//
// Run:  node orientation-r27-branches-test.js [argument-mapper-r27.html]
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

function makeWin(label, stored) {
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
        if (stored) try { win.localStorage.setItem('argmap-branches', stored); } catch (_) {}
        // Boxes 180 wide and 60 tall, two in a group 10 apart, where the
        // layout puts them: jsdom lays nothing out.
        const W = 180, H = 60, GAP = 10;
        const rect = (l, t, w, h) => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h, x: l, y: t, toJSON() { return this; } });
        win.Element.prototype.getBoundingClientRect = function () {
            if (this.id === 'surface' || this.id === 'lines-svg') return rect(0, 0, 60000, 60000);
            if (this.id === 'canvas') return win.__canvasRect ? rect.apply(null, win.__canvasRect) : rect(29000, 29000, 4000, 4000);
            if (this.classList && this.classList.contains('node-group')) {
                const n = this.querySelectorAll('.node').length || 1;
                return rect(parseFloat(this.style.left) || 0, parseFloat(this.style.top) || 0, n * W + (n - 1) * GAP, H);
            }
            if (this.classList && this.classList.contains('node')) {
                const g = this.closest('.node-group');
                const gr = g ? g.getBoundingClientRect() : rect(0, 0, 0, 0);
                const i = g ? Array.prototype.indexOf.call(g.querySelectorAll('.node'), this) : 0;
                return rect(gr.left + i * (W + GAP), gr.top, W, H);
            }
            return rect(0, 0, 0, 0);
        };
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}

const N = (id, type, children, extra) => Object.assign({ id, type, texts: [id], collapsed: [], children: children || [] }, extra || {});
// M  main contention
// ├─ S1 support
// │  └─ O1 objection
// └─ G  support with co-premises Ga, Gb
const TREES = [
    N('M', 'contention', [
        N('S1', 'support', [ N('O1', 'objection') ]),
        N('G', 'support', [], { texts: ['Ga', 'Gb'] })
    ], { x: 30000, y: 30000 })
];

const HELPERS = `
    window.__o = {
        load(trees, sel) {
            if (typeof dragCtx !== 'undefined' && dragCtx) endDrag();
            zoomLevel = 1;
            state.trees = JSON.parse(JSON.stringify(trees));
            ensureCollabFields(state);
            selectedIds = sel ? sel.slice() : [];
            undoStack = []; redoStack = []; _shadowSnapshot = JSON.stringify(state);
            render();
        },
        set(above) { if (branchesAbove !== above) toggleBranches(); },
        pos(id) { var g = document.getElementById('group-' + id); return g ? { left: parseFloat(g.style.left), top: parseFloat(g.style.top) } : null; },
        parentOf(id) { var c = findNodeContext(state.trees, id); return c ? (c.parent ? c.parent.id : 'root') : null; },
        key(code, alt) { document.dispatchEvent(new KeyboardEvent('keydown', { code: code, key: code, altKey: !!alt, bubbles: true, cancelable: true })); }
    };
`;
const T = (W, body) => {
    try { return JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`)); }
    catch (e) { return { __error: String((e && e.message) || e) }; }
};
const J = JSON.stringify;
const TR = J(TREES);
// The last point a path's d names.
const lastPoint = d => { const n = String(d).match(/-?\d+(?:\.\d+)?/g).map(Number); return { x: n[n.length - 2], y: n[n.length - 1] }; };

(async () => {
    console.log('=== r27.243 branches above: the map turned over ===');
    const W = makeWin('branches');
    await sleep(250);
    W.win.eval(HELPERS);

    /* ---------------- 1. the button ---------------- */
    console.log('\n-- the button --');
    const before = T(W, `__o.load(${TR});
        var b = document.getElementById('branches-btn');
        return { above: branchesAbove, label: b && b.getAttribute('aria-label'), pressed: b && b.getAttribute('aria-pressed'), body: document.body.classList.contains('branches-above'),
            svg: !!(b && b.querySelector('svg')), after: b && b.previousElementSibling && b.previousElementSibling.textContent.trim().slice(0, 5),
            key: document.querySelector('#btn-add-parent .hotkey').textContent };`);
    ok(before.above === false && before.label === 'Branches: Below' && before.pressed === 'false' && !before.body && before.svg && before.after === 'Theme' && before.key === 'Alt+↑',
        'below by default: a small picture of the tree after Theme, named "Branches: Below"; Add Parent keeps Alt+↑', J(before));
    const turned = T(W, `__o.set(true);
        var b = document.getElementById('branches-btn');
        return { above: branchesAbove, label: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'), body: document.body.classList.contains('branches-above'),
            stored: localStorage.getItem('argmap-branches'), title: b.title, key: document.querySelector('#btn-add-parent .hotkey').textContent,
            help: Array.prototype.some.call(document.querySelectorAll('#help-panel kbd'), function (k) { return k.textContent === 'Alt+↓'; }) };`);
    ok(turned.above === true && turned.label === 'Branches: Above' && turned.pressed === 'true' && turned.body && turned.stored === 'above' &&
        /^Branches: Above\. Click to put them below/.test(turned.title) && turned.key === 'Alt+↓' && turned.help,
        'turned: "Branches: Above", kept in this browser; Add Parent and Help say Alt+↓', J(turned));
    const W2 = makeWin('branches-kept', 'above');
    await sleep(250);
    const kept = T(W2, `return { above: branchesAbove, label: document.getElementById('branches-btn').getAttribute('aria-label'), body: document.body.classList.contains('branches-above') };`);
    ok(kept.above && kept.label === 'Branches: Above' && kept.body, 'a new page opens as this browser left it', J(kept));

    /* ---------------- 2. the layout ---------------- */
    console.log('\n-- the layout --');
    const below = T(W, `__o.set(false); __o.load(${TR}); return { M: __o.pos('M'), S1: __o.pos('S1'), O1: __o.pos('O1'), G: __o.pos('G'), turns: document.querySelectorAll('#lines-svg > g').length };`);
    const above = T(W, `__o.set(true); __o.load(${TR});
        var turn = document.querySelector('#lines-svg > g');
        var arrow = document.querySelector('#lines-svg > g > path[data-child="S1"]');
        return { M: __o.pos('M'), S1: __o.pos('S1'), O1: __o.pos('O1'), G: __o.pos('G'), axis: mirrorAxis.M, axisO1: mirrorAxis.O1,
            transform: turn && turn.getAttribute('transform'), arrow: arrow && arrow.getAttribute('d'), loose: document.querySelectorAll('#lines-svg > path').length,
            fork: document.querySelectorAll('#lines-svg > g > path[data-fork="G"]').length };`);
    ok(below.M && above.M && below.M.top === above.M.top && below.M.left === above.M.left && below.turns === 0,
        'the main contention stays where it stands; with branches below, no lines are turned', J([below.M, above.M]));
    ok(above.S1.top + 60 <= above.M.top && above.O1.top + 60 <= above.S1.top && above.G.top + 60 <= above.M.top &&
        above.S1.left === below.S1.left && above.S1.top === 2 * below.M.top + 60 - below.S1.top - 60,
        'each box mirrored about the root: a support above the contention, its objection above it', J([below, above]));
    const end = above.arrow ? lastPoint(above.arrow) : null;
    ok(above.axis === 2 * above.M.top + 60 && above.axisO1 === above.axis && above.transform === `matrix(1 0 0 -1 0 ${above.axis})` &&
        !!end && Math.abs(above.axis - end.y - above.M.top) < 0.5 && above.loose === 0 && above.fork === 3,
        'the lines, in the map\'s own terms, drawn in a group that turns them over: the arrow ends on the contention\'s top; the co-premises\' fork too', J({ axis: above.axis, transform: above.transform, end, loose: above.loose, fork: above.fork }));
    const styles = T(W, `var sels = [];
        Array.prototype.forEach.call(document.styleSheets, function (sh) { try { Array.prototype.forEach.call(sh.cssRules, function (r) { if (r.selectorText) sels.push(r.selectorText); }); } catch (e) {} });
        return { dim: sels.some(function (x) { return /#lines-svg\\.has-highlight > g > path/.test(x); }), hl: sels.some(function (x) { return /#lines-svg\\.has-highlight > g > path\\.line-hl/.test(x); }),
            child: sels.some(function (x) { return /body\\.branches-above \\.drop-child/.test(x); }), flip: sels.some(function (x) { return /body\\.branches-above #branches-btn svg/.test(x); }) };`);
    ok(styles.dim && styles.hl && styles.child && styles.flip, 'the lines\' styles reach them in their group (focus dims and lights them); the drop bars and the picture turn too', J(styles));

    /* ---------------- 3. the Depth view ---------------- */
    console.log('\n-- the Depth view --');
    const depth = T(W, `__o.load(${TR}); if (!showDepthLabels) toggleDepthLabels();
        var ls = Array.prototype.map.call(document.querySelectorAll('#depth-labels-container .depth-label'), function (l) { return [l.textContent, Number(l.dataset.surfaceY)]; });
        var g = currentDepthGrid ? [currentDepthGrid[0], currentDepthGrid[1], currentDepthGrid._maxH[0], currentDepthGrid._maxH[1]] : null;
        toggleDepthLabels(); return { ls: ls, g: g };`);
    ok(depth.ls.length === 3 && depth.g && depth.ls[0][1] === depth.g[0] && depth.ls[1][1] === 2 * depth.g[0] + depth.g[2] - depth.g[1] - depth.g[3] && depth.ls[2][1] < depth.ls[1][1],
        'its rows mirrored about the first: Depth 1 above Depth 0, Depth 2 above that', J(depth));

    /* ---------------- 4. the tags ---------------- */
    console.log('\n-- the step tags --');
    const tagsAt = above => T(W, `__o.set(${above}); __o.load(${TR});
        function tag(gid, cls, extra) { var t = document.createElement('div'); t.className = cls; Object.assign(t.dataset, extra || {}); document.getElementById(gid).appendChild(t); return t; }
        var step = tag('group-S1', 'derivation-tag'), verdict = tag('group-M', 'derivation-tag verdict-tag', { verdictIdx: '0' }), theorem = tag('group-O1', 'logical-theorem-tag', { theoremIdx: '0' });
        var box = document.querySelector('#group-O1 .node'); Object.defineProperty(box, 'offsetHeight', { value: 60, configurable: true });
        // Two crowded groups: the second steps away from its boxes.
        var g1 = document.createElement('div'), g2 = document.createElement('div');
        [g1, g2].forEach(function (g) { g.className = 'node-group'; g.style.left = '100px'; g.style.top = '100px'; var n = document.createElement('div'); n.className = 'node'; g.appendChild(n); document.getElementById('surface').appendChild(g); });
        var c1 = document.createElement('div'); c1.className = 'derivation-tag'; g1.appendChild(c1);
        var c2 = document.createElement('div'); c2.className = 'derivation-tag'; g2.appendChild(c2);
        positionDerivationTags();
        var out = { step: step.style.top, verdict: verdict.style.top, theorem: theorem.style.top, crowd: [c1.style.top, c2.style.top] };
        [step, verdict, theorem, g1, g2].forEach(function (x) { x.remove(); });
        return out;`);
    const tb = tagsAt(false), ta = tagsAt(true);
    ok(tb.step === '-15px' && ta.step === '15px' && tb.verdict === '-8px' && ta.verdict === '8px',
        'a step\'s tag on the fork under its group, a verdict under its box (above them, with branches below)', J([tb, ta]));
    ok(tb.theorem === '60px' && ta.theorem === '0px', 'a theorem\'s tag on the top edge, where nothing arrives', J([tb.theorem, ta.theorem]));
    ok(parseFloat(tb.crowd[1]) < parseFloat(tb.crowd[0]) && parseFloat(ta.crowd[1]) > parseFloat(ta.crowd[0]),
        'a crowded tag steps away from its boxes: up with branches below, down with them above', J([tb.crowd, ta.crowd]));

    /* ---------------- 5. the + buttons ---------------- */
    console.log('\n-- the + buttons --');
    const plus = above => T(W, `__o.set(${above}); __o.load(${TR}, ['S1-0']); updateNodeActions();
        var cs = Array.prototype.slice.call(document.querySelectorAll('.node-action-container'));
        var child = cs.find(function (c) { return c.querySelector('.action-chooser'); }), parent = cs.find(function (c) { return c.querySelector('.action-parent'); });
        var p = __o.pos('S1');
        return { child: child && [parseFloat(child.style.top) - p.top, child.style.transform], parent: parent && [parseFloat(parent.style.top) - p.top, parent.style.transform],
            title: parent && parent.querySelector('.action-parent').title };`);
    const pb = plus(false), pa = plus(true);
    ok(pb.child && pb.child[0] === 68 && pb.child[1] === 'translateX(-50%)' && pb.parent[0] === -8 && pb.parent[1] === 'translate(-50%, -100%)',
        'with branches below: the + for what is added under the box, the parent\'s over it, as before', J(pb));
    ok(pa.child && pa.child[0] === -8 && pa.child[1] === 'translate(-50%, -100%)' && pa.parent[0] === 68 && pa.parent[1] === 'translateX(-50%)' && pa.title === 'Parent (Alt+↓)',
        'with branches above: what is added goes over the box, a parent under it (Alt+↓)', J(pa));
    // Near the top of the window: no room over the box for what is added,
    // room under it for a parent.
    const edge = T(W, `__o.set(true); __o.load(${TR}, ['S1-0']); var p = __o.pos('S1');
        window.__canvasRect = [p.left - 500, p.top - 5, 2000, 2000]; updateNodeActions();
        var cs = Array.prototype.slice.call(document.querySelectorAll('.node-action-container'));
        var out = { child: cs.some(function (c) { return c.querySelector('.action-chooser'); }), parent: cs.some(function (c) { return c.querySelector('.action-parent'); }) };
        window.__canvasRect = null; return out;`);
    ok(edge.child === false && edge.parent === true, 'near the window\'s top, the parent\'s + still shows under the box, and nothing over it', J(edge));

    /* ---------------- 6. the keys ---------------- */
    console.log('\n-- the keys --');
    const keys = above => T(W, `__o.set(${above}); __o.load(${TR}, ['M-0']);
        __o.key('ArrowUp'); var up = selectedIds.slice();
        __o.load(${TR}, ['S1-0']); __o.key('ArrowDown'); var down = selectedIds.slice();
        return { up: up, down: down };`);
    const kb = keys(false), ka = keys(true);
    ok(J(kb) === J({ up: ['M-0'], down: ['O1-0'] }) && J(ka) === J({ up: ['S1-0'], down: ['M-0'] }),
        'the arrow keys follow the screen: with branches above, up goes to a reason and down to what it supports', J([kb, ka]));
    const alt = T(W, `__o.set(true); __o.load(${TR}, ['M-0']); __o.key('ArrowUp', true); var afterUp = __o.parentOf('M');
        __o.load(${TR}, ['M-0']); __o.key('ArrowDown', true); var afterDown = __o.parentOf('M');
        __o.set(false); __o.load(${TR}, ['M-0']); __o.key('ArrowUp', true); var belowUp = __o.parentOf('M');
        return { afterUp: afterUp, afterDown: afterDown, belowUp: belowUp };`);
    ok(alt.afterUp === 'root' && alt.afterDown !== 'root' && alt.belowUp !== 'root',
        'with branches above, Alt+↓ adds a parent (Alt+↑ does not); with them below, Alt+↑, as before', J(alt));
    const words = T(W, `__o.set(true); __o.load(${TR}, ['S1-0']); refreshAttackButtons();
        var t = document.getElementById('btn-add-parent').title;
        showContextMenu(100, 100, 'S1', 0);
        var menu = Array.prototype.map.call(document.querySelectorAll('.ctx-key'), function (k) { return k.textContent; });
        __o.set(false); __o.load(${TR}, ['S1-0']); refreshAttackButtons();
        return { above: t, below: document.getElementById('btn-add-parent').title, menu: menu };`);
    ok(/^Add a box below the selected group, for it to support \(Alt\+↓\)$/.test(words.above) && /^Add a box above the selected group, for it to support \(Alt\+↑\)$/.test(words.below) &&
        words.menu.indexOf('Alt+↓') >= 0, 'the words say where the parent goes and its key: "below", Alt+↓, in Add Parent\'s tip and the box\'s menu', J(words));

    /* ---------------- 7. drops ---------------- */
    console.log('\n-- drops --');
    const classify = above => T(W, `__o.set(${above});
        var Tg = { left: 0, top: 200, w: 180, h: 60, id: 'S1', nodeType: 'support', parentId: 'M', parentType: 'contention', el: null };
        var o = { mode: 'group', draggedParentId: null };
        var overTop = classifyDrop({ left: 40, top: 140, w: 50, h: 40 }, [Tg], o), underBottom = classifyDrop({ left: 40, top: 265, w: 50, h: 40 }, [Tg], o);
        return { over: overTop.type, under: underBottom.type, same: underBottom.T === Tg || overTop.T === Tg };`);
    const cb = classify(false), ca = classify(true);
    ok(cb.over === 'parent' && cb.under === 'child' && ca.over === 'child' && ca.under === 'parent' && ca.same,
        'a drop above a box makes the dropped box its child, below its parent (the other way round with branches below)', J([cb, ca]));

    /* ---------------- 8. dragged lines ---------------- */
    console.log('\n-- dragged lines --');
    const dragged = T(W, `__o.set(true); __o.load(${TR});
        var node = findNodeContext(state.trees, 'S1').node, ghost = document.querySelector('.node[data-node-id="S1"]');
        startDrag({ clientX: 0, clientY: 0, screenX: 0, screenY: 0 }, node, 0, ghost, 'group');
        var ov = document.getElementById('drag-overlay'), g = ov && ov.querySelector('svg > g');
        var one = { turned: !!g && g.getAttribute('transform') === 'matrix(1 0 0 -1 0 ' + mirrorAxis.S1 + ')', paths: g ? g.querySelectorAll('path').length : 0 };
        endDrag();
        __o.load(${TR}, ['S1-0', 'O1-0']);
        var forest = buildSelectedDragForest(), many = null;
        if (forest && forest.units.length) {
            startSelectedForestDrag({ clientX: 0, clientY: 0, screenX: 0, screenY: 0 }, findNodeContext(state.trees, 'S1').node, 0, document.querySelector('.node[data-node-id="S1"]'), 'group', null, forest);
            var ov2 = document.getElementById('drag-overlay'), g2 = ov2 && ov2.querySelector('svg > g');
            many = { turned: !!g2 && /^matrix\\(1 0 0 -1 0 /.test(g2.getAttribute('transform')), paths: g2 ? g2.querySelectorAll('path').length : 0 };
            endDrag();
        }
        return { one: one, many: many };`);
    ok(dragged.one && dragged.one.turned && dragged.one.paths >= 1, 'a dragged branch\'s lines go with it, turned as its tree is', J(dragged));
    ok(dragged.many && dragged.many.turned && dragged.many.paths >= 1, 'so in a dragged selection', J(dragged));

    ok(!W.errors.length && !W2.errors.length, 'no JSDOM script errors', W.errors.concat(W2.errors).slice(0, 3).join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
