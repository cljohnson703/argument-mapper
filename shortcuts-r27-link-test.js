'use strict';
/**
 * Keys for linking (r27.102; the user, 2026-10-14: "A keyboard shortcut for
 * premise linking would be useful. Maybe one for cross-referencing as well";
 * r27.103 tried Shift+L; r27.104, back to Ctrl+K: "It should be Ctrl +
 * whatever is most intuitive and available").
 *
 *   node shortcuts-r27-link-test.js [argument-mapper-r27.html]
 *
 * 1. Ctrl+K, as Word's: while typing in a box, a premise linked at the caret;
 *    with a box selected, linked into it where its caret was when it was last
 *    edited, if its words are as they were, else after them -- as Link a
 *    Premise on its menu does. The box to link is clicked next. Shift+L, as
 *    L, is Labels again.
 * 2. Shift+R, with a box selected: cross-reference it -- the box it points
 *    to is clicked next, as from its menu. R alone is still Rebuttal.
 * 3. Help lists both, and the menu items say their keys.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/shortcuts-link-test', virtualConsole: vc,
    beforeParse(w) {
        const { webcrypto } = require('crypto');
        if (!w.crypto || !w.crypto.randomUUID) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
        w.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
        w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        const ctx = new Proxy({}, { get: (_, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
        w.indexedDB = { open() { const r = {}; setTimeout(() => r.onerror && r.onerror({ target: { error: new Error('x') } }), 0); return r; },
            deleteDatabase() { const r = {}; setTimeout(() => r.onsuccess && r.onsuccess({}), 0); return r; } };
        w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
        w.cancelAnimationFrame = w.clearTimeout;
        w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true; w.prompt = () => null; w.open = () => null;
    }
});
const W = dom.window, J = JSON.stringify;
const ev = src => JSON.parse(W.eval('JSON.stringify((function(){' + src + '})())'));
let passed = 0, failed = 0;
function ok(cond, label, detail) {
    if (cond) { passed++; console.log('  ✓ ' + label); }
    else { failed++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}
const MAP = `state.trees = [{ id: 'M', type: 'contention', texts: ['Socrates is mortal.'], collapsed: [], x: 0, y: 0, children: [
    { id: 'A', type: 'support', texts: ['All men are mortal.', 'Socrates is a man.'], collapsed: [], children: [] } ] },
    { id: 'R', type: 'contention', texts: ['Men die.'], collapsed: [], x: 900, y: 0, children: [] }];
    ensureCollabFields(state); undoStack.length = 0; cancelBoxLinkPicking(false); cancelCrossRefPicking();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    selectedIds = []; render();
    var hint = document.getElementById('onetime-hint'); if (hint) hint.textContent = '';`;
const key = (code, k, opts) => `(document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown',
    Object.assign({ code: '${code}', key: '${k}', bubbles: true, cancelable: true }, ${J(opts || {})})));`;
const toast = `(document.getElementById('onetime-hint') || {}).textContent || ''`;

console.log('\n-- 1. Ctrl+K: link a premise --');
{
    const ctrlK = `new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', ctrlKey: true, bubbles: true, cancelable: true })`;
    // While typing: at the caret.
    const r = ev(`${MAP}
        editNodeText('A', 1);
        var ed = document.activeElement, open = !!(ed && ed.closest && ed.closest('.node[data-node-id="A"]'));
        ed.value = 'Socrates is a man, as '; ed.dispatchEvent(new Event('input', { bubbles: true }));
        ed.setSelectionRange(ed.value.length, ed.value.length);
        var caret = ed.selectionStart, e = ${ctrlK};
        ed.dispatchEvent(e);
        var armed = boxLinkPicking ? { id: boxLinkPicking.sourceId, idx: boxLinkPicking.sourceIdx, start: boxLinkPicking.start, end: boxLinkPicking.end } : null;
        var shown = document.getElementById('crossref-hint').classList.contains('visible');
        completeBoxLinkPicking('R', 0);
        return { open: open, caret: caret, armed: armed, shown: shown, prevented: e.defaultPrevented, text: findNodeContext(state.trees, 'A').node.texts[1], picking: !!boxLinkPicking };`);
    ok(r.open && r.armed && r.armed.id === 'A' && r.armed.idx === 1 && r.armed.start === r.caret && r.armed.end === r.caret && r.shown && r.prevented,
        'Ctrl+K in a box being edited asks for the box to link, at the caret (and not the browser\'s Ctrl+K)', J(r));
    ok(/^Socrates is a man, as \[M\d+\]\(#box:R\)$/.test(r.text) && !r.picking, 'the box clicked next is linked there', J(r.text));
    // With a box selected: where its caret was when typing in it was finished.
    const sel = ev(`${MAP}
        editNodeText('A', 1);
        var ed = document.activeElement;
        ed.value = 'Socrates is a man, as  shows.'; ed.dispatchEvent(new Event('input', { bubbles: true }));
        ed.setSelectionRange(22, 22);
        ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
        var closed = document.activeElement !== ed;
        selectedIds = ['A-1']; updateSelectionVisuals();
        document.body.dispatchEvent(${ctrlK});
        var armed = boxLinkPicking ? { id: boxLinkPicking.sourceId, idx: boxLinkPicking.sourceIdx, start: boxLinkPicking.start, end: boxLinkPicking.end } : null;
        completeBoxLinkPicking('R', 0);
        return { closed: closed, armed: armed, text: findNodeContext(state.trees, 'A').node.texts[1] };`);
    ok(sel.closed && sel.armed && sel.armed.id === 'A' && sel.armed.idx === 1 && sel.armed.start === 22 && sel.armed.end === 22 &&
        /^Socrates is a man, as \[M\d+\]\(#box:R\) shows\.$/.test(sel.text),
        'with a box selected, into it, where its caret was when typing in it was finished', J(sel));
    const at = (box) => ev(`${MAP} selectedIds = ['${box}']; updateSelectionVisuals();
        document.body.dispatchEvent(${ctrlK});
        var t = findNodeContext(state.trees, 'A').node.texts[${box === 'A-0' ? 0 : 1}];
        return boxLinkPicking ? { start: boxLinkPicking.start, end: boxLinkPicking.end, length: t.length } : null;`);
    const fresh = at('A-0'), changed = at('A-1');
    ok(fresh && fresh.start === fresh.length && fresh.end === fresh.length, 'a box not edited: after its words', J(fresh));
    ok(changed && changed.start === changed.length && changed.end === changed.length, 'a box whose words have changed since: after them too', J(changed));
    const none = ev(`${MAP} var e = ${ctrlK}; document.body.dispatchEvent(e);
        return { picking: !!boxLinkPicking, toast: ${toast}, prevented: e.defaultPrevented };`);
    ok(!none.picking && none.toast === 'Select a box, or type in one, then press Ctrl+K to link a premise.' && none.prevented,
        'with nothing selected, it says what to do', J(none));
    const shiftL = ev(`${MAP} selectedIds = ['A-0']; updateSelectionVisuals(); var calls = 0, was = cycleLabels;
        cycleLabels = function () { calls++; };
        try { ${key('KeyL', 'L', { shiftKey: true })} ${key('KeyL', 'l')} } finally { cycleLabels = was; }
        return { picking: !!boxLinkPicking, calls: calls };`);
    ok(!shiftL.picking && shiftL.calls === 2, 'Shift+L, as L, is Labels again', J(shiftL));
}

console.log('\n-- 2. Shift+R: cross-reference the selected box --');
{
    const r = ev(`${MAP} selectedIds = ['R-0']; render();
        ${key('KeyR', 'R', { shiftKey: true })}
        var armed = crossRefPicking ? { id: crossRefPicking.sourceId, idx: crossRefPicking.sourceIdx } : null;
        var type = findNodeContext(state.trees, 'R').node.type;
        completeCrossRefPicking('A', 1);
        return { armed: armed, type: type, refs: findNodeContext(state.trees, 'R').node.crossRefs, picking: !!crossRefPicking };`);
    ok(r.armed && r.armed.id === 'R' && r.armed.idx === 0 && r.type === 'contention',
        'Shift+R with a box selected asks for the box it refers to (and changes nothing about it)', J(r));
    ok(J(r.refs) === J([[{ targetId: 'A', targetIdx: 1 }]]) && !r.picking, 'the box clicked next is its cross-reference', J(r.refs));
    const second = ev(`${MAP} selectedIds = ['A-1']; render();
        ${key('KeyR', 'R', { shiftKey: true })}
        return crossRefPicking ? { id: crossRefPicking.sourceId, idx: crossRefPicking.sourceIdx } : null;`);
    ok(second && second.id === 'A' && second.idx === 1, 'for a co-premise, its own box', J(second));
    const none = ev(`${MAP} ${key('KeyR', 'R', { shiftKey: true })}
        return { picking: !!crossRefPicking, toast: ${toast} };`);
    ok(!none.picking && none.toast === 'Select a box, then press Shift+R to cross-reference it.', 'with nothing selected, it says what to do', J(none));
    const plain = ev(`${MAP} selectedIds = ['R-0']; render(); var calls = [], was = changeSelectedTypes;
        changeSelectedTypes = function (t) { calls.push(t); };
        try { ${key('KeyR', 'r')} } finally { changeSelectedTypes = was; }
        return { picking: !!crossRefPicking, calls: calls };`);
    ok(!plain.picking && J(plain.calls) === J(['rebuttal']), 'R alone is still Rebuttal', J(plain));
}

console.log('\n-- 3. said in Help and on the menus --');
{
    const help = ev(`var rows = Array.from(document.querySelectorAll('#help-panel tr, .help-shortcuts tr, table tr')).map(function (tr) { return tr.textContent.replace(/\\s+/g, ' ').trim(); });
        return rows.filter(function (t) { return /Link a premise/.test(t); });`);
    ok(help.length === 1 && /Link a premise \/ cross-reference the box\s*Ctrl\+K \/ Shift\+R/.test(help[0]), 'Help lists Ctrl+K and Shift+R', J(help));
    ok(/title="Link this box to a premise elsewhere in the map \(Shift\+R\)"/.test(HTML), 'the box menu\'s Add Cross-Reference names Shift+R');
    ok(/title="Link to another premise in this box's text \(Ctrl\+K\)" onclick="ctxAction\(\(\)=>linkPremiseInto\(/.test(HTML) &&
        (HTML.match(/function linkPremiseInto\(/g) || []).length === 1,
        'and its Link a Premise names Ctrl+K, which does what it does', J((HTML.match(/function linkPremiseInto\(/g) || []).length));
    ok(/boxBtn\.title = 'Click a box to link to it here \(Ctrl\+K\)';/.test(HTML) && !/Shift\+L(?! =)/.test(HTML.replace(/Ctrl\+Shift\+L/g, '')),
        'the typing menu\'s Link a premise names Ctrl+K too; Shift+L names nothing');
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
