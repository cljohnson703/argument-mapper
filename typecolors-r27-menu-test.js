'use strict';
// r27 Co-premise colors, and the context menu's Change Type buttons.
//
// A co-premise joins the selected box's own argument, so every way of adding
// one wears that box's look: the + buttons either side of the box, the
// toolbar's Add Co-Premise, and the dot beside Add Co-Premise in the context
// menu. Red in an objection, orange in a rebuttal, white (the main argument's
// line color) otherwise -- and dashed inside a weak branch. (They were always
// blue before.) The + under a selected box opens a choice of boxes, so it
// wears the selection blue instead. A note stands alone and gets no + at all.
// The toolbar's Add Nodes and Change Type buttons are drawn as the boxes they
// make, as the canvas draws them: background, text color, and border color and
// style -- a note as a note, Implicit see-through with a faded border and a
// mini IMPLICIT tag (its label nearly as bright as the rest), Given tinted.
// Their border is 2.5px, and a disabled one fades far enough, and loses its
// color, to be unmistakable.
// The context menu's Change Type buttons preview the box each would make in
// the canvas's own colors: the node text color, and the border color and
// style that box would have. The box's current type is marked the way the
// canvas marks a selection -- a blue ring -- and in bold.
//
// Covers:
//   (1) the node + buttons: co-premise by the selected box, white on a
//       support, the chooser blue, and what the chooser offers;
//   (2) the toolbar's Add Co-Premise, and every Add Nodes and Change Type
//       button drawn as the box it makes: background, text color, border,
//       and the disabled look;
//   (3) the context menu's Add Co-Premise dot;
//   (4) the Change Type buttons: text, borders, dashes, the current type, and
//       that they still retype.
//
// Run:  node typecolors-r27-menu-test.js [argument-mapper-r27.html]
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
// ├─ S1 support                       white
// │  ├─ O1 objection                  red
// │  │  └─ R1 rebuttal               orange
// │  │     └─ RS support             orange (inside the rebuttal)
// │  └─ B1 weak objection             red, dashed
// │     └─ BS support                 red, dashed
// └─ NT note                          yellow
// FS a separate support, pinned
const TREES = [
    N('M', 'contention', [
        N('S1', 'support', [
            N('O1', 'objection', [ N('R1', 'rebuttal', [ N('RS', 'support') ]) ]),
            N('B1', 'weak-objection', [ N('BS', 'support') ])
        ]),
        N('NT', 'note')
    ], { x: 30000, y: 30000 }),
    N('FS', 'support', [], { x: 500, y: 300, freePosition: true })
];

const HELPERS = `
    window.__t = {
        load(trees, sel) {
            state.trees = JSON.parse(JSON.stringify(trees));
            ensureCollabFields(state);
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            labelMode = 'none';
            selectedIds = sel ? sel.slice() : [];
            render();
        },
        type(id) { return findNodeContext(state.trees, id).node.type; }
    };
`;
const T = (W, body) => {
    try { return JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`)); }
    catch (e) { return { __error: String((e && e.message) || e) }; }
};
const J = JSON.stringify;
const CSS = HTML.slice(0, HTML.indexOf('</style>'));
const IDS = ['S1', 'O1', 'R1', 'RS', 'B1', 'BS', 'NT', 'FS'];

(async () => {
    console.log('=== r27 co-premise colors and the Change Type menu ===');
    const W = makeWin('typecolors');
    await sleep(250);
    W.win.eval(HELPERS);

    /* ---------------- 1. node + buttons ---------------- */
    console.log('\n-- node + buttons --');
    {
        // jsdom has no layout; the buttons only draw for a box inside the view.
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
        const b = T(W, `var out = {};
            ${J(IDS.concat('M'))}.forEach(function (id) {
                __t.load(${J(TREES)}, [id + '-0']); nodeActionExpanded = false; updateNodeActions();
                var bs = Array.prototype.slice.call(document.querySelectorAll('.node-action-btn.action-copremise'));
                out[id] = bs.map(function (el) { return el.dataset.side + ':' + el.className.replace(/node-action-btn|action-copremise/g, '').trim(); });
            });
            return out;`);
        const below = T(W, `var out = {};
            function read(id, expanded) {
                __t.load(${J(TREES)}, [id + '-0']); nodeActionExpanded = expanded; updateNodeActions();
                return Array.prototype.slice.call(document.querySelectorAll('.node-action-btn:not(.action-copremise):not(.action-parent)')).map(function (el) {
                    return { cls: el.className.replace(/node-action-btn/, '').trim(), title: el.title };
                });
            }
            ['S1', 'O1', 'NT', 'M'].forEach(function (id) { out[id] = read(id, false); out[id + '+'] = read(id, true); });
            nodeActionExpanded = false;
            return out;`);
        W.win.eval(`Element.prototype.getBoundingClientRect = window.__realRect;`);
        const both = (id, cls) => J(b[id]) === J(['right:' + cls, 'left:' + cls]);
        ok(both('S1', 'action-support'), 'on a plain support they are white, like the box and its support button', J(b.S1));
        ok(both('FS', 'action-support'), 'on a separate support too', J(b.FS));
        ok(both('O1', 'action-objection'), 'on an objection, red', J(b.O1));
        ok(both('R1', 'action-rebuttal') && both('RS', 'action-rebuttal'), 'on a rebuttal, and a support inside one, orange', J([b.R1, b.RS]));
        ok(both('B1', 'action-objection action-weak-branch') && both('BS', 'action-objection action-weak-branch'),
            'on a weak objection, and a support inside it, red and dashed', J([b.B1, b.BS]));
        ok(Array.isArray(b.NT) && b.NT.length === 0, 'a note has none: it stands alone', J(b.NT));
        ok(Array.isArray(b.M) && b.M.length === 0, 'a main contention still has none', J(b.M));
        ok(!/\.action-copremise\s*\{/.test(CSS) && !/#42a5f5/i.test(CSS) && !/\.node-action-btn\.action-note/.test(CSS),
            'the blue is gone from the stylesheet, and so is the note + color no button uses');
        ok(/\.node-action-btn\.action-support\s*\{\s*border-color:\s*var\(--color-line\);\s*color:\s*var\(--color-line\)/.test(CSS),
            'a support\'s + is drawn in the main argument\'s line color: white, like the box\'s border (dark in the light theme)');

        const one = (k) => (below[k] || []).map(x => x.cls);
        ok(J(one('S1')) === J(['action-chooser']) && J(one('M')) === J(['action-chooser']) && J(one('NT')) === J([]),
            'the + under a selected box is the chooser, on every box but a note', J([one('S1'), one('NT'), one('M')]));
        ok(/\.node-action-btn\.action-chooser\s*\{\s*border-color:\s*var\(--color-selected\);\s*color:\s*var\(--color-selected\)/.test(CSS),
            'the chooser is blue, the selection color, since it offers a choice rather than one box');
        ok(J(one('S1+')) === J(['action-support', 'action-objection', 'action-weak-objection']) && J(one('M+')) === J(['action-support', 'action-objection', 'action-weak-objection']),
            'opened on a support (or the contention): a white support, a red objection, a dashed weak objection', J([one('S1+'), one('M+')]));
        ok(J(one('O1+')) === J(['action-support action-objection', 'action-rebuttal', 'action-weak-rebuttal']),
            'opened on an objection: its support red (the objection wins over white), then the rebuttals', J(one('O1+')));
        ok(J(one('NT+')) === J([]), 'a note never gets the chooser, opened or not: nothing is added to a note', J(below['NT+']));
        const at = (sel) => { const i = CSS.indexOf(sel); return i < 0 ? Infinity : i; };
        ok(at('.node-action-btn.action-support') < at('.node-action-btn.action-objection') && at('.node-action-btn.action-support') < at('.node-action-btn.action-rebuttal'),
            'the white support rule comes first, so a support inside an objection or rebuttal still takes that color');
    }

    /* ---------------- 2. toolbar Add Co-Premise ---------------- */
    console.log('\n-- toolbar: Add Co-Premise --');
    {
        const t = T(W, `var out = {};
            function read(sel) { __t.load(${J(TREES)}, sel);
                var b = document.getElementById('btn-add-co'), v = function (n) { return b.style.getPropertyValue(n); };
                return { bg: v('--look-bg'), text: v('--look-text'), edge: v('--look-edge'), style: v('--look-style'), tip: b.title, off: b.disabled }; }
            ${J(IDS)}.forEach(function (id) { out[id] = read([id + '-0']); });
            out.none = read([]);
            return out;`);
        const red = 'var(--line-objection)', orange = 'var(--line-rebuttal)', white = 'var(--color-line)';
        const g = (k) => t[k] || {};
        const box = (k, edge, style) => g(k).bg === 'var(--node-bg)' && g(k).text === 'var(--text-color)' && g(k).edge === edge && g(k).style === style;
        ok(box('S1', white, 'solid') && /It joins the main argument/.test(g('S1').tip) && box('none', white, 'solid'),
            'drawn as a plain box for the main argument, and with nothing selected', J([g('S1'), g('none')]));
        ok(box('O1', red, 'solid') && /It joins an objection, so it is red/.test(g('O1').tip),
            'red-bordered with an objection selected, and the tooltip says why', J(g('O1')));
        ok(box('R1', orange, 'solid') && box('RS', orange, 'solid'), 'orange for a rebuttal and a support inside it', J([g('R1'), g('RS')]));
        ok(box('B1', red, 'dashed') && box('BS', red, 'dashed') && /weak objection/.test(g('BS').tip),
            'red and dashed inside a weak objection', J([g('B1'), g('BS')]));
        ok(g('NT').bg === 'var(--note-bg)' && g('NT').text === 'var(--note-text)' && g('NT').edge === 'var(--line-note)' && /a note, like the box/.test(g('NT').tip),
            "a note's own colors for a note", J(g('NT')));
        ok(box('FS', white, 'solid') && /Tab adds it on the right, Shift\+Tab on the left/.test(g('FS').tip),
            'a plain box for a separate support', J(g('FS')));
    }

    /* ---------------- 2b. Add Nodes and Change Type draw their boxes ---------------- */
    console.log('\n-- toolbar: buttons drawn as boxes --');
    {
        const BODY = HTML.slice(HTML.indexOf('<body'));
        const ids = ['new-node-btn', 'btn-add-sup', 'btn-add-co', 'btn-add-obj', 'btn-add-weak', 'btn-add-not',
                     'btn-type-sup', 'btn-type-obj', 'btn-type-weak', 'btn-type-note', 'btn-implicit', 'btn-given', 'btn-main'];
        const cls = T(W, `return { look: ${J(ids)}.map(function (id) { var b = document.getElementById(id); return b ? b.classList.contains('node-look') : null; }),
            placement: document.getElementById('placement-btn').classList.contains('node-look') };`);
        ok(Array.isArray(cls.look) && cls.look.every(Boolean) && cls.placement === false,
            'every Add Nodes and Change Type button that makes or marks a box is drawn as one; Placement is not', J(cls));
        ok(/body\.bg-light #toolbar \.toolbar-group button\.node-look:hover\s*\{\s*background:\s*var\(--look-bg, var\(--node-bg\)\);\s*color:\s*var\(--look-text, var\(--text-color\)\);\s*border:\s*2\.5px var\(--look-style, solid\) var\(--look-edge, var\(--color-line\)\)/.test(CSS),
            'the look: the box background, the node text color and a 2.5px canvas-colored border, in both themes and on hover');
        ok(/#toolbar \.toolbar-group button\.node-look\s*\{\s*padding:\s*4\.5px 10\.5px/.test(CSS), 'the thicker border is paid for with 1.5px less padding, so buttons keep their size');
        ok(/#btn-add-not, #btn-type-note\s*\{\s*--look-bg:\s*var\(--note-bg\);\s*--look-text:\s*var\(--note-text\);\s*--look-edge:\s*var\(--line-note\)/.test(CSS),
            'Add Note and Note are drawn as notes');
        ok(!/#new-node-btn\s*\{/.test(CSS) && !/neutral/.test(CSS),
            'New Node has no look of its own: it makes a plain support, the default look, and the untyped gray is gone');
        ok(/#btn-implicit\s*\{\s*--look-bg:\s*transparent;\s*--look-text:\s*var\(--implicit-button-text\);\s*--look-edge:\s*var\(--line-faded\);\s*position:\s*relative/.test(CSS) &&
           /#btn-given\s*\{\s*--look-bg:\s*var\(--color-given-bg\)/.test(CSS) && !/--btn-given-bg/.test(HTML),
            'Implicit is see-through with a faded border; Given wears the canvas tint');
        const tag = CSS.match(/#btn-implicit::after\s*\{([^}]*)\}/);
        ok(!!tag && /content:\s*'Implicit'/.test(tag[1]) && /text-transform:\s*uppercase/.test(tag[1]) && /top:\s*0/.test(tag[1]) &&
           /border:\s*1px solid var\(--implicit-tag-border\)/.test(tag[1]) && /color:\s*var\(--implicit-tag-text\)/.test(tag[1]) &&
           /background:\s*var\(--panel-bg/.test(tag[1]) && /body\.bg-light #btn-implicit::after\s*\{\s*background:\s*#f0f0f0/.test(CSS),
            'Implicit wears a mini IMPLICIT tag across its top border, in the canvas tag\'s colors, masking the border with the toolbar\'s background', tag ? tag[1] : 'no rule');
        const hex = (s) => parseInt(s.slice(1, 3), 16);
        const darkBtn = (CSS.match(/:root \{[\s\S]*?--implicit-button-text:\s*(#[0-9a-f]{6})/i) || [])[1];
        const darkFaint = (CSS.match(/:root \{[\s\S]*?--implicit-text:\s*(#[0-9a-f]{6})/i) || [])[1];
        const lightBtn = (CSS.match(/body\.nodes-light \{[^}]*--implicit-button-text:\s*(#[0-9a-f]{6})/i) || [])[1];
        ok(!!darkBtn && !!darkFaint && hex(darkBtn) >= 0xe0 && hex(darkBtn) > hex(darkFaint) && !!lightBtn && hex(lightBtn) <= 0x33,
            'its label is only a shade off the other labels (' + darkBtn + ' dark, ' + lightBtn + ' light), brighter than an implicit box\'s faint text (' + darkFaint + ')');
        ok(BODY.indexOf('style="color:#ff7563') < 0 && BODY.indexOf('accent-note-border);"') < 0, 'the old colored-text inline styles are gone');

        const dis = CSS.match(/#toolbar \.toolbar-group button\.node-look:disabled\s*\{([^}]*)\}/);
        const baseDis = CSS.match(/\n\s*button:disabled\s*\{\s*opacity:\s*([\d.]+)/);
        const op = dis && dis[1].match(/opacity:\s*([\d.]+)/);
        ok(dis && op && baseDis && parseFloat(op[1]) <= 0.3 && parseFloat(op[1]) < parseFloat(baseDis[1]) / 1.5 && /filter:\s*saturate\(0\.2\)/.test(dis[1]),
            'a disabled box button fades much further than other buttons (' + (op && op[1]) + ' against ' + (baseDis && baseDis[1]) + ') and loses its color',
            dis ? dis[1] : 'no rule');
        ok(/#toolbar \.toolbar-group button\.node-look:hover:not\(:disabled\)\s*\{\s*filter:\s*brightness/.test(CSS) && !/button\.node-look:hover\s*\{\s*filter/.test(CSS),
            'hover brightens only a button that is available, so a disabled one never lights up');
        const imp = T(W, `var out = {};
            __t.load(${J(TREES)}, ['S1-0']); out.support = document.getElementById('btn-implicit').disabled;
            __t.load(${J(TREES)}, ['M-0']); out.main = document.getElementById('btn-implicit').disabled;
            __t.load(${J(TREES)}, ['NT-0']); out.note = document.getElementById('btn-implicit').disabled;
            __t.load(${J(TREES)}, []); out.none = document.getElementById('btn-implicit').disabled;
            return out;`);
        ok(imp.support === false && imp.main === true && imp.note === true && imp.none === true,
            'Implicit is available on a premise and disabled on the contention, a note, or nothing', J(imp));

        const sel = T(W, `var out = {};
            function read(id) { __t.load(${J(TREES)}, [id + '-0']);
                var v = function (b, n) { return document.getElementById(b).style.getPropertyValue(n); };
                return { obj: v('btn-add-obj', '--look-edge'), weak: [v('btn-add-weak', '--look-edge'), v('btn-add-weak', '--look-style')],
                         retype: v('btn-type-obj', '--look-edge'), sup: [v('btn-type-sup', '--look-edge'), v('btn-type-sup', '--look-style')],
                         implicit: [v('btn-implicit', '--look-edge'), v('btn-implicit', '--look-style')], given: [v('btn-given', '--look-edge'), v('btn-given', '--look-style')] }; }
            ['S1', 'O1', 'BS'].forEach(function (id) { out[id] = read(id); });
            return out;`);
        const s = (k) => sel[k] || {};
        ok(s('S1').obj === 'var(--line-objection)' && s('O1').obj === 'var(--line-rebuttal)' && s('O1').retype === 'var(--line-objection)' &&
           J(s('BS').weak) === J(['var(--line-rebuttal)', 'dashed']),
            'the attack buttons take the color of the attack they would make, dashed when weak', J(sel));
        ok(J(s('BS').sup) === J(['var(--line-objection)', 'dashed']), "Support in a weak objection's place is red and dashed", J(s('BS').sup));
        ok(J(s('S1').implicit) === J(['var(--line-faded)', 'solid']) && J(s('O1').implicit) === J(['var(--line-objection-faded)', 'solid']) &&
           J(s('BS').implicit) === J(['var(--line-objection-faded)', 'dashed']),
            'Implicit previews the selected box made implicit: its border faded, dashed when weak', J([s('S1').implicit, s('O1').implicit, s('BS').implicit]));
        ok(J(s('O1').given) === J(['var(--line-objection)', 'solid']) && J(s('BS').given) === J(['var(--line-objection)', 'dashed']),
            'Given previews the selected box tinted, in its own border', J([s('O1').given, s('BS').given]));
    }

    /* ---------------- 3. context menu dot ---------------- */
    console.log('\n-- context menu: Add Co-Premise --');
    {
        const m = T(W, `var out = {};
            ${J(IDS)}.forEach(function (id) {
                __t.load(${J(TREES)}); showContextMenu(10, 10, id, 0);
                var item = Array.prototype.slice.call(document.querySelectorAll('#context-menu .ctx-item')).find(function (b) { return /^Right co-premise/.test(b.textContent.trim()); });
                var dot = item && item.querySelector('.ctx-dot');
                out[id] = dot ? dot.getAttribute('style') : null;
                out[id + ':off'] = item ? item.disabled : null;
                hideContextMenu();
            });
            return out;`);
        ok(/var\(--color-line\)/.test(m.S1 || '') && /var\(--color-line\)/.test(m.FS || '') && /#f44336/.test(m.O1 || '') && /#ff9800/.test(m.R1 || '') && /#ff9800/.test(m.RS || ''),
            'its dot is white on a plain support, red on an objection, orange in a rebuttal', J(m));
        ok(/#f44336/.test(m.B1 || '') && /#f44336/.test(m.BS || '') && m['NT:off'] === true && m['S1:off'] === false,
            'red in a weak objection; on a note it is grayed out, since a note stands alone', J(m));
    }

    /* ---------------- 4. Change Type buttons ---------------- */
    console.log('\n-- context menu: Change Type --');
    {
        const c = T(W, `var out = {};
            ['S1', 'O1', 'R1', 'BS', 'NT', 'FS', 'M'].forEach(function (id) {
                __t.load(${J(TREES)}); showContextMenu(10, 10, id, 0);
                var row = document.querySelector('#context-menu .ctx-row.ctx-types');
                out[id] = row ? Array.prototype.slice.call(row.querySelectorAll('button')).map(function (b) {
                    return { label: b.textContent.trim(), cls: b.className, style: b.getAttribute('style'), pressed: b.getAttribute('aria-pressed') };
                }) : null;
                hideContextMenu();
            });
            return out;`);
        const btn = (id, label) => ((c[id] || []).find(x => x.label === label) || {});
        const cur = (id) => (c[id] || []).filter(x => /\bctx-current\b/.test(x.cls)).map(x => x.label);
        ok(J((c.R1 || []).map(x => x.label)) === J(['Sup', 'Reb', 'Weak Reb', 'Note', 'Main']) && (c.R1 || []).every(x => /\bctx-type\b/.test(x.cls)),
            'the row still reads Sup, Reb, Weak Reb, Note, Main (on a rebuttal)', J(c.R1));
        ok((c.R1 || []).filter(x => x.label !== 'Note').every(x => /^color:var\(--text-color\);/.test(x.style || '')) && /^color:var\(--note-text\);/.test(btn('R1', 'Note').style || ''),
            'their text is the canvas\'s node text color (a note\'s own for Note)', J(c.R1));
        ok(/border-color:var\(--line-objection\);/.test(btn('R1', 'Sup').style || '') && /border-color:var\(--line-rebuttal\);/.test(btn('R1', 'Reb').style || '') &&
           /border-color:var\(--line-rebuttal\); border-style:dashed;/.test(btn('R1', 'Weak Reb').style || '') &&
           /border-color:var\(--line-note\);/.test(btn('R1', 'Note').style || '') && /border-color:var\(--color-line\);/.test(btn('R1', 'Main').style || '') &&
           /\bctx-main\b/.test(btn('R1', 'Main').cls || ''),
            'their borders are the canvas borders of the box each would make: a support in R1\'s place is red (it joins O1), Reb orange, Weak Reb orange and dashed, Note yellow, Main white with its ring',
            J(c.R1));
        ok(!/dashed/.test(btn('R1', 'Sup').style || '') && !/dashed/.test(btn('R1', 'Reb').style || ''), 'only weak ones are dashed', J(c.R1));
        ok(J(cur('R1')) === J(['Reb']) && btn('R1', 'Reb').pressed === 'true' && btn('R1', 'Sup').pressed === null,
            'on a rebuttal only Reb is marked current', J(cur('R1')));
        ok(J(cur('S1')) === J(['Sup']) && J(cur('O1')) === J(['Obj']) && J(cur('NT')) === J(['Note']) && J(cur('M')) === J(['Main']) && J(cur('FS')) === J(['Sup']),
            'and on a support, an objection, a note, the contention and a separate support their own', J({ S1: cur('S1'), O1: cur('O1'), NT: cur('NT'), M: cur('M'), FS: cur('FS') }));
        ok(J(cur('BS')) === J(['Sup']) && /border-color:var\(--line-objection\); border-style:dashed;/.test(btn('BS', 'Sup').style || ''),
            'a support inside a weak objection: Sup is current, red and dashed', J(c.BS));

        ok(/#context-menu \.ctx-row button\.ctx-type\.ctx-current\s*\{\s*font-weight:\s*700;\s*box-shadow:\s*0 0 0 1px #2a2a2e, 0 0 0 3px var\(--color-selected\)/.test(CSS) &&
           /body\.bg-light #context-menu \.ctx-row button\.ctx-type\.ctx-current\s*\{\s*box-shadow:\s*0 0 0 1px #f5f5f5, 0 0 0 3px var\(--color-selected\)/.test(CSS),
            'the current type wears the blue selection ring, just outside a gap in the menu color, and bold');
        ok(/#context-menu \.ctx-row button\.ctx-type\s*\{[^}]*border-width:\s*2\.5px/.test(CSS) && /#context-menu \.ctx-row button\.ctx-main\s*\{\s*outline:\s*1px solid var\(--color-contention-ring\)/.test(CSS),
            'the context-menu buttons match the toolbar’s 2.5px border, and Main the contention ring\'s color');
        ok(/#context-menu \.ctx-row button\.ctx-type\s*\{[^}]*white-space:\s*nowrap/.test(CSS), '"Weak Obj" and "Weak Reb" stay on one line');

        const click = T(W, `__t.load(${J(TREES)}); showContextMenu(10, 10, 'RS', 0);
            var note = Array.prototype.slice.call(document.querySelectorAll('#context-menu .ctx-types button')).find(function (b) { return b.textContent.trim() === 'Note'; });
            note.click();
            return { type: __t.type('RS'), open: document.getElementById('context-menu').classList.contains('open') };`);
        ok(click.type === 'note' && click.open === false, 'pressing one still retypes the box (Note on the leaf RS) and closes the menu', J(click));
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
