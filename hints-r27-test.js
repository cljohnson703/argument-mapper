'use strict';
/**
 * What the check says of a step that takes more than one rule, or of a box
 * that holds more than one claim (r27.97). One rule per step (the user's rule,
 * r27.84): these steps stay uncertified, and the check says how to make them
 * steps of one rule each.
 *
 *   node hints-r27-test.js [argument-mapper-r27.html]
 *
 * 1. "Someone": "Socrates is wise" gives "someone is wise" once Socrates is
 *    shown to be a person -- from "Socrates is a person and Socrates is wise",
 *    by existential introduction.
 * 2. A name in -s is one in what the check says: "Socrates is a person", not
 *    "Socrates are people".
 * 3. A box that holds two claims, "Socrates is a man, and all men are mortal":
 *    as boxes side by side, the step would follow.
 * 4. Two rules in one step: the claim between them, both steps checked, and
 *    where to put it.
 * 5. "Must" is read as written; the check says what the step would be
 *    without it, as it does of "should".
 * 6. No hint where there is no route: a fallacy stays a fallacy.
 * 7. A step in the form of a common fallacy says which (r27.98): affirming
 *    the consequent, denying the antecedent, a converse or inverse, affirming a
 *    disjunct, undistributed middle, illicit major, illicit conversion, the
 *    existential fallacy, "some" to "all".
 * 8. Where nothing else is said, what the premises do give, and by what rule
 *    (r27.99): "The premises give “Socrates is mortal” by universal modus
 *    ponens, but not “Socrates will die”."
 * 9. "Poe must be black" to "Poe is black": the step takes a rule for "must"
 *    (r27.99).
 * 10. A named fallacy is the step's tag, "✗ affirming the consequent" (r27.100;
 *    the user's choice), and the verdict takes the step as invalid -- never of
 *    a step whose claims, each taken as true or false, give its conclusion.
 *    So of an objection or a rebuttal, against the denial of its box; not of
 *    a weak objection.
 * 11. "We know that P", "Everyone agrees that P", "Mary believes that P": what
 *    would follow with P itself, and why the box does not give P (r27.100).
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/hints-test', virtualConsole: vc,
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
// A step's tag, its rule, and what the check says of it.
const step = (premises, conclusion) => ev(`
    state.trees = [{ id: 'M', type: 'contention', texts: [${J(conclusion)}], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ${J(premises)}, collapsed: [], children: [] } ] }];
    deductiveCache.clear(); ensureCollabFields(state); render();
    var s = collectDeductiveSteps(state.trees)[0];
    return { tag: deductiveStepTagText(s), rule: s.rule ? s.rule.name : null, why: s.why && s.why.text || '' };`);
// The hint's claim between, followed: both steps of one rule each.
const both = (premises, between, firstFrom, secondWith, conclusion, rules) => {
    const a = step(firstFrom, between), b = step([between].concat(secondWith), conclusion);
    return a.rule === rules[0] && b.rule === rules[1];
};

console.log('\n-- 1. "someone": the person shown --');
{
    const s = step(['Socrates is wise.'], 'Someone is wise.');
    ok(!s.rule && s.why === '“Socrates is a person and Socrates is wise” would give “Someone is wise” by existential introduction, but the premises do not show that ‘Socrates is a person’.',
        '"Socrates is wise" to "someone is wise": what is missing, and the box it would follow from', J(s));
    ok(step(['Socrates is a person and Socrates is wise.'], 'Someone is wise.').rule === 'existential introduction', 'and from that box it does');
    ok(step(['John loves Mary.'], 'Someone loves Mary.').why ===
        '“John is a person and John loves Mary” would give “Someone loves Mary” by existential introduction, but the premises do not show that ‘John is a person’.',
        'so for "someone loves Mary"');
    ok(step(['Poe is black.'], 'Some raven is black.').why ===
        '“Poe is a raven and Poe is black” would give “Some raven is black” by existential introduction, but the premises do not show that ‘Poe is a raven’.',
        'and "some raven": a raven shown');
}

console.log('\n-- 2. a name in -s is one --');
{
    ok(step(['Everyone loves Mary.'], 'Socrates loves Mary.').why === '“Everyone loves Mary” would give “Socrates loves Mary” once it is shown that ‘Socrates is a person’.',
        '"Socrates is a person", not "Socrates are people"');
    ok(step(['All humans are mortal.'], 'Socrates is mortal.').why === '“All humans are mortal” would give “Socrates is mortal” once it is shown that ‘Socrates is human’.',
        '"Socrates is human"');
    ok(/‘The ravens are birds’/.test(step(['Every bird sings.'], 'The ravens sing.').why), 'a plural the reader knows stays plural: "the ravens are birds"',
        step(['Every bird sings.'], 'The ravens sing.').why);
}

console.log('\n-- 3. a box that holds two claims --');
{
    const s = step(['Socrates is a man, and all men are mortal.'], 'Socrates is mortal.');
    ok(!s.rule && s.why === '“Socrates is a man, and all men are mortal” holds two claims. As boxes side by side, “Socrates is a man” and “All men are mortal” would give “Socrates is mortal” by universal modus ponens.',
        'said, with each claim as a box would hold it', J(s));
    ok(step(['Socrates is a man.', 'All men are mortal.'], 'Socrates is mortal.').rule === 'universal modus ponens', 'and so it does');
    const named = step(['Mary sings, and if Mary sings, then Bob dances.'], 'Bob dances.');
    ok(/As boxes side by side, “Mary sings” and “If Mary sings, then Bob dances” would give “Bob dances” by modus ponens\./.test(named.why),
        'each claim in the box\'s capitals: "Mary", "Bob"', J(named));
    const mp = step(['It rains, and if it rains, then the ground is wet.'], 'The ground is wet.');
    ok(!mp.rule && /holds two claims\. As boxes side by side, “It rains” and “If it rains, then the ground is wet” would give “The ground is wet” by modus ponens\./.test(mp.why),
        'so for a conditional and its condition in one box: modus ponens', J(mp));
}

console.log('\n-- 4. two rules in one step --');
{
    const chain = step(['If it rains, then the ground is wet.', 'If the ground is wet, then the game is off.', 'It rains.'], 'The game is off.');
    ok(!chain.rule && chain.why === 'Getting to “The game is off” takes two steps. First, “If it rains, then the ground is wet” and “It rains” give “The ground is wet” by modus ponens. ' +
        'Then “The ground is wet” and “If the ground is wet, then the game is off” give “The game is off” by modus ponens. ' +
        'Add “The ground is wet” as a box of its own, with “If it rains, then the ground is wet” and “It rains” under it.',
        'modus ponens twice: the claim between, the premises of each step, and where to put it', J(chain));
    ok(both(null, 'The ground is wet.', ['If it rains, then the ground is wet.', 'It rains.'], ['If the ground is wet, then the game is off.'], 'The game is off.', ['modus ponens', 'modus ponens']),
        'and each step, so built, follows');
    // "Some raven is black" from these is one step since r27.134 (the
    // expository syllogism); "something is a black raven" still takes two.
    const ei = step(['Poe is a raven.', 'Poe is black.'], 'Something is a black raven.');
    ok(ei.why === 'Getting to “Something is a black raven” takes two steps. First, “Poe is a raven” and “Poe is black” give “Poe is black and Poe is a raven” by conjunction introduction. ' +
        'Then “Poe is black and Poe is a raven” gives “Something is a black raven” by existential introduction. ' +
        'Add “Poe is black and Poe is a raven” as a box of its own, with “Poe is a raven” and “Poe is black” under it.', 'conjunction introduction, then existential introduction', J(ei));
    ok(/give “Poe is black and Poe is a raven” by conjunction introduction/.test(step(['Poe is black.', 'Poe is a raven.'], 'Something is a black raven.').why),
        'the conjunction in the order that gives it, whatever order the premises have');
    const again = step(['All ravens are black.', 'Poe is a raven.'], 'Poe is a black raven.');
    ok(again.why === 'Getting to “Poe is a black raven” takes two steps. First, “All ravens are black” and “Poe is a raven” give “Poe is black” by universal modus ponens. ' +
        'Then “Poe is black” and “Poe is a raven” give “Poe is a black raven” by conjunction introduction. ' +
        'Add “Poe is black” as a box of its own, with “All ravens are black” and “Poe is a raven” under it.', 'a premise used again in the second step', J(again));
    ok(/First, “Either Poe is black or Poe is white” and “Poe is not white” give “Poe is black” by disjunctive syllogism\. Then “Poe is black” and “If Poe is black, then Poe is a raven” give “Poe is a raven” by modus ponens/.test(
        step(['Either Poe is black or Poe is white.', 'Poe is not white.', 'If Poe is black, then Poe is a raven.'], 'Poe is a raven.').why), 'disjunctive syllogism, then modus ponens');
    ok(/give “Socrates is mortal” by universal modus ponens\. Then “Socrates is mortal” gives “Socrates is mortal or Socrates is a god” by disjunction introduction/.test(
        step(['All men are mortal.', 'Socrates is a man.'], 'Socrates is mortal or Socrates is a god.').why), 'universal modus ponens, then disjunction introduction');
    ok(/First, “All men are mortal” and “Socrates is a man” give “Socrates is mortal” by universal modus ponens\. Then “Socrates is mortal” and “If Socrates is mortal, then Socrates will die” give “Socrates will die” by modus ponens/.test(
        step(['All men are mortal.', 'Socrates is a man.', 'If Socrates is mortal, then Socrates will die.'], 'Socrates will die.').why), 'universal modus ponens, then modus ponens');
}

console.log('\n-- 5. "must" read as written --');
{
    // Taken as what follows, "must" is a modal step (the user, 2026-10-13): it
    // is read as written, and the check says what the step would be without it.
    const c = step(['All men are mortal.', 'Socrates is a man.'], 'Socrates must be mortal.');
    ok(!c.rule && c.why === 'The premises give “Socrates is mortal” by universal modus ponens, but not “Socrates must be mortal”: the checker has no rules for “must” yet, as they belong to modal logic.',
        'in a conclusion', J(c));
    ok(/^With “If Socrates is a man, then he is mortal” for “If Socrates is a man, then he must be mortal”, the premises would give “Socrates is mortal” by modus ponens\. But the checker has no rules for “must” yet/.test(
            step(['If Socrates is a man, then he must be mortal.', 'Socrates is a man.'], 'Socrates is mortal.').why) &&
        /^The premises give “Some Greeks are mortal” by existential syllogism, but not “Some Greeks must be mortal”/.test(step(['All men are mortal.', 'Some Greeks are men.'], 'Some Greeks must be mortal.').why),
        'in a premise\'s consequent; after "some Greeks", "are"');
    const what = step(['Socrates is mortal.'], 'Socrates must be mortal.');
    ok(!what.rule && !/“must”/.test(what.why), 'not where taking it out leaves the premise said again ("what is, must be")', J(what));
    ok(!step(['If Socrates is a man, then he must be mortal.', 'Socrates is a man.'], 'Socrates is mortal.').rule, 'and nothing is certified');
}

console.log('\n-- 6. no route, no hint --');
{
    const ac = step(['If it rains, then the ground is wet.', 'If the ground is wet, then the game is off.', 'The game is off.'], 'It rains.');
    ok(!ac.rule && !/two steps|holds two claims|once it is shown|do not show/.test(ac.why), 'affirming the consequent twice over: nothing to suggest', J(ac));
    const da = step(['All men are mortal, and Socrates is not a man.'], 'Socrates is not mortal.');
    ok(!da.rule && !/two steps|holds two claims/.test(da.why), 'nor for denying the antecedent in a box of two claims', J(da));
    const nobody = step(['Socrates is wise.'], 'Everyone is wise.');
    ok(!nobody.rule && !/once it is shown|do not show|two steps/.test(nobody.why), 'nor from one case to all', J(nobody));
    ok(!step(['Socrates is a man, and all men are mortal.'], 'Socrates is mortal.').rule && !step(['Poe is a raven.', 'Poe is black.'], 'Something is a black raven.').rule,
        'and the steps it speaks of stay uncertified: one rule per step');
}

console.log('\n-- 7. a fallacy, named (r27.98) --');
{
    // Its tag names it (r27.100; the user: "✗ affirming the consequent", not "? not recognized").
    const named = (premises, conclusion, why, tag) => { const s = step(premises, conclusion); return !s.rule && s.tag === '✗ ' + tag && s.why === why; };
    ok(named(['If it rains, then the ground is wet.', 'The ground is wet.'], 'It rains.',
        '“If it rains, then the ground is wet” and “The ground is wet” do not give “It rains”: that is the fallacy of affirming the consequent.', 'affirming the consequent'),
        'affirming the consequent, in the boxes\' own words, and the tag "✗ affirming the consequent"');
    ok(named(['If it rains, then the ground is wet.', 'It does not rain.'], 'The ground is not wet.',
        '“If it rains, then the ground is wet” and “It does not rain” do not give “The ground is not wet”: that is the fallacy of denying the antecedent.', 'denying the antecedent'),
        'denying the antecedent');
    ok(named(['If it rains, then the ground is wet.'], 'If the ground is wet, then it rains.',
        '“If it rains, then the ground is wet” does not give “If the ground is wet, then it rains”: a conditional does not give its converse.', 'converse') &&
        named(['If it rains, then the ground is wet.'], 'If it does not rain, then the ground is not wet.',
        '“If it rains, then the ground is wet” does not give “If it does not rain, then the ground is not wet”: a conditional does not give its inverse.', 'inverse'),
        'a conditional\'s converse and inverse');
    ok(named(['Either the butler did the deed or the maid did the deed.', 'The butler did the deed.'], 'The maid did not do the deed.',
        '“Either the butler did the deed or the maid did the deed” and “The butler did the deed” do not give “The maid did not do the deed”: that is the fallacy of affirming a disjunct (“or” allows both).', 'affirming a disjunct'),
        'affirming a disjunct');
    ok(named(['All men are mortal.', 'Socrates is mortal.'], 'Socrates is a man.',
        '“All men are mortal” and “Socrates is mortal” do not give “Socrates is a man”: that is the fallacy of undistributed middle.', 'undistributed middle') &&
        named(['All men are mortal.', 'All dogs are mortal.'], 'All men are dogs.',
        '“All men are mortal” and “All dogs are mortal” do not give “All men are dogs”: that is the fallacy of undistributed middle.', 'undistributed middle'),
        'undistributed middle, with a name or with "all" twice');
    ok(named(['All men are mortal.', 'Fido is not a man.'], 'Fido is not mortal.',
        '“All men are mortal” and “Fido is not a man” do not give “Fido is not mortal”: that is the fallacy of illicit major.', 'illicit major'), 'illicit major');
    ok(step(['If someone is a man, then he is mortal.', 'Socrates is mortal.'], 'Socrates is a man.').why.indexOf(
        '“If someone is a man, then he is mortal” and “Socrates is mortal” do not give “Socrates is a man”: that is the fallacy of affirming the consequent.') === 0 &&
        /that is the fallacy of denying the antecedent/.test(step(['Being a man is sufficient for being mortal.', 'Socrates is not a man.'], 'Socrates is not mortal.').why),
        'an "all" worded as a conditional is named as a conditional is');
    ok(named(['All men are mortal.'], 'All mortals are men.', '“All men are mortal” does not give “All mortals are men”: that is the fallacy of illicit conversion.', 'illicit conversion') &&
        named(['All unicorns are white.'], 'Some unicorns are white.',
        '“All unicorns are white” does not give “Some unicorns are white”: that is the existential fallacy (“all” does not say that there are any).', 'existential fallacy') &&
        named(['Some ravens are black.'], 'All ravens are black.', '“Some ravens are black” does not give “All ravens are black”: what holds of some need not hold of all.', 'some to all'),
        'illicit conversion, the existential fallacy, "some" to "all"');
    ok(named(['No raven is black.'], 'Some ravens are not black.',
        '“No raven is black” does not give “Some ravens are not black”: that is the existential fallacy (“no” does not say that there are any).', 'existential fallacy'),
        'the existential fallacy in the premise\'s own word, "no"');
    const notes = t => ev(`return parseClaimFull(${J(t)}).notes.map(function (n) { return n.message; });`);
    ok(notes('If someone is a man, then he is mortal.').includes('"he" is read as the "someone" in the condition, so the box says what "everyone who is a man is mortal" says') &&
        notes('If a man is wise, then he is happy.').some(n => /^"he" is read as what the condition speaks of, so the box says what "every man that is wise is happy" says$/.test(n)),
        'the notes name the box, not "this"', J(notes('If a man is wise, then he is happy.')));
    const fido = step(['Fido is wise if something is wise.', 'Fido is wise.'], 'Something is wise.');
    ok(!/fallacy/.test(fido.why), 'not where a premise alone gives the conclusion: "Fido is wise" gives "something is wise"', J(fido));
    const tip = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['It rains.'], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ['If it rains, then the ground is wet.', 'The ground is wet.'], collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); render(); if (!deductiveLive) toggleDeductiveLive();
        var t = document.querySelector('.derivation-tag[data-step="A"]'), title = t && t.title; toggleDeductiveLive(); return title;`);
    ok(/^“If it rains, then the ground is wet” and “The ground is wet” do not give “It rains”: that is the fallacy of affirming the consequent\./.test(tip || '') &&
        !/limit of the check/.test(tip || ''), 'on the map the tag\'s tip gives the fallacy, not "the limit of the check, not a verdict"', tip);
    const row = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['It rains.'], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ['If it rains, then the ground is wet.', 'The ground is wet.'], collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); render(); openDeductiveCheck();
        var r = document.querySelector('#logic-modal-body .logic-step[data-step="A"]'), title = r && r.title; closeDeductiveCheck(); return title;`);
    ok(/that is the fallacy of affirming the consequent\.$/.test(row || '') && !/invalidity has not been established/.test(row || ''),
        'so in the list of every step', row);
    ok(!step(['If it rains, then the ground is wet.', 'It rains.'], 'The ground is wet.').why && !/fallacy/.test(step(['Mary believes that God exists.'], 'God exists.').why),
        'no name where the step is valid, or where its form is none of these');
    ok(ev(`return document.getElementById('help-panel') ? document.getElementById('help-panel').textContent : document.body.innerHTML;`)
        .includes('Hover over the tag (on a touch screen, press and hold it) to see what it found, such as a missing premise.') &&
        ev(`return document.getElementById('help-panel').textContent;`).includes('such as ✗ affirming the consequent: the step has the form of a common fallacy, so its premises can be true and its conclusion false.'),
        'Help says where to find it, and what a fallacy\'s tag means');
}

console.log('\n-- 8. what the premises give (r27.99) --');
{
    const die = step(['All men are mortal.', 'Socrates is a man.'], 'Socrates will die.');
    ok(!die.rule && die.tag === '? not recognized' && die.why === 'The premises give “Socrates is mortal” by universal modus ponens, but not “Socrates will die”.',
        'where nothing else is said: what the premises give, and by what rule', J(die));
    ok(step(['Every integer is even or odd.', 'Seven is an integer.'], 'Seven is even.').why ===
        'The premises give “Seven is even or odd” by universal modus ponens, but not “Seven is even”.', '"even or odd" is not "even"');
    ok(step(['Poe is not not black.'], 'Poe is not black.').why === '“Poe is not not black” gives “Poe is black” by double-negation elimination, but not “Poe is not black”.',
        'one premise, named', step(['Poe is not not black.'], 'Poe is not black.').why);
    ok(step(['Hesperus is the same as Phosphorus.'], 'Phosphorus is a planet.').why ===
        '“Hesperus is the same as Phosphorus” gives “Phosphorus is identical to Hesperus” by identity symmetry, but not “Phosphorus is a planet”.',
        'a name keeps its capital in the claim given ("Hesperus", not "hesperus")', step(['Hesperus is the same as Phosphorus.'], 'Phosphorus is a planet.').why);
    const ob = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['Socrates will die.'], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'objection', texts: ['All men are mortal.', 'Socrates is a man.'], collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); render(); var s = collectDeductiveSteps(state.trees)[0]; return s.why && s.why.text || '';`);
    // Of an objection too, since r27.115: what its premises give does not
    // deny the box it objects to.
    ok(ob === 'The premises give “Socrates is mortal” by universal modus ponens, which does not deny “Socrates will die”.',
        'of an objection: what its premises give, which does not deny its box (r27.115)', ob);
    ok(/takes two steps/.test(step(['All men are mortal.', 'Socrates is a man.', 'If Socrates is mortal, then Socrates will die.'], 'Socrates will die.').why) &&
        /fallacy of affirming the consequent\.$/.test(step(['If it rains, then the ground is wet.', 'The ground is wet.'], 'It rains.').why),
        'nor where the check says something else: two steps, a fallacy');
}

console.log('\n-- 9. "must" in a premise (r27.99) --');
{
    const poe = step(['Poe must be black.'], 'Poe is black.');
    ok(!poe.rule && poe.why === 'Getting from “Poe must be black” to “Poe is black” takes a rule for “must”, and the checker has none yet: such rules belong to modal logic.',
        '"Poe must be black" to "Poe is black": the step takes a rule for "must"', J(poe));
    ok(step(['All ravens must be black.'], 'All ravens are black.').why ===
        'Getting from “All ravens must be black” to “All ravens are black” takes a rule for “must”, and the checker has none yet: such rules belong to modal logic.',
        'so with "all", in place of "the claims differ"');
    ok(!/“must”/.test(step(['Poe is black.'], 'Poe must be black.').why), 'not the other way round: "what is, must be" takes more than a rule for "must"');
}

console.log('\n-- 10. a fallacy\'s tag, and the verdict (r27.100) --');
{
    // Never of a step whose claims, each taken as true or false, cannot have
    // true premises and a false conclusion: these two follow.
    const both = step(['If it rains, then both it rains and it is cold.', 'It does not rain.'], 'It is not the case that both it rains and it is cold.');
    const taut = step(['If Poe is black or Poe is not black, then Poe is a raven.', 'Poe is a raven.'], 'Poe is black or Poe is not black.');
    ok(both.tag === '? not recognized' && !/fallacy/.test(both.why) && taut.tag === '? not recognized' && !/fallacy/.test(taut.why),
        'not named where the step follows, in the form of a fallacy though it is: a denial the condition\'s denial gives; a conclusion true on its own', J([both, taut]));
    const row = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['It rains.'], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ['If it rains, then the ground is wet.', 'The ground is wet.'], collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); render(); openDeductiveCheck();
        var r = document.querySelector('#logic-modal-body .logic-step[data-step="A"] .logic-rule'), text = r && r.textContent; closeDeductiveCheck(); return text;`);
    ok(row === '✗affirming the consequent', 'in the list of steps, "✗ affirming the consequent"', row);
    // The verdict takes the step as invalid, as it does one with a counterexample.
    const verdict = children => ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['Socrates is a man.'], collapsed: [], x: 0, y: 0, children: ${J(children)} }];
        deductiveCache.clear(); ensureCollabFields(state); var steps = collectDeductiveSteps(state.trees), vf = claimMapVerdict(state.trees, steps), v = vf('M', 0);
        return { status: v.status, why: claimVerdictWhy(vf, v) };`);
    const support = { id: 'A', type: 'support', texts: ['All men are mortal.', 'Socrates is mortal.'], collapsed: [], children: [] };
    const objection = { id: 'B', type: 'objection', texts: ['If Socrates is a god, then Socrates is not a man.', 'Socrates is a god.'], collapsed: [], children: [] };
    const alone = verdict([support]);
    ok(alone.status === 'unestablished' && alone.why === 'Unwarranted: not established — the step from ‘All men are mortal.’ and ‘Socrates is mortal.’ is invalid (undistributed middle).',
        'the verdict says the step is invalid, and why', J(alone));
    const against = verdict([support, objection]);
    ok(against.status === 'refuted', 'and an objection that stands refutes the box: an invalid support leaves nothing unresolved', J(against));
    // "We cannot conclude that P from ...": the argument named, checked with
    // the capitals the box gives it ("socrates" had been a plural noun).
    const quoted = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ["We cannot conclude that Socrates is a man from 'All men are mortal' and 'Socrates is mortal'."], collapsed: [], x: 0, y: 0,
        children: [{ id: 'O', type: 'objection', texts: ['All men are mortal.', 'Socrates is mortal.'], collapsed: [], children: [] }] }];
        deductiveCache.clear(); ensureCollabFields(state); var steps = collectDeductiveSteps(state.trees), vf = claimMapVerdict(state.trees, steps), v = vf('M', 0);
        return { status: v.status, why: claimVerdictWhy(vf, v), tag: deductiveStepTagText(steps[0]), warrant: warrantStepExplanation(steps[0], vf) };`);
    ok(quoted.tag === '✗ undistributed middle' && quoted.status === 'established' &&
        quoted.why === 'Warranted, given the map’s premises: the argument from ‘All men are mortal.’ and ‘Socrates is mortal.’ is invalid (undistributed middle). Nothing that stands is against it.' &&
        quoted.warrant === 'This step is about the quoted argument that concludes “Socrates is a man”. “All men are mortal” and “Socrates is mortal” do not give “Socrates is a man”: ' +
            'that is the fallacy of undistributed middle. An invalid argument can’t answer the challenge.',
        '"We cannot conclude that ... from ...": the argument it names is invalid, so the claim is warranted', J(quoted));
    const elsewhere = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ["We cannot conclude that Socrates is a man from 'All men are mortal' and 'Socrates is mortal'."], collapsed: [], x: 0, y: 0, children: [] },
        { id: 'T', type: 'contention', texts: ['Socrates is a man.'], collapsed: [], x: 0, y: 0, children: [{ id: 'S', type: 'support', texts: ['All men are mortal.', 'Socrates is mortal.'], collapsed: [], children: [] }] }];
        deductiveCache.clear(); ensureCollabFields(state); var steps = collectDeductiveSteps(state.trees), vf = claimMapVerdict(state.trees, steps); return vf('M', 0).status;`);
    ok(elsewhere === 'established', 'so where the map makes that argument as a support', elsewhere);
    // A claim's only support invalid: no support holds up, and an objection
    // from it is undercut ("Functionalism is not ruled out").
    const undercut = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['Functionalism is not ruled out.'], collapsed: [], x: 0, y: 0,
        children: [{ id: 'O', type: 'objection', texts: ['If Q, then functionalism is ruled out.', 'Q'], collapsed: [], children: [
            { id: 'S', type: 'support', texts: ['If Q, then R.', 'R.'], targetIndex: 1, collapsed: [], children: [] }] }] }];
        deductiveCache.clear(); ensureCollabFields(state); var steps = collectDeductiveSteps(state.trees), vf = claimMapVerdict(state.trees, steps);
        return { status: vf('M', 0).status, tag: deductiveStepTagText(steps.find(function (s) { return s.childId === 'S'; })) };`);
    ok(undercut.tag === '✗ affirming the consequent' && undercut.status === 'established',
        'letters too: "If Q, then R" and "R" to "Q" is affirming the consequent, and an objection that rests on it is undercut', J(undercut));
    // An objection or a rebuttal: against the denial of the box it attacks.
    const attacked = (main, kind, texts) => ev(`state.trees = [{ id: 'M', type: 'contention', texts: [${J(main)}], collapsed: [], x: 0, y: 0,
        children: [{ id: 'O', type: ${J(kind)}, texts: ${J(texts)}, collapsed: [], children: [] }] }];
        deductiveCache.clear(); ensureCollabFields(state); var steps = collectDeductiveSteps(state.trees), vf = claimMapVerdict(state.trees, steps), v = vf('M', 0);
        return { status: v.status, why: claimVerdictWhy(vf, v), tag: deductiveStepTagText(steps[0]), step: steps[0].why ? steps[0].why.text : '' };`);
    const obj = attacked('Socrates is not a man.', 'objection', ['All men are mortal.', 'Socrates is mortal.']);
    ok(obj.tag === '✗ undistributed middle' &&
        obj.step === '“All men are mortal” and “Socrates is mortal” do not give the denial of “Socrates is not a man”: that is the fallacy of undistributed middle.' &&
        obj.status === 'stands' && obj.why === 'Unwarranted: no objection succeeds — the objection from ‘All men are mortal.’ and ‘Socrates is mortal.’ is invalid (undistributed middle) — ' +
            'but it has no support of its own, and beating objections doesn’t establish it.',
        'an objection: named against the denial of its box, and fended off', J(obj));
    const reb = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['The game is on.'], collapsed: [], x: 0, y: 0, children: [{ id: 'O', type: 'objection', texts: ['It does not rain.'], collapsed: [],
        children: [{ id: 'R', type: 'rebuttal', texts: ['If it rains, then the ground is wet.', 'The ground is wet.'], collapsed: [], children: [] }] }] }];
        deductiveCache.clear(); ensureCollabFields(state); return deductiveStepTagText(collectDeductiveSteps(state.trees).find(function (s) { return s.childId === 'R'; }));`);
    ok(reb === '✗ affirming the consequent', 'a rebuttal', reb);
    const qual = attacked('Functionalism is not ruled out.', 'objection', ['If functionalism is ruled out, then Q.', 'Q.']);
    ok(qual.tag === '✗ affirming the consequent' && qual.status === 'established' &&
        /the argument from ‘If functionalism is ruled out, then Q\.’ and ‘Q\.’ is invalid \(affirming the consequent\)/.test(qual.why),
        'an objection to "not ruled out" that is invalid grounds that claim', J(qual));
    const weak = attacked('Socrates is a man.', 'weak-objection', ['If Socrates is not a man, then Socrates is a god.', 'Socrates is a god.']);
    ok(weak.tag === '? not recognized' && !/fallacy/.test(weak.step), 'not a weak objection: what it gives is that a box has not been established', J(weak));
}

console.log('\n-- 11. what someone knows, shows or believes (r27.100) --');
{
    // Since r27.134 what is known or shown is so, by factive verbs (the user:
    // "Maybe the T axiom could be on by default"): a step of its own, where
    // the checker had had no rule.
    ok(step(['We know that all men are mortal.', 'Socrates is a man.'], 'Socrates is mortal.').why ===
        'With “All men are mortal” for “We know that all men are mortal”, the premises would give “Socrates is mortal” by universal modus ponens. ' +
        'But getting from the one to the other is a step of its own, by factive verbs: add “All men are mortal” as a box of its own, with “We know that all men are mortal” under it.',
        '"we know that": what would follow with the claim itself, and the step it takes');
    ok(step(['Everyone agrees that all men are mortal.', 'Socrates is a man.'], 'Socrates is mortal.').why ===
        'With “All men are mortal” for “Everyone agrees that all men are mortal”, the premises would give “Socrates is mortal” by universal modus ponens. ' +
        'But “Everyone agrees that all men are mortal” does not give “All men are mortal”: what is agreed on can be false.', '"everyone agrees that": what is agreed on can be false');
    ok(step(['Mary believes that God exists.'], 'God exists.').why === '“Mary believes that God exists” does not give “God exists”: what is believed can be false.' &&
        ['We know that God exists.', 'Studies have shown that smoking causes cancer.', 'It is known that God exists.'].every((t, i) =>
            step([t], i === 1 ? 'Smoking causes cancer.' : 'God exists.').rule === 'factive verbs'),
        'from the claim alone: "believes" gives nothing; "know", "have shown", "it is known" give it, by factive verbs');
    ok(!step(['Mary believes that God exists.'], 'God exists.').rule && !step(['We know that all men are mortal.', 'Socrates is a man.'], 'Socrates is mortal.').rule,
        'and what is believed, or a step of two, is not certified');
    ok(!/what is|takes a rule/.test(step(['Mary denies that God exists.'], 'God does not exist.').why) &&
        !/what is|takes a rule/.test(step(['Nobody believes that God exists.'], 'God does not exist.').why) &&
        !/what is|takes a rule/.test(step(['Mary does not believe that God exists.'], 'God does not exist.').why),
        'not what someone denies, what nobody believes, or what someone does not believe');
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
