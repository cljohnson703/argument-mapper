'use strict';
// r27 press-away: pressing another box closes the open node editor.
//
// Moving focus is the default action of mousedown, and a mouse press on a
// box, fork bar, drag handle or resize grip never produces one: the node's
// pointerdown handler preventDefault()s (initPointerDrag, the grip path),
// which suppresses the compatibility mouse events. So the editor kept focus
// -- the pressed box became selected while the previous box stayed open with
// its caret blinking. A capture-phase pointerdown listener now closes it.
//
// jsdom never moves focus on a press at all, so it cannot show the browser
// symptom directly; what this suite pins down is the contract the listener
// must keep, and against the previous build the "closes" checks fail.
//
// Covers:
//   (1) a press on a different box, a sibling co-premise in the SAME group,
//       and the group's fork bar each close the editor, and the click that
//       follows still selects what was pressed;
//   (2) text typed before the press is committed, not lost;
//   (3) a press inside the box being edited -- its padding, drag handle, or
//       the textarea itself -- keeps editing;
//   (4) touch and shift-press behave the same way;
//   (5) textareas that are not node editors (comment composers, string
//       mode) are left alone.
//
// Run:  node editexit-r27-press-test.js [argument-mapper-r27.html]
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

// Page-side helpers. `press` delivers the full sequence a real press does --
// pointerdown on the target, pointerup, then click -- through the app's own
// handlers, so initPointerDrag's preventDefault is genuinely in the path.
const HELPERS = `
    window.__p = {
        load() {
            state.trees = [
                { id: 'r', type: 'contention', texts: ['Main'], collapsed: [], children: [
                    { id: 's', type: 'support', texts: ['A', 'B'], collapsed: [], children: [] },
                    { id: 't', type: 'support', texts: ['C'], collapsed: [], children: [] }
                ] }
            ];
            ensureCollabFields(state);
            reviewMode = false;
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            render();
            selectedIds = ['s-0'];
            updateSelectionVisuals();
        },
        box(id, idx) { return document.querySelector('.node[data-node-id="' + id + '"][data-node-idx="' + idx + '"]'); },
        ta(id, idx) { return this.box(id, idx).querySelector('.box-editor'); },
        open(id, idx) { editNodeText(id, idx); return this.editing(); },
        editing() {
            const a = document.activeElement;
            if (!a || !(a.tagName === 'TEXTAREA' || (a.classList && a.classList.contains('box-editor'))) || a.readOnly) return null;
            const host = a.closest('.node');
            return host ? host.getAttribute('data-node-id') + '-' + host.getAttribute('data-node-idx') : 'non-node textarea';
        },
        press(el, opts) {
            opts = opts || {};
            const base = { bubbles: true, cancelable: true, composed: true, button: 0, buttons: 1,
                           pointerId: 1, isPrimary: true, clientX: 5, clientY: 5,
                           pointerType: opts.pointerType || 'mouse', shiftKey: !!opts.shift };
            el.dispatchEvent(new PointerEvent('pointerdown', base));
            document.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, base, { buttons: 0 })));
            if (!opts.noClick) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: !!opts.shift }));
        }
    };
`;
const T = (W, body) => JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`));

(async () => {
    console.log('=== r27 press-away closes the node editor ===');
    const W = makeWin('editexit-press');
    await sleep(250);
    W.win.eval(HELPERS);

    /* ================================================================
       1. Pressing somewhere else that is still "a node".
       ================================================================ */
    console.log('\n-- presses that should close the editor --');
    {
        const other = T(W, `__p.load(); const before = __p.open('s', 0);
            __p.press(__p.box('t', 0));
            return { before, after: __p.editing(), sel: selectedIds, readOnly: __p.ta('s', 0).readOnly };`);
        ok(other.before === 's-0', 'setup: box A is open for editing', JSON.stringify(other));
        ok(other.after === null && other.readOnly === true,
            'a press on a different box closes the open editor', JSON.stringify(other));
        ok(JSON.stringify(other.sel) === JSON.stringify(['t-0']),
            'and the click still selects the pressed box', JSON.stringify(other.sel));

        const sibling = T(W, `__p.load(); __p.open('s', 0);
            __p.press(__p.box('s', 1));
            return { after: __p.editing(), sel: selectedIds };`);
        ok(sibling.after === null && JSON.stringify(sibling.sel) === JSON.stringify(['s-1']),
            'a press on a co-premise in the SAME group counts as another box', JSON.stringify(sibling));

        const fork = T(W, `__p.load(); __p.open('s', 0);
            const f = document.querySelector('#group-s .group-fork-hitbox');
            if (!f) return { missing: true };
            __p.press(f);
            return { after: __p.editing(), sel: selectedIds };`);
        ok(!fork.missing, 'setup: the two-box group has a fork bar');
        ok(!fork.missing && fork.after === null && JSON.stringify(fork.sel) === JSON.stringify(['s']),
            "a press on the group's fork bar closes it and selects the whole group", JSON.stringify(fork));
    }

    /* ================================================================
       2. The edit is committed, not dropped.
       ================================================================ */
    console.log('\n-- the edit survives --');
    {
        const kept = T(W, `__p.load(); __p.open('s', 0);
            const ta = document.activeElement;
            ta.value = 'A edited';
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            __p.press(__p.box('t', 0));
            const n = findNodeContext(state.trees, 's').node;
            return { text: n.texts[0], shown: __p.box('s', 0).querySelector('.rendered-text').textContent.trim(),
                     renderedVisible: __p.box('s', 0).querySelector('.rendered-text').style.display !== 'none' };`);
        ok(kept.text === 'A edited', 'text typed before the press is kept in the map', JSON.stringify(kept));
        ok(kept.renderedVisible && kept.shown === 'A edited',
            'the box drops back to its rendered view showing the new text', JSON.stringify(kept));
    }

    /* ================================================================
       3. Presses inside the box being edited keep editing.
       ================================================================ */
    console.log('\n-- presses that should NOT close the editor --');
    {
        const padding = T(W, `__p.load(); __p.open('s', 0);
            __p.press(__p.box('s', 0), { noClick: true });
            return __p.editing();`);
        ok(padding === 's-0', "a press on the edited box's own padding keeps editing", JSON.stringify(padding));

        const handle = T(W, `__p.load(); __p.open('s', 0);
            __p.press(__p.box('s', 0).querySelector('.drag-handle'), { noClick: true });
            return __p.editing();`);
        ok(handle === 's-0', "a press on the edited box's own drag handle keeps editing", JSON.stringify(handle));

        const itself = T(W, `__p.load(); __p.open('s', 0);
            __p.press(__p.ta('s', 0), { noClick: true });
            return __p.editing();`);
        ok(itself === 's-0', 'a press inside the editor itself keeps editing', JSON.stringify(itself));
    }

    /* ================================================================
       4. Touch and shift-press.
       ================================================================ */
    console.log('\n-- other pointers and modifiers --');
    {
        const touch = T(W, `__p.load(); __p.open('s', 0);
            __p.press(__p.box('t', 0), { pointerType: 'touch' });
            return { after: __p.editing(), sel: selectedIds };`);
        ok(touch.after === null, 'a touch press on another box closes the editor too', JSON.stringify(touch));

        const shift = T(W, `__p.load(); __p.open('s', 0);
            __p.press(__p.box('t', 0), { shift: true });
            return { after: __p.editing(), sel: selectedIds.slice().sort() };`);
        ok(shift.after === null && JSON.stringify(shift.sel) === JSON.stringify(['s-0', 't-0']),
            'a shift-press closes it and ADDS the pressed box to the selection', JSON.stringify(shift));
    }

    /* ================================================================
       5. Non-node textareas are left alone.
       ================================================================ */
    console.log('\n-- textareas that are not node editors --');
    {
        const other = T(W, `__p.load();
            const se = document.getElementById('string-editor');
            if (!se) return { missing: true };
            se.focus();
            const before = document.activeElement === se;
            __p.press(__p.box('t', 0), { noClick: true });
            return { before, stillFocused: document.activeElement === se };`);
        ok(!other.missing && other.before && other.stillFocused,
            'a focused textarea outside any box (string mode) is not blurred by this listener',
            JSON.stringify(other));
    }

    /* ================================================================
       6. Held on a touch screen inside the box being edited: its words are
          the browser's to select -- no menu (r27.111; the user: "when they
          try to highlight text in a node while in text edit mode, the
          context menu comes up and they can't highlight text").
       ================================================================ */
    console.log('\n-- a hold inside the box being edited --');
    {
        // The touch press of (4) let go on the document, not the canvas: its
        // hold runs out and opens the menu. Let it, and close it.
        await sleep(650);
        T(W, `hideContextMenu(); return true;`);
        T(W, `__p.load(); __p.open('s', 0);
            __p.ta('s', 0).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, button: 0, buttons: 1,
                pointerId: 1, isPrimary: true, clientX: 5, clientY: 5, pointerType: 'touch' }));
            return true;`);
        await sleep(650);
        const held = T(W, `const cm = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
            __p.ta('s', 0).dispatchEvent(cm);
            const r = { menu: document.getElementById('context-menu').classList.contains('open'), linkMenu: !!document.getElementById('link-menu'),
                prevented: cm.defaultPrevented, editing: __p.editing() };
            document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch' }));
            return r;`);
        ok(!held.menu && !held.linkMenu && !held.prevented && held.editing === 's-0',
            'a finger held in the box being edited opens no menu, and the browser may select its words (the box menu had opened)', JSON.stringify(held));
        const right = T(W, `__p.load(); __p.open('s', 0);
            __p.ta('s', 0).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 2, buttons: 2, pointerId: 1, pointerType: 'mouse' }));
            const cm = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
            __p.ta('s', 0).dispatchEvent(cm);
            const r = { linkMenu: !!document.getElementById('link-menu'), prevented: cm.defaultPrevented };
            document.querySelectorAll('#link-menu').forEach(m => m.remove());
            document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse' }));
            return r;`);
        ok(right.linkMenu && right.prevented, 'a right-click there still opens its own menu (bold, italic, a link)', JSON.stringify(right));
    }

    /* ================================================================
       7. A touch screen's editing toolbar, just above its keyboard
          (r27.113; the user, of three sketches: "Option 3").
       ================================================================ */
    console.log('\n-- the editing toolbar on a touch screen --');
    {
        const mouse = T(W, `__p.load(); touchPointerType = 'mouse'; __p.open('s', 0); var t = document.getElementById('edit-toolbar'), r = !!t && !t.hidden;
            document.activeElement.blur(); return r;`);
        ok(mouse === false, 'opened with a mouse: no toolbar', JSON.stringify(mouse));
        const bar = T(W, `__p.load(); touchPointerType = 'touch'; __p.open('s', 0); var t = document.getElementById('edit-toolbar');
            return { shown: !t.hidden, buttons: [].map.call(t.querySelectorAll('button'), function (b) { return b.textContent; }), editing: __p.editing() };`);
        ok(bar.shown && JSON.stringify(bar.buttons) === JSON.stringify(['B', 'I', 'U', 'Link a premise', 'Link selection']) && bar.editing === 's-0',
            'opened by touch: bold, italic, underline and the two links, in a toolbar, the box still being edited', JSON.stringify(bar));
        const press = (i) => `var b = document.querySelectorAll('#edit-toolbar button')[${i}], d = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' });
            b.dispatchEvent(d); b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));`;
        const bold = T(W, `var ed = document.activeElement; ed.value = 'Bob sings'; ed.dispatchEvent(new Event('input', { bubbles: true })); ed.setSelectionRange(4, 9);
            ${press(0)}
            return { prevented: d.defaultPrevented, text: findNodeContext(state.trees, 's').node.texts[0], editing: __p.editing(), pressed: b.getAttribute('aria-pressed') };`);
        ok(bold.prevented && bold.text === 'Bob **sings**' && bold.editing === 's-0' && bold.pressed === 'true',
            'B bolds the selected words, and the box stays open: the press keeps its focus, and so the keyboard', JSON.stringify(bold));
        const pick = T(W, `document.activeElement.setSelectionRange(0, 0);
            ${press(3)}
            var r = { picking: !!boxLinkPicking, hint: document.getElementById('crossref-hint').textContent }; cancelBoxLinkPicking(false); return r;`);
        ok(pick.picking && pick.hint === 'Tap the box to link into the text, or the canvas to cancel', '"Link a premise": a box to tap, and the canvas to cancel -- no Esc on a phone', JSON.stringify(pick));
        const cross = T(W, `armCrossRefPicking('s', 1, 's'); var h = document.getElementById('crossref-hint').textContent; cancelCrossRefPicking(); return h;`);
        ok(cross === 'Tap a node to link to it, or the canvas to cancel', 'a cross-reference on a touch screen likewise: tap, and the canvas to cancel', JSON.stringify(cross));
        const css = T(W, `var t = [].map.call(document.querySelectorAll('style'), function (s) { return s.textContent; }).join(' '), m = /#edit-toolbar \\{([^}]*)\\}/.exec(t);
            return { fixed: !!m && /position: fixed/.test(m[1]), panel: !!m && /var\\(--panel-bg/.test(m[1]), hidden: /#edit-toolbar\\[hidden\\] \\{ display: none; \\}/.test(t) };`);
        ok(css.fixed && css.panel && css.hidden, 'its look: fixed along the bottom of what is seen, in the panels\' colors, and gone when hidden', JSON.stringify(css));
        await sleep(20);
        const gone = T(W, `return document.getElementById('edit-toolbar').hidden;`);
        ok(gone === true, 'the box closed, the toolbar goes', JSON.stringify(gone));
        T(W, `touchPointerType = 'mouse'; return 1;`);
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
