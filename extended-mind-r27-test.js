'use strict';
/**
 * An Extended Mind map (r27.115; the user: "This file has what I think is
 * valid reasoning throughout, but a lot of things get marked as unrecognized
 * ... Make use of the internal syntax tree as well").
 *
 *   node extended-mind-r27-test.js [argument-mapper-r27.html]
 *
 * 1. A clause cut short inside a condition ("if beliefs can influence
 *    reasoning while the notebook can't, then ..."), and after "it's not the
 *    case that": read with the clause before it, as it is alone.
 * 2. "It's not the case that P while Q" denies "P while Q" whole.
 * 3. A capital "A" inside a sentence is a letter, not the article; a letter
 *    after a noun is its label ("belief set A"), and letters listed as labels
 *    ("belief sets B, C, D, and E") are one phrase, by the syntax tree.
 * 4. "Anything that is a mental state of a subject is a part of that
 *    subject's mind": "that subject" is the one "a subject" speaks of, any
 *    subject, said of the subject the step names.
 * 5. "Is itself a mental state" is "is a mental state"; "a child of a person"
 *    keeps its "person"; "as mental states of a subject" has no verb in it.
 * 6. What the check says: what a denial denies in its own words, a near miss
 *    in words said to be one, what an objection's premises give, and a "that
 *    subject" that points back to nothing in its box.
 * 7. The colors of steps 1-4.
 * 8. Existential syllogism with the kinds after a verb ("hit a poodle", so
 *    "hit a dog"); a bare plural there, or "a" in a comparison, asked --
 *    with the step's generics, together -- its readings the words that
 *    give the step; a plural with a phrase after it a generic; "any" and a
 *    plural after "not" (r27.120).
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/extended-mind-test', virtualConsole: vc,
    beforeParse(w) {
        const { webcrypto } = require('crypto');
        if (!w.crypto || !w.crypto.randomUUID) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
        w.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
        w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        const ctx = new Proxy({}, { get: (_, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
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
// A step's tag, its rule, what the check says of it, and its premises' colors
// ("class: words", the words of one class run together).
const step = (premises, conclusion, type) => ev(`
    state.trees = [{ id: 'M', type: 'contention', texts: [${J(conclusion)}], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: ${J(type || 'support')}, texts: ${J(premises)}, collapsed: [], children: [] } ] }];
    deductiveCache.clear(); ensureCollabFields(state); selectedIds = []; render();
    if (!inferenceColorsOn) cycleInferenceColors();
    var steps = collectDeductiveSteps(state.trees); applyInferenceColors(steps);
    var s = steps[0];
    var colors = s.premiseTexts.map(function (_, j) {
        var rd = document.querySelector('.node[data-node-id="A"][data-node-idx="' + j + '"] .rendered-text'), o = [];
        if (rd) rd.querySelectorAll('span.ic').forEach(function (sp) {
            if (sp.parentElement.closest('span.ic')) return;
            var cls = sp.className.replace(/^ic /, '');
            sp.childNodes.forEach(function (c) { var k = c.nodeType === 1 && c.matches('span.ic-neg') ? cls + ' ic-neg' : cls;
                if (o.length && o[o.length - 1].c === k) o[o.length - 1].t += c.textContent; else o.push({ c: k, t: c.textContent }); });
        });
        return o.filter(function (p) { return p.t.trim(); }).map(function (p) { return p.c + ': ' + p.t.trim(); });
    });
    return { tag: deductiveStepTagText(s), rule: s.rule ? s.rule.name : null, why: s.why && s.why.text || '', colors: colors };`);
const key = t => ev(`return claimKey(parseClaim(${J(t)}));`);

console.log('\n-- 1. a clause cut short, inside a condition and after "it\'s not the case that" --');
{
    const r = ev(`return claimEllipsisReading(${J("If non-occurrent beliefs can automatically influence reasoning while Otto's notebook can't, then the records cannot perform all the relevant functions.")});`);
    ok(r && r.text === "If non-occurrent beliefs can automatically influence reasoning while Otto's notebook can not automatically influence reasoning, then the records cannot perform all the relevant functions.",
        'inside an "if": its subject runs back to "while", not to the "if"', J(r));
    const n = ev(`return claimEllipsisReading(${J("If influencing reasoning is not a necessary function, then it's not the case that beliefs can influence reasoning while the notebook can't.")});`);
    ok(n && /while the notebook can not influence reasoning\.$/.test(n.text), 'after "it\'s not the case that": the clause inside it, whose helping verb is of its kind', J(n));
    const k = ev(`return [claimEllipsisReading('Mary knows that Bob can swim, and Sue can too.').text, claimEllipsisReading('Mary knows that Bob left, and Sue does too.').text];`);
    ok(k[0] === 'Mary knows that Bob can swim, and Sue can swim.' && k[1] === 'Mary knows that Bob left, and Sue knows that Bob left.',
        'the clause itself where its helping verb is of the kind ("does": "knows"), the one inside it where only that one\'s is ("can")', J(k));
    const s = step(["If non-occurrent beliefs can automatically influence reasoning while Otto's notebook can't, then the records in Otto's notebook cannot perform all the relevant functions of non-occurrent beliefs.",
        "Non-occurrent beliefs can automatically influence reasoning while Otto's notebook can't."],
        "The records in Otto's notebook cannot perform all the relevant functions of non-occurrent beliefs.");
    ok(s.rule === 'modus ponens', 'the step: modus ponens (it had been "a clause cut short is not read")', J(s));
    ok(J(s.colors[0]) === J(['ic-rest: If', "ic-k0: non-occurrent beliefs can automatically influence reasoning while Otto's notebook can't", 'ic-rest: , then',
        "ic-c: the records in Otto's notebook cannot perform all the relevant functions of non-occurrent beliefs", 'ic-rest: .']) &&
        J(s.colors[1]) === J(["ic-k0: Non-occurrent beliefs can automatically influence reasoning while Otto's notebook can't", 'ic-rest: .']),
        'its colors: the condition and the premise one color (a "while" claim\'s words looked for as the box has them, not as "while Q, P")', J(s.colors));
}

console.log('\n-- 2. "it\'s not the case that P while Q" --');
{
    const s = step(["If influencing reasoning is not a necessary function of non-occurrent beliefs, then it's not the case that non-occurrent beliefs can automatically influence reasoning while Otto's notebook can't.",
        'Influencing reasoning is not a necessary function of non-occurrent beliefs.'],
        "Non-occurrent beliefs can automatically influence reasoning while Otto's notebook can't.", 'objection');
    ok(s.rule === 'modus ponens', 'denies "P while Q" whole: the objection follows', J(s));
    ok(s.colors[0].includes("ic-c ic-neg: it's not the case that") && s.colors[0].includes("ic-c: non-occurrent beliefs can automatically influence reasoning while Otto's notebook can't"),
        'its denial red, in the stretch that goes on', J(s.colors[0]));
    ok(key("It is not the case that Bob sings while Mary dances.") === 'N(' + key('Bob sings while Mary dances.') + ')', 'a box alone: the denial of the "while" claim');
}

console.log('\n-- 3. letters: "A" is no article; labels; a list of them --');
{
    const raw = ev(`return ['Belief set A changes belief set B.', 'If A, then B.', 'Bob believes A.'].map(function (t) { return normalizeClaimText(t).replace(/\\uE000/g, '^'); });`);
    ok(J(raw) === J(['belief set ^a changes belief set ^b', 'if ^a, then ^b', 'bob believes ^a']), 'a capital "A" inside a sentence keeps its mark, as "B" does', J(raw));
    ok(key('Belief set A changes belief set B.').replace(//g, '') === 'P:belief set a|~change belief set b', '"belief set A | changes": a letter after a noun is its label', key('Belief set A changes belief set B.'));
    ok(key('Bob believes A.') === 'P:bob|~believe that a' && /that ?a is true$/.test(key('Mary said that A is true.')),
        '"A" with no noun after it is no article to drop', key('Bob believes A.') + ' / ' + key('Mary said that A is true.'));
    const syll = [step(['All B are A.', 'All C are B.'], 'All C are A.'), step(['All C are A.', 'Some B are C.'], 'Some B are A.'), step(['Every A is a B.', 'x is an A.'], 'x is a B.')];
    ok(syll.map(x => x.rule).join(' | ') === 'universal syllogism | existential syllogism | universal modus ponens', '"all B are A" (it had been one claim, unread), "some B are A", "x is an A"', J(syll.map(x => x.rule)));
    const plain = [step(['If A, then B.', 'A.'], 'B.'), step(['A or B.', 'Not A.'], 'B.'), step(['B and A.'], 'A.')];
    ok(plain.map(x => x.rule).join(' | ') === 'modus ponens | disjunctive syllogism | conjunction elimination', 'sentence letters as before', J(plain.map(x => x.rule)));
    const list = ev(`var f = parseClaim('Belief set A changes belief sets B, C, D, and E.'); return { kind: f.kind, key: claimKey(f) };`);
    ok(list.kind === 'pred' && /\|~change belief sets ?b ?c ?d and ?e$/.test(list.key), 'the letters listed after "belief sets": one phrase, the verb\'s object -- no claims "C", "D", "E"', J(list));
    ok(J(ev(`return [claimLabelLists(normalizeClaimText('Bob believes A, B, and C.')), claimLabelLists(normalizeClaimText('If A, B, and C, then D.'))];`)) === J([[], []]) &&
        ev(`return claimLabelLists(normalizeClaimText('Mary visited rooms A, B, and C.')).length;`) === 1,
        'after a verb or "if", letters are sentence letters; after "rooms", labels');
    const s = step(['If belief set A changes belief sets B, C, D, and E, and if Otto has to manually go through the whole notebook to find inconsistent belief sets, then Otto\'s notebook can\'t fully integrate all changes in non-occurrent beliefs in the same manner as the mind.',
        'Otto has to manually go through the whole notebook to find inconsistent belief sets.', 'Belief set A changes belief sets B, C, D, and E.'],
        "Otto's notebook can't fully integrate all the changes in non-occurrent beliefs in the same manner as the mind");
    ok(s.rule === 'modus ponens, conditions together', 'the step: two conditions, each given ("If A changes B, C, D, and E" had been read with its commas as "then")', J(s));
    ok(J(s.colors[2]) === J(['ic-k0: Belief set A changes belief sets B, C, D, and E', 'ic-rest: .']) && s.colors[0].includes('ic-k0: belief set A changes belief sets B, C, D, and E'),
        'its colors: the list one part, in the premise and in the condition', J(s.colors));
}

console.log('\n-- 4. "a subject ... that subject": any subject, said of the one the step names --');
{
    // r27.118 (the user: "you can put in any name for the subject. It's
    // equivalent to 'For any entity, anything that is a mental state of that
    // entity is a part of that entity's mind' ... shouldn't it just be one
    // step?"): the rule and its case, one universal modus ponens, as "every
    // raven that sings is black" and its case are. r27.117 had made it two.
    const U = "Anything that is a mental state of a subject is a part of that subject's mind.", I = "Anything that is a mental state of Otto is a part of Otto's mind.";
    const CASE = "The records in Otto's notebook are mental states of Otto.", C = "The records in Otto's notebook are a part of his mind.";
    const s = step([U, CASE], C);
    ok(s.rule === 'universal modus ponens', 'the rule and its case: one step', J(s));
    ok(J(s.colors) === J([['ic-k0: Anything that is a mental state of a subject', "ic-c: is a part of that subject's mind", 'ic-rest: .'],
        ["ic-c: The records in Otto's notebook", 'ic-k0: are mental states of Otto', 'ic-rest: .']]), 'its colors: the rule\'s kind and its case one color, each "is" with what it says', J(s.colors));
    const also = [step([U, CASE, 'Otto is a subject.'], C), step([U, 'Otto is a subject.'], I), step([I, CASE], C)];
    ok(also.every(x => x.rule === 'universal modus ponens'), 'with "Otto is a subject" beside them, used; the rule said of Otto alone; and that rule with the case', J(also.map(x => x.rule)));
    const more = [
        step(["Every mental state of a subject is a part of that subject's mind.", 'The belief is a mental state of Otto.'], "The belief is a part of Otto's mind."),
        step([U, "The records in Otto's notebook are not a part of his mind."], "The records in Otto's notebook are not mental states of Otto."),
        step(["The records in Otto's notebook play the same causal/explanatory role as non-occurrent beliefs within his brain.",
            "Anything that plays the same causal/explanatory role as non-occurrent beliefs within a subject's brain plays the same causal/explanatory role as mental states of that subject."],
            "The records in Otto's notebook play the same causal/explanatory role as mental states of Otto."),
        step(['Anything that is a child of a person is loved by that person.', 'Bob is a child of Mary.', 'Mary is a person.'], 'Bob is loved by Mary.'),
        step(['Anything that is a child of a person is loved by the person.', 'Bob is a child of Mary.', 'Mary is a person.'], 'Bob is loved by Mary.')];
    ok(J(more.map(x => x.rule)) === J(['universal modus ponens', 'universal modus tollens', 'universal modus ponens', 'universal modus ponens', 'universal modus ponens']),
        '"every ... of a subject", modus tollens, "a subject\'s brain", and "a person ... that person" with "Mary is a person"', J(more.map(x => x.rule)));
    const kind = step(['Anything that is a child of a person is loved by that person.', 'Bob is a child of Mary.'], 'Bob is loved by Mary.');
    ok(!kind.rule && kind.why === '“Anything that is a child of a person is loved by that person” would give “Bob is loved by Mary” once it is shown that ‘Mary is a person’.',
        '"a person" limits the rule, as "everyone" does: not of Mary until she is shown to be one', J(kind));
    const not = [
        step([U, CASE], "The records in Otto's notebook are a part of Mary's mind."),
        step(["Some mental state of a subject is a part of that subject's mind.", 'X is a mental state of Otto.'], "X is a part of Otto's mind."),
        step(['Anything that is a child of a person is loved by that person.', 'Bob is loved by Mary.', 'Mary is a person.'], 'Bob is a child of Mary.'),
        step(['Anything that is a child of a person is loved by that person.', 'Bob is a child of Mary.', 'Mary is a person.'], 'Mary is loved by Bob.'),
        step([U, 'The records are not mental states of Otto.'], "The records are not a part of Otto's mind."),
        step([U, 'Mary is a subject.'], I)];
    ok(not.every(x => !x.rule), 'not of another subject, not under "some", not the converse, the other way round, or the antecedent denied', J(not.map(x => x.rule)));
    const extra = step(["The records in Otto's notebook play the same causal/explanatory role as non-occurrent beliefs within his brain.",
        "Non-occurrent beliefs within a subject's brain are mental states of that subject.",
        "Anything that plays the same causal/explanatory role as non-occurrent beliefs within a subject's brain plays the same causal/explanatory role as mental states of that subject."],
        "The records in Otto's notebook play the same causal/explanatory role as mental states of Otto.");
    ok(!extra.rule && extra.why.startsWith('“Non-occurrent beliefs within a subject\'s brain are mental states of that subject” is not needed: the other premises give ' +
        '“The records in Otto\'s notebook play the same causal/explanatory role as mental states of Otto” by universal modus ponens, and a step uses every premise.'),
        'a premise the step does not use: said, with what the others give', extra.why);
}

console.log('\n-- 5. "is itself", "a person", "mental states of a subject" --');
{
    ok(key('The records are themselves mental states of Otto.') === key('The records are mental states of Otto.') && key('A belief is itself a mental state.') === key('A belief is a mental state.') &&
        key('Bob is not himself today.') !== key('Bob is not today.'), '"is itself a mental state" is "is a mental state"; "is not himself today" keeps "himself"');
    ok(key('Bob is a child of a person.') === 'P:bob|=child of person' && key('Bob is loved by that person.') === 'P:bob|=loved by that person' && key('All black things are dark.') === 'U:=black|=dark',
        '"a child of a person" keeps "person" (it had been "child of a"); "black things" is still "black"', key('Bob is a child of a person.') + ' / ' + key('All black things are dark.'));
    const f = ev(`var f = parseClaim('Anything that plays the same roles as mental states of a subject is a mental state of that subject.'); return [f.subject, f.predicate];`);
    ok(J(f) === J(['~play the same roles as mental states of subject', '=mental state of that subject']), '"as mental states of a subject | is": "states" after "as mental" is a noun, not the verb', J(f));
}

console.log('\n-- 6. what the check says --');
{
    const typo = step(['If all non-occurrent beliefs have to have the capacity to influence reasoning without being consciously recalled, then influencing reasoning is a necessary fucntion of non-occurrent beliefs.',
        'All non-occurrent beliefs have to have the capacity to influence reasoning without being consciously recalled.'], 'Influencing reasoning is not a necessary function of non-occurrent beliefs.', 'rebuttal');
    ok(/‘influencing reasoning is a necessary function of non-occurrent beliefs’ differ: “fucntion” in one where the other has “function”\.$/.test(typo.why),
        'what a denial denies, in its own words: "is a necessary function" (it had been "influencing reasoning necessary function"), and the one word that differs', typo.why);
    const mind = step(["If the records in Otto's notebook are a part of Otto's mind, then the mind extends into the world.", "The records in Otto's notebook are a part of his mind."],
        "Minds don't extend into the world.", 'objection');
    ok(mind.tag === '✗ spelled differently' && /^Worded the same way each time, the premises would give the denial of “Minds don't extend into the world” by modus ponens, but ‘the mind extends into the world’ and ‘minds extend into the world’ are worded differently\./.test(mind.why),
        '"the mind" and "minds": "Worded", not "Spelled", the same way', mind.why);
    ok(step(["If the records in Otto's notebook are a part of Otto's mind, then minds extend into the world.", "The records in Otto's notebook are a part of his mind."], "Minds don't extend into the world.", 'objection').rule === 'modus ponens',
        'so worded, the objection follows');
    const ob = step(['If the notebook can perform the most important functions of non-occurrent beliefs, then the records in Otto\'s notebook do not have to perform all the relevant functions of non-occurrent beliefs.',
        'The notebook can perform the most important functions of non-occurrent beliefs.'], "The records in Otto's notebook cannot perform all the relevant functions of non-occurrent beliefs.", 'objection');
    ok(ob.why === 'The premises give “The records in Otto\'s notebook do not have to perform all the relevant functions of non-occurrent beliefs” by modus ponens, which does not deny “The records in Otto\'s notebook cannot perform all the relevant functions of non-occurrent beliefs”.',
        'an objection: what its premises give, which does not deny its box ("do not have to perform" against "cannot perform")', ob.why);
    const dang = step(["The records in Otto's notebook play the same causal/explanatory role as mental states of that subject.",
        'Anything that plays the same causal/explanatory roles as a mental state of a subject is itself a mental state of that subject.'], "The records in Otto's notebook are mental states of Otto.");
    ok(dang.why === '“The records in Otto\'s notebook play the same causal/explanatory role as mental states of that subject.”: “that subject” points back to nothing in this box, and each box is read alone: name the subject (“Otto”?).',
        '"that subject" copied from the rule, in a box with no subject: said, with the subject the step names', dang.why);
    const half = step(["The records in Otto's notebook play the same causal/explanatory role as mental states of Otto.",
        'Anything that plays the same causal/explanatory roles as a mental state of a subject is itself a mental state of that subject.'], "The records in Otto's notebook are mental states of Otto.");
    ok(/^Worded the same way each time, the premises would give “The records in Otto's notebook are mental states of Otto” by universal modus ponens, but ‘[^’]*roles as mental state of Otto’ and ‘[^’]*role as mental states of Otto’ differ: “roles state” in one where the other has “role states”\.$/.test(half.why),
        'with the subject named: the words of the rule\'s case that differ, and no others', half.why);
    const sue = step(['Anything that is a child of a thing is loved by that thing.', 'Bob is a child of Mary.'], 'Bob is loved by Sue.').why;
    ok(/‘bob is loved by mary’ and ‘bob is loved by sue’ differ: “mary” in one where the other has “sue”\.$/i.test(sue) && !/“thing” in one/.test(sue),
        'a case the check makes says its "is", and the rule is said of Mary, not compared as written ("thing" against "Mary")', sue);
    const kindSue = step(['Anything that is a child of a person is loved by that person.', 'Bob is a child of Mary.'], 'Bob is loved by Sue.').why;
    ok(/would give “Bob is loved by Sue” once it is shown that ‘Mary is a person’, and worded the same way each time: ‘bob is loved by Mary’ and ‘bob is loved by Sue’ differ: “mary” in one where the other has “sue”\.$/.test(kindSue),
        'with a kind: what it would give once Mary is shown to be one, and the words that differ', kindSue);
    const can = step(['If the notebook can perform the most important functions of non-occurrent beliefs, then the records in Otto\'s notebook can perform all the relevant functions of non-occurrent beliefs.',
        'The notebook can perform the most important functions of non-occurrent beliefs.'], "The records in Otto's notebook cannot perform all the relevant functions of non-occurrent beliefs.", 'objection');
    ok(can.rule === 'modus ponens' && can.colors[0].includes('ic-c ic-neg: can'),
        'an objection\'s "can" red against "cannot", though "non-occurrent" is said in both (r27.118)', J(can.colors[0]));
    const syn = step(['Computer programs are only syntactical.', 'Syntactics is not sufficient for semantics.',
        'If computer programs are only syntactical and syntax is not sufficient for semantics, then computers lack semantics.'], 'Computers lack semantics.');
    ok(/‘syntactics is not sufficient for semantics’ and ‘syntax is not sufficient for semantics’ differ: “syntactics” in one where the other has “syntax”\.$/.test(syn.why),
        'a copula\'s number is no difference in words ("syntactics are" and "syntax is" differ in "syntactics" alone)', syn.why);
    const verdict = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ["Minds don't extend into the world."], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'objection', texts: ["If the records in Otto's notebook are a part of Otto's mind, then the mind extends into the world.", "The records in Otto's notebook are a part of his mind."], collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); render(); var steps = collectDeductiveSteps(state.trees), v = claimMapVerdict(state.trees, steps); return claimVerdictWhy(v, v('M', 0));`);
    ok(!/\.\./.test(verdict) && /gives\. Nothing on the map supports it\.$/.test(verdict), 'the verdict\'s reason ends once ("gives.", not "gives..")', verdict);
}

console.log('\n-- 7. "If an AI system is reliably and routinely consulted ..." (r27.119) --');
{
    // The user, of a presentation map: "particularly with the part labeled
    // 'ambiguous'. The colors aren't matching, the disambiguation is wrong,
    // and it doesn't certify."
    const s = step(["If an AI system is reliably and routinely consulted by a student as part of the student's thinking process, then the AI system functions as a cognitive extension.",
        "An AI system is reliably and routinely consulted by a student as part of the student's thinking process."], 'The AI system functions as a cognitive extension.');
    const t = step(["Every AI system that is reliably and routinely consulted by a student as part of the student's thinking process functions as a cognitive extension.",
        "An AI system is reliably and routinely consulted by a student as part of the student's thinking process."], 'The AI system functions as a cognitive extension.');
    // Since r27.145 "the AI system" is the one "an AI system" speaks of (the
    // user chose it over keeping "the" for one fixed thing): the step asks
    // what "an AI system" after "if" means, as it does with "they"; read as
    // "every AI system ...", universal modus ponens, by the premise's AI
    // system. It had been modus ponens, "the AI system" one fixed thing.
    // r27.166 (the user: "Did you mean: ..."; saying whether a step follows
    // "might steer less discerning individuals in the wrong direction"): the
    // question gives the readings, not the one the step follows on; answered
    // "every", it follows (the next check).
    ok(s.tag === '? generic' && s.why.indexOf('Did you mean \u201cEvery AI system that is reliably and routinely consulted by a student as part of the student\'s thinking process ' +
        'functions as a cognitive extension\u201d or \u201cGenerally, if an AI system is reliably and routinely consulted by a student as part of the student\'s thinking process, ' +
        'then the AI system functions as a cognitive extension\u201d?') === 0 && !/follows by/.test(s.why),
        'the step asks what "an AI system" after "if" means: "every AI system ..." or "generally, ..." -- not which the step follows on', J(s));
    ok(t.rule === 'universal modus ponens' && J(t.colors) === J([["ic-k0: Every AI system that is reliably and routinely consulted by a student as part of the student's thinking process",
        'ic-c: functions as a cognitive extension', 'ic-rest: .'], ['ic-c: An AI system', "ic-k0: is reliably and routinely consulted by a student as part of the student's thinking process", 'ic-rest: .']]),
        'answered "every": universal modus ponens; the kind meets what the premise says, and "An AI system" goes on as "the AI system"', J(t));
    ok(key('Bob is reliably and routinely consulted.') === 'P:bob|=reliably and routinely consulted' && /^C\[/.test(key('Bob is happy and rich.')),
        '"is reliably and routinely consulted": adverbs joined, one part; "is happy and rich", two', key('Bob is reliably and routinely consulted.'));
    ok(ev(`return parseClaimFull('Seven is not even or odd.').notes.some(function (n) { return /"not" can deny the whole "or"/.test(n.message); });`),
        'adverbs in -ly only: "is not even or odd" still asks what "not" denies');
    const q = ev(`var r = parseClaimFull('If an AI system is consulted, then the AI system is reliable.'), a = parseClaimFull('An AI system is reliably consulted.');
        return { if: r.notes.filter(function (n) { return n.kind === 'ambiguous'; }).map(function (n) { return [n.message, n.readings.map(function (x) { return x.replace(/\\uE000/g, '^'); })]; }),
            bound: r.notes.filter(function (n) { return n.kind === 'unread'; }).map(function (n) { return n.message; }), plain: a.notes.map(function (n) { return n.message; }) };`);
    // Its "any" reading since r27.145 the kind said whole: "every AI system that is consulted".
    ok(q.if.length === 1 && q.if[0][0] === '"an AI system" after "if" may mean any AI system, AI systems in general, or one particular AI system' &&
        /^every \^a\^i system that is consulted is reliable$/.test(q.if[0][1][0]) &&
        J(q.bound) === J(['"the AI system" is read as what the condition speaks of, so the box says what "every AI system that is consulted is reliable" says']),
        'after "if": its "any" reading says "every", its words their capitals, "AI systems in general"; "the AI system" read as the one it speaks of, and said so', J(q));
    ok(J(q.plain) === J(['"an AI system" may mean every one, some one, or one in general']), '"AI system": no question whether "AI" describes the system itself', J(q.plain));
    const ai = ev(`return ['ChatGPT is an AI system.', 'Every US senator is a citizen.', 'This is a zombie argument.'].map(function (t) {
        return parseClaimFull(t).notes.filter(function (n) { return /describes the/.test(n.message); }).length; });`);
    ok(J(ai) === J([0, 0, 1]), 'an acronym before its noun names a kind with it ("AI system", "US senator"); a word the lists do not know still asks ("zombie argument")', J(ai));
    const big = ev(`return parseClaimFull('Big Norwegian ravens fly.').notes.map(function (n) { return n.message; });`);
    ok(J(big) === J(['"big Norwegian ravens" may mean all of them, some, most, or what holds in general']), 'a question says its words with their capitals', J(big));
}

console.log('\n-- 8. the kinds after a verb: existential syllogism, and the question a bare plural asks (r27.120) --');
{
    // The user, of step 4: "It says, 'All As are Bs', 'F plays the role of an
    // A', so, 'F plays the role of a B', no?" -- and: "If it's strictly
    // speaking ambiguous, then no. The ambiguity checker would need to be
    // able to offer a suggestion."
    const rule = (p, c, type) => step(p, c, type).rule;
    ok(rule(['Bob hit a poodle.', 'Every poodle is a dog.'], 'Bob hit a dog.') === 'existential syllogism' &&
       rule(['Bob hit some poodle.', 'All poodles are dogs.'], 'Bob hit some dog.') === 'existential syllogism' &&
       rule(['Every dog is a poodle.', 'Bob hit a dog.'], 'Bob hit a poodle.') === 'existential syllogism' &&
       rule(['Bob is taller than some poodle.', 'Every poodle is a dog.'], 'Bob is taller than some dog.') === 'existential syllogism',
       '"hit a poodle" and "every poodle is a dog" give "hit a dog": existential syllogism, the kinds after the verb');
    const none = [[['Every poodle is a dog.', 'Bob hit a dog.'], 'Bob hit a poodle.'], [['Bob fears a poodle.', 'Every poodle is a dog.'], 'Bob fears a dog.'],
        [['Bob must own a poodle.', 'Every poodle is a dog.'], 'Bob must own a dog.'], [['Bob owns a large mouse.', 'Every mouse is an animal.'], 'Bob owns a large animal.'],
        [['Bob does not own a poodle.', 'Every poodle is a dog.'], 'Bob does not own a dog.'], [['Bob hit a poodle.', 'Every poodle is a dog.'], 'Bob hit an animal.'],
        [['Bob almost hit a poodle.', 'Every poodle is a dog.'], 'Bob almost hit a dog.']]
        .filter(([p, c]) => rule(p, c));
    ok(!none.length, 'but not from a dog to a poodle, after "fears" or "must", with "large" kept (a large mouse is no large animal), after "not", to another kind, nor after "almost"', J(none));
    const otto = ["The records in Otto's notebook play the same causal/explanatory role as non-occurrent beliefs within his brain.",
        "Non-occurrent beliefs within a subject's brain are mental states of that subject."];
    const asked = step(otto, "The records in Otto's notebook play the same causal/explanatory role as mental states of Otto.");
    // r27.166: each box's question, its readings in the box's words; not
    // which the step follows on (answered, it does: the next check).
    ok(asked.tag === '? generic' && asked.why.indexOf("“The records in Otto's notebook play the same causal/explanatory role as non-occurrent beliefs within his brain.”: did you mean " +
            "“The records in Otto's notebook play the same causal/explanatory role as some non-occurrent beliefs within his brain”, “The records in Otto's notebook play the same causal/explanatory role as all non-occurrent beliefs within his brain”, " +
            "or “The records in Otto's notebook play the same causal/explanatory role as non-occurrent beliefs within his brain in general”?") === 0 &&
       asked.why.indexOf("“Non-occurrent beliefs within a subject's brain are mental states of that subject.”: did you mean “All non-occurrent beliefs within a subject's brain are mental states of that subject”, " +
            "“Some non-occurrent beliefs within a subject's brain are mental states of that subject”, “Most non-occurrent beliefs within a subject's brain are mental states of that subject”, " +
            "or “Generally, non-occurrent beliefs within a subject's brain are mental states of that subject”?") > 0 &&
       asked.why.indexOf("“The records in Otto's notebook play the same causal/explanatory role as mental states of Otto.”: did you mean “The records in Otto's notebook play the same causal/explanatory role as some mental states of Otto”, " +
            "“The records in Otto's notebook play the same causal/explanatory role as all mental states of Otto”, or “The records in Otto's notebook play the same causal/explanatory role as mental states of Otto in general”?") > 0 &&
       !/follows by/.test(asked.why),
       'step 4 as written asks: the bare plurals after the verb (some, all, or in general) and the rule\'s (all, some, most, or in general), each box by name -- and not which readings give it', asked.why);
    const answered = step(["The records in Otto's notebook play the same causal/explanatory role as some non-occurrent beliefs within his brain.",
        "All non-occurrent beliefs within a subject's brain are mental states of that subject."], "The records in Otto's notebook play the same causal/explanatory role as some mental states of Otto.");
    ok(answered.rule === 'existential syllogism' && J(answered.colors) === J([
        ["ic-c: The records in Otto's notebook play the same causal/explanatory role as some", 'ic-k0: non-occurrent beliefs within his brain', 'ic-rest: .'],
        ["ic-k0: All non-occurrent beliefs within a subject's brain", 'ic-c: are mental states of that subject', 'ic-rest: .']]),
        'answered, it follows; the verb\'s words go on, the object meets the rule\'s kind, and the rule\'s predicate goes on as the object', J(answered));
    const chosen = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ["The records in Otto's notebook play the same causal/explanatory role as mental states of Otto."], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ${J(otto)}, collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); selectedIds = []; render();
        var s = collectDeductiveSteps(state.trees)[0]; openReadingChooser(s, document.body);
        var pop = document.getElementById('reading-chooser'), rows = [].slice.call(pop.querySelectorAll('.rc-row'));
        var heads = [].slice.call(pop.querySelectorAll('.rc-head')).map(function (h) { return h.textContent; });
        var marked = rows.filter(function (r) { return /follows/.test(r.textContent); }).map(function (r) { return r.textContent; });
        var fits = rows.every(function (r) { return !r.querySelector('input').disabled; });
        var radio = rows[0].querySelector('input'); radio.checked = true; radio.dispatchEvent(new window.Event('change'));
        pop.querySelector('.rc-apply').click();
        return { heads: heads, marked: marked, fits: fits, box: state.trees[0].children[0].texts[0] };`);
    ok(J(chosen.heads) === J(["“The records in Otto's notebook play the same causal/explanatory role as non-occurrent beliefs within his brain.” — did you mean:",
            "“Non-occurrent beliefs within a subject's brain are mental states of that subject.” — did you mean:",
            "“The records in Otto's notebook play the same causal/explanatory role as mental states of Otto.” — did you mean:"]) &&
       chosen.fits && !chosen.marked.length &&
       chosen.box === "The records in Otto's notebook play the same causal/explanatory role as some non-occurrent beliefs within his brain.",
       'its chooser: three questions, box by box, "did you mean:", no reading marked as the one the step follows on (r27.166); choosing one writes "some" into the box', J(chosen));
    const step3 = step(["The records in Otto's notebook play the same causal/explanatory role as some mental states of Otto.",
        'Anything that plays the same causal/explanatory role as mental states of a subject is itself a mental state of that subject.'], "The records in Otto's notebook are mental states of Otto.");
    ok(step3.tag === '? generic' && step3.why === 'Did you mean “Anything that plays the same causal/explanatory role as some mental states of a subject is itself a mental state of that subject”, ' +
            '“Anything that plays the same causal/explanatory role as all mental states of a subject is itself a mental state of that subject”, ' +
            'or “Anything that plays the same causal/explanatory role as mental states of a subject in general is itself a mental state of that subject”?' &&
       rule(["The records in Otto's notebook play the same causal/explanatory role as some mental states of Otto.",
            'Anything that plays the same causal/explanatory role as some mental states of a subject is itself a mental state of that subject.'], "The records in Otto's notebook are mental states of Otto.") === 'universal modus ponens' &&
       rule(["The records in Otto's notebook play the same causal/explanatory role as mental states of Otto.",
            'Anything that plays the same causal/explanatory role as mental states of a subject is itself a mental state of that subject.'], "The records in Otto's notebook are mental states of Otto.") === 'universal modus ponens',
       'step 3, once its premise says "some": its rule asks for "some" too; as written, both alike, it follows as it did', step3.why);
    const rebut = step(["If the records in Otto's notebook cannot perform all the relevant functions of non-occurrent beliefs, then the records in Otto's notebook do not play the same causal/explanatory role as non-occurrent beliefs within Otto's brain.",
        "The records in Otto's notebook cannot perform all the relevant functions of non-occurrent beliefs."], "The records in Otto's notebook play the same causal/explanatory role as some non-occurrent beliefs within his brain.", 'rebuttal');
    const ANY = "If the records in Otto's notebook cannot perform all the relevant functions of non-occurrent beliefs, then the records in Otto's notebook do not play the same causal/explanatory role as any non-occurrent beliefs within Otto's brain.";
    ok(rebut.tag === '? generic' && rebut.why.indexOf('Did you mean “' + ANY.replace(/\.$/, '') + '”, ') === 0 && !/follows by/.test(rebut.why) &&
       rule([ANY, "The records in Otto's notebook cannot perform all the relevant functions of non-occurrent beliefs."],
            "The records in Otto's notebook play the same causal/explanatory role as some non-occurrent beliefs within his brain.", 'rebuttal') === 'modus ponens' &&
       !/Worded the same way/.test(rebut.why),
       'the rebuttal of "... as some ...": its "not ... non-occurrent beliefs" asks, "any" offered -- not the hint to write "not ... some", which says something else', rebut.why);
    const comp = step(['Bob is taller than a poodle.', 'Every poodle is a dog.'], 'Bob is taller than a dog.');
    ok(comp.tag === '? generic' && comp.why === '“Bob is taller than a poodle.”: did you mean “Bob is taller than some poodle” or “Bob is taller than any poodle”? ' +
            '“Bob is taller than a dog.”: did you mean “Bob is taller than some dog” or “Bob is taller than any dog”?',
       '"a" in a comparison ("taller than a poodle") asks: some one, or any one', comp.why);
    const ravens = step(['Poe loves ravens.', 'Fido is a raven.'], 'Poe loves Fido.');
    ok(ravens.tag === '? generic' && ravens.why === 'Did you mean “Poe loves some ravens”, “Poe loves all ravens”, or “Poe loves ravens in general”?' &&
       rule(['Poe loves all ravens.', 'Fido is a raven.'], 'Poe loves Fido.') === 'universal modus ponens',
       'and a bare plural object read as "all": "Poe loves ravens", "Fido is a raven", "Poe loves Fido"', ravens.why);
    const heads = ev(`return ['Ravens in the park are black.', 'Students who study pass.', "Non-occurrent beliefs within a subject's brain are mental states of that subject."].map(function (t) {
        return parseClaimFull(t).notes.map(function (n) { return n.message; }); });`);
    ok(J(heads) === J([['"ravens in the park" may mean all of them, some, most, or what holds in general'], ['"students who study" may mean all of them, some, most, or what holds in general'],
        ['"non-occurrent beliefs within a subject\'s brain" may mean all of them, some, most, or what holds in general']]),
        'a plural with a phrase or a clause after it is a generic, as "ravens are black" is (it had been read as one thing\'s name)', J(heads));
    const same = ev(`var a = parseClaim("All non-occurrent beliefs within a subject's brain are mental states of that subject."), b = parseClaim("Every non-occurrent belief within a subject's brain is a mental state of that subject.");
        var c = parseClaim("The records play the same role as some non-occurrent beliefs within his brain."), d = parseClaim("The records play the same role as some non-occurrent belief within his brain.");
        return [claimSame(a, b), claimSame(c, d), normalizeClaimTerm("non-occurrent beliefs within a subject's brain"), normalizeClaimTerm('dogs within cities')];`);
    ok(same[0] && same[1] && same[2] === "non-occurrent belief within a subject's brain" && same[3] === 'dog within cities',
        '"beliefs within his brain" is the kind "belief within his brain", as "beliefs in his brain" is, and "cities" in "dogs within cities" keeps its number; "some beliefs within" is "some belief within"', J(same));
    ok(rule(['If Bob is kind, then Bob does not own any poodles.', 'Bob is kind.'], 'Bob owns some poodles.', 'rebuttal') === 'modus ponens',
       '"does not own any poodles" denies "owns some poodles" (the plural had been kept)');
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
