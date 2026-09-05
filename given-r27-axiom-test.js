'use strict';
// r27 Given / axiom premise regression.
//
// A "given" marks a premise taken as self-evident — one that receives no
// further justification. It is a per-BOX epistemic flag stored in
// node.givens[] parallel to node.texts[], orthogonal to the
// support/objection/rebuttal role (border colour) and composable with
// `implicit` (border style), which is why it claims the background channel.
//
// Covers:
//   (1) the tint is theme-aware rather than a fixed fill. This is the
//       constraint that drove the whole design: node text flips between
//       #e0e0e0 and #1a1a1a across themes, so a saturated green sits at the
//       luminance midpoint where NEITHER reads (#4caf50 scores 2.1:1 against
//       the dark theme's text). The test asserts the real contrast numbers so
//       a later "simplification" to one flat green fails loudly.
//   (2) text round-trip: "[M1S1a]" exports and imports, nesting with implicit
//       as "([M1S1a])", per box, contentions and notes exempt.
//   (3) toggleGiven per box and per group, plus its contention/note guard.
//   (4) givens[] stays parallel with texts[] across insert / delete / retag.
//   (5) the .given class reaches the rendered box, and the SVG export paints
//       the tint instead of the ordinary node background.
//
// Run:  node given-r27-axiom-test.js [argument-mapper-r27.html]
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

/* ---- WCAG contrast, so the readability claim is measured, not asserted ---- */
const _lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * _lin(n >> 16 & 255) + 0.7152 * _lin(n >> 8 & 255) + 0.0722 * _lin(n & 255);
}
function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    const hi = Math.max(x, y), lo = Math.min(x, y);
    return (hi + 0.05) / (lo + 0.05);
}

function makeWin(label) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
    function stubs(win) {
        const { webcrypto } = require('crypto');
        if (!win.crypto || !win.crypto.randomUUID) {
            Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
        }
        win.matchMedia = () => ({
            matches: false, media: '', addListener() {}, removeListener() {},
            addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
        });
        win.ResizeObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
        const ctx = new Proxy({}, {
            get: (_t, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx)
        });
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
    const dom = new JSDOM(HTML, {
        runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
        url: `https://localhost/${label}.html`, beforeParse: stubs
    });
    return { dom, errors, get win() { return dom.window; } };
}

const exportOf = (W, trees) => W.win.eval(`
    (function () {
        state.trees = ${JSON.stringify(trees)};
        ensureCollabFields(state);
        return generateTextRepresentation();
    })();
`);
const parseOf = (W, text) => W.win.eval(`JSON.parse(JSON.stringify(parseTextToState(${JSON.stringify(text)})))`);

function findByText(trees, needle) {
    let hit = null;
    (function walk(ns) {
        (ns || []).forEach(n => {
            if ((n.texts || []).some(t => t === needle)) hit = n;
            walk(n.children);
        });
    })(trees);
    return hit;
}

const TREES = [{
    id: 'root', type: 'contention', texts: ['Main'], collapsed: [], children: [
        {
            id: 'sup', type: 'support', texts: ['Axiom A', 'Ordinary B', 'Both C'],
            givens: [true, false, true], implicits: [false, false, true],
            collapsed: [], children: []
        },
        { id: 'note1', type: 'note', texts: ['Note text'], collapsed: [], children: [] }
    ]
}];

(async () => {
    console.log('=== r27 Given / axiom premises ===');

    /* ================================================================
       1. The tint is theme-aware, and both halves stay readable.
       ================================================================ */
    console.log('\n-- colour contract --');
    {
        // The dark (":root") tint and the light ("body.nodes-light") tint must
        // BOTH exist and must differ: one flat green for both themes is the
        // failure mode this guards against.
        const rootBlock = HTML.slice(HTML.indexOf(':root {'), HTML.indexOf('/* Light theme */'));
        const lightBlock = HTML.slice(HTML.indexOf('body.nodes-light {'),
                                      HTML.indexOf('body.nodes-light {') + 400);
        const darkBg = (rootBlock.match(/--color-given-bg:\s*(#[0-9a-fA-F]{6})/) || [])[1];
        const darkAccent = (rootBlock.match(/--color-given:\s*(#[0-9a-fA-F]{6})/) || [])[1];
        const lightBg = (lightBlock.match(/--color-given-bg:\s*(#[0-9a-fA-F]{6})/) || [])[1];
        const lightAccent = (lightBlock.match(/--color-given:\s*(#[0-9a-fA-F]{6})/) || [])[1];

        ok(!!darkBg && !!lightBg, 'both themes declare --color-given-bg',
            'dark=' + darkBg + ' light=' + lightBg);
        ok(darkBg && lightBg && darkBg.toLowerCase() !== lightBg.toLowerCase(),
            'the tint is theme-aware, not one flat green for both', darkBg + ' vs ' + lightBg);

        // The node text colours these tints must carry, per theme axis.
        const DARK_TEXT = '#e0e0e0', LIGHT_TEXT = '#1a1a1a';
        if (darkBg) {
            const c = contrast(darkBg, DARK_TEXT);
            ok(c >= 7, 'dark tint keeps node text at AAA (>=7:1)', darkBg + ' vs ' + DARK_TEXT + ' = ' + c.toFixed(2) + ':1');
        }
        if (lightBg) {
            const c = contrast(lightBg, LIGHT_TEXT);
            ok(c >= 7, 'light tint keeps node text at AAA (>=7:1)', lightBg + ' vs ' + LIGHT_TEXT + ' = ' + c.toFixed(2) + ':1');
        }
        // The accent bar is the non-colour-dependent cue; it has to be visible
        // ON the tint it sits on, in each theme.
        if (darkBg && darkAccent) {
            const c = contrast(darkBg, darkAccent);
            ok(c >= 4.5, 'dark accent bar reads against its own tint (>=4.5:1)',
                darkAccent + ' on ' + darkBg + ' = ' + c.toFixed(2) + ':1');
        }
        if (lightBg && lightAccent) {
            const c = contrast(lightBg, lightAccent);
            ok(c >= 4.5, 'light accent bar reads against its own tint (>=4.5:1)',
                lightAccent + ' on ' + lightBg + ' = ' + c.toFixed(2) + ':1');
        }
        // The regression this whole design exists to prevent.
        ok(contrast('#4caf50', '#e0e0e0') < 4.5,
            'sanity: a saturated green really would fail the dark theme',
            '#4caf50 vs #e0e0e0 = ' + contrast('#4caf50', '#e0e0e0').toFixed(2) + ':1');
    }

    const W = makeWin('given');
    await sleep(360);

    /* ================================================================
       2. Text round-trip.
       ================================================================ */
    console.log('\n-- text export / import --');
    const text = exportOf(W, TREES);
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    ok(lines.includes('[M1S1a]: Axiom A'), 'export: a given box is bracketed', lines.join(' | '));
    ok(lines.includes('M1S1b: Ordinary B'), 'export: a plain sibling carries no marks');
    ok(lines.includes('([M1S1c]): Both C'),
        'export: given nests inside implicit for a box that is both', lines.join(' | '));

    const parsed = parseOf(W, text);
    const sup = findByText(parsed.trees, 'Axiom A');
    ok(!!sup && !!sup.givens && sup.givens[0] === true, 'import: a bracketed box comes back given');
    ok(!!sup && !!sup.givens && !sup.givens[1], 'import: its plain sibling is NOT given',
        JSON.stringify(sup && sup.givens));
    ok(!!sup && !!sup.givens && sup.givens[2] === true && !!sup.implicits && sup.implicits[2] === true,
        'import: "([label])" comes back BOTH given and implicit',
        JSON.stringify({ g: sup && sup.givens, i: sup && sup.implicits }));
    ok(!!sup && sup.givens.length === sup.texts.length,
        'import: givens stays parallel with texts', JSON.stringify(sup && sup.givens));

    const again = exportOf(W, parsed.trees);
    ok(again === text, 'round-trip: export -> import -> export is byte-identical',
        again === text ? '' : ('\n--- first ---\n' + text + '\n--- second ---\n' + again));

    /* ---- guards: brackets are ignored where given cannot apply ---- */
    {
        const p = parseOf(W, ['[M1]: Main', '  [M1N1]: A note'].join('\n'));
        const main = findByText(p.trees, 'Main');
        ok(!!main && main.type === 'contention' && !(main.givens && main.givens[0]),
            'guard: brackets on a main contention are ignored');
        const nt = findByText(p.trees, 'A note');
        ok(!!nt && nt.type === 'note' && !(nt.givens && nt.givens[0]),
            'guard: brackets on a note are ignored');
    }
    /* ---- an unmatched bracket is not a mark ---- */
    {
        const p = parseOf(W, ['M1: Main', '  [M1S1: Half bracket'].join('\n'));
        const half = findByText(p.trees, 'Half bracket');
        ok(!!half && !(half.givens && half.givens[0]),
            'guard: a lone unmatched bracket is not a given mark',
            half && JSON.stringify(half.givens));
        ok(!!half && half.type === 'support', 'guard: ...and the label still parses', half && half.type);
    }
    /* ---- free-floating nodes ---- */
    {
        const p = parseOf(W, ['@500,300: Free root', '[@500,300S1]: Given child'].join('\n'));
        const kid = findByText(p.trees, 'Given child');
        ok(!!kid && kid.type === 'support' && !!kid.givens && kid.givens[0] === true,
            'free nodes: a given child of a free-floating root parses',
            kid && JSON.stringify(kid.givens));
    }
    /* ---- cross-references tolerate bracketed endpoints ---- */
    {
        const src = ['M1: Main', '  [M1S1a]: A', '  M1S1b: B', '  M1S2: C', '',
                     'Cross-references:', '[M1S1a] > M1S2'].join('\n');
        const p = parseOf(W, src);
        const a = findByText(p.trees, 'A');
        const c = findByText(p.trees, 'C');
        ok(!!a && !!a.crossRefs && (a.crossRefs[0] || []).length === 1,
            'cross-refs: a bracketed source endpoint resolves', a && JSON.stringify(a.crossRefs));
        ok(!!a && !!c && a.crossRefs[0][0].targetId === c.id,
            'cross-refs: it still points at the right target');
    }

    /* ================================================================
       3. toggleGiven behaviour.
       ================================================================ */
    console.log('\n-- toggleGiven --');
    const toggle = (trees, sel) => JSON.parse(W.win.eval(`
        (function () {
            state.trees = ${JSON.stringify(trees)};
            ensureCollabFields(state);
            selectedIds = ${JSON.stringify(sel)};
            toggleGiven();
            return JSON.stringify(state.trees);
        })();
    `));
    {
        const base = [{
            id: 'r', type: 'contention', texts: ['Main'], collapsed: [], children: [
                { id: 's', type: 'support', texts: ['A', 'B'], collapsed: [], children: [] },
                { id: 'n', type: 'note', texts: ['N'], collapsed: [], children: [] }
            ]
        }];
        const perBox = toggle(base, ['s-1']);
        const s1 = findByText(perBox, 'A');
        ok(!!s1 && s1.givens && s1.givens[1] === true && !s1.givens[0],
            'per box: toggling one co-premise leaves its sibling alone', JSON.stringify(s1 && s1.givens));

        const perGroup = toggle(base, ['s']);
        const s2 = findByText(perGroup, 'A');
        ok(!!s2 && s2.givens && s2.givens[0] === true && s2.givens[1] === true,
            'per group: selecting the whole node drives every box', JSON.stringify(s2 && s2.givens));

        const offAgain = toggle(perGroup, ['s']);
        const s3 = findByText(offAgain, 'A');
        ok(!!s3 && s3.givens && !s3.givens[0] && !s3.givens[1],
            'per group: toggling again clears every box', JSON.stringify(s3 && s3.givens));

        const onContention = toggle(base, ['r-0']);
        const r1 = findByText(onContention, 'Main');
        ok(!!r1 && !(r1.givens && r1.givens[0]),
            'guard: a main contention refuses the given flag', JSON.stringify(r1 && r1.givens));

        const onNote = toggle(base, ['n-0']);
        const n1 = findByText(onNote, 'N');
        ok(!!n1 && !(n1.givens && n1.givens[0]),
            'guard: a note refuses the given flag', JSON.stringify(n1 && n1.givens));
    }

    /* ---- retagging to a type that cannot be given clears the flags ---- */
    {
        const res = JSON.parse(W.win.eval(`
            (function () {
                state.trees = [{ id: 'r', type: 'contention', texts: ['Main'], collapsed: [], children: [
                    { id: 's', type: 'support', texts: ['A'], givens: [true], collapsed: [], children: [] }
                ] }];
                ensureCollabFields(state);
                selectedIds = ['s-0'];
                changeSelectedTypes('note');
                return JSON.stringify(state.trees);
            })();
        `));
        const a = findByText(res, 'A');
        ok(!!a && a.type === 'note' && !(a.givens && a.givens[0]),
            'retag: turning a given premise into a note clears the flag',
            a && JSON.stringify({ type: a.type, givens: a.givens }));
    }

    /* ================================================================
       4. givens[] stays parallel with texts[] through box edits.
       ================================================================ */
    console.log('\n-- parallel array maintenance --');
    {
        const parallel = JSON.parse(W.win.eval(`
            (function () {
                state.trees = [{ id: 'r', type: 'contention', texts: ['Main'], collapsed: [], children: [
                    { id: 's', type: 'support', texts: ['A', 'B', 'C'],
                      givens: [false, true, false], collapsed: [], children: [] }
                ] }];
                ensureCollabFields(state);
                var out = {};
                // Insert a fresh co-premise after box 0: the flag on 'B' must
                // ride along to its new index rather than staying put.
                selectedIds = ['s-0'];
                addCoPremise();
                var s = state.trees[0].children[0];
                out.afterInsert = { texts: s.texts.length, givens: s.givens.slice() };
                return JSON.stringify(out);
            })();
        `));
        ok(parallel.afterInsert.givens.length === parallel.afterInsert.texts,
            'insert: givens stays the same length as texts',
            JSON.stringify(parallel.afterInsert));
        ok(parallel.afterInsert.givens[2] === true,
            'insert: the flag follows its box to the new index',
            JSON.stringify(parallel.afterInsert.givens));
    }

    /* ================================================================
       5. Rendering and SVG export.
       ================================================================ */
    console.log('\n-- render + export --');
    {
        const cls = W.win.eval(`
            (function () {
                state.trees = ${JSON.stringify(TREES)};
                ensureCollabFields(state);
                selectedIds = ['root-0'];
                render();
                function clsOf(i) {
                    var el = document.querySelector('.node[data-node-id="sup"][data-node-idx="' + i + '"]');
                    return el ? el.className : '(missing)';
                }
                return JSON.stringify([clsOf(0), clsOf(1), clsOf(2)]);
            })();
        `);
        const c = JSON.parse(cls);
        ok(/\bgiven\b/.test(c[0]), 'render: a given box carries the .given class', c[0]);
        ok(!/\bgiven\b/.test(c[1]), 'render: a plain box does not', c[1]);
        ok(/\bgiven\b/.test(c[2]) && /\bimplicit\b/.test(c[2]),
            'render: a box that is both carries BOTH classes', c[2]);
        ok(/\btype-support\b/.test(c[0]),
            'render: the given box keeps its support role class', c[0]);
    }
    {
        const svgInfo = JSON.parse(W.win.eval(`
            (function () {
                state.trees = ${JSON.stringify(TREES)};
                ensureCollabFields(state);
                selectedIds = ['root-0'];
                render();
                var svg = buildExportSVG();
                if (!svg) return JSON.stringify({ error: 'buildExportSVG returned null' });
                var theme = getExportTheme();
                return JSON.stringify({
                    hasGivenBg: svg.indexOf('fill="' + theme.givenBg + '"') >= 0,
                    hasAccent: svg.indexOf('fill="' + theme.givenAccent + '"') >= 0,
                    givenBg: theme.givenBg,
                    givenAccent: theme.givenAccent,
                    anyVarLeft: /var\\(/.test(svg)
                });
            })();
        `));
        ok(!svgInfo.error, 'export: buildExportSVG produced output', svgInfo.error);
        ok(svgInfo.hasGivenBg, 'export: a given box is filled with the tint, not the node background',
            'givenBg=' + svgInfo.givenBg);
        ok(svgInfo.hasAccent, 'export: the accent bar is drawn too', 'accent=' + svgInfo.givenAccent);
        ok(svgInfo.anyVarLeft === false, 'export: no unresolved var() leaked in');
    }

    /* ---- no script errors along the way ---- */
    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));

    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
