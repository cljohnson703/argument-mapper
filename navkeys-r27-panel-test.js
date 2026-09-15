'use strict';
// r27 Tab and Enter inside dialogs, panels and keyboard navigation.
//
// Tab adds a co-premise and Enter adds a child, but they are also how a
// keyboard moves between buttons and presses them. The map used to take them
// everywhere: inside the Recent Maps dialog or the Evaluations panel, Tab
// added a box to the map behind it instead of moving to the next button, and
// Enter added a child instead of pressing the focused one.
//
// They now go to the page when a dialog is open, when focus is on a control
// reached by keyboard, or when focus is inside an open panel and the last
// click was there. Mouse users must keep working: clicking a node never moves
// focus, so a panel button can stay focused while someone works on the map --
// a click on the map must make Tab mean the map again.
//
// jsdom has no :focus-visible; the keyboard-focus case stubs Element.matches
// for that one selector.
//
// Run:  node navkeys-r27-panel-test.js [argument-mapper-r27.html]
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

const HELPERS = `
    window.__kbFocus = null;
    (function () {
        var real = Element.prototype.matches;
        Element.prototype.matches = function (sel) {
            if (sel === ':focus-visible') return this === window.__kbFocus;
            return real.call(this, sel);
        };
    })();
    window.__n = {
        load() {
            state.trees = [{ id: 'm', type: 'contention', texts: ['Main'], collapsed: [], children: [
                { id: 's', type: 'support', texts: ['S'], collapsed: [], children: [] } ] }];
            ensureCollabFields(state);
            ['#help-modal-backdrop', '#recent-modal-backdrop', '#eval-overview-panel'].forEach(function (q) {
                var el = document.querySelector(q); if (el) el.classList.remove('open'); });
            if (typeof evalOverviewOpen !== 'undefined' && evalOverviewOpen) toggleEvalOverview();
            window.__kbFocus = null;
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            render();
            selectedIds = ['s-0']; updateSelectionVisuals();
            this.press(document.getElementById('canvas'));   // start with the last click on the map
        },
        press(el) {
            el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
            document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
        },
        counts() {
            var s = findNodeContext(state.trees, 's').node;
            return { boxes: s.texts.length, children: s.children.length };
        },
        key(code, opts) {
            var target = document.activeElement || document.body;
            var ev = new KeyboardEvent('keydown', Object.assign({ code: code, key: code, bubbles: true, cancelable: true }, opts || {}));
            target.dispatchEvent(ev);
            var ae = document.activeElement;
            if (ae && ae.tagName === 'TEXTAREA' && !ae.readOnly) ae.blur();
            return ev.defaultPrevented;
        },
        // Tab then Enter from the current focus, reporting what the map did.
        both(refocus) {
            var before = this.counts();
            var tabTaken = this.key('Tab');
            if (refocus) refocus();
            var enterTaken = this.key('Enter');
            var after = this.counts();
            return { tabTaken: tabTaken, enterTaken: enterTaken,
                     boxesAdded: after.boxes - before.boxes, childrenAdded: after.children - before.children };
        }
    };
`;
const T = (W, body) => {
    try { return JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`)); }
    catch (e) { return { __error: String((e && e.message) || e) }; }
};

(async () => {
    console.log('=== r27 Tab and Enter: page or map ===');
    const W = makeWin('navkeys');
    await sleep(250);
    W.win.eval(HELPERS);

    console.log('\n-- the map (unchanged) --');
    {
        const r = T(W, `__n.load(); return __n.both();`);
        ok(r.boxesAdded === 1 && r.childrenAdded === 1 && r.tabTaken && r.enterTaken,
            'focus on the page: Tab adds a co-premise and Enter adds a child', JSON.stringify(r));
    }

    console.log('\n-- dialogs --');
    {
        const help = T(W, `__n.load(); toggleHelp();
            var c = document.getElementById('help-close'); c.focus();
            var r = __n.both(function () { c.focus(); }); toggleHelp(); return r;`);
        ok(help.boxesAdded === 0 && help.childrenAdded === 0 && !help.tabTaken && !help.enterTaken,
            'Help open: Tab and Enter stay with the dialog and change nothing behind it', JSON.stringify(help));

        const recent = T(W, `__n.load(); openRecentMaps();
            var r = __n.both(function () { var c = document.getElementById('recent-modal-close'); if (c) c.focus(); });
            closeRecentMaps(); return r;`);
        ok(recent.boxesAdded === 0 && recent.childrenAdded === 0,
            'Recent Maps open: Tab no longer adds a box behind it, Enter no longer adds a child', JSON.stringify(recent));
    }

    console.log('\n-- an open panel --');
    {
        const panel = T(W, `__n.load(); toggleEvalOverview();
            var b = document.getElementById('eval-overview-close') || document.querySelector('#eval-overview-panel button');
            __n.press(b); b.focus();
            var r = __n.both(function () { b.focus(); }); r.panelButton = b.id || b.className; return r;`);
        ok(panel.boxesAdded === 0 && panel.childrenAdded === 0 && !panel.tabTaken,
            'Evaluations panel, clicked into: Tab moves focus and Enter presses the button', JSON.stringify(panel));

        const backToMap = T(W, `__n.load(); toggleEvalOverview();
            var b = document.getElementById('eval-overview-close') || document.querySelector('#eval-overview-panel button');
            __n.press(b); b.focus();
            __n.press(document.getElementById('canvas'));   // click the map; focus stays on the panel button
            var stillFocused = document.activeElement === b;
            var r = __n.both(function () { b.focus(); }); r.stillFocused = stillFocused; return r;`);
        ok(backToMap.stillFocused && backToMap.boxesAdded === 1 && backToMap.childrenAdded === 1,
            'but after a click on the map, Tab and Enter mean the map again even though focus never left the panel',
            JSON.stringify(backToMap));

        const closed = T(W, `__n.load(); toggleEvalOverview();
            var b = document.getElementById('eval-overview-close') || document.querySelector('#eval-overview-panel button');
            b.focus(); toggleEvalOverview();
            __n.press(document.querySelector('#toolbar button'));   // last click: not the map, not the panel
            b.focus();
            return __n.both(function () { b.focus(); });`);
        ok(closed.boxesAdded === 1,
            'focus left behind in a CLOSED panel does not swallow Tab', JSON.stringify(closed));
    }

    console.log('\n-- keyboard navigation vs mouse focus --');
    {
        const kb = T(W, `__n.load(); var b = document.getElementById('btn-add-sup'); b.focus(); window.__kbFocus = b;
            var r = __n.both(function () { b.focus(); window.__kbFocus = b; }); window.__kbFocus = null; return r;`);
        ok(kb.boxesAdded === 0 && kb.childrenAdded === 0 && !kb.tabTaken && !kb.enterTaken,
            'a toolbar button reached by keyboard: Tab moves on, Enter presses it', JSON.stringify(kb));

        const mouse = T(W, `__n.load(); var b = document.getElementById('depth-btn');
            __n.press(b); b.focus();
            return __n.both(function () { b.focus(); });`);
        ok(mouse.boxesAdded === 1 && mouse.childrenAdded === 1,
            'a toolbar button a mouse click left focused: Tab and Enter still mean the map (unchanged)', JSON.stringify(mouse));
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
