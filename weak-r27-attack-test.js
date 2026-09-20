'use strict';
// r27 Weak objections and weak rebuttals.
//
// An objection or rebuttal says the other side's premise is false. A WEAK one
// denies the premise without endorsing its negation. Like the ordinary pair,
// the app picks which from whose premise is answered:
//   - WEAK OBJECTION: the opponent's, against a white or orange premise. Red.
//   - WEAK REBUTTAL: the proponent's, against a red premise. Orange.
// A weak BRANCH -- the weak objection or rebuttal and everything beneath it
// that has not started an argument of its own -- is DASHED throughout: box
// borders, connectors and forks, so it reads as weak at a glance. (Implicit
// premises, which used to own the dashed border, are now see-through: see
// implicit-r27-see-through-test.js.) Box borders take the same colors as the
// connectors.
// It is otherwise an argument like any other: it can be supported, attacked
// or weakly attacked in turn. Map text letters: Q (questions the argument)
// and P (preserves it). W and Ctrl+Enter pick the right one, as O and
// Shift+Enter do for the ordinary pair; on the top box of a separate tree
// nothing picks, so O and W switch it within its pair. B toggles Breadth.
//
// Covers:
//   (1) the derivation: kinds, sides and color families, including a weak
//       attack on a weak attack, ordinary attacks inside weak branches, a
//       mis-stored kind, a note passing a weak side down, and a free root;
//   (2) rendering: type-/side- classes, data-color, and the stylesheet;
//       nothing of the earlier Block/Guard or blue/purple remains;
//   (3) connectors and borders: dashed through a whole weak branch
//       (supports, notes and forks too), solid wherever an ordinary argument
//       starts; arrowheads keep one size;
//   (4) labels and map text: Q and P, a round-trip, a hand-written string;
//   (5) keys: W, Alt+W and Ctrl+Enter pick the kind; O makes a weak one
//       ordinary again; R still attacks; G is still Given; B toggles Breadth;
//   (6) a separate tree's top box: O and W switch it within its pair;
//   (7) the toolbar buttons, the context menu and the node + buttons;
//   (8) the Color Key and the Help text;
//   (9) the SVG export: borders by color family, dashed weak branches;
//  (10) borders match the connector colors, and an implicit premise is dashed
//       only when it is weak.
//
// Run:  node weak-r27-attack-test.js [argument-mapper-r27.html]
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
const WO = 'weak-objection', WR = 'weak-rebuttal';
// M  main contention                               white
// ├─ S1 support                                    white, solid
// │  ├─ B1 weak objection                          red, dashed
// │  │  ├─ BS support                              red, dashed (inside the weak branch), still S
// │  │  ├─ BR stored 'objection'                   attacks a weak objection -> REBUTTAL, orange, SOLID
// │  │  ├─ BG stored weak objection                weakly attacks it -> WEAK REBUTTAL, orange, dashed
// │  │  │  ├─ GS support                           orange, dashed
// │  │  │  └─ GB stored weak rebuttal              -> WEAK OBJECTION, red, dashed
// │  │  └─ BN note                                 note look, passes the weak side down: dashed
// │  │     └─ BNS support                          red, dashed
// │  └─ O1 objection                               red, solid
// │     ├─ G1 stored weak rebuttal                 weakly attacks red -> WEAK REBUTTAL, orange, dashed
// │     │  └─ GO stored 'rebuttal'                 attacks a weak rebuttal -> OBJECTION, red, SOLID
// │     └─ R1 rebuttal                             orange, solid
// │        └─ RB stored weak rebuttal              weakly attacks orange -> WEAK OBJECTION, red, dashed
// └─ W1 stored weak rebuttal on the main contention -> WEAK OBJECTION, red, dashed
// X  free-floating root weak rebuttal              orange (no parent: stored kind decides)
// └─ XS support                                    orange, dashed
const TREES = [
    N('M', 'contention', [
        N('S1', 'support', [
            N('B1', WO, [
                N('BS', 'support'),
                N('BR', 'objection'),
                N('BG', WO, [ N('GS', 'support'), N('GB', WR) ]),
                N('BN', 'note', [ N('BNS', 'support') ])
            ]),
            N('O1', 'objection', [
                N('G1', WR, [ N('GO', 'rebuttal') ]),
                N('R1', 'rebuttal', [ N('RB', WR) ])
            ])
        ]),
        N('W1', WR)
    ], { x: 30000, y: 30000 }),
    N('X', WR, [ N('XS', 'support') ], { x: 500, y: 300, freePosition: true })
];

// Separate trees whose top boxes nothing picks for.
const ROOTS = [
    N('M', 'contention', [ N('S', 'support') ], { x: 30000, y: 30000 }),
    N('FO', 'objection', [ N('FOS', 'support') ], { x: 500, y: 300, freePosition: true }),
    N('FW', WO, [], { x: 900, y: 300, freePosition: true }),
    N('FS', 'support', [], { x: 1300, y: 300, freePosition: true })
];

// Forks: a two-premise weak objection, and a two-premise support inside it.
const FORK = [
    N('M', 'contention', [
        N('S', 'support', [
            Object.assign(N('WW', WO, [ Object.assign(N('WS', 'support'), { texts: ['WS-a', 'WS-b'] }) ]), { texts: ['WW-a', 'WW-b'] }),
            Object.assign(N('OO', 'objection'), { texts: ['OO-a', 'OO-b'] })
        ])
    ], { x: 30000, y: 30000 })
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
        type(id) { return findNodeContext(state.trees, id).node.type; },
        kind(id) { return computeArgumentKinds(state.trees).get(id); },
        childOf(id) { const n = findNodeContext(state.trees, id).node; return n.children[n.children.length - 1]; },
        blur() { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); },
        text(id) { var el = document.getElementById(id); return el ? el.textContent.replace(/\\s+/g, ' ').trim() : null; }
    };
`;
// A section that throws (e.g. against a build without the feature) reports
// its checks as failures instead of aborting the whole run.
const T = (W, body) => {
    try { return JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`)); }
    catch (e) { return { __error: String((e && e.message) || e) }; }
};
const J = JSON.stringify;

(async () => {
    console.log('=== r27 weak objections and weak rebuttals ===');
    const W = makeWin('weak-attack');
    await sleep(250);
    W.win.eval(HELPERS);

    /* ---------------- 1. derivation ---------------- */
    console.log('\n-- derivation --');
    {
        const k = T(W, `var m = computeArgumentKinds(${J(TREES)}); var o = {}; m.forEach(function (v, id) { o[id] = v; }); return o;`);
        const want = {
            S1:  ['support', 'main', 'support'],
            B1:  [WO, WO, 'objection'],
            BS:  ['support', WO, 'objection'],
            BR:  ['rebuttal', 'rebuttal', 'rebuttal'],
            BG:  [WR, WR, 'rebuttal'],
            GS:  ['support', WR, 'rebuttal'],
            GB:  [WO, WO, 'objection'],
            BN:  ['note', WO, 'note'],
            BNS: ['support', WO, 'objection'],
            O1:  ['objection', 'objection', 'objection'],
            G1:  [WR, WR, 'rebuttal'],
            GO:  ['objection', 'objection', 'objection'],
            R1:  ['rebuttal', 'rebuttal', 'rebuttal'],
            RB:  [WO, WO, 'objection'],
            W1:  [WO, WO, 'objection'],
            X:   [WR, WR, 'rebuttal'],
            XS:  ['support', WR, 'rebuttal'],
        };
        const why = {
            B1:  'a weak attack on a white premise is a WEAK OBJECTION, in objection red',
            BS:  'a support backing it is red, on the weak side, and still a support',
            BR:  'an ordinary attack on a weak objection is a REBUTTAL: it is the opponent',
            BG:  'a weak attack on a weak objection is a WEAK REBUTTAL, in rebuttal orange',
            GS:  'a support inside a weak rebuttal is orange',
            GB:  'a weak attack on a weak rebuttal is a WEAK OBJECTION: it is the proponent',
            BN:  'a note keeps its own look but sits on the weak side',
            BNS: 'and passes that side down',
            G1:  'a weak attack on a red premise is a WEAK REBUTTAL',
            GO:  "an attack on a weak rebuttal is an OBJECTION (a stored 'rebuttal' reinterpreted)",
            RB:  'a weak attack on an orange premise is a WEAK OBJECTION',
            W1:  'a stored weak rebuttal hung on the main contention is a WEAK OBJECTION',
            X:   'a free-floating root keeps its stored kind',
            XS:  'and its supports take its color and side',
        };
        Object.keys(want).forEach(id => {
            const got = k[id] ? [k[id].kind, k[id].side, k[id].color] : null;
            ok(J(got) === J(want[id]), id + ': ' + (why[id] || want[id].join(' / ')), J(got));
        });
    }

    /* ---------------- 2. rendering ---------------- */
    console.log('\n-- rendering --');
    {
        const r = T(W, `__c.load(${J(TREES)});
            var o = {}; ['B1','BS','BG','GS','W1'].forEach(function (id) {
                var b = __c.box(id); o[id] = b ? { cls: b.className, color: b.getAttribute('data-color') } : null; });
            return o;`);
        const has = (id, c) => r[id] && new RegExp('(^|\\s)' + c + '(\\s|$)').test(r[id].cls);
        ok(has('B1', 'type-weak-objection') && has('B1', 'side-weak-objection') && r.B1.color === 'objection', 'B1 renders as a weak objection in the objection color', J(r.B1));
        ok(has('BS', 'type-support') && has('BS', 'side-weak-objection') && r.BS.color === 'objection', 'BS renders as a support on the weak-objection side, red', J(r.BS));
        ok(has('BG', 'type-weak-rebuttal') && r.BG.color === 'rebuttal', 'BG renders as a weak rebuttal in the rebuttal color', J(r.BG));
        ok(has('GS', 'type-support') && has('GS', 'side-weak-rebuttal') && r.GS.color === 'rebuttal', 'GS renders orange', J(r.GS));
        ok(has('W1', 'type-weak-objection'), 'W1 renders as a weak objection', J(r.W1));

        const css = HTML.slice(0, HTML.indexOf('</style>'));
        ok(/\.type-weak-objection\s*\{\s*border-color:\s*var\(--line-objection\)/.test(css) &&
           /\.type-weak-rebuttal\s*\{\s*border-color:\s*var\(--line-rebuttal\)/.test(css),
            'the stylesheet borders weak objections red and weak rebuttals orange');
        ok(/\.type-support\.side-objection,\s*\.type-support\.side-weak-objection\s*\{\s*border-color:\s*var\(--line-objection\)/.test(css) &&
           /\.type-support\.side-rebuttal,\s*\.type-support\.side-weak-rebuttal\s*\{\s*border-color:\s*var\(--line-rebuttal\)/.test(css),
            'and supports inside them by the same colors');
        ok(!/(Types|Kind|type\(|Type\()\('(block|guard)'|type === '(block|guard)'|'guard'|type-block|type-guard|btn-(add|type)-hold|Block \/ Guard|--(color|line)-(guard|block)\b|arrow-(guard|block)\b/.test(HTML),
            'nothing of Block/Guard or the blue and purple palette remains');
    }

    /* ---------------- 3. connectors ---------------- */
    console.log('\n-- connectors --');
    {
        const lines = T(W, `__c.load(${J(TREES)}); drawLines();
            var out = {};
            document.querySelectorAll('#lines-svg path[data-child]').forEach(function (p) {
                var id = p.getAttribute('data-child');
                if (p.getAttribute('marker-end')) out[id] = { stroke: p.getAttribute('stroke'), marker: p.getAttribute('marker-end'),
                    dash: p.getAttribute('stroke-dasharray'), cap: p.getAttribute('stroke-linecap') };
            });
            var all = Array.prototype.slice.call(document.querySelectorAll('#lines-svg path[marker-end]')).map(function (p) {
                var m = (p.getAttribute('marker-end').match(/#(.+?)\\)/) || [])[1]; return !!(m && document.getElementById(m)); });
            return { out: out, allResolve: all.length > 0 && all.every(Boolean), count: all.length,
                     dashed: document.querySelectorAll('#lines-svg path[data-child][stroke-dasharray]').length };`);
        const e = lines.out || {};
        const dashed = (id) => !!(e[id] && e[id].dash === '7 5');
        const solid = (id) => !!(e[id] && !e[id].dash);
        const color = (id, c) => !!(e[id] && e[id].stroke === 'var(--line-' + c + ')' && e[id].marker === 'url(#arrow-' + c + ')');
        ok(dashed('B1') && color('B1', 'objection'), 'B1 -> S1: a red, dashed arrow', J(e.B1));
        ok(dashed('BS') && color('BS', 'objection'), 'BS -> B1: dashed too — a support inside a weak branch belongs to it', J(e.BS));
        ok(dashed('BG') && color('BG', 'rebuttal') && dashed('GS') && dashed('GB'), 'BG, GS and GB: the nested weak branch is dashed throughout', J([e.BG, e.GS, e.GB]));
        ok(dashed('BN') && dashed('BNS'), 'a note inside a weak branch, and what hangs under it, are dashed', J([e.BN, e.BNS]));
        ok(solid('BR') && color('BR', 'rebuttal') && solid('GO') && color('GO', 'objection'),
            'an ordinary rebuttal or objection inside a weak branch starts a solid argument of its own', J([e.BR, e.GO]));
        ok(solid('S1') && solid('O1') && solid('R1') && dashed('G1') && dashed('RB') && dashed('W1') && dashed('XS'),
            'ordinary branches stay solid; every weak branch, attached or free, is dashed', J([e.S1, e.O1, e.R1, e.G1, e.RB, e.W1, e.XS]));
        ok(lines.count === 16 && lines.dashed === 11, 'of 16 connectors, exactly the 11 in weak branches are dashed', J({ count: lines.count, dotted: lines.dashed }));
        ok(lines.allResolve, 'every connector marker reference resolves', 'count=' + lines.count);

        const markers = T(W, `return Array.prototype.slice.call(document.querySelectorAll('#lines-svg marker')).map(function (m) {
            return { id: m.id, units: m.getAttribute('markerUnits'), w: m.getAttribute('markerWidth'), h: m.getAttribute('markerHeight') }; });`);
        ok(Array.isArray(markers) && markers.length === 5 && markers.every(m => m.units === 'userSpaceOnUse' && m.w === '12' && m.h === '12'),
            'every arrowhead is a fixed 12px, whatever the line, so weak branches get the same heads as regular ones', J(markers));
        ok(Array.isArray(markers) && J(markers.map(m => m.id)) === J(['arrow-contention', 'arrow-support', 'arrow-objection', 'arrow-rebuttal', 'arrow-note']),
            'one head per color family, and none for the retired untyped box', J(markers.map(m => m.id)));

        const fork = T(W, `__c.load(${J(FORK)}); drawLines();
            var dash = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)).map(function (p) { return !!p.getAttribute('stroke-dasharray'); }); };
            return { weakFork: dash('#lines-svg path[data-fork="WW"]'), innerFork: dash('#lines-svg path[data-fork="WS"]'),
                     ordinaryFork: dash('#lines-svg path[data-fork="OO"]'),
                     weakConn: dash('#lines-svg path[data-child="WW"]'), innerConn: dash('#lines-svg path[data-child="WS"]') };`);
        const allTrue = a => Array.isArray(a) && a.length > 0 && a.every(Boolean);
        const allFalse = a => Array.isArray(a) && a.length > 0 && a.every(x => !x);
        ok(allTrue(fork.weakFork) && allTrue(fork.weakConn), 'a two-premise weak objection: its fork and its connector are dashed', J(fork));
        ok(allTrue(fork.innerFork) && allTrue(fork.innerConn), 'a two-premise support inside it: dashed as well', J(fork));
        ok(allFalse(fork.ordinaryFork), "an ordinary objection's fork beside it stays solid", J(fork));

        const borders = T(W, `__c.load(${J(TREES)});
            var st = function (id) { var b = __c.box(id); return b ? getComputedStyle(b).borderTopStyle : null; };
            var o = {}; ['S1', 'O1', 'R1', 'BR', 'GO', 'B1', 'BS', 'BG', 'GS', 'BN', 'BNS', 'G1', 'RB', 'W1', 'XS'].forEach(function (id) { o[id] = st(id); });
            return o;`);
        const dashedBoxes = ['B1', 'BS', 'BG', 'GS', 'BN', 'BNS', 'G1', 'RB', 'W1', 'XS'], solidBoxes = ['S1', 'O1', 'R1', 'BR', 'GO'];
        // (jsdom resolves the solid 'border' shorthand to no style at all, hence 'not dashed'.)
        ok(dashedBoxes.every(id => borders[id] === 'dashed') && solidBoxes.every(id => borders[id] !== 'dashed'),
            'every box in a weak branch (weak boxes, supports, notes) has a dashed border; ordinary boxes stay solid', J(borders));
    }

    /* ---------------- 4. labels and map text ---------------- */
    console.log('\n-- labels and map text --');
    {
        const lab = T(W, `__c.load(${J(TREES)}); labelMode = 'complex'; render();
            var ids = ['B1','BS','BR','BG','GS','GB','BNS','G1','GO','RB','W1','XS'];
            var o = {}; ids.forEach(function (id) { o[id] = currentLabels.get(id + '-0'); });
            labelMode = 'simple'; render();
            var s = {}; ['B1','BG','GB','G1','RB','W1','X'].forEach(function (id) { s[id] = currentLabels.get(id + '-0'); });
            labelMode = 'none'; render();
            return { complex: o, simple: s };`);
        const c = lab.complex || {}, s = lab.simple || {};
        ok(c.B1 === 'M1S1Q1' && c.W1 === 'M1Q1', 'weak objections are lettered Q: M1S1Q1, M1Q1', c.B1 + ' / ' + c.W1);
        ok(c.BS === 'M1S1Q1S1' && c.BR === 'M1S1Q1R1', 'a support inside one stays S; an ordinary attack on it is R', c.BS + ' / ' + c.BR);
        ok(c.BG === 'M1S1Q1P1' && c.GS === 'M1S1Q1P1S1' && c.GB === 'M1S1Q1P1Q1', 'weak rebuttals are lettered P, and weak attacks nest: M1S1Q1P1Q1', [c.BG, c.GS, c.GB].join(' / '));
        ok(c.G1 === 'M1S1O1P1' && c.GO === 'M1S1O1P1O1' && c.RB === 'M1S1O1R1Q1', 'P on an objection, O on that, Q on a rebuttal', [c.G1, c.GO, c.RB].join(' / '));
        ok(c.BNS === 'M1S1Q1N1S1' && c.XS === 'P1S1', 'notes label as before; a separate tree is named by its top box, here a weak rebuttal: P1', c.BNS + ' / ' + c.XS);
        ok(s.B1 === 'Q1' && s.GB === 'Q2' && s.RB === 'Q3' && s.W1 === 'Q4' && s.BG === 'P1' && s.G1 === 'P2' && s.X === 'P3',
            'simple labels count Q and P separately', J(s));

        const rt = T(W, `__c.load(${J(TREES)});
            var text = generateTextRepresentation();
            var parsed = parseTextToState(text);
            var kinds = computeArgumentKinds(parsed.trees);
            var byText = {};
            (function walk(ns) { (ns || []).forEach(function (n) { var k = kinds.get(n.id); byText[n.texts[0]] = k.kind + '/' + k.side; walk(n.children); }); })(parsed.trees);
            return { text: text, byText: byText };`);
        rt.text = rt.text || ''; rt.byText = rt.byText || {};
        ok(/M1S1Q1P1Q1\s*:\s*GB/.test(rt.text) && /M1S1O1P1\s*:\s*G1/.test(rt.text) && /M1Q1\s*:\s*W1/.test(rt.text),
            'text export writes Q and P', rt.text.split('\n').filter(l => /GB|G1|W1/.test(l)).join(' | '));
        const bt = rt.byText;
        ok(bt.B1 === WO + '/' + WO && bt.BG === WR + '/' + WR && bt.GB === WO + '/' + WO && bt.G1 === WR + '/' + WR &&
           bt.RB === WO + '/' + WO && bt.W1 === WO + '/' + WO && bt.BS === 'support/' + WO && bt.GS === 'support/' + WR && bt.BR === 'rebuttal/rebuttal',
            'and importing that text gives the same kinds and sides back', J(bt));

        const hand = T(W, `var p = parseTextToState([
                'M1: Ban cars downtown',
                '  M1S1: It cuts pollution',
                '    M1S1Q1: That needs evidence',
                '      M1S1Q1P1: It does not',
                '    M1S1O1: Shops will close',
                '      M1S1O1P1: No evidence given',
                '    M1S1aQ1: Not a co-premise mix-up'
            ].join('\\n'));
            var kinds = computeArgumentKinds(p.trees), o = {};
            (function walk(ns) { (ns || []).forEach(function (n) { o[n.texts[0]] = n.type + '>' + kinds.get(n.id).kind; walk(n.children); }); })(p.trees);
            return o;`);
        ok(hand['That needs evidence'] === WO + '>' + WO && hand['It does not'] === WR + '>' + WR &&
           hand['No evidence given'] === WR + '>' + WR && hand['Shops will close'] === 'objection>objection',
            'a hand-written string reads Q as a weak objection and P as a weak rebuttal', J(hand));
    }

    /* ---------------- 5. keys ---------------- */
    console.log('\n-- keys --');
    {
        const w = T(W, `var out = {};
            ['S1', 'BS', 'GS', 'GO', 'RB'].forEach(function (id) {
                __c.load(${J(TREES)}, [id + '-0']); __c.key('KeyW', 'w'); out[id] = __c.type(id); });
            return out;`);
        ok(w.S1 === 'support', 'W leaves support unchanged: there is no weak-support type', J(w));
        ok(w.BS === 'support', 'W leaves a support inside a weak objection unchanged', J(w));
        ok(w.GS === 'support' && w.GO === WO, 'W preserves support but weakens an ordinary objection', J(w));
        ok(w.RB === 'objection', 'W strengthens a weak objection under an orange premise', J(w));

        const altW = T(W, `__c.load(${J(TREES)}, ['BS-0']); __c.key('KeyW', 'w', { altKey: true }); return __c.type('BS');`);
        const altMac = T(W, `__c.load(${J(TREES)}, ['S1-0']); __c.key('KeyW', '∑', { altKey: true }); return __c.type('S1');`);
        ok(altW === 'support' && altMac === 'support', 'Alt+W and macOS Option+W also preserve supports', J([altW, altMac]));

        const ctrlEnter = T(W, `var out = {};
            [['S1', 'ctrlKey'], ['O1', 'ctrlKey'], ['B1', 'metaKey'], ['BG', 'ctrlKey']].forEach(function (p) {
                var o = {}; o[p[1]] = true;
                __c.load(${J(TREES)}, [p[0] + '-0']); __c.key('Enter', 'Enter', o); __c.blur();
                var ch = __c.childOf(p[0]); out[p[0]] = { stored: ch.type, cls: (__c.box(ch.id) || {}).className };
            });
            return out;`);
        ok(ctrlEnter.S1 && ctrlEnter.S1.stored === WO && /type-weak-objection/.test(ctrlEnter.S1.cls), 'Ctrl+Enter on a white premise adds a WEAK OBJECTION', J(ctrlEnter.S1));
        ok(ctrlEnter.O1 && ctrlEnter.O1.stored === WR && /type-weak-rebuttal/.test(ctrlEnter.O1.cls), 'Ctrl+Enter on a red premise adds a WEAK REBUTTAL', J(ctrlEnter.O1));
        ok(ctrlEnter.B1 && ctrlEnter.B1.stored === WR, 'Cmd+Enter on a weak objection adds a WEAK REBUTTAL', J(ctrlEnter.B1));
        ok(ctrlEnter.BG && ctrlEnter.BG.stored === WO, 'Ctrl+Enter on a weak rebuttal adds a WEAK OBJECTION', J(ctrlEnter.BG));

        const shiftEnter = T(W, `__c.load(${J(TREES)}, ['B1-0']); __c.key('Enter', 'Enter', { shiftKey: true }); __c.blur();
            return __c.childOf('B1').type;`);
        ok(shiftEnter === 'rebuttal', 'Shift+Enter on a weak objection adds an ordinary REBUTTAL', J(shiftEnter));

        const oR = T(W, `var out = {};
            __c.load(${J(TREES)}, ['BS-0']); __c.key('KeyO', 'o'); out.o = __c.type('BS');
            __c.load(${J(TREES)}, ['GS-0']); __c.key('KeyR', 'r'); out.r = __c.type('GS');
            __c.load(${J(TREES)}, ['B1-0']); __c.key('KeyO', 'o'); out.strong = __c.type('B1');
            return out;`);
        ok(oR.o === 'rebuttal' && oR.r === 'objection', 'O and R still make the ordinary attack that fits', J(oR));
        ok(oR.strong === 'support', 'O turns a weak objection into support', J(oR));

        const given = T(W, `__c.load(${J(TREES)}, ['S1-0']); __c.key('KeyG', 'g');
            var n = findNodeContext(state.trees, 'S1').node; return { type: n.type, given: !!(n.givens && n.givens[0]) };`);
        ok(given.type === 'support' && given.given === true, 'G is still Given', J(given));

        const breadth = T(W, `__c.load(${J(TREES)}); layoutMode = 'compact'; toggleLayoutMode(); toggleLayoutMode();
            var btn = document.getElementById('layout-btn'); var out = { label0: btn.textContent.trim(), tip: btn.title };
            __c.key('KeyW', 'w'); out.afterW = layoutMode;
            __c.key('KeyB', 'b'); out.afterB = layoutMode; out.label1 = btn.textContent.trim(); out.active1 = btn.classList.contains('active');
            __c.key('KeyB', 'b'); out.back = layoutMode; out.label2 = btn.textContent.trim();
            return out;`);
        ok(breadth.afterW === 'compact', 'W does not toggle the layout', J(breadth));
        ok(breadth.label0 === 'Breadth: Narrow B' && breadth.afterB === 'spread' && breadth.label1 === 'Breadth: Wide B' && breadth.active1 === true &&
           breadth.back === 'compact' && breadth.label2 === 'Breadth: Narrow B', 'B toggles Breadth between Narrow and Wide, and the button says so', J(breadth));
        ok(/Breadth: Narrow/.test(breadth.tip || '') && /— B$/.test(breadth.tip || ''), 'the Breadth tooltip names both settings and B', J(breadth.tip));

        const present = T(W, `__c.load(${J(TREES)}, ['S1-0']); presentMode = true;
            __c.key('KeyW', 'w'); var t = __c.type('S1');
            var before = layoutMode; __c.key('KeyB', 'b'); var after = layoutMode;
            presentMode = false; if (after !== before) toggleLayoutMode();
            return { type: t, toggled: after !== before };`);
        ok(present.type === 'support' && present.toggled === true,
            'in present mode W edits nothing, while B, a view key, still works', J(present));
    }

    /* ---------------- 6. a separate tree's top box ---------------- */
    console.log('\n-- a separate tree\'s top box --');
    {
        const o = T(W, `__c.load(${J(ROOTS)}, ['FO-0']);
            var out = {};
            __c.key('KeyO', 'o'); out.once = __c.type('FO'); out.supportColor = __c.kind('FOS').color;
            __c.key('KeyO', 'o'); out.twice = __c.type('FO');
            return out;`);
        ok(o.once === 'support' && o.twice === 'objection', 'O on a separate objection toggles support and back', J(o));
        ok(o.supportColor === 'support', 'its supporting descendants follow the new support side', J(o));

        const w = T(W, `__c.load(${J(ROOTS)}, ['FW-0']);
            __c.key('KeyW', 'w'); var once = __c.type('FW'); __c.key('KeyW', 'w'); var twice = __c.type('FW');
            return { once: once, twice: twice };`);
        ok(w.once === 'objection' && w.twice === WO, 'W on a separate weak objection toggles regular and weak without switching sides', J(w));

        const other = T(W, `var out = {};
            __c.load(${J(ROOTS)}, ['FS-0']); __c.key('KeyW', 'w'); out.supportW = __c.type('FS');
            __c.load(${J(ROOTS)}, ['FS-0']); __c.key('KeyO', 'o'); out.supportO = __c.type('FS');
            __c.load(${J(ROOTS)}, ['FW-0']); __c.key('KeyO', 'o'); out.weakO = __c.type('FW');
            __c.load(${J(ROOTS)}, ['FO-0']); __c.key('KeyW', 'w'); out.objectionW = __c.type('FO');
            __c.load(${J(ROOTS)}, ['FO-0']); __c.key('KeyR', 'r'); out.r1 = __c.type('FO'); __c.key('KeyR', 'r'); out.r2 = __c.type('FO');
            __c.load(${J(ROOTS)}, ['S-0']); __c.key('KeyO', 'o'); out.attachedO1 = __c.type('S'); __c.key('KeyO', 'o'); out.attachedO2 = __c.type('S');
            return out;`);
        ok(other.supportW === 'support' && other.supportO === 'objection', 'W preserves a separate support; O changes it to an objection', J(other));
        ok(other.weakO === 'support' && other.objectionW === WO, 'O changes weak objection to support; W weakens an ordinary objection', J(other));
        ok(other.r1 === 'rebuttal' && other.r2 === 'rebuttal', 'R asks for a rebuttal outright, so it does not switch back', J(other));
        ok(other.attachedO1 === 'objection' && other.attachedO2 === 'support', 'O toggles an attached premise between attack and support', J(other));

        const tb = T(W, `var out = {};
            function read() { return { obj: __c.text('btn-type-obj'), weak: __c.text('btn-type-weak'),
                objTip: document.getElementById('btn-type-obj').title, weakTip: document.getElementById('btn-type-weak').title }; }
            __c.load(${J(ROOTS)}, ['FO-0']); out.FO = read();
            document.getElementById('btn-type-obj').click(); out.afterClick = __c.type('FO'); out.FOafter = read();
            __c.load(${J(ROOTS)}, ['FW-0']); out.FW = read();
            document.getElementById('btn-type-weak').click(); out.afterWeakClick = __c.type('FW');
            __c.load(${J(ROOTS)}, ['S-0']); out.S = read();
            return out;`);
        ok(tb.FO && tb.FO.obj === 'Rebuttal O' && tb.FO.weak === 'Weak Objection W' && /separate tree/.test(tb.FO.objTip),
            'the toolbar offers the switch on a separate objection: "Rebuttal O", and says why', J(tb.FO));
        ok(tb.afterClick === 'rebuttal' && tb.FOafter && tb.FOafter.obj === 'Objection O', 'clicking it switches the tree, and the button then offers the way back', J([tb.afterClick, tb.FOafter]));
        ok(tb.FW && tb.FW.weak === 'Weak Rebuttal W' && tb.afterWeakClick === WR, 'on a separate weak objection the weak button offers, and makes, "Weak Rebuttal"', J([tb.FW, tb.afterWeakClick]));
        ok(tb.S && tb.S.obj === 'Objection O' && !/separate tree/.test(tb.S.objTip), 'an attached box keeps the picked-for-you wording', J(tb.S));

        const menu = T(W, `__c.load(${J(ROOTS)}); showContextMenu(10, 10, 'FO', 0);
            var m = document.getElementById('context-menu');
            var row = Array.prototype.slice.call(m.querySelectorAll('.ctx-row button'));
            var reb = row.find(function (b) { return b.textContent.trim() === 'Reb'; });
            var out = { row: row.map(function (b) { return b.textContent.trim(); }), rebLit: reb ? reb.classList.contains('ctx-current') : null };
            if (reb) reb.click();
            out.after = __c.type('FO');
            hideContextMenu();
            return out;`);
        ok(menu.row && menu.row.indexOf('Reb') >= 0 && menu.row.indexOf('Weak Obj') >= 0 && menu.rebLit === false && menu.after === 'rebuttal',
            'the context menu on a separate objection offers "Reb" (not lit as current), and it switches the tree', J(menu));
    }

    /* ---------------- 7. buttons, menu, node + buttons ---------------- */
    console.log('\n-- buttons and menu --');
    {
        const labels = T(W, `var out = {};
            function read(sel) { __c.load(${J(TREES)}, sel);
                var a = document.getElementById('btn-add-weak'), t = document.getElementById('btn-type-weak');
                return { add: __c.text('btn-add-weak'), type: __c.text('btn-type-weak'),
                         addOff: a && a.disabled, typeOff: t && t.disabled, addEdge: a.style.getPropertyValue('--look-edge'), addStyle: a.style.getPropertyValue('--look-style'), typeStyle: t.style.getPropertyValue('--look-style') }; }
            out.S1 = read(['S1-0']); out.BS = read(['BS-0']); out.G1 = read(['G1-0']); out.X = read(['X-0']); out.none = read([]);
            return out;`);
        ['S1', 'BS', 'G1', 'X', 'none'].forEach(k => { labels[k] = labels[k] || {}; });
        ok(labels.S1.add === 'Add Weak Objection Ctrl+Enter' && labels.S1.type === 'Weak Objection W',
            'with white S1 selected: "Add Weak Objection" (Ctrl+Enter), and retyping it makes a "Weak Objection" (W)', J(labels.S1));
        ok(labels.S1.addEdge === 'var(--line-objection)' && labels.S1.addStyle === 'dashed' && labels.S1.typeStyle === 'dashed',
            'the weak buttons are drawn as weak objection boxes: an objection-red border, dashed', J(labels.S1));
        ok(labels.BS.add === 'Add Weak Rebuttal Ctrl+Enter' && labels.BS.type === 'Weak Rebuttal W' && /line-rebuttal/.test(labels.BS.addEdge),
            'with red BS selected: "Add Weak Rebuttal", bordered in rebuttal orange', J(labels.BS));
        ok(labels.G1.add === 'Add Weak Objection Ctrl+Enter' && labels.G1.type === 'Weak Rebuttal W',
            'with orange G1 selected: weakly attacking it is a weak objection; G1 stays a weak rebuttal', J(labels.G1));
        ok(labels.X.type === 'Weak Objection W', 'a separate weak-rebuttal tree is offered the switch to Weak Objection', J(labels.X));
        ok(labels.none.add === 'Add Weak Objection Ctrl+Enter' && labels.none.addOff === true && labels.none.typeOff === true && labels.S1.addOff === false && labels.S1.typeOff === false,
            'with nothing selected both are disabled; a selection enables them', J([labels.none, labels.S1]));

        const menu = T(W, `var out = {};
            ['S1', 'BS'].forEach(function (id) {
                __c.load(${J(TREES)}); showContextMenu(10, 10, id, 0);
                var m = document.getElementById('context-menu');
                var items = Array.prototype.slice.call(m.querySelectorAll('.ctx-item'));
                var weak = items.find(function (b) { return /^Weak/.test(b.textContent.trim()); });
                var rowBtns = Array.prototype.slice.call(m.querySelectorAll('.ctx-row button'));
                var weakBtn = rowBtns.find(function (b) { return /^Weak (Obj|Reb)$/.test(b.textContent.trim()); });
                out[id] = {
                    items: items.map(function (b) { return b.textContent.trim(); }),
                    row: rowBtns.map(function (b) { return b.textContent.trim(); }),
                    hollowDot: !!(weak && weak.querySelector('.ctx-dot') && /transparent/.test(weak.querySelector('.ctx-dot').getAttribute('style') || '')),
                    dashedBtn: !!(weakBtn && /border-style:\\s*dashed/.test(weakBtn.getAttribute('style') || ''))
                };
                hideContextMenu();
            });
            return out;`);
        const mi = (k) => (menu[k] || {}).items || [], mr = (k) => (menu[k] || {}).row || [];
        ok(mi('S1').some(t => /^Weak Objection\s*Ctrl\+Enter$/.test(t)) && !mi('S1').some(t => /^Weak Rebuttal/.test(t)),
            'right-click on white S1: Add Child offers "Weak Objection" (Ctrl+Enter)', J(mi('S1')));
        ok(mr('S1').indexOf('Weak Obj') >= 0 && (menu.S1 || {}).hollowDot && (menu.S1 || {}).dashedBtn,
            'with a hollow dot, and a dashed "Weak Obj" Change Type button', J(menu.S1));
        ok(mi('BS').some(t => /^Weak Rebuttal\s*Ctrl\+Enter$/.test(t)) && mr('BS').indexOf('Weak Reb') >= 0,
            'right-click on red BS: "Weak Rebuttal" to add, "Weak Reb" to retype', J(menu.BS));

        W.win.eval(`
            window.__realRect = Element.prototype.getBoundingClientRect;
            Element.prototype.getBoundingClientRect = function () {
                var r = function (l, t, w, h) { return { left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t }; };
                if (this.id === 'canvas') return r(0, 0, 1200, 800);
                if (this.id === 'surface') return r(0, 0, 60000, 60000);
                if (this.classList && (this.classList.contains('node') || this.classList.contains('node-group'))) return r(500, 300, 180, 60);
                return window.__realRect.call(this);
            };
        `);
        const plus = T(W, `var out = {};
            ['S1', 'O1', 'B1', 'R1'].forEach(function (id) {
                __c.load(${J(TREES)}, [id + '-0']); nodeActionExpanded = true; updateNodeActions();
                out[id] = Array.prototype.slice.call(document.querySelectorAll('.node-action-expanded .node-action-btn'))
                    .map(function (b) { return b.className.replace('node-action-btn', '').trim() + ' | ' + b.title; });
                nodeActionExpanded = false; updateNodeActions();
            });
            var clicked;
            __c.load(${J(TREES)}, ['O1-0']); nodeActionExpanded = true; updateNodeActions();
            var g = document.querySelector('.node-action-expanded .node-action-btn.action-weak-rebuttal');
            if (g) { g.click(); __c.blur(); clicked = __c.childOf('O1').type; }
            return { buttons: out, clicked: clicked };`);
        W.win.eval(`Element.prototype.getBoundingClientRect = window.__realRect;`);
        const pb = (plus.buttons || {});
        ok((pb.S1 || []).length === 3 && /^action-weak-objection \| Add Weak Objection \(Ctrl\+Enter\)$/.test((pb.S1 || [])[2] || ''),
            'the node + menu under white S1 offers support, objection and weak objection', J(pb.S1));
        ok(/^action-weak-rebuttal \| Add Weak Rebuttal \(Ctrl\+Enter\)$/.test((pb.O1 || [])[2] || '') && plus.clicked === WR,
            'under red O1 it offers a weak rebuttal, and pressing it adds one', J(plus));
        const css = HTML.slice(0, HTML.indexOf('</style>'));
        ok(/\.node-action-btn\.action-weak-objection\s*\{[^}]*border-style:\s*dashed/.test(css) && /\.node-action-btn\.action-weak-rebuttal\s*\{[^}]*border-style:\s*dashed/.test(css),
            'the weak + buttons have dashed edges');

        // Support buttons wear the color of the argument the support joins.
        const supCls = (k) => (((pb[k] || [])[0] || '').split(' | ')[0]);
        ok(supCls('S1') === 'action-support' && supCls('O1') === 'action-support action-objection' &&
           supCls('R1') === 'action-support action-rebuttal' && supCls('B1') === 'action-support action-objection action-weak-branch',
            'the node + support button: plain under white, red under an objection, orange under a rebuttal, red and dashed in a weak branch',
            J({ S1: supCls('S1'), O1: supCls('O1'), R1: supCls('R1'), B1: supCls('B1') }));
        ok(/\.node-action-btn\.action-weak-branch\s*\{\s*border-style:\s*dashed/.test(css), 'and the dashed edge has its rule');

        const sup = T(W, `var out = {};
            function read(sel) { __c.load(${J(TREES)}, sel);
                var a = document.getElementById('btn-add-sup'), t = document.getElementById('btn-type-sup');
                var v = function (b, name) { return b.style.getPropertyValue(name); };
                return { add: v(a, '--look-edge'), addEdge: v(a, '--look-style'), type: v(t, '--look-edge'), typeEdge: v(t, '--look-style'), tip: a.title }; }
            ['S1', 'O1', 'R1', 'BS', 'BG'].forEach(function (id) { out[id] = read([id + '-0']); });
            out.none = read([]);
            return out;`);
        const red = 'var(--line-objection)', orange = 'var(--line-rebuttal)', white = 'var(--color-line)';
        const s = (k) => sup[k] || {};
        ok(s('S1').add === white && s('S1').type === white && s('none').add === white && s('S1').addEdge === 'solid',
            'Add Support is a plain white-bordered box for the main argument (and with nothing selected)', J([s('S1'), s('none')]));
        ok(s('O1').add === red && s('O1').type === white && /joins an objection, so it is red/.test(s('O1').tip),
            'with an objection selected, Add Support is bordered red; retyping it (its parent is white) stays white', J(s('O1')));
        ok(s('R1').add === orange && s('R1').type === red, 'with a rebuttal selected: orange to add, red to retype (its parent is an objection)', J(s('R1')));
        ok(s('BS').add === red && s('BS').addEdge === 'dashed' && s('BS').type === red && s('BS').typeEdge === 'dashed',
            'inside a weak objection both support buttons are red with a dashed edge', J(s('BS')));
        ok(s('BG').add === orange && s('BG').addEdge === 'dashed' && s('BG').type === red,
            'on a weak rebuttal: orange and dashed to add; red and dashed to retype (its parent is a weak objection)', J(s('BG')));

        const ctxSup = T(W, `var out = {};
            ['O1', 'BS', 'S1'].forEach(function (id) {
                __c.load(${J(TREES)}); showContextMenu(10, 10, id, 0);
                var m = document.getElementById('context-menu');
                var item = Array.prototype.slice.call(m.querySelectorAll('.ctx-item')).find(function (b) { return /^Support/.test(b.textContent.trim()); });
                var supBtn = Array.prototype.slice.call(m.querySelectorAll('.ctx-row button')).find(function (b) { return b.textContent.trim() === 'Sup'; });
                out[id] = { dot: item && item.querySelector('.ctx-dot').getAttribute('style'), sup: supBtn && supBtn.getAttribute('style') };
                hideContextMenu();
            });
            return out;`);
        const cs = (k) => ctxSup[k] || {};
        ok(/#f44336/.test(cs('O1').dot || '') && /border-color:var\(--color-line\)/.test(cs('O1').sup || ''),
            'right-click on an objection: the Support dot is red; "Sup" (in its place, under white) has a white border', J(cs('O1')));
        ok(/#f44336/.test(cs('BS').dot || '') && /border-color:var\(--line-objection\)/.test(cs('BS').sup || '') && /border-style:dashed/.test(cs('BS').sup || ''),
            'inside a weak objection both are red, and "Sup" has the dashed edge', J(cs('BS')));
        ok(/background:var\(--color-line\)/.test(cs('S1').dot || ''), 'under the main argument the Support dot is white, like the box it adds', J(cs('S1')));
    }

    /* ---------------- 8. Color Key and Help ---------------- */
    console.log('\n-- Color Key and Help --');
    {
        const key = T(W, `var g = document.getElementById('group-color-key');
            return { inHelp: !!g.closest('#help-panel'), noButton: !document.getElementById('key-btn'),
                rows: [...g.querySelectorAll('.color-key-row')].map(r => ({text:r.textContent.trim(),dash:r.querySelector('line')?.getAttribute('stroke-dasharray')})),
                help: document.getElementById('help-panel').textContent };`);
        ok(key.inHelp && key.noButton, 'Color Key is in Help without a toolbar button', J(key));
        ok(key.rows.length === 4 && ['Main argument','Objection','Rebuttal','Weak objection or rebuttal'].every((label,i) => key.rows[i].text.startsWith(label)),
            'compact legend labels all four roles');
        ok(key.rows[3].dash === '6 4' && key.rows[3].text.includes('dashed'), 'weak role has a dashed sample');
        ok(key.help.includes('without establishing its opposite'), 'compact Help explains what a weak challenge does');
        ok(key.help.includes('Implicit marks an unstated assumption') && key.help.includes('Given marks a premise taken as given'),
            'compact Help explains premise modifiers');
        ok(key.help.includes('Add weak objection / rebuttal') && key.help.includes('Ctrl+Enter'), 'Help retains the weak-attack creation shortcut');
    }

    /* ---------------- 9. export ---------------- */
    console.log('\n-- export --');
    {
        const svg = T(W, `__c.load(${J(TREES)}); var s = buildExportSVG() || '';
            var t = getExportTheme();
            var count = function (c) { return (s.match(new RegExp('<rect[^>]*stroke="' + c + '" stroke-width', 'g')) || []).length; };
            return { obj: count(t.border.objection), reb: count(t.border.rebuttal), lines: (s.match(/stroke-dasharray="7 5"/g) || []).length,
                     boxes: (s.match(/<rect[^>]*stroke-dasharray="6 4"/g) || []).length };`);
        ok(svg.obj === 8 && svg.reb === 7,
            'export borders by color family: 8 red (O1 GO B1 BS GB BNS RB W1), 7 orange (BR R1 BG GS G1 X XS)', J(svg));
        ok(svg.lines === 11 && svg.boxes === 12, 'and weak branches stay dashed in the exported SVG: 11 connectors, 12 box borders', J(svg));
    }

    /* ---------------- 10. border colors ---------------- */
    console.log('\n-- border colors --');
    {
        const IMP = [N('M', 'contention', [
            Object.assign(N('I', 'support'), { texts: ['plain', 'implicit'], implicits: [false, true] }),
            Object.assign(N('WI', WO), { implicits: [true] })
        ], { x: 30000, y: 30000 })];
        const css = HTML.slice(0, HTML.indexOf('</style>'));
        const look = T(W, `__c.load(${J(IMP)});
            var el = function (id, i) { return document.querySelector('.node[data-node-id="' + id + '"][data-node-idx="' + i + '"]'); };
            return { weak: getComputedStyle(el('WI', 0)).borderTopStyle, imp: getComputedStyle(el('I', 1)).borderTopStyle };`);
        ok(look.imp !== 'dashed' && look.weak === 'dashed',
            'an implicit support is not dashed; an implicit weak objection is, because it is weak', J(look));
        ok(!/dashed !important/.test(css), 'nothing forces a dashed border on implicit premises any more');

        ok(/\.node\s*\{[^}]*border:\s*2px solid var\(--color-line\)/.test(css) &&
           /\.type-support\s*\{\s*border-color:\s*var\(--color-line\)/.test(css) &&
           /\.type-objection\s*\{\s*border-color:\s*var\(--line-objection\)/.test(css) &&
           /\.type-rebuttal\s*\{\s*border-color:\s*var\(--line-rebuttal\)/.test(css) &&
           /\.type-note\s*\{[^}]*border-color:\s*var\(--line-note\)/.test(css),
            'box borders use the connector colors: line white, objection red, rebuttal orange, note yellow');
        const theme = T(W, `var t = getExportTheme(); return t.border;`);
        ok(theme.support === '#ffffff' && theme.contention === '#ffffff' && theme.objection === '#ff6250' && theme.rebuttal === '#ffb780' && theme.note === '#f0e28c',
            'and the dark-theme export borders match the dark-theme lines', J(theme));
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
