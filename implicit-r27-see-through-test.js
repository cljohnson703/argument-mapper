'use strict';
// r27 Implicit premises: see-through, faded, and tagged.
//
// An implicit premise is an unstated assumption, and it should read as one at
// a glance. Its box is see-through (no fill, no shadow), its border runs at
// half strength in its usual color and style (so a weak one is still dashed),
// its text is fainter (about 7:1 against the canvas, where regular text is
// about 15:1), and a small gray IMPLICIT tag sits across the top border at the
// right, 8px in from the corner. A given implicit premise keeps its green
// tint, see-through.
// The box clips its own edges (overflow: hidden, for resize: both), so the tag
// cannot live inside it: it follows its box in the .node-group and
// placeImplicitTags() pins it to the box's top-right corner, after every
// layout and during a live resize. As the box's next sibling it dims with it,
// and a drag that lifts the box out of its group lifts the tag too.
//
// Covers:
//   (1) the stylesheet: see-through box, see-through given tint, faded borders
//       by color family, fainter text that stays readable, the tag's look,
//       tokens in both themes, dimming;
//   (2) rendering: one tag right after each implicit box (co-premises too),
//       none elsewhere, and toggling I adds and removes it;
//   (3) placement: from the box's offsets, after layout and during a resize;
//   (4) a drag ghost of a single box carries its tag;
//   (5) the SVG export: no fill, the tint at its opacity, a faded edge,
//       fainter text, and a gray tag across the top border at the right;
//   (6) the Implicit button (no capitals) and Help.
//
// Run:  node implicit-r27-see-through-test.js [argument-mapper-r27.html]
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

const N = (id, type, children, extra) => Object.assign({ id, type, texts: [id], collapsed: [], children: children || [] }, extra || {});
// M  main contention
// ├─ P   three co-premises: plain | IMPLICIT | implicit GIVEN
// │  └─ O  objection, implicit                 red, faded
// │     └─ R  rebuttal, implicit              orange, faded
// ├─ W  weak objection, implicit               red, faded and dashed
// ├─ G  given, not implicit                    tinted, solid fill
// └─ S  plain support
const TREES = [
    N('M', 'contention', [
        N('P', 'support', [
            N('O', 'objection', [ N('R', 'rebuttal', [], { implicits: [true] }) ], { implicits: [true] })
        ], { texts: ['plain', 'implicit', 'implicit given'], implicits: [false, true, true], givens: [false, false, true] }),
        N('W', 'weak-objection', [], { implicits: [true] }),
        N('G', 'support', [], { givens: [true] }),
        N('S', 'support')
    ], { x: 30000, y: 30000 })
];

const HELPERS = `
    window.__i = {
        load(trees, sel) {
            state.trees = JSON.parse(JSON.stringify(trees));
            ensureCollabFields(state);
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            labelMode = 'none';
            selectedIds = sel ? sel.slice() : [];
            render();
        },
        box(id, i) { return document.querySelector('.node[data-node-id="' + id + '"][data-node-idx="' + (i || 0) + '"]'); },
        // jsdom has no layout: give a box fixed offsets (its width follows style.width).
        geom(el, left, top, width) {
            Object.defineProperty(el, 'offsetLeft', { configurable: true, get: function () { return left; } });
            Object.defineProperty(el, 'offsetTop', { configurable: true, get: function () { return top; } });
            Object.defineProperty(el, 'offsetWidth', { configurable: true, get: function () { return parseFloat(el.style.width) || width; } });
        }
    };
`;
const T = (W, body) => {
    try { return JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`)); }
    catch (e) { return { __error: String((e && e.message) || e) }; }
};
const J = JSON.stringify;
const CSS = HTML.slice(0, HTML.indexOf('</style>'));
const rule = (sel) => {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (CSS.match(new RegExp('(^|\\n)\\s*' + esc + '\\s*\\{[^}]*\\}')) || [''])[0];
};

(async () => {
    console.log('=== r27 implicit premises: see-through, faded, tagged ===');
    const W = makeWin('implicit-look');
    await sleep(250);
    W.win.eval(HELPERS);

    /* ---------------- 1. stylesheet ---------------- */
    console.log('\n-- stylesheet --');
    {
        const box = rule('.node.implicit');
        ok(/background:\s*transparent/.test(box) && /box-shadow:\s*none/.test(box), 'an implicit box is see-through: no fill, no shadow', box);
        ok(/background:\s*var\(--color-given-see-through\)/.test(rule('.node.implicit.given')), 'a given one keeps its tint, see-through');
        ok(/border-color:\s*var\(--line-faded\)/.test(rule('.node.implicit[data-color="support"]')) &&
           /border-color:\s*var\(--line-objection-faded\)/.test(rule('.node.implicit[data-color="objection"]')) &&
           /border-color:\s*var\(--line-rebuttal-faded\)/.test(rule('.node.implicit[data-color="rebuttal"]')),
            'its border fades within its color family: white, red, orange');
        const dark = (CSS.match(/:root\s*\{[^}]*\}/) || [''])[0];
        const light = (CSS.match(/body\.bg-light\s*\{[^}]*\}/) || [''])[0];
        const nodesLight = (CSS.match(/body\.nodes-light\s*\{[^}]*\}/) || [''])[0];
        ok(/--line-faded:\s*rgba\(255, 255, 255, 0\.5\)/.test(dark) && /--line-objection-faded:\s*rgba\(255, 98, 80, 0\.5\)/.test(dark) &&
           /--line-rebuttal-faded:\s*rgba\(255, 183, 128, 0\.5\)/.test(dark),
            'dark theme: the connector colors at half strength');
        ok(/--line-faded:\s*rgba\(51, 51, 51, 0\.5\)/.test(light) && /--line-objection-faded:\s*rgba\(198, 40, 40, 0\.5\)/.test(light) &&
           /--line-rebuttal-faded:\s*rgba\(255, 152, 0, 0\.5\)/.test(light),
            'light theme: the same, from its own connector colors');
        ok(/--color-given-see-through:\s*rgba\(38, 62, 48, 0\.55\)/.test(dark) && /--color-given-see-through:\s*rgba\(201, 229, 211, 0\.6\)/.test(nodesLight),
            'the see-through given tint is defined for dark and light boxes');
        ok(/\.node\.implicit \.rendered-text, \.node\.implicit textarea\s*\{\s*color:\s*var\(--implicit-text\)/.test(CSS) &&
           /--implicit-text:\s*#b3b3b3/.test(dark) && /--implicit-text:\s*#505050/.test(nodesLight),
            'its text, shown or being edited, takes the fainter --implicit-text in both themes');
        // WCAG contrast of the text against what shows through the box, from
        // the stylesheet's own values.
        const hex = (block, name) => ((block.match(new RegExp(name + ':\\s*#([0-9a-fA-F]{6})')) || [])[1] || '000000').toLowerCase();
        const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
        const lum = h => { const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]); };
        const mix = (fg, a, bg) => [0, 2, 4].map(i => Math.round(a * parseInt(fg.slice(i, i + 2), 16) + (1 - a) * parseInt(bg.slice(i, i + 2), 16)).toString(16).padStart(2, '0')).join('');
        const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const dBg = hex(dark, '--bg-color'), lBg = hex(light, '--bg-color');
        const dFaint = hex(dark, '--implicit-text'), lFaint = hex(nodesLight, '--implicit-text');
        const ratios = {
            darkText: cr(hex(dark, '--text-color'), dBg), darkFaint: cr(dFaint, dBg), darkTint: cr(dFaint, mix(hex(dark, '--color-given-bg'), 0.55, dBg)),
            lightText: cr(hex(nodesLight, '--text-color'), lBg), lightFaint: cr(lFaint, lBg), lightTint: cr(lFaint, mix(hex(nodesLight, '--color-given-bg'), 0.6, lBg))
        };
        ok(ratios.darkFaint >= 7 && ratios.lightFaint >= 7 && ratios.darkTint >= 6 && ratios.lightTint >= 6 &&
           ratios.darkFaint < ratios.darkText / 2 && ratios.lightFaint < ratios.lightText / 2,
            'the faint text keeps AAA contrast on the canvas (and 6:1 on the given tint) at under half the contrast of regular text',
            J(Object.fromEntries(Object.entries(ratios).map(([k, v]) => [k, +v.toFixed(2)]))));
        ok(/--implicit-tag-text:\s*#c9c9c9/.test(dark) && /--implicit-tag-border:\s*#717b80/.test(dark) &&
           /--implicit-tag-text:\s*#555/.test(light) && /--implicit-tag-border:\s*#9aa1a6/.test(light),
            'the tag is gray in both themes');
        const tag = rule('.implicit-tag');
        ok(/position:\s*absolute/.test(tag) && /font-size:\s*9\.5px/.test(tag) && /letter-spacing:\s*0\.4px/.test(tag) &&
           /text-transform:\s*uppercase/.test(tag) && /line-height:\s*13px/.test(tag) && /padding:\s*0 4px/.test(tag) &&
           /border-radius:\s*3px/.test(tag) && /border:\s*1px solid var\(--implicit-tag-border\)/.test(tag) &&
           /background:\s*var\(--node-bg\)/.test(tag) && /color:\s*var\(--implicit-tag-text\)/.test(tag) && /pointer-events:\s*none/.test(tag),
            'the tag: 9.5px capitals in a gray 1px outline on the box color, and it ignores the pointer', tag);
        ok(/transform:\s*translate\(calc\(-100% - 10px\), -6px\)/.test(tag),
            'from the box\'s top-right corner it sits 8px in from the right and 8px above the inside of the border');
        ok(/#surface\.has-node-highlight \.node:not\(\.node-hl\) \+ \.implicit-tag\s*\{\s*opacity:\s*0\.12/.test(CSS) &&
           /body\.is-dragging #surface\.has-node-highlight \.node \+ \.implicit-tag\s*\{\s*opacity:\s*1/.test(CSS),
            'the tag dims with its box, and not while dragging');
        ok(!/\.node\.implicit::after/.test(CSS), 'the old tag drawn inside the box is gone');
    }

    /* ---------------- 2. rendering ---------------- */
    console.log('\n-- rendering --');
    {
        const r = T(W, `__i.load(${J(TREES)});
            var out = {};
            document.querySelectorAll('.node').forEach(function (b) {
                var n = b.nextElementSibling;
                out[b.getAttribute('data-node-id') + b.getAttribute('data-node-idx')] = {
                    implicit: b.classList.contains('implicit'),
                    tag: !!(n && n.classList.contains('implicit-tag')) ? n.textContent : null,
                    inGroup: !!(n && n.parentElement === b.parentElement)
                };
            });
            out.tags = document.querySelectorAll('.implicit-tag').length;
            out.insideBox = document.querySelectorAll('.node .implicit-tag').length;
            var w = __i.box('W'); out.W = { dashed: getComputedStyle(w).borderTopStyle };
            var textColor = function (b) { return getComputedStyle(b.querySelector('.rendered-text')).color; };
            out.text = { implicit: textColor(__i.box('P', 1)), plain: textColor(__i.box('P', 0)), weak: textColor(w) };
            return out;`);
        const want = { M0: false, P0: false, P1: true, P2: true, O0: true, R0: true, W0: true, G0: false, S0: false };
        const wrong = Object.keys(want).filter(k => !r[k] || r[k].implicit !== want[k] || (want[k] ? r[k].tag !== 'Implicit' || !r[k].inGroup : r[k].tag !== null));
        ok(wrong.length === 0, 'each implicit box, and only those, is followed in its group by an "Implicit" tag', J(wrong.map(k => [k, r[k]])));
        ok(r.tags === 5 && r.insideBox === 0, 'five tags in all, none inside a box', J([r.tags, r.insideBox]));
        ok(r.W && r.W.dashed === 'dashed', 'an implicit weak objection is still dashed', J(r.W));
        ok(r.text && /implicit-text|179, 179, 179/.test(r.text.implicit) && r.text.weak === r.text.implicit && r.text.plain !== r.text.implicit,
            'the text in implicit boxes takes the faint color; the plain co-premise beside them keeps the regular one', J(r.text));

        const t = T(W, `__i.load(${J(TREES)}, ['S-0']);
            toggleImplicit();
            var s = __i.box('S'); var n = s.nextElementSibling;
            var on = { cls: s.classList.contains('implicit'), tag: !!(n && n.classList.contains('implicit-tag')) };
            toggleImplicit();
            s = __i.box('S'); n = s.nextElementSibling;
            var off = { cls: s.classList.contains('implicit'), tag: !!(n && n.classList.contains('implicit-tag')) };
            return { on: on, off: off, tags: document.querySelectorAll('.implicit-tag').length };`);
        ok(t.on && t.on.cls && t.on.tag && t.off && !t.off.cls && !t.off.tag && t.tags === 5,
            'I on a plain box adds its tag, and I again takes it away', J(t));
    }

    /* ---------------- 3. placement ---------------- */
    console.log('\n-- placement --');
    {
        const p = T(W, `__i.load(${J(TREES)});
            var b0 = __i.box('P', 0), b1 = __i.box('P', 1), b2 = __i.box('P', 2);
            __i.geom(b0, 0, 0, 180); __i.geom(b1, 195, 0, 180); __i.geom(b2, 390, 4, 240);
            placeImplicitTags();
            var t1 = b1.nextElementSibling, t2 = b2.nextElementSibling;
            var direct = { t1: [t1.style.left, t1.style.top], t2: [t2.style.left, t2.style.top] };
            t1.style.left = ''; t2.style.left = '';
            layoutAll();
            var afterLayout = { t1: t1.style.left, t2: t2.style.left };
            // a live resize of the middle box: its right edge (and the tag) follow the pointer
            var group = b1.closest('.node-group');
            var zoomWas = zoomLevel; zoomLevel = 1;
            _resizingBox = { node: findNodeContext(state.trees, 'P').node, index: 1, el: b1, group: group,
                startW: 180, startLeft: 100, startEdgeS: 375, grabOffS: 0, lastEdgeS: null, lastW: null, moved: false };
            window._resizeActive = true;
            document.dispatchEvent(new MouseEvent('pointermove', { clientX: 395, clientY: 10, bubbles: true }));
            var during = { width: b1.style.width, t1: t1.style.left };
            _resizingBox = null; window._resizeActive = false; window._layoutAfterResize = false; zoomLevel = zoomWas;
            return { direct: direct, afterLayout: afterLayout, during: during };`);
        ok(p.direct && J(p.direct.t1) === J(['375px', '0px']) && J(p.direct.t2) === J(['630px', '4px']),
            'each tag is pinned to its own box\'s top-right corner (left + width, top), co-premises included', J(p.direct));
        ok(p.afterLayout && p.afterLayout.t1 === '375px' && p.afterLayout.t2 === '630px', 'a layout pass places them', J(p.afterLayout));
        ok(p.during && p.during.width === '220px' && p.during.t1 === '415px', 'and a live resize carries the tag with the moving edge', J(p.during));
    }

    /* ---------------- 4. drag ghost ---------------- */
    console.log('\n-- drag ghost --');
    {
        const d = T(W, `__i.load(${J(TREES)});
            var b1 = __i.box('P', 1);
            var ev = { clientX: 10, clientY: 10, screenX: 10, screenY: 10, shiftKey: false, altKey: false };
            startDrag(ev, findNodeContext(state.trees, 'P').node, 1, b1, 'text');
            var ov = document.getElementById('drag-overlay');
            var one = { tags: ov ? ov.querySelectorAll('.implicit-tag').length : -1, boxes: ov ? ov.querySelectorAll('.node').length : -1 };
            endDrag();
            var s = __i.box('S');
            startDrag(ev, findNodeContext(state.trees, 'S').node, 0, s, 'text');
            ov = document.getElementById('drag-overlay');
            var plain = { tags: ov ? ov.querySelectorAll('.implicit-tag').length : -1, boxes: ov ? ov.querySelectorAll('.node').length : -1 };
            endDrag();
            return { one: one, plain: plain, tagOf: !!implicitTagOf(b1), tagOfPlain: implicitTagOf(__i.box('P', 0)) === null };`);
        ok(d.one && d.one.boxes === 1 && d.one.tags === 1, 'dragging an implicit co-premise out of its group, the ghost carries its tag', J(d));
        ok(d.plain && d.plain.boxes === 1 && d.plain.tags === 0 && d.tagOf && d.tagOfPlain, 'a plain box\'s ghost has none', J(d));
    }

    /* ---------------- 5. export ---------------- */
    console.log('\n-- export --');
    {
        const x = T(W, `__i.load(${J(TREES)});
            var s = buildExportSVG() || ''; var t = getExportTheme();
            var rects = s.match(/<rect[^>]*>/g) || [];
            var boxRects = rects.filter(function (r) { return /stroke-width="2"/.test(r) && !/rx="9"/.test(r); });
            var tagRects = rects.filter(function (r) { return /data-implicit-tag="1"/.test(r); });
            return { theme: { edge: t.implicitEdgeOpacity, see: t.givenSeeThrough, text: t.implicitTagText, border: t.implicitTagBorder, given: t.givenBg },
                     hollow: boxRects.filter(function (r) { return /fill="none"/.test(r); }).length,
                     tinted: boxRects.filter(function (r) { return r.indexOf('fill="' + t.givenBg + '" fill-opacity="' + t.givenSeeThrough + '"') >= 0; }).length,
                     solidGiven: boxRects.filter(function (r) { return r.indexOf('fill="' + t.givenBg + '" stroke') >= 0; }).length,
                     faded: boxRects.filter(function (r) { return /stroke-opacity="0.5"/.test(r); }).length,
                     tags: tagRects.length,
                     tagLook: tagRects.every(function (r) { return r.indexOf('stroke="' + t.implicitTagBorder + '"') >= 0 && /rx="3"/.test(r) && /height="15"/.test(r); }),
                     words: (s.match(new RegExp('fill="' + t.implicitTagText + '">IMPLICIT<', 'g')) || []).length,
                     faintText: (s.match(new RegExp('font-size="14" fill="' + t.implicitText + '">', 'g')) || []).length,
                     plainText: (s.match(new RegExp('font-size="14" fill="' + t.text + '">', 'g')) || []).length,
                     implicitText: t.implicitText };`);
        ok(x.theme && x.theme.edge === 0.5 && x.theme.see === 0.55 && x.theme.text === '#c9c9c9' && x.theme.border === '#717b80',
            'the export theme carries the fade, the see-through tint and the tag grays (dark)', J(x.theme));
        ok(x.hollow === 4 && x.tinted === 1 && x.solidGiven === 1,
            'implicit boxes export with no fill, the implicit given with its tint see-through, the plain given solid', J(x));
        ok(x.faded === 5, 'all five implicit boxes, and only they, export with a half-strength edge', J(x));
        ok(x.tags === 5 && x.tagLook && x.words === 5, 'each carries a gray IMPLICIT tag', J(x));
        ok(x.implicitText === '#b3b3b3' && x.faintText === 5 && x.plainText === 4,
            'and its text exports faint, as on screen, while the other four boxes\' text stays regular', J(x));

        const pos = T(W, `__i.load(${J(TREES)});
            var s = buildExportSVG() || '';
            var g = document.getElementById('group-W'); var box = __i.box('W');
            var x = (parseFloat(g.style.left) || 0) + box.offsetLeft, y = (parseFloat(g.style.top) || 0) + box.offsetTop;
            var wd = box.offsetWidth || 184;
            var re = new RegExp('<rect x="([-\\\\d.]+)" y="([-\\\\d.]+)" width="([\\\\d.]+)" height="15" rx="3"[^>]*data-implicit-tag="1"', 'g');
            var m, found = null;
            while ((m = re.exec(s))) { if (Math.abs(parseFloat(m[1]) + parseFloat(m[3]) - (x + wd - 10)) < 0.01 && parseFloat(m[2]) === y - 6) found = m[0]; }
            return { found: found };`);
        ok(pos.found, 'the tag sits across the top border: right edge 10px in from the box\'s, 6px above its top', J(pos));

        const light = T(W, `document.body.classList.add('bg-light', 'nodes-light'); var t = getExportTheme();
            document.body.classList.remove('bg-light', 'nodes-light');
            return { see: t.givenSeeThrough, text: t.implicitTagText, border: t.implicitTagBorder, faint: t.implicitText };`);
        ok(light.see === 0.6 && light.text === '#555' && light.border === '#9aa1a6' && light.faint === '#505050', 'and the light theme\'s values', J(light));
    }

    /* ---------------- 6. button and Help ---------------- */
    console.log('\n-- button and Help --');
    {
        const b = T(W, `var b = document.getElementById('btn-implicit'); return { text: b.textContent.replace(/\\s+/g, ' ').trim(), title: b.title };`);
        ok(b.text === 'Implicit I' && !/#btn-implicit\s*\{[^}]*text-transform/.test(CSS),
            'the Implicit button reads "Implicit", not in capitals', J(b));
        ok(/see-through box with a faded border, fainter text and an IMPLICIT tag/.test(b.title || ''), 'its tooltip describes the look', J(b.title));
        const h = T(W, `return document.getElementById('help-panel').innerHTML;`);
        const html = typeof h === 'string' ? h : '';
        ok(/<strong>See-through, with an IMPLICIT tag<\/strong> — an <strong>implicit<\/strong> premise \(<kbd>I<\/kbd>\)/.test(html) &&
           /see-through, with a faded border and fainter text, and a small IMPLICIT tag sits across the top of the border/.test(html) &&
           /stays dashed in a weak branch/.test(html),
            'Help\'s Colors section describes the look');
        ok(/an <strong>implicit<\/strong> given keeps its tint, see-through/.test(html) && /\(see-through, with an IMPLICIT tag\)/.test(html),
            'and so do its Given and Labels sections');
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
