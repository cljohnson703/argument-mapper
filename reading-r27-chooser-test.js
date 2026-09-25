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
// every step.
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

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
