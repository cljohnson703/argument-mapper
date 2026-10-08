'use strict';
// r27.62: premise links, one-click editing, and an editor that survives Alt+Tab.
//
// The user (2026-09-29):
//   "Allow the user to link other premises as node content. Shorthand can
//   point to premises, e.g., S7, and that link follows where the premise goes
//   (doesn't require always being S7). So, I might have, 'If S7 and S8, then
//   S4.' ... like a hyperlink that never turns purple (i.e., is always blue
//   with an underline) ... Maybe a context menu option from a node that's
//   currently text-editing, kind of like how cross-references work"
//   "a button that switches between touching the boxes and going straight to
//   text-editing vs the default where only a double-click text-edits"
//   "make it so that Alt-tabbing (at least on chrome) doesn't exit you from
//   text-editing on a node"
//
// Covers:
//   (1) a link is shown by its box's label as the map has it now, and says
//       so again when the labels change; a box that is gone shows struck;
//   (2) clicking one goes to its box; the editor's menu makes one by
//       clicking the box, at the caret; Esc gives the box back as it was;
//   (3) links follow their boxes when co-premises are renumbered, when
//       copied along with them, and through the text format;
//   (4) the deductive check reads a link as its box's words: "If S1a, then
//       Poe is black" with "Poe is a raven" is modus ponens;
//  (4b) a link it reads as its label (a box that is gone, a loop) is one
//       name: "-O1" is not "not O1", a negation goes outside the link, and
//       Derive Parent writes the link back;
//   (5) Editing: One click opens a box's text on a click; Double-click (the
//       default) only selects; Shift-click never opens it;
//   (6) a blur while the page itself lost the focus (Alt+Tab) keeps the
//       editor open, and the edit stays one undo step.
//
// Run:  node premise-links-r27-test.js [argument-mapper-r27.html]
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

const HELPERS = `
    window.__p = {
        // M "Poe is black." <- s ["Poe is a raven.", "If <link to s-0>, then Poe is black."]; t "Rex is a dog."
        load(withLink) {
            state.trees = [
                { id: '11111111-1111-4111-8111-111111111111', type: 'contention', texts: ['Poe is black.'], collapsed: [], children: [
                    { id: '22222222-2222-4222-8222-222222222222', type: 'support', texts: ['Poe is a raven.', withLink === false ? 'If Poe is a raven, then Poe is black.' : 'If [S1](#box:22222222), then Poe is black.'], collapsed: [], children: [] },
                    { id: '33333333-3333-4333-8333-333333333333', type: 'support', texts: ['Rex is a dog.'], collapsed: [], children: [] }
                ] }
            ];
            ensureCollabFields(state);
            reviewMode = false;
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            if (clickToEdit) applyClickToEdit(false);
            render();
            selectedIds = [];
            updateSelectionVisuals();
        },
        node(id) { return findNodeContext(state.trees, id).node; },
        box(id, idx) { return document.querySelector('.node[data-node-id="' + id + '"][data-node-idx="' + idx + '"]'); },
        ta(id, idx) { return this.box(id, idx).querySelector('.box-editor'); },
        link(id, idx) { return this.box(id, idx).querySelector('.rendered-text a.box-link'); },
        editing() {
            const a = document.activeElement;
            if (!a || !(a.tagName === 'TEXTAREA' || (a.classList && a.classList.contains('box-editor'))) || a.readOnly) return null;
            const host = a.closest('.node');
            return host ? host.getAttribute('data-node-id') + '-' + host.getAttribute('data-node-idx') : 'other';
        },
        press(el, opts) {
            opts = opts || {};
            const base = { bubbles: true, cancelable: true, composed: true, button: 0, buttons: 1, pointerId: 1, isPrimary: true,
                clientX: 5, clientY: 5, pointerType: 'mouse', shiftKey: !!opts.shift };
            el.dispatchEvent(new PointerEvent('pointerdown', base));
            document.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, base, { buttons: 0 })));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: !!opts.shift }));
        }
    };
`;
const T = (W, body) => JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`));

(async () => {
    console.log('=== r27.62 premise links, one-click editing, Alt+Tab ===');
    const W = makeWin('premise-links');
    await sleep(250);
    W.win.eval(HELPERS);

    console.log('\n-- (1) shown by the label the box has now --');
    {
        const shown = T(W, `__p.load();
            const a = __p.link('22222222-2222-4222-8222-222222222222', 1);
            return a ? { text: a.textContent, id: a.dataset.boxId, idx: a.dataset.boxIdx, color: a.classList.contains('node-link'),
                title: a.getAttribute('title'), href: a.getAttribute('href') } : null;`);
        ok(shown && shown.text === boxLabelOf(W, '22222222-2222-4222-8222-222222222222', 0) && shown.id === '22222222-2222-4222-8222-222222222222' && shown.idx === '0',
            'the link is drawn as its box\'s label (labels off: the simple label), naming the box by its id', JSON.stringify(shown));
        ok(shown && shown.color && shown.href === '#' && /Poe is a raven/.test(shown.title),
            'it is a blue, underlined link (the web links\' style, no visited color), with the box\'s words on hover', JSON.stringify(shown));
        const relabel = T(W, `__p.load();
            // A support placed first: every S number after it moves up one.
            __p.node('11111111-1111-4111-8111-111111111111').children.unshift({ id: '44444444-4444-4444-8444-444444444444', type: 'support', texts: ['Fido is a dog.'], collapsed: [], children: [] });
            render();
            return { shown: __p.link('22222222-2222-4222-8222-222222222222', 1).textContent, now: boxLinkLabel('22222222-2222-4222-8222-222222222222', 0), stored: __p.node('22222222-2222-4222-8222-222222222222').texts[1] };`);
        ok(relabel.shown === relabel.now && relabel.shown !== 'S1' && /\[S1\]\(#box:22222222\)/.test(relabel.stored),
            'when the boxes are numbered again, the link says the new label -- the words stored are not touched', JSON.stringify(relabel));
        const labelsOn = T(W, `__p.load(); labelMode = 'complex'; render();
            const t = __p.link('22222222-2222-4222-8222-222222222222', 1).textContent; labelMode = 'none'; render(); return t;`);
        ok(labelsOn === 'M1S1a', 'with complex labels on, it says the complex label', labelsOn);
        const gone = T(W, `__p.load(); __p.node('22222222-2222-4222-8222-222222222222').texts[1] = 'If [S9](#box:zzzzzzzz), then Poe is black.'; render();
            const x = __p.box('22222222-2222-4222-8222-222222222222', 1).querySelector('.box-link-missing');
            return x ? { text: x.textContent, title: x.title } : null;`);
        ok(gone && gone.text === 'S9', 'a link to a box that is gone shows its last label, struck through', JSON.stringify(gone));
    }

    console.log('\n-- (2) following one, and making one --');
    {
        const go = T(W, `__p.load();
            const a = __p.link('22222222-2222-4222-8222-222222222222', 1);
            const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
            a.dispatchEvent(ev);
            return { sel: selectedIds, prevented: ev.defaultPrevented, editing: __p.editing() };`);
        ok(JSON.stringify(go.sel) === JSON.stringify(['22222222-2222-4222-8222-222222222222-0']) && go.prevented && go.editing === null,
            'a click on the link goes to its box and selects it (and opens nothing, and adds no "#" to the address)', JSON.stringify(go));

        const made = T(W, `__p.load(false);
            editNodeText('33333333-3333-4333-8333-333333333333', 0);
            const ta = __p.ta('33333333-3333-4333-8333-333333333333', 0);
            ta.value = 'Rex is a dog, and '; ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.setSelectionRange(ta.value.length, ta.value.length);
            const menuEv = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
            ta.dispatchEvent(menuEv);
            const menu = document.getElementById('link-menu');
            const items = menu ? [...menu.querySelectorAll('button')].map(b => b.textContent + (b.disabled ? ' (off)' : '')) : null;
            const pick = menu && [...menu.querySelectorAll('button')].find(b => /premise/.test(b.textContent));
            if (pick) pick.click();
            const armed = !!boxLinkPicking && document.getElementById('crossref-hint').classList.contains('visible');
            __p.press(__p.box('22222222-2222-4222-8222-222222222222', 0));
            const text = __p.node('33333333-3333-4333-8333-333333333333').texts[0];
            return { items, armed, text, editing: __p.editing(), caret: __p.editing() ? document.activeElement.selectionStart : null,
                len: document.activeElement.value ? document.activeElement.value.length : null, picking: !!boxLinkPicking };`);
        ok(made.items && made.items.slice(0, 3).join("") === "BIU" && made.items[3] === 'Link a premise' && /Link selection/.test(made.items[4]) && /\(off\)/.test(made.items[4]),
            'the menu of a box being edited offers B, I, U, then "Link a premise" (and "Link selection" for a selection)', JSON.stringify(made.items));
        ok(made.armed, 'choosing it asks for the box to link, as adding a reference does', JSON.stringify(made));
        ok(/^Rex is a dog, and \[S\d+\]\(#box:22222222\)$/.test(made.text) && !made.picking,
            'a click on the box puts its link in at the caret', JSON.stringify(made.text));
        ok(made.editing === '33333333-3333-4333-8333-333333333333-0' && made.caret === made.len,
            'and the box opens again with the caret after the link, to go on writing', JSON.stringify(made));

        const escaped = T(W, `__p.load(false);
            editNodeText('33333333-3333-4333-8333-333333333333', 0);
            const ta = __p.ta('33333333-3333-4333-8333-333333333333', 0);
            ta.value = 'Rex barks'; ta.dispatchEvent(new Event('input', { bubbles: true }));
            startBoxLinkPicking('33333333-3333-4333-8333-333333333333', 0, 3, 3);
            document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
            return { picking: !!boxLinkPicking, text: __p.node('33333333-3333-4333-8333-333333333333').texts[0], editing: __p.editing(),
                caret: document.activeElement.selectionStart };`);
        ok(!escaped.picking && escaped.text === 'Rex barks' && escaped.editing === '33333333-3333-4333-8333-333333333333-0' && escaped.caret === 3,
            'Esc gives the box back as it was, with its caret where it was', JSON.stringify(escaped));

        const noted = T(W, `__p.load(false);
            state.trees.push({ id: '55555555-5555-4555-8555-555555555555', type: 'note', texts: ['A note.'], collapsed: [], children: [], x: 900, y: 100, freePosition: true });
            render();
            startBoxLinkPicking('33333333-3333-4333-8333-333333333333', 0, 0, 0);
            __p.press(__p.box('55555555-5555-4555-8555-555555555555', 0));
            const still = !!boxLinkPicking; cancelBoxLinkPicking(false);
            return { still, text: __p.node('33333333-3333-4333-8333-333333333333').texts[0] };`);
        ok(noted.still && noted.text === 'Rex is a dog.', 'a note is no premise: clicking one links nothing, and the pick waits', JSON.stringify(noted));
    }

    console.log('\n-- (3) links follow their boxes --');
    {
        const shifted = T(W, `__p.load();
            selectedIds = ['22222222-2222-4222-8222-222222222222-0']; addCoPremise('left');
            return __p.node('22222222-2222-4222-8222-222222222222').texts;`);
        ok(/\(#box:22222222\.1\)/.test(shifted[2]) && shifted[1] === 'Poe is a raven.',
            'a co-premise put before the linked box: the link follows it to its new place', JSON.stringify(shifted));

        const copied = T(W, `__p.load();
            selectedIds = ['22222222-2222-4222-8222-222222222222']; copyNode();
            selectedIds = ['33333333-3333-4333-8333-333333333333-0']; pasteNode();
            const t = __p.node('33333333-3333-4333-8333-333333333333').children[0];
            return { id: t.id, texts: t.texts };`);
        ok(copied.texts && copied.texts[1].indexOf('#box:' + copied.id) >= 0,
            'copied along with the box it links, a link names the copy', JSON.stringify(copied));

        const text = T(W, `__p.load();
            const out = generateTextRepresentation();
            const back = parseTextToState(out);
            const find = (ns, test) => { for (const n of ns) { if (test(n)) return n; const f = find(n.children || [], test); if (f) return f; } return null; };
            const s = find(back.trees, n => n.texts[0] === 'Poe is a raven.');
            return { line: out.split('\\n').find(l => /If \\[/.test(l)), text: s && s.texts[1], id: s && s.id };`);
        ok(/#box:@M1S1a\)/.test(text.line || '') && text.text === 'If [S1](#box:' + text.id + '), then Poe is black.',
            'the text format names the box by its label, and reads it back as a link to that box', JSON.stringify(text));

        // Cut and pasted, a box keeps what named it: another box's link, and
        // a reference to it (r27.62 had them show it as gone).
        const cut = T(W, `__p.load();
            const t = __p.node('33333333-3333-4333-8333-333333333333');
            t.texts[0] = 'Rex is a dog, as [S1](#box:22222222) is a raven.';
            t.crossRefs = [[{ targetId: '22222222-2222-4222-8222-222222222222', targetIdx: 0 }]];
            render();
            selectedIds = ['22222222-2222-4222-8222-222222222222']; cutNode();
            const goneWhileCut = !!__p.box('33333333-3333-4333-8333-333333333333', 0).querySelector('.box-link-missing');
            selectedIds = ['33333333-3333-4333-8333-333333333333-0']; pasteNode();
            const pasted = __p.node('33333333-3333-4333-8333-333333333333').children[0];
            const link = __p.link('33333333-3333-4333-8333-333333333333', 0);
            const refs = (t.crossRefs[0] || []).map(r => r.targetId);
            selectedIds = ['33333333-3333-4333-8333-333333333333-0']; pasteNode();
            const again = __p.node('33333333-3333-4333-8333-333333333333').children.map(c => c.id);
            return { goneWhileCut, pastedId: pasted && pasted.id, linkTo: link && link.dataset.boxId, refs, again,
                inner: pasted && pasted.texts[1] };`);
        ok(cut.goneWhileCut && cut.linkTo === cut.pastedId && cut.refs.includes(cut.pastedId),
            'cut and pasted, a box is still the box another box\'s link and reference name (gone only while it is cut)', JSON.stringify(cut));
        ok(cut.inner && cut.inner.indexOf('#box:' + cut.pastedId) >= 0 && cut.again.length === 2 && cut.refs.filter(x => x === cut.pastedId).length === 1,
            'its own co-premise\'s link follows it too; a second paste is a copy, which takes nothing over', JSON.stringify(cut));
    }

    console.log('\n-- (3b) search, replace, the Evaluations list, the export --');
    {
        const found = T(W, `__p.load();
            const label = boxLinkLabel('22222222-2222-4222-8222-222222222222', 0);
            document.getElementById('search-input').value = 'box'; executeSearch();
            const markup = searchMatches.length;
            document.getElementById('search-input').value = label; executeSearch();
            const byLabel = searchMatches.map(m => m.id + '-' + m.idx);
            document.getElementById('search-input').value = '22222222';
            document.getElementById('replace-input').value = 'X'; replaceAllMatches();
            const after = __p.node('22222222-2222-4222-8222-222222222222').texts[1];
            document.getElementById('search-input').value = 'Poe'; document.getElementById('replace-input').value = 'Edgar'; replaceAllMatches();
            const renamed = __p.node('22222222-2222-4222-8222-222222222222').texts[1];
            closeSearch();
            __p.load();
            const n = __p.node('22222222-2222-4222-8222-222222222222'); n.statuses = [null, 'contested']; render();
            const row = collectEvaluations().find(e => e.id === n.id && e.idx === 1);
            const svg = buildExportSVG() || '';
            return { markup, label, byLabel, after, renamed, row: row && row.nodeText, svgMarkup: svg.indexOf('#box:') >= 0 };`);
        ok(found.markup === 0 && found.byLabel.includes('22222222-2222-4222-8222-222222222222-1'),
            'search finds a link by the label it shows, and not by its markup ("box")', JSON.stringify(found));
        ok(found.after === 'If [S1](#box:22222222), then Poe is black.' && found.renamed === 'If [S1](#box:22222222), then Edgar is black.',
            'replace leaves a link\'s markup whole, and replaces the words around it', JSON.stringify(found));
        ok(found.row === 'If ' + found.label + ', then Poe is black.' && !found.svgMarkup,
            'the Evaluations list and the exported image show the link as its label', JSON.stringify(found));
    }

    console.log('\n-- (4) the deductive check reads the box\'s words --');
    {
        const step = T(W, `__p.load();
            const st = collectDeductiveSteps(state.trees).find(s => s.childId === '22222222-2222-4222-8222-222222222222');
            return { tag: deductiveStepTagText(st), premises: st.premiseTexts };`);
        ok(step.tag === '\u2713 modus ponens' && step.premises[1] === 'If (Poe is a raven), then Poe is black.',
            '"If S1a, then Poe is black" with "Poe is a raven": read as the box\'s words, modus ponens', JSON.stringify(step));
        const loop = T(W, `__p.load(); __p.node('33333333-3333-4333-8333-333333333333').texts[0] = 'It is not the case that [S3](#box:33333333).';
            return claimWithBoxLinks(__p.node('33333333-3333-4333-8333-333333333333').texts[0], new Set(['33333333-3333-4333-8333-333333333333#0']));`);
        ok(loop === 'It is not the case that S3.', 'a link back to its own box is read as its label, not without end', loop);
    }

    console.log('\n-- (4b) a link read as its label is one name --');
    {
        // The user (2026-10-05): "if it's a linked premise like -O1 and someone
        // wants to negate it, the negation would be outside of the syntax for
        // the linked -O1." Its label is read for a box that is gone, or a link
        // back round a loop; "-O1" there is a weak objection's name.
        const steps = T(W, `
            const N = (id, type, texts, children) => ({ id, type, texts: [].concat(texts), collapsed: [], children: children || [] });
            const tag = (main, premises) => {
                state.trees = [N('mmmmmmmm', 'contention', main, [N('pppppppp', 'support', premises)])];
                ensureCollabFields(state); render();
                const st = collectDeductiveSteps(state.trees).find(s => s.childId === 'pppppppp');
                return st ? deductiveStepTagText(st) : null;
            };
            return {
                gone: tag('It is not the case that S4.', ['If S4, then O1.', '[-O1](#box:gonegone)']),
                outside: tag('It is not the case that S4.', ['If S4, then [-O1](#box:gonegone).', 'It is not the case that [-O1](#box:gonegone).']),
                typed: tag('It is not the case that S4.', ['If S4, then O1.', '-O1']),
                formula: tag('S4', ['[-O1](#box:gonegone) -> S4', '[-O1](#box:gonegone)']),
                complex: tag('S4', ['[M1S1a-O1](#box:gonegone) -> S4', '[M1S1a-O1](#box:gonegone)']),
                symbols: tag('~[-O1](#box:gonegone)', ['[-O1](#box:gonegone) -> S4', '~S4'])
            };`);
        ok(steps.gone === '? not recognized', 'a gone weak objection\'s link is not "not O1": with "If S4, then O1" it gives nothing (was \u2713 modus tollens)', JSON.stringify(steps));
        ok(steps.outside === '\u2713 modus tollens', 'a negation written outside the link denies the name: modus tollens', JSON.stringify(steps));
        ok(steps.typed === '\u2713 modus tollens', 'typed without a link, "-O1" is still "not O1"', JSON.stringify(steps));
        ok(steps.formula === '\u2713 modus ponens' && steps.complex === '\u2713 modus ponens',
            'in a formula a link\'s name is one letter, -O1 or M1S1a-O1: modus ponens', JSON.stringify(steps));
        ok(steps.symbols === '\u2713 modus tollens', 'and "~" outside it denies it, in symbols too', JSON.stringify(steps));

        const joined = T(W, `return typeof claimLinkName !== 'function' ? null : ['-O1', 'M1S1-O1', 'A->B', 'S3'].map(l => claimLinkName(l).split('\\u2060').join('+'));`);
        ok(JSON.stringify(joined) === JSON.stringify(['+-O1', 'M1S1+-O1', 'A->B', 'S3']),
            'a hyphen inside a name is joined (-O1, M1S1-O1); an arrow\'s is not, and a label without one is as it was', JSON.stringify(joined));

        const loop = T(W, `
            state.trees = [{ id: 'mmmmmmmm', type: 'contention', texts: ['Poe is black.'], collapsed: [], children: [
                { id: 'wwwwwwww', type: 'weak-objection', texts: ['[-O1](#box:wwwwwwww)'], collapsed: [], children: [] } ] }];
            ensureCollabFields(state); render();
            const read = claimWithBoxLinks(state.trees[0].children[0].texts[0], new Set(['wwwwwwww#0']));
            const f = parseClaim(read);
            return { shown: read.replace(/\\u2060/g, ''), joined: read !== read.replace(/\\u2060/g, ''), kind: f && f.kind };`);
        ok(loop.shown === '-O1' && loop.joined && loop.kind === 'atom',
            'a box that is only a link back to itself, -O1, reads as that name, not as a denial', JSON.stringify(loop));

        const listed = T(W, `
            state.trees = [{ id: 'mmmmmmmm', type: 'contention', texts: ['S4'], collapsed: [], children: [
                { id: 'pppppppp', type: 'support', texts: ['If [-O1](#box:gonegone), then S4.', '[-O1](#box:gonegone)'], collapsed: [], children: [] } ] }];
            ensureCollabFields(state); render();
            openDeductiveCheck();
            const lines = [...document.querySelectorAll('#logic-modal-body .logic-step[data-step="pppppppp"] .logic-premise')].map(e => e.textContent);
            closeDeductiveCheck();
            return { lines, visible: lines.map(t => t.replace(/\\u2060/g, '')) };`);
        ok(JSON.stringify(listed.visible) === JSON.stringify(['If -O1, then S4.', '-O1']),
            'the list of steps shows the label as it is: the joining character is invisible', JSON.stringify(listed));

        const derived = T(W, `
            state.trees = [{ id: 'qqqqqqqq', type: 'support', texts: ['If it rains, then [-O1](#box:gonegone).', 'It rains.'], collapsed: [], children: [] }];
            ensureCollabFields(state); reviewMode = false; render();
            const found = deriveParentFor('qqqqqqqq');
            const st = collectDeductiveSteps(state.trees).find(s => s.childId === 'qqqqqqqq');
            return { rule: found && found.rule.name, box: state.trees[0].texts[0], hidden: JSON.stringify(state.trees).includes('\\u2060'),
                tag: st ? deductiveStepTagText(st) : null };`);
        ok(derived.rule === 'modus ponens' && derived.box === '[-O1](#box:gonegone).' && !derived.hidden,
            'Derive Parent writes the name back as its link (not "-O1.", which says "not O1"), and nothing hidden goes into the map', JSON.stringify(derived));
        ok(derived.tag === '\u2713 modus ponens', 'and the new step reads it as the same name: modus ponens', JSON.stringify(derived));

        // r27.86 (the user, 2026-10-06): a weak objection is WO1 now, not
        // -O1. A link written to one before then says its new name, and
        // reads as its box's words, like any link to a box that is there.
        const live = T(W, `
            state.trees = [{ id: 'mmmmmmmm', type: 'contention', texts: ['Ban cars downtown.'], collapsed: [], children: [
                { id: 'ssssssss', type: 'support', texts: ['It cuts pollution.'], collapsed: [], children: [
                    { id: 'wwwwwwww', type: 'weak-objection', texts: ['That needs evidence.'], collapsed: [], children: [] } ] },
                { id: 'pppppppp', type: 'support', texts: ['If [-O1](#box:wwwwwwww), then the support fails.'], collapsed: [], children: [] } ] }];
            ensureCollabFields(state); labelMode = 'none'; render();
            const a = document.querySelector('a.box-link[data-box-id="wwwwwwww"]');
            const simple = a && a.textContent;
            labelMode = 'complex'; render();
            const b = document.querySelector('a.box-link[data-box-id="wwwwwwww"]');
            const complex = b && b.textContent;
            labelMode = 'none'; render();
            const text = state.trees[0].children[1].texts[0];
            return { simple, complex, stored: refreshBoxLinkLabels(text), read: claimWithBoxLinks(text, new Set(['pppppppp#0'])) };`);
        ok(live.simple === 'WO1' && live.complex === 'M1S1WO1' && live.stored === 'If [WO1](#box:wwwwwwww), then the support fails.',
            'a link written to a weak objection as -O1 now says WO1 (M1S1WO1 with complex labels), and is brought up to date as WO1', JSON.stringify(live));
        ok(/needs evidence/.test(live.read) && !/O1/.test(live.read),
            'and the check reads it as the weak objection\'s words, not its name', JSON.stringify(live));

        // r27.89 (the user, 2026-10-06, a map: "If [S4], and if [S5], then
        // computers lack semantics", beside S4 and S5, was "? not
        // recognized"): a linked box is read in brackets, and the capital it
        // begins with had been read as a name's -- "If (Computer programs are
        // only formal)" was about something named Computer.
        const searle = T(W, `
            const run = six => {
                state.trees = [{ id: 'm1m1m1m1', type: 'contention', texts: ['Computers lack semantics.'], collapsed: [], children: [
                    { id: 's4s4s4s4', type: 'support', texts: ['Computer programs are only formal.', 'Syntax by itself is not sufficient for semantics.', six], collapsed: [], children: [] } ] }];
                ensureCollabFields(state); render();
                const st = collectDeductiveSteps(state.trees).find(s => s.childId === 's4s4s4s4');
                return st ? deductiveStepTagText(st) : null;
            };
            return [run('If [S4](#box:s4s4s4s4), and if [S5](#box:s4s4s4s4.1), then computers lack semantics.'),
                run('If [S4](#box:s4s4s4s4) and [S5](#box:s4s4s4s4.1), then computers lack semantics.'),
                run('If [S4](#box:s4s4s4s4), and if [S5](#box:s4s4s4s4.1), then [S1](#box:m1m1m1m1).')];`);
        ok(searle.every(t => t === '✓ modus ponens, conditions together'),
            'a linked box is read as it is alone: "If [S4], and if [S5], then ..." -- or "and", or a link to the conclusion -- follows by modus ponens, conditions together (it had read "Computer" as a name)', JSON.stringify(searle));
        const typed = T(W, `
            state.trees = [{ id: 'mmmmmmmm', type: 'contention', texts: ['Minds are programs.'], collapsed: [], children: [
                { id: 'pppppppp', type: 'support', texts: ['If (Computers think), then minds are programs.', 'Computers think.'], collapsed: [], children: [] } ] }];
            ensureCollabFields(state); render();
            const st = collectDeductiveSteps(state.trees).find(s => s.childId === 'pppppppp');
            return st ? deductiveStepTagText(st) : null;`);
        ok(typed === '✓ modus ponens', 'so is a clause typed in brackets: "If (Computers think), ..."', typed);
    }

    console.log('\n-- (5) Editing: One click --');
    {
        const dbl = T(W, `__p.load(false); __p.press(__p.box('33333333-3333-4333-8333-333333333333', 0)); return { editing: __p.editing(), sel: selectedIds };`);
        ok(dbl.editing === null && JSON.stringify(dbl.sel) === JSON.stringify(['33333333-3333-4333-8333-333333333333-0']),
            'by default a click only selects a box', JSON.stringify(dbl));
        const one = T(W, `__p.load(false); toggleClickToEdit();
            const label = document.getElementById('click-edit-btn').textContent, stored = localStorage.getItem('argmap-click-edit');
            __p.press(__p.box('33333333-3333-4333-8333-333333333333', 0));
            const r = { label, stored, editing: __p.editing(), sel: selectedIds.slice() };
            __p.ta('33333333-3333-4333-8333-333333333333', 0).blur();
            __p.press(__p.box('22222222-2222-4222-8222-222222222222', 0), { shift: true });
            r.shift = __p.editing();
            toggleClickToEdit();
            r.back = document.getElementById('click-edit-btn').textContent;
            return r;`);
        ok(/^Edit: Single/.test(one.label) && one.stored === '1', 'the button says "Edit: Single" and the choice is kept', JSON.stringify(one));
        ok(one.editing === '33333333-3333-4333-8333-333333333333-0' && JSON.stringify(one.sel) === JSON.stringify(['33333333-3333-4333-8333-333333333333-0']),
            'with it on, a click on a box selects it and opens its text', JSON.stringify(one));
        ok(one.shift === null && /^Edit: Double/.test(one.back), 'a Shift-click still only selects; clicking again goes back to Double', JSON.stringify(one));
    }

    console.log('\n-- (6) Alt+Tab keeps the editor open --');
    {
        const away = T(W, `__p.load(false);
            editNodeText('33333333-3333-4333-8333-333333333333', 0);
            const ta = __p.ta('33333333-3333-4333-8333-333333333333', 0);
            ta.value = 'Rex is a big dog.'; ta.dispatchEvent(new Event('input', { bubbles: true }));
            // Another window takes the focus: the box is blurred, but stays the
            // page's focused element, and the page no longer has the focus.
            const had = document.hasFocus; document.hasFocus = () => false;
            ta.dispatchEvent(new FocusEvent('blur'));
            const during = { readOnly: ta.readOnly, shown: ta.style.display !== 'none' };
            document.hasFocus = had;
            ta.dispatchEvent(new FocusEvent('focus'));     // back again
            ta.value = 'Rex is a big brown dog.'; ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.blur();                                      // a real leave: the edit ends
            const after = { readOnly: ta.readOnly, text: __p.node('33333333-3333-4333-8333-333333333333').texts[0] };
            undo();
            return { during, after, undone: __p.node('33333333-3333-4333-8333-333333333333').texts[0] };`);
        ok(!away.during.readOnly && away.during.shown, 'leaving the window leaves the box open for editing', JSON.stringify(away));
        ok(away.after.readOnly && away.after.text === 'Rex is a big brown dog.', 'a real leave still ends the edit, keeping all of it', JSON.stringify(away));
        ok(away.undone === 'Rex is a dog.', 'and one undo takes back the whole edit, from before the window was left', JSON.stringify(away));
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();

function boxLabelOf(W, id, idx) { return JSON.parse(W.win.eval(`JSON.stringify(boxLinkLabel(${JSON.stringify(id)}, ${idx}))`)); }
