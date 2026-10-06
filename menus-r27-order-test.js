'use strict';
// r27.81 (the user, 2026-10-05): "If 'Open Reference Arguments' is the same
// thing as clicking the badge, we should probably put it below 'Add
// Cross-Reference'. We can also get rid of all the ellipses on the context
// menu, as those don't seem to serve any purpose. If none of the left panel
// ellipses are abbreviating anything, we can remove those, too. And maybe move
// the B, I, and U right below the Status group of the context menu. Beyond
// these, organize the context menu in whatever way you think makes the most
// sense."
//
// (1) A box's menu, in order: Edit Text; Add Premise; Change Type; Status,
//     with Evaluation Notes; Text -- B, I, U, then Left, Center, Right, then
//     Link a Premise and Link to Web Address; Add Cross-Reference, then
//     Reference Arguments; the deductive check; editing; stacking.
// (2) Reference Arguments opens what the box's ↗ badge opens.
// (3) No ellipsis in any menu: a box's, the canvas's, an open box's, a web
//     link's, the references panel's (its +, an argument's, a premise's).
// (4) None on the left panel's buttons either (Save As, Open, Recent, Import
//     Text: none abbreviated anything), and Help names them as they are.
//
// Run:  node menus-r27-order-test.js [argument-mapper-r27.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || (__dirname + '/argument-mapper-r27.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const J = JSON.stringify;

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
        win.indexedDB = { open() { const r = {}; setTimeout(() => r.onerror && r.onerror({ target: { error: new Error('x') } }), 0); return r; }, deleteDatabase() { const r = {}; setTimeout(() => r.onsuccess && r.onsuccess({}), 0); return r; } };
        win.requestAnimationFrame = cb => win.setTimeout(() => cb(Date.now()), 0);
        win.cancelAnimationFrame = win.clearTimeout;
        win.scrollTo = () => {}; win.confirm = () => true; win.prompt = () => null; win.open = () => null; win.alert = () => {};
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}

// The main box M; under it S, two premises; elsewhere E with one box, linked
// from S's first box and grouped with S's second into an argument for M.
const MAP = [
    { id: 'M', type: 'contention', texts: ['The dog barked'], collapsed: [], x: 30000, y: 30000, children: [
        { id: 'S', type: 'support', texts: ['If the alarm went off, then the dog barked', 'The alarm went off, see [the source](https://example.org)'], collapsed: [], children: [] }],
      crossRefs: [[{ targetId: 'E', targetIdx: 0 }, { argumentId: 'g1', kind: 'support', childIds: [], premises: [{ targetId: 'E', targetIdx: 0 }, { targetId: 'S', targetIdx: 0 }] }]] },
    { id: 'E', type: 'contention', texts: ['The alarm went off'], collapsed: [], x: 31000, y: 30000, children: [] }
];

(async () => {
    console.log('=== r27.81 menus: a box\'s menu in order, no ellipses anywhere, the left panel\'s buttons ===');
    const W = makeWin('menus');
    await sleep(300);
    const run = js => W.win.eval(js);
    const val = js => JSON.parse(run('JSON.stringify(' + js + ')'));
    run(`window.__load = function () { state.trees = ${J(MAP)}; ensureCollabFields(state); richTextEnabled = true; selectedIds = []; render(); };
        // A menu as a list: '|' a divider, '#Label' a heading, '[a b c]' a row of buttons, else an item's words (its key left out).
        window.__seq = function (menu) {
            return Array.from(menu.children).map(el => {
                if (el.classList.contains('ctx-divider')) return '|';
                if (el.classList.contains('ctx-label')) return '#' + el.textContent.trim();
                if (el.classList.contains('ctx-row')) return '[' + Array.from(el.querySelectorAll('button')).map(b => b.textContent.trim()).join(' ') + ']';
                const c = el.cloneNode(true); c.querySelectorAll('.ctx-key').forEach(k => k.remove()); return c.textContent.trim();
            });
        };
        window.__boxMenu = function (id, idx) { __load(); hideContextMenu(); showContextMenu(20, 20, id, idx); return __seq(document.getElementById('context-menu')); };`);
    const DOTS = /…|\.\.\./;

    console.log('\n-- (1) a box\'s menu, in order --');
    {
        const seq = val(`__boxMenu('S', 1)`);
        const at = x => seq.indexOf(x);
        ok(seq[0] === 'Edit Text' && seq[1] === '|' && seq[2] === '#Add Premise' && at('#Add Premise') < at('#Change Type') && at('#Change Type') < at('#Status'),
            'Edit Text first; then Add Premise, Change Type and Status, as before', J(seq.slice(0, 4)));
        const tail = seq.slice(at('#Status'));
        ok(J(tail) === J(['#Status', '[Eval: none Implicit Given]', 'Evaluation Notes', '|',
            '#Text', '[B I U]', '[Left Center Right]', 'Link a Premise', 'Link to Web Address', '|',
            'Add Cross-Reference', 'Reference Arguments', '|',
            'Check This Step', 'Deductive Check: All Steps', '|',
            'Take Out of Branch', 'Cut', 'Copy', 'Delete', 'Paste as Child', 'Paste as Co-Premise', '|',
            '[↑ Forward ↓ Backward]']),
            'then Status with its notes; Text: B, I, U right below it, alignment, links; references, Reference Arguments below Add Cross-Reference; the check; editing; stacking', J(tail));
        const m = val(`(function () { __boxMenu('M', 0); const menu = document.getElementById('context-menu');
            return { derive: __seq(menu).includes('Derive Parent') || __seq(menu).includes('Check This Step'), refs: __seq(menu).filter(x => /Cross-Reference|Reference Arguments/.test(x)),
                align: !!menu.querySelector('.ctx-row.ctx-align'), bold: !!menu.querySelector('.ctx-row.ctx-format .fmt-strong') }; })()`);
        ok(J(m.refs) === J(['Add Cross-Reference', 'Reference Arguments']) && m.align && m.bold, 'the main box\'s menu the same way', J(m));
    }

    console.log('\n-- (2) Reference Arguments and the badge --');
    {
        const r = val(`(function () {
            __boxMenu('M', 0);
            const item = Array.from(document.querySelectorAll('#context-menu .ctx-item')).find(b => b.textContent.trim() === 'Reference Arguments');
            item.click();
            const fromMenu = document.querySelector('.reference-arguments-popover');
            const a = fromMenu && { id: fromMenu.dataset.sourceId, idx: fromMenu.dataset.sourceIdx, cards: fromMenu.querySelectorAll('.reference-argument-card').length };
            document.querySelectorAll('.crossref-popover').forEach(p => p.remove());
            const badge = document.querySelector('.node[data-node-id="M"][data-node-idx="0"] .crossref-badge');
            badge && badge.click();
            const fromBadge = document.querySelector('.reference-arguments-popover');
            const b = fromBadge && { id: fromBadge.dataset.sourceId, idx: fromBadge.dataset.sourceIdx, cards: fromBadge.querySelectorAll('.reference-argument-card').length };
            return { a, b, title: item.title }; })()`);
        ok(r.a && r.b && J(r.a) === J(r.b) && r.a.id === 'M' && r.a.cards === 1, 'Reference Arguments opens what the box\'s ↗ badge opens', J(r));
        ok(/its ↗ badge opens the same/.test(r.title), 'and its tip says so', r.title);
        // The click that opened it reached the document and closed it at once
        // (before r27.81); a later click outside still closes it.
        const c = val(`(function () {
            document.querySelectorAll('.crossref-popover').forEach(p => p.remove());
            __boxMenu('M', 0);
            Array.from(document.querySelectorAll('#context-menu .ctx-item')).find(b => b.textContent.trim() === 'Reference Arguments').click();
            const stays = !!document.querySelector('.reference-arguments-popover');
            document.getElementById('surface').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            const closes = !document.querySelector('.reference-arguments-popover');
            deductiveLive = false; toggleDeductiveLive(); openDeductiveCheck();
            const row = document.querySelector('#logic-modal-body .logic-step[data-step^="reference:M:0:"]');
            row && row.click();
            const fromList = !!document.querySelector('.reference-arguments-popover');
            document.querySelectorAll('.crossref-popover').forEach(p => p.remove()); toggleDeductiveLive();
            return { stays, closes, row: !!row, fromList }; })()`);
        ok(c.stays && c.closes, 'opened from the menu, the panel stays open (the opening click no longer closes it); a click elsewhere closes it', J(c));
        ok(c.row && c.fromList, 'and a grouped argument\'s step in the Deductive Check list opens it too', J(c));
    }

    console.log('\n-- (3) no ellipsis in any menu --');
    {
        const menus = val(`(function () {
            const out = {};
            __boxMenu('S', 1); out.box = document.getElementById('context-menu').textContent;
            hideContextMenu(); showContextMenu(400, 400); out.canvas = document.getElementById('context-menu').textContent; hideContextMenu();
            __load();
            const host = document.querySelector('.node[data-node-id="S"][data-node-idx="0"]'); enterEditMode(host);
            const ed = host.querySelector('.box-editor');
            ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
            const lm = document.getElementById('link-menu'); out.editing = lm ? Array.from(lm.querySelectorAll('button')).map(b => b.textContent).join(' | ') : null;
            document.querySelectorAll('#link-menu').forEach(m => m.remove()); ed.blur();
            const a = document.querySelector('.node[data-node-id="S"][data-node-idx="1"] .rendered-text a');
            a && a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
            const wl = document.getElementById('link-menu'); out.weblink = wl ? Array.from(wl.querySelectorAll('button')).map(b => b.textContent).join(' | ') : null;
            document.querySelectorAll('#link-menu').forEach(m => m.remove());
            openReferenceArguments('M', 0);
            const pop = document.querySelector('.reference-arguments-popover');
            const menuOf = el => { el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
                const m = pop.querySelector('.reference-context-menu'); const t = m ? Array.from(m.querySelectorAll('button')).map(b => b.textContent).join(' | ') : null; return t; };
            out.argument = menuOf(pop.querySelector('.reference-argument-card'));
            out.premise = menuOf(pop.querySelector('.crossref-popover-row'));
            const plus = Array.from(pop.querySelectorAll('.reference-argument-heading button')).find(b => b.textContent === '+');
            plus.click(); const pm = pop.querySelector('.reference-context-menu'); out.plus = pm ? Array.from(pm.querySelectorAll('button')).map(b => b.textContent).join(' | ') : null;
            pop.remove();
            return out; })()`);
        const named = { box: 'a box\'s', canvas: 'the canvas\'s', editing: 'an open box\'s', weblink: 'a web link\'s', argument: 'an argument\'s (references panel)', premise: 'a premise\'s (references panel)', plus: 'the references panel\'s +' };
        Object.keys(named).forEach(k => ok(typeof menus[k] === 'string' && menus[k].length > 0 && !DOTS.test(menus[k]), 'no ellipsis in ' + named[k] + ' menu', menus[k]));
        ok(/Link a premise/.test(menus.editing) && /Link selection/.test(menus.editing) && /Edit URL/.test(menus.weblink) && /Argument type/.test(menus.argument) && /Add reference/.test(menus.plus),
            'the items themselves are all still there', J(menus));
    }

    console.log('\n-- (4) the left panel, and Help --');
    {
        const p = val(`(function () {
            const all = Array.from(document.querySelectorAll('#toolbar button, #extra-toolbar button, #toolbar .file-upload-label, #extra-toolbar .file-upload-label'));
            const words = el => { const c = el.cloneNode(true); c.querySelectorAll('.hotkey, input').forEach(k => k.remove()); return c.textContent.replace(/\\s+/g, ' ').trim(); };
            return { dotted: all.map(words).filter(t => /…|\\.\\.\\./.test(t)),
                saveAs: words(document.getElementById('save-as-btn')), open: words(document.getElementById('open-file-btn')),
                recent: words(Array.from(document.querySelectorAll('#group-file button')).find(b => /toggleRecentMaps/.test(b.getAttribute('onclick') || ''))),
                importText: words(document.querySelector('#extra-toolbar .file-upload-label')),
                help: (document.getElementById('help-modal-backdrop') || document.body).textContent }; })()`);
        ok(p.dotted.length === 0, 'no button on the left panel (or under Advanced) ends in an ellipsis', J(p.dotted));
        ok(p.saveAs === 'Save As' && p.open === 'Open' && p.recent === 'Recent' && p.importText === 'Import Text', 'Save As, Open, Recent, Import Text', J([p.saveAs, p.open, p.recent, p.importText]));
        ok(/choose Add Cross-Reference from a box's menu/.test(p.help) && /Reference Arguments \(or the box's ↗ badge\) groups such premises into arguments/.test(p.help) &&
            /choose Link a premise from the right-click menu/.test(p.help) && /Save As saves a copy/.test(p.help) && !/(Cross-Reference|Link a premise|Save As)…/.test(p.help),
            'Help names them as they are, and says what Reference Arguments does');
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    W.dom.window.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
