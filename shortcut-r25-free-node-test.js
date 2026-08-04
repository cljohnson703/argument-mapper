'use strict';

// Focused regression coverage for A versus Shift+A node creation. The test
// drives the real document keydown handler, rather than calling the helper,
// so modifier precedence and editable-field guards are covered as well.

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { JSDOM, VirtualConsole } = require('jsdom');

const htmlPath = process.argv[2] || path.join(__dirname, 'argument-mapper-r25.html');
const html = fs.readFileSync(htmlPath, 'utf8');
let passed = 0;

function ok(condition, label) {
    if (!condition) throw new Error('FAIL: ' + label);
    passed++;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeWindow() {
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', error => errors.push(String(error && (error.detail || error.message || error))));

    const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        url: 'https://localhost/argument-mapper-r25.html',
        virtualConsole,
        beforeParse(win) {
            if (!win.crypto || !win.crypto.randomUUID) {
                Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
            }
            win.matchMedia = win.matchMedia || (() => ({
                matches: false, media: '', addListener() {}, removeListener() {},
                addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
            }));
            win.ResizeObserver = win.ResizeObserver || function () {
                return { observe() {}, unobserve() {}, disconnect() {} };
            };
            let ctx;
            ctx = new Proxy({}, {
                get(_target, prop) {
                    if (prop === 'measureText') return () => ({ width: 0 });
                    if (prop === 'canvas') return null;
                    return () => ctx;
                }
            });
            win.HTMLCanvasElement.prototype.getContext = () => ctx;
            win.Element.prototype.scrollIntoView = function () {};
            win.indexedDB = {
                open() {
                    const request = {};
                    setTimeout(() => request.onerror && request.onerror({ target: { error: new Error('disabled in test') } }), 0);
                    return request;
                },
                deleteDatabase() {
                    const request = {};
                    setTimeout(() => request.onsuccess && request.onsuccess({}), 0);
                    return request;
                }
            };
            // Use window-owned timers so window.close() cancels pending frames
            // instead of letting callbacks touch a torn-down document.
            win.requestAnimationFrame = callback => win.setTimeout(() => callback(Date.now()), 0);
            win.cancelAnimationFrame = id => win.clearTimeout(id);
            win.scrollTo = () => {};
            win.alert = () => {};
            win.confirm = () => true;
            win.prompt = () => null;
        }
    });
    return { dom, win: dom.window, errors };
}

function blurActive(win) {
    const active = win.document.activeElement;
    if (active && typeof active.blur === 'function') active.blur();
}

function pressA(win, modifiers = {}, target = win.document) {
    const event = new win.KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'KeyA',
        key: modifiers.key || (modifiers.shiftKey ? 'A' : 'a'),
        shiftKey: !!modifiers.shiftKey,
        ctrlKey: !!modifiers.ctrlKey,
        metaKey: !!modifiers.metaKey,
        altKey: !!modifiers.altKey
    });
    target.dispatchEvent(event);
    return event;
}

function newestRoot(win) {
    const trees = win.__argmap.state.trees;
    return trees[trees.length - 1];
}

async function testFallbackAndPlainA() {
    const { dom, win, errors } = makeWindow();
    try {
        const canvas = win.document.getElementById('canvas');
        // Boot deliberately recenters once after 100 ms.  Let that timer run
        // before installing this test's synthetic viewport; otherwise the
        // timer can race the pause below and replace scrollLeft/scrollTop
        // between the Shift+A and plain-A assertions.  A real browser clamps
        // the resulting negative scroll values, while JSDOM does not, which
        // made this timing race look like a shortcut regression.
        await wait(120);
        Object.defineProperty(canvas, 'clientWidth', { value: 800, configurable: true });
        Object.defineProperty(canvas, 'clientHeight', { value: 600, configurable: true });
        win.eval('zoomLevel = 2; document.getElementById("surface").style.transform = "scale(2)";');

        function resetSyntheticViewport() {
            canvas.scrollLeft = 1200;
            canvas.scrollTop = 600;
        }
        resetSyntheticViewport();

        const before = win.__argmap.state.trees.length;
        const shiftEvent = pressA(win, { shiftKey: true });
        const free = newestRoot(win);
        ok(shiftEvent.defaultPrevented, 'Shift+A prevents the browser default');
        ok(win.__argmap.state.trees.length === before + 1, 'Shift+A adds exactly one root');
        ok(free.freePosition === true, 'Shift+A marks the new root free-positioned');
        ok(free.x === 710 && free.y === 428, 'no-pointer Shift+A falls back to the zoom-aware viewport center');

        await wait(80);
        const group = win.document.getElementById('group-' + free.id);
        ok(group && group.style.left === free.x + 'px' && group.style.top === free.y + 'px',
            'the free root remains pinned through the delayed layout settle');

        blurActive(win);
        // Assert plain A against the same current viewport as Shift+A.  This
        // is intentionally a fresh read, not reuse of a cached fallback.
        resetSyntheticViewport();
        const beforePlain = win.__argmap.state.trees.length;
        pressA(win);
        const ordinary = newestRoot(win);
        ok(win.__argmap.state.trees.length === beforePlain + 1, 'plain A still adds exactly one root');
        ok(ordinary.freePosition === undefined, 'plain A retains ordinary unpinned placement');
        ok(ordinary.x === 710 && ordinary.y === 428,
            `plain A retains the same viewport fallback anchor (got ${ordinary.x}, ${ordinary.y})`);
        ok(errors.length === 0, 'fallback/plain-A run has no runtime errors: ' + errors.join(' | '));
    } finally {
        dom.window.close();
    }
}

async function testFreshCursorUndoAndPersistence() {
    const { dom, win, errors } = makeWindow();
    try {
        const canvas = win.document.getElementById('canvas');
        const surface = win.document.getElementById('surface');
        let surfaceLeft = -1000;
        let surfaceTop = -500;
        surface.getBoundingClientRect = () => ({
            left: surfaceLeft, top: surfaceTop, right: surfaceLeft + 60000,
            bottom: surfaceTop + 60000, width: 60000, height: 60000
        });

        win.eval('zoomLevel = 1;');
        canvas.dispatchEvent(new win.MouseEvent('mousemove', {
            bubbles: true, clientX: 200, clientY: 100
        }));

        // Move/scale the surface without another pointer event. Storing the old
        // surface point would place at (1200, 600); recomputing from the saved
        // client point must instead place at (800, 500).
        surfaceLeft = -1400;
        surfaceTop = -900;
        win.eval('zoomLevel = 2;');
        const initialCount = win.__argmap.state.trees.length;
        pressA(win, { shiftKey: true });
        const free = newestRoot(win);
        const freeId = free.id;
        ok(free.x === 710 && free.y === 478,
            'Shift+A recomputes the cursor map point after pan/zoom');

        win.undo();
        ok(win.__argmap.state.trees.length === initialCount,
            'one undo removes the Shift+A node');
        ok(!win.__argmap.state.trees.some(node => node.id === freeId),
            'undo removes the correct free root');
        win.redo();
        const restored = win.__argmap.state.trees.find(node => node.id === freeId);
        ok(restored && restored.freePosition === true && restored.x === 710 && restored.y === 478,
            'redo restores the free flag and exact coordinates');

        win.autosaveNow();
        // Maps are stored one slot per map (argmap-map:<id>) so that starting
        // a new map cannot overwrite another; the old single 'argmap-autosave'
        // slot is only read once, to migrate it.
        const saved = JSON.parse(win.localStorage.getItem('argmap-map:' + win.__argmap.state._mapId));
        const persisted = saved.trees.find(node => node.id === freeId);
        ok(persisted && persisted.freePosition === true && persisted.x === 710 && persisted.y === 478,
            'autosave persists the free flag and coordinates');
        ok(!!win.__argmap.state._moveVersions[freeId],
            'autosave gives the free placement its move-version stamp');
        ok(errors.length === 0, 'cursor/undo run has no runtime errors: ' + errors.join(' | '));
    } finally {
        dom.window.close();
    }
}

async function testShortcutGuardsAndPrecedence() {
    const { dom, win, errors } = makeWindow();
    try {
        let count = win.__argmap.state.trees.length;
        const search = win.document.getElementById('search-input');
        search.focus();
        pressA(win, { shiftKey: true }, search);
        ok(win.__argmap.state.trees.length === count, 'Shift+A is inert in a search field');

        const textarea = win.document.querySelector('.node textarea');
        textarea.readOnly = false;
        textarea.focus();
        pressA(win, { shiftKey: true }, textarea);
        ok(win.__argmap.state.trees.length === count, 'Shift+A is inert in an editable node textarea');

        textarea.readOnly = true;
        textarea.focus();
        pressA(win, { shiftKey: true }, textarea);
        count++;
        ok(win.__argmap.state.trees.length === count,
            'a focused readonly node retains map-shortcut behavior');
        ok(newestRoot(win).freePosition === true, 'readonly-node Shift+A creates a free root');

        blurActive(win);
        pressA(win, { shiftKey: true, ctrlKey: true });
        ok(win.__argmap.state.trees.length === count, 'Ctrl+Shift+A remains Select All');
        pressA(win, { shiftKey: true, metaKey: true });
        ok(win.__argmap.state.trees.length === count, 'Meta+Shift+A remains Select All');
        pressA(win, { shiftKey: true, altKey: true });
        ok(win.__argmap.state.trees.length === count, 'Alt+Shift+A does not create a node');

        // Uppercase e.key can also be Caps Lock. Only the actual Shift modifier
        // should request free placement.
        blurActive(win);
        pressA(win, { key: 'A' });
        count++;
        ok(win.__argmap.state.trees.length === count, 'uppercase unshifted A still creates a node');
        ok(newestRoot(win).freePosition === undefined,
            'uppercase unshifted A remains ordinary rather than free');

        blurActive(win);
        win.eval('presentMode = true;');
        pressA(win, { shiftKey: true });
        ok(win.__argmap.state.trees.length === count, 'present mode blocks Shift+A');
        win.eval('presentMode = false; reviewMode = true;');
        pressA(win, { shiftKey: true });
        ok(win.__argmap.state.trees.length === count, 'review mode blocks Shift+A');
        win.eval('reviewMode = false;');
        ok(errors.length === 0, 'shortcut-guard run has no runtime errors: ' + errors.join(' | '));
    } finally {
        dom.window.close();
    }
}

(async () => {
    await testFallbackAndPlainA();
    await testFreshCursorUndoAndPersistence();
    await testShortcutGuardsAndPrecedence();
    console.log(`PASS: ${passed}/${passed} Shift+A shortcut assertions`);
})().catch(error => {
    console.error(error && error.stack || error);
    process.exitCode = 1;
});
