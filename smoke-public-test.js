'use strict';
// Smoke test for the PUBLIC (built) copy: proves the mangle/strip did not
// break the app, that inline handlers still resolve to their (renamed)
// functions, and that the private commentary is genuinely gone.
//
// Run:  node smoke-public-test.js [argument-mapper-public.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = process.argv[2] || (__dirname + '/argument-mapper-public.html');
const HTML = fs.readFileSync(FILE, 'utf8');

const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, label, detail) {
    if (c) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

function makeWin(label) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e))));
    function stubs(win) {
        const { webcrypto } = require('crypto');
        if (!win.crypto || !win.crypto.randomUUID) Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
        win.matchMedia = win.matchMedia || (() => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }));
        win.ResizeObserver = win.ResizeObserver || function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
        const ctx = new Proxy({}, { get: (_t, p) => p === 'measureText' ? (() => ({ width: 0 })) : (() => ctx) });
        win.HTMLCanvasElement.prototype.getContext = () => ctx;
        win.indexedDB = win.indexedDB || { open() { const r = {}; setTimeout(() => r.onerror && r.onerror({ target: { error: new Error('x') } }), 0); return r; }, deleteDatabase() { const r = {}; setTimeout(() => r.onsuccess && r.onsuccess({}), 0); return r; } };
        win.requestAnimationFrame = win.requestAnimationFrame || (cb => win.setTimeout(() => cb(Date.now()), 0));
        win.cancelAnimationFrame = win.cancelAnimationFrame || win.clearTimeout;
        win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true; win.prompt = () => null; win.open = () => null;
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}

(async () => {
    console.log('=== public build smoke test: ' + require('path').basename(FILE) + ' ===');

    // --- Static hygiene checks (no boot needed) --------------------------
    ok(HTML.indexOf('Copyright (c)') >= 0 && HTML.indexOf('AGPL-3.0') >= 0,
        'banner: copyright + AGPL licence notice present');
    ok(HTML.indexOf('WITHOUT WARRANTY OF ANY KIND') >= 0, 'banner: warranty disclaimer present');
    ok(/Complete corresponding source: \S+/.test(HTML), 'banner: source offer present (AGPL §13)');
    // Offline self-containment: no tag may FETCH anything over the network.
    // (An <a href> to the source repo is a link, not a request — allowed.)
    {
        const loaders = HTML.match(/<(?:script|link|img|iframe|video|audio|source)\b[^>]*https?:\/\/[^>]*>/gi) || [];
        ok(loaders.length === 0, 'offline: no external resource requests remain', loaders.slice(0, 2).join(' | '));
        ok(HTML.indexOf('data:font/woff2;base64') >= 0, 'offline: KaTeX fonts are embedded');
        ok(HTML.indexOf('katex') >= 0, 'offline: KaTeX itself is embedded');
    }
    const privateTells = ['HONEST LIMIT', 'field report', 'the exact reported bug', 'defect 3', 'KEEP IN SYNC', 'Single chokepoint for'];
    const leaked = privateTells.filter(s => HTML.indexOf(s) >= 0);
    ok(leaked.length === 0, 'strip: private commentary is gone', leaked.join(','));
    // Minify gauge: terser collapses the ~700 KB app script onto essentially
    // one line, so the longest line should be enormous.
    const maxLine = HTML.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
    ok(maxLine > 50000, 'minify: the app script collapsed to one long line', 'maxLine=' + maxLine);

    const W = makeWin('pub');
    await sleep(360);
    const g = W.win.__argmap;
    ok(!!g, 'boot: __argmap support hook still exported');
    ok(W.errors.length === 0, 'boot: no runtime errors', W.errors.slice(0, 2).join(' | '));

    // --- Inline handlers still resolve (the mangle-safety proof) ----------
    // These are the exact global names the static HTML and generated markup
    // call via onclick=""; if the mangle renamed them, they'd be undefined.
    const handlerNames = ['addChild', 'addCoPremise', 'changeSelectedTypes', 'cycleEvaluation',
        'toggleImplicit', 'cutNode', 'copyNode', 'pasteNode', 'saveMap', 'manualLocalSave',
        'newMap', 'openStringMode', 'applyStringMode', 'toggleHelp', 'toggleCollabPanel',
        'closeCollabPanel', 'toggleEvalOverview', 'recenter', 'loadMap', 'importTextFile',
        'toggleReviewMode', 'togglePresentMode', 'deleteSelected'];
    const missing = handlerNames.filter(n => typeof W.win[n] !== 'function');
    ok(missing.length === 0, 'handlers: every inline-onclick function is still callable', 'missing: ' + missing.join(','));

    // --- Drive behavior through the PUBLIC surface only ------------------
    // In the mangled build, top-level names (state, render, mergeStates, ...)
    // no longer exist under their source names — reaching them only through
    // window.* handlers and __argmap is precisely what proves the obfuscation
    // took while the app still works. `__argmap.state` returns the live
    // object, so mutating its properties drives the real app.
    W.win.eval(`
        __argmap.state.trees = [{ id:'r', type:'contention', texts:['Root claim'], collapsed:[], children:[] }];
        __argmap.selectedIds = ['r-0'];
    `);
    W.win.addChild('support');   // an inline-onclick handler; renders internally
    const kids = W.win.__argmap.state.trees[0].children.length;
    ok(kids === 1, 'behavior: addChild() (inline handler) adds a support node', 'children=' + kids);

    // String Mode export through the handlers + the S/() shorthand.
    // NOTE: this test must never name an internal id or hyphenated class —
    // the build renames both. Everything below is reached through the app's
    // stable public surface: inline-handler globals, __argmap, tag names and
    // data-* attributes. The string editor is located structurally (the one
    // textarea holding the exported map text).
    const exported = W.win.eval(`
        __argmap.state.trees = [{ id:'c', type:'contention', texts:['Main'], collapsed:[], children:[
            { id:'s', type:'support', texts:['A','B'], implicits:[true,false], collapsed:[], children:[] } ] }];
        openStringMode();
        var v = '';
        Array.prototype.slice.call(document.querySelectorAll('textarea')).forEach(function (t) {
            if (t.value && t.value.indexOf('M1') === 0) v = t.value;
        });
        closeStringMode();
        v;
    `);
    ok(exported.indexOf('(M1S1a): A') >= 0 && exported.indexOf('M1S1b: B') >= 0,
        'behavior: S-label + implicit-parenthesis export works in the built code', exported.replace(/\n/g, ' | '));

    // String Mode import (applyStringMode is an inline handler).
    W.win.eval(`
        openStringMode();
        Array.prototype.slice.call(document.querySelectorAll('textarea')).forEach(function (t) {
            if (t.value && t.value.indexOf('M1') === 0) t.value = 'M1: X\\n  M1S1a: Y';
        });
        applyStringMode();
    `);
    const parsedType = W.win.__argmap.state.trees[0].children[0].type;
    ok(parsedType === 'support', 'behavior: built parser reads S labels', String(parsedType));

    // Merge engine intact (its function was mangled; reached via __argmap).
    const conv = W.win.eval(`
        (function(){
            var a = __argmap.state;
            var b = JSON.parse(JSON.stringify(a));
            var m = __argmap.mergeStates(a, b, {});
            return !!m && Array.isArray(m.trees);
        })();
    `);
    ok(conv === true, 'behavior: mergeStates() still runs in the built code');

    // --- names ASSEMBLED AT RUNTIME survived the vocabulary rename --------
    // Regression guard for a real build bug: the rename rewrote the static
    // definitions (`id="arrow-support"`, `.type-objection`) while the app
    // still builds those names at runtime (`arrow-${type}`, `node type-${t}`),
    // so arrowheads disappeared and every node drew in the support colour.
    // jsdom applies no CSS, so this checks the CLASS/id wiring rather than the
    // painted colour — the browser check in BUILD-AND-DEPLOY covers the paint.
    {
        const dyn = W.win.eval(`
            __argmap.state.trees = [{ id:'m', type:'contention', texts:['Main'], collapsed:[], children:[
                { id:'s', type:'support',   texts:['S'], collapsed:[], children:[] },
                { id:'o', type:'objection', texts:['O'], collapsed:[], children:[] },
                { id:'r', type:'rebuttal',  texts:['R'], collapsed:[], children:[] } ] }];
            __argmap.selectedIds = ['m-0'];
            cycleLabels(); cycleLabels(); cycleLabels();   // reserved handler; renders (render() itself is mangled)
            (function () {
                var cls = ['s','o','r'].map(function (id) {
                    var el = document.querySelector('[data-node-id="' + id + '"]');
                    return el ? el.className : 'MISSING';
                });
                // Each node must carry a DISTINCT type class, and a rule for it
                // must exist in the stylesheet.
                var sheetText = Array.prototype.slice.call(document.querySelectorAll('style'))
                    .map(function (s) { return s.textContent; }).join('\\n');
                var typeCls = cls.map(function (c) {
                    var m = /(^|\\s)([\\w-]*type[\\w-]*)/.exec(c); return m ? m[2] : '';
                });
                var styled = typeCls.every(function (t) { return t && sheetText.indexOf('.' + t) >= 0; });
                var markers = Array.prototype.slice.call(document.querySelectorAll('svg path'))
                    .map(function (p) { return p.getAttribute('marker-end'); })
                    .filter(Boolean)
                    .map(function (u) { var id = (u.match(/#(.+?)\\)/) || [])[1];
                                        return !!(id && document.getElementById(id)); });
                return JSON.stringify({
                    distinctTypeClasses: new Set(typeCls).size,
                    everyTypeStyled: styled,
                    markerCount: markers.length,
                    everyMarkerResolves: markers.length > 0 && markers.every(Boolean)
                });
            })();
        `);
        const d = JSON.parse(dyn);
        ok(d.distinctTypeClasses === 3, 'runtime names: each node type gets its own class', JSON.stringify(d));
        ok(d.everyTypeStyled === true, 'runtime names: every type class still has a stylesheet rule', JSON.stringify(d));
        ok(d.everyMarkerResolves === true, 'runtime names: every arrowhead marker reference resolves', JSON.stringify(d));
    }

    // Collaboration surface still present (deployed app needs it).
    ok(!!g.collab && typeof g.collab.buildLink === 'function', 'collab: bring-your-own-backend link builder intact');
    ok(typeof g.createFirebaseTransport === 'function', 'collab: Firebase transport factory intact');

    // Rich-text escaping still neutralizes a hostile string. renderRichText
    // is mangled and not exposed, so verify through the DOM: a node whose
    // text is a hostile string must render with NO live <img> element.
    const domSafe = W.win.eval(`
        __argmap.state.trees = [{ id:'x', type:'contention', texts:['<img src=x onerror=alert(1)>'], collapsed:[], children:[] }];
        __argmap.selectedIds = ['x-0'];
        cycleLabels(); cycleLabels(); cycleLabels();   // each renders; net label mode unchanged
        // data-* attributes are never renamed, so this locator survives the
        // vocabulary pass (unlike a .rendered-text class selector would).
        var host = document.querySelector('[data-node-id="x"]');
        (function(){
            if (!host) return 'no-render';
            var hasLiveImg = host.querySelector('img') ? 'LIVE-IMG' : 'safe';
            var literal = host.textContent.indexOf('onerror') >= 0 ? 'literal-shown' : 'no-literal';
            return hasLiveImg + ':' + literal;
        })();
    `);
    ok(domSafe === 'safe:literal-shown' || domSafe === 'safe:no-literal',
        'security: a hostile node text renders with no live <img> (escaped in the built code)', String(domSafe));

    console.log(`\n--- public smoke: ${pass} passed, ${fail} failed ---`);
    try { W.win.close(); } catch (e) {}
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e && e.stack || e); process.exit(2); });
