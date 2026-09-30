'use strict';
// r27.62: moving a box without its children, and the Editing button.
//
// The user (2026-09-29): "what's the command for removing a node from a branch
// while not taking its children with it? ... There should probably be a way to
// do that on mobile devices as well." Children "stay put as own trees" (what
// Alt-drop does), and: "when you Alt-drag, it looks like the whole branch is
// being dragged with you rather than just the node until you drop it. Can you
// make sure it only shows those nodes that are highlighted being dragged?" A
// handle of its own on the box was tried and dropped: the user chose instead
// "Hold ⠿, then drag" and "Menu: Take Out of Branch". Also: the Editing button
// under View, a key for it, and "One tap on touch screens" as the default.
//
// Covers:
//   (1) no new icon: ⠿ says how to move a box alone;
//   (2) ⠿ held still turns into ✥, and the drag -- mouse or touch -- moves the
//       box alone: its child stays where it is, as a tree of its own; one
//       undo; a quick drag still takes the branch; a hold let go is ⠿ again;
//       a finger held on ⠿ opens no menu;
//   (3) the drag shows the box alone: ⠿ held, or Alt held (and its branch
//       again when Alt is let go);
//   (4) Take Out of Branch, from the box's menu;
//   (5) Editing: in the View group, Shift+E switches it, and a touch screen
//       starts at One click unless a choice was made.
//
// Run:  node move-alone-r27-test.js [argument-mapper-r27.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const SRC = process.argv[2] || (__dirname + '/argument-mapper-r27.html');
const HTML = fs.readFileSync(SRC, 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GRIP = '⠿', ARROWS = '✥';

let pass = 0, fail = 0;
function ok(cond, label, detail) {
    if (cond) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

function makeWin(label, opts) {
    opts = opts || {};
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
    function stubs(win) {
        const { webcrypto } = require('crypto');
        if (!win.crypto || !win.crypto.randomUUID) Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
        win.matchMedia = q => ({ matches: !!opts.coarse && /pointer:\s*coarse/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
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
        if (opts.stored !== undefined) { try { win.localStorage.setItem('argmap-click-edit', opts.stored); } catch (e) {} }
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}

const HELPERS = `
    window.__m = {
        // R <- A (whose child is K) and B (no children).
        load() {
            state.trees = [
                { id: 'r', type: 'contention', texts: ['Main.'], collapsed: [], children: [
                    { id: 'a', type: 'support', texts: ['A.'], collapsed: [], children: [
                        { id: 'k', type: 'support', texts: ['K.'], collapsed: [], children: [] }] },
                    { id: 'b', type: 'support', texts: ['B.'], collapsed: [], children: [] }
                ], x: 500, y: 100 }
            ];
            ensureCollabFields(state);
            reviewMode = false;
            render();
            selectedIds = [];
            updateSelectionVisuals();
        },
        box(id) { return document.querySelector('.node[data-node-id="' + id + '"][data-node-idx="0"]'); },
        grip(id) { return this.box(id).querySelector('.drag-handle'); },
        parentOf(id) { const c = findNodeContext(state.trees, id); return c && c.parent ? c.parent.id : null; },
        ev(type, x, extra) {
            return new PointerEvent(type, Object.assign({ bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
                pointerId: 1, isPrimary: true, clientX: x, clientY: 20, screenX: x, screenY: 20 }, extra || {}));
        }
    };
`;
const T = (W, body) => JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`));

(async () => {
    console.log('=== r27.62 moving a box alone, and the Editing button ===');
    const W = makeWin('move-alone');
    await sleep(250);
    W.win.eval(HELPERS);

    console.log('\n-- (1) no new icon --');
    {
        const where = T(W, `__m.load();
            const h = __m.grip('a');
            return { alone: document.querySelectorAll('.drag-alone').length, glyph: h && h.textContent, title: h && h.title };`);
        ok(where.alone === 0 && where.glyph === GRIP, 'no box has a handle of its own for moving it alone: ' + GRIP + ' is the one handle', JSON.stringify(where));
        ok((where.title || '').includes('Hold it still until it turns into ' + ARROWS) && /Alt/.test(where.title || ''),
            GRIP + ' says how: hold it still until it turns into ' + ARROWS + ', or hold Alt as you drop', where.title);
    }

    console.log('\n-- (2) hold ' + GRIP + ', then drag: the box goes alone --');
    for (const pointerType of ['mouse', 'touch']) {
        const pt = JSON.stringify(pointerType);
        W.win.eval(`__m.load(); window.__h = __m.grip('a'); __h.dispatchEvent(__m.ev('pointerdown', 20, { pointerType: ${pt} }));`);
        await sleep(600);
        const moved = T(W, `const turned = { glyph: __h.textContent, cls: __h.classList.contains('drag-handle-alone') };
            document.dispatchEvent(__m.ev('pointermove', 60, { pointerType: ${pt} }));
            const overlay = document.getElementById('drag-overlay');
            const during = overlay ? { alone: overlay.classList.contains('drag-alone-now'), branchHidden: overlay.querySelectorAll('.drag-branch').length } : null;
            document.dispatchEvent(__m.ev('pointerup', 120, { pointerType: ${pt} }));
            const r = { turned, during, aParent: __m.parentOf('a'), kParent: __m.parentOf('k'), kRoot: state.trees.some(t => t.id === 'k'),
                aChildren: findNodeContext(state.trees, 'a').node.children.length };
            undo();
            r.undone = __m.parentOf('a') === 'r' && __m.parentOf('k') === 'a';
            return r;`);
        ok(moved.turned.glyph === ARROWS && moved.turned.cls, pointerType + ': held still, ' + GRIP + ' turns into ' + ARROWS, JSON.stringify(moved.turned));
        ok(moved.during && moved.during.alone && moved.during.branchHidden > 0,
            pointerType + ': dragged then, only the box shows -- its branch is marked and left out', JSON.stringify(moved.during));
        ok(moved.aParent === null && moved.aChildren === 0 && moved.kRoot && moved.kParent === null,
            pointerType + ': dropped, the box has moved without its child, which stays behind as a tree of its own', JSON.stringify(moved));
        ok(moved.undone, pointerType + ': one undo puts the box and its child back', JSON.stringify(moved));
    }
    const quick = T(W, `__m.load();
        __m.grip('a').dispatchEvent(__m.ev('pointerdown', 20));
        document.dispatchEvent(__m.ev('pointermove', 60));
        const overlay = document.getElementById('drag-overlay');
        const during = overlay && overlay.classList.contains('drag-alone-now');
        document.dispatchEvent(__m.ev('pointerup', 120));
        return { during, kParent: __m.parentOf('k') };`);
    ok(quick.during === false && quick.kParent === 'a', 'a quick drag from ' + GRIP + ' takes the branch along, and the drag shows it', JSON.stringify(quick));
    W.win.eval(`__m.load(); window.__h = __m.grip('a');
        __h.dispatchEvent(__m.ev('pointerdown', 20, { pointerType: 'touch' }));
        document.dispatchEvent(__m.ev('pointermove', 28, { pointerType: 'touch' }));`);
    await sleep(600);
    const letGo = T(W, `const held = { glyph: __h.textContent, drag: !!document.getElementById('drag-overlay'), menu: document.getElementById('context-menu').classList.contains('open') };
        document.dispatchEvent(__m.ev('pointerup', 28, { pointerType: 'touch' }));
        return { held, after: __h.textContent, cls: __h.classList.contains('drag-handle-alone'), kParent: __m.parentOf('k') };`);
    ok(letGo.held.glyph === ARROWS && !letGo.held.drag && !letGo.held.menu,
        'a finger that wanders a little while holding still turns ' + GRIP + ', starts no drag, and opens no menu', JSON.stringify(letGo));
    ok(letGo.after === GRIP && !letGo.cls && letGo.kParent === 'a', 'let go without a drag, it is ' + GRIP + ' again, and nothing has moved', JSON.stringify(letGo));

    console.log('\n-- (3) Alt shows the box alone --');
    {
        const alt = T(W, `__m.load();
            __m.box('a').dispatchEvent(__m.ev('pointerdown', 20));
            document.dispatchEvent(__m.ev('pointermove', 60, { altKey: true }));
            const overlay = document.getElementById('drag-overlay');
            const held = overlay.classList.contains('drag-alone-now');
            document.dispatchEvent(__m.ev('pointermove', 70, { altKey: false }));
            const letGo = overlay.classList.contains('drag-alone-now');
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }));
            const pressed = overlay.classList.contains('drag-alone-now');
            document.dispatchEvent(__m.ev('pointerup', 120, { altKey: true }));
            return { held, letGo, pressed, kParent: __m.parentOf('k') };`);
        ok(alt.held && !alt.letGo && alt.pressed, 'with Alt held the drag shows the box alone; let go, its branch again; pressed mid-drag, alone', JSON.stringify(alt));
        ok(alt.kParent === null, 'and an Alt-drop leaves the child behind, as before', JSON.stringify(alt));
        const body = T(W, `__m.load();
            __m.box('a').dispatchEvent(__m.ev('pointerdown', 20));
            document.dispatchEvent(__m.ev('pointermove', 60));
            const during = document.getElementById('drag-overlay').classList.contains('drag-alone-now');
            document.dispatchEvent(__m.ev('pointerup', 120));
            return { during, kParent: __m.parentOf('k') };`);
        ok(body.during === false && body.kParent === 'a', 'dragged by its body without Alt, the box takes its branch along, and the drag shows it', JSON.stringify(body));
    }

    console.log('\n-- (4) Take Out of Branch --');
    {
        const out = T(W, `__m.load();
            selectedIds = ['a-0']; updateSelectionVisuals();
            showContextMenu(10, 10, 'a', 0);
            const item = [...document.querySelectorAll('#context-menu .ctx-item')].find(b => /Take Out of Branch/.test(b.textContent));
            const enabled = !!item && !item.disabled;
            hideContextMenu();
            state.trees.push({ id: 'z', type: 'support', texts: ['Z.'], collapsed: [], children: [], x: 900, y: 400 }); render();
            showContextMenu(10, 10, 'z', 0);
            const loneItem = [...document.querySelectorAll('#context-menu .ctx-item')].find(b => /Take Out of Branch/.test(b.textContent));
            hideContextMenu();
            state.trees = state.trees.filter(t => t.id !== 'z'); render();
            selectedIds = ['a-0'];
            takeOutOfBranch();
            const a = findNodeContext(state.trees, 'a'), k = findNodeContext(state.trees, 'k');
            const r = { enabled, loneDisabled: !!loneItem && loneItem.disabled, aParent: a.parent ? a.parent.id : null, aType: a.node.type,
                aChildren: a.node.children.length, kParent: k.parent ? k.parent.id : null, aFree: !!a.node.freePosition, kFree: !!k.node.freePosition,
                sel: selectedIds.slice(), bParent: __m.parentOf('b') };
            undo();
            r.undone = __m.parentOf('a') === 'r' && __m.parentOf('k') === 'a';
            return r;`);
        ok(out.enabled && out.loneDisabled, 'a box in a branch has Take Out of Branch in its menu; a box on its own has it greyed out', JSON.stringify(out));
        ok(out.aParent === null && out.aType === 'support' && out.aChildren === 0 && out.kParent === null && out.aFree && out.kFree && out.bParent === 'r',
            'it lifts the box out on its own, still a support, where it was; its child stays in place as a tree of its own; its sibling is untouched', JSON.stringify(out));
        ok(JSON.stringify(out.sel) === JSON.stringify(['a-0']) && out.undone, 'the box stays selected, to drag where it goes; one undo puts it back', JSON.stringify(out));
    }

    console.log('\n-- (5) the Editing button --');
    {
        const btn = T(W, `const b = document.getElementById('click-edit-btn');
            const inView = !!b.closest('#group-view');
            const before = clickToEdit;
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', code: 'KeyE', shiftKey: true, bubbles: true }));
            const after = clickToEdit, label = b.textContent;
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', code: 'KeyE', shiftKey: true, bubbles: true }));
            return { inView, before, after, label, back: clickToEdit, stored: localStorage.getItem('argmap-click-edit') };`);
        ok(btn.inView, 'the Editing button is in the View group');
        ok(btn.before === false && btn.after === true && /One click/.test(btn.label) && /Shift\+E/.test(btn.label) && btn.back === false && btn.stored === '0',
            'Shift+E switches it and back, the button says so, and the choice is kept', JSON.stringify(btn));
    }
    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    W.dom.window.close();

    const touch = makeWin('touch', { coarse: true });
    await sleep(200);
    const chosen = makeWin('touch-chosen', { coarse: true, stored: '0' });
    await sleep(200);
    const mouse = makeWin('mouse', {});
    await sleep(200);
    const at = w => w.win.eval('clickToEdit');
    ok(at(touch) === true && at(chosen) === false && at(mouse) === false,
        'a touch screen starts at One click; a choice once made is kept; a mouse starts at Double-click',
        JSON.stringify([at(touch), at(chosen), at(mouse)]));
    [touch, chosen, mouse].forEach(w => w.dom.window.close());

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
