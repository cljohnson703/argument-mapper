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
    const pairs = ev(`var objectOf = function (w) { return ' '; }, out = { gives: [], back: [] };
        CLAIM_RELATION_CONVERSES.forEach(function (e) {
            var art = function (w) { return /of$/.test(w) ? 'a ' : ''; };
            [[e[0], e[1]], [e[1], e[0]]].forEach(function (ab) {
                var one = __step(['Kim is ' + art(ab[0]) + ab[0] + ' Lee.'], 'Lee is ' + art(ab[1]) + ab[1] + ' Kim.');
                var name = 'converses \u2018' + ab[0] + '\u2019 and \u2018' + ab[1] + '\u2019';
                if (!one || one.rule !== name) out.gives.push('Kim is ' + ab[0] + ' Lee / Lee is ' + ab[1] + ' Kim: ' + (one && one.rule));
                var no = __step(['Kim is not ' + art(ab[0]) + ab[0] + ' Lee.'], 'Lee is not ' + art(ab[1]) + ab[1] + ' Kim.');
                if (!no || no.rule !== name) out.back.push('not: ' + ab[0] + ' / ' + ab[1] + ': ' + (no && no.rule));
            });
        });
        out.pairs = CLAIM_RELATION_CONVERSES.length; return out;`);
    ok(pairs.pairs === 23 && !pairs.gives.length && !pairs.back.length, 'every pair of converses both ways, and denied, named by the pair (' + pairs.pairs + ' pairs)', J(pairs));
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
    ok(g.label === 'Word meaning: modifiers' && g.on === true && J(g.rules) === J(['modifiers']) && g.after && /^Word meaning, not logic: "Bob ran quickly" gives "Bob ran"/.test(g.gloss || ''),
        'a group of its own, "Word meaning: modifiers", after relations, on by default, with its note', J(g));
    const off = without('modifiers', () => step(['Bob ran quickly.'], 'Bob ran.'));
    ok(!off.rule && off.why === 'With Word meaning: modifiers switched on in the Logic panel, the premises would give “Bob ran” by dropping a modifier.', 'switched off: the check names the switch', J(off));
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

ok(errors.length === 0, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
