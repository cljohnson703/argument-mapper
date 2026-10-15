'use strict';
/**
 * The picture of the map, as the canvas shows it (r27.102; the user,
 * 2026-10-14: "Colors from color mode aren't showing when saving as a PNG.
 * Also, bracketed node names are showing instead of how they show on the
 * canvas. The PNG (and other image types) should look identical to the
 * canvas display save for the map, collapse, and cross-reference buttons
 * (cross-references might need to have some other way of showing their
 * content, e.g., "See NODE#")").
 *
 *   node picture-r27-test.js [argument-mapper-r27.html]
 *
 * 1. A box's words are drawn as the canvas lays them out: each run of text
 *    where it stands, in its own color, weight, slant and opacity; the tints
 *    behind words and their underlines; a formula's fonts gathered to go
 *    into the picture; the screen readers' copy of a formula left out. (On a
 *    layout made up for the test: this one has none.)
 * 2. A label is the small tag the canvas shows, not "[S1]" before the words;
 *    a cross-reference's button is "See M2, S2", the boxes it points to.
 * 3. The selection's ring and deeper shadow are not the map's: taken off
 *    while the picture is drawn, and put back.
 * 4. Colors as the canvas has them: an objection's border in the light
 *    theme, the labels' gray, the lines' colors from the theme on show, each
 *    box's shadow (never inside a see-through box).
 * 5. The math's fonts carried in the picture; the PDF's words measured in
 *    their own weight and slant.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/picture-test', virtualConsole: vc,
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
const texts = svg => (svg.match(/<text [^>]*>[^<]*<\/text>/g) || []);
const textOf = (svg, words) => texts(svg).find(t => t.endsWith('>' + words + '</text>'));
const attr = (tag, name) => { const m = new RegExp(' ' + name + '="([^"]*)"').exec(tag || ''); return m ? m[1] : null; };

// A layout made up for the test: 8px a character, 20px a line (18 tall), a
// word that would pass `width` on the next line; a space at a line's start
// or end, or after another, taking no room. Ranges and elements report their
// rects from it.
W.eval(`window.__laidOut = function (html, width) {
    var root = document.createElement('div');
    root.style.cssText = 'color: rgb(26, 26, 26); font-family: Arial; font-size: 14px';
    root.innerHTML = html;
    document.body.appendChild(root);
    var chars = new Map(), x = 0, y = 0;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (var n = walker.nextNode(); n; n = walker.nextNode()) {
        var list = [];
        for (var i = 0; i < n.data.length; i++) {
            var ch = n.data[i];
            if (ch !== ' ' && (i === 0 || n.data[i - 1] === ' ')) { var word = /^\\S*/.exec(n.data.slice(i))[0]; if (x > 0 && x + word.length * 8 > width) { x = 0; y += 20; } }
            if (ch === ' ') { var next = /^\\S*/.exec(n.data.slice(i + 1))[0];
                if (x === 0 || n.data[i - 1] === ' ' || (next && x + 8 + next.length * 8 > width)) { list.push(null); continue; } }
            list.push({ left: x, top: y, right: x + 8, bottom: y + 18, width: 8, height: 18 });
            x += 8;
        }
        chars.set(n, list);
    }
    var lines = function (rs) { var out = []; rs.forEach(function (r) { var l = out.find(function (q) { return q.top === r.top; });
        if (l) { l.right = Math.max(l.right, r.right); l.width = l.right - l.left; } else out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }); }); return out; };
    var under = function (el) { var rs = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (var t = w.nextNode(); t; t = w.nextNode()) (chars.get(t) || []).forEach(function (r) { if (r) rs.push(r); }); return rs; };
    Array.from(root.querySelectorAll('*')).forEach(function (el) { el.getClientRects = function () { return lines(under(el)); }; });
    root.getClientRects = function () { return [{ left: 0, top: 0, right: width, bottom: y + 18, width: width, height: y + 18 }]; };
    var was = document.createRange;
    document.createRange = function () { var node = null, s = 0, e = 0; return {
        selectNodeContents: function (t) { node = t; s = 0; e = t.data.length; },
        setStart: function (t, i) { node = t; s = i; }, setEnd: function (t, i) { e = i; },
        getClientRects: function () { return lines((chars.get(node) || []).slice(s, e).filter(Boolean)); } }; };
    try {
        var faces = new Set();
        var out = exportLaidOut(root, function (cx) { return cx + 100; }, function (cy) { return cy + 50; }, 1, faces);
        return { out: out, faces: Array.from(faces) };
    } finally { document.createRange = was; root.remove(); }
};`);

console.log('\n-- 1. the words as the canvas lays them out --');
{
    const r = ev(`return __laidOut('If <span style="color: rgb(0, 107, 128); background-color: rgba(0, 170, 205, 0.17)">babies think</span>, then ' +
        '<span style="color: rgb(23, 128, 58); text-decoration-line: underline; text-decoration-style: dashed; text-decoration-color: rgb(198, 40, 40); text-decoration-thickness: 1px; text-underline-offset: 3px">the dog   barks at night</span>. ' +
        '<strong style="font-weight: 700">Bold</strong> <span style="opacity: 0.45">dim</span> <span style="font-family: KaTeX_Math; font-style: italic">x</span><span class="katex-mathml">hidden</span>', 200);`);
    const svg = r.out || '';
    const at = (words) => { const t = textOf(svg, words); return t ? [+attr(t, 'x'), +attr(t, 'y'), attr(t, 'fill')] : null; };
    ok(J(at('If')) === J([100, 50, '#1a1a1a']) && J(at('babies think')) === J([124, 50, '#006b80']) && J(at(', then')) === J([220, 50, '#1a1a1a']),
        'each run of text where it stands, in its own color, from its first printed character', J([at('If'), at('babies think'), at(', then')]));
    ok(J(at('the')) === J([276, 50, '#17803a']) && J(at('dog barks at night')) === J([100, 70, '#17803a']),
        'a run that goes onto the next line is drawn a piece on each, its spaces as the line has them', J([at('the'), at('dog barks at night')]));
    const bold = textOf(svg, 'Bold'), dim = textOf(svg, 'dim'), x = textOf(svg, 'x');
    ok(attr(bold, 'font-weight') === '700' && attr(dim, 'fill-opacity') === '0.45' && attr(x, 'font-style') === 'italic' && /KaTeX_Math/.test(attr(x, 'font-family') || ''),
        'in its weight, its opacity (a dimmed part), its slant and its font', J([bold, dim, x]));
    ok(J(r.faces) === J(['KaTeX_Math|Italic']) && !/hidden/.test(svg), 'a formula\'s fonts are gathered for the picture; the screen readers\' copy is not drawn', J(r.faces));
    ok(/<rect x="124" y="50" width="96" height="18" fill="#00aacd" fill-opacity="0.17"\/>/.test(svg), 'a tint behind words, where they are, in its color and strength', svg.slice(0, 300));
    const lines = svg.match(/<line [^>]*\/>/g) || [];
    ok(lines.length === 2 && lines.every(l => attr(l, 'stroke') === '#c62828' && attr(l, 'stroke-dasharray') === '3 3' && attr(l, 'stroke-width') === '1') &&
        J(lines.map(l => [+attr(l, 'x1'), +attr(l, 'x2'), +attr(l, 'y1')])) === J([[276, 300, 53.5], [100, 244, 73.5]]),
        'an underline under each line of what it underlines, 3px below the baseline, in its color and dashes', J(lines));
    ok(svg.indexOf('<rect') < svg.indexOf('<line') && svg.indexOf('<line') < svg.indexOf('<text'), 'tints first, then underlines, then the words over them');
    const none = ev(`var d = document.createElement('div'); d.innerHTML = 'words'; d.getClientRects = function () { return []; }; return exportLaidOut(d, function (v) { return v; }, function (v) { return v; }, 1, null);`);
    ok(none === null, 'nothing laid out (a box open for editing, or no layout at all): null, and the words are drawn as before', J(none));
}

const MAP = `state.trees = [{ id: 'M', type: 'contention', texts: ['Socrates is mortal.'], collapsed: [], x: 0, y: 0, children: [
    { id: 'A', type: 'support', texts: ['All men are mortal.', 'Socrates is a man.'], collapsed: [], children: [] } ] },
    { id: 'R', type: 'contention', texts: ['Men die.'], collapsed: [], x: 900, y: 0, children: [] }];
    ensureCollabFields(state); selectedIds = []; render();`;

console.log('\n-- 2. labels and cross-references --');
{
    const r = ev(`${MAP} var g = 0; while (labelMode !== 'simple' && g++ < 5) cycleLabels();
        var svg = buildExportSVG() || ''; var t = getExportTheme(); return { svg: svg, label: t.labelText };`);
    const m1 = textOf(r.svg, 'M1');
    ok(m1 && attr(m1, 'font-size') === '10' && attr(m1, 'font-weight') === '600' && attr(m1, 'letter-spacing') === '0.3' && attr(m1, 'fill') === r.label && r.label === '#ccc',
        'a box\'s label is its own small text, in the labels\' gray, as on the canvas', m1);
    ok(!/\[(?:M|S)\d+\]/.test(r.svg) && !!textOf(r.svg, 'Socrates is mortal.'), 'and not "[M1]" before its words', texts(r.svg).slice(0, 4).join(' '));
    const see = ev(`${MAP} var g = 0; while (labelMode !== 'simple' && g++ < 5) cycleLabels();
        findNodeContext(state.trees, 'M').node.crossRefs = [[{ targetId: 'R', targetIdx: 0 }, { targetId: 'gone', targetIdx: 0 },
            { argumentId: 'arg1', childIds: [], premises: [{ targetId: 'A', targetIdx: 1 }, { targetId: 'R', targetIdx: 0 }] }]];
        render(); var svg = buildExportSVG() || '';
        return { svg: svg, badges: document.querySelectorAll('.crossref-badge').length, direct: exportCrossRefText(findNodeContext(state.trees, 'A').node, 0) };`);
    const seeTag = (see.svg.match(/<text [^>]*data-see="1"[^>]*>[^<]*<\/text>/g) || []);
    ok(see.badges === 1 && seeTag.length === 1 && />See M2, S2<\/text>$/.test(seeTag[0]) && attr(seeTag[0], 'text-anchor') === 'middle',
        'a cross-reference\'s button is "See" and the labels of the boxes it points to -- an argument\'s premises among them, each once, a box that is gone left out', J(seeTag));
    ok(see.direct === '', 'a box without cross-references has none', J(see.direct));
}

console.log('\n-- 3. the selection is not drawn --');
{
    const r = ev(`${MAP} selectedIds = ['M-0', 'A-1']; render();
        var before = document.querySelectorAll('#surface .node.selected').length, during = -1, was = getExportTheme;
        getExportTheme = function () { during = document.querySelectorAll('#surface .node.selected').length; return was(); };
        try { buildExportSVG(); } finally { getExportTheme = was; }
        return { before: before, during: during, after: document.querySelectorAll('#surface .node.selected').length };`);
    ok(r.before === 2 && r.during === 0 && r.after === 2, 'selected boxes are drawn as they are unselected, and stay selected', J(r));
    const thrown = ev(`${MAP} selectedIds = ['M-0']; render(); var was = getExportTheme, threw = false;
        getExportTheme = function () { throw new Error('x'); };
        try { buildExportSVG(); } catch (e) { threw = true; } finally { getExportTheme = was; }
        return { threw: threw, after: document.querySelectorAll('#surface .node.selected').length };`);
    ok(thrown.threw && thrown.after === 1, 'even when drawing fails', J(thrown));
}

console.log('\n-- 4. colors as the canvas has them --');
{
    const t = ev(`document.body.classList.add('bg-light', 'nodes-light'); var t = getExportTheme(); document.body.classList.remove('bg-light', 'nodes-light');
        var d = getExportTheme(); return { light: t.border.objection, lightLabel: t.labelText, dark: d.border.objection, darkLabel: d.labelText };`);
    ok(t.light === '#f44336' && t.dark === '#ff6250', 'an objection\'s border is the canvas\'s red in both themes (#f44336 in the light, not a darker one)', J(t));
    ok(t.lightLabel === '#555' && t.darkLabel === '#ccc', 'the labels\' gray: #555 on light boxes, #ccc on dark', J(t));
    ok(/const rootStyle = getComputedStyle\(linesSvg \|\| document\.body\);/.test(HTML),
        'the lines\' colors are read where the theme on show sets them (the light theme on the body), not from the root');
    const paints = ev(`return ['#abc', 'rgb(1, 2, 3)', 'rgba(0, 170, 205, 0.17)', 'rgb(0 0 0 / 50%)', 'transparent', 'var(--x)'].map(exportPaint);`);
    ok(J(paints) === J([{ color: '#aabbcc', a: 1 }, { color: '#010203', a: 1 }, { color: '#00aacd', a: 0.17 }, { color: '#000000', a: 0.5 }, null, null]),
        'a color is "#rrggbb" and its opacity apart', J(paints));
    // (The test's browser leaves var() in a computed color: the boxes' own
    // fill is given as the canvas has it.)
    const sh = ev(`${MAP} var box = document.querySelector('.node[data-node-id="A"][data-node-idx="0"]'), main = document.querySelector('.node[data-node-id="M"]');
        box.style.backgroundColor = main.style.backgroundColor = 'rgb(42, 47, 48)';
        var blurs = new Set(), one = exportShadows(box, 10, 20, 180, 60, 6, blurs), ring = exportShadows(main, 0, 0, 180, 60, 6, blurs);
        document.body.classList.add('bg-light', 'nodes-light'); findNodeContext(state.trees, 'A').node.implicits = [true, false]; render();
        var see = exportShadows(document.querySelector('.node[data-node-id="A"][data-node-idx="0"]'), 10, 20, 180, 60, 6, blurs);
        document.body.classList.remove('bg-light', 'nodes-light');
        return { one: one, ring: ring, see: see, blurs: Array.from(blurs) };`);
    ok(/^<rect x="10" y="24" width="180" height="60" rx="6" fill="#000000" fill-opacity="0.4" filter="url\(#export-blur-8\)"\/>$/.test(sh.one),
        'a box\'s shadow: blurred, under it, offset as on the canvas', sh.one);
    ok((sh.ring.match(/<rect/g) || []).length === 1 && /filter="url\(#export-blur-12\)"/.test(sh.ring) && J(sh.blurs.sort()) === J([12, 6, 8].sort()),
        'the main contention\'s: its blurred shadow only (the ring is drawn as before), each blur gathered for its filter', J(sh));
    ok(/^<mask id="export-cut-\d+"[^>]*><rect [^>]*fill="#fff"\/><rect x="10" y="20" width="180" height="60" rx="6" fill="#000"\/><\/mask><rect [^>]*mask="url\(#export-cut-\d+\)"\/>$/.test(sh.see),
        'a see-through box shows no shadow through it: the shadow is cut out where the box is', sh.see);
    // A box the canvas lays out (here, one said to be) has its shadow in the
    // picture, under it, with the blur's filter defined once.
    const drawn = ev(`${MAP} var box = document.querySelector('.node[data-node-id="A"][data-node-idx="0"]');
        Object.defineProperty(box, 'offsetWidth', { configurable: true, get: function () { return 180; } });
        box.getClientRects = function () { return [{ left: 0, top: 0, right: 180, bottom: 60, width: 180, height: 60 }]; };
        var svg = buildExportSVG() || '';
        return { defs: (svg.match(/<filter id="export-blur-8"[^>]*><feGaussianBlur stdDeviation="4"\\/><\\/filter>/g) || []).length,
            shadow: (svg.match(/filter="url\\(#export-blur-8\\)"/g) || []).length, under: svg.indexOf('filter="url(#export-blur-8)"') < svg.indexOf('>All men are mortal.<') };`);
    ok(drawn.defs === 1 && drawn.shadow === 1 && drawn.under, 'a laid-out box\'s shadow is drawn under it, its blur defined once', J(drawn));
}

console.log('\n-- 5. the math\'s fonts, and the PDF\'s words --');
(async () => {
    // (The test's browser makes no object URLs and loads no pictures: a
    // picture's drawing goes as far as its fonts.)
    W.eval(`URL.createObjectURL = function () { return 'blob:test'; }; URL.revokeObjectURL = function () {};`);
    W.eval(`window.__fetched = []; window.fetch = function (url) { __fetched.push(String(url));
        return /Regular/.test(url) ? Promise.resolve({ ok: true, arrayBuffer: function () { return Promise.resolve(new Uint8Array([1, 2, 3]).buffer); } })
            : Promise.reject(new Error('offline')); };`);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect/></svg>';
    const withFont = await W.eval(`exportWithFonts(${J(svg)}, new Set(['KaTeX_Main|Regular', 'KaTeX_Math|Italic']))`);
    const fetched = W.eval('JSON.stringify(__fetched)');
    ok(withFont === '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><style>@font-face{font-family:KaTeX_Main;src:url(data:font/woff2;base64,AQID) format("woff2");font-weight:400;font-style:normal}</style></defs><rect/></svg>',
        'a formula\'s font goes into the picture, as data; one that cannot be had is left to the reader', withFont);
    ok(J(JSON.parse(fetched)) === J(['https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/fonts/KaTeX_Main-Regular.woff2', 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/fonts/KaTeX_Math-Italic.woff2']),
        'fetched from where the page has KaTeX', fetched);
    const again = await W.eval(`__fetched = []; exportWithFonts(${J(svg)}, new Set(['KaTeX_Main|Regular', 'KaTeX_Math|Italic'])).then(function (s) { return JSON.stringify({ s: s, fetched: __fetched }); })`);
    const a = JSON.parse(again);
    ok(J(a.fetched) === J(['https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/fonts/KaTeX_Math-Italic.woff2']) && a.s === withFont,
        'once had, a font is not fetched again; one that failed is tried again', J(a.fetched));
    // The public build has KaTeX in the page, its fonts as data in its
    // stylesheet (and no link to the CDN): taken from there. (The test's
    // browser drops a font's "src" when it reads a stylesheet: the page's
    // sheets are given as a browser reads them, with one another site's,
    // which cannot be read.)
    const own = await W.eval(`__fetched = []; exportPageFonts = null;
        var face = { 'font-family': '"KaTeX_Size1"', src: 'url("data:font/woff2;base64,QUJD") format("woff2")', 'font-weight': '400', 'font-style': 'normal' };
        var sheets = [{ get cssRules() { throw new Error('SecurityError'); } },
            { cssRules: [{ type: 1, style: { getPropertyValue: function () { return ''; } } }, { type: 5, style: { getPropertyValue: function (p) { return face[p] || ''; } } }] }];
        Object.defineProperty(document, 'styleSheets', { configurable: true, get: function () { return sheets; } });
        exportWithFonts(${J(svg)}, new Set(['KaTeX_Size1|Regular'])).then(function (s) { delete document.styleSheets; exportPageFonts = null; return JSON.stringify({ s: s, fetched: __fetched.length }); })`);
    const o = JSON.parse(own);
    ok(o.fetched === 0 && o.s.indexOf('<defs><style>@font-face{font-family:KaTeX_Size1;src:url(data:font/woff2;base64,QUJD) format("woff2");font-weight:400;font-style:normal}</style></defs>') > 0,
        'where the page carries the font itself (the public build), it is taken from there, and nothing is fetched', own);
    const plain = await W.eval(`__fetched = []; exportWithFonts(${J(svg)}, new Set()).then(function (s) { return JSON.stringify({ s: s, n: __fetched.length }); })`);
    ok(J(JSON.parse(plain)) === J({ s: svg, n: 0 }), 'a picture without math fetches nothing', plain);
    // Saved as an SVG, and drawn for a PNG, JPEG or PDF: the picture's math
    // fonts are fetched for it (the picture's fonts said by the drawing).
    const saved = await W.eval(`__fetched = []; var wasBuild = buildExportSVG;
        buildExportSVG = function (o) { if (o && o.faces) o.faces.add('KaTeX_Main|Regular'); return wasBuild(o); };
        ${MAP}
        saveFormatBlob(SAVE_FORMATS.find(function (f) { return f.id === 'svg'; })).then(function (b) { return b.text(); }).then(function (t) {
            var svgFetched = __fetched.slice(); __fetched = [];
            rasterizeExport(1).catch(function () {});
            return new Promise(function (res) { setTimeout(res, 50); }).then(function () {
                buildExportSVG = wasBuild;
                return JSON.stringify({ font: /<defs><style>@font-face\\{font-family:KaTeX_Main;/.test(t), svgFetched: svgFetched.length, pictureFetched: __fetched.length,
                    cached: /KaTeX_Main/.test(t) }); }); })`);
    const s = JSON.parse(saved);
    ok(s.font && s.cached, 'an SVG file carries the math\'s fonts', saved);
    ok(s.pictureFetched === 0 && s.svgFetched === 0, 'a font had once is had again without fetching it, for a PNG, JPEG or PDF as for an SVG', saved);
    const pic = await W.eval(`__fetched = []; exportFontRules.clear(); var wasBuild = buildExportSVG;
        buildExportSVG = function (o) { if (o && o.faces) o.faces.add('KaTeX_Main|Regular'); return wasBuild(o); };
        rasterizeExport(1).catch(function () {});
        new Promise(function (res) { setTimeout(res, 50); }).then(function () { buildExportSVG = wasBuild; return JSON.stringify(__fetched); })`);
    ok(J(JSON.parse(pic)) === J(['https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/fonts/KaTeX_Main-Regular.woff2']), 'a PNG, JPEG or PDF fetches them for its picture', pic);
    const runs = ev(`var measured = [], was = textWidth;
        textWidth = function (str, font) { measured.push(font); return was(str, font); };
        try { var r = exportTextRuns('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="2" font-family="Arial" font-size="10" font-weight="600" font-style="italic">M1</text><text x="1" y="9" font-family="Arial" font-size="10">M1</text></svg>'); }
        finally { textWidth = was; }
        return { families: r.map(function (x) { return x.family; }), measured: measured.filter(function (f, i) { return measured.indexOf(f) === i; }) };`);
    ok(J(runs.families) === J(['italic 600 Arial', 'Arial']) && J(runs.measured) === J(['italic 600 10px Arial', 'italic 600 1000px Arial', '10px Arial', '1000px Arial']),
        'the PDF\'s words are measured in their own weight and slant, each a font of its own', J(runs));

    ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
