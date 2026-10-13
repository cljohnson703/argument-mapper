'use strict';
/**
 * An action on one of several selected boxes acts on all of them (r27.99; the
 * user's notes: "Stretch goal: Selecting multiple nodes and performing an
 * action on one performs it on all of them, e.g., resizing, collapsing tree
 * (only two I could find)").
 *
 *   node multiselect-r27-test.js [argument-mapper-r27.html]
 *
 * 1. Collapse and expand: the button on one selected box does every selected
 *    box with children, to the state the clicked one goes to; its tip says so.
 * 2. Resize: the width a selected box is dragged to, every selected box takes.
 * 3. Reset the width (double-click, or double tap, on the grip): of every
 *    selected box.
 * 4. A box outside the selection, or a selection of one, acts alone, as
 *    before; and each action is one step to undo.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/multiselect-test', virtualConsole: vc,
    beforeParse(w) {
        const { webcrypto } = require('crypto');
        if (!w.crypto || !w.crypto.randomUUID) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
        w.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
        w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        const ctx = new Proxy({}, { get: (_, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
        w.indexedDB = { open() { const r = {}; setTimeout(() => r.onerror && r.onerror({ target: { error: new Error('x') } }), 0); return r; },
            deleteDatabase() { const r = {}; setTimeout(() => r.onsuccess && r.onsuccess({}), 0); return r; } };
        w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
        w.cancelAnimationFrame = w.clearTimeout;
        w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true; w.prompt = () => null; w.open = () => null;
    }
});
const W = dom.window, J = JSON.stringify;
const ev = src => JSON.parse(W.eval('JSON.stringify((function(){' + src + '})())'));
let passed = 0, failed = 0;
function ok(cond, label, detail) {
    if (cond) { passed++; console.log('  ✓ ' + label); }
    else { failed++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}
// A map: three supports under the main claim, each with a child of its own.
const MAP = `state.trees = [{ id: 'M', type: 'contention', texts: ['The main claim.'], collapsed: [], x: 0, y: 0, children: [
    { id: 'A', type: 'support', texts: ['First reason.'], collapsed: [], children: [{ id: 'a', type: 'support', texts: ['Under the first.'], collapsed: [], children: [] }] },
    { id: 'B', type: 'support', texts: ['Second reason.'], collapsed: [], children: [{ id: 'b', type: 'support', texts: ['Under the second.'], collapsed: [], children: [] }] },
    { id: 'C', type: 'support', texts: ['Third reason.'], collapsed: [], children: [{ id: 'c', type: 'support', texts: ['Under the third.'], collapsed: [], children: [] }] } ] }];
    ensureCollabFields(state); undoStack.length = 0; render();`;
const node = id => `findNodeContext(state.trees, '${id}').node`;
const collapsed = `return ['A', 'B', 'C'].map(function (id) { return isBoxCollapsed(${node("' + id + '")}, 0); });`;

console.log('\n-- 1. collapse and expand --');
{
    const r = ev(`${MAP} selectedIds = ['A-0', 'B-0']; render();
        var btn = document.querySelector('[data-node-id="A"][data-node-idx="0"] .collapse-btn'), tip = btn.title; btn.click();
        var after = ['A', 'B', 'C'].map(function (id) { return isBoxCollapsed(findNodeContext(state.trees, id).node, 0); });
        document.querySelector('[data-node-id="B"][data-node-idx="0"] .collapse-btn').click();
        var again = ['A', 'B', 'C'].map(function (id) { return isBoxCollapsed(findNodeContext(state.trees, id).node, 0); });
        return { tip: tip, after: after, again: again };`);
    ok(J(r.after) === J([true, true, false]), 'collapsing one of two selected boxes collapses both, and not the third', J(r));
    ok(J(r.again) === J([false, false, false]), 'expanding either expands both', J(r));
    ok(r.tip === 'Collapse the children of this premise and of the other selected boxes', 'its tip says so', r.tip);
    const mixed = ev(`${MAP} findNodeContext(state.trees, 'B').node.collapsed = [0]; selectedIds = ['A-0', 'B-0']; render();
        document.querySelector('[data-node-id="A"][data-node-idx="0"] .collapse-btn').click();
        return ['A', 'B', 'C'].map(function (id) { return isBoxCollapsed(findNodeContext(state.trees, id).node, 0); });`);
    ok(J(mixed) === J([true, true, false]), 'each goes to the state the clicked one goes to, whatever it was', J(mixed));
    const whole = ev(`${MAP} selectedIds = ['A', 'C']; render();
        document.querySelector('[data-node-id="C"][data-node-idx="0"] .collapse-btn').click();
        return ['A', 'B', 'C'].map(function (id) { return isBoxCollapsed(findNodeContext(state.trees, id).node, 0); });`);
    ok(J(whole) === J([true, false, true]), 'so for boxes selected as whole groups', J(whole));
}

console.log('\n-- 2. resize --');
{
    const drag = (sel, id, x) => `${MAP} selectedIds = ${J(sel)}; render(); zoomLevel = 1;
        _resizingBox = { node: findNodeContext(state.trees, '${id}').node, index: 0, el: document.querySelector('[data-node-id="${id}"][data-node-idx="0"]'),
            group: null, startW: 180, startLeft: 0, startEdgeS: 180, grabOffS: 0, lastEdgeS: null, lastW: null, moved: false };
        window._resizeActive = true;
        document.dispatchEvent(new MouseEvent('pointermove', { clientX: ${x}, clientY: 10, bubbles: true }));
        document.dispatchEvent(new MouseEvent('pointerup', { clientX: ${x}, clientY: 10, bubbles: true }));
        return ['A', 'B', 'C'].map(function (id) { var n = findNodeContext(state.trees, id).node; return n.boxW ? n.boxW[0] : null; });`;
    ok(J(ev(drag(['A-0', 'B-0'], 'A', 200))) === J([220, 220, null]), 'the width one selected box is dragged to, both take');
    ok(J(ev(drag(['A-0', 'B-0'], 'C', 200))) === J([null, null, 220]), 'a box outside the selection is resized alone');
    ok(J(ev(drag(['B-0'], 'B', 200))) === J([null, 220, null]), 'and a selection of one, as before');
}

console.log('\n-- 3. reset the width --');
{
    const r = ev(`${MAP} ['A', 'B', 'C'].forEach(function (id) { findNodeContext(state.trees, id).node.boxW = { 0: 300 }; });
        selectedIds = ['A-0', 'C-0']; render(); var before = undoStack.length;
        resetBoxWidth(findNodeContext(state.trees, 'C').node, 0);
        return { widths: ['A', 'B', 'C'].map(function (id) { var n = findNodeContext(state.trees, id).node; return n.boxW ? n.boxW[0] : null; }), steps: undoStack.length - before };`);
    ok(J(r.widths) === J([null, 300, null]), 'resetting one selected box\'s width resets every selected box\'s', J(r));
    ok(r.steps === 1, 'in one step to undo', J(r));
    // A double-click on the grip, the box's bottom right corner.
    const dbl = ev(`${MAP} ['A', 'B', 'C'].forEach(function (id) { findNodeContext(state.trees, id).node.boxW = { 0: 300 }; });
        selectedIds = ['A-0', 'B-0']; render(); zoomLevel = 1;
        var el = document.querySelector('[data-node-id="B"][data-node-idx="0"]');
        el.getBoundingClientRect = function () { return { left: 0, top: 0, right: 300, bottom: 80, width: 300, height: 80, x: 0, y: 0 }; };
        el.dispatchEvent(new MouseEvent('dblclick', { clientX: 295, clientY: 75, bubbles: true, cancelable: true }));
        return ['A', 'B', 'C'].map(function (id) { var n = findNodeContext(state.trees, id).node; return n.boxW ? n.boxW[0] : null; });`);
    ok(J(dbl) === J([null, null, 300]), 'so a double-click on the grip of one of them', J(dbl));
}

console.log('\n-- 4. undo --');
{
    const r = ev(`${MAP} selectedIds = ['A-0', 'B-0']; render();
        document.querySelector('[data-node-id="A"][data-node-idx="0"] .collapse-btn').click(); undo();
        return ['A', 'B', 'C'].map(function (id) { return isBoxCollapsed(findNodeContext(state.trees, id).node, 0); });`);
    ok(J(r) === J([false, false, false]), 'one undo takes back a collapse of several', J(r));
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
