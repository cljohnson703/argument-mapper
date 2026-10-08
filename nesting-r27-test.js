'use strict';
/**
 * Conditionals inside conditionals (the user, 2026-10-07: "The logic checker
 * seems to have trouble with nested if-thens, especially weird ones in
 * natural language, e.g. 'If W, then if X, then Y, then Z', which to me reads
 * as W -> (X -> Y) -> Z. Can we make sure that the logic checker is able to
 * handle complex expressions, both formal and in natural language, that
 * involve a lot of nesting?"). Each "if" is read with its own "then" (r27.93).
 * And, later the same day (r27.94): "W -> (X -> Y) -> Z" "is ambiguous
 * between" W → ((X → Y) → Z) and (W → (X → Y)) → Z, the reading meant; and
 * "maybe we should say, 'If X implies Y, then Z' rather than 'If, if', as
 * almost no one talks like that ... definitely don't default to suggesting
 * it as a disambiguation."
 *
 *   node nesting-r27-test.js [argument-mapper-r27.html]
 *
 * 1. The user's example: a "then" with no "if" of its own -- asked, the
 *    user's reading first, each reading said with "implies".
 * 2. Each "if" with its own "then": a condition that is itself an "if"
 *    ("if, if A, then B, then C", "if it is the case that if ...", "if if"),
 *    at any depth, beside denials and "either ... or".
 * 3. Steps on them: modus ponens and modus tollens on the outer "if",
 *    hypothetical syllogism, and what Derive Parent writes ("implies").
 * 4. "If A, if B, then C": the second "if" may add a condition or put one on
 *    the first -- asked.
 * 5. Conditions after a claim: a comma sets the last over all before it
 *    ("C if B, if A"); with none, asked; "C if, if A, then B".
 * 6. Slips, semicolons and brackets met on the way: "if if" with a "then"
 *    for each is no slip; "; and" is one "and"; "(it is not the case that A)
 *    and B" is a conjunction.
 * 7. Formulas: "→" twice with no brackets is asked; with brackets, any depth.
 *    And Help.
 * 8. The colors.
 * 9. "implies": "X implies Y implies Z" asked; "X implies that Y implies Z"
 *    and the user's wordings read as they say.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/nesting-test', virtualConsole: vc,
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
// A box as the check reads it: its structure ("(A → B)", "¬", "∧", "∨", a
// conditional's conditions joined by "&"), the readings it asks between, its notes.
W.eval(`window.__shape = function shape(f) {
    if (!f) return 'null';
    switch (f.kind) {
        case 'atom': return f.text.length < 3 ? f.text.toUpperCase() : '[' + f.text.split(String.fromCharCode(57344)).join('') + ']';
        case 'pred': return '[' + claimShowForm(f) + ']';
        case 'not': return '¬' + shape(f.inner);
        case 'and': case 'or': return '(' + f.parts.map(shape).join(f.iff ? ' ↔ ' : f.kind === 'and' ? ' ∧ ' : ' ∨ ') + ')';
        case 'if': return '(' + f.conds.map(shape).join(' & ') + ' → ' + shape(f.cons) + ')';
        case 'then': return '[' + f.parts.map(shape).join(' and then ') + ']';
        default: return f.kind;
    }
};`);
const read = t => ev(`var r = parseClaimFull(${J(t)});
    return { shape: __shape(r.form), kind: r.form && r.form.kind,
        asked: r.notes.filter(function (n) { return n.kind === 'ambiguous'; }).map(function (n) {
            return { message: n.message, readings: n.readings.map(function (l) { return claimRecase(claimLabel(l), ${J(t)}); }) }; }),
        notes: r.notes.map(function (n) { return n.kind + ': ' + n.message; }) };`);
const shape = t => t === undefined ? 'none' : read(t).shape;
// Its first question, or none.
const asked = r => r.asked[0] || { message: '', readings: [] };
// A step's tag, and, where it is asked about, the chooser's rows.
const step = (premises, conclusion) => ev(`
    state.trees = [{ id: 'M', type: 'contention', texts: [${J(conclusion)}], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ${J(premises)}, collapsed: [], children: [] } ] }];
    deductiveCache.clear(); ensureCollabFields(state); render();
    var s = collectDeductiveSteps(state.trees)[0], rows = [];
    if (s.ambiguous) { openReadingChooser(s, document.body);
        rows = Array.prototype.map.call(document.querySelectorAll('#reading-chooser .rc-row'), function (r) { return r.textContent; });
        closeReadingChooser(); }
    return { tag: deductiveStepTagText(s), rows: rows };`);
const derive = premises => ev(`var d = deriveConclusion(${J(premises)}); return d ? { rule: d.rule.name, text: d.text } : null;`);
// "if" twice in a row in what the checker offers: "if, if", "if it is the case that if".
const twiceIf = l => /\bif,? (?:it is the case that )?if\b/i.test(l);

console.log('\n-- 1. the user\'s example: a "then" with no "if" of its own --');
{
    const r = read('If W, then if X, then Y, then Z.');
    ok(r.kind === 'atom' && r.asked.length === 1 && /^a "then" has no "if" of its own/.test(asked(r).message), 'asked, not read one way', J(r));
    ok(J(asked(r).readings) === J(['if W implies that X implies Y, then Z', 'if W, then if X implies Y, then Z', 'if W, then if X, then first Y and then Z']),
        'the readings, said with "implies": the user\'s, (W → (X → Y)) → Z, first; then W → ((X → Y) → Z); then "first ... and then"', J(asked(r).readings));
    ok(shape(asked(r).readings[0]) === '((W & X → Y) → Z)', 'the first reads back as (W → (X → Y)) → Z', shape(asked(r).readings[0]));
    ok(shape(asked(r).readings[1]) === '(W & (X → Y) → Z)', 'the next as W → ((X → Y) → Z)', shape(asked(r).readings[1]));
    ok(shape(asked(r).readings[2]) === '(W & X → [Y and then Z])', 'the last as W → (X → (Y and then Z))', shape(asked(r).readings[2]));
    ok(!asked(r).readings.some(twiceIf), 'no reading says "if" twice in a row');
    const s = step(['If W, then if X, then Y, then Z.', 'W.'], 'If X implies Y, then Z.');
    ok(s.tag === '? ambiguous' && /the step follows by modus ponens/.test(s.rows[1]) && !/follows/.test(s.rows[0] + s.rows[2]),
        'a step on it waits, and the chooser shows which reading gives it', J(s));
    const words = read('If Poe is a raven, then if Poe flies, then Poe sings, then Mary is happy.');
    ok(J(asked(words).readings.slice(0, 2)) === J(['if Poe is a raven implies that Poe flies implies that Poe sings, then Mary is happy',
        'if Poe is a raven, then if Poe flies implies that Poe sings, then Mary is happy']) &&
        shape(asked(words).readings[0]) === '(([poe is a raven] & [poe flies] → [poe sings]) → [mary is happy])',
        'so in words: "implies that", the user\'s reading first', J(words.asked));
    const two = read('If it rains, then the roads get wet, then the game is off.');
    ok(two.asked.length === 1 && J(asked(two).readings) === J(['if it rains implies that the roads get wet, then the game is off',
        'if it rains, then first the roads get wet and then the game is off']), 'one "if", two "then"s: "implies", or "first ... and then"', J(two.asked));
    const three = read('If W, then X, then Y, then Z.');
    ok(three.asked.length === 1 && /^some "then"s have no "if" of their own/.test(asked(three).message) &&
        J(asked(three).readings) === J(['if it is the case that if W implies X, then Y, then Z']) && shape(asked(three).readings[0]) === '(((W → X) → Y) → Z)',
        'two "then"s too many: the "if" meant three times; an "if" whose own condition is one keeps "it is the case that if"', J(three.asked));
    const joined = read('If it rains and Poe flies, then Mary sings, then Bob dances.');
    ok(asked(joined).readings[0] === 'if both it rains and Poe flies implies that Mary sings, then Bob dances' &&
        shape(asked(joined).readings[0]) === '((([it rains] ∧ [poe flies]) → [mary sings]) → [bob dances])',
        'a condition of two joined claims is said "both ... and ... implies", so that it reads back as meant', J(joined.asked));
    const denied = read('If it is not the case that it rains, then Poe flies, then Bob dances.');
    ok(asked(denied).readings[0] === 'if it is the case that if it is not the case that it rains, then Poe flies, then Bob dances' &&
        shape(asked(denied).readings[0]) === '((¬[it rains] → [poe flies]) → [bob dances])',
        'where "implies" would not read back ("it is not the case that it rains implies ..." leaves its denial\'s scope open): "if it is the case that if"', J(denied.asked));
    const side = read('If if X, then Y, then Z, then W.');
    ok(J(asked(side).readings) === J(['if it is the case that if X implies Y, then Z, then W', 'if X implies Y, then first Z and then W']) &&
        shape(asked(side).readings[0]) === '(((X → Y) → Z) → W)', '"if if" side by side: either meant twice gives one claim, offered once', J(side.asked));
    const pair = read('If it rains, then Poe flies, and if Mary sings, then Bob dances, then Ann laughs.');
    ok(pair.asked.length === 1 && step(['If it rains, then Poe flies, and if Mary sings, then Bob dances, then Ann laughs.', 'It rains.'], 'Ann laughs.').rows[0] ===
        'If it rains, then Poe flies, and if Mary sings implies that Bob dances, then Ann laughs.',
        'in the second of two conditionals: asked once, each reading in the whole sentence', J(pair.asked));
    ok(shape('If it rains, then by then Poe flies.') === '([it rains] → [by then poe flies])' && !read('If it rains, then by then Poe flies.').asked.length,
        '"by then" says when: it closes no "if"', J(read('If it rains, then by then Poe flies.')));
}

console.log('\n-- 2. each "if" with its own "then" --');
{
    ['If, if X, then Y, then Z.', 'If if X, then Y, then Z.', 'If if X then Y, then Z.', 'If it is the case that if X, then Y, then Z.',
     'If it is true that if X, then Y, then Z.', 'If (if X, then Y), then Z.', 'If X implies Y, then Z.'].forEach(t =>
        ok(shape(t) === '((X → Y) → Z)', J(t) + ' is (X → Y) → Z', shape(t)));
    ok(shape('If it is not the case that if X, then Y, then Z.') === '(¬(X → Y) → Z)', 'a denied "if" as the condition', shape('If it is not the case that if X, then Y, then Z.'));
    ok(shape('If, if, if X, then Y, then Z, then W.') === '(((X → Y) → Z) → W)', 'three deep, on the left', shape('If, if, if X, then Y, then Z, then W.'));
    ok(shape('If if W, then if X, then Y, then Z.') === '((W & X → Y) → Z)', '(W → (X → Y)) → Z', shape('If if W, then if X, then Y, then Z.'));
    ok(shape('If W, then if, if X, then Y, then Z.') === '(W & (X → Y) → Z)', 'W → ((X → Y) → Z), with its "if"s', shape('If W, then if, if X, then Y, then Z.'));
    ok(shape('If, if W, then X, then if Y, then Z.') === '((W → X) & Y → Z)', '(W → X) → (Y → Z)', shape('If, if W, then X, then if Y, then Z.'));
    ok(shape('If W, then if X, then if Y, then Z.') === '(W & X & Y → Z)', 'on the right, as before', shape('If W, then if X, then if Y, then Z.'));
    ok(shape('If, if it rains, then Poe flies, Mary sings.') === '(([it rains] → [poe flies]) → [mary sings])', 'a comma closing the outer "if", its inner one closed by "then"');
    const short = read('If it is the case that if it rains, Poe flies, then Mary sings.');
    ok(short.kind === 'atom' && asked(short).message === 'with two "if"s, give each its own "then", or say the inner one with "implies"',
        'an inner "if" with no "then": the box says to give it one, or to say it with "implies"', J(short));
    const words = 'If it is the case that if it rains, then Poe flies, then Mary sings.';
    ok(shape(words) === '(([it rains] → [poe flies]) → [mary sings])' && !read(words).notes.length, 'in words, with no note', J(read(words)));
    ok(shape('If either it rains or if Poe flies, then Mary sings, then Bob dances.') === '(([it rains] ∨ ([poe flies] → [mary sings])) → [bob dances])',
        '"either ... or if": that "if" is the second part\'s own', shape('If either it rains or if Poe flies, then Mary sings, then Bob dances.'));
    ok(shape('If X, and if Y, then Z.') === '(X & Y → Z)' && shape('If X, then Y, and if Y, then Z.') === '((X → Y) ∧ (Y → Z))' &&
        shape('If it rains, then Poe flies, and then Mary sings.') === '([it rains] → ' + shape('Poe flies, and then Mary sings.') + ')',
        '"and if", a second conditional, and "and then" as before');
}

console.log('\n-- 3. steps on them --');
{
    const N = 'If it rains implies that Poe flies, then Mary sings.';
    ok(step([N, 'If it rains, then Poe flies.'], 'Mary sings.').tag === '✓ modus ponens', 'modus ponens on the outer "if"');
    ok(step([N, 'Mary does not sing.'], 'It is not the case that if it rains, then Poe flies.').tag === '✓ modus tollens', 'modus tollens on it');
    ok(!/^✓/.test(step([N, 'Mary sings.'], 'If it rains, then Poe flies.').tag), 'affirming the consequent: not certified');
    ok(step(['If, if, if X, then Y, then Z, then W.', 'If X implies Y, then Z.'], 'W.').tag === '✓ modus ponens', 'three deep: modus ponens');
    ok(step(['If W, then if X implies Y, then Z.', 'W.'], 'If X implies Y, then Z.').tag === '✓ modus ponens' &&
        step(['If W implies that X implies Y, then Z.', 'If W, then if X, then Y.'], 'Z.').tag === '✓ modus ponens',
        'the user\'s wordings: modus ponens on each');
    const d = derive([N, 'If Mary sings, then Bob dances.']);
    ok(d && d.text === 'If it rains implies that Poe flies, then Bob dances.' && step([N, 'If Mary sings, then Bob dances.'], d.text).tag === '✓ hypothetical syllogism',
        'Derive Parent writes a condition that is an "if" with "implies", and that reads back', J(d));
    const e = derive(['If it rains, then if it is the case that if Poe flies, then Mary sings, then Bob dances.', 'It rains.']);
    ok(e && e.text === 'If Poe flies implies that Mary sings, then Bob dances.', 'so from a box that says it with "if"s', J(e));
    const t = derive([N, 'Mary does not sing.']);
    ok(t && t.text === 'It is not the case that if it rains, then Poe flies.', 'and its modus tollens', J(t));
}

console.log('\n-- 4. "If A, if B, then C" --');
{
    const r = read('If it rains, if Poe flies, then Mary sings.');
    ok(r.kind === 'atom' && r.asked.length === 1 && J(asked(r).readings) === J(['if it rains, then if Poe flies, then Mary sings', 'if Poe flies implies that it rains, then Mary sings']),
        'asked: a second condition, or one on the first (said with "implies")', J(r.asked));
    ok(shape(asked(r).readings[0]) === '([it rains] & [poe flies] → [mary sings])' && shape(asked(r).readings[1]) === '(([poe flies] → [it rains]) → [mary sings])',
        'each reads back as itself');
    const c = read('If it rains, if Poe flies, Mary sings.');
    ok(c.asked.length === 1 && asked(c).readings.length === 2, 'so without "then"', J(c.asked));
    ok(shape('If it rains, and if Poe flies, Mary sings.') === '([it rains] & [poe flies] → [mary sings])', '"and if" adds a condition: not asked');
}

console.log('\n-- 5. conditions after a claim --');
{
    ok(shape('Mary sings if Poe flies, if it rains.') === '([it rains] & [poe flies] → [mary sings])', 'a comma before the last sets it over all before it');
    ok(shape('Mary sings, if Poe flies if it rains.') === '(([it rains] → [poe flies]) → [mary sings])', 'a comma before the first only: the second is the first\'s');
    const r = read('Mary sings if Poe flies if it rains.');
    ok(r.asked.length === 1 && J(asked(r).readings) === J(['if it rains, then Mary sings if Poe flies', 'if it rains implies that Poe flies, then Mary sings']),
        'no comma: asked (said with "implies")', J(r.asked));
    ok(shape('Z if, if X, then Y.') === '((X → Y) → Z)' && shape('W only if, if X, then Y.') === '(W & X → Y)' &&
        shape('Poe flies if, if it rains, then Mary sings.') === '(([it rains] → [mary sings]) → [poe flies])', '"if," and "only if," before an "if"');
    ok(shape('Only if, if it rains, then Poe flies, Mary sings.') === '([mary sings] & [it rains] → [poe flies])' &&
        shape('Provided that, if it rains, then Poe flies, then Mary sings.') === '(([it rains] → [poe flies]) → [mary sings])' &&
        shape('Provided that if it rains, then Poe flies, Mary sings.') === '(([it rains] → [poe flies]) → [mary sings])',
        '"only if" and "provided that" in front of a condition that is an "if"');
    ok(shape('Poe flies if it rains, and if Mary sings, then Bob dances.') === '(([it rains] → [poe flies]) ∧ ([mary sings] → [bob dances]))',
        'a conditional with its own "then" after one: two claims');
    ok(shape('Poe flies if it rains and if Mary sings.') === '([it rains] & [mary sings] → [poe flies])', 'without "then", a second condition as before');
    ok(!/\[ann sings,? then bob dances\]/i.test(shape('If it rains, then Poe flies, if Ann sings, then Bob dances.')),
        'no condition after a claim holds a "then" with no "if" of its own ("Ann sings, then Bob dances"): left unread', shape('If it rains, then Poe flies, if Ann sings, then Bob dances.'));
}

console.log('\n-- 6. slips, semicolons, brackets --');
{
    ok(!read('If if it rains, then Poe flies, then Mary sings.').notes.length, '"if if" with a "then" for each is no slip');
    ok(read('If if it rains, then Poe flies.').notes.some(n => /“if” twice/.test(n)), '"if if" with one "then" is still one');
    ok(shape('Poe flies; and Fido barks.') === '([poe flies] ∧ [fido barks])' && shape('Poe flies; but Fido barks.') === '([poe flies] ∧ [fido barks])',
        '"; and", "; but": one "and"');
    ok(shape('Poe flies; or Fido barks.') === '([poe flies] ∨ [fido barks])', '"; or": an "or"');
    ok(shape('If Poe flies, then Mary sings; and if Mary sings, then Bob dances.') === '(([poe flies] → [mary sings]) ∧ ([mary sings] → [bob dances]))' &&
        shape('If Poe flies, then Mary sings. And if Mary sings, then Bob dances.') === '(([poe flies] → [mary sings]) ∧ ([mary sings] → [bob dances]))',
        'two conditionals parted by a semicolon or a full stop');
    ok(shape('(it is not the case that the theory is true) and the roads are icy') === '(¬[the theory is true] ∧ [the roads are icy])' &&
        shape('(it is not the case that God exists) or the theory is true') === '(¬[god exists] ∨ [the theory is true])',
        'a bracketed denial first: the "and" after it is outside it');
}

console.log('\n-- 7. formulas, and Help --');
{
    const f = read('W → (X → Y) → Z'), g = read('W -> (X -> Y) -> Z');
    ok(f.kind === 'atom' && J(asked(f).readings) === J(['(W → (X → Y)) → Z', 'W → ((X → Y) → Z)']) && J(asked(g).readings) === J(['(W -> (X -> Y)) -> Z', 'W -> ((X -> Y) -> Z)']) &&
        asked(g).message === 'with no brackets, either "->" may be the main one',
        '"→" twice with no brackets: asked, each grouping bracketed, in the box\'s own arrows (the user: "ambiguous between" them)', J([f, g]));
    ok(shape(asked(f).readings[0]) === '((W & X → Y) → Z)' && shape(asked(f).readings[1]) === '(W & (X → Y) → Z)', 'each reads back as itself');
    ok(read('(P → Q → R) is true.').asked.length === 1, 'in English ("(P → Q → R) is true"): asked once');
    ok(asked(read('P → Q → R → S')).readings.length === 5 && J(asked(read('(P → Q → R) ∧ S')).readings) === J(['((P → Q) → R) ∧ S', '(P → (Q → R)) ∧ S']) &&
        asked(read('∀x (Fx → Gx → Hx)')).readings.length === 2 && !read('P → (Q → R)').asked.length && !read('(P → Q) → R').asked.length,
        'four parts: five groupings; inside brackets and under a quantifier too; with brackets, not asked');
    const s = step(['W → (X → Y) → Z', 'W'], '(X → Y) → Z');
    ok(s.tag === '? ambiguous' && /modus ponens/.test(s.rows[1]) && !/follows/.test(s.rows[0]) && step(['W → ((X → Y) → Z)', 'W'], '(X → Y) → Z').tag === '✓ modus ponens',
        'a step on it waits, and the chooser shows which grouping gives it; bracketed, modus ponens', J(s));
    ok(shape('((W → X) → Y) → Z') === '(((W → X) → Y) → Z)' && shape('(((P → Q) → R) → S) → T') === '((((P → Q) → R) → S) → T)', 'brackets on the left, at any depth');
    ok(shape('¬¬(P → (Q ∨ ¬(R ∧ (S → ¬T))))') === '¬¬(P → (Q ∨ ¬(R ∧ (S → ¬T))))', 'denials, "or" and "and" between');
    ok(step(['(X → Y) → Z', 'X → Y'], 'Z').tag === '✓ modus ponens' && step(['((P → Q) → R)', '¬R'], '¬(P → Q)').tag === '✓ modus tollens', 'modus ponens and tollens on them');
    ok(step(['P → (Q → (R → S))', 'P', 'Q', 'R'], 'S').tag === '✓ modus ponens, conditions together', 'conditions together');
    ok(/<em>implies<\/em> \(<em>If A implies B, then C<\/em>\)/.test(ev(`return document.getElementById('help-panel').innerHTML;`)),
        'Help says that "implies" settles the grouping');
}

console.log('\n-- 8. the colors --');
{
    // The premise's words by their part: [class, words] for each colored stretch.
    const painted = (premises, conclusion) => ev(`
        state.trees = [{ id: 'M', type: 'contention', texts: [${J(conclusion)}], collapsed: [], x: 0, y: 0, children: [
            { id: 'A', type: 'support', texts: ${J(premises)}, collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); inferenceColorsOn = true; inferenceColorsVersion = 2; render();
        applyInferenceColors(collectDeductiveSteps(state.trees));
        var out = Array.prototype.map.call(document.querySelectorAll('#surface .node[data-node-id="A"] .rendered-text'), function (el) {
            return Array.prototype.map.call(el.querySelectorAll('span.ic:not(.ic-rest)'), function (e) { return [e.className.replace(/^ic\\s+/, ''), e.textContent]; }); });
        inferenceColorsOn = false; render(); return out;`);
    const f = painted(['W → ((X → Y) → Z)', 'W'], '(X → Y) → Z');
    ok(J(f[0]) === J([['ic-k0', 'W'], ['ic-c', '(X → Y) → Z']]), 'in a formula, what goes on takes in the brackets that pair inside it: "(X → Y) → Z"', J(f));
    const e = painted(['If Poe flies implies that Mary sings, then Bob dances.', 'If Poe flies, then Mary sings.'], 'Bob dances.');
    ok(J(e[0]) === J([['ic-k0', 'Poe flies'], ['ic-k1', 'Mary sings'], ['ic-c', 'Bob dances']]) && J(e[1]) === J([['ic-k0', 'Poe flies'], ['ic-k1', 'Mary sings']]),
        'in words: the condition that is an "if" in the colors of the premise it meets, and "Bob dances" goes on', J(e));
}

console.log('\n-- 9. "implies" --');
{
    const r = read('X implies Y implies Z.');
    ok(r.kind === 'atom' && J(asked(r).readings) === J(['if X implies Y, then Z', 'X implies that Y implies Z']) && asked(r).message === '"implies" twice: either may be the main one',
        '"implies" twice with nothing to say which is the main one: asked, as "→" twice is', J(r));
    ok(shape(asked(r).readings[0]) === '((X → Y) → Z)' && shape(asked(r).readings[1]) === '(X & Y → Z)', 'each reads back as itself');
    ok(asked(read('Poe flies implies Mary sings implies Bob dances.')).readings[0] === 'if Poe flies implies that Mary sings, then Bob dances', 'in words, with "that"');
    ok(shape('X implies that Y implies Z.') === '(X & Y → Z)' && !read('X implies that Y implies Z.').asked.length, '"implies that" says which: not asked');
    ok(shape('If it rains implies that Poe flies, then Mary sings.') === '(([it rains] → [poe flies]) → [mary sings])' &&
        shape('If W implies that X implies Y, then Z.') === '((W & X → Y) → Z)' && shape('W implies that if X implies Y, then Z.') === '(W & (X → Y) → Z)' &&
        shape('If W, then if X implies Y, then Z.') === '(W & (X → Y) → Z)', 'the user\'s wordings read as they say');
    ok(shape('Both it rains and Poe flies implies that Mary sings.') === '(([it rains] ∧ [poe flies]) → [mary sings])' &&
        shape('Either it rains or Poe flies implies that Mary sings.') === '(([it rains] ∨ [poe flies]) → [mary sings])' &&
        shape('Neither it rains nor Poe flies implies that Mary sings.') === '((¬[it rains] ∧ ¬[poe flies]) → [mary sings])' &&
        shape('Either it is not the case that it rains or Poe flies implies that Mary sings.') === '((¬[it rains] ∨ [poe flies]) → [mary sings])',
        '"both", "either", "neither" before "implies": what implies is all of it, as after "if"');
    const j = read('It rains and Poe flies implies that Mary sings.');
    ok(j.kind === 'atom' && J(asked(j).readings) === J(['both it rains and Poe flies implies that Mary sings', 'it rains, and Poe flies implies that Mary sings']),
        'with nothing to say which: asked', J(j));
    ok(shape('It rains, and Poe flies implies that Mary sings.') === '([it rains] ∧ ([poe flies] → [mary sings]))', 'a comma before "and": "implies" goes with the last');
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
