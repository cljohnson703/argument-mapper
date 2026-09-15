'use strict';
// r27 Shift+Tab: add a co-premise to the LEFT of the selected box.
//
// Tab has always inserted a new co-premise AFTER the selected box, and
// Shift+Tab matched the same `e.code === 'Tab'` test, so it landed on the
// right too. Shift+Tab now inserts BEFORE the selected box.
//
// The risk this suite exists for: an insert after the last box shifts
// nothing, so any per-box structure addCoPremise failed to move would stay
// latent under Tab. An insert before the selected box ALWAYS shifts that box
// and everything after it, so a missed field would surface immediately as
// data jumping to the wrong premise. Section 3 therefore loads every per-box
// structure at once and checks each one follows its box.
//
// Covers:
//   (1) Shift+Tab inserts before, Tab still inserts after, one box each.
//   (2) the new empty box is the one being edited. Selection is an index and
//       is deliberately NOT remapped: after Shift+Tab it names the new box,
//       after Tab the original -- and in both cases undo, which restores
//       state but not selection, lands it back on the original box. (An
//       earlier version remapped it to follow the shifted box; review showed
//       Ctrl+Z then left it one box too far right, where Delete hit the
//       wrong premise. Section 6 guards that.)
//   (3) every per-box structure follows its box on a left insert at index 0:
//       the nine parallel arrays, the raw and boxW index maps, collapsed,
//       children's targetIndex (explicit AND the implicit-0 undefined case),
//       and cross-refs from other nodes that point into this one.
//   (4) repeated Shift+Tab builds leftward: each new box lands left of the
//       one just written (repeated Tab is unchanged).
//   (5) guards: contention, while typing, review mode, no / multi selection.
//   (6) one undo step reverts the whole insert AND leaves the selection on
//       the original box.
//   (7) existing no-argument callers (button, menus) still insert right.
//   (8) Help documents Shift+Tab.
//   (9) UI that holds a box index follows its box: an open evaluation-notes
//       popover (and a half-written note in it), an armed cross-reference
//       pick; an open context menu, which cannot be re-pointed, closes.
//
// Run:  node copremise-r27-left-test.js [argument-mapper-r27.html]
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

// Page-side helpers, injected once. `press` dispatches a REAL keydown through
// the app's global shortcut handler rather than calling addCoPremise directly,
// so the Shift detection itself is under test.
const HELPERS = `
    window.__t = {
        load(trees, sel) {
            state.trees = JSON.parse(JSON.stringify(trees));
            ensureCollabFields(state);
            reviewMode = false;
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            render();
            selectedIds = sel.slice();
            updateSelectionVisuals();
        },
        press(shift) {
            document.dispatchEvent(new KeyboardEvent('keydown',
                { code: 'Tab', key: 'Tab', shiftKey: !!shift, bubbles: true, cancelable: true }));
        },
        node(id) { return JSON.parse(JSON.stringify(findNodeContext(state.trees, id).node)); },
        editing() {
            const a = document.activeElement;
            if (!a || a.tagName !== 'TEXTAREA' || a.readOnly) return null;
            const host = a.closest('.node');
            return { id: host.getAttribute('data-node-id'), idx: +host.getAttribute('data-node-idx'), value: a.value };
        },
        commit(text) {
            const a = document.activeElement;
            a.value = text;
            a.dispatchEvent(new Event('input', { bubbles: true }));
            a.blur();
        }
    };
`;

const T = (W, body) => JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`));

(async () => {
    console.log('=== r27 Shift+Tab: co-premise on the left ===');
    const W = makeWin('copremise-left');
    await sleep(250);
    W.win.eval(HELPERS);

    const ABC = [{ id: 'r', type: 'contention', texts: ['Main'], collapsed: [], children: [
        { id: 's', type: 'support', texts: ['A', 'B', 'C'], collapsed: [], children: [] }
    ] }];

    /* ================================================================
       1. Direction, one box per press.
       ================================================================ */
    console.log('\n-- direction --');
    {
        const left = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']); __t.press(true);
            return { texts: __t.node('s').texts, sel: selectedIds, ed: __t.editing() };`);
        ok(JSON.stringify(left.texts) === JSON.stringify(['A', '', 'B', 'C']),
            'Shift+Tab on B inserts the new box to its LEFT', JSON.stringify(left.texts));

        const right = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']); __t.press(false);
            return { texts: __t.node('s').texts, sel: selectedIds, ed: __t.editing() };`);
        ok(JSON.stringify(right.texts) === JSON.stringify(['A', 'B', '', 'C']),
            'Tab on B still inserts to its RIGHT (unchanged)', JSON.stringify(right.texts));

        ok(left.texts.length === 4 && right.texts.length === 4,
            'each press adds exactly one box (Shift+Tab does not ALSO fire the right insert)');

        /* ============================================================
           2. Editing target and selection.
           ============================================================ */
        console.log('\n-- focus + selection --');
        ok(left.ed && left.ed.id === 's' && left.ed.idx === 1 && left.ed.value === '',
            'Shift+Tab: the new empty box (index 1) is the one being edited', JSON.stringify(left.ed));
        ok(right.ed && right.ed.id === 's' && right.ed.idx === 2 && right.ed.value === '',
            'Tab: the new empty box (index 2) is the one being edited', JSON.stringify(right.ed));
        ok(JSON.stringify(left.sel) === JSON.stringify(['s-1']),
            'Shift+Tab: selection names index 1 -- the new box being typed into',
            JSON.stringify(left.sel));
        ok(JSON.stringify(right.sel) === JSON.stringify(['s-1']),
            'Tab: selection stays on B at index 1 (unchanged)', JSON.stringify(right.sel));

        const edge = T(W, `__t.load([{ id: 'r', type: 'contention', texts: ['Main'], collapsed: [], children: [
                { id: 'solo', type: 'support', texts: ['Only'], collapsed: [], children: [] } ] }], ['solo-0']);
            __t.press(true);
            return { texts: __t.node('solo').texts, sel: selectedIds, ed: __t.editing() };`);
        ok(JSON.stringify(edge.texts) === JSON.stringify(['', 'Only']) &&
           JSON.stringify(edge.sel) === JSON.stringify(['solo-0']) && edge.ed && edge.ed.idx === 0,
            'single-box node: Shift+Tab prepends at index 0, and selects and edits it',
            JSON.stringify(edge));

        const group = T(W, `__t.load(${JSON.stringify(ABC)}, ['s']); __t.press(true);
            return { texts: __t.node('s').texts, sel: selectedIds };`);
        ok(JSON.stringify(group.sel) === JSON.stringify(['s']),
            'a bare-id (whole group) selection carries no box index and is left as-is',
            JSON.stringify(group));
    }

    /* ================================================================
       3. Every per-box structure follows its box.
       ================================================================ */
    console.log('\n-- per-box data follows its box (left insert at 0) --');
    {
        const RICH = [{ id: 'r', type: 'contention', texts: ['Main'], collapsed: [], children: [
            {
                id: 'p', type: 'support', texts: ['P0', 'P1'],
                aligns: ['left', 'right'], statuses: ['accepted', 'rejected'],
                implicits: [true, false], givens: [false, true],
                evalNotes: ['note0', 'note1'],
                crossRefs: [[], [{ targetId: 'q', targetIdx: 0 }]],
                evalThreads: [[{ id: 'c0', text: 'thread0' }], [{ id: 'c1', text: 'thread1' }]],
                statusAuthors: ['alice', 'bob'],
                raw: { 1: true }, boxW: { 0: 240, 1: 310 },
                collapsed: [1],
                children: [
                    { id: 'kidImplicit0', type: 'support', texts: ['k0'], collapsed: [], children: [] },
                    { id: 'kid1', type: 'objection', texts: ['k1'], targetIndex: 1, collapsed: [], children: [] }
                ]
            },
            {
                id: 'q', type: 'support', texts: ['Q0'], collapsed: [], children: [],
                crossRefs: [[{ targetId: 'p', targetIdx: 0 }, { targetId: 'p', targetIdx: 1 }]]
            }
        ] }];

        const res = T(W, `__t.load(${JSON.stringify(RICH)}, ['p-0']); __t.press(true);
            return { p: __t.node('p'), q: __t.node('q'), sel: selectedIds };`);
        const p = res.p;

        ok(JSON.stringify(p.texts) === JSON.stringify(['', 'P0', 'P1']), 'texts: new empty box at 0', JSON.stringify(p.texts));
        const n = p.texts.length;
        [['aligns', ['left', 'right']], ['statuses', ['accepted', 'rejected']],
         ['implicits', [true, false]], ['givens', [false, true]],
         ['evalNotes', ['note0', 'note1']], ['statusAuthors', ['alice', 'bob']]]
        .forEach(([f, orig]) => {
            ok(Array.isArray(p[f]) && p[f].length === n &&
               JSON.stringify(p[f].slice(1)) === JSON.stringify(orig),
                f + ': stays parallel with texts and follows its box', JSON.stringify(p[f]));
        });
        ok(p.evalThreads && p.evalThreads.length === n &&
           p.evalThreads[1][0].id === 'c0' && p.evalThreads[2][0].id === 'c1' &&
           Array.isArray(p.evalThreads[0]) && p.evalThreads[0].length === 0,
            'evalThreads: comment threads follow their box; the new box has none', JSON.stringify(p.evalThreads));
        ok(p.crossRefs && p.crossRefs.length === n && p.crossRefs[0].length === 0 &&
           p.crossRefs[2].length === 1 && p.crossRefs[2][0].targetId === 'q',
            'crossRefs (outgoing): follow their box; the new box has none', JSON.stringify(p.crossRefs));
        ok(p.raw && p.raw[2] === true && !p.raw[1] && !p.raw[0],
            'raw index map: the raw flag moves from 1 to 2', JSON.stringify(p.raw));
        ok(p.boxW && p.boxW[1] === 240 && p.boxW[2] === 310 && p.boxW[0] === undefined,
            'boxW index map: widths move up one, the new box gets the default', JSON.stringify(p.boxW));
        ok(JSON.stringify(p.collapsed) === JSON.stringify([2]),
            'collapsed: the collapsed box index moves from 1 to 2', JSON.stringify(p.collapsed));

        const kid0 = p.children.find(c => c.id === 'kidImplicit0');
        const kid1 = p.children.find(c => c.id === 'kid1');
        ok(kid0 && kid0.targetIndex === 1,
            'child with NO targetIndex (implicitly box 0) now points at box 1, still under P0',
            JSON.stringify(kid0 && kid0.targetIndex));
        ok(kid1 && kid1.targetIndex === 2,
            'child with targetIndex 1 now points at box 2, still under P1',
            JSON.stringify(kid1 && kid1.targetIndex));

        const qr = res.q.crossRefs && res.q.crossRefs[0];
        ok(qr && qr.length === 2 &&
           qr.some(r => r.targetId === 'p' && r.targetIdx === 1) &&
           qr.some(r => r.targetId === 'p' && r.targetIdx === 2),
            "incoming cross-refs from another node re-point at P0 and P1's new indices",
            JSON.stringify(qr));
        ok(JSON.stringify(res.sel) === JSON.stringify(['p-0']),
            'selection stays at index 0, naming the new box', JSON.stringify(res.sel));
    }

    /* ================================================================
       4. Repeated presses mirror each other.
       ================================================================ */
    console.log('\n-- repeated presses --');
    {
        const rep = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']);
            __t.press(true);  __t.commit('X');
            __t.press(true);  __t.commit('Y');
            return { texts: __t.node('s').texts, sel: selectedIds };`);
        ok(JSON.stringify(rep.texts) === JSON.stringify(['A', 'Y', 'X', 'B', 'C']),
            'Shift+Tab, type, Shift+Tab: each new box lands left of the one just written',
            JSON.stringify(rep.texts));
        ok(JSON.stringify(rep.sel) === JSON.stringify(['s-1']),
            'the box just written (Y) is the selected one', JSON.stringify(rep.sel));

        const repR = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']);
            __t.press(false); __t.commit('X');
            __t.press(false); __t.commit('Y');
            return { texts: __t.node('s').texts, sel: selectedIds };`);
        ok(JSON.stringify(repR.texts) === JSON.stringify(['A', 'B', 'Y', 'X', 'C']),
            'the mirror image under Tab is unchanged: each lands immediately right of B',
            JSON.stringify(repR.texts));
    }

    /* ================================================================
       5. Guards.
       ================================================================ */
    console.log('\n-- guards --');
    {
        const contention = T(W, `__t.load(${JSON.stringify(ABC)}, ['r-0']); __t.press(true);
            return __t.node('r').texts;`);
        ok(JSON.stringify(contention) === JSON.stringify(['Main']),
            'a main contention cannot take a co-premise on either side', JSON.stringify(contention));

        const typing = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']);
            editNodeText('s', 1);
            const wasEditing = !!__t.editing();
            __t.press(true);
            return { wasEditing: wasEditing, texts: __t.node('s').texts };`);
        ok(typing.wasEditing && JSON.stringify(typing.texts) === JSON.stringify(['A', 'B', 'C']),
            'while typing in a box, Shift+Tab does not insert', JSON.stringify(typing));

        const review = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']); reviewMode = true;
            __t.press(true); const t = __t.node('s').texts; reviewMode = false; return t;`);
        ok(JSON.stringify(review) === JSON.stringify(['A', 'B', 'C']),
            'review mode (structure frozen) blocks it', JSON.stringify(review));

        const none = T(W, `__t.load(${JSON.stringify(ABC)}, []); __t.press(true); return __t.node('s').texts;`);
        ok(none.length === 3, 'no selection: nothing happens', JSON.stringify(none));

        const multi = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-0', 's-2']); __t.press(true); return __t.node('s').texts;`);
        ok(multi.length === 3, 'multi-selection: nothing happens (no single target)', JSON.stringify(multi));
    }

    /* ================================================================
       6. Undo.
       ================================================================ */
    console.log('\n-- undo --');
    {
        const u = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']); undoStack = []; redoStack = [];
            __t.press(true); __t.commit('');
            const after = __t.node('s').texts;
            undo();
            return { after: after, undone: __t.node('s').texts };`);
        ok(u.after.length === 4 && JSON.stringify(u.undone) === JSON.stringify(['A', 'B', 'C']),
            'one undo removes the left-inserted box', JSON.stringify(u));

        // The regression review found: with a selection remap, Ctrl+Z put the
        // texts back but left the selection on index 2 -- C -- so the next
        // Delete removed C instead of B.
        const us = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']); undoStack = []; redoStack = [];
            __t.press(true); __t.commit('typed');
            undo(); undo();
            const sel = selectedIds.slice();
            const p = parseSel(sel[0]);
            const namesText = __t.node('s').texts[p.box];
            deleteSelected();
            return { sel: sel, namesText: namesText, afterDelete: __t.node('s').texts };`);
        ok(us.namesText === 'B',
            'after Shift+Tab, typing, and undoing both steps, the selection names B again',
            JSON.stringify(us));
        ok(JSON.stringify(us.afterDelete) === JSON.stringify(['A', 'C']),
            'so the next Delete removes B, the box the user had selected',
            JSON.stringify(us.afterDelete));
    }

    /* ================================================================
       7. No-argument callers keep their placement.
       ================================================================ */
    console.log('\n-- existing callers --');
    {
        const direct = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']); addCoPremise(); return __t.node('s').texts;`);
        ok(JSON.stringify(direct) === JSON.stringify(['A', 'B', '', 'C']),
            'addCoPremise() with no argument (button, context menu, + action) still inserts right',
            JSON.stringify(direct));
        ok(/onclick="addCoPremise\(\)"/.test(HTML) && /ctxAction\(\(\)=>addCoPremise\(\)\)/.test(HTML),
            'the toolbar button and context menu still call it with no argument');
    }

    /* ================================================================
       8. Documentation.
       ================================================================ */
    console.log('\n-- documentation --');
    {
        ok(/<kbd>Shift\+Tab<\/kbd>\s*co-premise on the left/.test(HTML),
            'Help lists Shift+Tab as co-premise on the left');
    }

    /* ================================================================
       9. UI that holds a box index follows its box.
       ================================================================ */
    console.log('\n-- open UI follows its box --');
    {
        // Notes popover open on B with a half-written note, then Shift+Tab on
        // B: the popover must stay on B, keep the draft, and a submitted note
        // must land on B -- not on the new empty box now at B's old index.
        const pop = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']);
            openEvalNotesForBox('s', 1);
            let p = document.querySelector('.eval-thread-popover');
            let comp = p.querySelector('.eval-composer');
            comp.value = 'draft about B';
            comp.dispatchEvent(new Event('input', { bubbles: true }));
            comp.blur();
            __t.press(true);
            __t.commit('');
            p = document.querySelector('.eval-thread-popover');
            comp = p && p.querySelector('.eval-composer');
            const info = { open: !!p, idx: p && +p.dataset.nodeIdx, draft: comp && comp.value,
                           locKey: comp && comp.dataset.locKey };
            comp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            const n = __t.node('s');
            info.texts = n.texts;
            info.threads = (n.evalThreads || []).map(t => (t || []).map(c => c.text));
            return info;`);
        ok(pop.open && pop.idx === 2 && pop.draft === 'draft about B',
            'an open notes popover moves with B (index 1 -> 2) and keeps the unsent draft',
            JSON.stringify(pop));
        ok(pop.locKey && pop.locKey.split('|')[2] === '2',
            "its composer's merge key is re-pointed at B too", JSON.stringify(pop.locKey));
        const bIdx = pop.texts ? pop.texts.indexOf('B') : -1;
        ok(bIdx === 2 && pop.threads[2] && pop.threads[2][0] === 'draft about B' &&
           !(pop.threads[1] || []).length,
            'submitting it saves the note on B, not on the new box', JSON.stringify(pop));

        const pick = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']);
            armCrossRefPicking('s', 1);
            __t.press(true);
            __t.commit('');
            completeCrossRefPicking('s', 3);
            const n = __t.node('s');
            return { texts: n.texts, refs: n.crossRefs };`);
        ok(pick.refs && pick.refs[2] && pick.refs[2].length === 1 && pick.refs[2][0].targetIdx === 3 &&
           !(pick.refs[1] || []).length,
            'an armed cross-reference pick started on B is written from B after the shift',
            JSON.stringify(pick));

        const menu = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']);
            showContextMenu(10, 10, 's', 1);
            const openBefore = document.getElementById('context-menu').classList.contains('open');
            __t.press(true);
            return { openBefore: openBefore, openAfter: document.getElementById('context-menu').classList.contains('open') };`);
        ok(menu.openBefore && !menu.openAfter,
            'an open context menu (its actions bake in the old index) closes', JSON.stringify(menu));
    }

    /* ================================================================
       10. The co-premise + buttons: one on each side of the selected box.
           (Their colors follow the box: typecolors-r27-menu-test.js.)
       ================================================================ */
    console.log('\n-- + buttons on both sides --');
    {
        // jsdom has no layout, and the buttons are only drawn for a box inside
        // the visible canvas. Give the canvas, surface and boxes real-looking
        // geometry for the duration of these checks.
        W.win.eval(`
            window.__realRect = Element.prototype.getBoundingClientRect;
            window.__boxLeft = 500;
            Element.prototype.getBoundingClientRect = function () {
                var r = function (l, t, w, h) { return { left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t }; };
                if (this.id === 'canvas') return r(0, 0, 1200, 800);
                if (this.id === 'surface') return r(0, 0, 60000, 60000);
                if (this.classList && (this.classList.contains('node') || this.classList.contains('node-group'))) return r(window.__boxLeft, 300, 180, 60);
                return window.__realRect.call(this);
            };
        `);
        const buttons = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']); updateNodeActions();
            var bs = Array.prototype.slice.call(document.querySelectorAll('.node-action-btn.action-copremise'));
            return bs.map(function (b) { var c = b.parentElement; return { side: b.dataset.side, title: b.title,
                left: parseFloat(c.style.left), transform: c.style.transform }; });`);
        const L = buttons.find(b => b.side === 'left'), R = buttons.find(b => b.side === 'right');
        ok(buttons.length === 2 && L && R, 'a selected premise gets a co-premise + on BOTH sides', JSON.stringify(buttons));
        ok(L && R && L.left < R.left && /translate\(-100%/.test(L.transform),
            'the left one sits at the left edge, shifted back by its own width', JSON.stringify({ L, R }));
        ok(L && /Shift\+Tab/.test(L.title) && R && /\(Tab\)/.test(R.title),
            'their tooltips name Shift+Tab and Tab', JSON.stringify([L && L.title, R && R.title]));

        const clickLeft = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']); updateNodeActions();
            document.querySelector('.node-action-btn[data-side="left"]').click();
            return { texts: __t.node('s').texts, ed: __t.editing() };`);
        ok(JSON.stringify(clickLeft.texts) === JSON.stringify(['A', '', 'B', 'C']) && clickLeft.ed && clickLeft.ed.idx === 1,
            'clicking the left + inserts to the left, like Shift+Tab', JSON.stringify(clickLeft));

        const clickRight = T(W, `__t.load(${JSON.stringify(ABC)}, ['s-1']); updateNodeActions();
            document.querySelector('.node-action-btn[data-side="right"]').click();
            return { texts: __t.node('s').texts };`);
        ok(JSON.stringify(clickRight.texts) === JSON.stringify(['A', 'B', '', 'C']),
            'clicking the right + still inserts to the right', JSON.stringify(clickRight));

        const contention = T(W, `__t.load(${JSON.stringify(ABC)}, ['r-0']); updateNodeActions();
            return document.querySelectorAll('.node-action-btn.action-copremise').length;`);
        ok(contention === 0, 'a main contention gets neither (it cannot have co-premises)', String(contention));

        const edge = T(W, `window.__boxLeft = 5; __t.load(${JSON.stringify(ABC)}, ['s-1']); updateNodeActions();
            var sides = Array.prototype.slice.call(document.querySelectorAll('.node-action-btn.action-copremise')).map(function (b) { return b.dataset.side; });
            window.__boxLeft = 500; return sides;`);
        ok(JSON.stringify(edge) === JSON.stringify(['right']),
            'a box against the left edge of the view gets only the right + (no button off-screen)', JSON.stringify(edge));

        W.win.eval(`Element.prototype.getBoundingClientRect = window.__realRect;`);
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));

    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
