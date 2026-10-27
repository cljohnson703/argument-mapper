'use strict';
/**
 * Rules of ordinary reasoning (r27.134; the user asked that the app have "all
 * the basic logical rules that we use in ordinary reasoning", and agreed to
 * add those missing, with: "if expository syllogism is a known rule, we can
 * add it to optional rules"; of factives, "Maybe the T axiom could be on by
 * default"; of "either way", "we can add it as an optional rule").
 *
 *   node rules-r27-ordinary-test.js [argument-mapper-r27.html]
 *
 * 1. Factive verbs: "X knows that A" gives A, in every tense, whatever A is;
 *    likewise "realizes", "discovered", "proved", "regrets", "is aware that",
 *    "is glad that". Not "believes", nor a denial, nor a "that" inside the
 *    subject. A group of its own, on by default; off, the check says so; a
 *    step of two says which box is missing.
 * 2. "Glad that", "sorry that", "aware that" take a claim, not a relative
 *    clause: "Bob is glad that Mary left" had been "Bob is glad, and Mary left
 *    Bob", and gave "Mary left Bob".
 * 3. The expository syllogism: "a is F" and "a is G" give "some F is G", in
 *    either order, denied ("some F is not G"), and with "someone".
 * 4. "Either way": "if A, then C" and "if not A, then C" give C; with "A or
 *    not A" said, proof by cases did already.
 * 5. Existential introduction in either order: "Socrates is wise and
 *    Socrates is a man", "Poe is a black raven", so "some man is wise", "some
 *    raven is black".
 * 6. Each a switch: off, its step is not certified.
 * 7. (r27.135) The universal syllogism after a verb: "Poe loves every
 *    raven" and "every crow is a raven" give "Poe loves every crow"; "loves
 *    no raven", "loves no crow". Not the other way, nor from "every" to "no".
 * 8. "There are dogs" says that some dogs exist: with "all dogs are
 *    mammals", "some dogs are mammals".
 * 9. Every categorical syllogism that is not valid is named by the rule of
 *    the syllogism it breaks first; "some ... are not" converted too.
 * 10. Any rule a map has switched off: the check says which switch would
 *    give the step -- not the catch-alls.
 * 11. (r27.136) Relations: every pair of converses both ways ("Bob is taller
 *    than Al", "Al is shorter than Bob"), denied too, and "more" and "less";
 *    what is symmetric ("married to") both ways; what is transitive passed
 *    along, any comparative; what is asymmetric denied the other way round.
 *    Not "taller" both ways, not "similar to" or "parent of" passed along,
 *    not "a man", not "loves". A group of its own, on by default.
 * 12. (r27.137) Dropping a modifier: "Bob ran quickly", so "Bob ran"; "Bob is
 *    very tall", so "Bob is tall". Not "almost", "hardly"; not under "not";
 *    not "behaved badly"; not a noun in -ly ("family"), nor a phrase. A
 *    group of its own, on by default.
 * 13. (r27.138) Overlapping rules made separate (the user: "Those that should
 *    be separate rules with separate steps are made so"): with proof by
 *    cases, biconditional elimination or double-negation elimination
 *    switched off, the constructive dilemma, substitution of equivalents and
 *    double-negation replacement no longer take their steps; nor does
 *    contraposition take conversion's. Each still takes its own.
 * 14. (r27.140) Existential introduction from an object of a kind: "Bob
 *    loves a raven", so "Bob loves something" and "something is a raven".
 *    Not "someone", not "every raven", not "almost", not after "fears".
 * 15. (r27.141) A "that" clause dropped: "Bob is glad that Mary left", so
 *    "Bob is glad" (the user: "The 'that' part of the sentence just tells
 *    us what it is that is making Bob glad"); not "happy", "proud" or
 *    "sorry", whose bare word can say more -- the check says what -- nor
 *    under "not". Relations of two senses ("The rope is shorter than the
 *    cable" had given "The cable is taller than the rope"; the user: "it
 *    should give 'The cable is longer than the rope'"): "shorter",
 *    "lighter", "thinner" give no converse -- the check says how to say it
 *    -- but "shorter in length than" and "less tall than" do; a converse to
 *    them still follows, the premise giving the sense.
 * 16. (r27.142) Quantifier distribution over a kind: "every raven is black
 *    and old" is "every raven is black and every raven is old"; "some", "no"
 *    and "nothing" with "or"; "some ... and" and "every ... or every" one
 *    way. And the technical steps (the user: "Switch those to on-by-default
 *    that you think reflect ordinary reasoning"): absorption, predicate
 *    congruence, Boolean absorption, the ⊥ laws, the rules of passage and
 *    the vacuous quantifier anywhere, a group off by default; resolution,
 *    change of bound variable and quantifier distribution stay on.
 * 17. (r27.143) A rule under a quantifier does not take a step a rule the
 *    map has switched off takes whole (the user: "sure, close the
 *    loophole"): with conversion off, "No dogs are cats", so "No cats are
 *    dogs", had passed as transposition under ∀. And syllogism names, a
 *    switch off by default inside Familiar steps (the user: "toggle
 *    syllogism names ON for those that want to replace the ordinary with
 *    syllogism names, default OFF"; "Inside 'Familiar steps'"): on,
 *    Barbara, Celarent, Darii and Ferio by their mood.
 * 18. (r27.144) A "Switch on" button (the user: "both"): a step that a
 *    switched-off rule would certify opens, from its tag, the check's words
 *    and a button that switches the rule on for this map; the list of steps
 *    has the same button after the words. Not where the map is read-only.
 *    Contraries and contradictories, metaphysical necessity and its axioms
 *    too.
 * 19. (r27.145) "The student" is the one "a student" speaks of (the user
 *    chose it): in a condition's consequent, as "that student" is; and a
 *    conclusion's "the student", the one a premise's "a student" speaks of
 *    -- "every student that cheats will be caught", "a student cheats", so
 *    "the student will be caught". Not with two premises it could be, nor
 *    another noun. And inside a kind, "a" as a verb phrase has it: "every
 *    tool that is used by a carpenter", "a tool that is used by a
 *    carpenter", one kind (they had differed by "a").
 * 20. (r27.146) The existential fallacy says how to mend the step (the
 *    user: "Sure. I don't want the unsafe version"): "Every raven is
 *    black", so "some raven is black", is still refused, and the check adds
 *    "Add 'There are ravens' and it follows" -- only where the step with
 *    that box is one it takes. It quotes "everyone" and "nobody" as the
 *    premise says them. And "Bob is James" keeps the name ("Jame" had been
 *    read), so "James is Bob" follows.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/ordinary-rules-test', virtualConsole: vc,
    beforeParse(w) {
        w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
        w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        const ctx = new Proxy({}, { get: (_, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
        w.alert = () => {}; w.confirm = () => true; w.prompt = () => null;
    }
});
const W = dom.window, J = JSON.stringify;
const ev = src => JSON.parse(W.eval('JSON.stringify((function(){' + src + '})())'));
let passed = 0, failed = 0;
function ok(cond, label, detail) {
    if (cond) { passed++; console.log('  ✓ ' + label); }
    else { failed++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}
// A step: its rule's name, and what the check says of it.
W.eval(`window.__step = function (premises, conclusion, type) {
    var trees = [{ id: 'M', type: 'contention', texts: [conclusion], collapsed: [], children: [{ id: 'A', type: type || 'support', texts: premises, collapsed: [], children: [] }] }];
    var st = collectDeductiveSteps(trees)[0];
    return st ? { rule: st.rule ? st.rule.name : null, why: st.why && st.why.text || '' } : null;
};`);
const step = (premises, conclusion, type) => ev('return __step(' + J(premises) + ', ' + J(conclusion) + ', ' + J(type || 'support') + ');');
// Each [premises, conclusion] whose step is not certified by `rule`.
const misses = (cases, rule) => cases.map(([p, c]) => [p, c, step(p, c)]).filter(([, , r]) => !r || r.rule !== rule).map(([p, c, r]) => p.join(' / ') + ' ∴ ' + c + ': ' + (r && r.rule));
// ... and those certified at all.
const certified = cases => cases.map(([p, c]) => [p, c, step(p, c)]).filter(([, , r]) => r && r.rule).map(([p, c, r]) => p.join(' / ') + ' ∴ ' + c + ': ' + r.rule);
// With a rule switched off.
const without = (id, f) => { ev('setDeductiveRule(' + J(id) + ', false); return 1;'); try { return f(); } finally { ev('setDeductiveRule(' + J(id) + ', true); return 1;'); } };

console.log('\n-- 1. factive verbs --');
{
    const FACTIVE = [
        [['Bob knows that Mary left.'], 'Mary left.'], [['Bob knew that Mary was here.'], 'Mary was here.'],
        [['Bob has known that Mary left.'], 'Mary left.'], [['Bob realizes that the door is locked.'], 'The door is locked.'],
        [['Bob discovered that the dog bit Mary.'], 'The dog bit Mary.'], [['Bob noticed that it was raining.'], 'It was raining.'],
        [['Bob remembers that Mary left.'], 'Mary left.'], [['Bob learned that Mary left.'], 'Mary left.'],
        [['Bob regrets that he lied.'], 'Bob lied.'], [['Bob forgot that Mary left.'], 'Mary left.'],
        [['Bob proved that the theorem is true.'], 'The theorem is true.'], [['The study showed that smoking causes cancer.'], 'Smoking causes cancer.'],
        [['Bob is aware that Mary left.'], 'Mary left.'], [['Bob is glad that Mary left.'], 'Mary left.'], [['Bob is sorry that Mary left.'], 'Mary left.'],
        [['It is known that Mary left.'], 'Mary left.'],
        // Whatever is known: a quantifier, a conditional, a denial, a compound.
        [['Mary knows that all men are mortal.'], 'All men are mortal.'], [['Bob knows that if it rains, the game is off.'], 'If it rains, the game is off.'],
        [['Bob knows that Mary did not leave.'], 'Mary did not leave.'], [['Bob knows that Mary left and Al cried.'], 'Mary left and Al cried.'],
        [['Bob knows that some ravens are white.'], 'Some ravens are white.']];
    ok(!misses(FACTIVE, 'factive verbs').length, 'what is known, realized, discovered, proved, regretted, forgotten, or what one is aware or glad of, is so (' + FACTIVE.length + ' steps)', J(misses(FACTIVE, 'factive verbs')));
    const NOT = [
        [['Bob believes that Mary left.'], 'Mary left.'], [['Bob thinks that Mary left.'], 'Mary left.'], [['Bob says that Mary left.'], 'Mary left.'],
        [['Bob hopes that Mary left.'], 'Mary left.'], [['Bob is sure that Mary left.'], 'Mary left.'], [['Bob is afraid that Mary left.'], 'Mary left.'],
        [['Bob does not know that Mary left.'], 'Mary left.'], [['Bob is unaware that Mary left.'], 'Mary left.'],
        [['The man who knows that Mary left is sad.'], 'Mary left.'], [['Bob knows that Mary left.'], 'Al left.']];
    ok(!certified(NOT).length, 'not what is believed, said, hoped, or one is sure or afraid of; not a denial, nor a "that" inside the subject', J(certified(NOT)));
    // (Since r27.135 said as for any rule switched off.)
    const off = without('factive', () => step(['Bob knows that Mary left.'], 'Mary left.'));
    ok(!off.rule && off.why === 'With Word meaning: “knows that” switched on in the Logic panel, the premises would give “Mary left” by factive verbs.',
        'switched off: not certified, and the check says what would give it', J(off));
    const two = step(['We know that all men are mortal.', 'Socrates is a man.'], 'Socrates is mortal.');
    ok(!two.rule && /universal modus ponens\. But getting from the one to the other is a step of its own, by factive verbs: add “All men are mortal” as a box of its own, with “We know that all men are mortal” under it\.$/.test(two.why),
        'a step of two: the box to add (it had said the checker had no rule for "know")', J(two));
    const g = ev(`var at = DEDUCTIVE_EXTENSIONS.findIndex(function (x) { return x.id === 'factive'; }), g = DEDUCTIVE_EXTENSIONS[at];
        return { label: g && g.label, on: g && g.on, rules: g && g.rules, after: at === DEDUCTIVE_EXTENSIONS.findIndex(function (x) { return x.id === 'opposites'; }) + 1, gloss: LOGIC_GROUP_GLOSSES.factive };`);
    ok(g.label === 'Word meaning: “knows that”' && g.on === true && J(g.rules) === J(['factive']) && g.after && /^Word meaning, not logic: "Bob knows that Mary left" gives "Mary left"/.test(g.gloss || ''),
        'a group of its own, "Word meaning: “knows that”", after contraries and contradictories, on by default, with its note', J(g));
}

console.log('\n-- 2. "glad that", "sorry that", "aware that": a claim after them --');
{
    const f = ev(`return ['Bob is glad that Mary left.', 'Bob is sorry that Mary left.', 'Bob is aware that Mary left.', 'Bob is proud that his son won.'].map(function (t) { var f = parseClaim(t); return f.kind + ' ' + (f.prop || ''); });`);
    ok(f.every(x => /^pred =(?:glad|sorry|aware|proud) that /.test(x)), 'one claim about Bob, the claim after "that" whole (it had been "Bob is glad, and Mary left Bob")', J(f));
    const gone = step(['Bob is glad that Mary left.'], 'Mary left Bob.');
    ok(!gone.rule, '... and "Bob is glad that Mary left" no longer gives "Mary left Bob"', J(gone));
    const dog = ev(`return ['A dog barked, and Bob is glad that dog left.', 'A dog barked, and Bob knows that dog left.', 'Bob is glad that the dog left.'].map(function (t) {
        var f = parseClaim(t), last = f.kind === 'and' ? f.parts[f.parts.length - 1] : f; return f.kind + ' ' + (f.kind === 'and' ? f.parts.length : '') + ' ' + (last.prop || ''); });`);
    ok(/^and 2 =glad that /.test(dog[0]) && /^and 2 ~know that /.test(dog[1]) && /^pred  =glad that the dog left$/.test(dog[2]),
        '"glad that dog left" read as "knows that dog left" is: a claim after "that" (it had been "glad, and Bob dog-left", or the box one claim)', J(dog));
    const noun = ev(`var f = parseClaim('Bob is a man that Mary loves.'); return f.kind;`);
    ok(noun === 'and', 'a noun before "that" still heads a relative clause: "Bob is a man that Mary loves"', noun);
}

console.log('\n-- 3. the expository syllogism --');
{
    const EXPOSITORY = [
        [['Bob is a student.', 'Bob passed.'], 'Some student passed.'], [['Bob passed.', 'Bob is a student.'], 'Some student passed.'],
        [['Bob is a student.', 'Bob did not pass.'], 'Some student did not pass.'], [['Bob is a person.', 'Bob loves Mary.'], 'Someone loves Mary.'],
        [['Socrates is wise.', 'Socrates is a man.'], 'Some man is wise.']];
    ok(!misses(EXPOSITORY, 'expository syllogism').length, '"a is F" and "a is G" give "some F is G" in one step, either order, denied, and with "someone" (they had taken two)', J(misses(EXPOSITORY, 'expository syllogism')));
    const NOT = [[['Bob is a student.', 'Al passed.'], 'Some student passed.'], [['Bob is a student.', 'Bob passed.'], 'Every student passed.'],
        [['Bob is a student.', 'Bob passed.'], 'Some student did not pass.']];
    ok(!certified(NOT).length, 'not of two things, not "every", not the denial', J(certified(NOT)));
    // (Until r27.135, "takes two steps"; since, the switch that gives it.)
    const off = without('expository-syllogism', () => step(['Bob is a student.', 'Bob passed.'], 'Some student passed.'));
    ok(!off.rule && off.why === 'With expository syllogism switched on in the Logic panel (Familiar steps), the premises would give “Some student passed”.',
        'switched off: not certified, and the check names the switch', J(off));
}

console.log('\n-- 4. "either way" --');
{
    const EITHER = [
        [['If it rains, then the game is off.', 'If it does not rain, then the game is off.'], 'The game is off.'],
        [['If it does not rain, the game is off.', 'If it rains, the game is off.'], 'The game is off.'],
        [['If Bob left, then Mary cried.', 'If Bob did not leave, then Mary cried.'], 'Mary cried.']];
    ok(!misses(EITHER, 'either way').length, '"if A, then C" and "if not A, then C" give C', J(misses(EITHER, 'either way')));
    const NOT = [[['If it rains, then the game is off.', 'If it snows, then the game is off.'], 'The game is off.'],
        [['If it rains, then the game is off.', 'If it does not rain, then the game is on.'], 'The game is off.']];
    ok(!certified(NOT).length, 'not with two conditions that do not deny each other, nor two different consequents', J(certified(NOT)));
    const cases = step(['If it rains, then the game is off.', 'If it does not rain, then the game is off.', 'It rains or it does not rain.'], 'The game is off.');
    ok(cases.rule === 'proof by cases', 'with "it rains or it does not rain" said, proof by cases, as it was', J(cases));
    const off = without('either-way', () => step(['If it rains, then the game is off.', 'If it does not rain, then the game is off.'], 'The game is off.'));
    ok(!off.rule, 'switched off: not certified', J(off));
}

console.log('\n-- 5. existential introduction in either order --');
{
    const EI = [[['Socrates is wise and Socrates is a man.'], 'Some man is wise.'], [['Poe is a black raven.'], 'Some raven is black.'],
        [['Socrates is a man and Socrates is wise.'], 'Some man is wise.'], [['Poe is a raven and Poe is black.'], 'Some raven is black.']];
    ok(!misses(EI, 'existential introduction').length, '"Socrates is wise and Socrates is a man" and "Poe is a black raven" give "some man is wise" and "some raven is black" (they had not)', J(misses(EI, 'existential introduction')));
    const NOT = [[['Socrates is wise and Plato is a man.'], 'Some man is wise.'], [['Poe is a black raven.'], 'Every raven is black.']];
    ok(!certified(NOT).length, 'not of two things, not "every"', J(certified(NOT)));
}

console.log('\n-- 6. in the Familiar steps --');
{
    const fam = ev(`return DEDUCTIVE_EXTENSIONS.filter(function (g) { return g.id === 'familiar'; })[0].rules;`);
    ok(fam.indexOf('expository-syllogism') === fam.indexOf('universal-modus-tollens') + 1 && fam.indexOf('either-way') === fam.indexOf('destructive-dilemma') + 1,
        'the expository syllogism beside universal modus tollens, "either way" beside the destructive dilemma, both familiar steps, on by default', J(fam));
}

console.log('\n-- 7. (r27.135) the universal syllogism after a verb --');
{
    const OBJECT = [
        [['Poe loves every raven.', 'Every crow is a raven.'], 'Poe loves every crow.'], [['Every crow is a raven.', 'Poe loves all ravens.'], 'Poe loves all crows.'],
        [['Poe loves no raven.', 'Every crow is a raven.'], 'Poe loves no crow.'], [['Poe does not love any raven.', 'Every crow is a raven.'], 'Poe does not love any crow.']];
    ok(!misses(OBJECT, 'universal syllogism').length, '"loves every raven" and "every crow is a raven" give "loves every crow"; "loves no raven", "loves no crow" (they had not)', J(misses(OBJECT, 'universal syllogism')));
    const NOT = [[['Poe loves every raven.', 'Every raven is a bird.'], 'Poe loves every bird.'], [['Poe loves no raven.', 'Every raven is a bird.'], 'Poe loves no bird.'],
        [['Poe loves no raven.', 'Every crow is a raven.'], 'Poe loves every crow.'], [['Poe loves every raven.', 'Every crow is a raven.'], 'Poe loves no crow.'],
        [['Poe fears every raven.', 'Every crow is a raven.'], 'Poe fears every crow.']];
    ok(!certified(NOT).length, 'not to a wider kind, not from "every" to "no" or back, not after a verb like "fears"', J(certified(NOT)));
}

console.log('\n-- 8. "there are dogs" --');
{
    const THERE = [[['All dogs are mammals.', 'There are dogs.'], 'Some dogs are mammals.'], [['There are dogs.', 'All dogs are mammals.'], 'Some mammals are dogs.']];
    ok(!misses(THERE, 'categorical syllogism').length, '"there are dogs", with "all dogs are mammals", gives "some dogs are mammals", as "some dogs exist" does (it had not)', J(misses(THERE, 'categorical syllogism')));
    const fallacy = step(['All dogs are mammals.'], 'Some dogs are mammals.');
    ok(!fallacy.rule && /existential fallacy/.test(fallacy.why), 'without it, still the existential fallacy', J(fallacy));
}

console.log('\n-- 9. every invalid categorical syllogism named --');
{
    const named = cases => cases.map(([p, c, name]) => [p, c, name, step(p, c)]).filter(([, , name, r]) => !r || r.rule || !r.why.includes('that is ' + name)).map(([p, c, name, r]) => p.join(' / ') + ' ∴ ' + c + ' -- ' + name + ': ' + J(r));
    const FALLACIES = [
        [['All cats are mammals.', 'No dogs are cats.'], 'No dogs are mammals.', 'the fallacy of illicit major'],
        [['All dogs are mammals.', 'All dogs are pets.'], 'All pets are mammals.', 'the fallacy of illicit minor'],
        [['No dogs are cats.', 'No cats are birds.'], 'No dogs are birds.', 'the fallacy of exclusive premises'],
        [['All dogs are mammals.', 'No fish are dogs.'], 'Some fish are mammals.', 'the fallacy of an affirmative conclusion from a negative premise'],
        [['All dogs are mammals.', 'All mammals are animals.'], 'Some animals are not dogs.', 'the fallacy of a negative conclusion from affirmative premises'],
        [['All mammals are animals.', 'All dogs are mammals.'], 'No dogs are animals.', 'the fallacy of illicit major'],
        [['Some ravens are black.', 'Some ravens fly.'], 'Some black things fly.', 'the fallacy of undistributed middle'],
        [['All dogs are mammals.', 'All poodles are dogs.'], 'Some poodles are mammals.', 'the existential fallacy'],
        [['Some ravens are not black.'], 'Some black things are not ravens.', 'the fallacy of illicit conversion'],
        // Named before r27.135, as they were.
        [['All dogs are mammals.', 'All cats are mammals.'], 'All cats are dogs.', 'the fallacy of undistributed middle'],
        [['All ravens are black.'], 'All black things are ravens.', 'the fallacy of illicit conversion']];
    ok(!named(FALLACIES).length, 'illicit major, illicit minor, exclusive premises, an affirmative conclusion from a negative premise and the reverse, undistributed middle, the existential fallacy, "some ... not" converted (they had been "? not recognized")', J(named(FALLACIES)));
    const tag = ev(`var trees = [{ id: 'M', type: 'contention', texts: ['No dogs are mammals.'], collapsed: [], children: [{ id: 'A', type: 'support', texts: ['All cats are mammals.', 'No dogs are cats.'], collapsed: [], children: [] }] }];
        return deductiveStepTagText(collectDeductiveSteps(trees)[0]);`);
    ok(/illicit major/.test(tag) && /\u2717/.test(tag), 'the tag names it: "✗ illicit major"', tag);
    const valid = step(['No mammals are fish.', 'All dogs are mammals.'], 'No dogs are fish.');
    ok(!!valid.rule, 'a valid mood is not named a fallacy (Celarent)', J(valid));
}

console.log('\n-- 10. a rule switched off: which switch gives the step --');
{
    const mt = without('modus-tollens', () => step(['If it rains, then the game is off.', 'The game is not off.'], 'It does not rain.'));
    ok(!mt.rule && mt.why === 'With modus tollens switched on in the Logic panel (Familiar steps), the premises would give “It does not rain”.',
        'a rule of a group, switched off on its own: its name, and its group', J(mt));
    const either = without('either-way', () => step(['If it rains, then the game is off.', 'If it does not rain, then the game is off.'], 'The game is off.'));
    ok(!either.rule && /^With either way switched on in the Logic panel \(Familiar steps\)/.test(either.why), '"either way" too', J(either));
    const catchall = step(['If it rains, then it is cold.', 'If it is cold, then it snows.', 'It rains.'], 'It snows.');
    ok(!/switched on/.test(catchall.why), 'not the catch-alls, which give whatever truth tables do: "takes two steps" says more', J(catchall));
}

console.log('\n-- 11. (r27.136) relations --');
{
    // From a word of two senses ("shorter": than the taller, or than the
    // longer), none (r27.141; section 15).
    const pairs = ev(`var objectOf = function (w) { return ' '; }, out = { gives: [], back: [], two: [] };
        CLAIM_RELATION_CONVERSES.forEach(function (e) {
            var art = function (w) { return /of$/.test(w) ? 'a ' : ''; };
            [[e[0], e[1]], [e[1], e[0]]].forEach(function (ab) {
                var one = __step(['Kim is ' + art(ab[0]) + ab[0] + ' Lee.'], 'Lee is ' + art(ab[1]) + ab[1] + ' Kim.');
                var name = 'converses \u2018' + ab[0] + '\u2019 and \u2018' + ab[1] + '\u2019';
                var no = __step(['Kim is not ' + art(ab[0]) + ab[0] + ' Lee.'], 'Lee is not ' + art(ab[1]) + ab[1] + ' Kim.');
                if (CLAIM_RELATION_TWO_SENSES[ab[0]]) { if ((one && one.rule) || (no && no.rule)) out.two.push(ab[0] + ' / ' + ab[1]); return; }
                if (!one || one.rule !== name) out.gives.push('Kim is ' + ab[0] + ' Lee / Lee is ' + ab[1] + ' Kim: ' + (one && one.rule));
                if (!no || no.rule !== name) out.back.push('not: ' + ab[0] + ' / ' + ab[1] + ': ' + (no && no.rule));
            });
        });
        out.pairs = CLAIM_RELATION_CONVERSES.length; return out;`);
    ok(pairs.pairs === 29 && !pairs.gives.length && !pairs.back.length && !pairs.two.length,
        'every pair of converses both ways, and denied, named by the pair (' + pairs.pairs + ' pairs) -- but none from a word of two senses', J(pairs));
    const MORE = [[['Bob is more famous than Al.'], 'Al is less famous than Bob.'], [['Five is greater than three.'], 'Three is less than five.'],
        [['The meeting is before lunch.'], 'Lunch is after the meeting.'], [['Bob is the parent of Al.'], 'Al is a child of Bob.']];
    ok(MORE.every(([p, c]) => /^converses /.test(step(p, c).rule || '')), '"more famous" and "less famous"; numbers; "the parent of" and "a child of"', J(MORE.map(([p, c]) => step(p, c).rule)));
    const SYM = [[['Bob is married to Al.'], 'Al is married to Bob.'], [['Bob is next to Al.'], 'Al is next to Bob.'], [['Bob met Al.'], 'Al met Bob.'],
        [['Bob is a sibling of Al.'], 'Al is a sibling of Bob.'], [['Bob is not married to Al.'], 'Al is not married to Bob.']];
    ok(SYM.every(([p, c]) => /^symmetric /.test(step(p, c).rule || '')), 'what goes both ways: "married to", "next to", "met", "a sibling of", denied too', J(SYM.map(([p, c]) => step(p, c).rule)));
    const TRANS = [[['Bob is taller than Al.', 'Al is taller than Cy.'], 'Bob is taller than Cy.'], [['Al is taller than Cy.', 'Bob is taller than Al.'], 'Bob is taller than Cy.'],
        [['Bob is smarter than Al.', 'Al is smarter than Cy.'], 'Bob is smarter than Cy.'], [['The wheel is part of the car.', 'The car is part of the fleet.'], 'The wheel is part of the fleet.'],
        [['Bob is an ancestor of Al.', 'Al is an ancestor of Cy.'], 'Bob is an ancestor of Cy.']];
    ok(TRANS.every(([p, c]) => /^transitive /.test(step(p, c).rule || '')), 'passed along: any comparative ("smarter than"), "part of", "an ancestor of", either order', J(TRANS.map(([p, c]) => step(p, c).rule)));
    ok(/^asymmetric /.test(step(['Bob is taller than Al.'], 'Al is not taller than Bob.').rule || '') && /^asymmetric /.test(step(['Bob is the parent of Al.'], 'Al is not the parent of Bob.').rule || ''),
        'never back: "Al is not taller than Bob", "Al is not the parent of Bob"');
    const NOT = [[['Bob is taller than Al.'], 'Al is taller than Bob.'], [['Bob is similar to Al.', 'Al is similar to Cy.'], 'Bob is similar to Cy.'],
        [['Bob is the parent of Al.', 'Al is the parent of Cy.'], 'Bob is the parent of Cy.'], [['Bob is taller than Al.'], 'Al is longer than Bob.'],
        [['Bob is taller than a man.'], 'A man is shorter than Bob.'], [['Bob is married to Al.'], 'Al is not married to Bob.'], [['Bob loves Al.'], 'Al loves Bob.'],
        [['Bob is other than Al.', 'Al is other than Cy.'], 'Bob is other than Cy.']];
    ok(!certified(NOT).length, 'not "taller" both ways, not "similar to" or "parent of" passed along, not the wrong converse, not "a man", not "married to" denied, not "loves", not "other than"', J(certified(NOT)));
    const g = ev(`var at = DEDUCTIVE_EXTENSIONS.findIndex(function (x) { return x.id === 'relations'; }), g = DEDUCTIVE_EXTENSIONS[at];
        return { label: g && g.label, on: g && g.on, rules: g && g.rules, after: at === DEDUCTIVE_EXTENSIONS.findIndex(function (x) { return x.id === 'factive'; }) + 1, gloss: LOGIC_GROUP_GLOSSES.relations };`);
    ok(g.label === 'Word meaning: relations' && g.on === true && J(g.rules) === J(['relations']) && g.after && /^Word meaning, not logic: "Bob is taller than Al" gives "Al is shorter than Bob"/.test(g.gloss || ''),
        'a group of its own, "Word meaning: relations", after "knows that", on by default, with its note', J(g));
    const off = without('relations', () => step(['Bob is taller than Al.'], 'Al is shorter than Bob.'));
    ok(!off.rule && off.why === 'With Word meaning: relations switched on in the Logic panel, the premises would give “Al is shorter than Bob” by converses ‘taller than’ and ‘shorter than’.',
        'switched off: the check names the switch', J(off));
}

console.log('\n-- 12. (r27.137) dropping a modifier --');
{
    const DROP = [
        [['Bob ran quickly.'], 'Bob ran.'], [['Bob quickly ran.'], 'Bob ran.'], [['Bob ran quickly to the store.'], 'Bob ran to the store.'],
        [['Bob opened the door carefully.'], 'Bob opened the door.'], [['Bob carefully opened the door.'], 'Bob opened the door.'],
        [['Bob is very tall.'], 'Bob is tall.'], [['Bob ran very quickly.'], 'Bob ran.'], [['Bob left yesterday.'], 'Bob left.'], [['Bob ran fast.'], 'Bob ran.']];
    ok(!misses(DROP, 'dropping a modifier').length, 'a word of manner, time or degree left out, before or after the verb, one or two (they had not followed)', J(misses(DROP, 'dropping a modifier')));
    const NOT = [[['Bob almost won.'], 'Bob won.'], [['Bob hardly ran.'], 'Bob ran.'], [['Bob did not run quickly.'], 'Bob did not run.'],
        [['Bob behaved badly.'], 'Bob behaved.'], [['Bob visited family.'], 'Bob visited.'], [['Bob ran to the store.'], 'Bob ran.'], [['Bob ran.'], 'Bob ran quickly.'],
        [['Bob ran quickly.'], 'Al ran.']];
    ok(!certified(NOT).length, 'not "almost" or "hardly", not under "not", not "behaved badly", not "family", not a phrase, not added, not of another', J(certified(NOT)));
    const g = ev(`var at = DEDUCTIVE_EXTENSIONS.findIndex(function (x) { return x.id === 'modifiers'; }), g = DEDUCTIVE_EXTENSIONS[at];
        return { label: g && g.label, on: g && g.on, rules: g && g.rules, after: at === DEDUCTIVE_EXTENSIONS.findIndex(function (x) { return x.id === 'relations'; }) + 1, gloss: LOGIC_GROUP_GLOSSES.modifiers };`);
    // Since r27.141 with dropping a "that" clause (section 15).
    ok(g.label === 'Word meaning: modifiers' && g.on === true && J(g.rules) === J(['modifiers', 'that-clause']) && g.after && /^Word meaning, not logic: "Bob ran quickly" gives "Bob ran"/.test(g.gloss || ''),
        'a group of its own, "Word meaning: modifiers", after relations, on by default, with its note', J(g));
    const off = without('modifiers', () => step(['Bob ran quickly.'], 'Bob ran.'));
    ok(!off.rule && off.why === 'With dropping a modifier switched on in the Logic panel (Word meaning: modifiers), the premises would give “Bob ran”.', 'switched off: the check names the switch', J(off));
}

console.log('\n-- 13. (r27.138) overlapping rules made separate --');
{
    const OFF = [
        ['proof-by-cases', ['It rains or it snows.', 'If it rains, then the game is off.', 'If it snows, then the game is off.'], 'The game is off.', 'proof by cases'],
        ['biconditional-elimination', ['Bob left if and only if Al cried.', 'Bob left.'], 'Al cried.', 'biconditional elimination'],
        ['biconditional-elimination', ['Bob left if and only if Al cried.', 'Bob did not leave.'], 'Al did not cry.', 'biconditional elimination'],
        ['negation-elimination', ['It is not the case that it is not the case that Bob left.'], 'Bob left.', 'double-negation elimination']];
    const handed = OFF.map(([id, p, c, name]) => [id, without(id, () => step(p, c))]).filter(([, r]) => r.rule);
    ok(!handed.length, 'switched off, proof by cases, biconditional elimination and double-negation elimination take their steps with them: the constructive dilemma, substitution of equivalents and double-negation replacement had taken them', J(handed));
    const said = OFF.map(([id, p, c, name]) => without(id, () => step(p, c)).why).filter(w => !/^With .* switched on in the Logic panel \(Intro and elimination steps\), the premises would give /.test(w));
    ok(!said.length, '... and the check names the switch', J(said));
    const OWN = [[['It rains or it snows.', 'If it rains, then the game is off.', 'If it snows, then the road is closed.'], 'The game is off or the road is closed.', 'constructive dilemma'],
        [['Bob left if and only if Al cried.', 'Bob left and Cy sang.'], 'Al cried and Cy sang.', 'substitution of equivalents'],
        [['All dogs are mammals.'], 'All non-mammals are non-dogs.', 'contraposition'], [['No dogs are cats.'], 'No cats are dogs.', 'conversion']];
    ok(OWN.every(([p, c, name]) => step(p, c).rule === name), 'each still takes its own: the dilemma with two consequents, a substitution inside a claim, contraposition with "non-", conversion', J(OWN.map(([p, c]) => step(p, c).rule)));
    const conv = without('conversion', () => step(['No dogs are cats.'], 'No cats are dogs.'));
    ok(conv.rule !== 'contraposition', 'with conversion off, contraposition does not take its step (a rule under a quantifier is the user\'s to decide)', J(conv));
}

console.log('\n-- 14. (r27.140) existential introduction from an object of a kind --');
{
    const KIND = [[['Bob loves a raven.'], 'Bob loves something.'], [['Bob loves a raven.'], 'Something is a raven.'], [['Bob hit some poodle.'], 'Bob hit something.']];
    ok(!misses(KIND, 'existential introduction').length, '"Bob loves a raven" gives "Bob loves something" and "something is a raven" (they had not)', J(misses(KIND, 'existential introduction')));
    const NOT = [[['Bob loves a raven.'], 'Bob loves someone.'], [['Bob loves every raven.'], 'Bob loves something.'], [['Bob loves a raven.'], 'Something is a crow.'],
        [['Bob almost hit a poodle.'], 'Bob hit something.'], [['Bob fears a raven.'], 'Something is a raven.']];
    ok(!certified(NOT).length, 'not "someone", which a raven need not be; not "every raven", of which there may be none; not another kind; not "almost"; not after "fears"', J(certified(NOT)));
}

console.log('\n-- 15. (r27.141) a "that" clause dropped; relations of two senses --');
{
    const GLAD = [[['Bob is glad that Mary left.'], 'Bob is glad.'], [['Bob was glad that Mary left.'], 'Bob was glad.'],
        [['The man is grateful that Mary came.'], 'The man is grateful.'], [['Bob might be relieved that Mary left.'], 'Bob might be relieved.'],
        [['Bob is very glad that Mary left.'], 'Bob is very glad.']];
    ok(!misses(GLAD, 'dropping a \u2018that\u2019 clause').length, '"Bob is glad that Mary left" gives "Bob is glad", in any tense, after "might be" too (it had not)',
        J(misses(GLAD, 'dropping a \u2018that\u2019 clause')));
    ok(step(['Bob is glad that Mary left.'], 'Mary left.').rule === 'factive verbs', '... and still gives "Mary left", by factive verbs');
    const NOT = [[['Bob is not glad that Mary left.'], 'Bob is not glad.'], [['Bob is glad.'], 'Bob is glad that Mary left.'], [['Bob is glad that Mary left.'], 'Al is glad.'],
        [['Bob believes that Mary left.'], 'Bob believes.'], [['Bob is certain that Mary left.'], 'Bob is certain.'], [['Bob is unaware that Mary left.'], 'Bob is unaware.'],
        [['Bob is happy that Mary left.'], 'Bob is happy.'], [['Bob is proud that Mary won.'], 'Bob is proud.'], [['Bob is sorry that you feel that way.'], 'Bob is sorry.']];
    ok(!certified(NOT).length, 'not under "not", not added, not of another, not "believes" or "certain", not "unaware" (alone, read "not aware"); not "happy", "proud" or "sorry"',
        J(certified(NOT)));
    const proud = step(['Bob is proud that Mary won.'], 'Bob is proud.'), sorry = step(['Bob is sorry that you feel that way.'], 'Bob is sorry.');
    ok(proud.why === 'On its own, \u2018proud\u2019 can mean \u201cvain\u201d, which \u2018proud that \u2026\u2019 need not; so \u201cBob is proud that Mary won\u201d does not give \u201cBob is proud\u201d.' &&
        /^On its own, \u2018sorry\u2019 can mean \u201capologizing\u201d/.test(sorry.why), '"proud" and "sorry": the check says what the bare word can say', J([proud, sorry]));
    const g = ev(`var g = DEDUCTIVE_EXTENSIONS.find(function (x) { return x.id === 'modifiers'; }); return { rules: g.rules, gloss: LOGIC_GROUP_GLOSSES.modifiers };`);
    ok(J(g.rules) === J(['modifiers', 'that-clause']) && /"Bob is glad that Mary left" gives "Bob is glad"/.test(g.gloss), 'a rule of the modifiers group, in its note', J(g));
    const off = without('that-clause', () => step(['Bob is glad that Mary left.'], 'Bob is glad.'));
    ok(!off.rule && off.why === 'With dropping a \u2018that\u2019 clause switched on in the Logic panel (Word meaning: modifiers), the premises would give \u201cBob is glad\u201d.',
        'switched off: the check names the switch', J(off));
    // Relations of two senses.
    const TWO = [[['The rope is shorter than the cable.'], 'The cable is taller than the rope.'], [['The rope is shorter than the cable.'], 'The cable is longer than the rope.'],
        [['The paint is lighter than the wall.'], 'The wall is heavier than the paint.'], [['Bob is thinner than Al.'], 'Al is thicker than Bob.'],
        [['Al is not shorter than Bob.'], 'Bob is not taller than Al.']];
    ok(!certified(TWO).length, '"shorter", "lighter", "thinner": no converse from them ("The rope is shorter than the cable" had given "The cable is taller than the rope")', J(certified(TWO)));
    const rope = step(...TWO[0]), thin = step(...TWO[3]);
    ok(rope.why === '\u2018shorter\u2019 can mean less tall or less long, so \u201cThe rope is shorter than the cable\u201d does not give \u201cThe cable is taller than the rope\u201d; \u201cThe rope is shorter in height than the cable\u201d would.' &&
        /; \u201cBob is less thick than Al\u201d would\.$/.test(thin.why), 'the check says which senses, and how to say the one wanted', J([rope, thin]));
    const SAID = [[['The rope is shorter in length than the cable.'], 'The cable is longer than the rope.'], [['Al is shorter in height than Bob.'], 'Bob is taller than Al.'],
        [['The box is lighter in weight than the crate.'], 'The crate is heavier than the box.'], [['Bob is taller than Al.'], 'Al is shorter in height than Bob.'],
        [['Bob is taller than Al.'], 'Al is shorter than Bob.'], [['The wall is darker than the paint.'], 'The paint is lighter than the wall.'],
        [['Bob is fatter than Al.'], 'Al is thinner than Bob.']];
    ok(SAID.every(([p, c]) => /^converses /.test(step(p, c).rule || '')), 'the sense said ("shorter in length than"), or a converse to the word, the premise giving its sense',
        J(SAID.map(([p, c]) => step(p, c).rule)));
    const LESS = [[['Al is less tall than Bob.'], 'Bob is taller than Al.'], [['Bob is bigger than Al.'], 'Al is less big than Bob.'],
        [['The box is less heavy than the crate.'], 'The crate is heavier than the box.'], [['The road is less wide than the river.'], 'The river is wider than the road.'],
        [['Al is less good than Bob.'], 'Bob is better than Al.']];
    ok(LESS.every(([p, c]) => /^converses /.test(step(p, c).rule || '')), '"less tall than" and "taller than", "less big" and "bigger", "less heavy" and "heavier", "less good" and "better"',
        J(LESS.map(([p, c]) => step(p, c).rule)));
    const WRONG = [[['Bob is taller than Al.'], 'Al is shorter in length than Bob.'], [['Al is less tall than Bob.'], 'Bob is shorter than Al.']];
    ok(!certified(WRONG).length && /^transitive /.test(step(['The rope is shorter in length than the cable.', 'The cable is shorter in length than the pole.'], 'The rope is shorter in length than the pole.').rule || ''),
        'not the wrong sense, nor the wrong way round; "shorter in length than" passed along', J(certified(WRONG)));
    const note = ev('return LOGIC_GROUP_GLOSSES.relations;');
    ok(/ "Shorter" can mean less tall or less long: "shorter in height than" gives "taller than"\.$/.test(note), 'the relations note says so', note);
}

console.log('\n-- 16. (r27.142) quantifier distribution over a kind; the technical steps --');
{
    const DIST = [[['Every raven is black and old.'], 'Every raven is black and every raven is old.'], [['Every raven is black and every raven is old.'], 'Every raven is black and old.'],
        [['All ravens are black and old.'], 'All ravens are black, and all ravens are old.'], [['Some raven is black or white.'], 'Some raven is black or some raven is white.'],
        [['Some raven is black or some raven is white.'], 'Some raven is black or white.'], [['No raven is black or white.'], 'No raven is black and no raven is white.'],
        [['No raven is black and no raven is white.'], 'No raven is black or white.'], [['Nothing is black or white.'], 'Nothing is black and nothing is white.'],
        [['Some ravens are black and old.'], 'Some ravens are black and some ravens are old.'],
        [['Some black ravens are old and wise.'], 'Some black ravens are old and some black ravens are wise.'],
        [['Every raven is black or every raven is white.'], 'Every raven is black or white.'], [['∀x (R(x) → (B(x) ∧ O(x)))'], '∀x (R(x) → B(x)) ∧ ∀x (R(x) → O(x))']];
    ok(!misses(DIST, 'quantifier distribution, anywhere').length,
        '"every raven is black and old" is "every raven is black and every raven is old"; "some", "no" and "nothing" with "or"; "some ... and" and "every ... or every" one way (they had not followed)',
        J(misses(DIST, 'quantifier distribution, anywhere')));
    const NOT = [[['Every raven is black or white.'], 'Every raven is black or every raven is white.'], [['Some raven is black and some raven is old.'], 'Some raven is black and old.'],
        [['No raven is black and old.'], 'No raven is black and no raven is old.']];
    ok(!certified(NOT).length, 'not "every ... or" split, nor two "some"s joined, nor "no ... and" split', J(certified(NOT)));
    // The technical steps: off by default, the check naming the switch.
    const g = ev(`var g = DEDUCTIVE_EXTENSIONS.find(function (x) { return x.id === 'technical'; }); return { label: g && g.label, on: g && g.on, rules: g && g.rules, gloss: LOGIC_GROUP_GLOSSES.technical };`);
    ok(g.label === 'Technical steps' && g.on === false &&
        J(g.rules) === J(['absorption', 'predicate-congruence', 'boolean-absorption', 'bottom-laws', 'rules-of-passage', 'null-quantification-anywhere']) &&
        /^Steps from logic textbooks that arguments rarely take/.test(g.gloss || ''), 'a group of six technical steps, off by default, with its note', J(g));
    const abs = step(['If it rains, the streets are wet.'], 'If it rains, then it rains and the streets are wet.');
    ok(!abs.rule && abs.why === 'With absorption switched on in the Logic panel (Technical steps), the premises would give \u201cIf it rains, then it rains and the streets are wet\u201d.',
        'off, the check names the switch', J(abs));
    const ON = [[['Either Bob or Al did it.', 'Either Bob did not do it or Cy helped.'], 'Either Al did it or Cy helped.', 'resolution'], [['\u2203x B(x)'], '\u2203y B(y)', 'change of bound variable'],
        [['Something is black or white.'], 'Something is black or something is white.', 'quantifier distribution, anywhere']];
    ok(ON.every(([p, c, r]) => step(p, c).rule === r), 'resolution, change of bound variable and quantifier distribution stay on', J(ON.map(([p, c]) => step(p, c).rule)));
}

console.log('\n-- 17. (r27.143) the loophole closed; syllogism names --');
{
    const conv = without('conversion', () => step(['No dogs are cats.'], 'No cats are dogs.'));
    ok(!conv.rule && conv.why === 'With conversion switched on in the Logic panel (Replacement rules), the premises would give \u201cNo cats are dogs\u201d.',
        'conversion off: "No dogs are cats", so "No cats are dogs", is no longer transposition under \u2200 -- the check names the switch', J(conv));
    ok(step(['No dogs are cats.'], 'No cats are dogs.').rule === 'conversion' && step(['Every raven is black and old.'], 'Every raven is black.').rule === 'conjunction elimination under \u2200',
        'on, it is conversion; a rule under a quantifier still takes its own steps');
    const MOODS = [[['Every man is mortal.', 'Every Greek is a man.'], 'Every Greek is mortal.', 'Barbara', 'universal syllogism'],
        [['No man is a fish.', 'Every Greek is a man.'], 'No Greek is a fish.', 'Celarent', 'universal syllogism'],
        [['Every man is mortal.', 'Some Greek is a man.'], 'Some Greek is mortal.', 'Darii', 'existential syllogism'],
        [['No man is a fish.', 'Some Greek is a man.'], 'Some Greek is not a fish.', 'Ferio', 'existential syllogism']];
    const KEEP = [[['Poe loves every raven.', 'Every crow is a raven.'], 'Poe loves every crow.'], [['No fish is a mammal.', 'Every whale is a mammal.'], 'No whale is a fish.'],
        [['Every man is mortal.', 'Socrates is a man.'], 'Socrates is mortal.']];
    const off = MOODS.map(([p, c]) => step(p, c).rule);
    ev("setDeductiveRule(['syllogism-names'], true); return 1;");
    const on = MOODS.map(([p, c]) => step(p, c).rule), keep = KEEP.map(([p, c]) => step(p, c).rule);
    ev("setDeductiveRule(['syllogism-names'], false); return 1;");
    ok(J(off) === J(MOODS.map(m => m[3])) && J(on) === J(MOODS.map(m => 'categorical syllogism (' + m[2] + ')')),
        'off by default: "universal syllogism", "existential syllogism"; on: "categorical syllogism (Barbara)", Celarent, Darii, Ferio', J([off, on]));
    ok(J(keep) === J(['universal syllogism', 'categorical syllogism (Cesare)', 'universal modus ponens']),
        'on, "Poe loves every crow" keeps its name, as do Cesare and universal modus ponens', J(keep));
    const sw = ev(`toggleEvalOverview(); var cb = document.querySelector('#logic-rules-familiar [data-setting="syllogism-names"]');
        var r = { inList: !!cb, checked: !!cb && cb.checked, title: cb ? cb.parentElement.title : '' };
        if (cb) { cb.click(); r.saved = !!(state.logic && state.logic.rules && state.logic.rules['syllogism-names']); r.ticked = cb.checked;
            r.count = document.querySelector('[data-count="familiar"]').textContent; cb.click(); r.cleared = !state.logic.rules['syllogism-names'];
            setDeductiveRule(['syllogism-names'], true); renderLogicPanel(); r.synced = cb.checked; setDeductiveRule(['syllogism-names'], false); renderLogicPanel(); r.synced = r.synced && !cb.checked; }
        r.css = [].map.call(document.querySelectorAll('style'), function (x) { return x.textContent; }).join(' ').indexOf('.logic-rules .logic-names { grid-column: 1 / -1; margin-top: 3px; padding-top: 5px; border-top: 1px solid') >= 0;
        toggleEvalOverview(); return r;`);
    ok(sw.inList && sw.checked === false && sw.saved && sw.ticked && sw.cleared && sw.synced && sw.count === '' && /by their mood/.test(sw.title) && sw.css,
        'a switch inside Familiar steps\' list, a row of its own under a line, off by default, saved with the map, not counted among its rules', J(sw));
}

console.log('\n-- 18. (r27.144) a switch switched on from its step --');
{
    const r = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['No cats are dogs.'], collapsed: [], x: 30000, y: 30000, children: [{ id: 'A', type: 'support', texts: ['No dogs are cats.'], collapsed: [], children: [] }] }];
        ensureCollabFields(state); selectedIds = []; setDeductiveRule(['conversion'], false); if (!deductiveLive) toggleDeductiveLive(); render();
        var tag = document.querySelector('.derivation-tag[data-step="A"]'), r = { tag: tag && tag.textContent, title: tag ? tag.title : '' };
        tag.click();
        var pop = document.getElementById('reading-chooser');
        r.kind = pop && pop.dataset.kind; r.text = pop ? pop.querySelector('.rc-said').textContent : ''; r.btn = pop ? pop.querySelector('.rc-apply').textContent : ''; r.all = pop ? pop.querySelector('.rc-all').textContent : '';
        refreshDerivationTags(); r.kept = document.getElementById('reading-chooser') === pop;
        if (pop) pop.querySelector('.rc-apply').click();
        r.closed = !document.getElementById('reading-chooser'); r.on = claimRuleOn('conversion');
        var again = document.querySelector('.derivation-tag[data-step="A"]'); r.after = again && again.textContent;
        setDeductiveRule(['conversion'], false); render(); openDeductiveCheck('A');
        var b = document.querySelector('#logic-modal-body .logic-step[data-step="A"] .logic-switch-on');
        r.listBtn = b && b.textContent; r.listTitle = b && b.title;
        if (b) b.click();
        r.listOn = claimRuleOn('conversion'); r.listRule = document.querySelector('#logic-modal-body .logic-step[data-step="A"] .logic-rule').textContent;
        r.listOpen = document.getElementById('logic-modal-backdrop').classList.contains('open');
        r.css = [].map.call(document.querySelectorAll('style'), function (x) { return x.textContent; }).join(' ').indexOf('.logic-step .logic-switch-on { margin-left: 8px;') >= 0;
        closeDeductiveCheck();
        setDeductiveRule(['conversion'], false); reviewMode = true; render();
        var ro = document.querySelector('.derivation-tag[data-step="A"]'); r.roTitle = ro.title; ro.click();
        r.roPop = !!document.getElementById('reading-chooser'); r.roList = document.getElementById('logic-modal-backdrop').classList.contains('open');
        r.roBtn = !!document.querySelector('#logic-modal-body .logic-switch-on');
        closeDeductiveCheck(); reviewMode = false; setDeductiveRule(['conversion'], true); state.trees = []; render();
        return r;`);
    ok(r.tag === '? not recognized' && /\. Click to switch on conversion\.$/.test(r.title), 'a step a switched-off rule would certify: its tag\'s tip says a click switches it on', J(r));
    ok(r.kind === 'switch' && r.text === 'With conversion switched on in the Logic panel (Replacement rules), the premises would give \u201cNo cats are dogs\u201d.' &&
        r.btn === 'Switch on conversion for this map' && r.all === 'Every step\u2026' && r.kept,
        'clicking the tag opens the check\'s words, a button, and "Every step\u2026"; the tags drawn again, it stays', J(r));
    ok(r.closed && r.on && r.after === '\u2713 conversion', 'the button switches conversion on for this map, and the step is certified', J(r));
    ok(r.listBtn === 'Switch on' && r.listTitle === 'Switch on conversion for this map' && r.listOn && r.listRule === '\u2713conversion' && r.listOpen && r.css,
        'in the list of steps, the same button after the words; the list stays open, the row certified', J(r));
    ok(/ Click for every step\.$/.test(r.roTitle) && !r.roPop && r.roList && !r.roBtn, 'where the map is read-only, no button: the tag opens the list', J(r));
    const sws = ev(`var one = function (ps, c) { var trees = [{ id: 'M', type: 'contention', texts: [c], collapsed: [], children: [{ id: 'S', type: 'support', texts: ps, collapsed: [], children: [] }] }];
            return claimStepSwitch(collectDeductiveSteps(trees)[0]); };
        setDeductiveRule(['opposites'], false);
        var out = [one(['Mary is unhappy.'], 'Mary is not happy.')];
        setDeductiveRule(['opposites'], true);
        out.push(one(['It is metaphysically necessary that Bob exists.'], 'Bob exists.'));
        setDeductiveRule(['modal-meta'], true); setDeductiveRule(['modal-meta-5', 'modal-meta-4', 'modal-meta-B'], false);
        out.push(one(['It is metaphysically necessary that Bob exists.'], 'It is metaphysically necessary that it is metaphysically necessary that Bob exists.'));
        state.logic = null; claimRulesCache = null;
        out.push(one(['Bob is tall.'], 'Al is tall.'));
        return out;`);
    ok(J(sws) === J([{ ids: ['opposites'], name: 'contraries and contradictories' }, { ids: ['modal-meta'], name: 'Metaphysical necessity' }, { ids: ['modal-meta-4'], name: 'axiom 4' }, null]),
        'contraries and contradictories, metaphysical necessity, an axiom of its system; nothing where no switch would give the step', J(sws));
}

console.log('\n-- 19. (r27.145) "the student" is the one "a student" speaks of --');
{
    const f = ev(`var r = parseClaimFull('If a student cheats, the student will be caught.'); return { kind: r.form.kind, notes: r.notes.map(function (n) { return n.message; }) };`);
    ok(f.kind === 'all' && f.notes[0] === '"the student" is read as what the condition speaks of, so the box says what "every student that cheats will be caught" says',
        '"If a student cheats, the student will be caught" says what "every student that cheats will be caught" says, as "that student" did (it had been one claim to another)', J(f));
    const bob = step(['If a student cheats, the student will be caught.', 'Bob is a student.', 'Bob cheats.'], 'Bob will be caught.');
    ok(!bob.rule && bob.why.indexOf('Read as \u201cevery student that cheats will be caught\u201d, the step follows by universal modus ponens.') >= 0,
        'with Bob: the question "a student" after "if" asks, as it does for "they"; read as "every", universal modus ponens', J(bob));
    const DEF = [[['Every student that cheats will be caught.', 'A student cheats.'], 'The student will be caught.'],
        [['Every AI system that is reliably and routinely consulted functions as a cognitive extension.', 'An AI system is reliably and routinely consulted.'], 'The AI system functions as a cognitive extension.']];
    ok(!misses(DEF, 'universal modus ponens').length, 'a conclusion\'s "the student" is the one a premise\'s "a student" speaks of: universal modus ponens', J(misses(DEF, 'universal modus ponens')));
    const NOT = [[['A dog barked.'], 'The dog bit Bob.'], [['A dog barked.', 'A dog slept.'], 'The dog barked.'],
        [['Every student that cheats will be caught.', 'A teacher cheats.'], 'The student will be caught.']];
    ok(!certified(NOT).length, 'not what the premise does not say; not with two dogs "the dog" could be; not another noun', J(certified(NOT)));
    ok(step(['If a student cheats, the teacher will be angry.', 'A student cheats.'], 'The teacher will be angry.').rule === 'modus ponens',
        '"the teacher" is not the student: modus ponens, as before');
    const KIND = [[['Every tool that is used by a carpenter is sharp.', 'The saw is a tool that is used by a carpenter.'], 'The saw is sharp.'],
        [['Every tool that a carpenter uses is sharp.', 'The saw is a tool that a carpenter uses.'], 'The saw is sharp.'],
        [['Every AI system that is consulted by a student functions as an extension.', 'ChatGPT is an AI system that is consulted by a student.'], 'ChatGPT functions as an extension.']];
    ok(!misses(KIND, 'universal modus ponens').length, '"every tool that is used by a carpenter" and "a tool that is used by a carpenter", one kind (they had differed by "a")',
        J(misses(KIND, 'universal modus ponens')));
}

console.log('\n-- 20. (r27.146) the existential fallacy says how to mend the step; "Bob is James" --');
{
    const MEND = [[['Every raven is black.'], 'Some raven is black.', 'There are ravens'], [['All ravens are black.'], 'Some ravens are black.', 'There are ravens'],
        [['No raven is white.'], 'Some raven is not white.', 'There are ravens'], [['Every child is loved.'], 'Some child is loved.', 'There are children'],
        [['Every old raven is black.'], 'Some old raven is black.', 'There are old ravens']];
    const said = MEND.map(([p, c, add]) => { const r = step(p, c);
        return !r.rule && / existential fallacy /.test(r.why) && r.why.endsWith(' Add \u201c' + add + '\u201d and it follows.') ? '' : p[0] + ': ' + J(r); }).filter(Boolean);
    ok(!said.length, '"all" to "some" is still refused, and the check says which box would mend it: "Add “There are ravens” and it follows" ("children", "old ravens")', said.join(' | '));
    // The box it names mends the step: the check takes the step with it.
    const mended = misses(MEND.map(([p, c, add]) => [p.concat([add + '.']), c]), 'categorical syllogism');
    ok(!mended.length, 'with that box, the step is a categorical syllogism', J(mended));
    // Not where the step with the box is not taken: a kind with "that", "everyone", two premises.
    const NONE = [[['Every raven that sings is black.'], 'Some raven that sings is black.'], [['Everyone is mortal.'], 'Someone is mortal.'],
        [['All humans are mortal.', 'All humans are animals.'], 'Some animals are mortal.']];
    const added = NONE.map(([p, c]) => step(p, c)).filter(r => r.rule || !/existential fallacy/.test(r.why) || / Add /.test(r.why));
    ok(!added.length, 'no such sentence where the step with the box would not be taken: "every raven that sings", "everyone", two premises', J(added));
    const quoted = [[['Everyone is mortal.'], 'Someone is mortal.', 'everyone'], [['Nobody is perfect.'], 'Somebody is not perfect.', 'nobody'],
        [['No one is perfect.'], 'Someone is not perfect.', 'no one']].map(([p, c, w]) => step(p, c).why.indexOf('(\u201c' + w + '\u201d does not say that there are any)') >= 0 ? '' : w)
        .filter(Boolean);
    ok(!quoted.length, 'the premise\'s own word: "everyone", "nobody", "no one" (they had been "all")', J(quoted));
    ok(step(['Everything is physical.'], 'Something is physical.').rule === 'subalternation', '"everything" to "something" is subalternation, as before');
    const UNSAFE = [[['Every raven is black.'], 'Some raven is black.'], [['Every raven is black.'], 'At least one raven is black.'],
        [['No raven is white.'], 'Not every raven is white.'], [['Every raven is black.'], 'Something is black.'], [['Everyone is mortal.'], 'Someone is mortal.']];
    ok(!certified(UNSAFE).length, 'no "all" to "some" of a kind that may have nothing in it is certified', J(certified(UNSAFE)));
    const NAMES = [[['Bob is James.'], 'James is Bob.', 'identity symmetry'], [['Twain is Clemens.'], 'Clemens is Twain.', 'identity symmetry'],
        [['Twain is Clemens.', 'Twain wrote books.'], 'Clemens wrote books.', 'identity substitution']];
    const names = NAMES.map(([p, c, rule]) => { const r = step(p, c); return r.rule === rule ? '' : p.join(' / ') + ': ' + J(r); }).filter(Boolean);
    ok(!names.length, '"Bob is James" keeps the name: "James is Bob" follows (it had read "Jame")', names.join(' | '));
    const note = ev(`return parseClaimFull('Bob is James.').notes.map(function (n) { return n.message; });`);
    ok(note.some(m => m.indexOf('"James" is read as a name') >= 0), 'its note says "James"', J(note));
    ok(step(['Bob and Al are Greeks.'], 'Bob is a Greek.').rule === 'conjunction elimination', '"Bob and Al are Greeks" is a plural, as before');
}

ok(errors.length === 0, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
