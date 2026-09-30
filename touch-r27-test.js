'use strict';
// r27.62: what a mouse can do, on a touch screen too.
//
// The user (2026-09-29): "As for the features that desktop has that touch
// screens don't (especially iOS), let's try figuring out how we could
// implement them. If it's impossible to implement them (like saving back to
// the same file on iOS), we can either implement a workaround or just note it
// somewhere." And of the touch-only Free drop button: "I guess we don't need
// this now that we have the placement button."
//
// Covers:
//   (1) press and hold a control: its tooltip (keys left out), and the tap
//       that ends the hold does nothing; a box's controls open no box menu;
//   (2) press and hold a link: its menu, and the link is not followed;
//   (3) a comment's Reply / Edit / Delete stay shown where nothing hovers;
//   (4) resize a box by its corner with a finger; a double tap resets it;
//   (5) Select More: taps add boxes to the selection, until Done;
//   (6) Link a Premise… and Link to Web Address… from a box's menu, where its
//       text was last edited;
//   (7) on an iPhone or iPad, saving opens the share sheet;
//   (8) the Free drop button is gone; Help says what a touch screen does,
//       and what it cannot.
//
// Run:  node touch-r27-test.js [argument-mapper-r27.html]
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

function makeWin(label, opts) {
    opts = opts || {};
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
    function stubs(win) {
        const { webcrypto } = require('crypto');
        if (!win.crypto || !win.crypto.randomUUID) Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
        win.matchMedia = q => ({ matches: !!opts.coarse && /pointer:\s*coarse|hover:\s*none/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
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
        if (opts.ios) {
            Object.defineProperty(win.navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', configurable: true });
            win.__shared = [];
            win.navigator.canShare = d => !!(d && d.files && d.files.length);
            win.navigator.share = d => { win.__shared.push({ name: d.files[0].name, type: d.files[0].type }); return Promise.resolve(); };
        }
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}

const HELPERS = `
    window.__t = {
        load() {
            state.trees = [
                { id: 'r', type: 'contention', texts: ['Main.'], collapsed: [], children: [
                    { id: 'a', type: 'support', texts: ['A, see [the site](https://example.com).'], collapsed: [], children: [
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
        node(id) { return findNodeContext(state.trees, id).node; },
        ev(type, x, extra) {
            return new PointerEvent(type, Object.assign({ bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
                pointerId: 1, isPrimary: true, pointerType: 'touch', clientX: x, clientY: 20, screenX: x, screenY: 20 }, extra || {}));
        },
        tap(el, x) {
            el.dispatchEvent(this.ev('pointerdown', x || 20));
            el.dispatchEvent(this.ev('pointerup', x || 20));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x || 20, clientY: 20 }));
        }
    };
`;
const T = (W, body) => JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`));

(async () => {
    console.log('=== r27.62 touch screens ===');
    const W = makeWin('touch', { coarse: true });
    await sleep(250);
    W.win.eval(HELPERS);

    console.log('\n-- (1) press and hold a control: what it does --');
    W.win.eval(`__t.load(); window.__zf = 0; zoomToFit = function () { window.__zf++; };
        window.__el = document.getElementById('zoomfit-indicator');
        __el.dispatchEvent(__t.ev('pointerdown', 20));`);
    await sleep(600);
    const tip = T(W, `const t = document.querySelector('.touch-tip');
        const r = { shown: !!t, words: t && t.textContent };
        __el.dispatchEvent(__t.ev('pointerup', 20));
        __el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        r.ran = window.__zf;
        __el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        r.later = window.__zf;
        return r;`);
    ok(tip.shown && tip.words === 'Zoom to fit', 'held, the Zoom to Fit button shows what it does (its key left out)', JSON.stringify(tip));
    ok(tip.ran === 0 && tip.later === 1, 'the tap that ends the hold does nothing; a tap after that works as ever', JSON.stringify(tip));
    W.win.eval(`__t.load(); window.__col = __t.box('a').querySelector('.collapse-btn'); __col.dispatchEvent(__t.ev('pointerdown', 20));`);
    await sleep(600);
    const col = T(W, `const r = { tip: (document.querySelector('.touch-tip') || {}).textContent || null, menu: document.getElementById('context-menu').classList.contains('open') };
        __col.dispatchEvent(__t.ev('pointerup', 20));
        return r;`);
    ok(col.tip && /children/.test(col.tip) && !col.menu, 'held, a box\'s collapse button shows what it does, and opens no box menu', JSON.stringify(col));

    console.log('\n-- (2) press and hold a link: its menu --');
    W.win.eval(`__t.load(); window.__a = __t.box('a').querySelector('a.node-link');
        window.__opened = 0; window.open = function () { window.__opened++; };
        __a.dispatchEvent(__t.ev('pointerdown', 20));`);
    await sleep(600);
    const link = T(W, `const menu = document.getElementById('link-menu');
        const r = { menu: menu ? [...menu.querySelectorAll('button')].map(b => b.textContent) : null };
        __a.dispatchEvent(__t.ev('pointerup', 20));
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        __a.dispatchEvent(click);
        r.followed = !click.defaultPrevented; r.stillOpen = !!document.getElementById('link-menu');
        return r;`);
    ok(link.menu && link.menu.includes('Open link') && link.menu.includes('Edit URL…') && link.menu.includes('Convert to plain text'),
        'held, a link opens its menu, as a right-click does', JSON.stringify(link));
    ok(!link.followed && link.stillOpen, 'and the tap that ends the hold neither follows the link nor closes the menu', JSON.stringify(link));

    console.log('\n-- (3) comment buttons where nothing hovers --');
    {
        const css = T(W, `return [...document.querySelectorAll('style')].map(s => s.textContent).join('\\n');`);
        ok(/@media \(hover: none\) \{\s*\.eval-comment-actions \{ display: flex; \}/.test(css), 'on a touch screen a comment\'s Reply, Edit and Delete stay shown');
    }

    console.log('\n-- (4) resize by the corner --');
    {
        const grip = T(W, `__t.load();
            const g = __t.box('b').querySelector('.touch-grip');
            g.dispatchEvent(__t.ev('pointerdown', 100));
            document.dispatchEvent(__t.ev('pointermove', 160));
            document.dispatchEvent(__t.ev('pointerup', 160));
            const w = (__t.node('b').boxW || {})[0];
            const g2 = __t.box('b').querySelector('.touch-grip');
            g2.dispatchEvent(__t.ev('pointerdown', 50)); document.dispatchEvent(__t.ev('pointerup', 50));
            __t.box('b').querySelector('.touch-grip').dispatchEvent(__t.ev('pointerdown', 50)); document.dispatchEvent(__t.ev('pointerup', 50));
            return { has: !!g, title: g && g.title, w, after: (__t.node('b').boxW || {})[0] };`);
        ok(grip.has && /wider or narrower/.test(grip.title || '') && typeof grip.w === 'number' && grip.w > 180,
            'every box has a grip for a finger; dragged, it widens the box', JSON.stringify(grip));
        ok(grip.after === undefined, 'a double tap on the grip resets the width', JSON.stringify(grip));
    }

    console.log('\n-- (5) Select More --');
    {
        const more = T(W, `__t.load();
            selectedIds = ['a-0']; updateSelectionVisuals();
            showContextMenu(10, 10, 'a', 0);
            const item = [...document.querySelectorAll('#context-menu .ctx-item')].find(b => /Select More/.test(b.textContent));
            if (item) item.click();
            const hint = document.getElementById('crossref-hint');
            const r = { item: !!item, on: selectMoreMode, hint: hint.classList.contains('visible') && /Tap boxes/.test(hint.textContent) };
            __t.box('b').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            __t.box('k').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            __t.box('b').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            r.sel = selectedIds.slice().sort();
            r.editing = !!(document.activeElement && document.activeElement.tagName === 'TEXTAREA' && !document.activeElement.readOnly);
            document.getElementById('select-more-done').click();
            r.after = { on: selectMoreMode, hint: hint.classList.contains('visible') };
            __t.box('b').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            r.plain = selectedIds.slice();
            return r;`);
        ok(more.item && more.on && more.hint, 'a box\'s menu on a touch screen has Select More…, which says what to do', JSON.stringify(more));
        ok(JSON.stringify(more.sel) === JSON.stringify(['a-0', 'k-0']) && !more.editing,
            'then each tap adds a box or takes it out (b in, k in, b out), and opens no text', JSON.stringify(more));
        ok(!more.after.on && !more.after.hint && JSON.stringify(more.plain) === JSON.stringify(['b-0']), 'Done ends it: a tap selects one box again', JSON.stringify(more));
    }

    console.log('\n-- (6) links from a box\'s menu --');
    {
        const lp = T(W, `__t.load();
            editNodeText('b', 0);
            const ta = document.activeElement;
            ta.value = 'B, as with  in view.'; ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.setSelectionRange(11, 11);
            ta.blur();
            showContextMenu(10, 10, 'b', 0);
            const items = [...document.querySelectorAll('#context-menu .ctx-item')].map(b => b.textContent);
            [...document.querySelectorAll('#context-menu .ctx-item')].find(b => /Link a Premise/.test(b.textContent)).click();
            const armed = !!boxLinkPicking;
            __t.box('k').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return { items: items.filter(t => /Link/.test(t)), armed, text: __t.node('b').texts[0],
                editing: document.activeElement && document.activeElement.tagName === 'TEXTAREA' && !document.activeElement.readOnly };`);
        ok(lp.items.includes('Link a Premise…') && lp.items.includes('Link to Web Address…'), 'a box\'s menu has Link a Premise… and Link to Web Address…', JSON.stringify(lp.items));
        ok(lp.armed && /^B, as with \[S\d+\]\(#box:k\) in view\.$/.test(lp.text) && lp.editing,
            'Link a Premise… puts the link where the text was last edited, and opens the box again', JSON.stringify(lp));
        const web = T(W, `__t.load();
            editNodeText('b', 0);
            const ta = document.activeElement;
            ta.value = 'B, see the source.'; ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.setSelectionRange(7, 17);
            ta.blur();
            prompt = function () { return 'https://example.org'; };
            linkWebAddressInto('b', 0);
            return __t.node('b').texts[0];`);
        ok(web === 'B, see [the source](https://example.org).', 'Link to Web Address… links the words last selected', web);
    }

    console.log('\n-- (8) Free drop gone; Help --');
    {
        const h = T(W, `return { freeDrop: !!document.getElementById('freedrop-indicator'), help: document.getElementById('help-panel').textContent };`);
        ok(!h.freeDrop, 'the touch-only Free drop button is gone');
        ok(/On a touch screen/.test(h.help) && /Select More/.test(h.help) && /Save to Files/.test(h.help) && /no Full Screen/.test(h.help),
            'Help says what a touch screen does, and what it cannot (saving back to a file, Full Screen on an iPhone)');
    }
    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    W.dom.window.close();

    console.log('\n-- (7) saving on an iPhone --');
    const I = makeWin('ios', { coarse: true, ios: true });
    await sleep(250);
    const ios = JSON.parse(I.win.eval(`JSON.stringify((function () {
        downloadBlob(new Blob(['{}'], { type: 'application/json' }), 'map.json');
        return { ios: IOS_DEVICE, shared: window.__shared };
    })())`));
    ok(ios.ios && ios.shared.length === 1 && ios.shared[0].name === 'map.json' && ios.shared[0].type === 'application/json',
        'on an iPhone, saving hands the file to the share sheet (Save to Files, in a folder of one\'s choice)', JSON.stringify(ios));
    const D = makeWin('desk', {});
    await sleep(250);
    ok(D.win.eval('IOS_DEVICE') === false, 'elsewhere it downloads, as before');
    ok(I.errors.length === 0 && D.errors.length === 0, 'no JSDOM script errors (iPhone, desktop)', I.errors.concat(D.errors).join(' | '));
    I.dom.window.close(); D.dom.window.close();

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
