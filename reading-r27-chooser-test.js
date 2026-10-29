'use strict';
// r27.39 The reading chooser.
//
// A step whose box is ambiguous ("Only Bob runs", "Even if Mary runs, Bob
// runs", "All ravens are not white") is tagged "? ambiguous". Clicking the tag
// opens a popover with the box's readings -- since r27.166 under "Did you
// mean:", and none said to be the one the step would follow on (the user:
// "might steer less discerning individuals in the wrong direction"); only
// readings the checker reads back as themselves are offered, and the
// popover opens only where there are two. Choosing one and pressing
// "Rewrite the box this way"
// replaces the box's words with that reading, written out -- so the map says
// what it means -- and undo restores what it said before. A reading the
// checker would not read back as itself cannot be written in; a read-only map
// shows the readings but writes nothing; any other tag still opens the list of
// every step. With several questions (r27.121), the window scrolls where it
// is taller than the screen, and one button rewrites every box a reading is
// chosen for. A row shows what its reading changes, the box whole on hover;
// and once boxes are rewritten, the window stays open on the steps that use
// them and now ask (r27.122), first saying that the step now follows.
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
    ok(opened.head === 'Did you mean:', 'which asks "Did you mean:" (r27.166; the user: "Did you mean: - \'…\' - \'…\'")', opened.head);
    ok(J(opened.rows) === J(['Everything that runs is Bob', 'Bob runs, and everything that runs is Bob']),
        'and lists both readings, written out -- neither said to be the one the step needs', J(opened.rows));
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
        even.rows[0].t === 'Bob runs, and if Mary runs, then Bob runs.' && even.rows[1].t === 'If Mary runs, then Bob runs.',
        '"even if" offers both readings, written out with the box\'s full stop', J(even.rows));
    ok(even.text === 'Bob runs, and if Mary runs, then Bob runs.', 'and writes the concessive one in', even.text);
    const all = T(W, `__c.load(${J(MAP('All ravens are not white', 'No raven is white'))});
        __c.tag('S').click();
        return [].slice.call(__c.pop().querySelectorAll('.rc-row')).map(function (r) { return { t: r.textContent.replace(/\\s+/g, ' ').trim(), off: r.querySelector('input').disabled }; });`);
    ok(Array.isArray(all) && all.length === 2 && all.every(r => !r.off) && /^No ravens are white/.test(all[0].t),
        'an older ambiguity ("all ravens are not white") is offered the same way', J(all));
    // r27.124: the verb's own "not" taken out, not the one in the kind ("that
    // is not black"), which had made the first reading another claim; and
    // "whatever" said of none.
    const glitters = ['Everything that is not black is not a raven.', 'Whatever is not black is not a raven.'].map(c => T(W, `__c.load(${J(MAP('All ravens are black.', c))});
        __c.tag('S').click();
        var rows = [].slice.call(__c.pop().querySelectorAll('.rc-row')).map(function (r) { return { t: r.textContent.replace(/\\s+/g, ' ').trim(), off: r.querySelector('input').disabled }; });
        var radios = __c.pop().querySelectorAll('.rc-row input');
        radios[0].checked = true; radios[0].dispatchEvent(new Event('change', { bubbles: true }));
        __c.pop().querySelector('.rc-apply').click();
        return { rows: rows, parent: findNodeContext(state.trees, 'M').node.texts[0], tag: __c.tag('S') && __c.tag('S').textContent };`));
    ok(J(glitters.map(g => g.rows.map(r => r.t))) === J([
            ['Nothing that is not black is a raven.', 'Not everything that is not black is a raven.'],
            ['Nothing that is not black is a raven.', 'It is not the case that whatever is not black is a raven.']]) &&
        glitters.every(g => g.rows.every(r => !r.off) && g.parent === 'Nothing that is not black is a raven.' && /contraposition/.test(g.tag || '')),
        '"everything that is not black is not a raven": "nothing that is not black is a raven" or "not everything ...", each one written in -- "whatever" too', J(glitters));

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
        var marked = [].slice.call(pop.querySelectorAll('.rc-row')).filter(function (r) { return /follows/.test(r.textContent); });
        var want = ${J([P1.replace('as non-occurrent', 'as some non-occurrent'), 'All ' + P2.charAt(0).toLowerCase() + P2.slice(1), C.replace('as mental', 'as some mental')])};
        var picked = [].slice.call(pop.querySelectorAll('.rc-row')).filter(function (r) { return want.indexOf(r.title) >= 0; });
        picked.forEach(function (r) { var i = r.querySelector('input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
        var button = pop.querySelector('.rc-foot .rc-apply'), enabled = !button.disabled;
        button.click();
        var box = findNodeContext(state.trees, 'S').node.texts, parent = findNodeContext(state.trees, 'M').node.texts[0];
        var after = { tag: __c.tag('S') && __c.tag('S').textContent, open: !!__c.pop(), box: box.slice(), parent: parent };
        undo();
        var undone = findNodeContext(state.trees, 'S').node.texts.concat([findNodeContext(state.trees, 'M').node.texts[0]]);
        return { overflow: style.overflowY, maxHeight: style.maxHeight, buttons: buttons, marked: marked.length, picked: picked.length, enabled: enabled, after: after, undone: undone };`);
    ok(several.overflow === 'auto' && /calc\(100vh - 16px\)/.test(several.maxHeight || ''),
        'the window scrolls where it is taller than the screen', J([several.overflow, several.maxHeight]));
    ok(J(several.buttons) === J([{ text: 'Rewrite the boxes this way', foot: true, off: true }]),
        'three questions: one button, kept in view at the window\'s foot, for every box a reading is chosen for', J(several.buttons));
    ok(several.marked === 0 && several.picked === 3 && several.enabled && !several.after.open && /existential syllogism/.test(several.after.tag || '') &&
        several.after.box[0] === "The records in Otto's notebook play the same causal/explanatory role as some non-occurrent beliefs within his brain." &&
        several.after.box[1] === "All non-occurrent beliefs within a subject's brain are mental states of that subject." &&
        several.after.parent === "The records in Otto's notebook play the same causal/explanatory role as some mental states of Otto.",
        'no reading marked (r27.166); the three that give the step chosen and the button pressed once: the three boxes rewritten, and the step follows', J(several.after));
    ok(J(several.undone) === J([P1, P2, C]), 'one undo puts all three back', J(several.undone));
    const one = T(W, `__c.load(${J(MAP('Only Bob runs', 'Bob runs'))});
        __c.tag('S').click();
        return [].slice.call(__c.pop().querySelectorAll('.rc-apply')).map(function (b) { return b.textContent + (b.closest('.rc-foot') ? ' (foot)' : ''); });`);
    ok(J(one) === J(['Rewrite the box this way']), 'one question: its own button, as before', J(one));

    // 7. Walking on (r27.122; the user: "going with the recommended fixes
    // infected other nodes with '? generic'"; of three mockups, the window
    // that walks on, with notes of what comes next, and rows shortened). The
    // notes, under the reading the step followed on, of what it would set off
    // in other steps, are gone with the marks (r27.166): what is meant comes
    // first, and the walk on shows what it set off.
    const choose = list => `var pop = __c.pop(), want = ${J(list)};
        [].slice.call(pop.querySelectorAll('.rc-row')).filter(function (r) { return want.indexOf(r.title) >= 0; }).forEach(function (r) { var i = r.querySelector('input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });`;
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
    ok(!first.notes.length, 'no notes, before a reading is chosen, of what it would set off in other steps', J(first.notes));
    const walked = T(W, choose([P1.replace('as non-occurrent', 'as some non-occurrent'), 'All ' + P2.charAt(0).toLowerCase() + P2.slice(1), C.replace('as mental', 'as some mental')]) + `
        pop.querySelector('.rc-foot .rc-apply').click();
        pop = __c.pop();
        return pop ? { done: (pop.querySelector('.rc-done') || {}).textContent, next: (pop.querySelector('.rc-next') || {}).textContent,
            heads: [].slice.call(pop.querySelectorAll('.rc-head')).map(function (h) { return h.textContent.split(' \\u2014 ')[0]; }) } : null;`);
    ok(walked && walked.done === '✓ The step follows by existential syllogism.' && walked.next === 'Other steps that use the boxes you changed now ask:' &&
        J(walked.heads) === J(['“' + U3 + '”', '“' + RIF + '”']),
        'rewritten, the window stays open: the step follows, and the two steps that use the boxes it changed now ask', J(walked));
    const end = T(W, choose([U3.replace('as mental', 'as some mental'), RIF.replace('as non-occurrent beliefs within', 'as any non-occurrent beliefs within')]) + `
        pop.querySelector('.rc-foot .rc-apply').click();
        return { open: !!__c.pop(), tags: collectDeductiveSteps(state.trees).map(function (s) { return deductiveStepTagText(s); }) };`);
    ok(!end.open && J(end.tags) === J(['✓ universal modus ponens', '✓ existential syllogism', '✓ modus ponens']),
        'answered too, nothing asks and the window closes: every step follows', J(end));
    // One question, its own button: on to the step that uses the box.
    const OTTO1 = JSON.parse(J(OTTO).split(J(P2).slice(1, -1)).join("All non-occurrent beliefs within a subject's brain are mental states of that subject.")
        .split(J(C).slice(1, -1)).join(C.replace('as mental', 'as some mental')).split(J(U3).slice(1, -1)).join(U3.replace('as mental', 'as some mental')));
    T(W, `__c.load(${J(OTTO1)}); __c.tag('S4').click(); return true;`);
    for (let i = 0; i < 100 && T(W, `return __c.pop() && __c.pop().dataset.notes;`) === 'pending'; i++) await sleep(50);
    const single = T(W, choose([P1.replace('as non-occurrent', 'as some non-occurrent')]) + `
        var notes = pop.querySelectorAll('.rc-note').length;
        var buttons = [].slice.call(pop.querySelectorAll('.rc-apply')).map(function (b) { return b.textContent; });
        pop.querySelector('.rc-apply').click();
        pop = __c.pop();
        var done = pop && pop.querySelector('.rc-done'), next = pop && pop.querySelector('.rc-next');
        var ds = done && getComputedStyle(done), xs = next && getComputedStyle(next);
        document.body.classList.add('bg-light'); var dl = done && getComputedStyle(done).color, xl = next && getComputedStyle(next).color; document.body.classList.remove('bg-light');
        return { buttons: buttons, notes: notes, done: done && done.textContent, next: next && next.textContent, heads: pop ? pop.querySelectorAll('.rc-head').length : 0,
            doneColor: [ds && ds.color, dl], nextStyle: [xs && xs.borderTopStyle, xs && xs.color, xl] };`);
    ok(J(single.buttons) === J(['Rewrite the box this way']) && single.done === '✓ The step follows by existential syllogism.' &&
        single.next === 'Another step that uses a box you changed now asks:' && single.heads === 1,
        'one question and its own button: rewritten, the window walks on to the rebuttal that denies the box', J(single));
    ok(single.notes === 0 && single.doneColor[1] === 'rgb(0, 122, 0)' && single.nextStyle[0] === 'solid' && single.nextStyle[1] !== single.nextStyle[2],
        'no notes before the choice; the line that the step follows, and the line before the other steps: styled, in the dark theme and the light', J([single.notes, single.doneColor, single.nextStyle]));
    const short = T(W, `return [claimReadingShort('Even if Mary runs, Bob runs.', 'Bob runs, and if Mary runs, then Bob runs.'), claimReadingShort('Only Bob runs', 'Everything that runs is Bob')];`);
    ok(J(short) === J(['Bob runs, and if Mary runs, then Bob runs.', 'Everything that runs is Bob']), 'a row is whole where little would be left out', J(short));

    // 8. Only readings that read back (r27.166; the user: "The available
    // disambiguations must be grammatical ... A syntax checker could make sure
    // bad disambiguations don't go through and that the user is notified only
    // when two valid disambiguations are available"). A question is asked
    // only where each of its readings can be written in words the check reads
    // back as that reading: one left out may be the one meant.
    const asked = (premise, conclusion) => T(W, `__c.load(${J(MAP(premise, conclusion))});
        var tag = __c.tag('S'), t = { tag: tag.textContent, title: tag.title };
        tag.click();
        var pop = __c.pop(), list = document.getElementById('logic-modal-backdrop').classList.contains('open');
        document.getElementById('logic-modal-backdrop').classList.remove('open');
        t.chooser = !!pop; t.list = list;
        t.rows = pop ? [].slice.call(pop.querySelectorAll('.rc-row')).map(function (r) { return r.title; }) : [];
        t.unfit = pop ? pop.querySelectorAll('.rc-unfit').length : 0;
        closeReadingChooser();
        return t;`);
    const weather = asked('If the street is wet and the sky is grey, then it is cold.', 'It is cold.');
    ok(weather.tag === '? ambiguous' && !weather.chooser && weather.list &&
        weather.title.indexOf('“If the street is wet and the sky is grey, then it is cold.” is ambiguous: “it” may be “the street” or “the sky”, or the weather.') >= 0,
        'a question one of whose readings does not read back is not asked -- "it is cold if the street is wet and the sky is grey" asks what the "if" takes in -- the box is said to be ambiguous, and the tag opens the list', J(weather));
    const pianist = asked('Poe is a good pianist.', 'Poe is good.');
    ok(pianist.tag === '? ambiguous' && !pianist.chooser && !/A pianist that is good/.test(pianist.title) &&
        /“Poe is a good pianist\.” is ambiguous: a good pianist is a pianist, but need not be good, only good for a pianist\./.test(pianist.title),
        'a lone reading that is no sentence ("A pianist that is good") is not offered: the box is said to be ambiguous', J(pianist));
    const longer = asked('Ravens fly and crows sing.', 'Some raven flies.');
    ok(longer.tag === '? generic' && longer.chooser && !longer.unfit &&
        J(longer.rows) === J(['All ravens fly and crows sing.', 'Some ravens fly and crows sing.', 'Most ravens fly and crows sing.', 'Ravens generally fly and crows sing.']),
        'a generic inside a longer box: its four readings, each in place -- "in general" too, as "ravens generally fly" -- and each can be chosen', J(longer));
    const general = T(W, `return [['Ravens generally fly.', 'Generally, ravens fly.'], ['A raven generally flies.', 'Generally, a raven flies.']].map(function (p) {
        var a = parseClaimFull(p[0]), b = parseClaimFull(p[1]);
        return claimKey(a.form) === claimKey(b.form) && JSON.stringify(a.notes.map(function (n) { return n.message; })) === JSON.stringify(b.notes.map(function (n) { return n.message; })); });`);
    ok(J(general) === J([true, true]), '"ravens generally fly" says what "generally, ravens fly" says, and asks nothing more; so "a raven generally flies"', J(general));
    const written = T(W, `__c.load(${J(MAP('Ravens fly and crows sing.', 'Some raven flies.'))});
        __c.tag('S').click();
        var pop = __c.pop(), rows = [].slice.call(pop.querySelectorAll('.rc-row'));
        var pick = function (k) { var i = rows[k].querySelector('input'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); };
        pick(3); pop.querySelector('.rc-apply').click();
        var general = { box: __c.text('S'), tag: __c.tag('S').textContent };
        undo(); closeReadingChooser();
        __c.tag('S').click(); pop = __c.pop(); rows = [].slice.call(pop.querySelectorAll('.rc-row'));
        pick(1); pop.querySelector('.rc-apply').click();
        return { general: general, some: { box: __c.text('S'), tag: __c.tag('S').textContent } };`);
    ok(!!written.general && written.general.box === 'Ravens generally fly and crows sing.' && written.general.tag === '? not recognized' &&
        !!written.some && written.some.box === 'Some ravens fly and crows sing.' && written.some.tag === '✓ conjunction elimination',
        'written in: "ravens generally fly" is one claim, and the step is not recognized; "some ravens fly", it follows by conjunction elimination', J(written));
    const back = T(W, `var t = 'If computer programs are only formal (syntactic), then computers lack semantics.';
        var n = parseClaimFull(t).notes.filter(function (x) { return x.generic; })[0];
        return claimReadingRoundTrips(Object.assign({ text: t }, n), 0, 'If all computer programs are only formal (syntactic), then computers lack semantics.');`);
    ok(back === true, 'a note of one reading that a rewrite raises ("computer program" read as one phrase) asks nothing, and does not stop the rewrite reading back', J(back));

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
