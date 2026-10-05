'use strict';
// r27.74 (the user, 2026-10-05): "I'd like a way to have rich text and premise
// links to convert from their syntax once completed stay converted when
// editing, but once you start to delete them, you merely start deleting
// elements of the syntax. That is, I'd like their behavior to be more like it
// is in Word." Chosen with the user, and tried first as a prototype: a link
// or formula is selected by the first Backspace and deleted by the second; a
// formula opens on a double-click; Ctrl+B, Ctrl+I, Ctrl+U format. Then:
// "Everything looks good. Build it into the app."
//
// (1) The renderer's `annotate` option says what each piece was written as;
//     without it the HTML is exactly as before.
// (2) A box opens as it shows (links and formulas one piece, formatting
//     applied); opened and closed unchanged, it keeps its words exactly and
//     adds no undo step.
// (3) What is typed converts once finished (the next character typed);
//     ** waits for its second *; Ctrl+Z right after keeps the marks as typed.
// (4) Backspace next to a link selects it, a second deletes it; Delete the
//     same forward; Ctrl+Z brings it back. Letters of formatted words go one
//     at a time, the rest keeping its formatting.
// (5) Ctrl+B, Ctrl+I, Ctrl+U on a selection or the word at the cursor.
// (6) A new line converts what was finished and ends formatting.
// (7) A formula opens on a double-click and shows again after.
// (8) Paste converts; copy gives plain words and the marks.
// (9) Closing converts what was finished, and keeps text the renderer shows
//     exactly as the editor did -- over many random formatting edits too.
// (10) Esc puts the words back; the editor's selection reads as offsets into
//      the text; a premise link put in from the menu lands at the cursor.
// (11) Rich text off: only links convert.
// (12) While a box is open, single-key shortcuts type, not act.
//
// Then (r27.75, the user): "I also need to add the B, U, and I for Bold,
// Italic, and Underline to the right-click / long-press context menu." And:
// "B, I, U should affect all of the text in a node when the context menu is
// opened for the entire node. Also, we should probably add those to
// formatting in the left panel."
//
// (13) B, I and U: in an open box's menu, on its selection (pressed when it
//      has them); in a box's menu, under Formatting, and as Ctrl+B, Ctrl+I,
//      Ctrl+U with boxes selected, on all of each selected box -- on unless
//      every word has it, then off; one undo step; links and formulas kept;
//      a box kept as typed is formatted as it shows; not with Rich text off.
//
// Typing is simulated (jsdom has no editing): each character is put in at the
// cursor and announced with the input events a browser sends.
//
// Run:  node editor-r27-wysiwyg-test.js [argument-mapper-r27.html]
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

// In the page: open a box, type, press keys, as a browser would.
const HELPERS = `
window.__box = (id, idx) => document.querySelector('.node[data-node-id="' + id + '"][data-node-idx="' + (idx || 0) + '"]');
window.__open = (id, idx) => { const host = __box(id, idx); enterEditMode(host); return host.querySelector('.box-editor'); };
window.__type = (ed, text) => {
    for (const ch of text) {
        const sel = getSelection();
        if (ch === '\\n') { ed.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertLineBreak', bubbles: true, cancelable: true })); continue; }
        const before = new InputEvent('beforeinput', { inputType: 'insertText', data: ch, bubbles: true, cancelable: true });
        ed.dispatchEvent(before);
        const r = sel.getRangeAt(0);
        if (!r.collapsed) r.deleteContents();
        let node = r.startContainer, off = r.startOffset;
        if (node.nodeType !== 3) {
            const prev = node.childNodes[off - 1];
            if (prev && prev.nodeType === 3) { node = prev; off = prev.data.length; }
            else { const t = document.createTextNode(''); node.insertBefore(t, node.childNodes[off] || null); node = t; off = 0; }
        }
        node.insertData(off, ch);
        const r2 = document.createRange(); r2.setStart(node, off + 1); r2.collapse(true);
        sel.removeAllRanges(); sel.addRange(r2);
        ed.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: ch, bubbles: true }));
    }
};
window.__key = (ed, key, mods) => {
    const ev = new KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, mods || {}));
    ed.dispatchEvent(ev);
    return ev.defaultPrevented;
};
window.__backspace = (ed) => {
    if (__key(ed, 'Backspace')) return 'handled';
    const sel = getSelection(), r = sel.getRangeAt(0);
    if (!r.collapsed) r.deleteContents();
    else { const n = r.startContainer, o = r.startOffset; if (n.nodeType === 3 && o > 0) { n.deleteData(o - 1, 1); const r2 = document.createRange(); r2.setStart(n, o - 1); r2.collapse(true); sel.removeAllRanges(); sel.addRange(r2); } }
    ed.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
    return 'native';
};
window.__units = (ed) => boxEditor._internals.getOffsets(ed);
window.__caret = (ed, u, v) => boxEditor._internals.setOffsets(ed, u, v === undefined ? u : v);
window.__end = (ed) => { const n = boxEditor._internals.countUnits(ed); __caret(ed, n); };
window.__shape = (ed) => Array.from(ed.childNodes).map(n => n.nodeType === 3 ? JSON.stringify(n.data) : n.className ? n.tagName.toLowerCase() + '.' + n.className.split(' ').join('.') + '(' + n.textContent + ')' : n.tagName.toLowerCase() + '[' + (n.dataset.md || '') + '](' + n.textContent + ')').join(' ');
`;

const MAP = [
    { id: 'mmmmmmmm-0000-4000-8000-000000000000', type: 'contention', texts: ['Poe is black.'], collapsed: [], x: 30000, y: 30000, children: [
        { id: 'ssssssss-0000-4000-8000-000000000000', type: 'support', texts: ['If [S2](#box:tttttttt) then **Poe** is *black*, $x^2$.'], collapsed: [], children: [] },
        { id: 'tttttttt-0000-4000-8000-000000000000', type: 'support', texts: ['Poe is a raven.'], collapsed: [], children: [] }
    ] }
];
const S = 'ssssssss-0000-4000-8000-000000000000', T = 'tttttttt-0000-4000-8000-000000000000', M = 'mmmmmmmm-0000-4000-8000-000000000000';

(async () => {
    console.log('=== r27.74-r27.75 the box editor: Word-style editing of formatting, premise links and formulas; B, I, U ===');
    const W = makeWin('editor');
    await sleep(300);
    const run = js => W.win.eval(js);
    const val = js => JSON.parse(run('JSON.stringify(' + js + ')'));
    const load = (rich) => run(`(function () {
        state.trees = ${J(MAP)}; ensureCollabFields(state); richTextEnabled = ${rich ? 'true' : 'false'};
        render(); return true; })()`);
    run(HELPERS);

    console.log('\n-- (1) the renderer --');
    {
        const sample = '**a** *b* _c_ __d__ ~~e~~ ==f== `g` [h](https://x.y) z.com $m$ \\alpha !*n* \\*o [S2](#box:tttttttt)\nnext';
        load(true);
        const plain = val(`renderRichText(${J(sample)})`);
        const same = val(`renderRichText(${J(sample)}, { annotate: false })`);
        const ann = val(`renderRichText(${J(sample)}, { annotate: true })`);
        ok(plain === same && !/data-md|md-math|md-lit/.test(plain), 'without `annotate` the HTML is as before: no data-md, md-math or md-lit', plain.slice(0, 120));
        ok(['data-md="**"', 'data-md="*"', 'data-md="_"', 'data-md="__"', 'data-md="~~"', 'data-md="=="', 'data-md="`"', 'data-md="link"', 'data-md="url"'].every(x => ann.includes(x)),
            'with it, each piece says what it was written as (**, *, _, __, ~~, ==, `, a link, a bare address)');
        ok(/class="md-math" data-src="\$m\$"/.test(ann) && /class="md-math" data-src="\\alpha"/.test(ann) && /class="md-lit" data-src="!\*n\*"/.test(ann) && /class="md-lit" data-src="\\\*"/.test(ann),
            'formulas keep their source, and what an escape kept as typed keeps its escape (! or \\)', ann.slice(0, 200));
    }

    console.log('\n-- (2) opening and closing --');
    {
        load(true);
        const shown = val(`(function () { const ed = __open('${S}'); return { shape: __shape(ed), value: ed.value, ro: ed.readOnly, active: document.activeElement === ed, caret: __units(ed) }; })()`);
        ok(/span\.ed-chip\.ed-box\(S2\)/.test(shown.shape) && /strong\[\*\*\]\(Poe\)/.test(shown.shape) && /em\[\*\]\(black\)/.test(shown.shape) && /span\.ed-chip\.ed-math/.test(shown.shape),
            'a box opens as it shows: the link one piece (S2), Poe bold, black italic, the formula one piece', shown.shape);
        ok(shown.value === MAP[0].children[0].texts[0] && shown.ro === false && shown.active, 'its value is its words exactly, it is open and has the focus', J(shown));
        const closed = val(`(function () { const depth = undoStack.length; const ed = __box('${S}').querySelector('.box-editor'); ed.blur();
            return { text: findNodeContext(state.trees, '${S}').node.texts[0], depth: undoStack.length - depth, ro: ed.readOnly, shown: ed.style.display, view: __box('${S}').querySelector('.rendered-text').style.display }; })()`);
        ok(closed.text === MAP[0].children[0].texts[0] && closed.depth === 0 && closed.ro && closed.shown === 'none' && closed.view === '',
            'closed unchanged, it keeps its words exactly and adds no undo step', J(closed));
        // Opened by a click or a tap, the cursor goes where it landed (jsdom has
        // no layout: the browser's point-to-position is stood in for).
        const at = val(`(function () {
            const host = __box('${S}'), out = {};
            document.caretRangeFromPoint = () => { const t = host.querySelector('.box-editor strong').firstChild; const r = document.createRange(); r.setStart(t, 1); r.collapse(true); return r; };
            enterEditMode(host, { x: 5, y: 5 }); out.word = __units(host.querySelector('.box-editor'));
            host.querySelector('.box-editor').blur();
            document.caretRangeFromPoint = () => { const c = host.querySelector('.box-editor .ed-box'); const r = document.createRange(); r.setStart(c.firstChild, 1); r.collapse(true); return r; };
            enterEditMode(host, { x: 5, y: 5 }); out.chip = __units(host.querySelector('.box-editor'));
            host.querySelector('.box-editor').blur();
            delete document.caretRangeFromPoint;
            enterEditMode(host, { x: 5, y: 5 }); out.none = __units(host.querySelector('.box-editor'));
            host.querySelector('.box-editor').blur();
            return out; })()`);
        ok(at.word.start === 11 && at.chip.start === 4 && at.none.start === 26,
            'opened by a click, the cursor goes where it landed (in a link: just after it); with no point, at the end', J(at));
    }

    console.log('\n-- (3) typing converts once finished --');
    {
        load(true);
        const r = val(`(function () { const ed = __open('${T}'); __end(ed); __type(ed, ' **raven**');
            const pending = { strong: !!ed.querySelector('strong'), text: findNodeContext(state.trees, '${T}').node.texts[0] };
            __type(ed, ' ');
            return { pending, strong: Array.from(ed.querySelectorAll('strong')).map(s => s.textContent), text: findNodeContext(state.trees, '${T}').node.texts[0] }; })()`);
        ok(!r.pending.strong && r.pending.text === 'Poe is a raven. **raven**', 'typed, **raven** waits as typed until it is finished', J(r.pending));
        ok(J(r.strong) === J(['raven']) && r.text === 'Poe is a raven. **raven** ', 'the next character converts it: bold, and the box keeps its marks', J(r));
        const u = val(`(function () { const ed = __box('${T}').querySelector('.box-editor'); __key(ed, 'z', { ctrlKey: true });
            return { strong: ed.querySelectorAll('strong').length, lit: Array.from(ed.querySelectorAll('.ed-lit')).map(s => s.textContent), text: findNodeContext(state.trees, '${T}').node.texts[0] }; })()`);
        ok(u.strong === 0 && J(u.lit) === J(['**raven**']) && u.text === 'Poe is a raven. !**raven** ', 'Ctrl+Z right after puts the marks back as typed, and keeps them so (a ! before them)', J(u));
        const w = val(`(function () { const ed = __box('${T}').querySelector('.box-editor'); __end(ed); __type(ed, '**b*');
            const mid = { em: ed.querySelectorAll('em').length, strong: ed.querySelectorAll('strong').length };
            __type(ed, '*.');
            return { mid, strong: Array.from(ed.querySelectorAll('strong')).map(s => s.textContent), em: ed.querySelectorAll('em').length }; })()`);
        ok(w.mid.em === 0 && w.mid.strong === 0 && J(w.strong) === J(['b']) && w.em === 0, '** waits for its second *: **b* is not read as italic on the way', J(w));
        const m = val(`(function () { const ed = __box('${T}').querySelector('.box-editor'); __end(ed); __type(ed, ' $y$ and \\\\alph');
            const mid = Array.from(ed.querySelectorAll('.ed-math')).map(c => c.dataset.src);
            __type(ed, 'a ');
            return { mid, math: Array.from(ed.querySelectorAll('.ed-math')).map(c => c.dataset.src) }; })()`);
        ok(J(m.mid) === J(['$y$']) && J(m.math) === J(['$y$', '\\alpha']), 'a formula converts once finished; \\alph waits for its letters', J(m));
        run(`__box('${T}').querySelector('.box-editor').blur()`);
    }

    console.log('\n-- (4) deleting what is seen --');
    {
        load(true);
        const r = val(`(function () { const ed = __open('${S}'); __caret(ed, 4);
            const first = __backspace(ed);
            const sel = { picked: Array.from(ed.querySelectorAll('.ed-chip.is-selected')).map(c => c.textContent), units: __units(ed) };
            const second = __backspace(ed);
            const after = { chips: Array.from(ed.querySelectorAll('.ed-box')).length, text: findNodeContext(state.trees, '${S}').node.texts[0] };
            __key(ed, 'z', { ctrlKey: true });
            return { first, sel, second, after, back: Array.from(ed.querySelectorAll('.ed-box')).map(c => c.textContent), text: findNodeContext(state.trees, '${S}').node.texts[0] }; })()`);
        ok(r.first === 'handled' && J(r.sel.picked) === J(['S2']) && r.sel.units.end - r.sel.units.start === 1, 'Backspace just after a link selects it', J(r.sel));
        ok(r.second === 'handled' && r.after.chips === 0 && r.after.text === 'If  then **Poe** is *black*, $x^2$.', 'a second Backspace deletes it, whole', J(r.after));
        ok(J(r.back) === J(['S2']) && r.text === MAP[0].children[0].texts[0], 'Ctrl+Z brings it back', J(r));
        const d = val(`(function () { const ed = __box('${S}').querySelector('.box-editor'); __caret(ed, 3);
            const h = __key(ed, 'Delete'); return { h, picked: Array.from(ed.querySelectorAll('.ed-chip.is-selected')).map(c => c.textContent) }; })()`);
        ok(d.h && J(d.picked) === J(['S2']), 'Delete just before a link selects it the same way', J(d));
        const b = val(`(function () { const ed = __box('${S}').querySelector('.box-editor');
            const t = ed.querySelector('strong').firstChild; const r = document.createRange(); r.setStart(t, 3); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
            __backspace(ed); __backspace(ed);
            return { strong: Array.from(ed.querySelectorAll('strong')).map(s => s.textContent), text: findNodeContext(state.trees, '${S}').node.texts[0] }; })()`);
        ok(J(b.strong) === J(['P']) && b.text === 'If [S2](#box:tttttttt) then **P** is *black*, $x^2$.', 'Backspace in bold words takes their letters one at a time; the rest stays bold', J(b));
        run(`__box('${S}').querySelector('.box-editor').blur()`);
    }

    console.log('\n-- (5) Ctrl+B, Ctrl+I, Ctrl+U --');
    {
        load(true);
        const r = val(`(function () { const ed = __open('${T}');
            __caret(ed, 0, 3); __key(ed, 'b', { ctrlKey: true });
            const bold = { strong: Array.from(ed.querySelectorAll('strong')).map(s => s.textContent), text: findNodeContext(state.trees, '${T}').node.texts[0], units: __units(ed) };
            __key(ed, 'b', { ctrlKey: true });
            const unbold = { strong: ed.querySelectorAll('strong').length, text: findNodeContext(state.trees, '${T}').node.texts[0] };
            __caret(ed, 11); __key(ed, 'i', { ctrlKey: true });
            const word = { em: Array.from(ed.querySelectorAll('em')).map(s => s.textContent), text: findNodeContext(state.trees, '${T}').node.texts[0] };
            __caret(ed, 0, 2); __key(ed, 'u', { ctrlKey: true });
            const under = { u: Array.from(ed.querySelectorAll('u')).map(s => s.textContent), text: findNodeContext(state.trees, '${T}').node.texts[0] };
            ed.blur();
            return { bold, unbold, word, under, final: findNodeContext(state.trees, '${T}').node.texts[0] }; })()`);
        ok(J(r.bold.strong) === J(['Poe']) && r.bold.text === '**Poe** is a raven.' && r.bold.units.start === 0 && r.bold.units.end === 3, 'Ctrl+B makes the selection bold, and keeps it selected', J(r.bold));
        ok(r.unbold.strong === 0 && r.unbold.text === 'Poe is a raven.', 'Ctrl+B again takes it off', J(r.unbold));
        ok(J(r.word.em) === J(['raven']) && r.word.text === 'Poe is a *raven*.', 'with no selection, Ctrl+I acts on the word at the cursor', J(r.word));
        ok(J(r.under.u) === J(['Po']) && r.under.text === '__Po__e is a *raven*.' && r.final === '__Po__e is a *raven*.', 'Ctrl+U underlines', J(r.under));
    }

    console.log('\n-- (6) a new line --');
    {
        load(true);
        const r = val(`(function () { const ed = __open('${T}'); __end(ed); __type(ed, ' *end*\\nnext');
            const shape = __shape(ed);
            const text = findNodeContext(state.trees, '${T}').node.texts[0];
            const em = ed.querySelector('em');
            const r = document.createRange(); r.setStart(em.firstChild, 1); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
            __type(ed, '\\n');
            return { shape, text, split: Array.from(ed.querySelectorAll('em')).map(e => e.textContent), text2: findNodeContext(state.trees, '${T}').node.texts[0] }; })()`);
        ok(/em\[\*\]\(end\) br\.ed-br\(\) "next"/.test(r.shape) && r.text === 'Poe is a raven. *end*\nnext', 'a new line converts what was just finished, and starts after it', r.shape);
        ok(J(r.split) === J(['e', 'nd']) && r.text2 === 'Poe is a raven. *e*\n*nd*\nnext', 'inside italic words it ends the italic and starts it again on the next line', J(r));
        run(`__box('${T}').querySelector('.box-editor').blur()`);
    }

    console.log('\n-- (7) a formula --');
    {
        load(true);
        const r = val(`(function () { const ed = __open('${S}'); const c = ed.querySelector('.ed-math');
            c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
            const src = ed.querySelector('.ed-src'); const opened = src && src.textContent;
            src.firstChild.data = '$x^3$';
            boxEditor.closeSource(ed);
            return { opened, math: Array.from(ed.querySelectorAll('.ed-math')).map(m => m.dataset.src), text: ed.value }; })()`);
        ok(r.opened === '$x^2$', 'a double-click opens the source of a formula to edit', J(r));
        ok(J(r.math) === J(['$x^3$']) && /\$x\^3\$\.$/.test(r.text), 'and it shows as a formula again after', J(r));
        run(`__box('${S}').querySelector('.box-editor').blur()`);
    }

    console.log('\n-- (8) paste and copy --');
    {
        load(true);
        const r = val(`(function () { const ed = __open('${T}'); __end(ed);
            const p = new Event('paste', { bubbles: true, cancelable: true });
            p.clipboardData = { getData: t => t === 'text/plain' ? ' see [S2](#box:tttttttt) and ==this==' : '' };
            ed.dispatchEvent(p);
            const pasted = { box: Array.from(ed.querySelectorAll('.ed-box')).map(c => c.textContent), mark: Array.from(ed.querySelectorAll('mark')).map(c => c.textContent), text: findNodeContext(state.trees, '${T}').node.texts[0], caret: __units(ed), units: boxEditor._internals.countUnits(ed) };
            __caret(ed, 15, 21);
            const data = {}; const c = new Event('copy', { bubbles: true, cancelable: true });
            c.clipboardData = { setData: (t, v) => { data[t] = v; } };
            ed.dispatchEvent(c);
            ed.blur();
            return { pasted, data }; })()`);
        ok(J(r.pasted.box) === J(['S2']) && J(r.pasted.mark) === J(['this']) && r.pasted.text === 'Poe is a raven. see [S2](#box:tttttttt) and ==this==' && r.pasted.caret.start === r.pasted.units,
            'pasted text with marks converts, and the cursor ends after it', J(r.pasted));
        ok(r.data['text/plain'] === ' see S2' && r.data['application/x-argmap-markup'] === ' see [S2](#box:tttttttt)', 'copied: plain words for other programs, the marks for a box', J(r.data));
    }

    console.log('\n-- (9) closing keeps what was shown --');
    {
        load(true);
        const r = val(`(function () { const ed = __open('${T}'); __end(ed); __type(ed, ' *x*'); ed.blur();
            return { text: findNodeContext(state.trees, '${T}').node.texts[0], view: __box('${T}').querySelector('.rendered-text').innerHTML }; })()`);
        ok(r.text === 'Poe is a raven. *x*' && /<em>x<\/em>/.test(r.view), 'what was typed and finished at the end converts as the box closes', J(r));
        // Random formatting, closed: the renderer shows the saved text as the editor showed it.
        const fuzz = val(`(function () {
            let seed = 7; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
            const texts = ['Poe is a raven, and all ravens are black.', 'If [S2](#box:tttttttt) then **Poe** is *black*.', 'a_b and c*d stay; x = y', 'Ravens fly. Crows fly too!'];
            const I = boxEditor._internals; let bad = [], stepBad = [], runs = 0;
            for (const base of texts) for (let k = 0; k < 30; k++) {
                const ctx = findNodeContext(state.trees, '${T}'); ctx.node.texts[0] = base; render();
                const ed = __open('${T}');
                for (let step = 0; step < 4; step++) {
                    const n = I.countUnits(ed); if (n < 2) break;
                    const a = rnd(n - 1), b = a + 1 + rnd(Math.min(8, n - a - 1) || 1);
                    __caret(ed, a, Math.min(b, n));
                    __key(ed, ['b', 'i', 'u'][rnd(3)], { ctrlKey: true });
                    // After every edit the editor shows what its text will show.
                    const now = document.createElement('div'); now.appendChild(I.nodesFor(I.renderFor(I.serialize(ed), true)));
                    if (JSON.stringify(I.atomsOf(now)) !== JSON.stringify(I.atomsOf(ed))) { const m = ed.value; if (!bad.includes(m)) stepBad.push(m); }
                }
                const shown = I.atomsOf(ed);
                ed.blur(); runs++;
                const saved = findNodeContext(state.trees, '${T}').node.texts[0];
                const d = document.createElement('div'); d.appendChild(I.nodesFor(I.renderFor(saved, true)));
                if (JSON.stringify(I.atomsOf(d)) !== JSON.stringify(shown)) bad.push(saved);
            }
            return { runs, bad: bad.slice(0, 3), nbad: bad.length, stepBad: stepBad.length }; })()`);
        ok(fuzz.runs === 120 && fuzz.nbad === 0, 'over ' + fuzz.runs + ' boxes given random Ctrl+B, Ctrl+I, Ctrl+U, the saved text always shows exactly as the editor did', J(fuzz));
    }

    console.log('\n-- (10) Esc, the selection as offsets, a premise link at the cursor --');
    {
        load(true);
        const r = val(`(function () { const depth = undoStack.length; const ed = __open('${T}'); __end(ed); __type(ed, ' **junk** ');
            __key(ed, 'Escape');
            return { text: findNodeContext(state.trees, '${T}').node.texts[0], depth: undoStack.length - depth, open: !ed.readOnly }; })()`);
        ok(r.text === 'Poe is a raven.' && r.depth === 0 && !r.open, 'Esc puts the words back and closes the box, with no undo step', J(r));
        const o = val(`(function () { const ed = __open('${S}'); __caret(ed, 4); const at = { start: ed.selectionStart, end: ed.selectionEnd };
            ed.setSelectionRange(35, 35); const back = __units(ed);
            ed.blur(); return { at, back }; })()`);
        ok(o.at.start === 22 && o.at.end === 22 && o.back.start === 13 && o.back.end === 13,
            'the selection reads as offsets into the text (after the link: 22), and is set by them (35, after **Poe**: the 13th seen)', J(o));
        const l = val(`(function () { const ed = __open('${T}'); __caret(ed, 3);
            startBoxLinkPicking('${T}', 0, ed.selectionStart, ed.selectionEnd);
            completeBoxLinkPicking('${M}', 0);
            const ed2 = __box('${T}').querySelector('.box-editor');
            return { text: findNodeContext(state.trees, '${T}').node.texts[0], open: !ed2.readOnly, caret: ed2.selectionStart, chips: Array.from(ed2.querySelectorAll('.ed-box')).map(c => c.textContent) }; })()`);
        ok(/^Poe \[M1\]\(#box:mmmmmmmm[^)]*\) is a raven\.$/.test(l.text) && l.open && J(l.chips) === J(['M1']),
            'a premise link put in from the menu lands at the cursor, one piece, the box open again', J(l));
        run(`__box('${T}').querySelector('.box-editor').blur()`);
    }

    console.log('\n-- (11) Rich text off --');
    {
        load(false);
        const r = val(`(function () { const ed = __open('${S}'); const shape = __shape(ed); __end(ed); __type(ed, ' **x** [S2](#box:tttttttt) ');
            const after = { strong: ed.querySelectorAll('strong').length, chips: Array.from(ed.querySelectorAll('.ed-box')).map(c => c.textContent) };
            __caret(ed, 0, 2); const toast = __key(ed, 'b', { ctrlKey: true });
            ed.blur(); return { shape, after, toast, text: findNodeContext(state.trees, '${S}').node.texts[0], raw: !!(findNodeContext(state.trees, '${S}').node.raw || {})[0] }; })()`);
        ok(/span\.ed-chip\.ed-box\(S2\)/.test(r.shape) && !/strong/.test(r.shape) && /\*\*Poe\*\*/.test(r.shape), 'it opens with only the links as pieces; the marks show as typed', r.shape);
        ok(r.after.strong === 0 && J(r.after.chips) === J(['S2', 'S2']) && r.text.endsWith(' **x** [S2](#box:tttttttt) ') && r.raw, 'typed marks stay as typed, a typed link converts, and the box is kept raw', J(r));
    }

    console.log('\n-- (12) shortcuts while a box is open --');
    {
        load(true);
        const r = val(`(function () { const ed = __open('${T}'); __end(ed);
            const before = findNodeContext(state.trees, '${T}').node.type;
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', code: 'KeyO', bubbles: true, cancelable: true }));
            ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', code: 'KeyO', bubbles: true, cancelable: true }));
            const typing = { type: findNodeContext(state.trees, '${T}').node.type, open: !ed.readOnly };
            ed.blur(); return { before, typing }; })()`);
        ok(r.before === 'support' && r.typing.type === 'support' && r.typing.open, 'O typed in an open box does not make it an objection', J(r));
    }

    console.log('\n-- (13) B, I, U --');
    {
        load(true);
        const text = id => `findNodeContext(state.trees, '${id}').node.texts[0]`;
        const e = val(`(function () { const ed = __open('${T}'); __caret(ed, 0, 3);
            ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
            const row = Array.from(document.querySelectorAll('#link-menu .link-menu-format button'));
            const before = row.map(b => b.textContent + ':' + b.getAttribute('aria-pressed'));
            row[0].click();
            ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
            const after = Array.from(document.querySelectorAll('#link-menu .link-menu-format button')).map(b => b.getAttribute('aria-pressed'));
            document.querySelectorAll('#link-menu').forEach(m => m.remove());
            ed.blur(); return { before, after, text: ${text(T)} }; })()`);
        ok(J(e.before) === J(['B:false', 'I:false', 'U:false']) && J(e.after) === J(['true', 'false', 'false']) && e.text === '**Poe** is a raven.',
            "an open box's menu has B, I and U for the words selected, pressed when they have it", J(e));

        load(true);
        const m = val(`(function () {
            selectedIds = ['${T}-0'];
            const row = () => { showContextMenu(10, 10, '${T}', 0); return Array.from(document.querySelectorAll('#context-menu .ctx-format button')); };
            let b = row();
            const labels = b.map(x => x.textContent + ':' + x.getAttribute('aria-pressed') + ':' + x.title);
            b[0].click();
            const bold = ${text(T)}, shown = __box('${T}').querySelector('.rendered-text').innerHTML;
            b = row();
            const pressed = b.map(x => x.getAttribute('aria-pressed'));
            b[0].click();
            const plain = ${text(T)};
            hideContextMenu();
            return { labels, bold, shown, pressed, plain }; })()`);
        ok(J(m.labels) === J(['B:false:Bold the whole box', 'I:false:Italicize the whole box', 'U:false:Underline the whole box']),
            "a box's menu has B, I and U for the whole box, none pressed on plain words", J(m.labels));
        ok(m.bold === '**Poe is a raven.**' && /<strong[^>]*>Poe is a raven\.<\/strong>/.test(m.shown), 'B bolds all of it', J(m));
        ok(J(m.pressed) === J(['true', 'false', 'false']) && m.plain === 'Poe is a raven.', 'then B shows pressed, and takes the bold off again', J(m));

        load(true);
        const s = val(`(function () {
            selectedIds = ['${S}-0'];
            const was = ${text(S)};
            showContextMenu(10, 10, '${S}', 0); document.querySelector('#context-menu .ctx-format .fmt-em').click();
            const em = ${text(S)}, rd = __box('${S}').querySelector('.rendered-text');
            const shown = { links: rd.querySelectorAll('em .box-link').length, bold: Array.from(rd.querySelectorAll('em strong')).map(x => x.textContent), math: /x\\^2|katex|md-math/.test(rd.innerHTML) };
            showContextMenu(10, 10, '${S}', 0); document.querySelector('#context-menu .ctx-format .fmt-u').click();
            const u = ${text(S)}, has = boxEditor.wholeState(u);
            undo(); const back1 = ${text(S)};
            undo(); const back0 = ${text(S)};
            return { was, em, shown, u, has, back1, back0 }; })()`);
        ok(s.has.em && s.has.u && !s.has.strong && /\[S2\]\(#box:tttttttt\)/.test(s.em) && /\$x\^2\$/.test(s.u) && s.shown.links === 1 && J(s.shown.bold) === J(['Poe']) && s.shown.math,
            'I and U go over all of a box -- its link and formula kept, "Poe" still bold inside', J(s));
        ok(s.back1 === s.em && s.back0 === s.was, 'each is one undo step', J({ back1: s.back1, back0: s.back0 }));

        load(true);
        const k = val(`(function () {
            const t = findNodeContext(state.trees, '${T}').node; t.texts = ['Poe is a raven.', 'Poe *flies*.']; render();
            selectedIds = ['${S}-0', '${T}-0'];
            showContextMenu(10, 10, '${T}', 0);
            const title = document.querySelector('#context-menu .ctx-format .fmt-strong').title;
            document.querySelector('#context-menu .ctx-format .fmt-strong').click();
            const both = [${text(S)}, ${text(T)}];
            selectedIds = ['${T}'];
            formatSelectedBoxes('em');
            const group = t.texts.slice();
            formatSelectedBoxes('em');
            const off = t.texts.slice();
            return { title, both, group, off }; })()`);
        ok(/selected boxes/.test(k.title) && /^\*\*If \[S2\]\(#box:tttttttt\) then Poe is \*black\*, \$x\^2\$\.\*\*$/.test(k.both[0]) && k.both[1] === '**Poe is a raven.**',
            'with several boxes selected, B bolds all of each (bold where only some was)', J(k));
        ok(k.group.every(x => /^\*/.test(x)) && J(k.group.map(x => val(`boxEditor.wholeState(${J(x)}).em`))) === J([true, true]) &&
            J(k.off.map(x => val(`boxEditor.wholeState(${J(x)}).em`))) === J([false, false]),
            'a whole group selected: every box of it -- italic on where "flies" alone had it, then off for all', J(k));

        load(true);
        const raw = val(`(function () {
            const t = findNodeContext(state.trees, '${T}').node; t.texts[0] = 'a *b* c'; t.raw = { 0: true }; render();
            selectedIds = ['${T}-0']; formatSelectedBoxes('strong');
            const html = __box('${T}').querySelector('.rendered-text').innerHTML;
            return { text: t.texts[0], raw: t.raw || null, html }; })()`);
        ok(raw.text === '**a \\*b\\* c**' && raw.raw === null && /<strong[^>]*>a \*b\* c<\/strong>/.test(raw.html),
            'a box kept as typed is bolded as it shows: its marks written so they show as before', J(raw));

        load(true);
        const off = val(`(function () { richTextEnabled = false; selectedIds = ['${T}-0']; formatSelectedBoxes('strong');
            const t = ${text(T)}; richTextEnabled = true; return t; })()`);
        ok(off === 'Poe is a raven.', 'with Rich text off nothing is formatted', off);

        load(true);
        const tb = val(`(function () {
            const row = Array.from(document.querySelectorAll('#extra-toolbar .format-trio button'));
            const labels = row.map(b => b.textContent);
            const ed = __open('${T}'); __caret(ed, 4, 6);
            const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true }); row[0].dispatchEvent(down);
            row[0].click();
            const open = !ed.readOnly; ed.blur();
            const words = ${text(T)};
            selectedIds = ['${M}-0']; row[2].click();
            return { labels, kept: down.defaultPrevented, open, words, whole: ${text(M)} }; })()`);
        ok(J(tb.labels) === J(['B', 'I', 'U']) && tb.kept && tb.open && tb.words === 'Poe **is** a raven.',
            'Formatting has B, I and U: with a box open, on its selected words (the button takes no focus from it)', J(tb));
        ok(tb.whole === '__Poe is black.__', 'with none open, on all of each selected box', tb.whole);

        load(true);
        const keys = val(`(function () {
            selectedIds = ['${T}-0'];
            const ev = new KeyboardEvent('keydown', { key: 'i', code: 'KeyI', ctrlKey: true, bubbles: true, cancelable: true });
            document.dispatchEvent(ev);
            const italic = ${text(T)};
            selectedIds = [];
            const none = new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', ctrlKey: true, bubbles: true, cancelable: true });
            document.dispatchEvent(none);
            return { used: ev.defaultPrevented, italic, left: !none.defaultPrevented }; })()`);
        ok(keys.used && keys.italic === '*Poe is a raven.*' && keys.left, 'Ctrl+I with a box selected italicizes all of it; with none selected the key is left to the browser', J(keys));
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    W.dom.window.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
