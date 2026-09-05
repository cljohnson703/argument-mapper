'use strict';

// Regression coverage for dismissing the right-click / long-press context
// menu.  The menu used to close only on `mousedown`, which meant it survived
// any press that landed on a node: the node's own pointerdown handler calls
// preventDefault() (via initPointerDrag, to suppress text selection and touch
// scrolling), and cancelling pointerdown suppresses the compatibility mouse
// events entirely.  It also stops propagation, so a bubble-phase document
// listener would not have heard the press even if one had been dispatched.
// The closer therefore listens on pointerdown in the capture phase.
//
// The counterweight is the touch long-press: when the finger lifts, the
// browser dispatches a compatibility mousedown/mouseup/click burst AT the
// press point, which is where the menu was just drawn.  armPostGestureEater()
// swallows that burst from the capture phase, so the mousedown half of the
// closer has to stay on the bubble phase to remain downstream of it.

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { JSDOM, VirtualConsole } = require('jsdom');

const htmlPath = process.argv[2] || path.join(__dirname, 'argument-mapper-r27.html');
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
        url: 'https://localhost/argument-mapper-r27.html',
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

const menu = win => win.document.getElementById('context-menu');
const isOpen = win => menu(win).classList.contains('open');

function pointerDown(win, target, opts = {}) {
    const event = new win.PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: opts.pointerId || 1,
        pointerType: opts.pointerType || 'mouse',
        button: opts.button || 0,
        clientX: opts.clientX || 0, clientY: opts.clientY || 0
    });
    target.dispatchEvent(event);
    return event;
}

function mouseDown(win, target, opts = {}) {
    const event = new win.MouseEvent('mousedown', {
        bubbles: true, cancelable: true,
        button: opts.button || 0,
        clientX: opts.clientX || 0, clientY: opts.clientY || 0
    });
    target.dispatchEvent(event);
    return event;
}

function openOnNode(win, nodeDiv) {
    const event = new win.MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, clientX: 120, clientY: 90
    });
    nodeDiv.dispatchEvent(event);
    return event;
}

// A pointerdown that reached a node body leaves a pending drag behind; clear
// it so the next step starts from a neutral pointer state.
function releasePointer(win, pointerType = 'mouse') {
    win.document.dispatchEvent(new win.PointerEvent('pointerup', {
        bubbles: true, cancelable: true, pointerId: 1, pointerType
    }));
}

async function testPressAwayClosesTheMenu() {
    const { dom, win, errors } = makeWindow();
    try {
        await wait(150);
        // Two boxes: the menu is opened on one and the dismissing press lands
        // on the other, so the close cannot be mistaken for a same-element
        // quirk.  The boot map ships with a single root, so add one.
        win.document.dispatchEvent(new win.KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, code: 'KeyA', key: 'a'
        }));
        await wait(120);
        const nodes = win.document.querySelectorAll('.node');
        ok(nodes.length >= 2, `two node boxes are available to press (got ${nodes.length})`);
        const [nodeA, nodeB] = nodes;

        openOnNode(win, nodeA);
        ok(isOpen(win), 'right-clicking a node opens the context menu');

        // The regression itself.  This press is the one that used to leave the
        // menu stranded: the node cancels it, so no mousedown ever follows.
        const onNode = pointerDown(win, nodeB, { clientX: 300, clientY: 300 });
        ok(onNode.defaultPrevented,
            'a node still cancels pointerdown (so no compatibility mousedown follows)');
        ok(!isOpen(win), 'pressing on another node closes the context menu');
        releasePointer(win);

        openOnNode(win, nodeA);
        ok(isOpen(win), 'the menu reopens on the same node');
        const insideMenu = menu(win).querySelector('.ctx-item, .ctx-row button');
        ok(!!insideMenu, 'the open menu contains at least one actionable item');
        pointerDown(win, insideMenu, { clientX: 130, clientY: 110 });
        ok(isOpen(win), 'pressing inside the menu leaves it open');

        // Everything outside closes it, whether or not that surface has its
        // own pointer handling.
        pointerDown(win, win.document.getElementById('canvas'), { clientX: 500, clientY: 400 });
        ok(!isOpen(win), 'pressing empty canvas closes the menu');

        openOnNode(win, nodeA);
        const toolbarBtn = win.document.querySelector('#toolbar-wrapper button, #toolbar button');
        ok(!!toolbarBtn, 'the toolbar exposes a button to press');
        pointerDown(win, toolbarBtn);
        ok(!isOpen(win), 'pressing a toolbar button closes the menu');

        openOnNode(win, nodeA);
        pointerDown(win, win.document.body, { clientX: 700, clientY: 20 });
        ok(!isOpen(win), 'pressing bare page chrome closes the menu');

        // The mousedown fallback survives for input that emits no pointer
        // events at all.
        openOnNode(win, nodeA);
        mouseDown(win, win.document.getElementById('canvas'), { clientX: 500, clientY: 400 });
        ok(!isOpen(win), 'a bare mousedown outside still closes the menu');

        openOnNode(win, nodeA);
        win.document.dispatchEvent(new win.KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, code: 'Escape', key: 'Escape'
        }));
        ok(!isOpen(win), 'Escape still closes the menu');

        ok(errors.length === 0, 'press-away run has no runtime errors: ' + errors.join(' | '));
    } finally {
        dom.window.close();
    }
}

async function testLongPressSurvivesItsOwnGesture() {
    const { dom, win, errors } = makeWindow();
    try {
        await wait(150);
        const nodeDiv = win.document.querySelector('.node');
        ok(!!nodeDiv, 'the boot map renders a node to long-press');

        // Finger down: this pointerdown precedes the menu, so it must not be
        // the one that closes it.
        pointerDown(win, nodeDiv, { pointerType: 'touch', clientX: 140, clientY: 160 });
        ok(!isOpen(win), 'the menu is not open while the press is still building');
        await wait(600);
        ok(isOpen(win), 'a ~500ms touch hold opens the context menu');

        // Finger up: the browser replays the press as mousedown/mouseup/click
        // at the press point, which is now underneath the menu.
        releasePointer(win, 'touch');
        mouseDown(win, nodeDiv, { clientX: 140, clientY: 160 });
        ok(isOpen(win), 'the compatibility mousedown burst does not dismiss the fresh menu');

        // A genuinely new tap does dismiss it.
        pointerDown(win, win.document.getElementById('canvas'),
            { pointerType: 'touch', pointerId: 2, clientX: 500, clientY: 420 });
        ok(!isOpen(win), 'the next tap elsewhere closes the long-press menu');

        ok(errors.length === 0, 'long-press run has no runtime errors: ' + errors.join(' | '));
    } finally {
        dom.window.close();
    }
}

(async () => {
    await testPressAwayClosesTheMenu();
    await testLongPressSurvivesItsOwnGesture();
    console.log(`PASS: ${passed}/${passed} context-menu dismissal assertions`);
})().catch(error => {
    console.error(error && error.stack || error);
    process.exitCode = 1;
});
