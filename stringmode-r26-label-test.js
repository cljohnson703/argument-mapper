'use strict';
// r26 String Mode / text-label regression.
//
// Covers the two r26 shorthand changes:
//   * support premises label as S (matching the S keyboard shortcut). The old
//     P-for-support reading has since been retired. A weak objection is -O
//     and a weak rebuttal -R; Q and P, their letters from r27.20 to r27.70,
//     still import (section 4);
//   * a PARENTHESIZED label marks that box implicit — "(M1S1a): ..." — in
//     both directions (export writes them, import reads them), per box, with
//     contentions and notes exempt (the app's own invariant).
//
// Run:  node stringmode-r26-label-test.js [argument-mapper-r26.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || (__dirname + '/argument-mapper-r26.html'), 'utf8');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function makeWin(label) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e))));
    function stubs(win) {
        const { webcrypto } = require('crypto');
        if (!win.crypto || !win.crypto.randomUUID) {
            Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
        }
        win.matchMedia = win.matchMedia || (() => ({
            matches: false, media: '', addListener() {}, removeListener() {},
            addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
        }));
        win.ResizeObserver = win.ResizeObserver || function () {
            return { observe() {}, unobserve() {}, disconnect() {} };
        };
        const ctx = new Proxy({}, {
            get: (_t, prop) => prop === 'measureText' ? (() => ({ width: 0 })) : (() => ctx)
        });
        win.HTMLCanvasElement.prototype.getContext = () => ctx;
        win.indexedDB = win.indexedDB || {
            open() { const req = {}; setTimeout(() => req.onerror && req.onerror({ target: { error: new Error('idb off') } }), 0); return req; },
            deleteDatabase() { const req = {}; setTimeout(() => req.onsuccess && req.onsuccess({}), 0); return req; }
        };
        win.requestAnimationFrame = win.requestAnimationFrame || (cb => win.setTimeout(() => cb(Date.now()), 0));
        win.cancelAnimationFrame = win.cancelAnimationFrame || win.clearTimeout;
        win.scrollTo = () => {};
        win.alert = () => {};
        win.confirm = () => true;
        win.prompt = () => null;
        win.open = () => null;
    }
    const dom = new JSDOM(HTML, {
        runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
        url: `https://localhost/${label}.html`, beforeParse: stubs
    });
    return { dom, errors, get win() { return dom.window; } };
}

let pass = 0, fail = 0;
function ok(cond, label, detail) {
    if (cond) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

// Load a state object into the app and return its text export.
function exportOf(W, trees) {
    return W.win.eval(`
        (function () {
            state.trees = ${JSON.stringify(trees)};
            ensureCollabFields(state);
            return generateTextRepresentation();
        })();
    `);
}
const parseOf = (W, text) => W.win.eval(`JSON.parse(JSON.stringify(parseTextToState(${JSON.stringify(text)})))`);
// Re-export a parsed result, to prove text -> state -> text is stable.
const reexportOf = (W, parsed) => exportOf(W, parsed.trees);

function findByText(trees, needle) {
    let hit = null;
    (function walk(ns) {
        (ns || []).forEach(n => {
            if ((n.texts || []).some(t => t === needle)) hit = n;
            walk(n.children);
        });
    })(trees);
    return hit;
}

(async () => {
    const W = makeWin('stringmode');
    await sleep(340);
    console.log('=== r26 String Mode labels: S for support, () for implicit ===');

    // --- 1. Export uses S, and parenthesizes implicit boxes --------------
    // (A note stands alone since r27, so it is a tree of its own beside the map.)
    const TREES = [{
        id: 'root', type: 'contention', texts: ['Main'], collapsed: [], x: 30000, y: 30000, children: [
            {
                id: 'sup', type: 'support', texts: ['Prem A', 'Prem B'],
                implicits: [true, false], collapsed: [], children: [
                    { id: 'obj', type: 'objection', texts: ['Obj'], collapsed: [], children: [
                        { id: 'reb', type: 'rebuttal', texts: ['Reb'], collapsed: [], children: [] }
                    ] }
                ]
            }
        ]
    }, { id: 'note1', type: 'note', texts: ['Note text'], collapsed: [], children: [], x: 29715, y: 30195, freePosition: true }];
    const text = exportOf(W, TREES);
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    ok(text.indexOf('P1') === -1, 'export: no legacy P labels remain', text.replace(/\n/g, ' | '));
    ok(lines.includes('M1: Main'), 'export: contention still labels M1');
    ok(lines.includes('(M1S1a): Prem A'), 'export: implicit co-premise is parenthesized with an S label', lines.join(' | '));
    ok(lines.includes('M1S1b: Prem B'), 'export: the non-implicit co-premise has NO parentheses');
    ok(lines.includes('M1S1aO1: Obj'), 'export: objection nests under the S-labeled support');
    ok(lines.includes('M1S1aO1R1: Reb'), 'export: rebuttal chain uses S in its ancestry');
    ok(lines.includes('N1: Note text'), 'export: note keeps N');

    // --- 2. Import reads S labels and parentheses ------------------------
    const parsed = parseOf(W, text);
    const sup = findByText(parsed.trees, 'Prem A');
    ok(!!sup && sup.type === 'support', 'import: S label produces a support node', sup && sup.type);
    ok(!!sup && sup.texts.length === 2 && sup.texts[1] === 'Prem B', 'import: co-premise joined the same node');
    ok(!!sup && !!sup.implicits && sup.implicits[0] === true, 'import: parenthesized box is implicit');
    ok(!!sup && !!sup.implicits && !sup.implicits[1], 'import: its non-parenthesized sibling is NOT implicit', JSON.stringify(sup && sup.implicits));
    ok(!!sup && sup.implicits.length === sup.texts.length, 'import: implicits array stays parallel with texts');
    const obj = findByText(parsed.trees, 'Obj');
    ok(!!obj && obj.type === 'objection', 'import: nested objection type survives');
    const reb = findByText(parsed.trees, 'Reb');
    ok(!!reb && reb.type === 'rebuttal', 'import: nested rebuttal type survives');
    const note = findByText(parsed.trees, 'Note text');
    ok(!!note && note.type === 'note', 'import: note type survives');

    // --- 3. Round-trip is stable -----------------------------------------
    const again = reexportOf(W, parsed);
    ok(again === text, 'round-trip: export -> import -> export is byte-identical',
        again === text ? '' : ('\n--- first ---\n' + text + '\n--- second ---\n' + again));

    // --- 4. -O and -R: weak objection and weak rebuttal -------------------
    // An objection or rebuttal, weakened. From r27.20 to r27.70 they were Q
    // and P (and P, before that, a legacy support letter); text written then
    // still imports, and is written back with -O and -R.
    {
        const weak = ['M1: Main', '  M1S1: Support', '    M1S1-O1: Weak objection',
            '      M1S1-O1-R1: Weak rebuttal', '      M1S1-O1S1: Backs the weak objection',
            '    M1S1O1: Strong objection'].join('\n');
        const wp = parseOf(W, weak);
        const q = findByText(wp.trees, 'Weak objection');
        ok(!!q && q.type === 'weak-objection', 'weak: -O imports as a weak objection', q && q.type);
        const p = findByText(wp.trees, 'Weak rebuttal');
        ok(!!p && p.type === 'weak-rebuttal' && !!q && q.children.some(c => c.texts[0] === 'Weak rebuttal'),
            'weak: -R imports as a weak rebuttal, under the weak objection', p && p.type);
        const s = findByText(wp.trees, 'Backs the weak objection');
        ok(!!s && s.type === 'support', 'weak: a support under a weak objection keeps S', s && s.type);
        // The hyphen is part of the letter, not a separator to skip: M1S1-O1
        // and M1S1O1 are two boxes, one weak and one not.
        const o = findByText(wp.trees, 'Strong objection'), sup = findByText(wp.trees, 'Support');
        ok(!!o && o.type === 'objection' && !!sup && sup.children.length === 2 && o.children.length === 0,
            'weak: M1S1-O1 and M1S1O1 are different boxes, a weak objection and an objection', JSON.stringify(sup && sup.children.map(c => c.type)));
        const again = reexportOf(W, wp);
        ok(again === weak, 'weak: re-exporting writes -O and -R back, byte for byte', again.replace(/\n/g, ' | '));

        const old = parseOf(W, ['M1: Main', '  M1S1: Support', '    M1S1Q1: Weak objection',
            '      M1S1Q1P1: Weak rebuttal', '      M1S1Q1S1: Backs the weak objection',
            '    M1S1O1: Strong objection'].join('\n'));
        const oq = findByText(old.trees, 'Weak objection'), op = findByText(old.trees, 'Weak rebuttal');
        ok(!!oq && oq.type === 'weak-objection' && !!op && op.type === 'weak-rebuttal',
            'weak: text from r27.20 to r27.70 still imports, Q as a weak objection and P as a weak rebuttal', JSON.stringify([oq && oq.type, op && op.type]));
        ok(reexportOf(W, old) === weak, 'weak: and is written back with -O and -R', reexportOf(W, old).replace(/\n/g, ' | '));
    }

    // --- 5. Parentheses are ignored where implicit cannot apply ----------
    {
        const p = parseOf(W, ['(M1): Main', '  (M1N1): A note'].join('\n'));
        const main = findByText(p.trees, 'Main');
        ok(!!main && main.type === 'contention' && !(main.implicits && main.implicits[0]),
            'guard: parentheses on a contention are ignored');
        const n = findByText(p.trees, 'A note');
        ok(!!n && n.type === 'note' && !(n.implicits && n.implicits[0]),
            'guard: parentheses on a note are ignored');
    }

    // --- 6. Implicit marks work on free-floating nodes too ---------------
    {
        const p = parseOf(W, ['@500,300: Free root', '(@500,300S1): Implicit child'].join('\n'));
        const kid = findByText(p.trees, 'Implicit child');
        ok(!!kid && kid.type === 'support' && !!kid.implicits && kid.implicits[0] === true,
            'free nodes: an implicit child of a free-floating root parses', kid && JSON.stringify(kid.implicits));
    }

    // --- 7. Cross-references tolerate parenthesized endpoints ------------
    {
        const src = ['M1: Main', '  (M1S1a): A', '  M1S1b: B', '  M1S2: C', '', 'Cross-references:', '(M1S1a) > M1S2'].join('\n');
        const p = parseOf(W, src);
        const a = findByText(p.trees, 'A');
        ok(!!a && !!a.crossRefs && (a.crossRefs[0] || []).length === 1,
            'cross-refs: a parenthesized source endpoint resolves', a && JSON.stringify(a.crossRefs));
        const c = findByText(p.trees, 'C');
        ok(!!a && !!c && a.crossRefs[0][0].targetId === c.id, 'cross-refs: it points at the right target');
    }

    // --- 8. Simple labels use S as well ----------------------------------
    {
        const simple = W.win.eval(`
            (function () {
                state.trees = ${JSON.stringify(TREES)};
                const m = computeSimpleLabels();
                return [m.get('sup-0'), m.get('obj-0'), m.get('reb-0'), m.get('note1-0'), m.get('root-0')];
            })();
        `);
        ok(simple[0] === 'S1', 'simple labels: support is S1', String(simple[0]));
        ok(simple[1] === 'O1' && simple[2] === 'R1' && simple[3] === 'N1' && simple[4] === 'M1',
            'simple labels: other types unchanged', JSON.stringify(simple));
    }

    // --- 9. Complex labels drive the on-canvas display too ---------------
    {
        const complex = W.win.eval(`
            (function () {
                state.trees = ${JSON.stringify(TREES)};
                const m = computeComplexLabels();
                return [m.get('sup-0'), m.get('sup-1'), m.get('obj-0')];
            })();
        `);
        ok(complex[0] === 'M1S1a' && complex[1] === 'M1S1b' && complex[2] === 'M1S1aO1',
            'complex labels: canvas labels use S', JSON.stringify(complex));
    }

    ok(W.errors.length === 0, 'no jsdom runtime errors', W.errors.slice(0, 2).join(' | '));

    console.log(`\n--- stringmode-r26-label: ${pass} passed, ${fail} failed ---`);
    try { W.win.close(); } catch (e) {}
    process.exit(fail ? 1 : 0);
})().catch(err => {
    console.error('HARNESS ERROR', err && err.stack || err);
    process.exit(2);
});
