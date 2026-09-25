'use strict';
// r27 Deductive check, stress-tested: ordinary English and formulas, the
// flags on what cannot be read safely, deriving a parent, adding one.
//
// The reader must bring every way English says a denial, a conjunction, a
// disjunction, a conditional or a quantifier -- and a formula in any of its
// usual spellings -- to the same forms, so that the rules see through the
// wording. What it cannot read safely it flags rather than guesses: a scope
// ambiguity ("all F are not G") always; a generic ("ravens are black") or an
// indefinite ("a raven is black") only when reading it as "all" or "some"
// would make the step follow; and what first-order logic cannot say ("most",
// "because") as unread. Anaphora is out of scope: a pronoun matches only
// itself.
//
// Derive Parent (Shift+K on premises with nothing above them) writes the
// conclusion ONE rule gives from EVERY premise in the group, in the
// premises' own words or symbols, above them -- never by disjunction
// introduction, conjunction introduction or elimination, existential
// introduction or universal elimination, which give a conclusion from almost
// anything -- or says the premises derive nothing obvious. Add Parent Above
// (Alt+Up) puts an empty box in a group's place.
//
// Covers:
//   (1) the reader, over a stress corpus and a held-out one: sentences that
//       are one claim, pairs that are not, contradictories, arguments and the
//       rule that certifies each, and the notes each sentence gets;
//   (2) past tenses: "crossed" and "did not cross", "went" and "didn't go";
//  (2b) denials and word forms: contractions are one wording; "no" before an object;
//       words that are exactly denials, not contraries; "able to" is "can";
//       the "should" hedge flagged; generics, indefinites and "it" are no
//       individuals; past tenses keyed by their own form; irregular plurals;
//  (2c) weak objections: checked, passing on the box's denial or on its not
//       being established, in the common wordings;
//  (2d) the equivalences, reductio, absorption, and biconditional elimination's
//       denials, with look-alikes that must not pass;
//   (3) diagnosis on a map: the "? ambiguous" tag, its tooltip, the list row;
//   (4) deriving a conclusion: every generative rule, in English and in
//       symbols, and premises that derive nothing obvious;
//  (4b) strict matching: a claim a rule needs twice spelled two ways --
//       capitals, an extra space, other words -- is a near miss, named on its
//       "✗ spelled differently" tag, in the list, and by Derive Parent; the
//       logic around a claim (a denial, a quantifier's case) may be written
//       any way;
//   (5) Derive Parent: Shift+K and the context menu on a tree's top box or
//       group, the new box and its checked step, undo, the message when
//       nothing follows, empty boxes, view-only maps;
//   (6) Add Parent Above: Alt+Up on a child group, a top box, a main
//       contention, from a box's text field; refused for a note and for more
//       than one group; the context menu, the toolbar button, and the + above
//       a selected box; undo;
//   (7) Help.
//
// Run:  node logic-r27-english-test.js [argument-mapper-r27.html]
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

// The stress corpus.
//   same:      sentences that must be read as one claim
//   different: pairs that must NOT be read as one claim
//   denies:    [a, b]: a and b contradict each other
//   args:      [the rule that certifies it (or null), premises, conclusion, label]
//   notes:     [sentence, the note it must get: 'ambiguous' | 'unread' | null for none]
const CORPUS = {
    same: [
        // ---- Negation ----
        ['denial on the copula', ['The ground is not wet', "The ground isn't wet", 'It is not the case that the ground is wet',
            "It's not the case that the ground is wet", "It isn't the case that the ground is wet", 'It is false that the ground is wet',
            'It is not true that the ground is wet', "It isn't true that the ground is wet", 'It is untrue that the ground is wet']],
        ['denial of a plain verb', ['It does not rain', "It doesn't rain", 'It is not the case that it rains']],
        ['denial of can', ['Lights cannot produce consciousness', "Lights can't produce consciousness", 'Lights can not produce consciousness',
            'It is not the case that lights can produce consciousness']],
        ['denial of will', ['It will not rain', "It won't rain", 'It is not the case that it will rain']],
        ['denial of was', ['Poe was not black', "Poe wasn't black", 'It is not the case that Poe was black']],
        ['denial of has', ['Poe has not flown', "Poe hasn't flown", 'It is not the case that Poe has flown']],
        ['denial of would', ['Zombies would not behave like us', "Zombies wouldn't behave like us", 'It is not the case that zombies would behave like us']],
        ['non- words are denials', ['Consciousness is non-physical', 'Consciousness is nonphysical', 'Consciousness is not physical']],
        ['exact-denial words are denials', ['The argument is invalid', 'The argument is not valid']],
        ['able to is can', ['We can leave', 'We are able to leave']],
        ['unable to is can not', ["We can't leave", 'We cannot leave', 'We are not able to leave', "We aren't able to leave", "We're unable to leave", 'We are unable to leave']],
        ['no before an object', ['This gives you no reason', "This doesn't give you any reason", 'This does not give you a single reason']],
        ['false is not true', ['Functionalism is false', 'Functionalism is not true', "Functionalism isn't true", 'Functionalism is untrue']],
        ['curly apostrophes', ["The ground isn’t wet", "The ground isn't wet"]],
        ['neither nor, of predicates', ['Poe is neither black nor white', 'Poe is not black and Poe is not white']],
        ['neither nor, of clauses', ['Neither does it rain nor does it snow', 'Neither it rains nor it snows', 'It does not rain and it does not snow']],
        // ---- Conjunction ----
        ['conjunction', ['The sky is blue and grass is green', 'Both the sky is blue and grass is green', 'The sky is blue, and grass is green',
            'The sky is blue & grass is green', 'The sky is blue ∧ grass is green', 'The sky is blue but grass is green',
            'The sky is blue, but grass is green', 'The sky is blue, yet grass is green', 'The sky is blue and yet grass is green',
            'The sky is blue although grass is green', 'Although grass is green, the sky is blue', 'Though grass is green, the sky is blue',
            'Even though grass is green, the sky is blue', 'The sky is blue whereas grass is green', 'The sky is blue; grass is green',
            'The sky is blue; moreover, grass is green', 'The sky is blue; however, grass is green', 'The sky is blue, and also grass is green']],
        ['three conjuncts', ['The sky is blue and grass is green and snow is white', 'The sky is blue, grass is green, and snow is white',
            'The sky is blue, grass is green and snow is white']],
        ['conjoined predicates', ['Poe is black and small', 'Poe is black and Poe is small']],
        ['a list of predicates', ['Poe is black, small, and loud', 'Poe is black, small and loud', 'Poe is black and Poe is small and Poe is loud']],
        ['a list of predicates, or', ['Poe is black, small, or loud', 'Poe is black or Poe is small or Poe is loud']],
        ['conjoined plain verbs', ['Poe flies and sings', 'Poe flies and Poe sings']],
        ['but not', ['Poe is black but not small', 'Poe is black and Poe is not small']],
        // ---- Disjunction ----
        ['disjunction', ['It is raining or it is snowing', 'Either it is raining or it is snowing', 'It is raining, or it is snowing',
            'It is raining or else it is snowing', 'It is raining ∨ it is snowing', 'It is raining and/or it is snowing',
            'It is raining unless it is snowing', 'Unless it is snowing, it is raining']],
        ['three disjuncts', ['It is raining or it is snowing or it is hailing', 'It is raining, it is snowing, or it is hailing',
            'Either it is raining, it is snowing, or it is hailing']],
        ['disjoined predicates', ['Poe is black or white', 'Poe is black or Poe is white', 'Poe is either black or white']],
        // ---- Conditionals ----
        ['conditional', ['If it rains, then the ground is wet', 'If it rains then the ground is wet', 'If it rains, the ground is wet',
            'The ground is wet if it rains', 'It rains only if the ground is wet', 'The ground is wet provided that it rains',
            'The ground is wet provided it rains', 'Provided that it rains, the ground is wet', 'The ground is wet as long as it rains',
            'As long as it rains, the ground is wet', 'The ground is wet so long as it rains', 'The ground is wet on the condition that it rains',
            'On condition that it rains, the ground is wet', 'In the event that it rains, the ground is wet', 'The ground is wet in the event that it rains',
            'Assuming that it rains, the ground is wet', 'The ground is wet whenever it rains', 'Whenever it rains, the ground is wet',
            'That it rains implies that the ground is wet', 'That it rains entails that the ground is wet']],
        ['two conditions', ['If it rains, and if it is cold, then it snows', 'If it rains, then if it is cold, then it snows',
            'If it rains, then if it is cold, it snows', 'It snows if it rains and if it is cold',
            'If it rains, and if it is cold, it snows', 'If it rains, if it is cold, it snows']],
        // ---- "If X, Y": no "then" ----
        ['if without then: two conditions, commas in the condition', ['If, in functionalism, zombies are possible, and if physicalism is false, dualism is true',
            'If, in functionalism, zombies are possible, and if physicalism is false, then dualism is true']],
        ['if without then: a list in the condition', ['If Poe is black, small, and loud, Poe is a raven', 'If Poe is black, small and loud, Poe is a raven',
            'If Poe is black, small, and loud, then Poe is a raven']],
        ['if without then: sentence letters', ['If P, Q', 'If P, then Q']],
        ['if without then: plural subjects and plain verbs', ['If it snows, the roads close', 'If it snows, then the roads close']],
        ['if without then: plural subjects in the past', ['If it rains, the roads closed', 'If it rains, then the roads closed']],
        ['if without then: two clauses in the consequent', ['If it rains, the roads close and the schools close', 'If it rains, then the roads close and the schools close']],
        ['if without then: a relative clause in the consequent', ['If it rains, the match, which was scheduled for noon, is cancelled',
            'If it rains, then the match, which was scheduled for noon, is cancelled']],
        ['if without then: two conditionals joined', ['If it rains, the ground is wet, and if it snows, the roads close',
            'If it rains, then the ground is wet, and if it snows, then the roads close']],
        ['if without then: quantified and denied parts', ['If no ravens are white, Poe is not white', 'If no ravens are white, then Poe is not white']],
        ['biconditional', ['It rains if and only if the ground is wet', 'It rains iff the ground is wet', 'It rains just in case the ground is wet',
            'It rains exactly when the ground is wet']],
        // ---- Quantifiers ----
        ['all', ['All ravens are black', 'Every raven is black', 'Each raven is black', 'Any raven is black', 'All of the ravens are black',
            'All the ravens are black', 'Every single raven is black', 'Each and every raven is black', 'Everything that is a raven is black',
            'Anything that is a raven is black', 'Whatever is a raven is black', 'All things that are ravens are black',
            'Every one of the ravens is black', 'Only black things are ravens', 'No raven is not black', 'There is no raven that is not black',
            "There isn't a raven that is not black", 'It is not the case that some raven is not black']],
        ['no', ['No raven is white', 'No ravens are white', 'None of the ravens are white', 'Not a single raven is white', 'Not one raven is white',
            'Not any raven is white', 'Nothing that is a raven is white', 'There is no raven that is white', 'There are no ravens that are white',
            "There isn't a raven that is white", "There aren't any ravens that are white", 'It is not the case that some raven is white',
            'It is not the case that any raven is white', 'It is not the case that there is a raven that is white']],
        ['some', ['Some raven is black', 'Some ravens are black', 'At least one raven is black', 'There is a raven that is black',
            'There exists a raven that is black', 'There are ravens that are black', 'Something that is a raven is black', 'Certain ravens are black',
            'It is not the case that no raven is black']],
        ['some not', ['Some raven is not black', 'Some ravens are not black', "Some ravens aren't black", 'At least one raven is not black',
            'Not all ravens are black', 'Not every raven is black', 'There is a raven that is not black', "There is a raven that isn't black",
            'It is not the case that all ravens are black', 'It is not the case that every raven is black']],
        ['everything', ['Everything is physical', 'All things are physical', 'Each thing is physical', 'Nothing is not physical',
            'There is nothing that is not physical', 'It is not the case that something is not physical']],
        ['nothing', ['Nothing is physical', 'No thing is physical', 'There is nothing that is physical', 'It is not the case that something is physical',
            'It is not the case that anything is physical']],
        ['something', ['Something is physical', 'At least one thing is physical', 'There is something that is physical', 'It is not the case that nothing is physical']],
        ['everyone', ['Everyone is mortal', 'Everybody is mortal', 'Every person is mortal', 'All people are mortal', 'Each person is mortal',
            'No one is not mortal', 'Nobody is not mortal']],
        ['no one', ['No one is immortal', 'Nobody is immortal', 'No person is immortal', 'There is no one who is immortal', 'It is not the case that someone is immortal']],
        ['someone', ['Someone is wise', 'Somebody is wise', 'Some person is wise', 'There is someone who is wise', 'At least one person is wise']],
        ['all, plain verb', ['All ravens fly', 'Every raven flies', 'Each raven flies', 'Any raven flies', 'No raven does not fly']],
        ['no, plain verb', ['No raven swims', 'No ravens swim', 'Nothing that is a raven swims', 'It is not the case that some raven swims']],
        ['some, plain verb', ['Some raven flies', 'Some ravens fly', 'At least one raven flies', 'There is a raven that flies', 'Something that is a raven flies']],
        ['everything, plain verb', ['Everything changes', 'All things change']],
        ['relative clause, plain verb', ['Everything that flies is a bird', 'All things that fly are birds', 'Whatever flies is a bird', 'Anything that flies is a bird']],
        ['whoever', ['Whoever is wise is happy', 'Everyone who is wise is happy', 'Anyone who is wise is happy', 'All who are wise are happy']]
    ],
    different: [
        ['everyone is not everything', 'Everyone is mortal', 'Everything is mortal'],
        ["a subject's number", 'The raven is black', 'The ravens are black'],
        ["a subject's article", 'The ground is wet', 'Ground is wet'],
        ['capital letters inside a sentence', 'The Republic fell', 'The republic fell'],
        ['a possessive', "Poe's wings are black", 'Poes wings are black'],
        ['math is read as written', '$x$ is even', '$y$ is even'],
        ['even if is not if', 'Even if it rains, the match goes on', 'If it rains, the match goes on'],
        ['because is not and', 'The ground is wet because it rains', 'The ground is wet and it rains'],
        ['since is not and', 'Since it rains, the ground is wet', 'It rains and the ground is wet'],
        ['unclear if is not a conditional', 'It is unclear if it rains', 'If it rains, it is unclear'],
        ['a raven is not the raven', 'A raven is black', 'The raven is black'],
        ['double negation', 'It is not the case that the ground is not wet', 'The ground is wet'],
        ['only reverses', 'Only ravens are black', 'All ravens are black'],
        ['all ... not is not no', 'All ravens are not white', 'No raven is white'],
        ['all ... not is not not all', 'All ravens are not white', 'Not all ravens are white'],
        ['must not is not cannot', 'Lights must not produce consciousness', 'Lights cannot produce consciousness'],
        ['so is not and', 'It rains, so the ground is wet', 'It rains and the ground is wet'],
        ['therefore is not and', 'It rains; therefore the ground is wet', 'It rains and the ground is wet']
    ],
    denies: [
        ['The ground is wet', "It's not the case that the ground is wet"],
        ['It rains', "It doesn't rain"],
        ['It will rain', "It won't rain"],
        ['Poe is black or white', 'Poe is neither black nor white'],
        ['It rains or it snows', 'Neither it rains nor it snows'],
        ['It rains and it snows', 'It is not the case that both it rains and it snows'],
        ['All ravens are black', 'Some ravens are not black'],
        ['All ravens fly', 'Some raven does not fly'],
        ['No raven is white', 'Some raven is white'],
        ['Everyone is mortal', 'Someone is not mortal'],
        ['Nobody is immortal', 'Somebody is immortal'],
        ['Nothing is physical', 'Something is physical'],
        ['Everything changes', 'Something does not change'],
        ['If it rains, then the ground is wet', 'It is not the case that if it rains, then the ground is wet']
    ],
    args: [
        ['modus ponens', ['The ground is wet provided that it rains', 'It rains'], 'The ground is wet', 'MP, provided that'],
        ['modus ponens', ['If it rains, the ground is wet', 'It rains'], 'The ground is wet', 'MP, if without then'],
        ['modus ponens', ['If it rains, and if it is cold, it snows', 'It rains'], 'If it is cold, it snows', 'MP, two conditions without then, one given'],
        ['modus tollens', ['If it rains, the ground is wet', 'The ground is not wet'], 'It does not rain', 'MT, if without then'],
        ['hypothetical syllogism', ['If it rains, the ground is wet', 'If the ground is wet, the match is cancelled'], 'If it rains, the match is cancelled', 'HS, if without then'],
        ['constructive dilemma', ['If it rains, the ground is wet', 'If it snows, the roads close', 'It rains or it snows'], 'The ground is wet or the roads close', 'CD, if without then'],
        ['modus ponens', ['The ground is wet if it rains', 'It rains'], 'The ground is wet', 'MP, if after'],
        ['modus ponens', ['Whenever it rains, the ground is wet', 'It rains'], 'The ground is wet', 'MP, whenever'],
        ['modus tollens', ['It rains only if the ground is wet', "The ground isn't wet"], "It doesn't rain", 'MT, only if'],
        ['disjunctive syllogism', ['It is raining unless it is snowing', 'It is not snowing'], 'It is raining', 'DS, unless'],
        ['disjunctive syllogism', ['It is raining or else it is snowing', "It isn't raining"], 'It is snowing', 'DS, or else'],
        ['disjunctive syllogism', ['Poe is black or white', 'Poe is not black'], 'Poe is white', 'DS, disjoined predicates'],
        ['conjunction elimination', ['The sky is blue but grass is green'], 'Grass is green', 'AndE, but'],
        ['conjunction elimination', ['Although grass is green, the sky is blue'], 'Grass is green', 'AndE, although'],
        ['conjunction elimination', ['Poe is black and small'], 'Poe is small', 'AndE, conjoined predicates'],
        ['conjunction elimination', ['Poe is neither black nor white'], 'Poe is not white', 'AndE, neither nor'],
        ['conjunction introduction', ['Poe flies', 'Poe sings'], 'Poe flies and sings', 'AndI, conjoined verbs'],
        ['disjunction introduction', ['Poe is black'], 'Poe is black or white', 'OrI, disjoined predicates'],
        ['universal elimination', ['Whatever flies is a bird'], 'If Poe flies, then Poe is a bird', 'UE, whatever'],
        ['universal elimination', ['Every raven flies'], 'If Poe is a raven, then Poe flies', 'UE, plain verb'],
        ['universal elimination', ['Nobody is immortal'], 'If Socrates is a person, then Socrates is not immortal', 'UE, nobody'],
        ['universal elimination', ['Only ravens are black'], 'If Poe is black, then Poe is a raven', 'UE, only'],
        ['universal elimination', ['Everything changes'], 'Poe changes', 'UE, everything, plain verb'],
        ['existential introduction', ['Poe flies'], 'Something flies', 'EI, plain verb'],
        ['existential introduction', ['Socrates is a person and Socrates is wise'], 'Someone is wise', 'EI, someone'],
        ['existential syllogism', ['There are ravens that are black', 'All black things are dark'], 'Some ravens are dark', 'ES, there are'],
        ['existential syllogism', ['Certain ravens fly', 'Everything that flies is a bird'], 'Some ravens are birds', 'ES, certain, plain verb'],
        ['modus ponens', ['If any raven is white, then the theory is false', 'Some raven is white'], 'The theory is false', 'MP: "any raven is white" in a condition is "some raven is white", one claim (quantifier words are logic)'],
        // ---- Strict matching: a claim a rule needs twice is spelled the same both times ----
        ['modus ponens', ['If God exists, then evil is an illusion', 'God exists'], 'Evil is an illusion', 'MP, a capital that begins a sentence is no difference'],
        ['modus ponens', ['If Caesar crossed the Rubicon, then the Republic fell', 'Caesar crossed the Rubicon'], 'The Republic fell', 'MP, proper nouns spelled alike'],
        [null, ['If the Republic fell, then Caesar won', 'The republic fell'], 'Caesar won', 'MP, capital letters differ'],
        ['modus ponens', ['If the ground is wet, then the match is off', 'The ground  is wet'], 'The match is off', 'MP, an extra space: certified as a form, and flagged on the map'],
        [null, ['If the ground is wet, then the match is off', 'Ground is wet'], 'The match is off', 'MP, the article differs'],
        [null, ['If the raven is black, then Poe is dark', 'The ravens are black'], 'Poe is dark', 'MP, the number differs'],
        ['modus ponens', ["If zombies aren't conceivable, then physicalism is true", 'Zombies are not conceivable'], 'Physicalism is true', 'MP, a contraction is one wording with its words'],
        ['modus ponens', ['If all ravens are black, then Poe is black', 'Every raven is black'], 'Poe is black', 'MP, a repeated quantifier spelled two ways: one claim'],
        [null, ['If it rains, then the ground is wet', 'It rains'], 'The Ground is wet', 'MP, the conclusion spelled differently'],
        ['modus tollens', ['If the Republic fell, then Caesar won', "Caesar didn't win"], 'It is not the case that the Republic fell', 'MT, denials spelled any way'],
        [null, ['If the Republic fell, then Caesar won', "Caesar didn't win"], 'The republic did not fall', 'MT, the denied claim spelled differently'],
        ['universal modus ponens', ['All Greeks are mortal', 'Socrates is a Greek'], 'Socrates is mortal', 'UMP, number and article follow the quantifier'],
        [null, ['All Ravens are black', 'Poe is a raven'], 'Poe is black', 'UMP, capital letters differ'],
        ['universal modus tollens', ['All humans are mortal', 'Zeus is not mortal'], 'Zeus is not human', 'UMT'],
        ['universal modus tollens', ['No humans are immortal', 'Zeus is immortal'], 'Zeus is not human', 'UMT, no'],
        ['universal modus tollens', ['Everyone who understands the argument accepts the conclusion', 'Mary does not accept the conclusion', 'Mary is a person'], 'Mary does not understand the argument', 'UMT, everyone who'],
        [null, ['Everyone who understands the argument accepts the conclusion', 'Mary does not accept the conclusion'], 'Mary does not understand the argument', 'UMT, everyone who, without "Mary is a person"'],
        ['universal modus tollens', ['∀x (H(x) → M(x))', '¬M(z)'], '¬H(z)', 'UMT, symbols'],
        [null, ['All humans are mortal', 'Zeus is mortal'], 'Zeus is human', 'affirming the consequent, universally'],
        ['biconditional elimination', ['It rains if and only if the ground is wet', 'It rains'], 'The ground is wet', 'BiE'],
        ['biconditional elimination', ['It rains if and only if the ground is wet', 'The ground is wet'], 'It rains', 'BiE, the other side'],
        ['biconditional elimination', ['P ↔ Q', 'Q'], 'P', 'BiE, symbols'],
        [null, ['If it rains, then the ground is wet, and if the ground is wet, then it rains', 'It rains'], 'The ground is wet', 'two conditionals written out are two claims, not a biconditional'],
        ['modus tollens', ['If any raven is white, then the theory is false', 'The theory is not false'], 'No raven is white', 'MT, any in a condition'],
        ['disjunctive syllogism', ['Either no raven is white or the survey erred', 'Some raven is white'], 'The survey erred', 'DS, no denied by some'],
        [null, ['It rains if and only if the ground is wet'], 'If the ground is wet, then it rains', 'a biconditional is not a conjunction: material equivalence, then conjunction elimination'],
        ['material equivalence', ['It rains if and only if the ground is wet'], 'If it rains, then the ground is wet, and if the ground is wet, then it rains', 'material equivalence writes a biconditional out'],
        [null, ['All ravens are not white'], 'If Poe is a raven, then Poe is not white', 'ambiguous: all ... not'],
        [null, ['Ravens are black'], 'If Poe is a raven, then Poe is black', 'a generic is not all'],
        [null, ['Most ravens are black'], 'If Poe is a raven, then Poe is black', 'most is not all'],
        [null, ['Even if it rains, the match goes on', 'It rains'], 'The match goes on', 'even if is not a conditional'],
        [null, ['It rains', 'The ground is wet'], 'The ground is wet because it rains', 'because is not and'],
        [null, ['The ground is wet'], 'It is unclear if it rains', 'unclear if']
    ],
    notes: [
        ['All ravens are not white', 'ambiguous'],
        ['Every raven is not white', 'ambiguous'],
        ['Everything is not physical', 'ambiguous'],
        ['All ravens do not fly', 'ambiguous'],
        ['It is raining and it is cold or it is snowing', 'ambiguous'],
        ['It is raining or it is cold and it is snowing', 'ambiguous'],
        ['Poe is not black or white', 'ambiguous'],
        ['Poe is not black and small', 'ambiguous'],
        ['Ravens are black', 'ambiguous'],
        ['Ravens fly', 'ambiguous'],
        ['A raven is black', 'ambiguous'],
        ['Most ravens are black', 'unread'],
        ['Many ravens are black', 'unread'],
        ['Few ravens are white', 'unread'],
        ['Several ravens are black', 'unread'],
        ['Almost all ravens are black', 'unread'],
        ['The majority of ravens are black', 'unread'],
        ['Ravens are always black', 'unread'],
        ['Ravens are never white', 'unread'],
        ['Ravens are usually black', 'unread'],
        ['Lights must not produce consciousness', 'unread'],
        ['Lights may not produce consciousness', 'unread'],
        ['Lights should not produce consciousness', 'unread'],
        ['Lights need not produce consciousness', 'unread'],
        ['Even if it rains, the match goes on', 'ambiguous'],
        ['The ground is wet because it rains', 'unread'],
        ['It rains, so the ground is wet', 'unread'],
        ['Either it is raining and it is cold, or it is snowing', null],
        ['All ravens are black', null],
        ['No raven is white', null],
        ['Poe is not black', null],
        ['If it rains, then the ground is wet and the match is off', null]
    ]
};
// Held out while the reader was being fixed against the corpus above.
const HELD_OUT = {
    same: [
        ['past denial', ['Descartes was not a materialist', "Descartes wasn't a materialist", 'It is not the case that Descartes was a materialist']],
        ['plural plain verb denial', ['Qualia do not exist', "Qualia don't exist", 'It is false that qualia exist']],
        ['modal denial', ['Physicalism cannot explain qualia', "Physicalism can't explain qualia", 'It is not the case that physicalism can explain qualia']],
        ['conjunction', ['Dualism is coherent and physicalism is incomplete', 'Dualism is coherent, but physicalism is incomplete',
            'Although physicalism is incomplete, dualism is coherent', 'Dualism is coherent; physicalism, however, is incomplete'.replace('; physicalism, however,', '; however, physicalism')]],
        ['conjoined predicates', ['The zombie argument is valid and sound', 'The zombie argument is valid and the zombie argument is sound']],
        ['disjunction', ['Either physicalism is true or dualism is true', 'Physicalism is true or dualism is true', 'Physicalism is true unless dualism is true']],
        ['disjoined predicates', ['Consciousness is either physical or non-physical', 'Consciousness is physical or consciousness is non-physical']],
        ['conditional', ['If zombies are conceivable, zombies are possible', 'Zombies are possible provided that zombies are conceivable',
            'Zombies are possible if zombies are conceivable', 'Zombies are conceivable only if zombies are possible',
            'Whenever zombies are conceivable, zombies are possible', 'Assuming zombies are conceivable, zombies are possible']],
        ['all', ['All humans are mortal', 'Every human is mortal', 'Each human is mortal', 'Anything that is human is mortal', 'Whatever is human is mortal']],
        ['some', ['Some philosophers are dualists', 'At least one philosopher is a dualist', 'There are philosophers who are dualists', 'Certain philosophers are dualists']],
        ['some not', ['Not every philosopher is a physicalist', 'Some philosophers are not physicalists', "At least one philosopher isn't a physicalist"]],
        ['no, plain verb', ['No physical fact entails the facts about qualia', 'It is not the case that some physical fact entails the facts about qualia']],
        ['relative clause, plain verbs', ['Everyone who understands the argument accepts the conclusion', 'Whoever understands the argument accepts the conclusion']],
        // Symbols.
        ['symbolic conditional', ['P → Q', 'P -> Q', 'P ⊃ Q', 'P => Q', '(P → Q)', 'If P, then Q']],
        ['symbolic conjunction', ['P ∧ Q', 'P & Q', 'P /\\ Q', 'P · Q', 'P and Q']],
        ['symbolic disjunction', ['P ∨ Q', 'P v Q', 'P | Q', 'P \\/ Q', 'P or Q']],
        ['symbolic negation', ['¬P', '~P', '!P', '-P', 'It is not the case that P']],
        ['symbolic universal', ['∀x (P(x) → Q(x))', '∀x(P(x) -> Q(x))', '(x)(Px ⊃ Qx)', '∀y (P(y) → Q(y))', '∀x P(x) → Q(x)', '$\\forall x (P(x) \\to Q(x))$']],
        ['symbolic existential', ['∃x (P(x) ∧ Q(x))', '(∃x)(Px & Qx)', '∃y(P(y) ∧ Q(y))']],
        ['a denied universal, symbols', ['¬∀x P(x)', '~(x)Px']],
        ['relations, up to variable names', ['∀x∀y (L(x,y) → L(y,x))', '∀y∀x (L(y,x) → L(x,y))']]
    ],
    different: [
        ['tight scope when nothing is free', '∀x P(x) → Q', '∀x (P(x) → Q)'],
        ['symbols are not English', 'P(a)', 'Poe is a raven']
    ],
    denies: [
        ['Qualia exist', "Qualia don't exist"],
        ['Every philosopher is a physicalist', 'Some philosophers are not physicalists'],
        ['P ∧ Q', '¬P ∨ ¬Q'],
        // In symbols a denial is as written: "∃x ¬P(x)" is quantifier negation's, from "¬∀x P(x)".
        ['∀x P(x)', '¬∀x P(x)'],
        ['P', '~P']
    ],
    args: [
        ['universal modus ponens', ['Everyone who understands the argument accepts the conclusion', 'Mary understands the argument', 'Mary is a person'], 'Mary accepts the conclusion', 'UMP, relative clause'],
        ['universal modus ponens', ['All humans are mortal', 'Socrates is human'], 'Socrates is mortal', 'UMP, English'],
        ['universal modus ponens', ['∀x (P(x) → Q(x))', 'P(a)'], 'Q(a)', 'UMP, symbols'],
        ['universal modus ponens', ['(x)(Fx ⊃ Gx)', 'Fa'], 'Ga', 'UMP, Copi'],
        ['modus ponens', ['P → Q', 'P'], 'Q', 'MP, symbols'],
        ['modus tollens', ['P -> Q', '~Q'], '~P', 'MT, symbols'],
        ['disjunctive syllogism', ['P v Q', '~P'], 'Q', 'DS, symbols'],
        ['conjunction elimination', ['P & Q'], 'Q', 'AndE, symbols'],
        ['double-negation elimination', ['¬¬P'], 'P', 'DNE, symbols'],
        ['hypothetical syllogism', ['P ⊃ Q', 'Q ⊃ R'], 'P ⊃ R', 'HS, symbols'],
        ['universal elimination', ['∀x F(x)'], 'F(a)', 'UE, symbols'],
        ['existential introduction', ['F(a)'], '∃x F(x)', 'EI, symbols'],
        ['existential syllogism', ['∃x (F(x) ∧ G(x))', '∀x (G(x) → H(x))'], '∃x (F(x) ∧ H(x))', 'ES, symbols'],
        ['universal syllogism', ['∀x (F(x) → G(x))', '∀x (G(x) → H(x))'], '∀x (F(x) → H(x))', 'US, symbols'],
        ['modus ponens', ['(P & Q) -> R', 'P & Q'], 'R', 'MP, a conjunctive condition, symbols'],
        ['modus tollens', ['If zombies are conceivable, zombies are possible', 'Zombies are not possible'], 'Zombies are not conceivable', 'MT, English'],
        ['disjunctive syllogism', ['Physicalism is true unless dualism is true', 'Dualism is not true'], 'Physicalism is true', 'DS, unless'],
        ['conjunction elimination', ['The zombie argument is valid and sound'], 'The zombie argument is sound', 'AndE, predicates'],
        [null, ['∀x (P(x) → Q(x))', 'Q(a)'], 'P(a)', 'affirming the consequent, symbols'],
        [null, ['P → Q', '¬P'], '¬Q', 'denying the antecedent, symbols'],
        [null, ['∃x (F(x) ∧ G(x))', '∃x (G(x) ∧ H(x))'], '∃x (F(x) ∧ H(x))', 'two particulars, symbols']
    ],
    notes: [
        ['Every philosopher is not a physicalist', 'ambiguous'],
        ['Physicalism is true and dualism is false or idealism is true', 'ambiguous'],
        ['Philosophers disagree', 'ambiguous'],
        ['Most philosophers are physicalists', 'unread'],
        ['Philosophers must not ignore qualia', 'unread'],
        ['Zombies are conceivable, so physicalism is false', 'unread'],
        ['∀x (P(x) → Q(x))', null]
    ]
};
// [premises, the conclusion derived (null: nothing obvious), its rule]
const DERIVATIONS = [
    [['If Caesar crossed the Rubicon, then the Republic fell', 'The Republic did not fall'], 'Caesar did not cross the Rubicon', 'modus tollens'],
    [['Caesar crossed the Rubicon', 'Caesar did not cross the Rubicon'], null],
    [['If Poe has wings, then Poe flies', 'Poe does not fly'], 'Poe does not have wings', 'modus tollens'],
    [['If Poe flies, then Poe has wings', 'Poe does not have wings'], 'Poe does not fly', 'modus tollens'],
    [['If zombies are not conceivable, then physicalism is true', 'Physicalism is not true'], 'Zombies are conceivable', 'modus tollens'],
    [['No humans are immortal', 'Socrates is human'], 'Socrates is not immortal', 'universal modus ponens'],
    [['Nothing that is physical is conscious', 'The brain is physical'], 'The brain is not conscious', 'universal modus ponens'],
    [['All ravens are birds', 'No birds are fish'], 'No ravens are fish', 'universal syllogism'],
    [['Some philosophers are dualists', 'No dualists are physicalists'], 'Some philosophers are not physicalists', 'existential syllogism'],
    [['Every philosopher is a thinker', 'Every thinker is mortal'], 'Every philosopher is mortal', 'universal syllogism'],
    [['All ravens are birds', 'All birds are warm-blooded animals'], 'All ravens are warm-blooded animals', 'universal syllogism'],
    [['Every raven is a bird', 'All birds are animals'], 'Every raven is an animal', 'universal syllogism'],
    [['If all ravens are black, then Poe is black', 'Poe is not black'], 'Some ravens are not black', 'modus tollens'],
    [['If some ravens are white, then not all ravens are black', 'All ravens are black'], 'No ravens are white', 'modus tollens'],
    [['If something is conscious, then physicalism is false', 'Physicalism is not false'], 'Nothing is conscious', 'modus tollens'],
    [['Either God does not exist or evil is an illusion', 'Evil is not an illusion'], 'God does not exist', 'disjunctive syllogism'],
    [['Either God does not exist or evil is an illusion', 'God exists'], 'Evil is an illusion', 'disjunctive syllogism'],
    [['It is not true that zombies are not possible'], 'Zombies are possible', 'double-negation elimination'],
    [['If functionalism is true, and if zombies are possible, then physicalism is false', 'Functionalism is true'], 'If zombies are possible, then physicalism is false', 'modus ponens'],
    [['If it rains and it is cold, then it snows', 'If it snows, then the roads close'], 'If it rains and it is cold, then the roads close', 'hypothetical syllogism'],
    [['If God exists, then evil is an illusion', 'Evil is not an illusion'], 'God does not exist', 'modus tollens'],
    [['If Brutus stabbed Caesar, then Brutus betrayed Rome', 'Brutus did not betray Rome'], 'Brutus did not stab Caesar', 'modus tollens'],
    [['If Caesar visited Gaul, then Caesar learned Gaulish', 'Caesar did not learn Gaulish'], 'It is not the case that Caesar visited Gaul', 'modus tollens'],
    [['If Caesar visited Gaul, then Caesar learned Gaulish', 'If Caesar closed the Senate, then Rome rebelled', 'Either Caesar did not learn Gaulish or Rome did not rebel'],
        'Either it is not the case that Caesar visited Gaul, or it is not the case that Caesar closed the Senate', 'destructive dilemma'],
    [['All ravens are black', 'Poe is black'], null],
    [['If it rains, then the ground is wet', 'The ground is wet'], null],
    [['It rains and it is cold'], null],
    [['If it rains, then the ground is wet', 'If it snows, then the roads close'], null],
    [['Only philosophers are wise', 'Socrates is wise'], 'Socrates is a philosopher', 'universal modus ponens'],
    [['Unless the argument is valid, the conclusion is unsupported', 'The argument is not valid'], 'The conclusion is unsupported', 'disjunctive syllogism'],
    [['Zombies are possible only if physicalism is false', 'Zombies are possible'], 'Physicalism is false', 'modus ponens'],
    [['Physicalism is true only if zombies are impossible', 'Zombies are not impossible'], 'Physicalism is not true', 'modus tollens'],
    [['Zombies are possible if and only if physicalism is false', 'Zombies are possible'], 'Physicalism is false', 'biconditional elimination'],
    [['If any raven is white, then not all ravens are black', 'All ravens are black'], 'No raven is white', 'modus tollens'],
    [['If Poe is black, then Poe is not white', 'Poe is white'], 'Poe is not black', 'modus tollens'],
    [['If the mind is the brain, then the mind is physical', 'The mind is not physical'], 'The mind is not the brain', 'modus tollens'],
    [['Either the mind is physical or dualism is true', 'Dualism is false'], 'The mind is physical', 'disjunctive syllogism'],
    [["If consciousness isn't physical, then physicalism is false", 'Physicalism is true'], 'Consciousness is physical', 'modus tollens'],
    [['If machines cannot think, then the Turing test fails', 'The Turing test does not fail'], 'Machines can think', 'modus tollens'],
    [["If the bill passes, the economy won't recover", 'The economy will recover'], 'The bill does not pass', 'modus tollens'],
    [['If ravens fly, then ravens have wings', 'Ravens do not have wings'], 'Ravens do not fly', 'modus tollens'],
    // "Everyone who", "all who": persons -- Mary's and Caesar's being one is a premise.
    [['Everyone who understands the argument accepts the conclusion', 'Mary does not accept the conclusion'], null],
    [['Everyone who understands the argument accepts the conclusion', 'Mary is a person who understands the argument'], 'Mary accepts the conclusion', 'universal modus ponens'],
    [['All who crossed the Rubicon were brave', 'Caesar is a person who crossed the Rubicon'], 'Caesar was brave', 'universal modus ponens'],
    [['Every Roman who crossed the Rubicon was brave', 'Caesar was not brave'], 'Caesar is not a Roman who crossed the Rubicon', 'universal modus tollens'],
    [['If Socrates is human, then Socrates is mortal.', 'Socrates is human.'], 'Socrates is mortal.', 'modus ponens'],
    // "If X, Y": conclusions keep the premises' way with "then"
    [['If it rains, the ground is wet', 'If the ground is wet, the match is cancelled'], 'If it rains, the match is cancelled', 'hypothetical syllogism'],
    [['If it rains, then the ground is wet', 'If the ground is wet, then the match is cancelled'], 'If it rains, then the match is cancelled', 'hypothetical syllogism'],
    [['If it rains, and if it is cold, it snows', 'It rains'], 'If it is cold, it snows', 'modus ponens'],
    [['If it rains, the ground is wet', 'If it snows, the roads close', 'It rains or it snows'], 'The ground is wet or the roads close', 'constructive dilemma'],
    [['If Poe is black, small, and loud, Poe is a raven', 'Poe is black, small, and loud'], 'Poe is a raven', 'modus ponens'],
    [['If P, Q', 'P'], 'Q', 'modus ponens'],
    // Universal modus tollens and biconditional elimination
    [['All humans are mortal', 'Zeus is not mortal'], 'Zeus is not a human', 'universal modus tollens'],
    [['No humans are immortal', 'Zeus is immortal'], 'Zeus is not a human', 'universal modus tollens'],
    [['It rains if and only if the ground is wet', 'The ground is wet'], 'It rains', 'biconditional elimination'],
    [['All humans are mortal', 'Zeus is mortal'], null],
    [['If it rains, then the ground is wet, and if the ground is wet, then it rains', 'It rains'], null],
    // Strict: a claim a rule needs twice must be spelled the same way; capitals and names are kept
    [['If the Republic fell, then Caesar won', 'The republic fell'], null],
    [['If the ground is wet, then the match is off', 'The ground  is wet'], 'The match is off', 'modus ponens'],
    [['If all ravens are black, then Poe is black', 'Some raven is black'], null],
    [['All Ravens are black', 'Poe is a raven'], null],
    [['If the Republic fell, then Caesar won', 'The Republic fell'], 'Caesar won', 'modus ponens'],
    [['All Greeks are mortal', 'Socrates is a Greek'], 'Socrates is mortal', 'universal modus ponens'],
    [['If God exists, then evil is an illusion', 'Evil is not an illusion'], 'God does not exist', 'modus tollens'],
    // Symbols
    [['P -> (Q -> R)', 'P', 'Q'], 'R', 'modus ponens, conditions together'],
    [['P -> (Q -> R)', 'P'], 'Q -> R', 'modus ponens'],
    [['(P ∨ Q) → R', '¬R'], '¬(P ∨ Q)', 'modus tollens'],
    [['P ∨ Q', 'P → R', 'Q → S'], 'R ∨ S', 'constructive dilemma'],
    [['¬¬P'], 'P', 'double-negation elimination'],
    [['A ⊃ B', 'B ⊃ C'], 'A ⊃ C', 'hypothetical syllogism'],
    [['\\forall x (Fx \\to Gx)', 'Fa'], 'Ga', 'universal modus ponens'],
    [['∀x(Human(x) → Mortal(x))', 'Human(socrates)'], 'Mortal(socrates)', 'universal modus ponens'],
    [['(x)(Fx ⊃ ~Gx)', 'Fa'], '~Ga', 'universal modus ponens'],
    [['(∃x)(Fx · Gx)', '(x)(Gx ⊃ Hx)'], '(∃x)(Fx · Hx)', 'existential syllogism'],
    [['~(P & Q) -> R', '~R'], 'P & Q', 'modus tollens'],
    [['P v Q', '~P'], 'Q', 'disjunctive syllogism'],
    [['∀x (F(x) → G(x))', 'G(a)'], null],
    [['P → Q', 'Q'], null]
];
// [the rule that certifies it (or null), premises, conclusion, label]: the
// equivalences, reductio, absorption, and biconditional elimination's denials.
const MORE_RULES = [
    ['biconditional elimination', ['It rains if and only if the ground is wet', 'It does not rain'], 'The ground is not wet', 'BiE, denials'],
    ['biconditional elimination', ['P ↔ Q', '¬Q'], '¬P', 'BiE, denials in symbols'],
    [null, ['It rains if and only if the ground is wet', 'It does not rain'], 'The ground is wet', 'BiE, not a denial given one'],
    ["De Morgan’s laws", ['It is not the case that both it rains and it snows'], 'It does not rain or it does not snow', 'DM, not both'],
    ["De Morgan’s laws", ['Neither does it rain nor does it snow'], 'It is not the case that either it rains or it snows', 'DM, neither'],
    ["De Morgan’s laws", ['¬(P ∧ Q)'], '¬P ∨ ¬Q', 'DM, symbols'],
    ["De Morgan’s laws", ['If it is not the case that both it rains and it snows, then the match is off'], 'If it does not rain or it does not snow, then the match is off', 'DM, inside a condition'],
    [null, ['It is not the case that both it rains and it snows'], 'It does not rain and it does not snow', 'DM, not the wrong way'],
    ['double-negation replacement', ['God exists'], 'It is not the case that it is not the case that God exists', 'double negation, a replacement rule on by default since r27.32'],
    ['double-negation elimination', ['The argument is not impossible'], 'The argument is possible', 'a denial word and "not": two denials, the main connective'],
    ['double-negation replacement', ['If it is not the case that it is not the case that it rains, then the ground is wet'], 'If it rains, then the ground is wet', 'inside a condition: double-negation replacement reaches it, double-negation elimination would not'],
    ['double-negation elimination', ['It is not the case that it is not the case that God exists'], 'God exists', 'DNE still named as before'],
    ['transposition', ['If it rains, then the ground is wet'], 'If the ground is not wet, then it does not rain', 'Trans'],
    ['transposition', ['P → Q'], '¬Q → ¬P', 'Trans, symbols'],
    [null, ['If it rains, then the ground is wet'], 'If it does not rain, then the ground is not wet', 'the converse of the inverse is not transposition'],
    ['material implication', ['If it rains, then the ground is wet'], 'It does not rain or the ground is wet', 'Impl'],
    ['material implication', ['P ∨ Q'], '¬P → Q', 'Impl, from a disjunction'],
    ['material equivalence', ['P ↔ Q'], '(P ∧ Q) ∨ (¬P ∧ ¬Q)', 'Equiv'],
    ['material equivalence', ['(P ∧ Q) ∨ (¬P ∧ ¬Q)'], 'P ↔ Q', 'Equiv, back'],
    ['exportation', ['If it rains and it is cold, then it snows'], 'If it rains, and if it is cold, then it snows', 'Exp'],
    ['exportation', ['If it rains, and if it is cold, then it snows'], 'If it rains and it is cold, then it snows', 'Exp, back'],
    ['exportation', ['(P ∧ Q) → R'], 'P → (Q → R)', 'Exp, symbols'],
    ['distribution', ['P ∧ (Q ∨ R)'], '(P ∧ Q) ∨ (P ∧ R)', 'Dist'],
    ['distribution', ['(P ∨ Q) ∧ (P ∨ R)'], 'P ∨ (Q ∧ R)', 'Dist, back'],
    ['idempotence', ['P ∨ P'], 'P', 'idempotence (an extension, on by default; off, the dilemma on P -> P does it)'],
    ['proof by cases', ['P → P', 'P → P', 'P ∨ P'], 'P', 'P ∨ P by a dilemma on P → P: one consequent, so proof by cases'],
    ['constructive dilemma', ['P → Q', 'R → S', 'P ∨ R'], 'Q ∨ S', 'different consequents: the constructive dilemma proper'],
    ['absorption', ['If it rains, then the ground is wet'], 'If it rains, then it rains and the ground is wet', 'Abs'],
    ['reductio', ['If God exists, then evil is an illusion', 'If God exists, then evil is not an illusion'], 'God does not exist', 'reductio'],
    ['consequentia mirabilis', ['P → ¬P'], '¬P', 'a claim that implies its own denial (a familiar step; the basis reductio takes two conditionals)'],
    [null, ['If God exists, then evil is an illusion', 'If God exists, then evil is real'], 'God does not exist', 'reductio needs a claim and its denial'],
    ['quantifier negation', ['Not all ravens are black'], 'Some ravens are not black', 'QN'],
    ['quantifier negation', ['It is not the case that some raven is white'], 'No raven is white', 'QN, some'],
    [null, ['Every raven is black'], 'All ravens are black', 'the same claim in other quantifier words is the same claim: it only restates its box'],
    ['conversion', ['No ravens are fish'], 'No fish are ravens', 'conversion, E'],
    ['conversion', ['Some philosophers are dualists'], 'Some dualists are philosophers', 'conversion, I'],
    [null, ['All ravens are birds'], 'All birds are ravens', 'an A-form does not convert'],
    ['contraposition', ['All ravens are black'], 'Nothing that is not black is a raven', 'contraposition'],
    ['contraposition', ['∀x (R(x) → B(x))'], '∀x (¬B(x) → ¬R(x))', 'contraposition, symbols'],
    [null, ['Some ravens are not black'], 'Some black things are not ravens', 'an O-form does not convert']
];

// The reader's verdicts on a corpus, in the app.
function readCorpus(W, C) {
    return T(W, `var C = ${J(C)};
        var key = function (t) { try { var f = parseClaim(t); return f ? claimKey(f) : 'null'; } catch (e) { return 'ERR ' + e.message; } };
        var res = { same: [], different: [], denies: [], args: [], notes: [] };
        C.same.forEach(function (g) {
            var keys = g[1].map(key), groups = {};
            g[1].forEach(function (t, i) { (groups[keys[i]] = groups[keys[i]] || []).push(t); });
            res.same.push({ label: g[0], ok: Object.keys(groups).length === 1, groups: groups });
        });
        C.different.forEach(function (d) { res.different.push({ label: d[0], ok: key(d[1]) !== key(d[2]), key: key(d[1]) }); });
        C.denies.forEach(function (d) {
            var a = parseClaim(d[0]), b = parseClaim(d[1]);
            res.denies.push({ label: d.join(' / '), ok: !!a && !!b && claimDenies(a, b) && claimDenies(b, a), a: key(d[0]), b: key(d[1]) });
        });
        C.args.forEach(function (a) {
            var cert = null, err = null;
            try { cert = certifyStep(a[1].map(function (t) { return parseClaim(t); }), [parseClaim(a[2])], false); } catch (e) { err = e.message; }
            var got = cert ? cert.name : null;
            res.args.push({ label: a[3], ok: got === a[0] && !err, want: a[0], got: got, err: err });
        });
        C.notes.forEach(function (n) {
            var kinds;
            try { kinds = claimNotes(n[0]).map(function (x) { return x.kind; }); } catch (e) { kinds = ['ERR ' + e.message]; }
            res.notes.push({ label: n[0], ok: n[1] ? kinds.indexOf(n[1]) >= 0 : kinds.length === 0, want: n[1], got: kinds });
        });
        return res;`);
}
function reportCorpus(name, res) {
    if (!res || res.__error) { ok(false, name + ': the corpus ran', res && res.__error); return; }
    const sections = [
        ['same', 'sentences read as one claim', x => J(x.groups)],
        ['different', 'pairs kept apart', x => x.key],
        ['denies', 'contradictories', x => x.a + ' / ' + x.b],
        ['args', 'arguments, each certified by its rule or by none', x => 'got ' + x.got + ', want ' + x.want + (x.err ? ' ERR ' + x.err : '')],
        ['notes', 'notes: ambiguous, unread, or none', x => 'got [' + x.got + '], want ' + x.want]
    ];
    sections.forEach(([key, label, why]) => {
        const items = res[key] || [], failed = items.filter(x => !x.ok);
        ok(items.length > 0 && failed.length === 0, `${name}: ${label} (${items.length - failed.length}/${items.length})`,
            failed.slice(0, 6).map(x => x.label + ': ' + why(x)).join(' | '));
    });
}

(async () => {
    console.log('=== r27 deductive check: English, formulas, derived parents ===');
    const W = makeWin('english');
    await sleep(250);

    /* ---------------- 1. the reader ---------------- */
    console.log('\n-- the reader --');
    reportCorpus('stress corpus', readCorpus(W, CORPUS));
    reportCorpus('held-out corpus', readCorpus(W, HELD_OUT));

    /* ---------------- 2. past tenses ---------------- */
    console.log('\n-- past tenses --');
    try {
        const past = T(W, `
            var key = function (t) { return claimKey(parseClaim(t)); };
            var denies = function (a, b) { return claimDenies(parseClaim(a), parseClaim(b)) && claimDenies(parseClaim(b), parseClaim(a)); };
            return {
                regular: ['Caesar crossed the Rubicon|Caesar did not cross the Rubicon', 'The Senate closed|The Senate did not close',
                          'Brutus stopped Caesar|Brutus didn\\u2019t stop Caesar', 'Plato tried|Plato did not try', 'Socrates died|Socrates did not die',
                          'The army agreed|The army did not agree', 'Rome rebelled|Rome did not rebel']
                    .map(function (p) { p = p.split('|'); return denies(p[0], p[1]); }),
                irregular: ['Caesar went to Rome|Caesar didn\\u2019t go to Rome', 'Brutus saw Caesar|Brutus did not see Caesar', 'Poe had wings|Poe did not have wings']
                    .map(function (p) { p = p.split('|'); return denies(p[0], p[1]); }),
                emphatic: key('Caesar crossed the Rubicon') === key('Caesar did cross the Rubicon'),
                quantified: key('Every Roman crossed the Rubicon') === key('All Romans crossed the Rubicon') &&
                    denies('Every Roman crossed the Rubicon', 'Some Roman did not cross the Rubicon'),
                presentNotPast: key('Ravens need water') === key('Ravens do need water') && key('Ravens need water') !== key('Ravens did need water'),
                ump: (certifyStep(['All who crossed the Rubicon were brave', 'Caesar crossed the Rubicon', 'Caesar is a person'].map(function (t) { return parseClaim(t); }),
                    [parseClaim('Caesar was brave')], false) || {}).name
            };`);
        ok(past.regular && past.regular.every(Boolean), 'a regular past tense and its "did not" deny each other — crossed, closed, stopped, tried, died, agreed, rebelled', J(past.regular));
        ok(past.irregular && past.irregular.every(Boolean), 'and an irregular one — went, saw, had', J(past.irregular));
        ok(past.emphatic === true && past.quantified === true, '"did cross" says "crossed", and quantified past tenses read and deny alike', J(past));
        ok(past.presentNotPast === true, 'a present tense ending in -ed ("need") is not read as a past', J(past));
        ok(past.ump === 'universal modus ponens', '"All who crossed the Rubicon were brave", "Caesar crossed the Rubicon" and "Caesar is a person" give "Caesar was brave"', J(past.ump));
    } catch (e) { ok(false, 'the section ran to the end', e.message); }

    /* ---------------- 2b. denials, hedges, generics, word forms ---------------- */
    console.log('\n-- denials, hedges, generics, word forms --');
    try {
        const d = T(W, `
            var key = function (t) { return claimKey(parseClaim(t)); };
            var denies = function (a, b) { return claimDenies(parseClaim(a), parseClaim(b)); };
            var step = function (premises, conclusion, type) {
                state.trees = [{ id: 'M', type: 'contention', texts: [conclusion], collapsed: [], x: 0, y: 0, children: [
                    { id: 'A', type: type || 'support', texts: premises, collapsed: [], children: [] } ] }];
                deductiveCache.clear();
                var s = collectDeductiveSteps(state.trees)[0];
                return { rule: s.rule && s.rule.name, ambiguous: s.ambiguous, why: s.why && s.why.text };
            };
            return {
                contractions: [["It's raining", 'It is raining'], ["She's written the book", 'She has written the book'], ["I'd gone", 'I had gone'],
                    ["I'd go", 'I would go'], ["They're wrong", 'They are wrong'], ["We'll win", 'We will win'], ["It could've been worse", 'It could have been worse'],
                    ["We can't leave", 'We cannot leave']].map(function (p) { return key(p[0]) === key(p[1]); }),
                possessive: key("Someone's view is wrong") !== key('Someone is view is wrong'),
                noObject: denies('This gives you no reason', 'This gives you a reason') && denies("This doesn't give you any reason", 'This gives you a reason'),
                exact: denies('The argument is invalid', 'The argument is valid') && denies('Consciousness is non-physical', 'Consciousness is physical') &&
                    denies("We're unable to leave", 'We can leave') && key('We are able to leave') === key('We can leave'),
                contraries: !denies('Poe is unhappy', 'Poe is happy') && !denies('This is invaluable', 'This is valuable'),
                hedge: step(["We can't leave"], 'We should be able to leave', 'objection'),
                generic: [step(['Ravens are black'], 'Something is black').rule, step(['All black things are dark', 'Ravens are black'], 'Ravens are dark').rule,
                    step(['A raven is black'], 'Something is black').rule, step(['It rains'], 'Something rains').rule],
                individual: step(['All black things are dark', 'Poe is black'], 'Poe is dark').rule,
                forms: { hoped: denies('Poe hoped', 'Poe did not hop'), hopped: denies('Poe hopped', 'Poe did not hop'),
                    learnt: denies('Poe learnt Latin', 'Poe did not learn Latin'), men: step(['All men are mortal', 'Socrates is a man'], 'Socrates is mortal').rule,
                    news: step(['All news is good', 'Poe is new'], 'Poe is good').rule }
            };`);
        ok(Array.isArray(d.contractions) && d.contractions.every(Boolean) && d.possessive === true,
            'a contraction is one wording with its words -- is, has, had, would, are, will, have, not -- but a possessive stays', J([d.contractions, d.possessive]));
        ok(d.noObject === true, '"gives you no reason" denies "gives you a reason", and so does "doesn\'t give you any reason"', J(d.noObject));
        ok(d.exact === true && d.contraries === true,
            'words that are exactly denials deny ("invalid", "non-physical", "unable to"), and "able to" is "can"; contraries and look-alikes do not', J([d.exact, d.contraries]));
        ok(d.hedge && d.hedge.rule === null && d.hedge.ambiguous === true && /should as presumably/.test(d.hedge.why || '') && /only denies the box it objects to: a denial is not an argument/.test(d.hedge.why || ''),
            '"We can\'t leave" against "We should be able to leave" is flagged: on the hedge reading it only denies its box, which is no argument', J(d.hedge));
        ok(J(d.generic) === J([null, null, null, null]) && d.individual === 'universal modus ponens',
            'a generic, an indefinite, and "it" are never one thing a quantifier\'s case is about; a name is', J([d.generic, d.individual]));
        ok(d.forms && d.forms.hoped === false && d.forms.hopped === true && d.forms.learnt === true && d.forms.men === 'universal modus ponens' && d.forms.news === null,
            'past tenses key by their own past form ("hoped" is not "hopped"; "learnt" is "learned"), irregular plurals match, and "news" is not the plural of "new"', J(d.forms));
    } catch (e) { ok(false, 'the section ran to the end', e.message); }

    /* ---------------- 2c. weak objections ---------------- */
    console.log('\n-- weak objections --');
    try {
        const w = T(W, `
            var step = function (premises) {
                state.trees = [{ id: 'M', type: 'contention', texts: ['God exists'], collapsed: [], x: 30000, y: 30000, children: [
                    { id: 'A', type: 'weak-objection', texts: premises, collapsed: [], children: [] } ] }];
                ensureCollabFields(state); selectedIds = []; render();
                deductiveCache.clear(); deductiveChecked.add('A'); refreshDerivationTags();
                var tag = document.querySelector('.derivation-tag[data-step="A"]');
                deductiveChecked.clear(); refreshDerivationTags();
                return tag ? tag.textContent : null;
            };
            return {
                wordings: ['It has not been shown that God exists', "It hasn't been established that God exists", 'It is not known that God exists',
                    'It is not certain that God exists', 'There is no good reason to believe that God exists', 'We do not know that God exists']
                    .map(function (t) { return step([t]); }),
                derived: step(['If the evidence is weak, then it is not known that God exists', 'The evidence is weak']),
                denial: step(['God does not exist']),
                none: step(['The evidence is weak']),
                misspelled: step(['It has not been shown that God Exists']),
                misspelledDerived: step(['If the evidence is weak, then it is not known that God Exists', 'The evidence is weak'])
            };`);
        ok(Array.isArray(w.wordings) && w.wordings.every(x => x === '✗ bare challenge'),
            'a weak objection that only says its box has not been established, in any of the common wordings, is a bare challenge: no argument', J(w.wordings));
        ok(w.derived === '✓ modus ponens' && w.denial === '✗ bare denial',
            'so does one whose premises derive that by a rule; one that only states the box\'s denial is a bare denial, no argument', J([w.derived, w.denial]));
        ok(w.none === '? not recognized' && w.misspelled === '✗ bare challenge' && w.misspelledDerived === '✗ spelled differently',
            'one that derives neither does not pass; a bare challenge is one however it is spelled, and a misspelled box is pointed out where spelling stands in the way', J([w.none, w.misspelled, w.misspelledDerived]));
    } catch (e) { ok(false, 'the section ran to the end', e.message); }

    /* ---------------- 2d. more rules ---------------- */
    console.log('\n-- the equivalences and more rules --');
    try {
        const got = T(W, `return ${J(MORE_RULES)}.map(function (c) {
            try { var r = certifyStep(c[1].map(function (t) { return parseClaim(t); }), [parseClaim(c[2])], false); return r ? r.name : null; }
            catch (e) { return 'ERR ' + e.message; }
        });`);
        const bad = MORE_RULES.map((c, i) => [c, Array.isArray(got) ? got[i] : undefined]).filter(([c, g]) => g !== c[0]);
        ok(bad.length === 0, 'each equivalence and rule certifies its steps, in English and in symbols, and not the look-alikes (' + MORE_RULES.length + ')',
            bad.map(([c, g]) => c[3] + ': got ' + g + ', want ' + c[0]).join(' | '));
    } catch (e) { ok(false, 'the section ran to the end', e.message); }

    /* ---------------- 3. diagnosis on a map ---------------- */
    console.log('\n-- ambiguous steps --');
    try {
        const d = T(W, `
            state.trees = [{ id: 'M', type: 'contention', texts: ['Poe is not white'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'A', type: 'support', texts: ['All ravens are not white', 'Poe is a raven'], collapsed: [], children: [] },
                { id: 'B', type: 'support', texts: ['Poe is a crow'], collapsed: [], children: [] },
                { id: 'C', type: 'support', texts: ['Most ravens are not white', 'Poe is a raven'], collapsed: [], children: [] }
            ] }];
            ensureCollabFields(state); selectedIds = []; render();
            toggleDeductiveLive();
            var tag = function (id) { var t = document.querySelector('.derivation-tag[data-step="' + id + '"]'); return t ? { text: t.textContent, cls: t.className, title: t.title } : null; };
            var tags = { A: tag('A'), B: tag('B'), C: tag('C') };
            openDeductiveCheck();
            var rows = Array.prototype.map.call(document.querySelectorAll('#logic-modal-body .logic-step'), function (r) {
                var why = r.querySelector('.logic-why');
                return { step: r.dataset.step, cls: r.className, mark: r.querySelector('.logic-mark').textContent, rule: r.querySelector('.logic-rule').textContent, why: why ? why.textContent : null };
            });
            var summary = document.getElementById('logic-modal-summary').textContent;
            closeDeductiveCheck();
            toggleDeductiveLive();
            return { tags: tags, rows: rows, summary: summary };`);
        const A = d.tags && d.tags.A, B = d.tags && d.tags.B, C = d.tags && d.tags.C;
        ok(A && A.text === '? ambiguous' && /\bambiguous\b/.test(A.cls), 'a step on a scope ambiguity is tagged "? ambiguous"', J(A));
        ok(A && /“All ravens are not white” is ambiguous/.test(A.title) && /Read as “no ravens are white”, the step follows by universal modus ponens/.test(A.title),
            'its tooltip gives the readings, and the one the step would follow on, by its rule', A && A.title);
        ok(B && B.text === '? not recognized' && !/ambiguous/.test(B.title), 'an unrecognized step is not silently declared invalid', J(B));
        ok(C && C.text === '? not recognized' && /“Most ravens are not white”: .*first-order/.test(C.title),
            'an unread sentence ("most") is named in the tooltip of a step that does not derive', C && C.title);
        const rowA = (d.rows || []).find(r => r.step === 'A');
        ok(rowA && /\bambiguous\b/.test(rowA.cls) && rowA.mark === '?' && /ambiguous/.test(rowA.rule) && /Read as “no ravens are white”/.test(rowA.why || ''),
            'in the list its row is marked "?", with the explanation under it', J(rowA));
        ok(/0 of 3 steps certified · 1 ambiguous/.test(d.summary || ''), 'and the summary counts the ambiguous steps', d.summary);
    } catch (e) { ok(false, 'the section ran to the end', e.message); }

    /* ---------------- 4. deriving a conclusion ---------------- */
    console.log('\n-- deriving a conclusion --');
    try {
        const got = T(W, `return ${J(DERIVATIONS)}.map(function (c) {
            try { var d = deriveConclusion(c[0]); return d ? { text: d.text, rule: d.rule.name } : null; } catch (e) { return { error: e.message }; }
        });`);
        const results = DERIVATIONS.map(([premises, text, rule], i) => {
            const o = Array.isArray(got) ? got[i] : null;
            const good = text === null ? o === null : !!o && o.text === text && o.rule === rule;
            return { premises, text, rule, o, good };
        });
        const group = (label, pick) => {
            const items = results.filter(pick), failed = items.filter(r => !r.good);
            ok(items.length > 0 && failed.length === 0, `${label} (${items.length - failed.length}/${items.length})`,
                failed.slice(0, 5).map(r => r.premises.join(' + ') + ' → want ' + (r.text === null ? 'nothing' : r.rule + ': ' + r.text) + ', got ' + (r.o ? (r.o.error || r.o.rule + ': ' + r.o.text) : 'nothing')).join(' | '));
        };
        const symbolic = r => r.premises.some(p => !/[a-z]{3}/.test(p.replace(/[A-Za-z]+\([^()]*\)/g, '')));
        group('English premises give their conclusion in their own words, with the right polarity, tense and agreement', r => r.text !== null && !symbolic(r));
        group('formulas give theirs in the premises’ own symbols', r => r.text !== null && symbolic(r));
        group('premises no generative rule uses all of get nothing — affirming the consequent, a lone conjunction, a biconditional, unrelated claims', r => r.text === null);
        const each = T(W, `return ${J(['modus ponens', 'modus tollens', 'hypothetical syllogism', 'constructive dilemma', 'destructive dilemma',
            'disjunctive syllogism', 'double-negation elimination', 'universal modus ponens', 'universal syllogism', 'existential syllogism'])};`);
        ok(Array.isArray(each) && each.every(name => results.some(r => r.good && r.rule === name)),
            'every generative rule derives a conclusion somewhere above', J(each));
        const skips = T(W, `return {
            conj: deriveConclusion(['The sky is blue', 'Grass is green']),
            elim: deriveConclusion(['The sky is blue and grass is green']),
            inst: deriveConclusion(['All ravens are black']),
            some: deriveConclusion(['Poe is black']),
            trivial: ['and-intro', 'and-elim', 'or-intro', 'existential-introduction', 'universal-elimination'].every(function (id) { return DERIVE_SKIPS.has(id); })
        };`);
        ok(skips && skips.conj === null && skips.elim === null && skips.inst === null && skips.some === null && skips.trivial === true,
            'conjunction introduction and elimination, disjunction introduction, existential introduction and universal elimination are never used', J(skips));
        const partial = T(W, `return deriveConclusion(['If it rains, then the ground is wet', 'It rains', 'Grass is green']);`);
        ok(partial === null, 'a rule that would leave a premise unused derives nothing', J(partial));
    } catch (e) { ok(false, 'the section ran to the end', e.message); }

    /* ---------------- 4b. strict matching ---------------- */
    console.log('\n-- strict matching --');
    try {
        const why = T(W, `return ${J([
            [['If the Republic fell, then Caesar won', 'The republic fell'], 'Caesar won'],
            [['If the ground is wet, then the match is off', 'The ground is wet'], 'The match is off'],
            [['If all ravens are black, then Poe is black', 'Every raven is black'], 'Poe is black'],
            [['All Ravens are black', 'Poe is a raven'], 'Poe is black'],
            [['If the Republic fell, then Caesar won', "Caesar didn't win"], 'The republic did not fall'],
            [['The sky is blue'], 'Grass is green']
        ])}.map(function (c) {
            var P = c[0].map(function (t) { return parseClaim(t); }), C = parseClaim(c[1]);
            var near = certifyStep(P, [C], false) ? null : claimNearMiss(P, [C], false);
            var d = near ? diagnoseDeductiveStep(c[0], c[1], false, near) : null;
            return { rule: near && near.rule.name, text: d && d.text };
        });`);
        const [cap, plain, words, quant, denial, none] = Array.isArray(why) ? why : [];
        ok(cap && cap.rule === 'modus ponens' && /‘republic’ and ‘Republic’ differ in capital letters/.test(cap.text),
            'a claim a rule needs twice, spelled with different capitals, is a near miss: the rule it would follow by, and the letters that differ', J(cap));
        ok(plain && plain.rule === null && plain.text === null, 'a step spelled alike is no near miss', J(plain));
        ok(words && words.rule === null && words.text === null,
            'quantifier words are logic: "every raven is black" and "all ravens are black" are one claim, so no near miss', J(words));
        const spaced = T(W, `return ${J([
            [['If it rains, then the ground is wet', 'It rains'], 'The ground  is wet'],
            [['If  it rains, then the ground is wet', 'It rains'], 'The ground is wet'],
            [['If it rains, then the ground is wet', 'It rains'], 'The ground is wet  ']
        ])}.map(function (c) {
            state.trees = [{ id: 'M', type: 'contention', texts: [c[1]], collapsed: [], x: 0, y: 0, children: [
                { id: 'A', type: 'support', texts: c[0], collapsed: [], children: [] } ] }];
            ensureCollabFields(state); selectedIds = []; render();
            deductiveChecked.add('A'); refreshDerivationTags();
            var tag = document.querySelector('.derivation-tag[data-step="A"]');
            deductiveChecked.clear(); refreshDerivationTags();
            return tag ? { text: tag.textContent, title: tag.title } : null;
        });`);
        ok(Array.isArray(spaced) && spaced[0] && spaced[0].text === '✗ extra space' &&
           /Without the extra space, this would follow by modus ponens, but ‘The ground {2}is wet’ has an extra space/.test(spaced[0].title) &&
           spaced[1] && spaced[1].text === '✗ extra space' && /‘If {2}it rains, then the ground is wet’ has an extra space/.test(spaced[1].title),
            'an extra space anywhere in a step -- between two logic words too -- holds it back, tagged "✗ extra space"', J(spaced));
        ok(spaced[2] && spaced[2].text === '✓ modus ponens', 'spaces at the end of a box are nothing', J(spaced[2]));
        ok(quant && quant.rule === 'universal modus ponens' && /‘Raven’ and ‘raven’ differ in capital letters/.test(quant.text),
            'so is a quantifier whose words are spelled otherwise in its case', J(quant));
        ok(denial && denial.rule === 'modus tollens' && /capital letters/.test(denial.text),
            'a denial may be worded any way, but the claim it denies must be spelled as written', J(denial));
        ok(none && none.rule === null && none.text === null, 'unrelated claims are no near miss', J(none));

        const map = T(W, `
            state.trees = [{ id: 'M', type: 'contention', texts: ['Caesar won'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'A', type: 'support', texts: ['If the Republic fell, then Caesar won', 'The republic fell'], collapsed: [], children: [] },
                { id: 'B', type: 'support', texts: ['If the Republic fell, then Caesar won', 'The Republic fell'], collapsed: [], children: [] }
            ] }];
            ensureCollabFields(state); selectedIds = []; render();
            toggleDeductiveLive();
            var tag = function (id) { var t = document.querySelector('.derivation-tag[data-step="' + id + '"]'); return t ? { text: t.textContent, cls: t.className, title: t.title } : null; };
            var tags = { A: tag('A'), B: tag('B') };
            openDeductiveCheck();
            var row = document.querySelector('#logic-modal-body .logic-step[data-step="A"]');
            var list = row ? { cls: row.className, mark: row.querySelector('.logic-mark').textContent, rule: row.querySelector('.logic-rule').textContent,
                why: (row.querySelector('.logic-why') || {}).textContent } : null;
            var summary = document.getElementById('logic-modal-summary').textContent;
            closeDeductiveCheck();
            toggleDeductiveLive();
            return { tags: tags, list: list, summary: summary };`);
        const A = map.tags && map.tags.A, B = map.tags && map.tags.B;
        ok(A && A.text === '✗ spelled differently' && /\buncertified\b/.test(A.cls) && /Spelled the same way each time, this would follow by modus ponens, but ‘republic’ and ‘Republic’ differ in capital letters/.test(A.title),
            'on the map its tag says "✗ spelled differently", and hovering it says what differs', J(A));
        ok(B && B.text === '✓ modus ponens', 'spelled alike, the same step is certified', J(B));
        ok(map.list && /near-miss/.test(map.list.cls) && map.list.mark === '≠' && /spelled differently/.test(map.list.rule) && /differ in capital letters/.test(map.list.why || '') &&
           /1 of 2 steps certified · 1 spelled differently/.test(map.summary || ''),
            'in the list its row is marked ≠ with the explanation, and the summary counts it', J(map));

        const toast = T(W, `
            window.__hints = []; var realHint = showHintToast; showHintToast = function (t, force) { window.__hints.push(t); return true; };
            state.trees = [{ id: 'G', type: 'support', texts: ['If the Republic fell, then Caesar won', 'The republic fell'], collapsed: [], x: 100, y: 100, freePosition: true, children: [] }];
            ensureCollabFields(state); selectedIds = ['G-0']; render();
            toggleStepChecks(['G']);
            showHintToast = realHint;
            return { trees: state.trees.length, top: state.trees[0].id, hint: window.__hints.slice(-1)[0] };`);
        ok(toast && toast.trees === 1 && toast.top === 'G' &&
           /Spelled the same way each time, these premises would give “Caesar won” by modus ponens, but ‘republic’ and ‘Republic’ differ in capital letters/.test(toast.hint || ''),
            'Derive Parent adds nothing for a near miss, and says what it would give and what to respell', J(toast));
        const spacedToast = T(W, `
            window.__hints = []; var realHint = showHintToast; showHintToast = function (t, force) { window.__hints.push(t); return true; };
            state.trees = [{ id: 'G', type: 'support', texts: ['If it rains, then the ground is wet', 'It  rains'], collapsed: [], x: 100, y: 100, freePosition: true, children: [] }];
            ensureCollabFields(state); selectedIds = ['G-0']; render();
            toggleStepChecks(['G']);
            showHintToast = realHint;
            return { trees: state.trees.length, hint: window.__hints.slice(-1)[0] };`);
        ok(spacedToast && spacedToast.trees === 1 && /Without the extra space, these premises would give “The ground is wet” by modus ponens, but ‘It {2}rains’ has an extra space/.test(spacedToast.hint || ''),
            'Derive Parent points out an extra space too, and adds nothing', J(spacedToast));
        const kept = T(W, `var d = deriveConclusion(['If God exists, then the Republic is safe', 'The Republic is not safe']); return d && d.text;`);
        ok(kept === 'God does not exist', 'a derived conclusion keeps the premises’ capitals', J(kept));
    } catch (e) { ok(false, 'the section ran to the end', e.message); }

    /* ---------------- 5. Derive Parent ---------------- */
    console.log('\n-- Derive Parent --');
    const shape = `function shape(nodes) { return nodes.map(function (n) {
        var o = { id: /^[A-Z]{1,2}$/.test(n.id) ? n.id : 'new', type: n.type, texts: n.texts };
        if (n.targetIndex !== undefined) o.t = n.targetIndex;
        if (n.x !== undefined) o.xy = [n.x, n.y];
        if (n.freePosition) o.free = true;
        if (n.zIndex) o.z = n.zIndex;
        if (n.children.length) o.children = shape(n.children);
        return o; }); }`;
    const hints = `window.__hints = []; var realHint = showHintToast; showHintToast = function (t, force) { window.__hints.push({ text: t, force: !!force }); return true; };`;
    const keyK = `document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'K', shiftKey: true, bubbles: true, cancelable: true }));`;
    try {
        const r = T(W, `${shape} ${hints}
            state.trees = [{ id: 'G', type: 'contention', texts: ['If zombies are conceivable, then zombies are possible', 'Zombies are conceivable'], collapsed: [], x: 30000, y: 30000, children: [] }];
            ensureCollabFields(state); selectedIds = ['G-1']; render();
            ${keyK}
            var derived = shape(state.trees);
            var sel = selectedIds.map(function (s) { return parseSel(s).id === state.trees[0].id ? 'new-' + parseSel(s).box : s; });
            var tags = Array.prototype.map.call(document.querySelectorAll('.derivation-tag'), function (t) { return [t.dataset.step, t.textContent]; });
            var checked = Array.from(deductiveChecked);
            undo();
            var undone = shape(state.trees);
            deductiveChecked.clear();
            state.trees = [{ id: 'H', type: 'objection', texts: ['The sky is blue', 'Grass is green'], collapsed: [], x: 100, y: 200, freePosition: true, zIndex: 3, children: [] }];
            ensureCollabFields(state); selectedIds = ['H-0']; render();
            ${keyK}
            var nothing = { trees: shape(state.trees), hint: window.__hints.slice(-1)[0] };
            state.trees = [{ id: 'S', type: 'contention', texts: ['Zombies are possible'], collapsed: [], x: 30000, y: 30000, children: [] }];
            ensureCollabFields(state); selectedIds = ['S-0']; render();
            ${keyK}
            var single = { trees: shape(state.trees), hint: window.__hints.slice(-1)[0] };
            state.trees = [{ id: 'E', type: 'support', texts: ['If it rains, then the ground is wet', ''], collapsed: [], x: 100, y: 100, freePosition: true, children: [] }];
            ensureCollabFields(state); selectedIds = ['E-0']; render();
            ${keyK}
            var empty = { trees: shape(state.trees), hint: window.__hints.slice(-1)[0] };
            state.trees = [{ id: 'P', type: 'support', texts: ['P ∨ Q', 'P → R', 'Q → S'], collapsed: [], x: 100, y: 100, freePosition: true, zIndex: 2, children: [] }];
            ensureCollabFields(state); selectedIds = ['P'];  render();
            ${keyK}
            var symbols = shape(state.trees);
            state.trees = [{ id: 'A', type: 'support', texts: ['All ravens are birds'], collapsed: [], x: 100, y: 100, freePosition: true, children: [] },
                           { id: 'B', type: 'support', texts: ['Every bird is an animal'], collapsed: [], x: 900, y: 100, freePosition: true, children: [] }];
            ensureCollabFields(state); selectedIds = ['A-0', 'B-0']; render();
            ${keyK}
            var two = { trees: shape(state.trees), hint: window.__hints.slice(-1)[0] };
            showHintToast = realHint;
            deductiveChecked.clear();
            return { derived: derived, sel: sel, tags: tags, checked: checked, undone: undone, nothing: nothing, single: single, empty: empty, symbols: symbols, two: two };`);
        ok(r.derived && J(r.derived) === J([{ id: 'new', type: 'contention', texts: ['Zombies are possible'], xy: [30000, 30000], children: [
                { id: 'G', type: 'support', texts: ['If zombies are conceivable, then zombies are possible', 'Zombies are conceivable'] }] }]),
            'Shift+K on a top premise group writes the conclusion in a box above it, which takes its place — here the main contention — and the group supports it', J(r.derived));
        ok(J(r.sel) === J(['new-0']) && J(r.checked) === J(['G']) && J(r.tags) === J([['G', '✓ modus ponens']]),
            'the new box is selected, and the step is checked: its tag names the rule', J(r));
        ok(r.undone && J(r.undone) === J([{ id: 'G', type: 'contention', texts: ['If zombies are conceivable, then zombies are possible', 'Zombies are conceivable'], xy: [30000, 30000] }]),
            'Ctrl+Z takes the derived box away', J(r.undone));
        ok(r.nothing && J(r.nothing.trees) === J([{ id: 'H', type: 'objection', texts: ['The sky is blue', 'Grass is green'], xy: [100, 200], free: true, z: 3 }]) &&
           r.nothing.hint && r.nothing.hint.force === true && /These premises don’t derive anything obvious/.test(r.nothing.hint.text),
            'premises that derive nothing obvious are left as they are, and a message says so — even with hints turned off', J(r.nothing));
        ok(r.single && r.single.trees.length === 1 && r.single.trees[0].id === 'S' && /This premise doesn’t derive anything obvious on its own/.test((r.single.hint || {}).text || ''),
            'a single box (a main contention) is told the same, in the singular', J(r.single));
        ok(r.empty && r.empty.trees[0].id === 'E' && /A box in this group is empty/.test((r.empty.hint || {}).text || ''),
            'a group with an empty box asks for its premise first', J(r.empty));
        ok(r.symbols && r.symbols[0].id === 'new' && J(r.symbols[0].texts) === J(['R ∨ S']) && J(r.symbols[0].xy) === J([100, 100]) && r.symbols[0].free === true && r.symbols[0].z === 2 &&
           r.symbols[0].children && r.symbols[0].children[0].id === 'P' && r.symbols[0].children[0].xy === undefined && r.symbols[0].children[0].z === undefined,
            'formulas give a formula; a pinned tree’s new top box takes its place, pin and stacking', J(r.symbols));
        ok(r.two && r.two.trees.length === 2 && /Select one premise group at a time/.test((r.two.hint || {}).text || ''),
            'separate boxes are not a premise group: Shift+K asks for one group at a time', J(r.two));

        const menu = T(W, `${shape}
            state.trees = [{ id: 'G', type: 'support', texts: ['P → Q', '¬Q'], collapsed: [], x: 100, y: 100, freePosition: true, children: [
                { id: 'C', type: 'support', texts: ['R'], collapsed: [], children: [] } ] }];
            ensureCollabFields(state); selectedIds = ['G-0']; render();
            var items = function () { return Array.prototype.slice.call(document.querySelectorAll('#context-menu .ctx-item')).map(function (b) { return b.textContent.trim(); }); };
            showContextMenu(10, 10, 'G', 0);
            var onTop = items();
            Array.prototype.slice.call(document.querySelectorAll('#context-menu .ctx-item')).find(function (b) { return /^Derive Parent/.test(b.textContent.trim()); }).click();
            var after = shape(state.trees);
            showContextMenu(10, 10, 'C', 0);
            var onChild = items();
            hideContextMenu();
            deductiveChecked.clear();
            return { onTop: onTop, after: after, onChild: onChild };`);
        ok((menu.onTop || []).some(t => /^Derive Parent\s*Shift\+K$/.test(t)) && !(menu.onTop || []).some(t => /Check This Step/.test(t)),
            'right-click on a top box offers Derive Parent (Shift+K) in place of Check This Step', J(menu.onTop));
        ok(menu.after && menu.after[0].id === 'new' && J(menu.after[0].texts) === J(['¬P']) && menu.after[0].children[0].id === 'G',
            'and it derives the parent', J(menu.after));
        ok((menu.onChild || []).some(t => /^Check This Step/.test(t)) && !(menu.onChild || []).some(t => /Derive Parent/.test(t)),
            'a box with a parent is offered Check This Step instead', J(menu.onChild));

        const viewOnly = T(W, `${shape} ${hints}
            state.trees = [{ id: 'G', type: 'contention', texts: ['If it rains, then the ground is wet', 'It rains'], collapsed: [], x: 30000, y: 30000, children: [] }];
            ensureCollabFields(state); selectedIds = ['G-0']; render();
            var realRO = collabReadOnly; collabReadOnly = function () { return true; };
            toggleStepChecks(['G']);
            collabReadOnly = realRO;
            showHintToast = realHint;
            return { trees: shape(state.trees), hint: window.__hints.slice(-1)[0] };`);
        ok(viewOnly && viewOnly.trees && viewOnly.trees.length === 1 && viewOnly.trees[0].id === 'G' && !viewOnly.trees[0].children &&
           /By modus ponens, these premises give “The ground is wet”/.test((viewOnly.hint || {}).text || ''),
            'on a view-only map the map is left alone, and the message gives the conclusion instead', J(viewOnly));

        const toast = T(W, `
            try { localStorage.setItem('argmap-hints-off', '1'); } catch (_) {}
            hideOneTimeHint();
            showHintToast('an ordinary hint');
            var el = document.getElementById('onetime-hint');
            var ordinary = !!(el && el.classList.contains('show'));
            showHintToast('a forced message', true);
            el = document.getElementById('onetime-hint');
            var forced = el ? el.textContent : null;
            hideOneTimeHint();
            try { localStorage.removeItem('argmap-hints-off'); } catch (_) {}
            return { ordinary: ordinary, forced: forced };`);
        ok(toast && toast.ordinary === false && toast.forced === 'a forced message',
            'with hints off an ordinary hint stays hidden, but the answer to Shift+K still shows, at the bottom of the map', J(toast));
    } catch (e) { ok(false, 'the section ran to the end', e.message); }

    /* ---------------- 6. Add Parent Above ---------------- */
    console.log('\n-- Add Parent Above --');
    try {
        const altUp = `document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', key: 'ArrowUp', altKey: true, bubbles: true, cancelable: true }));`;
        const r = T(W, `${shape} ${hints}
            state.trees = [{ id: 'M', type: 'contention', texts: ['Main'], collapsed: [], x: 30000, y: 30000, zIndex: 4, children: [
                { id: 'A', type: 'support', texts: ['a1', 'a2'], collapsed: [], children: [
                    { id: 'O', type: 'objection', texts: ['o1', 'o2'], collapsed: [], targetIndex: 1, children: [ { id: 'OS', type: 'support', texts: ['os'], collapsed: [], children: [] } ] } ] } ] }];
            ensureCollabFields(state); selectedIds = ['O-1']; render();
            ${altUp}
            var child = shape(state.trees);
            var focus = document.activeElement && document.activeElement.matches('textarea[data-id]') ? document.activeElement.dataset.id : null;
            var newId = state.trees[0].children[0].children[0].id;
            var focusedNew = focus === newId, selectedNew = JSON.stringify(selectedIds) === JSON.stringify([newId + '-0']);
            document.activeElement.blur();
            undo();
            var undone = shape(state.trees);
            selectedIds = ['M-0']; render();
            ${altUp}
            var top = shape(state.trees);
            document.activeElement.blur();
            state.trees = [{ id: 'N', type: 'note', texts: ['An aside'], collapsed: [], x: 5, y: 5, freePosition: true, children: [] }];
            ensureCollabFields(state); selectedIds = ['N-0']; render();
            var hintsBefore = window.__hints.length;
            var realOnce = showOneTimeHint; var onceText = null; showOneTimeHint = function (k, t) { onceText = t; };
            ${altUp}
            showOneTimeHint = realOnce;
            var note = { trees: shape(state.trees), said: onceText };
            state.trees = [{ id: 'X', type: 'support', texts: ['x'], collapsed: [], x: 5, y: 5, freePosition: true, children: [] },
                           { id: 'Y', type: 'support', texts: ['y'], collapsed: [], x: 500, y: 5, freePosition: true, children: [] }];
            ensureCollabFields(state); selectedIds = ['X-0', 'Y-0']; render();
            ${altUp}
            var many = { trees: shape(state.trees), hint: window.__hints.slice(-1)[0] };
            state.trees = [{ id: 'T', type: 'support', texts: ['typed'], collapsed: [], x: 5, y: 5, freePosition: true, children: [] }];
            ensureCollabFields(state); selectedIds = ['T-0']; render();
            focusTextarea('T', 0);
            var ta = document.activeElement;
            ta.value = 'typed, then Alt+Up'; ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', key: 'ArrowUp', altKey: true, bubbles: true, cancelable: true }));
            var typing = shape(state.trees);
            var typingFocus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.id === state.trees[0].id : false;
            document.activeElement.blur();
            showHintToast = realHint;
            return { child: child, focusedNew: focusedNew, selectedNew: selectedNew, undone: undone, top: top, note: note, many: many, typing: typing, typingFocus: typingFocus };`);
        ok(r.child && J(r.child[0].children[0].children) === J([{ id: 'new', type: 'objection', texts: [''], t: 1, children: [
                { id: 'O', type: 'support', texts: ['o1', 'o2'], children: [{ id: 'OS', type: 'support', texts: ['os'] }] }] }]),
            'Alt+Up on a co-premise puts an empty box above its whole group, in the group’s place: an objection on the same box of the same parent, the group now its support', J(r.child));
        ok(r.focusedNew === true && r.selectedNew === true, 'the new box is selected and open for typing', J(r));
        ok(r.undone && r.undone[0].children[0].children[0].id === 'O' && r.undone[0].children[0].children[0].type === 'objection',
            'Ctrl+Z puts the group back', J(r.undone));
        ok(r.top && r.top.length === 1 && r.top[0].id === 'new' && r.top[0].type === 'contention' && J(r.top[0].xy) === J([30000, 30000]) && r.top[0].z === 4 &&
           r.top[0].children[0].id === 'M' && r.top[0].children[0].type === 'support' && r.top[0].children[0].xy === undefined && r.top[0].children[0].z === undefined,
            'above a main contention the new box becomes the main contention, where it stood, and the old one a support', J(r.top));
        ok(r.note && r.note.trees.length === 1 && r.note.trees[0].id === 'N' && /Notes stand alone/.test(r.note.said || ''),
            'a note stands alone: nothing goes above it', J(r.note));
        ok(r.many && r.many.trees.length === 2 && /Select one box, or one premise group/.test((r.many.hint || {}).text || ''),
            'with boxes of two groups selected, it asks for one', J(r.many));
        ok(r.typing && r.typing[0].id === 'new' && r.typing[0].children[0].id === 'T' && J(r.typing[0].children[0].texts) === J(['typed, then Alt+Up']) && r.typingFocus === true,
            'from a box’s text field, Alt+Up keeps what was typed and moves on to the new box', J(r));

        const menu = T(W, `${shape}
            state.trees = [{ id: 'M', type: 'contention', texts: ['Main'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'A', type: 'support', texts: ['a1'], collapsed: [], children: [] } ] },
                { id: 'N', type: 'note', texts: ['An aside'], collapsed: [], x: 5, y: 5, freePosition: true, children: [] }];
            ensureCollabFields(state); selectedIds = ['A-0']; render();
            var items = function () { return Array.prototype.slice.call(document.querySelectorAll('#context-menu .ctx-item')); };
            showContextMenu(10, 10, 'A', 0);
            var item = items().find(function (b) { return /^Parent/.test(b.textContent.trim()); });
            var label = item ? item.textContent.trim() : null;
            item.click();
            var after = shape(state.trees);
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            selectedIds = ['N-0']; render();
            showContextMenu(10, 10, 'N', 0);
            var onNote = items().find(function (b) { return /^Parent/.test(b.textContent.trim()); });
            var noteDisabled = onNote ? onNote.disabled : null;
            hideContextMenu();
            return { label: label, after: after, noteDisabled: noteDisabled };`);
        ok(/^Parent\s*Alt\+↑$/.test(menu.label || '') && menu.after && menu.after[0].children[0].id === 'new' && menu.after[0].children[0].children[0].id === 'A',
            'right-click → Add Parent Above (Alt+↑) does the same', J(menu));
        ok(menu.noteDisabled === true, 'and is disabled on a note', J(menu.noteDisabled));

        const toolbar = T(W, `${shape}
            state.trees = [{ id: 'M', type: 'contention', texts: ['Main'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'O', type: 'objection', texts: ['o1'], collapsed: [], children: [] } ] },
                { id: 'N', type: 'note', texts: ['An aside'], collapsed: [], x: 5, y: 5, freePosition: true, children: [] }];
            ensureCollabFields(state); selectedIds = ['O-0']; render(); getSingleSelection(); refreshAttackButtons();
            var b = document.getElementById('btn-add-parent');
            var look = { edge: b.style.getPropertyValue('--look-edge'), off: b.disabled, label: b.textContent.trim(), tip: b.title };
            b.click();
            var after = shape(state.trees);
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            selectedIds = ['N-0']; render(); getSingleSelection();
            var onNote = document.getElementById('btn-add-parent').disabled;
            selectedIds = []; render(); getSingleSelection();
            var none = document.getElementById('btn-add-parent').disabled;
            return { look: look, after: after, onNote: onNote, none: none };`);
        ok(toolbar.look && /^Add Parent\s*Alt\+↑$/.test(toolbar.look.label) && toolbar.look.edge === 'var(--line-objection)' && toolbar.look.off === false &&
           /takes the group's place/.test(toolbar.look.tip),
            'the toolbar has Add Parent (Alt+↑), drawn as the box it makes: red above an objection', J(toolbar.look));
        ok(toolbar.after && toolbar.after[0].children[0].id === 'new' && toolbar.after[0].children[0].type === 'objection' &&
           toolbar.after[0].children[0].children[0].id === 'O' && toolbar.onNote === true && toolbar.none === true,
            'it adds the parent, and is disabled on a note and with nothing selected', J(toolbar));

        W.win.eval(`
            window.__realRect = Element.prototype.getBoundingClientRect;
            Element.prototype.getBoundingClientRect = function () {
                var r = function (l, t, w, h) { return { left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t }; };
                if (this.id === 'canvas') return r(0, 0, 1200, 800);
                if (this.id === 'surface') return r(0, 0, 60000, 60000);
                if (this.classList && this.classList.contains('node-group')) return r(400, 300, 390, 60);
                if (this.classList && this.classList.contains('node')) return r(400, 300, 180, 60);
                if (this.classList && this.classList.contains('derivation-tag')) return r(560, 270, 70, 15);
                return window.__realRect.call(this);
            };`);
        const plus = T(W, `${shape}
            var read = function () { var b = document.querySelector('.node-action-btn.action-parent'); if (!b) return null;
                var c = b.parentElement; return { cls: b.className, title: b.title, side: b.dataset.side, left: parseFloat(c.style.left), top: parseFloat(c.style.top), transform: c.style.transform }; };
            state.trees = [{ id: 'M', type: 'contention', texts: ['Main'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'O', type: 'objection', texts: ['o1', 'o2'], collapsed: [], children: [] } ] },
                { id: 'N', type: 'note', texts: ['An aside'], collapsed: [], x: 5, y: 5, freePosition: true, children: [] }];
            ensureCollabFields(state); selectedIds = ['O-1']; render(); updateNodeActions();
            var onObjection = read();
            var belowEl = document.querySelector('.node-action-btn.action-chooser');
            var below = belowEl ? { left: parseFloat(belowEl.parentElement.style.left), top: parseFloat(belowEl.parentElement.style.top) } : null;
            deductiveChecked.add('O'); refreshDerivationTags(); updateNodeActions();
            var withTag = read();
            deductiveChecked.clear(); refreshDerivationTags();
            selectedIds = ['N-0']; render(); updateNodeActions();
            var onNote = read();
            selectedIds = ['O-1']; render(); updateNodeActions();
            document.querySelector('.node-action-btn.action-parent').click();
            var after = shape(state.trees);
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            return { onObjection: onObjection, below: below, withTag: withTag, onNote: onNote, after: after };`);
        W.win.eval(`Element.prototype.getBoundingClientRect = window.__realRect;`);
        const p = plus.onObjection;
        const b = plus.below;
        ok(p && /action-parent/.test(p.cls) && /action-objection/.test(p.cls) && p.side === 'above' && /Parent \(Alt\+↑\)/.test(p.title) &&
           b && Math.abs(p.left - 490) < 0.01 && Math.abs(p.left - b.left) < 0.01 && /translate\(-50%, -100%\)/.test(p.transform) &&
           Math.abs((300 - p.top) - (b.top - 360)) < 0.01,
            'a selected box gets a + directly above it, in the color of the box: the mirror of the + below it', J([p, b]));
        ok(plus.withTag && Math.abs(plus.withTag.top - p.top) < 0.01 && Math.abs(plus.withTag.left - p.left) < 0.01,
            'and it stays there when the step has a derivation tag', J(plus.withTag));
        ok(plus.onNote === null, 'a note gets none', J(plus.onNote));
        ok(plus.after && plus.after[0].children[0].id === 'new' && plus.after[0].children[0].children[0].id === 'O',
            'clicking it adds the parent above the group', J(plus.after));
    } catch (e) { ok(false, 'the section ran to the end', e.message); }

    /* ---------------- 6b. focus mode ---------------- */
    console.log('\n-- focus mode --');
    try {
        const f = T(W, `
            state.trees = [{ id: 'M', type: 'contention', texts: ['Poe is black'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'A', type: 'support', texts: ['If Poe is a raven, then Poe is black', 'Poe is a raven'], collapsed: [], children: [
                    { id: 'AA', type: 'support', texts: ['Poe is a raven'], collapsed: [], targetIndex: 1, children: [] } ] },
                { id: 'B', type: 'support', texts: ['Poe is a bird'], collapsed: [], children: [] } ] }];
            ensureCollabFields(state); selectedIds = ['A-1']; render();
            if (!deductiveLive) toggleDeductiveLive();
            if (!focusMode) toggleFocusMode();
            updateLineHighlights();
            var read = function () {
                var out = {};
                Array.prototype.forEach.call(document.querySelectorAll('.derivation-tag'), function (el) { out[el.dataset.step] = el.classList.contains('tag-hl'); });
                return out;
            };
            var lit = read();
            render();
            var afterRender = read();
            var dimmed = document.getElementById('surface').classList.contains('has-node-highlight');
            toggleFocusMode();
            var off = { dimmed: document.getElementById('surface').classList.contains('has-node-highlight'), lit: read() };
            toggleDeductiveLive();
            return { lit: lit, afterRender: afterRender, dimmed: dimmed, off: off };`);
        ok(f.dimmed === true && f.lit && f.lit.AA === true && f.lit.A === false && f.lit.B === false,
            'in focus mode a derivation tag dims with its step: lit below the selected box, dimmed above and beside it', J(f));
        ok(f.afterRender && J(f.afterRender) === J(f.lit), 'and the tags keep that when the map is drawn again', J(f.afterRender));
        ok(f.off && f.off.dimmed === false && Object.keys(f.off.lit).every(k => f.off.lit[k] === false), 'out of focus mode nothing is dimmed', J(f.off));
    } catch (e) { ok(false, 'the section ran to the end', e.message); }

    /* ---------------- 6c. the main contention's verdict ---------------- */
    console.log('\n-- the main contention’s verdict --');
    try {
        const v = T(W, `
            var MAP = function (children) { return [{ id: 'M', type: 'contention', texts: ['God exists'], collapsed: [], x: 30000, y: 30000, children: children }]; };
            var S = { id: 'S', type: 'support', texts: ['If the universe is caused, then God exists', 'The universe is caused'], collapsed: [], children: [] };
            var O = { id: 'O', type: 'objection', texts: ['If evil exists, then God does not exist', 'Evil exists'], collapsed: [], children: [] };
            var read = function () {
                return Array.prototype.slice.call(document.querySelectorAll('.verdict-tag')).map(function (el) {
                    return { parent: el.parentElement.id, box: el.dataset.verdictBox, cls: el.className, text: el.textContent, title: el.title, top: el.style.top, hl: el.classList.contains('tag-hl') };
                });
            };
            state.trees = MAP([JSON.parse(JSON.stringify(S))]); ensureCollabFields(state); selectedIds = []; render();
            if (deductiveLive) toggleDeductiveLive();
            deductiveChecked.add('S'); refreshDerivationTags();
            var stepOnly = read();
            deductiveChecked.clear();
            toggleDeductiveLive();
            var established = read();
            state.trees = MAP([JSON.parse(JSON.stringify(S)), JSON.parse(JSON.stringify(O))]); render();
            var unresolved = read();
            state.trees = MAP([JSON.parse(JSON.stringify(O))]); render();
            var refuted = read();
            document.querySelector('.verdict-tag').click();
            var list = { open: document.getElementById('logic-modal-backdrop').classList.contains('open'), summary: document.getElementById('logic-modal-summary').textContent };
            closeDeductiveCheck();
            var weakRebuttal = JSON.parse(JSON.stringify(O));
            weakRebuttal.children = [{ id: 'WR', type: 'weak-objection', texts: ['If the evidence of evil is disputed, then it has not been shown that evil exists', 'The evidence of evil is disputed'], collapsed: [], targetIndex: 1, children: [] }];
            state.trees = MAP([weakRebuttal]); render();
            var stands = read();
            var weakened = JSON.parse(JSON.stringify(S));
            weakened.children = [{ id: 'W', type: 'weak-objection', texts: ['If the cosmological evidence is disputed, then it has not been shown that the universe is caused', 'The cosmological evidence is disputed'], collapsed: [], targetIndex: 1, children: [] }];
            state.trees = MAP([weakened]); render();
            var unestablished = read();
            state.trees = MAP([]); render();
            var none = read();
            state.trees = MAP([JSON.parse(JSON.stringify(S))]); selectedIds = ['M-0']; render();
            if (!focusMode) toggleFocusMode();
            updateLineHighlights();
            var focusOn = read();
            selectedIds = ['S-0']; updateLineHighlights();
            var focusOff = read();
            render();
            var focusRedrawn = read();
            toggleFocusMode(); selectedIds = [];
            toggleDeductiveLive();
            var off = read();
            return { stepOnly: stepOnly, established: established, unresolved: unresolved, refuted: refuted, list: list, stands: stands,
                     unestablished: unestablished, none: none, focusOn: focusOn, focusOff: focusOff, focusRedrawn: focusRedrawn, off: off };`);
        const one = list => list && list.length === 1 ? list[0] : {};
        ok(v.stepOnly && v.stepOnly.length === 0, 'checking single steps (Shift+K) gives no verdict: it needs every step', J(v.stepOnly));
        const e = one(v.established);
        ok(e.parent === 'group-M' && e.box === 'M-0' && /\bverdict-established\b/.test(e.cls || '') && e.text === '✓ Warranted' &&
           /^Warranted relative to the map/.test(e.title || '') && /Click for every step\.$/.test(e.title || '') && /^-/.test(e.top || ''),
            'with K, the main contention gets a pill above its box: ✓ Warranted when a valid support stands, and its hover says why', J(v.established));
        ok(/\bverdict-unresolved\b/.test(one(v.unresolved).cls || '') && one(v.unresolved).text === '✗ Unwarranted' &&
           /\bverdict-refuted\b/.test(one(v.refuted).cls || '') && one(v.refuted).text === '✗ Unwarranted' && /its denial follows/.test(one(v.refuted).title || ''),
            '✗ Unwarranted with a valid support and a valid objection both standing; ✗ Unwarranted with the objection alone', J([v.unresolved, v.refuted]));
        ok(v.list && v.list.open === true && /^Main contention: unwarranted · /.test(v.list.summary || ''),
            'clicking the pill opens the list of steps, whose summary starts with the verdict', J(v.list));
        ok(one(v.stands).text === '✗ Unwarranted' && /weak rebuttal/.test(one(v.stands).title || '') &&
           one(v.unestablished).text === '✗ Unwarranted' && /we can’t conclude that ‘God exists’ from/.test(one(v.unestablished).title || ''),
            'an undefeated weak rebuttal leaves it Open; a weak objection to a premise of its support leaves it not established, and says we can’t conclude it from those premises', J([v.stands, v.unestablished]));
        ok(one(v.none).text === '✗ Unwarranted', 'a bare contention is Open', J(v.none));
        ok(one(v.focusOn).hl === true && one(v.focusOff).hl === false && one(v.focusRedrawn).hl === false,
            'in focus mode the pill is lit with its box selected, and dims when another box is', J([v.focusOn, v.focusOff, v.focusRedrawn]));
        ok(v.off && v.off.length === 0, 'turning the check off takes the pill away', J(v.off));
    } catch (e) { ok(false, 'the section ran to the end', e.message); }

    /* ---------------- 7. Help ---------------- */
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
