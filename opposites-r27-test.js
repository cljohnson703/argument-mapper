'use strict';
/**
 * Contraries and contradictories (r27.103; the user, 2026-10-14, asking
 * whether "a dictionary of contraries/contradictories would be useful for
 * (weak) negations", then "Sure" to: a short curated list of pairs, each
 * contradictory or contrary, a switchable "Word meaning" group in the Logic
 * panel, the step's tag naming its pair, hints saying when a step would
 * follow by it).
 *
 *   node opposites-r27-test.js [argument-mapper-r27.html]
 *
 * 1. Every pair, both ways: "Kim is A" gives "Kim is not B"; "Kim is not A"
 *    gives "Kim is B" for a contradictory pair, and never for a contrary one.
 * 2. In any tense, of all or some of a kind, of an identity, against the box
 *    an objection attacks; not of another thing, another object, or a pair
 *    that is not listed ("free" and "determined").
 * 3. Hints: contraries taken for contradictories; the group switched off; a
 *    step of two rules, the claim between them in the box's own words.
 * 4. The Logic panel: its own group, on by default; and a conclusion is not
 *    proposed by it.
 * 5. (r27.110) A word of more than one meaning where the other word says
 *    which ("tall" and "short", "heavy" and "light"); a word after "a" that
 *    ends what is said is a noun ("a light", "a right"), not the adjective.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/opposites-test', virtualConsole: vc,
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

console.log('\n-- 1. every pair, both ways --');
{
    const r = ev(`var objectOf = function (w) { return /(?:from|to|with|as|of)$/.test(w) ? ' Lee' : ''; };
        var article = function (w) { return /^(?:friend|enemy) of$/.test(w) ? 'a ' : /^same as$/.test(w) ? 'the ' : ''; };
        var adj = function (w, not) { return 'Kim is ' + (not ? 'not ' : '') + article(w) + w + objectOf(w) + '.'; };
        var verb = function (w, not) { return not ? 'Kim does not ' + w + ' the plan.' : 'Kim ' + claimThirdPerson(w) + ' the plan.'; };
        var gives = [], reverse = [], wrong = [], names = [];
        CLAIM_OPPOSITES.forEach(function (e) {
            [[e.a, e.b], [e.b, e.a]].forEach(function (ab) {
                // A pair contradictory only of things of a sort ("guilty" and
                // "innocent", of a person) takes, from a denial, a premise
                // that shows it (r27.129).
                var say = e.verb ? verb : adj, one = __step([say(ab[0], false)], say(ab[1], true)),
                    back = __step([say(ab[0], true)].concat(e.sort ? ['Kim is a ' + e.sort + '.'] : []), say(ab[1], false));
                var name = (e.both ? 'contradictories' : 'contraries') + ' \\u2018' + ab[0] + '\\u2019 and \\u2018' + ab[1] + '\\u2019';
                if (!one || one.rule !== name) gives.push(say(ab[0], false) + ' / ' + say(ab[1], true) + ': ' + (one && one.rule));
                if (e.both && (!back || back.rule !== name)) reverse.push(say(ab[0], true) + ' / ' + say(ab[1], false) + ': ' + (back && back.rule));
                if (!e.both && back && back.rule) wrong.push(say(ab[0], true) + ' / ' + say(ab[1], false) + ': ' + back.rule);
                names.push(name);
            });
        });
        return { pairs: CLAIM_OPPOSITES.length, both: CLAIM_OPPOSITES.filter(function (e) { return e.both; }).length, gives: gives, reverse: reverse, wrong: wrong };`);
    // 78 until r27.129, when "dangerous" and "safe", "rise" and "fall",
    // "increase" and "decrease" went (the user, of the fixes proposed: "I
    // agree with you on everything").
    ok(r.pairs === 75 && r.both === 8, 'a list of 75 pairs, 8 of them contradictories', J({ pairs: r.pairs, both: r.both }));
    ok(r.gives.length === 0, 'each word gives the denial of its pair, both ways, the step named by its pair as the words come', J(r.gives));
    ok(r.reverse.length === 0, 'a contradictory pair: each one\'s denial gives the other', J(r.reverse));
    ok(r.wrong.length === 0, 'a contrary pair: never ("Kim is not unhappy" does not give "Kim is happy")', J(r.wrong));
}

console.log('\n-- 2. tenses, kinds, identity, objections --');
{
    const tense = [
        step(['Pre-linguistic humans lacked minds.'], 'Pre-linguistic humans did not have minds.'),
        step(['Pre-linguistic humans did not have minds.'], 'Pre-linguistic humans lacked minds.'),
        step(['Mary lost the race.'], 'Mary did not win the race.'),
        step(['Socrates was dead.'], 'Socrates was not alive.'),
        step(['Socrates will be dead.'], 'Socrates will not be alive.'),
        step(['Socrates will lack a body.'], 'Socrates will not have a body.'),
        step(['The law forbade the trade.'], 'The law did not allow the trade.'),
    ];
    ok(J(tense.map(t => t && t.rule)) === J(['contradictories ‘lack’ and ‘have’', 'contradictories ‘have’ and ‘lack’', 'contraries ‘lose’ and ‘win’',
        'contraries ‘dead’ and ‘alive’', 'contraries ‘dead’ and ‘alive’', 'contradictories ‘lack’ and ‘have’', 'contraries ‘forbid’ and ‘allow’']),
        'in any tense: "lacked", "did not have", "lost", "was dead", "will be dead", "will lack", "forbade"', J(tense));
    const kinds = [
        step(['All zombies are dead.'], 'No zombie is alive.'),
        step(['Every zombie lacks consciousness.'], 'No zombie has consciousness.'),
        step(['No zombie has consciousness.'], 'Every zombie lacks consciousness.'),
        step(['Some zombies are dead.'], 'Some zombies are not alive.'),
    ];
    ok(J(kinds.map(t => t && t.rule)) === J(['contraries ‘dead’ and ‘alive’', 'contradictories ‘lack’ and ‘have’', 'contradictories ‘have’ and ‘lack’', 'contraries ‘dead’ and ‘alive’']),
        'of all or some of a kind: "all zombies are dead" gives "no zombie is alive"', J(kinds));
    const same = [
        step(['Kim is different from Lee.'], 'Kim is not the same as Lee.'),
        step(['Kim is not the same as Lee.'], 'Kim is different from Lee.'),
        step(['Kim is not distinct from Lee.'], 'Kim is identical to Lee.'),
        step(['The mind is distinct from the brain.'], 'The mind is not identical to the brain.'),
    ];
    ok(J(same.map(t => t && t.rule)) === J(['contradictories ‘different from’ and ‘same as’', 'contradictories ‘same as’ and ‘different from’',
        'contradictories ‘distinct from’ and ‘identical to’', 'contradictories ‘distinct from’ and ‘identical to’']),
        'of an identity too: "Kim is the same as Lee", read as one, is the denial of "Kim is different from Lee"', J(same));
    const objection = [step(['Pre-linguistic humans have minds.'], 'Pre-linguistic humans lack minds.', 'objection'), step(['Mary is sad.'], 'Mary is happy.', 'objection')];
    ok(J(objection.map(t => t && t.rule)) === J(['contradictories ‘have’ and ‘lack’', 'contraries ‘sad’ and ‘happy’']),
        'an objection that says the opposite of the box it attacks is certified', J(objection));
    const not = [step(['Mary is unhappy.'], 'Bob is not happy.'), step(['Mary rejects the theory.'], 'Mary does not accept the method.'),
        step(['The action is determined.'], 'The action is not free.'), step(['Mary is very happy.'], 'Mary is not sad.')];
    ok(not.every(t => t && !t.rule), 'not of another thing, nor another object; not a pair whose opposition is a thesis ("free", "determined"); not past a word between ("very")', J(not));
}

console.log('\n-- 3. hints --');
{
    const reversed = step(['Mary is not happy.'], 'Mary is unhappy.');
    ok(!reversed.rule && reversed.why === '‘happy’ and ‘unhappy’ are contraries: one can be neither, so “Mary is not happy” does not give “Mary is unhappy”.',
        'contraries taken for contradictories: said so', J(reversed));
    const lost = step(['Mary did not win the race.'], 'Mary lost the race.');
    ok(!lost.rule && /^‘win’ and ‘lose’ are contraries: one can be neither, so “Mary did not win the race” does not give “Mary lost the race”\.$/.test(lost.why), 'so of verbs', J(lost));
    const off = ev(`var was = state.logic; state.logic = { base: 'standard', rules: {} }; setDeductiveRule('opposites', false);
        var r = __step(['Mary is unhappy.'], 'Mary is not happy.'); state.logic = was; claimRulesCache = null; return r;`);
    ok(!off.rule && off.why === 'With Word meaning: contraries and contradictories switched on in the Logic panel, the premises would give “Mary is not happy” by contraries ‘unhappy’ and ‘happy’.',
        'switched off in the Logic panel: the step is not taken, and the hint says what would take it', J(off));
    const two = step(['If zombies are possible, then pre-linguistic humans lack minds.', 'Pre-linguistic humans have minds.'], 'Zombies are not possible.');
    ok(!two.rule && two.why === 'Getting to “Zombies are not possible” takes two steps. First, “Pre-linguistic humans have minds” gives “Pre-linguistic humans do not lack minds” by contradictories ‘have’ and ‘lack’. ' +
        'Then “Pre-linguistic humans do not lack minds” and “If zombies are possible, then pre-linguistic humans lack minds” give “Zombies are not possible” by modus tollens. ' +
        'Add “Pre-linguistic humans do not lack minds” as a box of its own, with “Pre-linguistic humans have minds” under it.',
        'two rules in one step: the claim between them, in the box\'s own words', J(two));
    const words = [step(['If zombies are possible, then Mary lacks a mind.', 'Mary has a mind.'], 'Zombies are not possible.'),
        step(['If the trial was fair, then the man was guilty.', 'The man was innocent.'], 'The trial was not fair.')];
    ok(/First, “Mary has a mind” gives “It is not the case that Mary lacks a mind” by contradictories ‘have’ and ‘lack’\./.test(words[0].why) &&
        /First, “The man was innocent” gives “The man was not guilty” by contradictories ‘innocent’ and ‘guilty’\./.test(words[1].why),
        'where "does not lack a mind" would not read so, "it is not the case that ..."; a copula in the past kept', J(words.map(w => w.why)));
    const dead = step(['If Socrates is dead, then the city mourns.', 'Socrates is not alive.'], 'The city mourns.');
    ok(!dead.rule && !/takes two steps/.test(dead.why), 'and no claim between where contraries give none ("not alive" does not give "dead")', J(dead));
}

console.log('\n-- 4. the Logic panel; conclusions --');
{
    const g = ev(`var g = DEDUCTIVE_EXTENSIONS.find(function (x) { return x.id === 'opposites'; });
        var at = DEDUCTIVE_EXTENSIONS.findIndex(function (x) { return x.id === 'opposites'; }), able = DEDUCTIVE_EXTENSIONS.findIndex(function (x) { return x.id === 'able'; });
        return { label: g && g.label, on: g && g.on, rules: g && g.rules, after: at === able + 1, gloss: LOGIC_GROUP_GLOSSES.opposites || null };`);
    ok(g.label === 'Word meaning: contraries and contradictories' && g.on === true && J(g.rules) === J(['opposites']) && g.after,
        'its own group, "Word meaning: contraries and contradictories", after "-able", on by default', J(g));
    ok(/^Word meaning, not logic: "Mary is unhappy" gives "Mary is not happy", not the reverse \(contraries\); "lack" and "have" deny each other both ways \(contradictories\)\.$/.test(g.gloss || ''),
        'its note in the panel', g.gloss);
    const derived = ev(`return deriveConclusion(['Mary is unhappy.']);`);
    ok(!derived || derived.rule.id !== 'opposites', 'a conclusion is not proposed by it', J(derived));
}

console.log('\n-- 5. "tall" and "short"; a noun after "a" --');
{
    // r27.110 (the user, 2026-10-20, of "John is tall" giving "John is not
    // short": "Sounds good" to pairs whose other word says which meaning).
    const tall = [['John is tall.', 'John is not short.'], ['The rope is long.', 'The rope is not short.'], ['The box is heavy.', 'The box is not light.'],
        ['The room is dark.', 'The room is not light.'], ['The pillow is soft.', 'The pillow is not hard.'], ['The exam is easy.', 'The exam is not hard.']]
        .map(([p, c]) => step([p], c).rule);
    ok(J(tall) === J(['contraries ‘tall’ and ‘short’', 'contraries ‘long’ and ‘short’', 'contraries ‘heavy’ and ‘light’', 'contraries ‘dark’ and ‘light’',
        'contraries ‘soft’ and ‘hard’', 'contraries ‘easy’ and ‘hard’']),
        '"John is tall" gives "John is not short"; so "long" and "short", "heavy" and "light", "dark" and "light", "soft" and "hard", "easy" and "hard"', J(tall));
    const not = [['John is not short.', 'John is tall.'], ['The lamp is a light.', 'The lamp is not heavy.'], ['Free speech is a right.', 'Free speech is not wrong.'],
        ['John is short of money.', 'John is not tall.']].map(([p, c]) => step([p], c).rule);
    ok(not.every(r => !r), 'not "not short", so "tall" (contraries); not "a light", so "not heavy", nor "a right", so "not wrong" (a noun after "a"); not "short of money"', J(not));
    // r27.111 (the user: "use the built-in syntax trees to parse the parts of
    // speech so that 'light' only gives 'not heavy' when it's an adjective"):
    // the head of a phrase a determiner opens is a noun, whatever the
    // determiner; an adjective before its noun is not.
    const nouns = [['Voting is the right.', 'Voting is not wrong.'], ['The lamp is my light.', 'The lamp is not heavy.']].map(([p, c]) => step([p], c).rule);
    ok(nouns.every(r => !r) && step(['Kim is a friend of Lee.'], 'Kim is not an enemy of Lee.').rule === 'contraries ‘friend of’ and ‘enemy of’',
        'by the syntax tree: "the right", "my light" are nouns, as "a light" is; "a friend of Lee" still the pair "friend of"', J(nouns));
    ok(step(['Mary is a good person.'], 'Mary is not a bad person.').rule === 'contraries ‘good’ and ‘bad’', '"a good person": an adjective before its noun, as before');
    const note = ev('return [DEDUCTIVE_OPTIONAL_RULES.find(function (r) { return r.id === "opposites"; }).gloss, CLAIM_OPPOSITES.length];');
    ok(note[0].indexOf('a list of ' + note[1] + ' pairs') === 0 && /“?"tall" and "short"/.test(note[0]), 'the rule\'s note counts the pairs as the list has them, and names "tall" and "short"', J(note));
}

console.log('\n-- 6. a word of two senses, verbs of change, an outcome, a sort (r27.129) --');
{
    // The user: "has a complete dictionary of English contraries and
    // contradictories" -- and, of the fixes proposed, "I agree with you on
    // everything". Each of these had been certified, and none follows.
    const gone = [['Bob is dangerous.', 'Bob is not safe.'], ['The stock rose today.', 'The stock did not fall today.'],
        ['Prices increased this year.', 'Prices did not decrease this year.'], ['Bob won.', 'Bob did not lose.'], ['The rock is not guilty.', 'The rock is innocent.']]
        .map(([p, c]) => step([p], c).rule);
    ok(gone.every(r => !r), '"Bob is dangerous" does not give "Bob is not safe" (safe in his bunker); "rose" not "did not fall" (both in a day); "won" not "did not lose" (two games); "the rock is not guilty" not "innocent"', J(gone));
    const kept = [['Mary lost the race.', 'Mary did not win the race.'], ['Bob passed the exam.', 'Bob did not fail the exam.'],
        ['The man was guilty.', 'The man was not innocent.'], ['The man was innocent.', 'The man was not guilty.'], ['Bob is not married.', 'Bob is unmarried.']]
        .map(([p, c]) => step([p], c).rule);
    ok(J(kept) === J(['contraries ‘lose’ and ‘win’', 'contraries ‘pass’ and ‘fail’', 'contradictories ‘guilty’ and ‘innocent’', 'contradictories ‘innocent’ and ‘guilty’',
        'contradictories ‘married’ and ‘unmarried’']), 'an outcome of what it is of; "guilty" and "innocent" deny each other of anything', J(kept));
    const shown = step(['The man was not guilty.', 'The man is a person.'], 'The man was innocent.');
    const unused = step(['The man was guilty.', 'The man is a person.'], 'The man was not innocent.');
    ok(shown.rule === 'contradictories ‘guilty’ and ‘innocent’' && !unused.rule && /is not needed/.test(unused.why),
        'from "not guilty", "innocent" takes a premise that the man is a person -- and only there is it used', J([shown, unused]));
    const hint = step(['Socrates was not guilty.'], 'Socrates was innocent.');
    ok(!hint.rule && hint.why === '‘guilty’ and ‘innocent’ are contradictories only of a person: “Socrates was not guilty” gives “Socrates was innocent” once it is shown that ‘Socrates is a person’.',
        'without it, the hint says what it needs', J(hint));
    // Nor is either offered as the claim between two rules.
    const between = [step(['Bob won.', 'If Bob did not lose, then Al is happy.'], 'Al is happy.'),
        step(['The man was not guilty.', 'If the man was innocent, then the trial was fair.'], 'The trial was fair.'),
        step(['Mary lost the race.', 'If Mary did not win the race, then Al is sad.'], 'Al is sad.')].map(s => s.why);
    ok(!/takes two steps/.test(between[0]) && !/takes two steps/.test(between[1]) && /First, “Mary lost the race” gives “Mary did not win the race” by contraries ‘lose’ and ‘win’\./.test(between[2]),
        'no step between "Bob won" and "Bob did not lose", nor "not guilty" and "innocent"; "lost the race", "did not win the race" still', J(between));
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
