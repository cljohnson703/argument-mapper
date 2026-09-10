'use strict';
// r27 edit-mode collapse regression.
//
// enterEditMode opens the editor at the rendered text's height so the box does
// not jitter. It read that height from .rendered-text — which it then hides.
// A SECOND double-click on an already-open editor therefore measured a
// display:none element, got 0, and wrote `height: 0px` onto the textarea: the
// box collapsed to nothing and the text vanished until something else resized
// it. tryFocusTextarea had the same shape.
//
// Covers:
//   * opening from idle still matches the rendered height (the jitter fix);
//   * re-entering an open editor changes nothing — height held, caret and
//     selection untouched, so the browser's own word-select still works;
//   * a real dblclick while editing (on the textarea, and on the 1-2px node
//     padding around it, which is where this was easiest to hit) does not
//     collapse the box;
//   * a zero measurement is never written as a height.
//
// Run:  node editmode-r27-collapse-test.js [argument-mapper-r27.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || (__dirname + '/argument-mapper-r27.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(c, label, detail) {
    if (c) { pass++; console.log('  ✓ ' + label); }
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
        win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true;
        win.prompt = () => null; win.open = () => null;
    }
    const dom = new JSDOM(HTML, {
        runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
        url: `https://localhost/${label}.html`, beforeParse: stubs
    });
    return { dom, errors, get win() { return dom.window; } };
}

const MAP = [{
    id: 'root', type: 'contention', texts: ['Main claim'], collapsed: [], children: [
        { id: 's1', type: 'support', texts: ['A premise long enough to wrap onto more than one line'], collapsed: [], children: [] }
    ]
}];

(async () => {
    console.log('=== r27 edit mode: reopening must not collapse the box ===');
    const W = makeWin('editmode');
    await sleep(360);

    // jsdom reports 0 for every offsetHeight, which is precisely the state
    // that used to produce the bug — so the rendered height is stubbed to a
    // real number. That makes "did a 0 leak through?" observable.
    const res = JSON.parse(W.win.eval(`
        (function () {
            state.trees = ${JSON.stringify(MAP)};
            ensureCollabFields(state);
            selectedIds = [];
            render();
            var box = document.querySelector('.node[data-node-id="s1"]');
            var ta = box.querySelector('textarea');
            var rd = box.querySelector('.rendered-text');
            // Give the rendered div a measurable height the way a browser would.
            Object.defineProperty(rd, 'offsetHeight', {
                configurable: true,
                get: function () { return this.style.display === 'none' ? 0 : 42; }
            });
            Object.defineProperty(ta, 'scrollHeight', { configurable: true, get: function () { return 42; } });

            var out = { steps: [] };
            enterEditMode(box);
            out.steps.push({ at: 'open', h: ta.style.height, rendered: rd.style.display });
            enterEditMode(box);
            out.steps.push({ at: 'reopen', h: ta.style.height });
            enterEditMode(box);
            out.steps.push({ at: 'reopen again', h: ta.style.height });

            // A real dblclick, both on the textarea and on the node padding.
            function dbl(el) { el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); }
            dbl(ta);  out.steps.push({ at: 'dblclick textarea', h: ta.style.height });
            dbl(box); out.steps.push({ at: 'dblclick node padding', h: ta.style.height });

            // The browser selects a word on that second double-click; the app
            // must not yank the caret to the end underneath it.
            ta.setSelectionRange(2, 9);
            var before = [ta.selectionStart, ta.selectionEnd];
            enterEditMode(box);
            out.selection = { before: before, after: [ta.selectionStart, ta.selectionEnd] };

            // The guard must not stop a genuine first open on another box.
            var main = document.querySelector('.node[data-node-id="root"]');
            var mainTa = main.querySelector('textarea');
            var mainRd = main.querySelector('.rendered-text');
            Object.defineProperty(mainRd, 'offsetHeight', {
                configurable: true,
                get: function () { return this.style.display === 'none' ? 0 : 21; }
            });
            enterEditMode(main);
            out.otherBox = { h: mainTa.style.height, rendered: mainRd.style.display };
            return JSON.stringify(out);
        })();
    `));

    const heights = res.steps.map(s => s.h);
    ok(res.steps[0].h === '42px', 'open: the editor matches the rendered height', res.steps[0].h);
    ok(res.steps[0].rendered === 'none', 'open: the rendered text is swapped out');
    ok(heights.every(h => h === '42px'),
        'reopening never changes the height', JSON.stringify(res.steps));
    ok(heights.every(h => h !== '0px' && h !== '0'),
        'a zero measurement is never written as a height', JSON.stringify(heights));
    ok(String(res.selection.before) === String(res.selection.after),
        'a second double-click leaves the selection alone (word-select survives)',
        JSON.stringify(res.selection));
    ok(res.otherBox.h === '21px' && res.otherBox.rendered === 'none',
        'the guard does not block a genuine first open on another box',
        JSON.stringify(res.otherBox));

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));

    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
