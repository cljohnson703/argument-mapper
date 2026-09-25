'use strict';
// r27 Deductive check: which steps of a map follow of necessity.
//
// A step is one premise box with its co-premises, and the box it supports.
// The check reads the sentences AS WRITTEN -- no formalization field, no
// guessing at meaning -- and can only CERTIFY a step. A step it does not
// recognize is left unmarked; that is the limit of the reader, not a verdict
// against the argument.
//
// The reader turns a sentence into one of: an atom (an unanalyzed sentence),
// a predication ("Poe is a raven", "consciousness must depend on x"), a
// universal ("all F are G", "every F is G", "any F is G", "everything is G",
// "no F is G", "all things that must depend on x are G"), an existential
// ("some F is G", "something is G", "there is a F", "there exists a F that is
// G", "at least one F is G"), a denial ("not", "can't", "cannot", "doesn't",
// "is false", "it is not the case that"), a conjunction, a disjunction, or a
// conditional -- read as written: "if X, and if Y, then Z" has two
// conditions, "if X and Y, then Z" one condition that is a conjunction.
// An "and" between nouns ("lights and circuitry can think") is not read as a
// conjunction of claims. A prover then works back from the conclusion, so a
// step may use several rules; it is named by the one that reaches the
// conclusion, with the rest listed.
//
// Covers:
//   (1) the reader: every phrasing above, and what it refuses to read;
//   (2) each rule, arguments from real maps, and near-misses that must NOT
//       be certified;
//   (3) steps over a map: co-premises are joint; an objection or rebuttal,
//       weak or not, is checked against the denial of what it objects to;
//       notes are not premises; the supported box is the one the arrow meets;
//   (4) the list of steps: rows, summary, jumping, opening on one step;
//   (5) derivation tags: K on every step, following edits; Shift+K and the
//       context menu for one step; a tag's click opens the list; where the
//       tags sit -- the middle of the fork, clear of IMPLICIT tags and of
//       each other;
//   (6) Help.
//
// Run:  node logic-r27-deductive-test.js [argument-mapper-r27.html]
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
const T = (W, body) => {
    try { return JSON.parse(W.win.eval(`JSON.stringify((function () { ${body} })())`)); }
    catch (e) { return { __error: String((e && e.message) || e) }; }
};
const J = JSON.stringify;

// A map with one step of each shape.
//   M  "Poe is black"
//   ├─ [A] "If Poe is a raven, then Poe is black" + "Poe is a raven"        modus ponens
//   ├─ [B] "Poe is a bird"                                                   not certified
//   ├─ [C] objection "Poe is a crow"                                         not certified
//   ├─ [D] objection "If Poe is white, then Poe is not black" + "Poe is white"  modus ponens, to the denial
//   ├─ [E] weak objection "It is not the case that Poe is black"    a bare denial: not certified
//   └─ [NT] an attached note (from an older map)                    not a step
//   plus a second tree for the conjunction, and a free note
const MAP = [
    { id: 'M', type: 'contention', texts: ['Poe is black'], collapsed: [], x: 30000, y: 30000, children: [
        { id: 'A', type: 'support', texts: ['If Poe is a raven, then Poe is black', 'Poe is a raven'], collapsed: [], children: [] },
        { id: 'B', type: 'support', texts: ['Poe is a bird'], collapsed: [], children: [] },
        { id: 'C', type: 'objection', texts: ['Poe is a crow'], collapsed: [], children: [] },
        { id: 'D', type: 'objection', texts: ['If Poe is white, then Poe is not black', 'Poe is white'], collapsed: [], children: [] },
        { id: 'E', type: 'weak-objection', texts: ['It is not the case that Poe is black'], collapsed: [], children: [] },
        { id: 'NT', type: 'note', texts: ['An aside'], collapsed: [], children: [] }
    ] },
    { id: 'G', type: 'contention', texts: ['The sky is blue and grass is green'], collapsed: [], x: 31000, y: 30000, children: [
        { id: 'GA', type: 'support', texts: ['The sky is blue', 'Grass is green'], collapsed: [], children: [
            { id: 'GAA', type: 'support', texts: ['Everything is visible'], collapsed: [], children: [] }
        ] }
    ] },
    { id: 'N', type: 'note', texts: ['A note is not a premise'], collapsed: [], x: 29000, y: 30500, freePosition: true, children: [] }
];

(async () => {
    console.log('=== r27 deductive check ===');
    const W = makeWin('logic');
    await sleep(250);

    /* ---------------- 1. reading a sentence ---------------- */
    console.log('\n-- reading a sentence --');
    {
        // Keys: P term|property, U/E subject|predicate, N(...) denial,
        // C[...] and, D[...] or, I(conditions>consequent). A property is
        // "=..." after a copula, "~..." for any other verb, "¬" when denied.
        const SENTENCES = [
            ['The sky is blue', 'P:the sky|=blue'],
            ['Poe is a raven', 'P:poe|=raven'],
            ['It rains', 'P:it|~rain'],
            ['Consciousness depends on the brain', 'P:consciousness|~depend on the brain'],
            ['Consciousness must depend on other non-physical factors', 'P:consciousness|~must depend on other non-physical factors'],
            ['All ravens are black', 'U:=raven|=black'],
            ['Every raven is black', 'U:=raven|=black'],
            ['Each raven is black', 'U:=raven|=black'],
            ['Any raven is black', 'U:=raven|=black'],
            ['Everything is black', 'U:∀any|=black'],
            ['Everything that is a raven is black', 'U:=raven|=black'],
            ['All black things are dark', 'U:=black|=dark'],
            ['All things that must depend on other non-physical factors are non-physical', 'U:~must depend on other non-physical factors|¬=physical'],
            ['No raven is white', 'U:=raven|¬=white'],
            ['Some ravens are black', 'E:=raven|=black'],
            ['Something is black', 'E:∀any|=black'],
            ['There is a raven', 'E:∀any|=raven'],
            ['There exists a raven', 'E:∀any|=raven'],
            ['There is a raven that is black', 'E:=raven|=black'],
            ['At least one raven is black', 'E:=raven|=black'],
            ['At least one metaphysical framework in which zombies are not possible is not ruled out',
                'E:=metaphysical framework in which zombies are not possible|¬=ruled out'],
            ['The sky is not blue', 'N(P:the sky|=blue)'],
            ['Functionalism is false', 'N(P:functionalism|=true)'],
            ["A mere series of flashing lights and control circuitry can't produce consciousness",
                'N(P:a mere series of flashing lights and control circuitry|~can produce consciousness)'],
            ['A mere series of flashing lights and control circuitry cannot produce consciousness',
                'N(P:a mere series of flashing lights and control circuitry|~can produce consciousness)'],
            ["Consciousness doesn't depend on the brain", 'N(P:consciousness|~depend on the brain)'],
            ['Lights must not produce consciousness', 'P:lights|~must not produce consciousness'],
            ['It is not the case that it rains', 'N(P:it|~rain)'],
            // In order: order and grouping are content (commutation and association change them).
            ['The sky is blue and grass is green', 'C[P:the sky|=blue;P:grass|=green]'],
            ['Either it is raining or it is snowing', 'D[P:it|=raining;P:it|=snowing]'],
            ['If it rains, then the ground is wet', 'I(P:it|~rain>P:the ground|=wet)'],
            ['If it rains then the ground is wet', 'I(P:it|~rain>P:the ground|=wet)'],
            ['If it rains, and if it is cold, then it snows', 'I(P:it|~rain&P:it|=cold>P:it|~snow)'],
            ['If it rains and it is cold, then it snows', 'I(C[P:it|~rain;P:it|=cold]>P:it|~snow)'],
            ['It rains only if it is cloudy', 'I(P:it|~rain>P:it|=cloudy)'],
            ['If it rains, then if it is cold, then it snows', 'I(P:it|~rain&P:it|=cold>P:it|~snow)'],
            ['**Poe** is a _raven_', 'P:poe|=raven'],
            ['Poe is a raven.', 'P:poe|=raven']
        ];
        const read = T(W, `var out = {};
            ${J(SENTENCES)}.forEach(function (c) { out[c[0]] = [claimKey(parseClaim(c[0])), c[1]]; });
            return out;`);
        const wrong = Object.entries(read).filter(([, v]) => v[0] !== v[1]);
        ok(wrong.length === 0, 'every phrasing reads as the form it states (' + Object.keys(read).length + ' sentences)',
            wrong.map(([k, v]) => k + ': ' + v[0] + ' ≠ ' + v[1]).join(' | '));

        const same = T(W, `return {
            order: claimKey(parseClaim('The sky is blue and grass is green')) === claimKey(parseClaim('Grass is green and the sky is blue')),
            plural: claimKey(parseClaim('All ravens are black')) === claimKey(parseClaim('Every raven is black')),
            article: claimKey(parseClaim('Poe is a raven')) === claimKey(parseClaim('Poe is the raven')),
            distinct: claimKey(parseClaim('Poe is a raven')) !== claimKey(parseClaim('Poe is a crow')),
            conditions: claimKey(parseClaim('If it rains, and if it is cold, then it snows')) === claimKey(parseClaim('If it is cold, and if it rains, then it snows')),
            asWritten: claimKey(parseClaim('If it rains, and if it is cold, then it snows')) !== claimKey(parseClaim('If it rains and it is cold, then it snows')),
            exportation: claimKey(parseClaim('If it rains, then if it is cold, then it snows')) === claimKey(parseClaim('If it rains, and if it is cold, then it snows')) &&
                claimKey(parseClaim('If it rains, then if it is cold, then it snows')) !== claimKey(parseClaim('If it rains and it is cold, then it snows')),
            verbForms: claimKey(parseClaim('Consciousness depends on the brain')) === claimKey(parseClaim('Consciousness does depend on the brain')),
            phrasalAnd: parseClaim('A mere series of flashing lights and control circuitry can produce consciousness').kind === 'pred',
            empty: parseClaim('   ') === null
        };`);
        ok(!same.order && same.plural && same.article && same.distinct && !same.conditions && same.verbForms && same.empty,
            'the same claim in different words reads the same; different claims, and the same parts in another order, do not', J(same));
        ok(same.exportation === true,
            '"if X, then if Y, then Z" is "if X, and if Y, then Z" (exportation), and still not "if X and Y, then Z"', J(same));
        ok(same.asWritten === true,
            '"if X, and if Y, then Z" has two conditions; "if X and Y, then Z" one condition that is a conjunction', J(same));
        ok(same.phrasalAnd === true,
            'an "and" between nouns is not a conjunction of claims: "lights and circuitry can produce consciousness" is one claim', J(same));
    }

    /* ---------------- 1b. denials ---------------- */
    console.log('\n-- denials --');
    {
        // claimDenies(a, b): is a the denial -- the contradictory -- of b?
        const DENIES = [
            // The square of opposition: all F are G <-> some F is not G.
            ['Some ravens are not black', 'All ravens are black'],
            ["Some raven isn't black", 'All ravens are black'],
            ['At least one raven is not black', 'All ravens are black'],
            ["At least one raven isn't black", 'Every raven is black'],
            ['Not all ravens are black', 'All ravens are black'],
            ['Not every raven is black', 'Each raven is black'],
            ['It is not the case that all ravens are black', 'All ravens are black'],
            ["It's not the case that every raven is black", 'All ravens are black'],
            ['There is a raven that is not black', 'All ravens are black'],
            // no F is G <-> some F is G.
            ['Some raven is white', 'No raven is white'],
            ['At least one raven is white', 'No ravens are white'],
            ['There is a raven that is white', 'None of the ravens are white'],
            ['It is not the case that no raven is white', 'Not a single raven is white'],
            // everything / nothing.
            ['Something is not physical', 'Everything is physical'],
            ['Not everything is physical', 'Everything is physical'],
            ["Something isn't physical", 'Everything is physical'],
            ['Something is physical', 'Nothing is physical'],
            ['There is something that is physical', 'There is nothing that is physical'],
            // there is.
            ['There is no raven', 'There is a raven'],
            ["There isn't a raven that is white", 'Some raven is white'],
            ['There is no raven that is white', 'At least one raven is white'],
            // Sentences: on the auxiliary, in front, or by "false".
            ['Functionalism is not true', 'Functionalism is true'],
            ["Functionalism isn't true", 'Functionalism is true'],
            ['Functionalism is false', 'Functionalism is true'],
            ["It's not the case that functionalism is true", 'Functionalism is true'],
            ['It is false that functionalism is true', 'Functionalism is true'],
            ["Lights can't produce consciousness", 'Lights can produce consciousness'],
            ['Lights cannot produce consciousness', 'Lights can produce consciousness'],
            ['Lights can not produce consciousness', 'Lights can produce consciousness'],
            ["Consciousness doesn't depend on the brain", 'Consciousness depends on the brain'],
            ['Consciousness does not depend on the brain', 'Consciousness depends on the brain'],
            ["Zombies aren't conceivable", 'Zombies are conceivable'],
            ['It is not the case that both it rains and it is cold', 'It rains and it is cold']
        ];
        const NOT_DENIES = [
            ['No ravens are black', 'All ravens are black', 'contraries: both can be false'],
            ['Some ravens are not black', 'Some ravens are black', 'subcontraries: both can be true'],
            ['Lights must not produce consciousness', 'Lights must produce consciousness', '"must not" keeps its own scope'],
            ['Lights may not produce consciousness', 'Lights may produce consciousness', '"may not" keeps its own scope'],
            ['All ravens are not black', 'All ravens are black', '"all F are not G" is ambiguous, so it is not read']
        ];
        const d = T(W, `return {
            denies: ${J(DENIES)}.map(function (p) { return claimDenies(parseClaim(p[0]), parseClaim(p[1])) && claimDenies(parseClaim(p[1]), parseClaim(p[0])); }),
            not: ${J(NOT_DENIES)}.map(function (p) { return claimDenies(parseClaim(p[0]), parseClaim(p[1])) || claimDenies(parseClaim(p[1]), parseClaim(p[0])); }),
            same: [
                ['Some ravens are not black', 'Not all ravens are black', 'Not every raven is black', 'It is not the case that all ravens are black', "At least one raven isn't black", "There is a raven that isn't black"],
                ['No raven is white', 'None of the ravens are white', 'There is no raven that is white', 'It is not the case that some raven is white', 'Not a single raven is white'],
                ['Nothing is physical', 'It is not the case that something is physical', 'There is nothing that is physical']
            ].map(function (group) { return group.map(function (t) { return claimKey(parseClaim(t)); }); }),
            doubleNegation: [claimKey(parseClaim('It rains')), claimKey(parseClaim('It is not the case that it is not the case that it rains'))],
            doubleDenies: claimDenies(parseClaim('It is not the case that it is not the case that it rains'), parseClaim("It doesn't rain")) &&
                !claimDenies(parseClaim('It is not the case that it is not the case that it rains'), parseClaim('It rains')),
            ambiguous: parseClaim('All ravens are not black').kind
        };`);
        const missed = DENIES.filter((p, i) => !(d.denies || [])[i]);
        ok(missed.length === 0, 'every wording of a denial is read as the denial, both ways (' + DENIES.length + ' pairs)',
            missed.map(p => p[0] + ' ⟂ ' + p[1]).join(' | '));
        const wrongly = NOT_DENIES.filter((p, i) => (d.not || [])[i]);
        ok(wrongly.length === 0, 'contraries, subcontraries and scoped modals are not denials', wrongly.map(p => p[2]).join(' | '));
        const split = (d.same || []).filter(group => new Set(group).size !== 1);
        ok(split.length === 0, 'the wordings of one denial are one claim: "not all", "some ... not", "at least one ... isn\'t", "none of", "there is no"',
            J(split));
        ok(d.ambiguous === 'atom', '"all F are not G" is left unread rather than guessed at', J(d.ambiguous));
        ok(Array.isArray(d.doubleNegation) && d.doubleNegation[0] !== d.doubleNegation[1] && d.doubleDenies === true,
            'a double negation is kept as written: not the claim itself, but the denial of the claim\'s denial', J([d.doubleNegation, d.doubleDenies]));
    }

    /* ---------------- 2. the rules ---------------- */
    console.log('\n-- the rules --');
    {
        const ZOMBIE_P1 = 'If, in functionalism, zombies are not metaphysically possible, and if functionalism is not ruled out, then at least one metaphysical framework in which zombies are not possible is not ruled out.';
        const ZOMBIE_C = 'At least one metaphysical framework in which zombies are not possible is not ruled out.';
        // [the rule, premises, conclusion, what the case shows, is it an objection?]
        const CASES = [
            // Arguments from real maps.
            ['modus ponens, conditions together', [ZOMBIE_P1, 'In functionalism, zombies are not metaphysically possible.', 'Functionalism is not ruled out.'], ZOMBIE_C,
                'two conditions, each given: one step with "conditions together" on (the default)'],
            ['modus tollens', ['If functionalism is true, then a mere series of flashing lights and control circuitry can produce consciousness.',
                "A mere series of flashing lights and control circuitry can't produce consciousness."], 'Functionalism is not true.', "modus tollens through can't"],
            ['universal elimination', ['All things that must depend on other non-physical factors are non-physical.'],
                'If consciousness must depend on other non-physical factors, then consciousness is non-physical.', 'a universal instantiated into a conditional'],
            // Each rule.
            ['modus ponens', ['If it rains, then the ground is wet', 'It rains'], 'The ground is wet', 'modus ponens'],
            ['modus ponens', ['If functionalism is true and zombies are impossible, then physicalism is safe', 'Functionalism is true and zombies are impossible'],
                'Physicalism is safe', 'a condition written as a conjunction, given as one premise'],
            ['modus ponens, conditions together', ['If it rains, then if it is cold, then it snows', 'It rains', 'It is cold'], 'It snows',
                'a nested conditional is one conditional with two conditions: both given, one step'],
            ['modus ponens', ['If it rains, then if it is cold, then it snows', 'It rains'], 'If it is cold, then it snows', '... given one condition, the conditional on the other'],
            [null, ['If it rains, and if it is cold, then it snows', 'It is cold'], 'If it rains, then it snows', '... not the second condition first: that takes commutation too'],
            [null, ['If it rains, then if it is cold, then it snows', 'It does not snow', 'It is cold'], 'It is not the case that it rains', 'modus tollens on a nested conditional, with modus ponens on its other condition: two rules'],
            ['modus tollens', ['If it rains, then the ground is wet', 'The ground is not wet'], 'It is not the case that it rains', 'modus tollens'],
            [null, ['If it rains, and if it is cold, then it snows', 'It does not snow', 'It is cold'], 'It is not the case that it rains',
                'modus tollens on two conditions, the other one given: modus ponens and modus tollens, two rules'],
            ['modus tollens', ['If all ravens are black, then Poe is black', 'Poe is not black'], 'Some raven is not black', 'modus tollens concluding the denial of a universal'],
            ['modus tollens', ['If every raven is black, then Poe is black', "Poe isn't black"], 'Not every raven is black', '... in its other wording'],
            ['modus tollens', ['If functionalism is true, then zombies are inconceivable', "It's not the case that zombies are inconceivable"], "Functionalism isn't true",
                'the consequent denied in front, the condition denied on its verb'],
            ['modus tollens', ['If functionalism is not true, then zombies are possible', 'Zombies are not possible'], 'Functionalism is true',
                'a condition that is itself a denial is denied by its contradictory'],
            ['hypothetical syllogism', ['If it rains, then the ground is wet', 'If the ground is wet, then the match fails'], 'If it rains, then the match fails', 'hypothetical syllogism'],
            ['constructive dilemma', ['If it rains, then the match is cancelled', 'If it snows, then the roads will close', 'Either it rains or it snows'],
                'The match is cancelled or the roads will close', 'constructive dilemma'],
            ['proof by cases', ['If it rains, then the match is cancelled', 'If it snows, then the match is cancelled', 'It rains or it snows'],
                'The match is cancelled', 'a dilemma whose consequents are the same: proof by cases'],
            ['destructive dilemma', ['If it rains, then the match is cancelled', 'If it snows, then the roads will close',
                'Either the match is not cancelled or the roads will not close'], 'Either it does not rain or it does not snow', 'destructive dilemma'],
            ['destructive dilemma', ['If it rains, then the match is cancelled', 'If it rains, then the roads will close',
                'Either the match is not cancelled or the roads will not close'], 'It does not rain', 'destructive dilemma with one condition'],
            ['conjunction introduction', ['The sky is blue', 'Grass is green'], 'The sky is blue and grass is green', 'conjunction introduction'],
            ['conjunction introduction', ['Grass is green', 'The sky is blue'], 'The sky is blue and grass is green', '... in either order'],
            ['conjunction introduction', ['The sky is blue', 'Grass is green', 'Snow is white'], 'The sky is blue and grass is green and snow is white', '... on three premises'],
            ['conjunction elimination', ['The sky is blue and grass is green'], 'Grass is green', 'conjunction elimination'],
            ['disjunction introduction', ['The sky is blue'], 'The sky is blue or grass is green', 'disjunction introduction'],
            ['disjunctive syllogism', ['Either it is raining or it is snowing', 'It is not raining'], 'It is snowing', 'disjunctive syllogism'],
            ['disjunctive syllogism', ['It is raining or it is snowing or it is hailing', 'It is not raining', 'It is not snowing'], 'It is hailing',
                '... on three disjuncts, two denied'],
            ['disjunctive syllogism', ['It is raining or it is snowing or it is hailing', 'It is not raining'], 'It is snowing or it is hailing',
                '... one denied, two left'],
            ['disjunctive syllogism', ['Either all ravens are black or the survey is wrong', 'Some raven is not black'], 'The survey is wrong', 'a disjunct denied by its contradictory'],
            ['double-negation elimination', ['It is not the case that it is not the case that it rains'], 'It rains', 'double-negation elimination'],
            ['double-negation elimination', ["It is not the case that functionalism isn't true"], 'Functionalism is true', '... with the inner denial on the verb'],
            ['existential introduction', ['Poe is a raven'], 'Something is a raven', 'existential introduction'],
            ['existential introduction', ['Poe is a raven and Poe is black'], 'Some raven is black', '... from a conjunction about one thing'],
            ['universal elimination', ['All ravens are black'], 'If Poe is a raven, then Poe is black', 'universal elimination'],
            ['universal elimination', ['Everything is material'], 'Socrates is material', '... of "everything"'],
            ['universal elimination', ['No raven is white'], 'If Poe is a raven, then Poe is not white', '... of "no"'],
            ['universal syllogism', ['All ravens are birds', 'All birds are animals'], 'All ravens are animals', 'universal syllogism'],
            ['existential syllogism', ['Something is a raven', 'All ravens are black'], 'Something is black', 'existential syllogism'],
            ['existential syllogism', ['There is a raven', 'All ravens are black'], 'Something is black', '... from "there is a"'],
            ['existential syllogism', ['Some ravens are black', 'All black things are dark'], 'Some ravens are dark', '... with a subject'],
            ['existential syllogism', ['Some ravens are pets', 'No pets are wild'], 'Some ravens are not wild', '... with "no"'],
            [null, ['Poe is a raven'], 'Poe is a raven', 'a premise that only says what its box says restates it: no argument'],
            ['quantifier negation', ['Some raven is not black'], 'Not all ravens are black', '... and a quantifier negated, by quantifier negation'],
            [null, ['It is not the case that Poe is black'], 'Poe is black', 'an objection that only states the denial is a bare denial, not an argument', true],
            ['modus ponens', ['If Poe is white, then Poe is not black', 'Poe is white'], 'Poe is black', 'an objection deriving the denial', true],
            ['modus tollens', ['If Poe is black, then Poe is dark', 'Poe is not dark'], 'Poe is black', "... by any rule", true],
            [null, ['Functionalism is true'], 'Functionalism is not true', "... nor one that only restates the claim a denial denies", true],
            // One step, one rule, every premise used.
            ['modus ponens, conditions together', ['If functionalism is true and zombies are impossible, then physicalism is safe', 'Functionalism is true', 'Zombies are impossible'],
                'Physicalism is safe', 'a condition written as a conjunction, given as its conjuncts: "if A and B, then C" is "if A, and if B, then C"'],
            ['universal modus ponens', ['All ravens are black', 'Poe is a raven'], 'Poe is black', 'from a general rule straight to its case: one step'],
            ['universal modus ponens', ['∀x (R(x) → B(x))', 'R(p)'], 'B(p)', '... in symbols'],
            [null, ['All ravens are black', 'Poe is black'], 'Poe is a raven', '... but not backwards'],
            [null, ['If it rains, and if it is cold, then it snows', 'It rains'], 'It snows', 'a condition not given'],
            [null, ['If it rains, then the ground is wet', 'It rains', 'The sky is blue'], 'The ground is wet', 'a premise the rule does not use'],
            ['conjunction elimination under ∃', ['There is a raven that is black'], 'Something is black', 'a rule inside "some": the raven that is black is black'],
            ['double-negation replacement', ['It rains'], 'It is not the case that it is not the case that it rains', 'double negation, a replacement rule on by default since r27.32'],
            [null, ['Poe is black'], 'Poe is black', 'an objection that agrees with its box', true],
            // Never certified.
            [null, [ZOMBIE_P1, 'In functionalism, zombies are not metaphysically possible.'], ZOMBIE_C, 'a condition missing'],
            [null, ['If it rains, and if it is cold, then it snows', 'It does not snow'], 'It is not the case that it rains',
                'with two conditions, a failed consequent denies neither one on its own'],
            [null, ['If all ravens are black, then Poe is black', 'Poe is not black'], 'No raven is black', 'modus tollens gives the contradictory, not the contrary'],
            [null, ['All ravens are not white'], 'If Poe is a raven, then Poe is not white', '"all F are not G" is ambiguous, so nothing follows from it here'],
            [null, ['The sky is blue'], 'Grass is green', 'unconnected claims'],
            [null, ['All ravens are black', 'Poe is black'], 'Poe is a raven', 'affirming the consequent'],
            [null, ['If it rains, then the ground is wet', 'It is not the case that it rains'], 'The ground is not wet', 'denying the antecedent'],
            [null, ['If it rains, then the ground is wet', 'The ground is wet'], 'It rains', 'affirming the consequent, of a conditional'],
            [null, ['Most ravens are black'], 'If Poe is a raven, then Poe is black', '"most" is not "all"'],
            [null, ['Some ravens are black', 'Some black things are dark'], 'Some ravens are dark', 'two particulars prove nothing'],
            [null, ['The sky is blue or grass is green'], 'The sky is blue', 'a disjunction does not give a disjunct'],
            [null, ['The sky is blue'], 'The sky is blue and grass is green', 'half a conjunction is not the conjunction'],
            [null, ['The sky is blue', 'Grass is wet'], 'The sky is blue and grass is green', 'a conjunct that is not among the premises'],
            [null, ['All ravens are black'], 'All black things are ravens', 'a universal does not convert'],
            [null, ['Poe is a raven'], 'Everything is a raven', 'no generalizing from one case'],
            [null, ['If it rains, then the match is cancelled', 'If it snows, then the roads will close', 'It rains or it hails'],
                'The match is cancelled or the roads will close', 'a dilemma whose disjunction is not the conditions'],
            [null, ['If it rains, then the match is cancelled', 'If it snows, then the roads will close', 'Either the match is cancelled or the roads will close'],
                'Either it does not rain or it does not snow', 'a destructive dilemma needs the consequents denied'],
            [null, ['If functionalism is true, then lights can produce consciousness', 'Lights must not produce consciousness'], 'Functionalism is not true', '"must not" is not the denial of "can"']
        ];
        const got = T(W, `return ${J(CASES)}.map(function (c) {
            var parent = parseClaim(c[2]);
            var cert = certifyStep(c[1].map(parseClaim), c[4] ? claimDenials(parent) : [parent], !!c[4]);
            return cert ? cert.name : null;
        });`);
        const wrong = CASES.map((c, i) => [c, got[i]]).filter(([c, g]) => g !== c[0]);
        ok(wrong.length === 0, 'each rule certifies what it should, one rule to a step, and nothing else is certified (' + CASES.length + ' arguments)',
            wrong.map(([c, g]) => c[3] + ': got ' + g + ', expected ' + c[0]).join(' | '));
        const names = T(W, `return DEDUCTIVE_RULES.map(function (r) { return [r.id, r.name, !!r.gloss]; });`);
        const STANDARD = ['Contradiction', 'predicate congruence', 'subalternation', 'identity symmetry',
            'identity transitivity', 'identity introduction', 'identity substitution', 'modus ponens',
            'modus ponens, conditions together', 'modus tollens', 'hypothetical syllogism', 'proof by cases',
            'constructive dilemma', 'destructive dilemma', 'biconditional elimination', 'substitution of equivalents', 'biconditional introduction',
            'conjunction introduction', 'conjunction elimination', 'disjunction introduction', 'disjunctive syllogism',
            'conjunctive syllogism', 'resolution', 'explosion', 'double-negation elimination',
            'existential introduction', 'existential elimination', 'universal elimination', 'universal modus ponens',
            'universal modus tollens', 'universal syllogism', 'existential syllogism', 'categorical syllogism',
            'reductio', 'rule instances', 'negation introduction', 'indirect proof',
            'consequentia mirabilis', 'absorption', 'change of bound variable', 'Quantifier Commutation',
            'vacuous quantifier', 'vacuous quantifier, anywhere', 'rules of passage', 'quantifier distribution',
            'quantifier distribution, anywhere', 'quantifier negation', 'conversion', 'contraposition',
            'De Morgan’s laws', 'transposition', 'Negated Conditional', 'Negated Biconditional',
            'material implication', 'material equivalence', 'exportation', 'Boolean absorption',
            '⊥ laws', 'distribution', 'commutation', 'association',
            'idempotence', 'a premise not established', 'a false premise', 'conclusion not established',
            'an unsound argument', 'a rule under a quantifier'];
        // The optional ones, kept apart: double-negation replacement and its
        // "anywhere" partner, the zero-premise shortcuts, and the catch-alls.
        const OPTIONAL = ['double-negation replacement', 'double-negation elimination, anywhere', 'restatement',
            'tautological consequence', 'equivalence replacement', 'noncontradiction', 'excluded middle',
            'instances up to the replacements'];
        const optionalNames = T(W, `return (DEDUCTIVE_OPTIONAL_RULES || []).map(function (r) { return r.name; });`);
        ok(J(optionalNames) === J(OPTIONAL), 'and these are the optional rules, switched on by name', J(optionalNames));
        ok(Array.isArray(names) && J(names.map(r => r[1])) === J(STANDARD) && names.every(r => r[2]),
            'the Standard package has exactly these rules, each with a gloss', J(Array.isArray(names) ? names.map(r => r[1]) : names));
    }

    /* ---------------- 3. steps over a map ---------------- */
    console.log('\n-- steps over a map --');
    {
        const s = T(W, `state.trees = ${J(MAP)}; ensureCollabFields(state); selectedIds = []; render();
            var steps = collectDeductiveSteps(state.trees);
            return { count: steps.length,
                     rows: steps.map(function (s) { return { child: s.childId, parent: s.parentId, box: s.boxIdx, attack: s.attack,
                        premises: s.premiseTexts.length, rule: s.rule ? s.rule.id : null, unchecked: !!s.unchecked, bare: !!s.bare }; }) };`);
        const row = id => (s.rows || []).find(r => r.child === id) || {};
        ok(s.count === 7 && !(s.rows || []).some(r => r.child === 'NT'),
            'a step for every support and every objection, weak or not, and none for a note', J(s));
        ok(row('A').parent === 'M' && row('A').premises === 2 && row('A').rule === 'modus-ponens' && row('A').attack === false,
            'co-premises are one step, taken together: the two boxes under M derive it', J(row('A')));
        ok(row('B').rule === null, 'a support the check cannot read is a step all the same, uncertified', J(row('B')));
        ok(row('D').attack === true && row('D').rule === 'modus-ponens',
            'an objection is checked against the DENIAL of the box it objects to: its modus ponens derives "Poe is not black"', J(row('D')));
        ok(row('E').attack === true && row('E').rule === null && row('E').bare === true,
            'a weak objection is checked too: one that only states the denial is a bare denial, and not certified', J(row('E')));
        ok(row('C').attack === true && row('C').rule === null, 'an objection that does not derive the denial is uncertified', J(row('C')));
        ok(row('GA').parent === 'G' && row('GA').rule === 'and-intro' && row('GAA').rule === null,
            'the conjunction step is certified, and the support under it is judged on its own', J([row('GA'), row('GAA')]));

        const only = T(W, `return collectDeductiveSteps(state.trees, new Set(['B', 'D'])).map(function (s) { return s.childId; });`);
        ok(J(only) === J(['B', 'D']), 'the steps of just the boxes asked for', J(only));

        const target = T(W, `state.trees = [{ id: 'P', type: 'contention', texts: ['First box', 'The sky is blue and grass is green'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'K', type: 'support', texts: ['The sky is blue', 'Grass is green'], collapsed: [], targetIndex: 1, children: [] } ] }];
            ensureCollabFields(state); render();
            var steps = collectDeductiveSteps(state.trees);
            return steps.map(function (s) { return { box: s.boxIdx, conc: s.conclusionText, rule: s.rule ? s.rule.id : null }; });`);
        ok(Array.isArray(target) && target.length === 1 && target[0].box === 1 && target[0].rule === 'and-intro',
            'the conclusion is the co-premise box the arrow actually meets, not the first box of the group', J(target));

        const none = T(W, `state.trees = [{ id: 'S', type: 'contention', texts: ['Alone'], collapsed: [], x: 30000, y: 30000, children: [] }];
            ensureCollabFields(state); render(); return collectDeductiveSteps(state.trees).length;`);
        ok(none === 0, 'a map with no premises has no steps', J(none));
    }

    /* ---------------- 4. the list of steps ---------------- */
    console.log('\n-- the list of steps --');
    {
        const p = T(W, `state.trees = ${J(MAP)}; ensureCollabFields(state); selectedIds = []; render();
            var before = JSON.stringify(state.trees);
            openDeductiveCheck();
            var back = document.getElementById('logic-modal-backdrop');
            var rows = Array.prototype.slice.call(document.querySelectorAll('#logic-modal-body .logic-step')).map(function (r) {
                return { step: r.dataset.step, certified: r.classList.contains('certified'), rule: r.querySelector('.logic-rule').textContent.trim(),
                         premises: Array.prototype.slice.call(r.querySelectorAll('.logic-premise')).map(function (p) { return p.textContent; }),
                         conclusion: r.querySelector('.logic-conclusion').textContent };
            });
            return { open: back.classList.contains('open'), summary: document.getElementById('logic-modal-summary').textContent,
                     rows: rows, unchanged: JSON.stringify(state.trees) === before };`);
        const r = id => (p.rows || []).find(x => x.step === id) || {};
        // G's conjunction remains valid, but GAA fails to establish its first premise.
        ok(p.open === true && /^Main contentions: unwarranted, unwarranted · 3 of 7 steps certified$/.test(p.summary || ''),
            'the list opens, gives the main contentions’ verdicts, and counts the certified steps', J([p.open, p.summary]));
        ok(Array.isArray(p.rows) && p.rows.length === 7, 'one row per step', J(p.rows && p.rows.length));
        ok(/modus ponens/.test(r('A').rule || '') && /✗\s*bare denial/.test(r('E').rule || '') && /not recognized/.test(r('B').rule || ''),
            'a certified row names its rule; a bare denial says so; an uncertified one says only that the check does not recognize it', J([r('A').rule, r('E').rule, r('B').rule]));
        ok(J(r('A').premises) === J(['If Poe is a raven, then Poe is black', 'Poe is a raven']) && /^∴\s*Poe is black/.test(r('A').conclusion || ''),
            'a row shows the premises as written and the box they support', J(r('A')));
        ok(/^∴ not:\s*Poe is black/.test(r('D').conclusion || ''), "an objection's row concludes the denial of the box it objects to", J(r('D')));
        ok(p.unchanged === true, 'checking changes nothing in the map', J(p.unchanged));

        const after = T(W, `var back = document.getElementById('logic-modal-backdrop');
            document.querySelector('#logic-modal-body .logic-step[data-step="A"]').click();
            var closedByClick = !back.classList.contains('open');
            var selected = selectedIds.slice();
            openDeductiveCheck('D');
            var focused = Array.prototype.slice.call(document.querySelectorAll('#logic-modal-body .logic-step.focused')).map(function (r) { return r.dataset.step; });
            document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }));
            return { closedByClick: closedByClick, selected: selected, focused: focused, closedByEsc: !back.classList.contains('open') };`);
        ok(after.closedByClick === true && J(after.selected) === J(['A-0']),
            'clicking a row closes the list and selects that step’s premise box', J(after));
        ok(J(after.focused) === J(['D']) && after.closedByEsc === true,
            'the list can open on one step, marked; Escape closes it', J(after));

        const empty = T(W, `state.trees = [{ id: 'S', type: 'contention', texts: ['Alone'], collapsed: [], x: 30000, y: 30000, children: [] }];
            ensureCollabFields(state); render(); openDeductiveCheck();
            var out = { summary: document.getElementById('logic-modal-summary').textContent,
                        empty: !!document.querySelector('#logic-modal-body .logic-empty'),
                        rows: document.querySelectorAll('#logic-modal-body .logic-step').length };
            closeDeductiveCheck(); return out;`);
        ok(empty.rows === 0 && empty.empty === true && /no steps/.test(empty.summary || ''),
            'a map with no steps says so instead of showing an empty list', J(empty));
    }

    /* ---------------- 5. derivation tags ---------------- */
    console.log('\n-- derivation tags --');
    {
        const key = (code, shift) => `document.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}', key: ${shift ? "'K'" : "'k'"}, shiftKey: ${!!shift}, bubbles: true, cancelable: true }));`;
        const tags = `Array.prototype.slice.call(document.querySelectorAll('.derivation-tag:not(.verdict-tag)')).map(function (t) {
                return { step: t.dataset.step, parent: t.parentElement.id, cls: t.className, text: t.textContent, title: t.title }; })`;
        const live = T(W, `state.trees = ${J(MAP)}; ensureCollabFields(state); selectedIds = []; render();
            var before = JSON.stringify(state.trees);
            ${key('KeyK')}
            var on = { active: document.getElementById('logic-btn').classList.contains('active'), tags: ${tags} };
            render();
            var rerendered = document.querySelectorAll('.derivation-tag:not(.verdict-tag)').length;
            var unchanged = JSON.stringify(state.trees) === before;
            ${key('KeyK')}
            return { on: on, rerendered: rerendered, unchanged: unchanged,
                     off: { active: document.getElementById('logic-btn').classList.contains('active'), tags: document.querySelectorAll('.derivation-tag').length } };`);
        const tag = id => ((live.on || {}).tags || []).find(t => t.step === id) || {};
        ok(live.on && live.on.active === true && live.on.tags.length === 7 && ((live.on || {}).tags || []).some(t => t.step === 'E'),
            'K turns the check on: a tag on every step, weak objections too, and the button shows it', J(live.on && live.on.tags.length));
        ok(((live.on || {}).tags || []).every(t => t.parent === 'group-' + t.step),
            "each tag lives in its premise group, so it rides the group's drags", J((live.on || {}).tags));
        ok(/\bcertified\b/.test(tag('A').cls || '') && tag('A').text === '✓ modus ponens' &&
           /\bcertified\b/.test(tag('D').cls || '') && tag('D').text === '✓ modus ponens',
            'a certified step is tagged with its rule', J([tag('A'), tag('D')]));
        ok(/\buncertified\b/.test(tag('B').cls || '') && tag('B').text === '? not recognized' &&
           /limit of the check, not a verdict/.test(tag('B').title || '') && /denial of the box they object to/.test(tag('C').title || ''),
            'an uncertified one says it does not derive, and its tooltip says that is not a verdict', J([tag('B'), tag('C')]));
        ok(live.rerendered === 7 && live.unchanged === true, 'the tags come back on every render, and change nothing in the map', J(live));
        ok(live.off && live.off.active === false && live.off.tags === 0, 'K again turns it off', J(live.off));

        const edits = T(W, `state.trees = ${J(MAP)}; ensureCollabFields(state); selectedIds = []; render();
            toggleDeductiveLive();
            var b = findNodeContext(state.trees, 'B').node;
            b.texts = ['If Poe is a raven, and if all ravens are black, then Poe is black', 'Poe is a raven', 'All ravens are black'];
            render();
            var t = document.querySelector('.derivation-tag[data-step="B"]');
            var mp = t ? t.textContent : null;
            b.texts = ['If Poe is a raven and all ravens are black, then Poe is black', 'Poe is a raven', 'All ravens are black'];
            render();
            t = document.querySelector('.derivation-tag[data-step="B"]');
            var both = t ? t.textContent : null;
            toggleDeductiveLive();
            return { mp: mp, both: both };`);
        ok(edits.mp === '✓ modus ponens, conditions together' && edits.both === '✓ modus ponens, conditions together',
            'the tags follow edits; conditions given one by one, and the conjuncts of one condition, are each one step while "conditions together" is on', J(edits));

        const one = T(W, `state.trees = ${J(MAP)}; ensureCollabFields(state); render();
            window.__hints = []; var realHint = showHintToast; showHintToast = function (t) { window.__hints.push(t); return true; };
            selectedIds = ['B-0'];
            ${key('KeyK', true)}
            var checked = ${tags};
            selectedIds = ['B-0', 'D-1'];
            ${key('KeyK', true)}
            var two = ${tags}.map(function (t) { return t.step; }).sort();
            ${key('KeyK', true)}
            var cleared = document.querySelectorAll('.derivation-tag').length;
            selectedIds = ['M-0'];
            ${key('KeyK', true)}
            var contention = { tags: document.querySelectorAll('.derivation-tag').length, hint: window.__hints.slice(-1)[0] };
            selectedIds = ['E-0'];
            ${key('KeyK', true)}
            var weak = { tags: Array.prototype.map.call(document.querySelectorAll('.derivation-tag'), function (t) { return t.textContent; }) };
            deductiveChecked.clear(); refreshDerivationTags();
            showHintToast = realHint;
            return { checked: checked.map(function (t) { return t.step; }), two: two, cleared: cleared, contention: contention, weak: weak };`);
        ok(J(one.checked) === J(['B']), 'Shift+K checks just the selected box’s step', J(one.checked));
        ok(J(one.two) === J(['B', 'D']) && one.cleared === 0,
            'with more selected it checks the rest, and once all are checked, Shift+K unchecks them', J(one));
        ok(one.contention && one.contention.tags === 0 && /doesn’t derive anything obvious on its own/.test(one.contention.hint || ''),
            'a main contention has no step to check: Shift+K looks for a parent to derive from it, and says when there is none', J(one.contention));
        ok(one.weak && J(one.weak.tags) === J(['✗ bare denial']), 'Shift+K checks a weak objection’s step too: a bare denial is tagged so', J(one.weak));

        const menu = T(W, `state.trees = ${J(MAP)}; ensureCollabFields(state); selectedIds = []; render();
            var items = function () { return Array.prototype.slice.call(document.querySelectorAll('#context-menu .ctx-item')).map(function (b) { return b.textContent.trim(); }); };
            showContextMenu(10, 10, 'A', 0);
            var first = items();
            Array.prototype.slice.call(document.querySelectorAll('#context-menu .ctx-item')).find(function (b) { return /^Check This Step/.test(b.textContent.trim()); }).click();
            var afterCheck = ${tags}.map(function (t) { return t.step; });
            showContextMenu(10, 10, 'A', 0);
            var second = items();
            hideContextMenu();
            showContextMenu(10, 10, 'E', 0);
            var onWeak = items();
            hideContextMenu();
            showContextMenu(10, 10, 'M', 0);
            var onContention = items();
            Array.prototype.slice.call(document.querySelectorAll('#context-menu .ctx-item')).find(function (b) { return /^Deductive Check: All Steps/.test(b.textContent.trim()); }).click();
            var listOpen = document.getElementById('logic-modal-backdrop').classList.contains('open');
            closeDeductiveCheck();
            var tagEl = document.querySelector('.derivation-tag[data-step="A"]');
            var groupPress = 0;
            tagEl.parentElement.addEventListener('mousedown', function () { groupPress++; });
            tagEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            tagEl.click();
            var focused = Array.prototype.slice.call(document.querySelectorAll('#logic-modal-body .logic-step.focused')).map(function (r) { return r.dataset.step; });
            closeDeductiveCheck();
            toggleStepChecks(['A']);
            return { first: first, afterCheck: afterCheck, second: second, onWeak: onWeak, onContention: onContention, listOpen: listOpen, groupPress: groupPress, focused: focused };`);
        ok((menu.first || []).some(t => /^Check This Step\s*Shift\+K$/.test(t)) && J(menu.afterCheck) === J(['A']),
            'right-click → Check This Step checks that box’s step', J([menu.first, menu.afterCheck]));
        ok((menu.second || []).some(t => /^Stop Checking This Step/.test(t)), 'and the menu then offers to stop checking it', J(menu.second));
        ok(!(menu.onContention || []).some(t => /Check This Step/.test(t)) && (menu.onWeak || []).some(t => /Check This Step/.test(t)) &&
           (menu.onContention || []).some(t => /^Deductive Check: All Steps/.test(t)) && menu.listOpen === true,
            'a main contention offers no step to check, a weak objection does, and every menu opens the list of all steps', J([menu.onWeak, menu.onContention]));
        ok(menu.groupPress === 0 && J(menu.focused) === J(['A']),
            'pressing a tag does not start a drag of its group, and clicking it opens the list on its step', J(menu));
    }

    /* ---------------- 5b. where the tags sit ---------------- */
    console.log('\n-- where the tags sit --');
    {
        // jsdom has no layout: boxes are 180 wide with 15px between them,
        // an IMPLICIT tag 58x15, a derivation tag 6.5px a character.
        const geo = T(W, `
            var fixture = ${J(MAP)};
            fixture[0].children[1].implicits = [true];     // B: a single implicit premise
            state.trees = fixture; ensureCollabFields(state); selectedIds = []; render();
            var P = HTMLElement.prototype, names = ['offsetLeft', 'offsetTop', 'offsetWidth', 'offsetHeight'], real = {};
            names.forEach(function (k) { real[k] = Object.getOwnPropertyDescriptor(P, k); });
            function box(el) {
                if (el.classList.contains('node')) {
                    var boxes = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.classList.contains('node'); });
                    return [boxes.indexOf(el) * 195, 0, 180, 60];
                }
                if (el.classList.contains('implicit-tag')) return [0, 0, 58, 15];
                if (el.classList.contains('derivation-tag')) return [0, 0, Math.round(el.textContent.length * 6.5 + 10), 15];
                return [0, 0, 0, 0];
            }
            names.forEach(function (k, i) { Object.defineProperty(P, k, { configurable: true, get: function () { return box(this)[i]; } }); });
            try {
                toggleDeductiveLive();
                // Every group far from every other, but B and C side by side.
                Array.prototype.slice.call(document.querySelectorAll('.node-group')).forEach(function (g, i) {
                    g.style.left = (5000 + i * 1000) + 'px'; g.style.top = '500px';
                });
                document.getElementById('group-B').style.left = '1000px';
                document.getElementById('group-C').style.left = '1100px';
                positionDerivationTags();
                var at = function (id) {
                    var t = document.querySelector('.derivation-tag[data-step="' + id + '"]');
                    return t ? { left: parseFloat(t.style.left), top: parseFloat(t.style.top), w: t.offsetWidth, h: t.offsetHeight } : null;
                };
                var out = { A: at('A'), B: at('B'), C: at('C'), D: at('D'), implicitB: !!document.querySelector('#group-B .implicit-tag') };
                toggleDeductiveLive();
                return out;
            } finally {
                names.forEach(function (k) { Object.defineProperty(P, k, real[k]); });
            }`);
        const A = geo.A || {}, B = geo.B || {}, C = geo.C || {}, D = geo.D || {};
        ok(Math.abs(A.left + A.w / 2 - 187.5) < 0.01 && Math.abs(A.top + A.h / 2 - (-15)) < 0.01,
            "a co-premise group's tag is centered on the middle of its fork, 15px above the boxes", J(A));
        ok(Math.abs(D.left + D.w / 2 - 187.5) < 0.01, 'an objection with co-premises too', J(D));
        ok(geo.implicitB === true && Math.abs(B.left + B.w / 2 - 90) < 0.01 && B.top + B.h <= -6 - 4 + 0.01,
            "a single implicit premise's tag sits on its line, lifted clear of the IMPLICIT tag with a 4px gap", J(B));
        const b = { x0: 1000 + B.left, x1: 1000 + B.left + B.w, y0: 500 + B.top, y1: 500 + B.top + B.h };
        const c = { x0: 1100 + C.left, x1: 1100 + C.left + C.w, y0: 500 + C.top, y1: 500 + C.top + C.h };
        const clear = c.x1 <= b.x0 - 4 || b.x1 <= c.x0 - 4 || c.y1 <= b.y0 - 4 || b.y1 <= c.y0 - 4;
        ok(clear, 'a tag that would run into its neighbor’s steps up clear of it', J({ b, c }));
    }

    /* ---------------- 6. Help ---------------- */
    console.log('\n-- Help --');
    {
        const h = W.dom.window.document.getElementById('help-panel');
        const text = h.textContent;
        ok(text.includes('check one inference at a time') && text.includes('does not certify their truth'),
            'compact Help distinguishes inference validity from premise truth');
        ok(text.includes('Not recognized') && text.includes('cannot certify the step'),
            'Help explains an unrecognized step without declaring it invalid');
        ok(text.includes('without establishing its opposite') && text.includes('✓ Warranted') && text.includes('✗ Unwarranted'),
            'Help explains weak challenges and both warrant assessments');
        const rows = [...h.querySelectorAll('tr')].map(row => row.textContent);
        ok(rows.some(r => r.includes('check selected step') && r.includes('Shift+K')) &&
           rows.some(r => r.includes('Derive a parent') && r.includes('Shift+K')) &&
           rows.some(r => r.includes('Add parent') && r.includes('Alt+↑')),
            'Help keeps check, derive and parent shortcuts in its compact table');
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
