'use strict';
// r27 argument sides: color and O/R follow the tree.
//
// A box's color says which ARGUMENT it belongs to, derived from where it
// sits: white for the main argument, red for an objection (an attack on a
// white or orange premise, with everything supporting it), orange for a
// rebuttal (an attack on a red premise, with everything supporting it).
// Letters keep their meaning: S is a support wherever it sits; O or R is
// picked from what is attacked. Nothing is stored differently -- existing
// maps are reinterpreted, and new or retyped attacks store the derived kind.
//
// Covers:
//   (1) the derivation, including the case that motivated it (an attack on a
//       premise that backs an objection is a REBUTTAL), a legacy 'rebuttal'
//       hung directly on the main contention (now an objection), a note
//       passing its side through, and a free-floating root attack;
//   (2) rendering: type-/side- classes and data-color, and the CSS that
//       colors a support by its side;
//   (3) connectors: color by side, the same arrowhead on every connector
//       (attacks included -- the colors carry the relation), every marker
//       reference resolving;
//   (4) labels and the text format: S stays S, O/R are derived, and a text
//       round-trip preserves the derived kinds;
//   (5) auto-pick when adding (Shift+Enter) and when retyping (O and R
//       alike), with a root keeping what was asked; Ctrl+Enter now adds a
//       block rather than repeating Shift+Enter;
//   (6) the buttons and menu name the attack the app would pick, and the
//       duplicate Rebuttal buttons are gone;
//   (7) the toolbar color key and its View toggle;
//   (8) the SVG export borders use the derived color.
//
// Run:  node sides-r27-color-test.js [argument-mapper-r27.html]
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
// M
// ├─ S1 support                        white
// │  └─ O1 objection                   red
// │     ├─ S2 support (backs O1)       red, still S
// │     │  └─ X1 stored 'objection'    attacks red -> REBUTTAL, orange
// │     │     └─ S3 support            orange, still S
// │     │        └─ Y1 stored 'rebuttal'  attacks orange -> OBJECTION, red
// │     └─ N1 note                     note look, passes red down
// │        └─ S4 support               red
// └─ R0 stored 'rebuttal' on the main contention -> OBJECTION, red
// F  free-floating root objection      red (no parent: stored type decides)
// └─ FS support                        red
const TREES = [
    N('M', 'contention', [
        N('S1', 'support', [
            N('O1', 'objection', [
                N('S2', 'support', [
                    N('X1', 'objection', [
                        N('S3', 'support', [ N('Y1', 'rebuttal') ])
                    ])
                ]),
                N('N1', 'note', [ N('S4', 'support') ])
            ])
        ]),
        N('R0', 'rebuttal')
    ], { x: 30000, y: 30000 }),
    N('F', 'objection', [ N('FS', 'support') ], { x: 500, y: 300, freePosition: true })
];

const HELPERS = `
    window.__c = {
        load(trees, sel) {
            state.trees = JSON.parse(JSON.stringify(trees));
            ensureCollabFields(state);
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            labelMode = 'none';
            selectedIds = sel ? sel.slice() : [];
            render();
        },
        box(id) { return document.querySelector('.node[data-node-id="' + id + '"][data-node-idx="0"]'); },
        key(code, key, opts) {
            document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ code: code, key: key, bubbles: true, cancelable: true }, opts || {})));
        },
        childOf(id) { const n = findNodeContext(state.trees, id).node; return n.children[n.children.length - 1]; },
        blur() { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
    };
`;
// A section that throws (e.g. against a build without the feature) reports
// its checks as failures instead of aborting the whole run.
const T = (W, body) => {
    try { return JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`)); }
    catch (e) { return { __error: String((e && e.message) || e) }; }
};

(async () => {
    console.log('=== r27 argument sides: color and O/R follow the tree ===');
    const W = makeWin('sides-color');
    await sleep(250);
    W.win.eval(HELPERS);

    /* ---------------- 1. derivation ---------------- */
    console.log('\n-- derivation --');
    {
        const k = T(W, `var m = computeArgumentKinds(${JSON.stringify(TREES)}); var o = {}; m.forEach(function (v, id) { o[id] = v; }); return o;`);
        const want = {
            M:  ['contention', 'main', 'contention'],
            S1: ['support', 'main', 'support'],
            O1: ['objection', 'objection', 'objection'],
            S2: ['support', 'objection', 'objection'],
            X1: ['rebuttal', 'rebuttal', 'rebuttal'],
            S3: ['support', 'rebuttal', 'rebuttal'],
            Y1: ['objection', 'objection', 'objection'],
            N1: ['note', 'objection', 'note'],
            S4: ['support', 'objection', 'objection'],
            R0: ['objection', 'objection', 'objection'],
            F:  ['objection', 'objection', 'objection'],
            FS: ['support', 'objection', 'objection'],
        };
        const why = {
            S2: 'a support backing an objection is red and still a support',
            X1: 'an attack on a red premise is a REBUTTAL (the case that looked like an objector objecting to themselves)',
            S3: 'a support inside a rebuttal is orange',
            Y1: "a stored 'rebuttal' attacking an orange premise is an objection",
            N1: 'a note keeps its own look but sits on the objection side',
            S4: 'and passes that side down: a support under it is red',
            R0: "a legacy 'rebuttal' hung directly on the main contention is an objection",
            F:  'a free-floating root attack keeps its stored kind',
            FS: 'and its supports take its color',
        };
        Object.keys(want).forEach(id => {
            const got = k[id] ? [k[id].kind, k[id].side, k[id].color] : null;
            ok(JSON.stringify(got) === JSON.stringify(want[id]),
                id + ': ' + (why[id] || want[id].join(' / ')), JSON.stringify(got));
        });
    }

    /* ---------------- 2. rendering ---------------- */
    console.log('\n-- rendering --');
    {
        const r = T(W, `__c.load(${JSON.stringify(TREES)});
            var o = {}; ['S1','O1','S2','X1','S3','Y1','N1','S4','R0','FS'].forEach(function (id) {
                var b = __c.box(id); o[id] = b ? { cls: b.className, color: b.getAttribute('data-color') } : null; });
            return o;`);
        const has = (id, c) => r[id] && new RegExp('(^|\\s)' + c + '(\\s|$)').test(r[id].cls);
        ok(has('S2', 'type-support') && has('S2', 'side-objection') && r.S2.color === 'objection',
            'S2 renders as a support on the objection side, colored red', JSON.stringify(r.S2));
        ok(has('X1', 'type-rebuttal') && r.X1.color === 'rebuttal', 'X1 renders as a rebuttal, orange', JSON.stringify(r.X1));
        ok(has('S3', 'type-support') && has('S3', 'side-rebuttal') && r.S3.color === 'rebuttal', 'S3 renders orange', JSON.stringify(r.S3));
        ok(has('R0', 'type-objection') && !has('R0', 'type-rebuttal'), 'R0 renders as an objection, not a rebuttal', JSON.stringify(r.R0));
        ok(has('S1', 'side-main') && r.S1.color === 'support', 'S1 stays white', JSON.stringify(r.S1));
        ok(has('N1', 'type-note') && r.N1.color === 'note', 'a note keeps the note look', JSON.stringify(r.N1));

        const css = HTML.slice(0, HTML.indexOf('</style>'));
        ok(/\.type-support\.side-objection[^{]*\{\s*border-color:\s*var\(--line-objection\)/.test(css) &&
           /\.type-support\.side-rebuttal[^{]*\{\s*border-color:\s*var\(--line-rebuttal\)/.test(css),
            'the stylesheet colors a support by its side');
    }

    /* ---------------- 3. connectors ---------------- */
    console.log('\n-- connectors --');
    {
        const lines = T(W, `__c.load(${JSON.stringify(TREES)}); drawLines();
            var out = {};
            document.querySelectorAll('#lines-svg path[data-child]').forEach(function (p) {
                var id = p.getAttribute('data-child');
                if (p.getAttribute('marker-end')) out[id] = { stroke: p.getAttribute('stroke'), marker: p.getAttribute('marker-end') };
            });
            var all = Array.prototype.slice.call(document.querySelectorAll('#lines-svg path[marker-end]')).map(function (p) {
                var m = (p.getAttribute('marker-end').match(/#(.+?)\\)/) || [])[1]; return !!(m && document.getElementById(m)); });
            return { out: out, allResolve: all.length > 0 && all.every(Boolean), count: all.length,
                     barMarkers: document.querySelectorAll('marker[id^="bar-"]').length };`);
        const e = lines.out || {};
        const is = (id, stroke, marker) => e[id] && e[id].stroke === stroke && e[id].marker === 'url(#' + marker + ')';
        ok(is('S1', 'var(--color-line)', 'arrow-support'), 'S1 -> M: white connector with an arrowhead', JSON.stringify(e.S1));
        ok(is('O1', 'var(--line-objection)', 'arrow-objection'), 'O1 -> S1: red connector with a red arrowhead (an attack)', JSON.stringify(e.O1));
        ok(is('S2', 'var(--line-objection)', 'arrow-objection'), 'S2 -> O1: red connector with an arrowhead (a support inside the objection)', JSON.stringify(e.S2));
        ok(is('X1', 'var(--line-rebuttal)', 'arrow-rebuttal'), 'X1 -> S2: orange connector with an orange arrowhead', JSON.stringify(e.X1));
        ok(is('R0', 'var(--line-objection)', 'arrow-objection'), 'R0 -> M: red arrow, not orange', JSON.stringify(e.R0));
        ok(lines.allResolve, 'every connector marker reference resolves', 'count=' + lines.count);
        ok(lines.barMarkers === 0, 'no flat-bar markers are defined: every connector ends in an arrowhead', 'bar markers=' + lines.barMarkers);
    }

    /* ---------------- 4. labels and the text format ---------------- */
    console.log('\n-- labels and text --');
    {
        const lab = T(W, `__c.load(${JSON.stringify(TREES)}); labelMode = 'complex'; render();
            var o = {}; ['S1','O1','S2','X1','S3','Y1','N1','S4','R0','FS'].forEach(function (id) { o[id] = currentLabels.get(id + '-0'); });
            labelMode = 'simple'; render();
            var s = {}; ['S2','X1','Y1','R0','F'].forEach(function (id) { s[id] = currentLabels.get(id + '-0'); });
            labelMode = 'none'; render();
            return { complex: o, simple: s };`);
        const c = lab.complex || {};
        lab.simple = lab.simple || {};
        ok(c.S2 === 'M1S1O1S1', 'S2 keeps its S: M1S1O1S1', c.S2);
        ok(c.X1 === 'M1S1O1S1R1', 'X1 is lettered R: M1S1O1S1R1', c.X1);
        ok(c.S3 === 'M1S1O1S1R1S1' && c.Y1 === 'M1S1O1S1R1S1O1', 'S3 stays S, Y1 is re-lettered O', c.S3 + ' / ' + c.Y1);
        ok(c.R0 === 'M1O1', "the legacy rebuttal on the main contention is lettered O: M1O1", c.R0);
        ok(c.S4 === 'M1S1O1N1S1', 'a support under a note keeps S', c.S4);
        ok(lab.simple.X1 === 'R1' && /^O\d+$/.test(lab.simple.R0) && /^O\d+$/.test(lab.simple.Y1) && lab.simple.S2 === 'S2',
            'simple labels count by the derived letter too', JSON.stringify(lab.simple));

        const rt = T(W, `__c.load(${JSON.stringify(TREES)});
            var text = generateTextRepresentation();
            var parsed = parseTextToState(text);
            var kinds = computeArgumentKinds(parsed.trees);
            var byText = {};
            (function walk(ns) { (ns || []).forEach(function (n) { var k = kinds.get(n.id); byText[n.texts[0]] = k.kind + '/' + k.side; walk(n.children); }); })(parsed.trees);
            return { text: text, byText: byText };`);
        rt.text = rt.text || ''; rt.byText = rt.byText || {};
        ok(/M1S1O1S1R1\s*:\s*X1/.test(rt.text) && /M1O1\s*:\s*R0/.test(rt.text) && !/M1R1\s*:/.test(rt.text),
            'text export writes the derived letters', rt.text.split('\n').filter(l => /X1|R0/.test(l)).join(' | '));
        ok(rt.byText.X1 === 'rebuttal/rebuttal' && rt.byText.R0 === 'objection/objection' && rt.byText.S2 === 'support/objection',
            'and importing that text gives the same colors and letters back', JSON.stringify(rt.byText));
    }

    /* ---------------- 5. auto-pick ---------------- */
    console.log('\n-- auto-pick --');
    {
        const addRed = T(W, `__c.load(${JSON.stringify(TREES)}, ['S2-0']);
            __c.key('Enter', 'Enter', { shiftKey: true }); __c.blur();
            var c = __c.childOf('S2'); var b = __c.box(c.id);
            return { stored: c.type, cls: b && b.className };`);
        ok(addRed.stored === 'rebuttal' && /type-rebuttal/.test(addRed.cls),
            'Shift+Enter on a red support adds a REBUTTAL', JSON.stringify(addRed));

        // Ctrl+Enter no longer repeats Shift+Enter: it adds a weak objection or
        // rebuttal. weak-r27-attack-test.js covers it in full.
        const addWhiteCtrl = T(W, `__c.load(${JSON.stringify(TREES)}, ['S1-0']);
            __c.key('Enter', 'Enter', { ctrlKey: true }); __c.blur();
            return { stored: __c.childOf('S1').type };`);
        ok(addWhiteCtrl.stored === 'weak-objection',
            'Ctrl+Enter (once a second attack chord) on a white premise now adds a WEAK OBJECTION', JSON.stringify(addWhiteCtrl));

        const addOrange = T(W, `__c.load(${JSON.stringify(TREES)}, ['S3-0']);
            __c.key('Enter', 'Enter', { shiftKey: true }); __c.blur();
            return { stored: __c.childOf('S3').type };`);
        ok(addOrange.stored === 'objection', 'an attack on an orange premise is an objection', JSON.stringify(addOrange));

        const retypeO = T(W, `__c.load(${JSON.stringify(TREES)}, ['S2-0']); __c.key('KeyO', 'o');
            return { stored: findNodeContext(state.trees, 'S2').node.type };`);
        const retypeR = T(W, `__c.load(${JSON.stringify(TREES)}, ['S2-0']); __c.key('KeyR', 'r');
            return { stored: findNodeContext(state.trees, 'S2').node.type };`);
        ok(retypeO.stored === 'rebuttal' && retypeR.stored === 'rebuttal',
            'O and R alike turn S2 into a rebuttal, because it hangs on a red premise', JSON.stringify([retypeO, retypeR]));

        const retypeWhite = T(W, `__c.load(${JSON.stringify(TREES)}, ['S1-0']); __c.key('KeyR', 'r');
            return { stored: findNodeContext(state.trees, 'S1').node.type };`);
        ok(retypeWhite.stored === 'objection', 'R on a box under the main contention makes an objection', JSON.stringify(retypeWhite));

        const root = T(W, `__c.load(${JSON.stringify(TREES)}, ['F-0']); __c.key('KeyR', 'r');
            return { stored: findNodeContext(state.trees, 'F').node.type };`);
        ok(root.stored === 'rebuttal', 'a free-floating root keeps the kind that was asked for', JSON.stringify(root));
    }

    /* ---------------- 6. buttons and menu ---------------- */
    console.log('\n-- buttons and menu --');
    {
        const labels = T(W, `var out = {};
            function read(sel) { __c.load(${JSON.stringify(TREES)}, sel);
                var a = document.getElementById('btn-add-obj'), t = document.getElementById('btn-type-obj');
                return { add: a && a.textContent.trim(), type: t && t.textContent.trim() }; }
            out.S2 = read(['S2-0']); out.S1 = read(['S1-0']); out.X1 = read(['X1-0']); out.none = read([]);
            out.dupAdd = !!document.getElementById('btn-add-reb'); out.dupType = !!document.getElementById('btn-type-reb');
            return out;`);
        ['S2', 'S1', 'X1', 'none'].forEach(k => { labels[k] = labels[k] || {}; });
        ok(/^Add Rebuttal/.test(labels.S2.add) && /^Rebuttal/.test(labels.S2.type),
            'with red S2 selected: "Add Rebuttal", and retyping it would make a "Rebuttal"', JSON.stringify(labels.S2));
        ok(/^Add Objection/.test(labels.S1.add) && /^Objection/.test(labels.S1.type),
            'with white S1 selected: "Add Objection" / "Objection"', JSON.stringify(labels.S1));
        ok(/^Add Objection/.test(labels.X1.add) && /^Rebuttal/.test(labels.X1.type),
            'with orange X1 selected: attacking it is an objection; X1 itself stays a rebuttal', JSON.stringify(labels.X1));
        ok(/^Add Objection/.test(labels.none.add), 'with nothing selected it reads "Add Objection"', JSON.stringify(labels.none));
        ok(!labels.dupAdd && !labels.dupType, 'the separate Rebuttal buttons are gone (one attack button each)');

        const menu = T(W, `__c.load(${JSON.stringify(TREES)}); showContextMenu(10, 10, 'S2', 0);
            var m = document.getElementById('context-menu');
            var items = Array.prototype.slice.call(m.querySelectorAll('.ctx-item')).map(function (b) { return b.textContent.trim(); });
            var row = Array.prototype.slice.call(m.querySelectorAll('.ctx-row button')).map(function (b) { return b.textContent.trim(); });
            hideContextMenu();
            return { items: items, row: row };`);
        menu.items = menu.items || []; menu.row = menu.row || [];
        ok(menu.items.some(t => /^Rebuttal/.test(t)) && !menu.items.some(t => /^Objection/.test(t)),
            'right-click on S2: Add Child offers "Rebuttal" only', JSON.stringify(menu.items));
        ok(menu.row.indexOf('Reb') >= 0 && menu.row.indexOf('Obj') < 0,
            'and Change Type offers "Reb" only', JSON.stringify(menu.row));
    }

    /* ---------------- 7. color key ---------------- */
    console.log('\n-- color key --');
    {
        const key = T(W, `var g = document.getElementById('group-color-key');
            var rows = g ? g.querySelectorAll('.color-key-row').length : 0;
            var text = g ? g.textContent.replace(/\\s+/g, ' ') : '';
            var b = document.getElementById('key-btn');
            var r = { rows: rows, text: text, edges: g ? g.querySelectorAll('svg').length : -1, inHelp: !!g.closest('#help-panel'), noButton: !b };
            toggleColorKey();
            r.afterHide = { hidden: document.body.classList.contains('color-key-hidden'), stored: localStorage.getItem('argmap-color-key'), visible: getComputedStyle(g).display !== 'none' };
            toggleColorKey();
            r.afterShow = { hidden: document.body.classList.contains('color-key-hidden'), stored: localStorage.getItem('argmap-color-key') };
            return r;`);
        key.afterHide = key.afterHide || {}; key.afterShow = key.afterShow || {};
        ok(key.rows === 4 && key.edges === 1 && /Main argument/.test(key.text) && /Objection/.test(key.text) && /Rebuttal/.test(key.text) &&
           /Weak objection or rebuttal/.test(key.text),
            'the toolbar has a color key: three colors, and one dotted-line row for weak objections and rebuttals', JSON.stringify({ rows: key.rows, edges: key.edges, text: key.text }));
        ok(key.inHelp && key.noButton, 'the legend is in Help without a toolbar button', JSON.stringify(key));
        ok(key.afterHide.hidden && key.afterHide.stored === '0' && key.afterHide.visible &&
           !key.afterShow.hidden && key.afterShow.stored === '1',
            'the View button hides and shows it, and remembers the choice', JSON.stringify([key.afterHide, key.afterShow]));
    }

    /* ---------------- 8. SVG export ---------------- */
    console.log('\n-- export --');
    {
        const svg = T(W, `__c.load(${JSON.stringify(TREES)}); var s = buildExportSVG() || '';
            var t = getExportTheme();
            var count = function (c) { return (s.match(new RegExp('<rect[^>]*stroke="' + c + '" stroke-width', 'g')) || []).length; };
            return { obj: count(t.border.objection), reb: count(t.border.rebuttal), sup: count(t.border.support) };`);
        ok(svg.obj === 7 && svg.reb === 2,
            'export borders use the derived color: 7 red boxes (O1 S2 Y1 S4 R0 F FS) and 2 orange (X1 S3)', JSON.stringify(svg));
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
