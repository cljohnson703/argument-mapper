'use strict';
// r27.39 The reading chooser.
//
// A step whose box is ambiguous ("Only Bob runs", "Even if Mary runs, Bob
// runs", "All ravens are not white") is tagged "? ambiguous". Clicking the tag
// opens a popover with the box's readings; the reading that would make the
// step follow says so. Choosing one and pressing "Rewrite the box this way"
// replaces the box's words with that reading, written out -- so the map says
// what it means -- and undo restores what it said before. A reading the
// checker would not read back as itself cannot be written in; a read-only map
// shows the readings but writes nothing; any other tag still opens the list of
// every step. With several questions (r27.121), the window scrolls where it
// is taller than the screen, and one button rewrites every box a reading is
// chosen for. A row shows what its reading changes, the box whole on hover;
// under a marked reading, a note says what it would set off in another step
// that uses its box; and once boxes are rewritten, the window stays open on
// the steps that use them and now ask (r27.122).
//
// Run:  node reading-r27-chooser-test.js [argument-mapper-r27.html]
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

const N = (id, type, texts, children, extra) => Object.assign({ id, type, texts, collapsed: [], children: children || [] }, extra || {});
const MAP = (premise, conclusion) => [N('M', 'contention', [conclusion], [N('S', 'support', [premise])], { x: 30000, y: 30000 })];
const HELPERS = `
    window.__c = {
        load(trees) {
            state.trees = JSON.parse(JSON.stringify(trees));
            ensureCollabFields(state);
            selectedIds = [];
            deductiveLive = true;
            reviewMode = false;
            render();
        },
        tag(id) { return document.querySelector('.derivation-tag[data-step="' + id + '"]'); },
        text(id) { return findNodeContext(state.trees, id).node.texts[0]; },
        pop() { return document.getElementById('reading-chooser'); }
    };
`;
const T = (W, body) => {
    try { return JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`)); }
    catch (e) { return { __error: String((e && e.message) || e) }; }
};
const J = JSON.stringify;

(async () => {
    console.log('=== r27 the reading chooser ===');
    const W = makeWin('reading-chooser');
    await sleep(250);
    W.win.eval(HELPERS);

    // 1. The tag and its popover.
    const opened = T(W, `__c.load(${J(MAP('Only Bob runs', 'Bob runs'))});
        var tag = __c.tag('S');
        var before = { text: tag && tag.textContent, title: tag && tag.title };
        tag.click();
        var pop = __c.pop();
        var rows = pop ? [].slice.call(pop.querySelectorAll('.rc-row')).map(function (r) { return r.textContent.replace(/\\s+/g, ' ').trim(); }) : [];
        var apply = pop && pop.querySelector('.rc-apply');
        return { before: before, open: !!pop, head: pop && pop.querySelector('.rc-head').textContent, rows: rows,
                 applyDisabled: apply && apply.disabled, modal: document.getElementById('logic-modal-backdrop').classList.contains('open') };`);
    ok(/ambiguous/i.test(opened.before && opened.before.text || '') && /Click to choose a reading\./.test(opened.before && opened.before.title || ''),
        'an ambiguous step is tagged so, and its tag offers a reading', J(opened.before));
    ok(opened.open && !opened.modal, 'clicking it opens the reading chooser, not the list of steps', J(opened));
    ok(/Only Bob runs/.test(opened.head || '') && /may or may not also say that Bob does/.test(opened.head || ''),
        'which names the box and what is ambiguous in it', opened.head);
    ok(opened.rows && opened.rows.length === 2 && opened.rows[0] === 'Everything that runs is Bob' &&
        /^Bob runs, and everything that runs is Bob — the step follows by conjunction elimination$/.test(opened.rows[1]),
        'and lists both readings, written out, saying which one the step needs', J(opened.rows));
    ok(opened.applyDisabled === true, 'nothing is rewritten until a reading is chosen');

    // 2. Choose, rewrite, and undo.
    const rewritten = T(W, `var pop = __c.pop();
        var radios = pop.querySelectorAll('.rc-row input');
        radios[1].checked = true; radios[1].dispatchEvent(new Event('change', { bubbles: true }));
        var apply = pop.querySelector('.rc-apply');
        var enabled = !apply.disabled;
        apply.click();
        var after = { text: __c.text('S'), tag: __c.tag('S') && __c.tag('S').textContent, open: !!__c.pop() };
        undo();
        return { enabled: enabled, after: after, undone: __c.text('S'), tagUndone: __c.tag('S') && __c.tag('S').textContent };`);
    ok(rewritten.enabled, 'choosing a reading enables the rewrite');
    ok(rewritten.after && rewritten.after.text === 'Bob runs, and everything that runs is Bob' && !rewritten.after.open,
        'which writes the reading into the box and closes the chooser', J(rewritten.after));
    ok(/conjunction elimination/.test(rewritten.after && rewritten.after.tag || ''), 'and the step now follows', rewritten.after && rewritten.after.tag);
    ok(rewritten.undone === 'Only Bob runs' && /ambiguous/i.test(rewritten.tagUndone || ''), 'undo restores the box as it was', J(rewritten));

    // 3. "Even if", and an older ambiguity, "all ... not".
    const even = T(W, `__c.load(${J(MAP('Even if Mary runs, Bob runs.', 'Bob runs.'))});
        __c.tag('S').click();
        var rows = [].slice.call(__c.pop().querySelectorAll('.rc-row')).map(function (r) { return { t: r.textContent.replace(/\\s+/g, ' ').trim(), off: r.querySelector('input').disabled }; });
        var radios = __c.pop().querySelectorAll('.rc-row input');
        radios[0].checked = true; radios[0].dispatchEvent(new Event('change', { bubbles: true }));
        __c.pop().querySelector('.rc-apply').click();
        return { rows: rows, text: __c.text('S') };`);
    ok(even.rows && even.rows.length === 2 && !even.rows[0].off && !even.rows[1].off &&
        /^Bob runs, and if Mary runs, then Bob runs\. — the step follows by conjunction elimination$/.test(even.rows[0].t),
        '"even if" offers both readings, written out with the box\'s full stop', J(even.rows));
    ok(even.text === 'Bob runs, and if Mary runs, then Bob runs.', 'and writes the concessive one in', even.text);
    const all = T(W, `__c.load(${J(MAP('All ravens are not white', 'No raven is white'))});
        __c.tag('S').click();
        return [].slice.call(__c.pop().querySelectorAll('.rc-row')).map(function (r) { return { t: r.textContent.replace(/\\s+/g, ' ').trim(), off: r.querySelector('input').disabled }; });`);
    ok(Array.isArray(all) && all.length === 2 && all.every(r => !r.off) && /^No ravens are white/.test(all[0].t),
        'an older ambiguity ("all ravens are not white") is offered the same way', J(all));

    // 4. Closing, read-only, and every other tag.
    const closing = T(W, `__c.load(${J(MAP('Only Bob runs', 'Bob runs'))});
        __c.tag('S').click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        var escaped = !__c.pop();
        __c.tag('S').click();
        __c.pop().querySelector('.rc-all').click();
        var list = document.getElementById('logic-modal-backdrop').classList.contains('open') && !__c.pop();
        document.getElementById('logic-modal-backdrop').classList.remove('open');
        return { escaped: escaped, list: list };`);
    ok(closing.escaped, 'Escape closes the chooser');
    ok(closing.list, '"Every step..." opens the list of steps, as the tag used to');
    const readOnly = T(W, `__c.load(${J(MAP('Only Bob runs', 'Bob runs'))});
        reviewMode = true; render();
        __c.tag('S').click();
        var radios = __c.pop().querySelectorAll('.rc-row input');
        radios[1].checked = true; radios[1].dispatchEvent(new Event('change', { bubbles: true }));
        var apply = __c.pop().querySelector('.rc-apply');
        var disabled = apply.disabled;
        apply.click();
        var text = __c.text('S');
        reviewMode = false;
        return { disabled: disabled, text: text };`);
    ok(readOnly.disabled && readOnly.text === 'Only Bob runs', 'in review mode the readings are shown but nothing is written', J(readOnly));
    const other = T(W, `__c.load(${J(MAP('Bob runs and Mary runs', 'Bob runs'))});
        var tag = __c.tag('S');
        tag.click();
        var r = { tag: tag.textContent, chooser: !!__c.pop(), list: document.getElementById('logic-modal-backdrop').classList.contains('open') };
        document.getElementById('logic-modal-backdrop').classList.remove('open');
        return r;`);
    ok(other.chooser === false && other.list === true && /conjunction elimination/.test(other.tag), 'any other tag still opens the list of steps', J(other));

    // 4b. The ambiguous box may be the one the step supports.
    const parentBox = T(W, `__c.load(${J(MAP('Bob runs and nobody else runs', 'Only Bob runs'))});
        var tag = __c.tag('S'); if (!tag) return { tag: false };
        tag.click();
        var pop = __c.pop(); if (!pop) return { open: false, tag: tag.textContent };
        var radios = pop.querySelectorAll('.rc-row input');
        var usable = [].filter.call(radios, function (r) { return !r.disabled; }).length;
        radios[0].checked = true; radios[0].dispatchEvent(new Event('change', { bubbles: true }));
        pop.querySelector('.rc-apply').click();
        return { open: true, usable: usable, parent: findNodeContext(state.trees, 'M').node.texts[0] };`);
    ok(parentBox.open && parentBox.usable === 2 && parentBox.parent === 'Everything that runs is Bob',
        'the ambiguous box may be the one the step supports, and its words are rewritten there', J(parentBox));

    // 5. With the check on, a new empty box draws without error (r27.39: the
    // theorem-box check once read the kind of an empty box's null form).
    const empty = T(W, `__c.load(${J(MAP('Every raven is black if it sings.', 'Bob runs'))});
        try { selectedIds = ['S-0']; render(); addChild('support'); selectedIds = ['S-0']; render(); addChild('objection'); return { ok: true, n: findNodeContext(state.trees, 'S').node.children.length }; }
        catch (e) { return { ok: false, err: String(e && e.message || e) }; }`);
    ok(empty.ok && empty.n === 2, 'with the check on, new empty boxes draw without error', J(empty));

    // 6. Several questions (r27.121; the user, of the Extended Mind map: "it
    // seems impossible to fix it using the suggestions in the ?generic
    // window"). Step 4's three questions made the window taller than a laptop
    // screen, with no way to scroll to the last one; and each question's own
    // button wrote its one box and closed the window.
    const P1 = "The records in Otto's notebook play the same causal/explanatory role as non-occurrent beliefs within his brain.";
    const P2 = "Non-occurrent beliefs within a subject's brain are mental states of that subject.";
    const C = "The records in Otto's notebook play the same causal/explanatory role as mental states of Otto.";
    const several = T(W, `__c.load(${J([N('M', 'contention', [C], [N('S', 'support', [P1, P2])], { x: 30000, y: 30000 })])});
        __c.tag('S').click();
        var pop = __c.pop(), style = getComputedStyle(pop);
        var buttons = [].slice.call(pop.querySelectorAll('.rc-apply')).map(function (b) { var f = b.closest('.rc-foot');
            return { text: b.textContent, foot: !!f && getComputedStyle(f).position === 'sticky', off: b.disabled }; });
        var marked = [].slice.call(pop.querySelectorAll('.rc-row')).filter(function (r) { return r.querySelector('.rc-follows'); });
        marked.forEach(function (r) { var i = r.querySelector('input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
        var button = pop.querySelector('.rc-foot .rc-apply'), enabled = !button.disabled;
        button.click();
        var box = findNodeContext(state.trees, 'S').node.texts, parent = findNodeContext(state.trees, 'M').node.texts[0];
        var after = { tag: __c.tag('S') && __c.tag('S').textContent, open: !!__c.pop(), box: box.slice(), parent: parent };
        undo();
        var undone = findNodeContext(state.trees, 'S').node.texts.concat([findNodeContext(state.trees, 'M').node.texts[0]]);
        return { overflow: style.overflowY, maxHeight: style.maxHeight, buttons: buttons, marked: marked.length, enabled: enabled, after: after, undone: undone };`);
    ok(several.overflow === 'auto' && /calc\(100vh - 16px\)/.test(several.maxHeight || ''),
        'the window scrolls where it is taller than the screen', J([several.overflow, several.maxHeight]));
    ok(J(several.buttons) === J([{ text: 'Rewrite the boxes this way', foot: true, off: true }]),
        'three questions: one button, kept in view at the window\'s foot, for every box a reading is chosen for', J(several.buttons));
    ok(several.marked === 3 && several.enabled && !several.after.open && /existential syllogism/.test(several.after.tag || '') &&
        several.after.box[0] === "The records in Otto's notebook play the same causal/explanatory role as some non-occurrent beliefs within his brain." &&
        several.after.box[1] === "All non-occurrent beliefs within a subject's brain are mental states of that subject." &&
        several.after.parent === "The records in Otto's notebook play the same causal/explanatory role as some mental states of Otto.",
        'the three marked readings chosen and the button pressed once: the three boxes rewritten, and the step follows', J(several.after));
    ok(J(several.undone) === J([P1, P2, C]), 'one undo puts all three back', J(several.undone));
    const one = T(W, `__c.load(${J(MAP('Only Bob runs', 'Bob runs'))});
        __c.tag('S').click();
        return [].slice.call(__c.pop().querySelectorAll('.rc-apply')).map(function (b) { return b.textContent + (b.closest('.rc-foot') ? ' (foot)' : ''); });`);
    ok(J(one) === J(['Rewrite the box this way']), 'one question: its own button, as before', J(one));

    // 7. Walking on (r27.122; the user: "going with the recommended fixes
    // infected other nodes with '? generic'"; of three mockups, the window
    // that walks on, with notes of what comes next, and rows shortened).
    const U3 = 'Anything that plays the same causal/explanatory role as mental states of a subject is itself a mental state of that subject.';
    const RIF = "If the records in Otto's notebook cannot perform all the relevant functions of non-occurrent beliefs, then the records in Otto's notebook do not play the same causal/explanatory role as non-occurrent beliefs within Otto's brain.";
    const RP = "The records in Otto's notebook cannot perform all the relevant functions of non-occurrent beliefs.";
    const OTTO = [N('M', 'contention', ["The records in Otto's notebook are mental states of Otto."], [
        N('S3', 'support', [C, U3], [
            N('S4', 'support', [P1, P2], [N('R', 'rebuttal', [RIF, RP], [], { targetIndex: 0 })], { targetIndex: 0 })])], { x: 30000, y: 30000 })];
    T(W, `__c.load(${J(OTTO)}); __c.tag('S4').click(); return true;`);
    for (let i = 0; i < 100 && T(W, `return __c.pop() && __c.pop().dataset.notes;`) === 'pending'; i++) await sleep(50);
    const first = T(W, `var pop = __c.pop();
        var rows = [].slice.call(pop.querySelectorAll('.rc-row')).map(function (r) { return { shown: r.querySelector('span').firstChild.textContent, whole: r.title }; });
        var notes = [].slice.call(pop.querySelectorAll('.rc-note')).map(function (n) { return [n.previousElementSibling.title, n.textContent]; });
        return { rows: rows, notes: notes };`);
    ok(first.rows[0] && first.rows[0].shown === '…as some non-occurrent beliefs within his brain.' && first.rows[0].whole === P1.replace('as non-occurrent', 'as some non-occurrent') &&
        first.rows[3] && first.rows[3].shown === 'All non-occurrent beliefs within a subject\'s brain …',
        'a row shows what its reading changes, the box whole on hover', J(first.rows.slice(0, 4)));
    ok(J(first.notes) === J([
        [P1.replace('as non-occurrent', 'as some non-occurrent'), 'Another step uses this box. It will then ask for “If the records … as any non-occurrent beliefs within Otto\'s brain.”'],
        [C.replace('as mental', 'as some mental'), 'Another step uses this box. It will then ask for “Anything that plays … as some mental states of a subject …”.']]),
        'under a marked reading, what it sets off in another step that uses its box: the rebuttal will ask for "any", step 3\'s rule for "some"', J(first.notes));
    const walked = T(W, `var pop = __c.pop();
        [].slice.call(pop.querySelectorAll('.rc-row')).filter(function (r) { return r.querySelector('.rc-follows'); }).forEach(function (r) { var i = r.querySelector('input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
        pop.querySelector('.rc-foot .rc-apply').click();
        pop = __c.pop();
        return pop ? { done: (pop.querySelector('.rc-done') || {}).textContent, next: (pop.querySelector('.rc-next') || {}).textContent,
            heads: [].slice.call(pop.querySelectorAll('.rc-head')).map(function (h) { return h.textContent.split(' \\u2014 ')[0]; }) } : null;`);
    ok(walked && walked.done === '✓ The step follows by existential syllogism.' && walked.next === 'Other steps that use the boxes you changed now ask:' &&
        J(walked.heads) === J(['“' + U3 + '”', '“' + RIF + '”']),
        'rewritten, the window stays open: the step follows, and the two steps that use the boxes it changed now ask', J(walked));
    const end = T(W, `var pop = __c.pop();
        [].slice.call(pop.querySelectorAll('.rc-row')).filter(function (r) { return r.querySelector('.rc-follows'); }).forEach(function (r) { var i = r.querySelector('input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
        pop.querySelector('.rc-foot .rc-apply').click();
        return { open: !!__c.pop(), tags: collectDeductiveSteps(state.trees).map(function (s) { return deductiveStepTagText(s); }) };`);
    ok(!end.open && J(end.tags) === J(['✓ universal modus ponens', '✓ existential syllogism', '✓ modus ponens']),
        'answered too, nothing asks and the window closes: every step follows', J(end));
    // One question, its own button: on to the step that uses the box.
    const OTTO1 = JSON.parse(J(OTTO).split(J(P2).slice(1, -1)).join("All non-occurrent beliefs within a subject's brain are mental states of that subject.")
        .split(J(C).slice(1, -1)).join(C.replace('as mental', 'as some mental')).split(J(U3).slice(1, -1)).join(U3.replace('as mental', 'as some mental')));
    T(W, `__c.load(${J(OTTO1)}); __c.tag('S4').click(); return true;`);
    for (let i = 0; i < 100 && T(W, `return __c.pop() && __c.pop().dataset.notes;`) === 'pending'; i++) await sleep(50);
    const single = T(W, `var pop = __c.pop(), note = pop.querySelector('.rc-note'), ns = getComputedStyle(note);
        var dark = { color: ns.color, background: ns.backgroundColor };
        document.body.classList.add('bg-light'); ns = getComputedStyle(note); var light = { color: ns.color, background: ns.backgroundColor }; document.body.classList.remove('bg-light');
        var radio = [].slice.call(pop.querySelectorAll('.rc-row')).find(function (r) { return r.querySelector('.rc-follows'); }).querySelector('input');
        radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true }));
        var buttons = [].slice.call(pop.querySelectorAll('.rc-apply')).map(function (b) { return b.textContent; });
        pop.querySelector('.rc-apply').click();
        pop = __c.pop();
        var done = pop && pop.querySelector('.rc-done'), next = pop && pop.querySelector('.rc-next');
        var ds = done && getComputedStyle(done), xs = next && getComputedStyle(next);
        document.body.classList.add('bg-light'); var dl = done && getComputedStyle(done).color, xl = next && getComputedStyle(next).color; document.body.classList.remove('bg-light');
        return { buttons: buttons, dark: dark, light: light, done: done && done.textContent, next: next && next.textContent, heads: pop ? pop.querySelectorAll('.rc-head').length : 0,
            doneColor: [ds && ds.color, dl], nextStyle: [xs && xs.borderTopStyle, xs && xs.color, xl] };`);
    ok(J(single.buttons) === J(['Rewrite the box this way']) && single.done === '✓ The step follows by existential syllogism.' &&
        single.next === 'Another step that uses a box you changed now asks:' && single.heads === 1,
        'one question and its own button: rewritten, the window walks on to the rebuttal that denies the box', J(single));
    ok(single.dark.background !== 'rgba(0, 0, 0, 0)' && single.dark.color !== single.light.color && single.light.color === 'rgb(122, 83, 0)' &&
        single.doneColor[1] === 'rgb(0, 122, 0)' && single.nextStyle[0] === 'solid' && single.nextStyle[1] !== single.nextStyle[2],
        'notes, the line that the step follows, and the line before the other steps: styled, in the dark theme and the light', J([single.dark, single.light, single.doneColor, single.nextStyle]));
    const short = T(W, `return [claimReadingShort('Even if Mary runs, Bob runs.', 'Bob runs, and if Mary runs, then Bob runs.'), claimReadingShort('Only Bob runs', 'Everything that runs is Bob')];`);
    ok(J(short) === J(['Bob runs, and if Mary runs, then Bob runs.', 'Everything that runs is Bob']), 'a row is whole where little would be left out', J(short));

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
