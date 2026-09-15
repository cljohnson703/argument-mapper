'use strict';
// r27 Map string: separate trees are named by type, and placed by Positions.
//
// A tree that is not attached to a main contention used to be labeled by its
// canvas coordinates (@29715,30195), which lost its type -- a note came back
// as an untyped box, and an objection's rebuttals then derived as objections
// -- and placed it by ABSOLUTE coordinates, while the importer always put M1
// at the center, so trees landed on top of the main argument. Now:
//   - a separate tree is named the way a main contention is, by the letter of
//     its top box and a number: N1, O1, O2, S1; everything below it is
//     labeled as usual (O1aR1b);
//   - a closing "Positions:" list gives each tree other than M1 an offset from
//     M1, "N1 @ -285,+195", so the arrangement survives an import anywhere;
//   - listed trees come back pinned (main contentions laid out from their
//     spot); a named tree left off the list is placed beside the map;
//   - the old @x,y labels still import, as absolute coordinates.
// Untyped boxes were retired since: a new node is a support. Text written
// while they lasted named them X, and an untyped box arriving from an older
// copy is read as a support; both come back as supports.
//
// Covers:
//   (1) export: names, the Positions list (relative, signed), no @x,y;
//   (2) import: types, pins and offsets from wherever M1 lands;
//   (3) a round trip is byte-identical;
//   (4) an arrangement moves together: M1 far from the center still exports
//       the same offsets;
//   (5) hand-written text: no Positions entry, unsigned offsets, stray names,
//       and no main contention at all;
//   (6) old @x,y text, X text, untyped boxes, simple labels, cross-references;
//   (7) Help.
//
// Run:  node stringmode-r27-positions-test.js [argument-mapper-r27.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || (__dirname + '/argument-mapper-r27.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

let pass = 0, fail = 0;
function ok(cond, label, detail) {
    if (cond) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}
const J = JSON.stringify;
const exportOf = (W, trees) => W.win.eval(`(function () { state.trees = ${J(trees)}; ensureCollabFields(state); return generateTextRepresentation(); })()`);
const parseOf = (W, text) => W.win.eval(`JSON.parse(JSON.stringify(parseTextToState(${J(text)})))`);
function find(trees, text) {
    let hit = null;
    (function walk(ns) { (ns || []).forEach(n => { if ((n.texts || []).includes(text)) hit = n; walk(n.children); }); })(trees);
    return hit;
}
const N = (id, type, texts, children, extra) => Object.assign({ id, type, texts: [].concat(texts), collapsed: [], children: children || [] }, extra || {});

// A main argument, and beside it separate trees of several kinds. `plain` is
// the type of the two plain boxes, s2 and sep: a support, or the retired
// untyped box an older copy could still hand over.
function fixture(mx, my, plain) {
    plain = plain || 'support';
    return [
        N('m1', 'contention', 'The zombie argument is unsound', [
            N('s1', 'support', ['Zombies are possible', 'If possible, then non-physical'], [
                N('s2', plain, 'A support below')
            ], { crossRefs: [[{ targetId: 'note', targetIdx: 0 }], []] })
        ], { x: mx, y: my }),
        N('note', 'note', 'A zombie is a creature that lacks consciousness', [], { x: mx - 285, y: my + 195, freePosition: true }),
        N('obj1', 'objection', ['Possible relative to some framework', 'Impossible relative to another'], [
            N('r1', 'rebuttal', 'If possible, then possible relative to some framework'),
            Object.assign(N('r2', 'rebuttal', 'Impossible relative to functionalism'), { targetIndex: 1 })
        ], { x: mx + 800, y: my + 1245, freePosition: true }),
        N('obj2', 'objection', 'Conceivable but not possible', [ N('r3', 'rebuttal', 'See cross-reference') ],
            { x: mx + 723, y: my + 1886, freePosition: true }),
        N('sep', plain, 'A separate support', [], { x: mx + 1500, y: my, freePosition: true }),
        N('m2', 'contention', 'A second main contention', [], { x: mx + 1200, y: my })
    ];
}

(async () => {
    console.log('=== r27 map string: named separate trees and Positions ===');
    const W = makeWin('positions');
    await sleep(300);

    /* ---------------- 1. export ---------------- */
    console.log('\n-- export --');
    const text = exportOf(W, fixture(30000, 30000));
    const lines = text.split('\n');
    const trimmed = lines.map(l => l.trim());
    ok(trimmed.includes('N1: A zombie is a creature that lacks consciousness'), 'a separate note is named N1', text);
    ok(trimmed.includes('O1a: Possible relative to some framework') && trimmed.includes('O1b: Impossible relative to another') &&
       trimmed.includes('O1aR1: If possible, then possible relative to some framework') && trimmed.includes('O1bR1: Impossible relative to functionalism'),
        'a separate objection with two co-premises is O1a/O1b, and its rebuttals O1aR1 and O1bR1');
    ok(trimmed.includes('O2: Conceivable but not possible') && trimmed.includes('O2R1: See cross-reference'), 'the second separate objection is O2');
    ok(trimmed.includes('S1: A separate support') && trimmed.includes('M1S1aS1: A support below'), 'a separate support is S1, and a support below another is labeled as always');
    ok(trimmed.includes('M2: A second main contention'), 'a second main contention is still M2');
    ok(!/@\d+,\d+/.test(text), 'no label carries coordinates any more');
    ok(!/^\s*\(?\[?[A-Z0-9a-z]*X\d/m.test(text), 'and no label uses X');
    const pi = lines.indexOf('Positions:'), ci = lines.indexOf('Cross-references:');
    const positions = pi >= 0 ? lines.slice(pi + 1, ci > pi ? ci : undefined).filter(Boolean) : [];
    ok(J(positions) === J(['N1 @ -285,+195', 'O1 @ +800,+1245', 'O2 @ +723,+1886', 'S1 @ +1500,+0', 'M2 @ +1200,+0']),
        'a closing Positions list gives every other tree its signed offset from M1', J(positions));
    ok(pi > 0 && lines[pi - 1] === '' && ci > pi && lines[ci - 1] === '' && lines.slice(pi).every(l => !/: /.test(l) || l === ''),
        'it sits after the node lines, before Cross-references, set off by a blank line');
    ok(lines.slice(ci + 1).includes('M1S1a > N1'), 'cross-references name separate trees the same way', lines.slice(ci).join(' | '));

    /* ---------------- 2. import ---------------- */
    console.log('\n-- import --');
    const parsed = parseOf(W, text);
    const t = parsed.trees;
    const byText = s => find(t, s) || {};
    const note = byText('A zombie is a creature that lacks consciousness'), obj1 = byText('Possible relative to some framework'),
          obj2 = byText('Conceivable but not possible'), sep = byText('A separate support'), m1 = byText('The zombie argument is unsound'),
          m2 = byText('A second main contention');
    ok(note.type === 'note' && obj1.type === 'objection' && obj2.type === 'objection' && sep.type === 'support',
        'each separate tree keeps its type: note, objection, objection, support', J([note.type, obj1.type, obj2.type, sep.type]));
    ok(byText('A support below').type === 'support', 'and a support below another comes back a support');
    ok((obj1.texts || []).length === 2 && (obj1.children || []).length === 2 && obj1.children[1].targetIndex === 1,
        'O1 keeps both co-premises and which of them each rebuttal answers');
    const kinds = W.win.eval(`(function () { var m = computeArgumentKinds(${J(t)}); var o = {}; m.forEach(function (v, k) { o[k] = v.kind; }); return o; })()`);
    ok(kinds[obj1.children[0].id] === 'rebuttal' && kinds[obj2.children[0].id] === 'rebuttal',
        'so the rebuttals still derive as rebuttals (under a box that lost its type they would turn into objections)', J(kinds));
    ok(m1.x === 30000 && m1.y === 30000 && !m1.freePosition, 'M1 lands at the center, laid out', J([m1.x, m1.y, m1.freePosition]));
    ok(note.x === 30000 - 285 && note.y === 30000 + 195 && note.freePosition === true &&
       obj1.x === 30800 && obj1.y === 31245 && obj1.freePosition === true && sep.x === 31500 && sep.freePosition === true,
        'listed trees sit at their offsets from M1, pinned', J([note.x, note.y, obj1.x, obj1.y, sep.x]));
    ok(m2.x === 31200 && m2.y === 30000 && !m2.freePosition, 'a listed main contention is laid out from its spot, not pinned', J([m2.x, m2.y, m2.freePosition]));
    const s1 = byText('Zombies are possible');
    ok(!!(s1.crossRefs && s1.crossRefs[0] && s1.crossRefs[0][0] && s1.crossRefs[0][0].targetId === note.id),
        'a cross-reference to N1 finds the note', J(s1.crossRefs));
    ok(!t.some(tree => (tree.texts || []).some(x => /^Positions/.test(x))) && t.length === 6, 'the Positions header makes no node', J(t.length));

    /* ---------------- 3. round trip ---------------- */
    console.log('\n-- round trip --');
    const again = exportOf(W, t);
    ok(again === text, 'export, import, export is byte-identical', again === text ? '' : '\n' + again);

    /* ---------------- 4. an arrangement moves together ---------------- */
    console.log('\n-- arrangement --');
    {
        const far = exportOf(W, fixture(12000, 8000));
        ok(far === text, 'with M1 far from the center, the text is exactly the same: offsets, not coordinates', far === text ? '' : '\n' + far);
        const p = parseOf(W, far);
        const n = find(p.trees, 'A zombie is a creature that lacks consciousness'), m = find(p.trees, 'The zombie argument is unsound');
        ok(n.x - m.x === -285 && n.y - m.y === 195, 'so importing it anywhere keeps the note 285 left of M1 and 195 below', J([n.x - m.x, n.y - m.y]));
    }

    /* ---------------- 5. hand-written text ---------------- */
    console.log('\n-- hand-written --');
    {
        const p = parseOf(W, ['M1: Main', '  M1S1: A support', 'N1: A note with no position', 'O1: An objection', '',
            'Positions:', 'O1 @ 40, 60', 'Q7 @ +10,+10'].join('\n'));
        const m = find(p.trees, 'Main'), n = find(p.trees, 'A note with no position'), o = find(p.trees, 'An objection');
        ok(n.type === 'note' && !n.freePosition && n.x > m.x, 'a named tree left off the list is laid out beside the map, not pinned', J([n.x, n.freePosition]));
        ok(o.x === m.x + 40 && o.y === m.y + 60 && o.freePosition === true, 'unsigned, spaced offsets read as offsets', J([o.x - m.x, o.y - m.y]));
        ok(p.trees.length === 3, 'an entry naming no tree is ignored', J(p.trees.length));

        const solo = parseOf(W, ['N1: First note', 'N2: Second note', '', 'Positions:', 'N2 @ +300,-40'].join('\n'));
        const a = find(solo.trees, 'First note'), b = find(solo.trees, 'Second note');
        ok(a.x === 30000 && a.y === 30000 && b.x === 30300 && b.y === 29960 && b.freePosition === true,
            'with no main contention, offsets count from the first tree', J([a.x, a.y, b.x, b.y]));
        const soloText = exportOf(W, solo.trees);
        ok(/\nPositions:\nN2 @ \+300,-40$/.test(soloText), 'and export writes them that way', soloText);
    }

    /* ---------------- 6. older text, untyped boxes, cross-references ---------------- */
    console.log('\n-- older text, untyped boxes, cross-references --');
    {
        const old = parseOf(W, ['M1: Main', '@29715,30195: A free box, before types were written', '  @29715,30195S1: Its support', '',
            'Cross-references:', 'M1 > @29715,30195'].join('\n'));
        const f = find(old.trees, 'A free box, before types were written');
        ok(f && f.x === 29715 && f.y === 30195 && f.freePosition === true && f.children.length === 1,
            'old @x,y labels still import, at those coordinates, pinned', J(f && [f.x, f.y, f.freePosition]));
        ok(f && f.type === 'support', 'a box they left untyped comes back a support, as a new node is', J(f && f.type));
        const main = find(old.trees, 'Main');
        ok(main && main.crossRefs && main.crossRefs[0][0].targetId === f.id, 'and old cross-references to them still resolve');
        const upgraded = exportOf(W, old.trees);
        ok(/^S1: A free box, before types were written$/m.test(upgraded) && /^S1 @ -285,\+195$/m.test(upgraded) && /^M1 > S1$/m.test(upgraded),
            'exported again, it uses the new names and Positions', upgraded);

        const xText = parseOf(W, ['M1: Main', '  M1X1: Written while untyped boxes lasted', 'X1: A separate one', '', 'Positions:', 'X1 @ +400,+0'].join('\n'));
        const xc = find(xText.trees, 'Written while untyped boxes lasted'), xs = find(xText.trees, 'A separate one'), xm = find(xText.trees, 'Main');
        ok(xc && xc.type === 'support' && xs && xs.type === 'support' && xs.x === xm.x + 400 && xs.freePosition === true,
            'text that named untyped boxes X still imports: as supports, placed by their Positions entry', J([xc && xc.type, xs && xs.type, xs && xs.x - xm.x]));
        ok(/^S1: A separate one$/m.test(exportOf(W, xText.trees)), 'and exports with S names');

        const stray = exportOf(W, fixture(30000, 30000, 'neutral'));
        ok(stray === text, 'an untyped box handed over by an older copy exports exactly as the support it now is', stray === text ? '' : '\n' + stray);
        const simple = W.win.eval(`(function () { state.trees = ${J(fixture(30000, 30000, 'neutral'))}; var m = computeSimpleLabels(); return [m.get('s2-0'), m.get('sep-0'), m.get('note-0')]; })()`);
        ok(simple[0] === 'S3' && simple[1] === 'S4' && simple[2] === 'N1', 'and simple labels count it among the supports', J(simple));
    }

    /* ---------------- 7. Help ---------------- */
    console.log('\n-- Help --');
    {
        const h = W.win.eval(`document.getElementById('help-panel').innerHTML`);
        ok(/<strong>N1<\/strong> is the first separate note/.test(h) && !/<strong>X<\/strong>/.test(h) && !/not typed yet/.test(h),
            'Help names separate trees by letter, and no longer mentions X');
        ok(/a <strong>Positions<\/strong> list says where each separate tree sits, as an offset in pixels from main contention 1: <strong>N1 @ -285,\+195<\/strong>/.test(h) &&
           /Older text named free trees by coordinates/.test(h), 'and describes the Positions list and older text');
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
