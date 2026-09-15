'use strict';
// r27 Placement: Snap or Free, and the File section's New button.
//
// Where a node ends up when nothing connects it -- a new node (A, the New Node
// button, the canvas menu) or a node dropped in empty space -- was always
// "snap" (the layout arranges it) unless Shift was held (Shift+A, Shift-drop),
// which pins it exactly where it was put. The Placement button (Change Type,
// beside Main) and Shift+F make Free the default instead. Holding Shift while
// placing always gives the OTHER placement: under Snap it leaves the node free,
// under Free it snaps -- for Shift+A, a Shift-click with New Node or on the
// canvas menu, and a Shift-drop. (The touch Free-drop toggle always pins, as
// its name says.) A drop onto a box still connects, whatever the setting. The
// choice is remembered per browser. Separately, the New (map) button moved
// from Export / Import into File, beside Open File.
//
// Covers:
//   (1) the toolbar: the Placement button after Main in Change Type, its
//       Shift+F badge dropped in the side toolbar so it fits beside Main; New
//       in File beside Open File, and gone from Export / Import;
//   (2) toggling by click and Shift+F, remembered; plain F is still Focus;
//       present mode ignores Shift+F;
//   (3) new nodes in both settings, with and without Shift: A, the armed New
//       Node click, and the canvas menu's New Node and Add Note;
//   (4) the setting restored at startup;
//   (5) drops: into empty space (single node and a selected forest) in both
//       settings, with and without Shift, children left behind with Alt, the
//       touch Free-drop toggle, and a drop onto a box;
//   (6) Help and tooltips.
//
// Run:  node placement-r27-snap-free-test.js [argument-mapper-r27.html]
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
        if (stored) Object.entries(stored).forEach(([k, v]) => { try { win.localStorage.setItem(k, v); } catch (e) {} });
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}

const N = (id, type, children, extra) => Object.assign({ id, type, texts: [id], collapsed: [], children: children || [] }, extra || {});
const TREES = [ N('M', 'contention', [ N('A', 'support'), N('B', 'support'), N('T', 'support') ], { x: 30000, y: 30000 }) ];
const ALT_TREES = [ N('M', 'contention', [ N('A', 'support', [ N('K', 'support') ]), N('T', 'support') ], { x: 30000, y: 30000 }) ];

const HELPERS = `
    window.__p = {
        load(trees, sel) {
            state.trees = JSON.parse(JSON.stringify(trees));
            ensureCollabFields(state);
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            selectedIds = sel ? sel.slice() : [];
            undoStack = []; redoStack = []; _shadowSnapshot = JSON.stringify(state);
            render();
        },
        key(code, key, opts) {
            document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ code: code, key: key, bubbles: true, cancelable: true }, opts || {})));
        },
        blur() { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); },
        newestRoot() { return state.trees[state.trees.length - 1]; },
        node(id) { var c = findNodeContext(state.trees, id); return c ? c.node : null; },
        parentOf(id) { var c = findNodeContext(state.trees, id); return c && c.parent ? c.parent.id : null; },
        btn() { var b = document.getElementById('placement-btn'); return { text: b.textContent.replace(/\\s+/g, ' ').trim(), active: b.classList.contains('active'), title: b.title }; },
        stubDrop(cls) {
            ghostRectFor = function () { return { left: 500, top: 400, w: 100, h: 40 }; };
            probeRectFor = function () { return { left: 500, top: 400, w: 60, h: 40 }; };
            withinDragSlop = function () { return false; };
            screenDragDistance = function () { return 9999; };
            classifyDrop = function () { return cls; };
        },
        dropOne(id, parentId, cls, shift) {
            this.stubDrop(cls);
            dragCtx = { mode: 'group', id: id, idx: 0, idxs: null, startSX: 0, startSY: 0,
                grabDX: 0, grabDY: 0, gw: 100, gh: 40, draggedParentId: parentId,
                targets: [], groupCenters: {}, lastHL: null, overlay: null };
            executeDrop({ shiftKey: !!shift, altKey: false, clientX: 500, clientY: 400, screenX: 500, screenY: 400 });
        },
        dropForest(ids, parentId, shift) {
            this.stubDrop({ type: 'detach' });
            var unit = function (id, i) { return { sourceId: id, kind: 'whole', idxs: [0], movingIds: new Set([id]),
                anchorLeft: 100 + i * 240, anchorTop: 200 + i * 60, sourceParentId: parentId, sourceTargetIndex: 0, wasFree: false,
                requiredIds: new Set([id]) }; };
            dragCtx = { mode: 'forest', id: ids[0], idx: 0, units: ids.map(unit), preservesSelectedConnection: false,
                selectedCandidates: ids.map(function (id) { return { sourceId: id, kind: 'whole', idxs: [0] }; }),
                candidateCount: ids.length, startSX: 0, startSY: 0, grabDX: 0, grabDY: 0, gw: 100, gh: 40,
                startGhostLeft: 100, startGhostTop: 200, draggedParentId: parentId, canReorderRow: true,
                targets: [], groupCenters: {}, lastHL: null, overlay: null };
            executeDrop({ shiftKey: !!shift, altKey: false, clientX: 500, clientY: 400, screenX: 500, screenY: 400 });
        }
    };
`;
const T = (W, body) => {
    try { return JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`)); }
    catch (e) { return { __error: String((e && e.message) || e) }; }
};
const J = JSON.stringify;

(async () => {
    console.log('=== r27 Placement: Snap or Free, and New in File ===');
    const W = makeWin('placement');
    await sleep(250);
    W.win.eval(HELPERS);

    /* ---------------- 1. toolbar ---------------- */
    console.log('\n-- toolbar --');
    {
        const tb = T(W, `var types = document.getElementById('group-change-type');
            var kids = Array.prototype.slice.call(types.children).map(function (el) { return el.id || el.textContent.replace(/\\s+/g, ' ').trim(); });
            var inAddNodes = !!document.querySelector('#group-add-nodes #placement-btn');
            var nb = document.getElementById('new-map-btn');
            var file = nb && nb.closest('.toolbar-group');
            var next = nb && nb.nextElementSibling;
            var exportGroup = Array.prototype.slice.call(document.querySelectorAll('#extra-toolbar .toolbar-group')).find(function (g) {
                return /Export \\/ Import/.test((g.querySelector('.toolbar-group-label') || {}).textContent || ''); });
            return { kids: kids, inAddNodes: inAddNodes, fileLabel: file && (file.querySelector('.toolbar-group-label') || {}).textContent,
                     newText: nb && nb.textContent.trim(), nextIsOpen: !!(next && /Open File/.test(next.textContent)),
                     onclick: nb && nb.getAttribute('onclick'),
                     exportHasNew: !!(exportGroup && Array.prototype.slice.call(exportGroup.querySelectorAll('button')).some(function (b) { return b.textContent.trim() === 'New'; })),
                     newButtons: Array.prototype.slice.call(document.querySelectorAll('button[onclick="newMap()"]')).length };`);
        const kids = tb.kids || [];
        ok(kids.indexOf('btn-main') >= 0 && kids[kids.indexOf('btn-main') + 1] === 'placement-btn' && tb.inAddNodes === false,
            'the Placement button sits right after Main in Change Type, and is gone from Add Nodes', J(tb));
        const css = HTML.slice(0, HTML.indexOf('</style>'));
        ok(/body\.toolbar-left #placement-btn \.hotkey\s*\{\s*display:\s*none/.test(css) && !/#placement-btn \.hotkey\s*\{\s*display:\s*none/.test(css.replace(/body\.toolbar-left #placement-btn \.hotkey/g, '')),
            'only the side toolbar drops its Shift+F badge, so it fits beside Main; the top toolbar keeps it');
        ok(tb.fileLabel === 'File' && tb.newText === 'New' && tb.nextIsOpen && tb.onclick === 'newMap()',
            'New is in the File section, immediately before Open File', J(tb));
        ok(tb.exportHasNew === false && tb.newButtons === 1, 'and is gone from Export / Import (one New button in all)', J(tb));
    }

    /* ---------------- 2. toggling ---------------- */
    console.log('\n-- toggling --');
    {
        const t = T(W, `__p.load(${J(TREES)});
            var out = { start: __p.btn(), startFlag: freePlacement, startStored: localStorage.getItem('argmap-free-placement') };
            document.getElementById('placement-btn').click();
            out.clicked = __p.btn(); out.clickedFlag = freePlacement; out.stored = localStorage.getItem('argmap-free-placement');
            out.newNodeTip = document.getElementById('new-node-btn').title;
            out.bodyClass = document.body.classList.contains('free-placement');
            __p.key('KeyF', 'F', { shiftKey: true });
            out.shiftF = __p.btn(); out.shiftFFlag = freePlacement; out.stored2 = localStorage.getItem('argmap-free-placement');
            var focusBefore = document.body.classList.contains('focus-mode');
            __p.key('KeyF', 'f'); out.focusToggled = document.body.classList.contains('focus-mode') !== focusBefore; out.plainFFlag = freePlacement;
            if (document.body.classList.contains('focus-mode') !== focusBefore) toggleFocusMode();
            presentMode = true; __p.key('KeyF', 'F', { shiftKey: true }); out.presentFlag = freePlacement; presentMode = false;
            return out;`);
        ok(t.start && t.start.text === 'Placement: Snap Shift+F' && t.start.active === false && t.startFlag === false && t.startStored === null,
            'it starts as "Placement: Snap", not lit', J(t.start));
        ok(t.clicked && t.clicked.text === 'Placement: Free Shift+F' && t.clicked.active === true && t.clickedFlag === true && t.stored === '1' && t.bodyClass,
            'clicking it switches to Free, lights it, and remembers the choice', J(t));
        ok(/A pins a free node at the cursor; Shift\+A uses normal placement/.test(t.newNodeTip || ''), 'the New Node tooltip swaps its A / Shift+A wording', J(t.newNodeTip));
        ok(t.shiftF && t.shiftF.text === 'Placement: Snap Shift+F' && t.shiftFFlag === false && t.stored2 === '0', 'Shift+F switches it back to Snap', J(t.shiftF));
        ok(t.focusToggled === true && t.plainFFlag === false, 'plain F is still Focus and leaves Placement alone', J(t));
        ok(t.presentFlag === false, 'present mode ignores Shift+F', J(t));
    }

    /* ---------------- 3. new nodes ---------------- */
    console.log('\n-- new nodes --');
    {
        const n = T(W, `var out = {};
            function make(free, how) {
                __p.load(${J(TREES)}); applyFreePlacement(free);
                how(); __p.blur();
                var r = __p.newestRoot(); return !!r.freePosition;
            }
            [false, true].forEach(function (free) {
                var k = free ? 'free' : 'snap';
                out[k] = {
                    A: make(free, function () { __p.key('KeyA', 'a'); }),
                    shiftA: make(free, function () { __p.key('KeyA', 'A', { shiftKey: true }); }),
                    armedClick: make(free, function () { toggleNodePlacement(); document.getElementById('canvas').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 200 })); }),
                    armedShiftClick: make(free, function () { toggleNodePlacement(); document.getElementById('canvas').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 200, shiftKey: true })); }),
                    menuNode: make(free, function () { menuClick('New Node', false); }),
                    menuNote: make(free, function () { menuClick('Add Note', false); }),
                    menuShiftNode: make(free, function () { menuClick('New Node', true); }),
                    menuShiftNote: make(free, function () { menuClick('Add Note', true); })
                };
            });
            // The canvas menu, opened on empty canvas, and one of its items clicked.
            function menuClick(label, shift) {
                showContextMenu(300, 200);
                var item = Array.prototype.slice.call(document.querySelectorAll('#context-menu .ctx-item'))
                    .find(function (b) { return b.textContent.replace(/\\s+/g, ' ').trim().indexOf(label) === 0; });
                item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: shift }));
            }
            applyFreePlacement(false);
            return out;`);
        const s = n.snap || {}, f = n.free || {};
        ok(s.A === false && s.shiftA === true, 'Snap: A lays the new node out; Shift+A pins it', J(s));
        ok(f.A === true && f.shiftA === false, 'Free: A pins the new node; Shift+A lays it out', J(f));
        ok(s.armedClick === false && f.armedClick === true && s.armedShiftClick === true && f.armedShiftClick === false,
            'the New Node button\'s click-to-place follows the setting, Shift inverting it', J([s, f]));
        ok(s.menuNode === false && s.menuNote === false && f.menuNode === true && f.menuNote === true,
            'the canvas menu\'s New Node and Add Note follow the setting', J([s, f]));
        ok(s.menuShiftNode === true && s.menuShiftNote === true && f.menuShiftNode === false && f.menuShiftNote === false,
            'and Shift-clicking them places the other way: free under Snap, snapped under Free', J([s, f]));
    }

    /* ---------------- 4. startup ---------------- */
    console.log('\n-- startup --');
    {
        const W2 = makeWin('placement-stored', { 'argmap-free-placement': '1' });
        await sleep(250);
        const s = T(W2, `var b = document.getElementById('placement-btn');
            return { flag: freePlacement, text: b.textContent.replace(/\\s+/g, ' ').trim(), active: b.classList.contains('active') };`);
        ok(s.flag === true && s.text === 'Placement: Free Shift+F' && s.active === true, 'a stored Free setting is restored when the app opens', J(s));
        ok(W2.errors.length === 0, 'and that window boots without script errors', W2.errors.join(' | '));
        W2.dom.window.close();
    }

    /* ---------------- 5. drops ---------------- */
    console.log('\n-- drops --');
    {
        const d = T(W, `var out = {};
            function one(free, cls, shift) {
                __p.load(${J(TREES)}, ['A-0']); applyFreePlacement(free);
                __p.dropOne('A', 'M', cls, shift);
                var a = __p.node('A'); return { parent: __p.parentOf('A'), free: !!(a && a.freePosition), x: a && a.x };
            }
            out.snapEmpty = one(false, { type: 'detach' }, false);
            out.freeEmpty = one(true, { type: 'detach' }, false);
            out.snapShift = one(false, { type: 'detach' }, true);
            out.freeOnto = one(true, { type: 'child', T: { id: 'T', idx: 0 } }, false);
            __p.load(${J(TREES)}, ['A-0', 'B-0']); applyFreePlacement(true);
            __p.dropForest(['A', 'B'], 'M', false);
            out.freeForest = { A: !!(__p.node('A') || {}).freePosition, B: !!(__p.node('B') || {}).freePosition, pa: __p.parentOf('A'), pb: __p.parentOf('B'),
                               dx: (__p.node('B') || {}).x - (__p.node('A') || {}).x };
            __p.load(${J(TREES)}, ['A-0', 'B-0']); applyFreePlacement(false);
            __p.dropForest(['A', 'B'], 'M', false);
            out.snapForest = { A: !!(__p.node('A') || {}).freePosition, B: !!(__p.node('B') || {}).freePosition, pa: __p.parentOf('A') };
            // Shift flips the setting for drops too.
            out.freeShift = one(true, { type: 'detach' }, true);
            function forest(free, shift) {
                __p.load(${J(TREES)}, ['A-0', 'B-0']); applyFreePlacement(free);
                __p.dropForest(['A', 'B'], 'M', shift);
                return { A: !!(__p.node('A') || {}).freePosition, B: !!(__p.node('B') || {}).freePosition, pa: __p.parentOf('A') };
            }
            out.freeForestShift = forest(true, true);
            out.snapForestShift = forest(false, true);
            // Alt leaves the children behind; they follow the dropped node.
            function alt(free, shift) {
                __p.load(${J(ALT_TREES)}, ['A-0']); applyFreePlacement(free);
                __p.stubDrop({ type: 'detach' });
                dragCtx = { mode: 'group', id: 'A', idx: 0, idxs: null, startSX: 0, startSY: 0, grabDX: 0, grabDY: 0, gw: 100, gh: 40,
                    draggedParentId: 'M', targets: [], groupCenters: {}, lastHL: null, overlay: null };
                executeDrop({ shiftKey: shift, altKey: true, clientX: 500, clientY: 400, screenX: 500, screenY: 400 });
                return { A: !!(__p.node('A') || {}).freePosition, K: !!(__p.node('K') || {}).freePosition, kParent: __p.parentOf('K') };
            }
            out.altSnapShift = alt(false, true);
            out.altFreeShift = alt(true, true);
            // The touch Free-drop toggle always pins. It lasts one drop, so
            // each drop turns it on again.
            freeDropMode = true; out.toggleFree = one(true, { type: 'detach' }, false);
            freeDropMode = true; out.toggleSnap = one(false, { type: 'detach' }, false);
            freeDropMode = true; out.toggleFreeShift = one(true, { type: 'detach' }, true);
            out.toggleOff = freeDropMode;
            freeDropMode = false;
            applyFreePlacement(false);
            return out;`);
        ok(d.snapEmpty && d.snapEmpty.parent === null && d.snapEmpty.free === false, 'Snap: a node dropped in empty space detaches and is laid out', J(d.snapEmpty));
        ok(d.freeEmpty && d.freeEmpty.parent === null && d.freeEmpty.free === true && d.freeEmpty.x === 500, 'Free: it detaches and stays exactly where it was dropped', J(d.freeEmpty));
        ok(d.snapShift && d.snapShift.free === true, 'Shift-drop still pins it under Snap', J(d.snapShift));
        ok(d.freeOnto && d.freeOnto.parent === 'T' && d.freeOnto.free === false, 'a drop onto a box still connects under Free', J(d.freeOnto));
        ok(d.freeForest && d.freeForest.A && d.freeForest.B && d.freeForest.pa === null && d.freeForest.pb === null && d.freeForest.dx === 240,
            'Free: a dragged selection dropped in empty space is pinned, keeping its spacing', J(d.freeForest));
        ok(d.snapForest && d.snapForest.A === false && d.snapForest.B === false && d.snapForest.pa === null, 'Snap: the same selection is laid out', J(d.snapForest));
        ok(d.freeShift && d.freeShift.parent === null && d.freeShift.free === false, 'Free: a Shift-drop detaches the node and snaps it into the layout', J(d.freeShift));
        ok(d.freeForestShift && d.freeForestShift.A === false && d.freeForestShift.B === false && d.freeForestShift.pa === null &&
           d.snapForestShift && d.snapForestShift.A === true && d.snapForestShift.B === true,
            'a Shift-dropped selection is laid out under Free and pinned under Snap', J([d.freeForestShift, d.snapForestShift]));
        ok(d.altSnapShift && d.altSnapShift.A === true && d.altSnapShift.K === true && d.altSnapShift.kParent === null &&
           d.altFreeShift && d.altFreeShift.A === false && d.altFreeShift.K === false && d.altFreeShift.kParent === null,
            'children left behind with Alt are placed the same way as the node dropped', J([d.altSnapShift, d.altFreeShift]));
        ok(d.toggleFree && d.toggleFree.free === true && d.toggleSnap && d.toggleSnap.free === true && d.toggleFreeShift && d.toggleFreeShift.free === true && d.toggleOff === false,
            'the touch Free-drop toggle always pins, whatever the setting, and still lasts one drop', J([d.toggleFree, d.toggleSnap, d.toggleFreeShift, d.toggleOff]));
    }

    /* ---------------- 6. Help ---------------- */
    console.log('\n-- Help --');
    {
        const h = T(W, `return document.getElementById('help-panel').innerHTML;`);
        const html = typeof h === 'string' ? h : '';
        ok(/<kbd>Shift\+F<\/kbd> placement snap\/free/.test(html) && /<strong>Placement<\/strong> \(Change Type\)/.test(html),
            'Help lists Shift+F and explains Placement');
        ok(/Holding <kbd>Shift<\/kbd> while placing a node does the opposite of the setting/.test(html) &&
           /<kbd>Shift<\/kbd>-drop = no connection, placed opposite to Placement \(stays put under Snap, snaps into the layout under Free\)/.test(html),
            'and says Shift places a node the other way, drops included');
        ok(/<kbd>F<\/kbd> focus/.test(html), 'and still lists F for focus');
        const tips = T(W, `applyFreePlacement(true); var free = document.getElementById('placement-btn').title;
            applyFreePlacement(false); var snap = document.getElementById('placement-btn').title;
            return { free: free, snap: snap, node: document.getElementById('new-node-btn').title };`);
        ok(/hold Shift while placing one to snap it instead/.test(tips.free || '') && /hold Shift while placing one to leave it free instead/.test(tips.snap || '') &&
           /Shift-click places it the other way/.test(tips.node || ''),
            'the Placement and New Node tooltips mention Shift', J(tips));
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
