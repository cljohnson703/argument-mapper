'use strict';
/**
 * The syntax tree, stage one: each word's parts of speech, and the phrases
 * they make -- noun phrases and verb groups -- so that where a subject ends
 * and its verb begins is decided in one place (the user, 2026-09-29: "an
 * internal syntax tree so the checker can disambiguate a little more easily,
 * especially by telling different syntactical elements apart").
 *
 *   node syntax-r27-test.js [argument-mapper-r27.html]
 *
 * 1. Words: a closed word is only what it is; an open word may be a noun, a
 *    verb, an adjective, as the lists and its ending allow.
 * 2. Subjects: a name, a pronoun, a determiner with adjectives and nouns, a
 *    possessive, "of ...", two joined, a relative clause -- and the verb
 *    group after it, sure verbs first ("the price increases were large").
 * 3. What the reader does with them: the subject of a predication, and a
 *    clause where the old tests found none ("the black raven left and then
 *    the dog cried").
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || 'argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/syntax-test', virtualConsole: vc,
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
// A sentence's subject and the rest, as the phrases have it: "[the black raven] left".
const split = t => ev(`var b = claimSynBrackets(normalizeClaimText(${J(t)})); return b && b.replace(/\\uE000/g, '');`);
const key = t => ev('var f = parseClaim(' + J(t) + '); return f ? claimKey(f).replace(/\\uE000/g, "") : null;');
const clause = t => ev('return claimLooksLikeClause(normalizeClaimText(' + J(t) + '));');

console.log('\n-- words --');
{
    const tags = ev(`var out = {}; ['the', 'and', 'raven', 'ravens', 'flies', 'left', 'black', 'quickly', 'increases', 'which'].forEach(function (w) {
        var x = claimSynWord(w); out[w] = Object.keys(x).filter(function (k) { return k !== 't' && k !== 'w' && x[k]; }).sort().join(' '); }); return out;`);
    ok(/\bdet\b/.test(tags.the) && /\bclosed\b/.test(tags.the) && !/\bnoun\b/.test(tags.the) && /\bconj\b/.test(tags.and) &&
        /\bnoun\b/.test(tags.raven) && !/\bverb\b/.test(tags.raven) && /\bplural\b/.test(tags.ravens) &&
        /\bverb\b/.test(tags.flies) && /\bpast\b/.test(tags.left) && /\badj\b/.test(tags.black) && /\badv\b/.test(tags.quickly) &&
        /\bnoun\b/.test(tags.increases) && /\bverb\b/.test(tags.increases) && /\brel\b/.test(tags.which),
        'a closed word is only what it is; an open word is what the lists and its ending allow ("increases" a noun or a verb)', J(tags));
}

console.log('\n-- subjects --');
{
    const cases = [
        ['Poe flies.', '[poe] flies'],
        ['Ravens fly.', '[ravens] fly'],
        ['Black ravens fly.', '[black ravens] fly'],
        ['Physical facts exist.', '[physical facts] exist'],
        ['God necessarily exists.', '[god] necessarily exists'],
        ['The black raven left.', '[the black raven] left'],
        ['The first raven left.', '[the first raven] left'],
        ["Mary's dog barked.", "[mary's dog] barked"],
        ['Clark Kent wears glasses.', '[clark kent] wears glasses'],
        ['Alice and Bob left.', '[alice and bob] left'],
        ['Neither Rex nor Fido flies.', '[neither rex nor fido] flies'],
        ['Both the raven and the crow fly.', '[both the raven and the crow] fly'],
        ['A series of lights and control circuitry can produce consciousness.', '[a series of lights and control circuitry] can produce consciousness'],
        ['The book on the table is red.', '[the book on the table] is red'],
        ['The man who left cried.', '[the man who left] cried'],
        ['The match, which was scheduled for noon, is canceled.', '[the match, which was scheduled for noon,] is canceled'],
        ['The fact that the vase is broken surprised Mary.', '[the fact that the vase is broken] surprised mary'],
        ['The price increases were large.', '[the price increases] were large'],
        ['The dog bites the man.', '[the dog] bites the man'],
        ['Mary told Alice she was late.', '[mary] told alice she was late'],
        ['We all think that Mary is tired.', '[we] all think that mary is tired'],
        ['The storm hit Mary.', '[the storm] hit mary'],
        ['Mary hurt herself.', '[mary] hurt herself']];
    const got = cases.map(([t]) => split(t));
    const wrong = cases.filter(([, want], i) => got[i] !== want).map(([t], i) => t + ' -> ' + got[cases.findIndex(c => c[0] === t)]);
    ok(!wrong.length, 'each subject ends where its verb group begins: names, pronouns, determiners and adjectives, possessives, "of", joined, relative clauses', J(wrong));
    ok(split('If Poe is a crow, then') === null && split('Far, nothing is known') === null,
        'a fragment that opens with no noun phrase has no subject by phrases (the old reading stands)');
}

console.log('\n-- what the reader does with them --');
{
    ok(key('Mary told Alice she was late.') === 'P:mary|~did told alice she was late' &&
        key('The black raven left.') === 'P:the black raven|~did left' &&
        key('The man who left cried.') === 'P:the man who left|~did cried' &&
        key('The fact that the vase is broken surprised Mary.') === 'P:the fact that the vase is broken|~did surprised mary',
        '"Mary told Alice she was late" is about Mary (it had been about "Mary told Alice she"); "the black raven" is a subject');
    ok(clause('The black raven left') && clause('The first raven left') && !clause('The black raven') && !clause('cried'),
        'a noun phrase and a verb group make a clause; a noun phrase alone, or a verb alone, does not');
    ok(key('The black raven left and then the dog cried.') === 'T[P:the black raven|~did left;P:the dog|~did cried]' &&
        key('The first raven left and the dog cried.') === 'C[P:the first raven|~did left;P:the dog|~did cried]' &&
        key('Mary saw the first raven and Bob cried.') === 'C[P:mary|~did saw the first raven;P:bob|~did cried]',
        'the r27.58 found, not fixed: "the black raven left and then the dog cried" and "the first raven left and the dog cried" are two claims each');
}

console.log('\n-- "the dog bites hurt" (r27.60) --');
{
    // The user: "Can you fix this?" -- an -s word that may be a plural noun ends
    // a longer subject where a verb that stands without an object follows it
    // ("hurt", "fail"); not where the next word is a noun as often as a verb.
    const got = ['The dog bites hurt.', 'The dog bites hurt Mary.', 'The dog bites often hurt.', 'The government plans fail.',
        'The dog loves play.', 'The woman fears change.', 'The dog bites the man.', 'The raven flies home.'].map(split);
    ok(J(got) === J(['[the dog bites] hurt', '[the dog bites] hurt mary', '[the dog bites] often hurt', '[the government plans] fail',
        '[the dog] loves play', '[the woman] fears change', '[the dog] bites the man', '[the raven] flies home']),
        'the phrases: "the dog bites hurt" may be the bites hurting; "the dog loves play", "the woman fears change", "the dog bites the man" keep their verbs', J(got));
    // r27.61 (the user: "ambiguous between 'Things that hurt are the dog bites'
    // ... and 'The dog hurts as it bites' ... a third reading, where 'hurt' is
    // taken as a noun ... flag it and give the reader options"): asked, with
    // three wordings, each read back as its reading. r27.62: the noun is what
    // the dog bites, as "we're fighting poverty" -- not "those who are hurt"
    // (the user).
    const bites = ev(`var t = 'The dog bites hurt.', n = parseClaimFull(t).notes.filter(function (x) { return x.kind === 'ambiguous'; })[0];
        return n ? [n.message, !!n.always].concat(n.readings.map(function (l, i) { var w = claimReadingWords(l, t); return claimReadingRoundTrips({ text: t, site: n.site }, i, w) ? w : 'NOT BACK: ' + w; })) : null;`);
    ok(J(bites) === J(['"hurt" may say what the bites do, how the dog is when it bites, or what it bites', true,
        "The dog's bites hurt.", 'The hurt dog bites.', 'Hurt is what the dog bites.']) &&
        key('The dog bites hurt Mary.') === 'P:the dog bites|~hurt mary' && key('The government plans fail.') === 'P:the government plans|~fail',
        '"the dog bites hurt" is asked: the bites hurt, the dog bites when hurt, or hurt is what it bites; "the dog bites hurt Mary" and "the government plans fail" are not', J(bites));
}

console.log('\n-- coordination (stage two) --');
{
    // Where an "and" or "or" joins clauses: where a noun phrase and a sure verb
    // begin in all that follows it -- not only up to the next "and".
    ok(key('Mary left and Bob and Ann cried.') === 'C[P:mary|~did left;C[P:bob|~did cried;P:ann|~did cried]]' &&
        key('Ravens fly and crows sing.') === 'C[P:ravens|~fly;P:crows|~sing]' &&
        key('Mary fed the dog and the cat purred.') === 'C[P:mary|~did fed the dog;P:the cat|~did purred]' &&
        key('Mary left and it surprised Bob.') === 'C[P:mary|~did left;P:the fact that mary left|~did surprised bob]' &&
        key('The vase is broken and the vase surprised Mary.') === 'C[P:the vase|=broken;P:the vase|~did surprised mary]',
        'clauses joined: "Mary left | Bob and Ann cried", "ravens fly | crows sing" (it had been ravens that "fly and crows sing"), "the cat purred"');
    // Not where a verb group, or a noun phrase with no verb of its own, follows.
    ok(key('Mary sings and dances.') === 'C[P:mary|~sing;P:mary|~dance]' &&
        key('Mary walked to the store and bought milk.') === 'C[P:mary|~did walked to the store;P:mary|~did bought milk]' &&
        key('Mary fed the dog and the cat.') === 'P:mary|~did fed the dog and the cat' &&
        key('Mary likes tea and coffee.') === 'P:mary|~like tea and coffee' &&
        key('Poe is black and small.') === 'C[P:poe|=black;P:poe|=small]',
        'verbs joined under one subject, and nouns or adjectives joined, stay in their clause');
    ok(key('The man who sings and dances left.') === 'P:the man who sings and dances|~did left' &&
        key('Mary neither sang nor danced.') === 'C[N(P:mary|~did sang);N(P:mary|~did danced)]',
        'the "and" of a relative clause stays in it ("the man who sings and dances"); "neither ... nor" joins verbs');
    // Joined subjects: a verb alone is said of each; bare plurals are generics, asked.
    const gen = ev(`var t = 'Ravens and crows fly.', n = parseClaimFull(t).notes.filter(function (x) { return x.generic; })[0], f = parseClaim(t);
        return { parts: f.parts.map(function (p) { return !!p.noIndividual; }), offers: n ? n.readings.map(function (l, i) { var w = claimReadingWords(l, t); return claimReadingRoundTrips({ text: t, site: n.site }, i, w) ? w : 'NOT BACK: ' + w; }) : null };`);
    ok(key('Mary and Bob sing.') === 'C[P:mary|~sing;P:bob|~sing]' && J(gen.parts) === J([true, true]) &&
        J(gen.offers) === J(['All ravens and crows fly.', 'Some ravens fly and some crows fly.', 'Most ravens fly and most crows fly.', 'Generally, ravens and crows fly.']),
        '"Mary and Bob sing" is said of each; "ravens and crows fly" names no individual, and is asked about as a generic, each reading read back', J(gen));
}

console.log('\n-- joins inside an object, "some", longer subjects (r27.61) --');
{
    // The user, of a premise in the zombie map: "I think it's syntactically
    // unambiguous." Adjectives joined before their noun, and nouns joined in the
    // clause after it, are inside the verb's object: nothing is split there.
    const said = 'We do not have widely accepted, or independently motivated, reasons that a series of lights and circuits cannot produce thought.';
    ok(key(said) === 'N(P:we|~have widely accepted or independently motivated reasons that series of lights and circuits can not produce thought)' &&
        ev(`var trees = [{ id: 'M', type: 'contention', texts: ['We cannot conclude that a series of lights and circuits cannot produce thought.'], collapsed: [], children: [
            { id: 'S', type: 'support', texts: ['If ' + ${J(said)}.charAt(0).toLowerCase() + ${J(said)}.slice(1, -1) + ', then we cannot conclude that a series of lights and circuits cannot produce thought.', ${J(said)}], collapsed: [], children: [] }] }];
            return deductiveStepTagText(collectDeductiveSteps(trees)[0]);`) === '\u2713 modus ponens',
        '"do not have widely accepted, or independently motivated, reasons that ... lights and circuits ...": one denied claim; modus ponens with it certifies');
    ok(key('Some ravens and crows are black.') === 'C[E:=raven|=black;E:=crow|=black]' &&
        key('Some ravens or crows are black.') === 'D[E:=raven|=black;E:=crow|=black]' &&
        key('The raven that Mary saw and the crow flew.') === 'C[P:the raven that mary saw|~did flew;P:the crow|~did flew]',
        '"some ravens and crows are black": some of each (the user); "the raven that Mary saw and the crow flew": both flew');
}

console.log('\n-- forms from the tree (stage three) --');
{
    // Verb phrases: split only where a verb group follows the "and".
    ok(key('Mary likes tea and coffee and hates milk.') === 'C[P:mary|~like tea and coffee;P:mary|~hate milk]' &&
        key('Mary saw Bob and Ann and left.') === 'C[P:mary|~did saw bob and ann;P:mary|~did left]' &&
        key('Mary likes cats and dogs.') === 'P:mary|~like cats and dogs',
        'verbs joined under one subject are split where a verb follows the "and", not inside an object ("tea and coffee")');
    // Joined subjects: where one whole noun phrase ends and the next begins.
    ok(key('Poe, Fido and Rex fly.') === 'C[P:poe|~fly;P:fido|~fly;P:rex|~fly]' &&
        key('Poe, Fido, and Rex fly.') === 'C[P:poe|~fly;P:fido|~fly;P:rex|~fly]' &&
        key('The man who sings and dances and his wife left.') === "C[P:the man who sings and dances|~did left;P:the man's wife|~did left]",
        '"Poe, Fido and Rex fly" is three claims (it had been "Poe fidos"); "the man who sings and dances and his wife": two who left');
    ok(key('R and it is not the case that Q') === 'C[A:r;N(A:q)]' &&
        /^T\[P:the senate\|~did closed;/.test(key('The Senate closed, and then it reopened.')) &&
        ev(`return parseClaimFull('Poe and Fido or Rex fly.').notes.some(function (n) { return n.kind === 'ambiguous' && /can group this two ways/.test(n.message); });`),
        'a clause before the "and" still ends there ("R and ...", "the Senate closed, and then ..."); "and" with "or" in a subject is still asked');
    // Quantifiers: the noun phrase after "every", "all", "some" ends where the
    // phrases end it -- relative clauses, with or without "that", phrases after
    // the noun, participles -- in the quantifier's number.
    const q = [
        ['Every man who loves Mary sings.', 'U:(=man&~love mary)|~sing'],
        ['All ravens that Mary saw fly.', 'U:(=raven&^mary|~did saw _)|~fly'],
        ['Every cat Mary fed left.', 'U:(=cat&^mary|~did fed _)|~did left'],
        ['All the books John wrote sold.', 'U:(=book&^john|~did wrote _)|~did sold'],
        ['Some students who took the test passed.', 'E:(=student&~did took the test)|~did passed'],
        ['Some people who eat meat smoke.', 'E:(=person&~eat meat)|~smoke'],
        ['No student who failed passed.', 'U:(=student&~did failed)|\u00ac~did passed'],
        ['Some women fear change.', 'E:=woman|~fear change'],
        ['Every dog bite hurts.', 'U:=dog bite|~hurt'],
        ['All city buses stop here.', 'U:=city bus|~stop here'],
        ['Every theory proposed so far has failed.', 'U:=theory proposed so far|~have failed'],
        ['Everyone Mary knows left.', 'U:(=person&^mary|~know _)|~did left'],
        ['Everything that Mary said is true.', 'U:^mary|~did said _|=true']];
    const qWrong = q.filter(([t, want]) => key(t) !== want).map(([t]) => t + ' -> ' + key(t));
    ok(!qWrong.length, 'a quantifier\'s noun phrase ends where its verb group begins: "every man who loves Mary | sings", "every cat Mary fed | left", "some people who eat meat | smoke"', J(qWrong));
    ok(!/^P:/.test(key('Some women fear change.')) && !/^P:/.test(key('No student who failed passed.')) && !/^P:/.test(key('Most students passed the test.')),
        'a quantifier\'s noun phrase names no one: "some women", "no student who failed" are never an individual\'s name');
    // r27.62's found, not fixed (the user: "Do all the other fixes that you noted").
    const same = [['All dogs in the park bark.', 'Every dog in the park barks.'], ['Some books on the table are red.', 'Some book on the table is red.'],
        ['All swans seen so far are white.', 'Every swan seen so far is white.'], ['All ravens observed were black.', 'Every raven observed was black.'],
        ['All friends of Mary left.', 'Every friend of Mary left.']];
    const differ = same.filter(([a, b]) => key(a) !== key(b)).map(([a, b]) => a + ' -> ' + key(a) + ' / ' + key(b));
    ok(!differ.length && key('All dogs in the park bark.') === 'U:=dog in the park|~bark',
        'a plural before a phrase, a participle or a clause names the same kind as the singular: "all dogs in the park", "every dog in the park"', J(differ));
    ok(key('Every student who reads books that Mary wrote passed.') === 'U:(=student&~read books that mary wrote)|~did passed',
        'a relative clause inside a relative clause\'s object is read with it: "every student who reads books that Mary wrote"');
    ok(key('All water flows downhill.') === 'U:=water|~flow downhill' && key('All matter occupies space.') === 'U:=matter|~occupy space' &&
        key('All music soothes the soul.') === 'U:=music|~soothe the soul' && key('All city buses stop here.') === 'U:=city bus|~stop here',
        '"all water flows downhill": where the phrases leave one place for the verb, it is there; "all city buses stop here" as before');
}

console.log('\n-- the pronoun analysis --');
{
    // Where a noun phrase after a determiner ends, the phrases say: "the price
    // increases" (before "were"); "the Beatles", "the Senate" (a capital after
    // "the" is a word of the phrase, not a name of its own).
    const pnotes = t => ev(`return parseClaimFull(${J(t)}).notes.map(function (n) { return n.kind + ': ' + n.message; });`);
    const price = pnotes('The price increases were large, and they surprised Mary.');
    const beatles = pnotes('The Beatles broke up, and then they reunited.');
    const senate = pnotes('The Senate closed, and then it reopened.');
    ok(price.some(n => /^unread: read with “they” as “the price increases”/.test(n)) &&
        beatles.some(n => /^unread: read with “they” as “the Beatles”/.test(n)) && !beatles.some(n => /^ambiguous/.test(n)) &&
        senate.some(n => /^ambiguous: “it” may be “the Senate” or what “The Senate closed” says/.test(n)),
        '"they" is "the price increases" (it had no referent), "they" is "the Beatles" (not "Beatles" too), and "it" after "the Senate closed" is asked about', J([price, beatles, senate]));
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
