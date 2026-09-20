'use strict';
// r27 shortcuts: Ctrl+S saves like Word; presentation mode can collapse.
//
//   (1) Ctrl+S is Save: straight to the linked file, asking where to put it
//       only the first time (saveMap). Ctrl+Shift+S is Save As (saveMapAs).
//       Ctrl+S used to save to browser storage only -- even though the save
//       indicator's tooltip already said "Ctrl+S writes straight to it".
//       It is a capture-phase listener, so it also works from inside inputs
//       that stop keydown propagation (comment composers, the map name),
//       where the browser's own "Save page as" used to open. It works while
//       typing and in presentation mode; it ignores AltGr, key auto-repeat
//       and a second press while a save is still open. Shift+S is back to
//       plain S (retype to Support), and "Save now" keeps its button.
//   (2) Presentation mode switched pointer events off for everything inside a
//       node group, collapse/expand buttons included (and present + focus
//       mode disabled those buttons explicitly). They are re-enabled; the
//       click path must work in presentation mode. jsdom has no hit testing,
//       so the stylesheet contract is asserted here and the real
//       elementFromPoint check lives in the browser verification.
//
// Run:  node shortcut-r27-save-present-test.js [argument-mapper-r27.html]
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

// The three save functions are replaced by counters: the real ones open a
// file picker, download, or write storage, none of which is the subject here.
// saveMap can be held "open" to test a second press mid-save.
const HELPERS = `
    window.__s = {
        saves: 0, saveAs: 0, local: 0, hold: null,
        load() {
            state.trees = [{ id: 'r', type: 'contention', texts: ['Main'], collapsed: [], children: [
                { id: 'o', type: 'objection', texts: ['An objection'], collapsed: [], children: [
                    { id: 'k', type: 'rebuttal', texts: ['A rebuttal'], collapsed: [], children: [] }
                ] }
            ] }];
            ensureCollabFields(state);
            if (presentMode) togglePresentMode();
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            render();
            selectedIds = ['o-0']; updateSelectionVisuals();
            this.saves = 0; this.saveAs = 0; this.local = 0; this.hold = null;
        },
        key(code, key, opts, target) {
            const ev = new KeyboardEvent('keydown', Object.assign(
                { code: code, key: key, bubbles: true, cancelable: true }, opts || {}));
            (target || document).dispatchEvent(ev);
            return ev.defaultPrevented;
        },
        type(id) { return findNodeContext(state.trees, id).node.type; }
    };
    window.saveMap = function () {
        window.__s.saves++;
        if (window.__s.hold) return window.__s.hold;
        return Promise.resolve();
    };
    window.saveMapAs = function () { window.__s.saveAs++; return Promise.resolve(); };
    window.manualLocalSave = function () { window.__s.local++; };
`;
const T = (W, body) => JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`));

(async () => {
    console.log('=== r27 Ctrl+S save, and collapse in presentation mode ===');
    const W = makeWin('shortcut-save-present');
    await sleep(250);
    W.win.eval(HELPERS);

    console.log('\n-- Ctrl+S --');
    {
        // Separate key presses are separate tasks in a browser, so a save's
        // promise settles -- and the in-flight guard clears -- between them.
        // TT lets the page settle after each press to model that.
        const TT = async (body) => { const r = T(W, body); await sleep(10); return r; };
        const ctrlS = await TT(`__s.load(); const prevented = __s.key('KeyS', 's', { ctrlKey: true });
            return { saves: __s.saves, saveAs: __s.saveAs, local: __s.local, prevented: prevented, type: __s.type('o') };`);
        ok(ctrlS.saves === 1 && ctrlS.saveAs === 0 && ctrlS.local === 0,
            'Ctrl+S is Save to File (linked file, or the picker the first time) -- not the browser-only save', JSON.stringify(ctrlS));
        ok(ctrlS.prevented, "and it stops the browser's own Save page dialog", JSON.stringify(ctrlS));
        ok(ctrlS.type === 'objection', 'without touching the selected box', JSON.stringify(ctrlS));

        const ctrlShiftS = await TT(`__s.load(); __s.key('KeyS', 'S', { ctrlKey: true, shiftKey: true });
            return { saves: __s.saves, saveAs: __s.saveAs };`);
        ok(ctrlShiftS.saveAs === 1 && ctrlShiftS.saves === 0, 'Ctrl+Shift+S is Save As', JSON.stringify(ctrlShiftS));

        const cmd = await TT(`__s.load(); __s.key('KeyS', 's', { metaKey: true }); return { saves: __s.saves };`);
        ok(cmd.saves === 1, 'Cmd+S saves on a Mac', JSON.stringify(cmd));

        const shiftS = await TT(`__s.load(); __s.key('KeyS', 'S', { shiftKey: true }); return { saves: __s.saves, saveAs: __s.saveAs, type: __s.type('o') };`);
        ok(shiftS.saves === 0 && shiftS.saveAs === 0 && shiftS.type === 'support',
            'Shift+S no longer saves; it is plain S again (retype to Support)', JSON.stringify(shiftS));

        const altGr = await TT(`__s.load(); __s.key('KeyS', 's', { ctrlKey: true, altKey: true }); return { saves: __s.saves };`);
        ok(altGr.saves === 0, 'AltGr+S (Ctrl+Alt on Windows) is left alone for typing', JSON.stringify(altGr));

        const typing = await TT(`__s.load(); editNodeText('o', 0);
            const ta = document.activeElement;
            const editing = ta && ta.tagName === 'TEXTAREA' && !ta.readOnly;
            __s.key('KeyS', 's', { ctrlKey: true }, ta);
            return { editing: editing, saves: __s.saves, stillEditing: document.activeElement === ta };`);
        ok(typing.editing && typing.saves === 1 && typing.stillEditing,
            'Ctrl+S saves while typing in a box, and the box stays open', JSON.stringify(typing));

        const composer = await TT(`__s.load(); openEvalNotesForBox('o', 0);
            const c = document.querySelector('.eval-thread-popover .eval-composer');
            const prevented = __s.key('KeyS', 's', { ctrlKey: true }, c);
            return { found: !!c, saves: __s.saves, prevented: prevented };`);
        ok(composer.found && composer.saves === 1 && composer.prevented,
            'Ctrl+S saves from inside a comment box, which swallows key presses', JSON.stringify(composer));

        const mapName = await TT(`__s.load(); const m = document.getElementById('map-name'); m.focus();
            const prevented = __s.key('KeyS', 's', { ctrlKey: true }, m);
            return { saves: __s.saves, prevented: prevented };`);
        ok(mapName.saves === 1 && mapName.prevented, 'and from the map-name field', JSON.stringify(mapName));

        // Press, let it settle, THEN send auto-repeats: the guard has cleared by
        // then, so only the repeat check can stop them.
        await TT(`__s.load(); __s.key('KeyS', 's', { ctrlKey: true }); return 1;`);
        const repeat = await TT(`__s.key('KeyS', 's', { ctrlKey: true, repeat: true });
            __s.key('KeyS', 's', { ctrlKey: true, repeat: true });
            return { saves: __s.saves };`);
        ok(repeat.saves === 1, 'holding Ctrl+S down saves once, not once per auto-repeat', JSON.stringify(repeat));
        const fresh = await TT(`__s.key('KeyS', 's', { ctrlKey: true }); return { saves: __s.saves };`);
        ok(fresh.saves === 2, '(the next real press still saves, so it was the repeat check)', JSON.stringify(fresh));

        W.win.eval(`__s.load(); var __release; __s.hold = new Promise(function (r) { __release = r; });`);
        const first = T(W, `__s.key('KeyS', 's', { ctrlKey: true }); __s.key('KeyS', 's', { ctrlKey: true }); return { saves: __s.saves };`);
        ok(first.saves === 1, 'a second Ctrl+S while the first save is still open is ignored', JSON.stringify(first));
        W.win.eval(`__release(); __s.hold = null;`);
        await sleep(20);
        const after = await TT(`__s.key('KeyS', 's', { ctrlKey: true }); return { saves: __s.saves };`);
        ok(after.saves === 2, 'and once it finishes, Ctrl+S saves again', JSON.stringify(after));

        const present = await TT(`__s.load(); togglePresentMode(); __s.key('KeyS', 's', { ctrlKey: true });
            const r = { present: presentMode, saves: __s.saves }; togglePresentMode(); return r;`);
        ok(present.present && present.saves === 1, 'Ctrl+S saves in presentation mode', JSON.stringify(present));

        ok(/>Save to File <span class="hotkey">Ctrl\+S<\/span>/.test(HTML), 'the Save to File button shows Ctrl+S');
        ok(/>Save As… <span class="hotkey">Ctrl\+Shift\+S<\/span>/.test(HTML), 'the Save As button shows Ctrl+Shift+S');
        ok(/>Save now<\/button>/.test(HTML), 'Save now (browser storage) keeps its button, without a shortcut label');
        ok([...W.win.document.querySelectorAll('#help-panel tr')].some(row => row.textContent.includes('Save / save as') && [...row.querySelectorAll('kbd')].map(k => k.textContent).join('|') === 'Ctrl+S|Ctrl+Shift+S'), 'Help lists Ctrl+S save and Ctrl+Shift+S save as');
        ok(!/<kbd>Shift\+S<\/kbd>/.test(HTML), 'and Shift+S appears nowhere in Help');
    }

    console.log('\n-- Help is "/" --');
    {
        const help = await (async () => {
            const open = (k, c, opts) => T(W, `__s.load(); var b = document.getElementById('help-modal-backdrop'); b.classList.remove('open');
                var prevented = __s.key('${c}', '${k}', ${JSON.stringify(opts || {})});
                var r = { open: b.classList.contains('open'), prevented: prevented }; b.classList.remove('open'); return r;`);
            return {
                slash: open('/', 'Slash'),
                question: open('?', 'Slash', { shiftKey: true }),
                h: open('h', 'KeyH'),
            };
        })();
        ok(help.slash.open && help.slash.prevented, '"/" opens Help (and keeps Firefox quick-find out of it)', JSON.stringify(help.slash));
        ok(help.question.open, '"?" (Shift+/) opens it too', JSON.stringify(help.question));
        ok(!help.h.open, 'H no longer opens Help', JSON.stringify(help.h));

        const toggle = T(W, `__s.load(); var b = document.getElementById('help-modal-backdrop'); b.classList.remove('open');
            __s.key('Slash', '/'); var first = b.classList.contains('open');
            __s.key('Slash', '/'); var second = b.classList.contains('open');
            return { first: first, second: second };`);
        ok(toggle.first && !toggle.second, 'pressing "/" again closes it', JSON.stringify(toggle));

        const typing = T(W, `__s.load(); editNodeText('o', 0); var ta = document.activeElement;
            var b = document.getElementById('help-modal-backdrop'); b.classList.remove('open');
            ta.dispatchEvent(new KeyboardEvent('keydown', { code: 'Slash', key: '/', bubbles: true, cancelable: true }));
            return { open: b.classList.contains('open') };`);
        ok(!typing.open, 'typing "/" inside a box does not open Help', JSON.stringify(typing));

        ok(/<button id="help-btn"[^>]*title="Help \(\/\)"[^>]*>Help <span class="hotkey">\/<\/span>/.test(HTML) &&
           /id="help-icon-topleft"[^>]*title="Help \(\/\)"/.test(HTML) && [...W.win.document.querySelectorAll('#help-panel tr')].some(row => row.textContent.includes('open Help') && [...row.querySelectorAll('kbd')].some(k => k.textContent === '/')) && !/<kbd>H<\/kbd> help/.test(HTML),
            'the Help button, the ? icon and the Help text all say "/"');
    }

    console.log('\n-- collapse in presentation mode --');
    {
        const css = HTML.slice(0, HTML.indexOf('</style>'));
        ok(/body\.present-mode \.collapse-btn\s*\{\s*pointer-events:\s*auto;?\s*\}/.test(css),
            'the stylesheet re-enables collapse buttons in presentation mode');
        ok(!/body\.present-mode\.focus-mode \.collapse-btn/.test(css),
            'and present + focus mode no longer disables them');

        const click = T(W, `__s.load(); togglePresentMode();
            const btn = () => document.querySelector('.node[data-node-id="o"][data-node-idx="0"] .collapse-btn');
            const had = !!btn();
            btn().click();
            const collapsed = findNodeContext(state.trees, 'o').node.collapsed.slice();
            const rebuttalHidden = !document.querySelector('.node[data-node-id="k"]');
            btn().click();
            const expanded = findNodeContext(state.trees, 'o').node.collapsed.slice();
            const rebuttalBack = !!document.querySelector('.node[data-node-id="k"]');
            const r = { had: had, present: presentMode, collapsed: collapsed, rebuttalHidden: rebuttalHidden, expanded: expanded, rebuttalBack: rebuttalBack };
            togglePresentMode();
            return r;`);
        ok(click.had && click.present, 'setup: presentation mode on, the objection has a collapse button', JSON.stringify(click));
        ok(JSON.stringify(click.collapsed) === '[0]' && click.rebuttalHidden,
            'clicking it in presentation mode collapses the branch (its rebuttal disappears)', JSON.stringify(click));
        ok(JSON.stringify(click.expanded) === '[]' && click.rebuttalBack,
            'clicking again expands it', JSON.stringify(click));
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
