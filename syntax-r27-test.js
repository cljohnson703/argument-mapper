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
// Semantic mode asks where a step turns on it, as these checks were written for
// ("Never ask" is the default since r27.207; the checks of the setting say which).
W.eval("state.logic = { base: 'standard', rules: { semantic: true } }; claimRulesCache = null;");
let passed = 0, failed = 0;
function ok(cond, label, detail) {
    if (cond) { passed++; console.log('  ✓ ' + label); }
    else { failed++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}
// A sentence's subject and the rest, as the phrases have it: "[the black raven] left".
const split = t => ev(`var b = claimSynBrackets(normalizeClaimText(${J(t)})); return b && b.replace(/\\uE000/g, '');`);
const key = t => ev('var f = parseClaim(' + J(t) + '); return f ? claimKey(f).replace(/\\uE000/g, "") : null;');
// Read exactly as written, nothing asked (r27.184: Semantic mode off): for
// checks of what the words give, where a box may be read more than one way.
const asWritten = f => {
    ev(`state.logic = { base: 'standard', rules: { semantic: false } }; deductiveCache.clear(); return 1;`);
    try { return f(); } finally { ev(`state.logic = { base: 'standard', rules: { semantic: true } }; deductiveCache.clear(); return 1;`); }
};
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
        // Since r27.139 two claims, the commas setting the clause off.
        ['The match, which was scheduled for noon, is canceled.', '[the match] was scheduled for noon, and the match is canceled'],
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
        asWritten(() => ev(`var trees = [{ id: 'M', type: 'contention', texts: ['We cannot conclude that a series of lights and circuits cannot produce thought.'], collapsed: [], children: [
            { id: 'S', type: 'support', texts: ['If ' + ${J(said)}.charAt(0).toLowerCase() + ${J(said)}.slice(1, -1) + ', then we cannot conclude that a series of lights and circuits cannot produce thought.', ${J(said)}], collapsed: [], children: [] }] }];
            return deductiveStepTagText(collectDeductiveSteps(trees)[0]);`)) === '\u2713 modus ponens',
        '"do not have widely accepted, or independently motivated, reasons that ... lights and circuits ...": one denied claim; modus ponens with it certifies, read as written ("cannot conclude" asks with Semantic mode on)');
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

console.log('\n-- the sweep after r27.62 --');
{
    const step = (ps, c) => ev(`var r = certifyStep(${J(ps)}.map(function (t) { return parseClaim(t); }), [parseClaim(${J(c)})], false); return r ? r.name : null;`);
    // r27.64: "sings" may take "Mary" too, so the box asks; a step that
    // follows either way is certified all the same (claimEveryReadingRule).
    ok(step(['Every raven arrives and loves Mary.'], 'Every raven loves Mary.') === 'conjunction elimination under \u2200' &&
        step(['Mary arrived and wrote a song.'], 'Mary arrived.') === 'conjunction elimination' &&
        step(['Every raven sings songs and loves Mary.'], 'Every raven loves Mary.') === 'conjunction elimination under \u2200',
        'verbs joined under a quantifier are read apart too: "every raven arrives and loves Mary" gives "every raven loves Mary"');
    ok(step(['Every raven washes and dries the dishes.'], 'Every raven washes.') === null && step(['Mary washes and dries the dishes.'], 'Mary washes.') === null &&
        step(['Mary washed and dried the dishes.'], 'Mary washed.') === null && step(['Every man likes tea and coffee.'], 'Every man likes tea.') === null &&
        key('Poe thinks and is wise') === 'C[P:poe|~think;P:poe|=wise]',
        'not where an object may be shared ("washes and dries the dishes"), or where no verb follows ("likes tea and coffee")');
    const sheep = ev(`return parseClaimFull('Poe gathered every sheep.').notes.map(function (n) { return n.message; }).join(' | ');`);
    ok(/those that were sheep then/.test(sheep), 'a message says "sheep", not "sheeps"', sheep);
}

console.log('\n-- an object that may be shared (r27.64) --');
{
    // The user, 2026-09-30, of "Mary washes and dries the dishes" read with the
    // dishes washed too: "We shouldn't let anything that isn't certain become
    // the only reading. It's still technically ambiguous."
    const asked = t => ev(`var r = parseClaimFull(${J(t)}); return { key: claimKey(r.form), notes: r.notes.filter(function (n) { return n.kind === 'ambiguous'; })
        .map(function (n) { return { message: n.message.replace(//g, ''), readings: n.readings.map(function (l) { return l.replace(//g, ''); }), shared: !!n.shared }; }) };`);
    const dishes = asked('Mary washes and dries the dishes.'), past = asked('Mary washed and dried the dishes.'), ing = asked('Mary is washing and drying the dishes.');
    ok(dishes.key === 'A:mary washes and dries the dishes' && dishes.notes.length === 1 && dishes.notes[0].shared &&
        dishes.notes[0].message === '"the dishes" may go with "washes" as well as "dries", or with "dries" alone' &&
        J(dishes.notes[0].readings) === J(['mary washes, and dries, the dishes', 'mary washes, and mary dries the dishes']) &&
        past.notes.length === 1 && ing.notes.length === 1 && J(ing.notes[0].readings) === J(['mary is washing, and drying, the dishes', 'mary is washing, and mary is drying the dishes']),
        '"Mary washes and dries the dishes" is asked, and read no way till then: the dishes washed too, or "washes" alone -- so in the past, and with "is washing"', J([dishes, past, ing]));
    const quant = asked('Every raven washes and dries the dishes.'), some = asked('Some raven washes and dries the dishes.'), bob = asked('Mary sings and loves Bob.');
    ok(J(quant.notes[0].readings) === J(['every raven washes, and dries, the dishes', 'every raven washes, and every raven dries the dishes']) &&
        J(some.notes[0].readings) === J(['some raven washes, and dries, the dishes', 'some raven that washes dries the dishes']) &&
        J(bob.notes[0].readings) === J(['mary sings, and loves, bob', 'mary sings, and mary loves bob']),
        'under "every" the subject is said again; under "some", where it cannot be, the verb standing alone is said of it in a relative clause', J([quant, some, bob]));
    // Each reading, written out as the chooser writes it, reads back as that
    // reading and asks nothing more.
    const back = ev(`return ['Mary washes and dries the dishes.', 'Mary washed and dried the dishes.', 'Every raven washes and dries the dishes.', 'Some raven washes and dries the dishes.',
        'No raven washes and dries the dishes.', 'Mary is kind and loyal to Bob.', 'Mary is a friend and admirer of Bob.', 'Mary washes up and dries the dishes.'].map(function (t) {
        var n = parseClaimFull(t).notes.filter(function (x) { return x.kind === 'ambiguous'; })[0];
        return n ? n.readings.map(function (l, i) { var w = claimReadingWords(l, t); return claimReadingRoundTrips({ text: t, site: n.site }, i, w) ? w : 'NOT BACK: ' + w; }) : null;
    });`);
    ok(back.every(a => a && a.length === 2 && a.every(w => !/^NOT BACK/.test(w))) && back[0][1] === 'Mary washes, and Mary dries the dishes.',
        'each reading, written out, reads back as that reading and asks nothing more ("Mary washes, and Mary dries the dishes.")', J(back));
    ok(key('Mary arrived and ate the cake.') === 'C[P:mary|~did arrived;P:mary|~did ate the cake]' &&
        key('Mary likes and admires Bob.') === 'C[P:mary|~like bob;P:mary|~admire bob]' &&
        key('Mary likes and Bob hates the dishes.') === 'C[P:mary|~like the dishes;P:bob|~hate the dishes]' &&
        key('Some raven likes and admires Mary.') === 'E:=raven|~like mary and admires mary' &&
        key('Mary sang and danced in the hall.') === 'C[P:mary|~did sang;P:mary|~did danced in the hall]' &&
        key('Mary washes, and Mary dries the dishes.') === 'C[P:mary|~wash;P:mary|~dry the dishes]',
        'not asked where the verb before takes no object ("arrived"), or cannot stand without one ("likes": Bob is liked too, as in "Mary likes and Bob hates the dishes"), nor for a place after them');
    const kind = asked('Mary is kind and loyal to Bob.'), friend = asked('Mary is a friend and admirer of Bob.');
    ok(J(kind.notes[0].readings) === J(['mary is kind, and loyal, to bob', 'mary is kind, and mary is loyal to bob']) &&
        J(friend.notes[0].readings) === J(['mary is a friend, and an admirer, of bob', 'mary is a friend, and mary is an admirer of bob']) &&
        key('Mary is tall and afraid of the dark.') === 'C[P:mary|=tall;P:mary|=afraid of the dark]' &&
        key('Mary is kind to Bob and loyal to Bob.') === 'C[P:mary|=kind to bob;P:mary|=loyal to bob]' &&
        key('Poe is between Fido and Rex.') === 'P:poe|=between fido and rex',
        'after "is": "kind and loyal to Bob", "a friend and admirer of Bob" are asked; "tall and afraid of the dark" is not ("tall" takes no such phrase)', J([kind, friend]));
    const every = (ps, c) => ev(`var r = claimEveryReadingRule(${J(ps)}, ${J(c)}, false, false); return r ? r.name : null;`);
    ok(every(['Mary sings and loves Bob.'], 'Mary loves Bob.') === 'conjunction elimination' &&
        every(['Every raven washes and dries the dishes.'], 'Every raven dries the dishes.') === 'conjunction elimination under \u2200' &&
        every(['Mary is kind and loyal to Bob.'], 'Mary is loyal to Bob.') === 'conjunction elimination' &&
        every(['Mary sings and loves Bob.'], 'Mary sings.') === null && every(['Mary sang and wrote a song.'], 'Mary sang.') === null,
        'a step that follows on every reading is certified, none chosen ("so Mary loves Bob"); one that follows on only one waits for the answer ("so Mary sings")');
    const tag = (ps, c) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return st ? { rule: st.rule ? st.rule.name : null, tag: deductiveStepTagText(st), asked: (st.why && st.why.ambiguous || []).map(function (a) { return a.readings.length; }), why: st.why ? st.why.text : '' } : null;`);
    const yes = tag(['Mary sings and loves Bob.'], 'Mary loves Bob.'), wait = tag(['Mary sings and loves Bob.'], 'Mary sings.');
    const yesOff = asWritten(() => tag(['Mary sings and loves Bob.'], 'Mary loves Bob.')), waitOff = asWritten(() => tag(['Mary sings and loves Bob.'], 'Mary sings.'));
    // r27.200: "so Mary loves Bob" follows on both readings, which are all
    // one can choose, and asks nothing (the box as written had held it).
    ok(yes && yes.rule === 'conjunction elimination' && !yes.asked.length && wait && !wait.rule && J(wait.asked) === '[2]' && yesOff && yesOff.rule === 'conjunction elimination' && waitOff && !waitOff.rule &&
        waitOff.why === 'On another reading of its words, the step follows: set Semantic mode to “Ask where a step turns on it” in the Logic panel to choose that reading.',
        'on the map, with Semantic mode on, "so Mary sings" offers the two readings, where the step turns on them; "so Mary loves Bob" follows on both and asks nothing (r27.200); as written, "so Mary loves Bob" is certified and "so Mary sings" is not, and it says that read another way it would', J([yes, wait, yesOff, waitOff]));
}

console.log('\n-- misreadings found beside it (r27.64) --');
{
    const step = (ps, c) => ev(`var r = certifyStep(${J(ps)}.map(function (t) { return parseClaim(t); }), [parseClaim(${J(c)})], false); return r ? r.name : null;`);
    ok(key('Mary loves music and dance.') === 'P:mary|~love music and dance' && step(['Mary loves music and dance.'], 'Mary dances.') === null &&
        step(['Every raven loves music and dance.'], 'Every raven dances.') === null && step(['Mary fears change and hope.'], 'Mary hopes.') === null &&
        key('Mary loves Bob and fear.') === 'P:mary|~love bob and fear' && key('Poe loves art and sings.') === 'C[P:poe|~love art;P:poe|~sing]',
        'after a verb in -s a plain word is no verb: "Mary loves music and dance" does not give "Mary dances" (it had)');
    ok(key('Some raven arrives and loves Mary.') === 'E:=raven|~arrive and loves mary' && !/love\|/.test(key('No raven sings and dances.')),
        '"some raven arrives and loves Mary" joins two verbs, not "some raven" and "loves" (it had read "some loves Mary")', key('Some raven arrives and loves Mary.'));
    ok(key('The raven that washes and dries the dishes flies.') === 'P:the raven that washes and dries the dishes|~fly',
        '"the raven that washes and dries the dishes flies" has one subject (it had two: "the raven that washes" and "dries the dishes")');
    ok(key('Every raven that sings dries the dishes.') === 'U:(=raven&~sing)|~dry the dishes' &&
        key('Every raven that sees Mary dries the dishes.') === 'U:(=raven&~see mary)|~dry the dishes' &&
        key('Some raven that washes owns a bakery.') === 'E:(=raven&~wash)|~own bakery',
        '"every raven that sings | dries the dishes": no verb just after "the" (it had read "dishes" as the verb)');
    ok(key('No mere series of flashing lights and control circuitry can produce consciousness.') === 'U:=mere series of flashing lights and control circuitry|¬~can produce consciousness' &&
        key('Water boils and ice melts.') === 'C[P:water|~boil;P:ice|~melt]' && key('The house of cards fell and Bob laughed.') === 'C[P:the house of cards|~did fell;P:bob|~did laughed]',
        '"no series of lights and circuitry can produce consciousness" has one subject: its "and" is inside "of ..." (it had split there)');
    ok(step(['Every raven is tall and afraid of the dark.'], 'Every raven is tall.') === 'conjunction elimination under ∀' &&
        step(['Every raven is kind to Bob and loyal to Bob.'], 'Every raven is loyal to Bob.') === 'conjunction elimination under ∀' &&
        step(['Every raven is taller than Fido and Rex.'], 'Every raven is Rex.') === null && step(['Every raven is fond of cats and dogs.'], 'Every raven is dogs.') === null,
        'under "every", joined predicates with a phrase of their own are read apart ("tall and afraid of the dark"); the other object of a relation is not ("taller than Fido and Rex")');
    // r27.65 (the user, 2026-09-30): asked across clauses too, and commas say which.
    ok(key('Mary runs and Bob owns the bakery.') === 'A:mary runs and bob owns the bakery' &&
        key('Mary runs, and Bob owns, the bakery.') === 'C[P:mary|~run the bakery;P:bob|~own the bakery]' &&
        key('Mary runs, and Bob owns the bakery.') === 'C[P:mary|~run;P:bob|~own the bakery]' &&
        key('Mary likes and Bob hates the dishes.') === 'C[P:mary|~like the dishes;P:bob|~hate the dishes]',
        'across two clauses the object is asked about, and the user\'s commas settle it: "Mary runs, and Bob owns, the bakery" (she runs it), "Mary runs, and Bob owns the bakery" (she just runs)');
    const toast = ev(`var said = null, was = showHintToast; showHintToast = function (m) { said = m; };
        try { state.trees = [{ id: 'P', type: 'contention', texts: ['Mary washes and dries the dishes.'], collapsed: [], children: [] }]; deriveParentFor('P'); } finally { showHintToast = was; }
        return said;`);
    ok(/can be read more than one way: .the dishes. may go with .washes./.test(String(toast).replace(//g, '')),
        'Derive Parent on a box that asks says so, not that nothing follows', toast);
    ok(key('Poe is a lover of cats.') === 'P:poe|=lover of cats' && key('Mary is washing the dishes.') === 'P:mary|=washing the dishes' &&
        step(['All lovers of cats are kind.', 'Poe is a lover of cats.'], 'Poe is kind.') === 'universal modus ponens' &&
        step(['Mary is washing the dishes.'], 'Mary is washing the dish.') === null,
        'a noun inside a term keeps its number: "a lover of cats", "washing the dishes" (it had been "the dish")');
}

console.log('\n-- commas, places and times, clauses (r27.65) --');
{
    // The user, 2026-09-30: "the disambiguation can be performed with commas.
    // 'Mary sang, and danced, in the hall' means she did both in the hall;
    // 'Mary sang, and she danced in the hall' means she only danced in the
    // hall. 'Mary runs, and Bob owns, the bakery' means Mary runs the bakery,
    // and Bob owns it; 'Mary runs, and Bob owns the bakery' doesn't mean that
    // Mary runs the bakery; she just runs."
    ok(key('Mary sang, and danced, in the hall.') === 'C[P:mary|~did sang in the hall;P:mary|~did danced in the hall]' &&
        key('Mary sang, and she danced in the hall.') === 'C[P:mary|~did sang;P:mary|~did danced in the hall]' &&
        key('Mary runs, and Bob owns, the bakery.') === 'C[P:mary|~run the bakery;P:bob|~own the bakery]' &&
        key('Mary runs, and Bob owns the bakery.') === 'C[P:mary|~run;P:bob|~own the bakery]',
        'the user\'s four examples read as the user said: a comma after the second verb for both, one before the "and" alone');
    ok(key('Mary washes, and dries, the dishes.') === 'C[P:mary|~wash the dishes;P:mary|~dry the dishes]' &&
        key('Mary is kind, and loyal, to Bob.') === 'C[P:mary|=kind to bob;P:mary|=loyal to bob]',
        'so with one subject, and after "is": a comma after the last verb as well, for both');
    const asked = t => ev(`var r = parseClaimFull(${J(t)}); return { key: claimKey(r.form).replace(/\uE000/g, ''), notes: r.notes.filter(function (n) { return n.kind === 'ambiguous'; })
        .map(function (n) { return { message: n.message.replace(/\uE000/g, ''), readings: n.readings.map(function (l) { return l.replace(/\uE000/g, ''); }), always: !!n.always }; }) };`);
    // The user, 2026-09-30, of r27.65 reading "Mary washes, and dries the
    // dishes" as the last alone: "That shouldn't count as a complete
    // sentence. It's supposed to be two independent clauses, I think, i.e.,
    // 'Mary washes, and she dries the dishes.'" (r27.66)
    const oneComma = ['Mary washes, and dries the dishes.', 'Every raven washes, and dries the dishes.', 'Some raven washes, and dries the dishes.',
        'Mary is kind, and loyal to Bob.', 'Mary sang, and danced in the hall.'].map(t => [asked(t), asked(t.replace(', and ', ' and '))]);
    ok(oneComma.every(([a, b]) => a.notes.length === 1 && J(a.notes) === J(b.notes) && a.key.replace(/,/g, '') === b.key.replace(/,/g, '')),
        'one comma before the "and" under one subject settles nothing: asked, as with none (the dishes, under "every" and "some", after "is", a place)', J(oneComma));
    ok(key('Mary washes, and she dries the dishes.') === 'C[P:mary|~wash;P:mary|~dry the dishes]' &&
        key('Every raven washes, and every raven dries the dishes.') === 'C[U:=raven|~wash;U:=raven|~dry the dishes]' &&
        key('Mary is kind, and she is loyal to Bob.') === 'C[P:mary|=kind;P:mary|=loyal to bob]',
        'two clauses, each with its subject, read the last alone, as the user wrote it ("Mary washes, and she dries the dishes")');
    const hall = asked('Mary sang and danced in the hall.'), bakery = asked('Mary runs and Bob owns the bakery.');
    ok(hall.key === 'C[P:mary|~did sang;P:mary|~did danced in the hall]' && hall.notes.length === 1 && hall.notes[0].always &&
        hall.notes[0].message === '"in the hall" may go with "sang" as well as "danced", or with "danced" alone' &&
        J(hall.notes[0].readings) === J(['mary sang, and danced, in the hall', 'mary sang, and mary danced in the hall']),
        'a place after two verbs is asked about -- with Semantic mode on, every time (r27.184); meanwhile the box says what both readings say', J(hall));
    // r27.185 (the user, of "Some ravens fly and crows generally sing":
    // "Adding 'generally' in front of 'crows sing' doesn't seem to turn two
    // claims ... into one"): an adverb before the verb is no verb.
    const adverb = ev(`return ['Ravens fly and dogs generally bark.', 'Mary sings and generally dances.', 'Poe flies and Bob apparently sings.', 'Mary sings and generally dances the tango.'].map(function (t) {
        var r = parseClaimFull(t); return [claimKey(r.form).replace(/\\uE000/g, ''), r.notes.filter(function (n) { return n.kind === 'ambiguous' && / may go with /.test(n.message); }).map(function (n) { return n.message.replace(/\\uE000/g, ''); })]; });`);
    ok(adverb[0][0] === 'C[P:ravens|~fly;A:generally, dogs bark]' && !adverb[0][1].length && adverb[1][0] === 'C[P:mary|~sing;P:mary|~generally dance]' && !adverb[1][1].length &&
        adverb[2][0] === 'C[P:poe|~fly;A:apparently, bob sings]' && !adverb[2][1].length &&
        J(adverb[3][1]) === J(['"the tango" may go with "sings" as well as "dances", or with "dances" alone']),
        '"and dogs generally bark", "and generally dances", "and Bob apparently sings": two claims -- "generally" is no verb, nor "bark" its object (they had been one claim, asking whether "bark" went with "fly"); "and generally dances the tango" asks of "the tango"', J(adverb));
    // r27.187 (the syntax tree, stage two: "Which older pattern tests can we
    // safely replace with the syntax tree's decisions?"): a verb group with
    // nothing before it that could be its subject begins no clause, as the
    // tree has it; adverbs joined before a verb are one manner in its group;
    // a word in -s with an object after it is a verb.
    const tree = ev(`return { clause: ['quickly left the room', 'is laid out', 'happily sings', 'carefully dries the dishes', 'Mary washes', 'Never has Bob lied'].map(function (t) { return claimLooksLikeClause(t); }),
        keys: ['Bob arrived and quickly left the room.', 'Mary quickly and quietly left the room.', 'Mary visited rooms A, B, and C.'].map(function (t) { return claimKey(parseClaim(t)).replace(/\\uE000/g, ''); }),
        asked: ['Bob washes and carefully dries the dishes.', 'Bob carefully washes and dries the dishes.'].map(function (t) {
            return parseClaimFull(t).notes.filter(function (n) { return n.kind === 'ambiguous'; }).map(function (n) { return n.message.replace(/\\uE000/g, ''); }); }) };`);
    ok(J(tree.clause) === J([false, false, false, false, true, true]) &&
        J(tree.keys) === J(['C[P:bob|~did arrived;P:bob|~did quickly left the room]', 'P:mary|~did quickly and quietly left the room', 'P:mary|~did visited rooms a b and c']) &&
        J(tree.asked) === J([['"the dishes" may go with "washes" as well as "dries", or with "dries" alone'], ['"the dishes" may go with "carefully washes" as well as "dries", or with "dries" alone']]),
        'a verb group with no subject before it is no clause ("quickly left the room", "is laid out"); so "Bob arrived and quickly left the room" is two claims, "Mary quickly and quietly left the room" one, said of Mary, and "Bob washes and carefully dries the dishes" asks of "the dishes", as "Bob carefully washes and dries the dishes" does -- "carefully" had been a subject (r27.187)', J(tree));
    // r27.188 (the user, of "Bob washes, and carefully dries, the dishes":
    // "'the dishes' goes with both verbs"): the commas say so, an adverb
    // before the second verb as well; and a past past its adverbs keeps its
    // "did", as the same words do after "and".
    const commas = ev(`return ['Bob washes, and carefully dries, the dishes.', 'Bob washed, and carefully dried, the dishes.', 'Bob quickly cried.', 'Bob left and quickly cried.'].map(function (t) { return claimKey(parseClaim(t)).replace(/\\uE000/g, ''); });`);
    ok(J(commas) === J(['C[P:bob|~wash the dishes;P:bob|~carefully dry the dishes]', 'C[P:bob|~did washed the dishes;P:bob|~did carefully dried the dishes]', 'P:bob|~did quickly cried', 'C[P:bob|~did left;P:bob|~did quickly cried]']),
        '"Bob washes, and carefully dries, the dishes": the dishes go with both verbs, as the commas say (it had been one claim), in the past too; "Bob quickly cried" keeps the past, as "Bob left and quickly cried" does (r27.188)', J(commas));
    ok(bakery.key === 'A:mary runs and bob owns the bakery' && bakery.notes.length === 1 &&
        J(bakery.notes[0].readings) === J(['mary runs, and bob owns, the bakery', 'mary runs, and bob owns the bakery']),
        'an object after two clauses is asked about, its readings in the user\'s commas', J(bakery));
    const times = ev(`return [claimKey(parseClaim('Mary arrived and left Monday.')), parseClaimFull('Mary arrived and left Monday.').notes.filter(function (n) { return n.kind === 'ambiguous'; }).length,
        claimKey(parseClaim('Mary sang and danced in her dreams.')), claimKey(parseClaim('Mary sang and danced if she was asked.')),
        claimKey(parseClaim('Mary arrived and ate the cake.'))];`).map(x => typeof x === 'string' ? x.replace(/\uE000/g, '') : x);
    ok(times[0] === 'C[P:mary|~did arrived;P:mary|~did left monday]' && times[1] === 1 && /^A:/.test(times[2]) && /^A:/.test(times[3]) &&
        times[4] === 'C[P:mary|~did arrived;P:mary|~did ate the cake]',
        'a time asks too ("left Monday"); a phrase that can take back what the verb says ("in her dreams", "if she was asked") is read no way meanwhile; an object after "arrived" is still no question', J(times));
    const tag = (ps, c) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return st ? { rule: st.rule ? st.rule.name : null, asked: (st.why && st.why.ambiguous || []).map(function (a) { return a.readings.length; }) } : null;`);
    const sang = tag(['Mary sang and danced in the hall.'], 'Mary sang.'), inHall = tag(['Mary sang and danced in the hall.'], 'Mary sang in the hall.');
    const risky = tag(['If Mary sang and danced in the hall, then the party was fun.', 'Mary sang, and Mary danced in the hall.'], 'The party was fun.');
    const owns = tag(['Mary runs and Bob owns the bakery.'], 'Bob owns the bakery.'), runs = tag(['Mary runs and Bob owns the bakery.'], 'Mary runs.');
    const sangOff = asWritten(() => tag(['Mary sang and danced in the hall.'], 'Mary sang.')), ownsOff = asWritten(() => tag(['Mary runs and Bob owns the bakery.'], 'Bob owns the bakery.'));
    ok(sang && !sang.rule && J(sang.asked) === '[2]' && inHall && !inHall.rule && J(inHall.asked) === '[2]' && risky && !risky.rule && J(risky.asked) === '[2]' && sangOff && sangOff.rule === 'conjunction elimination',
        'on the map, with Semantic mode on, "so Mary sang", "so Mary sang in the hall" and the "if" step that needs the hall for "danced" each ask, every time (r27.184); as written, "so Mary sang" passes', J([sang, inHall, risky, sangOff]));
    ok(owns && owns.rule === 'conjunction elimination' && !owns.asked.length && runs && !runs.rule && J(runs.asked) === '[2]' && ownsOff && ownsOff.rule === 'conjunction elimination',
        '"so Mary runs" asks, with Semantic mode on; "so Bob owns the bakery" follows on every reading, and asks nothing (r27.200); as written, it passes', J([owns, runs, ownsOff]));
    const back = ev(`return ['Mary sang and danced in the hall.', 'Mary runs and Bob owns the bakery.', 'Mary washes and dries the dishes.', 'Mary arrived and left Monday.',
        'Mary washes, and dries the dishes.'].map(function (t) {
        var n = parseClaimFull(t).notes.filter(function (x) { return x.kind === 'ambiguous'; })[0];
        return n ? n.readings.map(function (l, i) { var w = claimReadingWords(l, t); return claimReadingRoundTrips({ text: t, site: n.site }, i, w) ? w : 'NOT BACK: ' + w; }) : null;
    });`);
    ok(back.every(a => a && a.length === 2 && a.every(w => !/^NOT BACK/.test(w))) && back[0][0] === 'Mary sang, and danced, in the hall.',
        'each reading, written with commas, reads back as itself ("Mary sang, and danced, in the hall.")', J(back));
}

{
    const cond = ev(`return ['Poe flies, and sings, if it rains.', 'Poe flies, and sings if it rains.', 'Poe flies and sings if it rains.'].map(function (t) {
        var r = parseClaimFull(t); return claimKey(r.form).replace(/\uE000/g, '') + ' ' + r.notes.filter(function (n) { return n.kind === 'ambiguous'; })
            .map(function (n) { return n.readings.join(' | '); }).join(' ; ').replace(/\uE000/g, ''); });`);
    const readings = 'if it rains, then poe flies and sings | poe flies, and if it rains, then poe sings';
    ok(cond[0] === 'I(P:it|~rain>C[P:poe|~fly;P:poe|~sing]) ' && cond[1] === 'A:poe flies, and sings if it rains ' + readings && cond[2] === 'A:poe flies and sings if it rains ' + readings,
        'an "if" after two verbs: both, with a comma before the "and" and one before the "if"; asked with one comma (r27.66), as with none, the same readings', JSON.stringify(cond));
}

console.log('\n-- a condition after two clauses: the user\'s commas (r27.66) --');
{
    // The user, 2026-09-30, of "Poe flies, and he sings if it rains": "the
    // only (correct) reading with just one comma is that only the singing
    // depends on rain. With two commas, the 'he' is redundant and should be
    // removed, but both seem to depend on rain (I can't see another reading)."
    const last = 'C[P:poe|~fly;I(P:it|~rain>P:poe|~sing)]', both = 'I(P:it|~rain>C[P:poe|~fly;P:poe|~sing])';
    ok(key('Poe flies, and he sings if it rains.') === last && key('Poe flies, and Fido sings if it rains.') === 'C[P:poe|~fly;I(P:it|~rain>P:fido|~sing)]' &&
        key('Poe flies, and he sings, if it rains.') === both && key('Poe flies, and sings, if it rains.') === both,
        'one comma, before the "and": only the singing depends on rain; one before the "if" as well: both do (with "he" or without)');
    ok(key('Poe flies, or he sings if it rains.') === 'D[P:poe|~fly;I(P:it|~rain>P:poe|~sing)]' && key('Poe flies, or he sings, if it rains.') === 'I(P:it|~rain>D[P:poe|~fly;P:poe|~sing])' &&
        key('Poe flies, and he sings unless it rains.') === 'C[P:poe|~fly;D[P:poe|~sing;P:it|~rain]]' && key('Poe flies, and he sings only if it rains.') === 'C[P:poe|~fly;I(P:poe|~sing>P:it|~rain)]',
        'so with "or", "unless" and "only if"');
    const still = ['Poe flies and he sings if it rains.', 'Poe flies, and sings if it rains.', 'It is not the case that Poe flies, and he sings if it rains.', 'Poe flies, Fido barks, and he sings if it rains.']
        .map(t => ev(`var r = parseClaimFull(${J(t)}); return { key: claimKey(r.form).replace(/\uE000/g, ''), asks: r.notes.filter(function (n) { return n.kind === 'ambiguous'; }).length };`));
    ok(still.every(r => /^A:/.test(r.key) && r.asks >= 1),
        'still asked: no comma; one comma under one subject; a denial in front; three clauses', J(still));
    // ", but" kept its comma no more than it kept "but": "but" is "and", its comma kept.
    ok(key('Poe flies, but Fido sings if it rains.') === 'C[P:poe|~fly;I(P:it|~rain>P:fido|~sing)]' && key('Mary runs, but Bob owns the bakery.') === 'C[P:mary|~run;P:bob|~own the bakery]' &&
        key('Poe flies, but Fido sings or Rex barks.') === 'C[P:poe|~fly;D[P:fido|~sing;P:rex|~bark]]' && /^A:/.test(key('Poe flies but Fido sings or Rex barks.')),
        '"but" keeps its comma, as "and" does: "Poe flies, but Fido sings if it rains"; "Poe flies, but Fido sings or Rex barks" (it had asked, the comma dropped)');
}

console.log('\n-- found beside it: a condition after "and"; a place after past verbs (r27.66) --');
{
    // "Poe flies, and if it rains, Poe sings" had been read "if it rains Poe
    // sings, then Poe flies and" (since r27.49 at least).
    const c = 'C[P:poe|~fly;I(P:it|~rain>P:poe|~sing)]';
    ok(key('Poe flies, and if it rains, Poe sings.') === c && key('Poe flies and if it rains, Poe sings.') === c && key('Poe flies, but if it rains, Poe sings.') === c &&
        key('Poe flies, or if it rains, Poe sings.') === 'D[P:poe|~fly;I(P:it|~rain>P:poe|~sing)]' && key('Poe flies, and if it rains, then Poe sings.') === c,
        'a condition after "and", "but" or "or" is its own clause\'s ("Poe flies, and if it rains, Poe sings")');
    const front = ['It is not the case that Poe flies, and if it rains, Poe sings.', 'It is not the case that Poe flies, and if it rains, then Poe sings.',
        'Probably Poe flies, and if it rains, Poe sings.', 'Mary knows that Poe flies, and if it rains, then Poe sings.'].map(t => ev(`
        var r = parseClaimFull(${J(t)}); return { key: claimKey(r.form).replace(/\uE000/g, ''), asks: r.notes.filter(function (n) { return n.kind === 'ambiguous' && n.always; }).length };`));
    ok(front.every(r => /^A:/.test(r.key) && r.asks === 1),
        'where what comes first may take in the rest -- a denial in front, "probably", a that-clause -- it is asked (with "then" it had been read as the first clause\'s alone)', J(front));
    ok(key('Poe flies and, if it rains, sings.') === c && key('Every raven flies and, if it rains, sings.') === 'C[U:=raven|~fly;I(P:it|~rain>U:=raven|~sing)]' &&
        /^A:/.test(key('Some raven flies and, if it rains, sings.')),
        '"and, if it rains, sings": the last verb\'s, its subject said again (so under "every"); under "some" it cannot be, and is not read');
    const three = ['Poe flies, and if it rains, Poe sings, and Fido barks.', 'Bob runs, and if Mary runs, then Bob runs, and Fido barks.'].map(t => ev(`
        var r = parseClaimFull(${J(t)}), n = r.notes.filter(function (x) { return x.kind === 'ambiguous'; })[0];
        return { key: claimKey(r.form).replace(/\uE000/g, ''), readings: n ? n.readings.map(function (l, i) { var w = claimReadingWords(l, ${J(t)});
            return (claimReadingRoundTrips({ text: ${J(t)}, site: n.site }, i, w) ? '' : 'NOT BACK: ') + w; }) : null };`));
    ok(three.every(r => /^A:/.test(r.key) && r.readings && r.readings.length === 2 && r.readings.every(w => !/^NOT BACK/.test(w))) &&
        three[0].readings[0] === 'Poe flies, and if it rains, then both Poe sings and Fido barks.' &&
        three[0].readings[1] === 'Poe flies, Fido barks, and if it rains, then Poe sings.',
        'a list after the condition: the box asks whether the condition takes in its last part, read no way meanwhile, each reading the whole box and reading back', J(three));
    const tag = (ps, cc) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(cc)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return st ? { rule: st.rule ? st.rule.name : null, asked: (st.why && st.why.ambiguous || []).map(function (a) { return a.readings.length; }) } : null;`);
    const barks = tag(['Bob runs, and if Mary runs, then Bob runs, and Fido barks.'], 'Fido barks.');
    ok(barks && !barks.rule && J(barks.asked) === '[2]',
        '"so Fido barks" asks: on one reading Fido barks only if Mary runs (it had passed, by conjunction elimination)', J(barks));
    // r27.65 asked of "sang and danced in the hall" in the main clause, but
    // past verbs elsewhere (a relative clause) still had the place said of each.
    const step = (ps, cc) => ev(`var r = certifyStep(${J(ps)}.map(function (t) { return parseClaim(t); }), [parseClaim(${J(cc)})], false); return r ? r.name : null;`);
    ok(ev(`return claimVerbPieces('~did sang and danced in the hall') === null && claimVerbPieces('~did sang and danced') !== null && claimVerbPieces('~did liked and admired bob') !== null;`) &&
        step(['Some raven that sang and danced in the hall is black.'], 'Some raven that sang in the hall is black.') === null,
        'past verbs with a place after them are not said of each ("some raven that sang and danced in the hall" no longer gives "some raven that sang in the hall")');
    ok(key('Mary sings, and dances, in the hall.') === 'C[P:mary|~sing in the hall;P:mary|~dance in the hall]' &&
        key('Mary sang, and danced, in the hall.') === 'C[P:mary|~did sang in the hall;P:mary|~did danced in the hall]' &&
        key('Mary went, and stayed, in the hall.') === 'C[P:mary|~did went in the hall;P:mary|~did stayed in the hall]',
        'the user\'s commas put the place after each verb, present or past ("Mary sings, and dances, in the hall" had been one predicate, "sing and dances in the hall")');
    ok(ev(`return claimShowForm({ kind: 'pred', term: 'poe', prop: '~did sang and danced in the hall' }) === 'poe sang and danced in the hall' &&
        claimShowForm({ kind: 'pred', term: 'poe', prop: '~did did well' }) === 'poe did well';`),
        'a past verb is shown as written ("Poe sang and danced in the hall", not "Poe did sang ...")');
}

console.log('\n-- the r27.68 sweep --');
{
    // "Poe is black and flies" had been "Poe is black, and Poe is a fly".
    ok(key('Poe is black and flies.') === 'C[P:poe|=black;P:poe|~fly]' && key('Poe is black or flies.') === 'D[P:poe|=black;P:poe|~fly]' &&
        key('Poe is a raven and loves Mary.') === 'C[P:poe|=raven;P:poe|~love mary]' && key('Ravens are black and fly.').startsWith('C[P:ravens|=black;P:ravens|~fly]') &&
        key('Poe is black and tired.') === 'C[P:poe|=black;P:poe|=tired]' && key('Poe is loved and admired.') === 'C[P:poe|=loved;P:poe|=admired]',
        'a verb after "is ... and" is the subject\'s own ("Poe is black and flies": it had been "Poe is a fly"); "is black and tired" keeps its "is"');
    ok(key('Every raven is black and flies.') === 'C[U:=raven|=black;U:=raven|~fly]' && key('Every raven is black or flies.') === 'U:(=raven&¬=black)|~fly' &&
        key('Some raven is black and flies.') === 'E:(=raven&=black)|~fly' && key('Some raven is black or flies.') === 'D[E:=raven|=black;E:=raven|~fly]' &&
        key('No raven is black and flies.') === 'U:(=raven&=black)|¬~fly' && key('No raven is black or flies.') === 'C[U:=raven|¬=black;U:=raven|¬~fly]',
        'so under "every", "some" and "no", with "and" and with "or" (it had been one predicate, "is black and fly")');
    ok(/^A:/.test(key('Every raven is black and then flies.')) && !ev(`return parseClaimFull('Every raven is black and then flies.').notes.some(function (n) { return n.kind === 'ambiguous'; });`),
        '"every raven is black and then flies" is read as one claim (it had asked about "a black fly")');
    // Of "it": no question. (Whether "then" takes in "and it sings" asks where a step turns on it: r27.189.)
    const twice = ev(`var r = parseClaimFull('If the raven is black, then the raven is wise and it sings.'); return { key: claimKey(r.form).replace(/\uE000/g, ''), asks: r.notes.filter(function (n) { return n.kind === 'ambiguous' && !n.stepDecides; }).length };`);
    ok(twice.key === 'I(P:the raven|=black>C[P:the raven|=wise;P:the raven|~sing])' && twice.asks === 0,
        '"the raven" said twice is one thing: "it" is the raven, not asked as "the raven" or "the raven"', J(twice));
}

console.log('\n-- the r27.67 sweep --');
{
    const notesOf = (t, choice) => ev(`var r = parseClaimFull(${J(t)}${choice ? ', ' + J(choice) : ''}); return { key: claimKey(r.form).replace(/\uE000/g, ''),
        asks: r.notes.filter(function (n) { return n.kind === 'ambiguous'; }).map(function (n) { return { pronoun: !!n.pronoun, readings: n.readings }; }) };`);
    // A name after "that" is a name: it opens the that-clause.
    const said = notesOf('Mary said that Bob left, and he cried.');
    ok(said.asks.some(a => a.pronoun && J(a.readings) === J(['Mary said that Bob left, and Mary cried.', 'Mary said that Bob left, and Bob cried.'])),
        '"Mary said that Bob left, and he cried": "he" may be Mary or Bob -- asked (it had been Mary, the one it could be)', J(said));
    // Two sentences in one box.
    ok(key('Poe is black. Fido is white.') === 'C[P:poe|=black;P:fido|=white]' && key('Poe is black. Fido is white. Rex is old.') === 'C[P:poe|=black;P:fido|=white;P:rex|=old]' &&
        key('Mary left. She cried.') === 'C[P:mary|~did left;P:mary|~did cried]' && /^A:/.test(key('Poe is black. So Fido is white.')) &&
        key('Mr. Smith is tall.') === 'P:mr smith|=tall' && key('J. S. Mill is a philosopher.') === 'P:j s mill|=philosopher',
        'two sentences in one box are both said, as a semicolon joins them ("Poe is black. Fido is white." had been one predicate); "So" after a full stop is still an inference; titles and initials end no sentence');
    // A semicolon or a full stop after a conditional: asked, not read into its "then".
    const semi = ['If Poe is black, then Fido is white; Rex is old.', 'If Poe is black, then Fido is white. Rex is old.'].map(t => notesOf(t));
    ok(semi.every(r => /^A:/.test(r.key) && r.asks.length === 1 && r.asks[0].readings.length === 2) &&
        key('Poe flies; Fido sings or Rex barks.') === 'C[P:poe|~fly;D[P:fido|~sing;P:rex|~bark]]',
        'after a conditional, a semicolon or a full stop asks whether what follows is under its "if" (it had been read into the "then"); "P; Q or R" groups as ", and" does', J(semi));
    // A numbered list with "it is not the case that" in it -- and so the
    // denial question's reading "only its first part".
    ok(key('(1) It is not the case that Poe flies, and (2) Mary sings.') === 'C[N(P:poe|~fly);P:mary|~sing]' &&
        key('(1) It is not the case that Poe flies, (2) Mary sings, and (3) Fido barks.') === 'C[N(P:poe|~fly);P:mary|~sing;P:fido|~bark]' &&
        notesOf('It is not the case that Poe flies, and Fido sings.', { site: 0, reading: 1 }).key === 'C[P:fido|~sing;N(P:poe|~fly)]' &&
        key('Mary knows that (Poe flies) and (Fido sings).') === 'P:mary|~know that (poe flies) and (fido sings)',
        'a numbered list with a denial in it is read, so the denial question\'s "only its first part" builds that (it had built "(it is the case that ...)" nonsense); a that-clause still takes bracketed claims');
    // A reading put in place where the box says "but".
    const inPlace = ev(`var t = 'Poe flies, but dries the dishes, if it rains.', n = parseClaimFull(t).notes.filter(function (x) { return x.kind === 'ambiguous'; })[0], e = Object.assign({}, n, { text: t });
        return n.readings.map(function (l, i) { var w = claimPartWords(e, l); return [w, claimReadingRoundTrips(e, i, w)]; });`);
    ok(inPlace.length === 2 && inPlace[0][0] === 'Poe flies, and dries, the dishes, if it rains.' && inPlace.every(x => x[1] === true),
        'a reading of part of a box is put in place where the box says "but" (read as "and"), its condition kept', J(inPlace));
    const help = ev(`return document.getElementById('help-panel').innerHTML;`);
    ok(/<td>Implicit \/ main \/ given \/ note<\/td><td><kbd>I<\/kbd> \/ <kbd>U<\/kbd> \/ <kbd>G<\/kbd> \/ <kbd>N<\/kbd><\/td>/.test(help) &&
        /<td>Edit with one click \/ place freely<\/td><td><kbd>Shift\+E<\/kbd> \/ <kbd>Shift\+F<\/kbd><\/td>/.test(help),
        'Help\'s shortcut table has the Change Type keys and Edit / Place');
}

{
    const help = ev(`return document.getElementById('help-panel').innerHTML;`);
    // r27.68: Help gives the essentials -- the finer comma rules are for a guide.
    ok(/Commas can settle what you mean: <em>Mary sang, and danced, in the hall<\/em> \(both in the hall\); <em>Mary sang, and she danced in the hall<\/em> \(only the dancing\)/.test(help) &&
        /<strong>\?<\/strong> with a reason, such as <strong>\? ambiguous<\/strong>: a box can be read more than one way\. Click the tag to choose what you mean/.test(help),
        'Help says that a box may be asked about, and how commas settle what it means');
}

console.log('\n-- "-able" words (r27.65) --');
{
    // The user, 2026-09-30, of "We can conceive of X" and "X is conceivable":
    // the one-way rule, its own step, an option in the Logic panel.
    const tag = (ps, c) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return st ? { rule: st.rule ? st.rule.name : null, why: (st.why && st.why.text || '').replace(/\uE000/g, '') } : null;`);
    // r27.169 (the user: "Any time someone writes, 'necessarily', 'possibly',
    // etc., they need to specify the modality, and the checker should ask"):
    // "we can conceive" asks which "can" is meant; answered "are able to" or
    // "it is possible for", the rule takes it.
    const asked = [tag(['We can conceive of zombies.'], 'Zombies are conceivable.'), tag(['Zombies can be conceived.'], 'Zombies are conceivable.')];
    ok(asked.every(r => r && !r.rule && /^Did you mean \u201cWe are able to conceive of zombies\u201d, \u201cIt is metaphysically possible for us to conceive of zombies\u201d|^Did you mean \u201cZombies are able to be conceived\u201d/.test(r.why)),
        '"we can conceive of zombies", "zombies can be conceived": which "can" is asked (r27.169)', J(asked));
    // As written (r27.184): "zombies are able to be conceived", a generic,
    // asks with Semantic mode on.
    const yes = asWritten(() => [tag(['We are able to conceive of zombies.'], 'Zombies are conceivable.'), tag(['We are able to conceive of zombies.'], 'Zombies are able to be conceived.'),
        tag(['Zombies are able to be conceived.'], 'Zombies are conceivable.'), tag(['Mary is able to prove the theorem.'], 'The theorem is provable.'),
        tag(['It is possible for us to conceive of zombies.'], 'Zombies are conceivable.')]);
    ok(yes.every(r => r && r.rule === 'meaning of \u2018-able\u2019'),
        '"we are able to conceive of zombies" gives "zombies are conceivable" and "zombies are able to be conceived", by the meaning of "-able"; so "provable"; so "it is possible for us to conceive"', J(yes));
    const no = [tag(['Zombies are conceivable.'], 'We are able to conceive of zombies.'), tag(['We are not able to conceive of zombies.'], 'Zombies are not conceivable.'),
        tag(['We are able to read the book.'], 'The book is readable.'), tag(['We are able to conceive of a zombie.'], 'Zombies are conceivable.')];
    ok(no.every(r => r && !r.rule && !/Did you mean/.test(r.why)), 'never the other way; nor from "not able"; nor for a word whose meaning has moved ("readable"); nor from another number', J(no));
    // "Metaphysically possible": "possible" asks which kind (r27.172).
    const direct = tag(['If zombies are conceivable, then zombies are metaphysically possible.', 'We are able to conceive of zombies.'], 'Zombies are metaphysically possible.');
    ok(direct && !direct.rule && /\u201cWe are able to conceive of zombies\.\u201d gives \u201cZombies are conceivable\u201d by the meaning of \u2018-able\u2019: with \u201cZombies are conceivable\u201d as a box of its own, the premises would give \u201cZombies are metaphysically possible\u201d by modus ponens\./.test(direct.why),
        'the direct route is not one step: its explanation names the box that is missing', J(direct));
    const off = ev(`var was = state.logic; state.logic = { base: 'standard', rules: { semantic: true } }; setDeductiveRule('able-meaning', false);
        var trees = [{ id: 'M', type: 'contention', texts: ['Zombies are conceivable.'], collapsed: [], children: [{ id: 'S', type: 'support', texts: ['We are able to conceive of zombies.'], collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0], r = st && st.rule ? st.rule.name : null; state.logic = was; claimRulesCache = null; return r;`);
    ok(off === null, 'switched off in the Logic panel, the step is not taken', J(off));
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

console.log('\n-- adjectives before a plural (r27.102) --');
{
    // The user, 2026-10-14: "For some reason, "Pre-linguistic humans don't
    // lack minds" is not considered the negation of "Pre-linguistic humans
    // lack minds"" -- the second had "humans" as its verb.
    const tags = ev(`var out = {}; ['pre-linguistic', 'post-modern', 'non-human', 'self-esteem', 'x-ray'].forEach(function (w) { out[w] = !!claimSynWord(w).adj; }); return out;`);
    ok(J(tags) === J({ 'pre-linguistic': true, 'post-modern': true, 'non-human': true, 'self-esteem': false, 'x-ray': false }),
        'a hyphenated adjective is one: its last part one ("non-human"), or a prefix on a word that ends as one ("pre-linguistic"); "self-esteem" is not', J(tags));
    const cases = [
        ['Pre-linguistic humans lack minds.', '[pre-linguistic humans] lack minds'],
        ['Conscious humans lack minds.', '[conscious humans] lack minds'],
        ['The conscious humans lack minds.', '[the conscious humans] lack minds'],
        ['Post-modern theories reject truth.', '[post-modern theories] reject truth'],
        ['Human beings have rights.', '[human beings] have rights'],
        ['The counter-argument fails.', '[the counter-argument] fails'],
    ];
    const got = cases.map(([t]) => split(t));
    ok(got.every((g, i) => g === cases[i][1]), 'an -s word after adjectives alone is the plural noun they go with, where a verb follows it', J(got));
    const denies = ev(`var a = parseClaim('Pre-linguistic humans lack minds.'), b = parseClaim("Pre-linguistic humans don't lack minds.");
        return [claimDenies(a, b), claimDenies(b, a)];`);
    ok(J(denies) === J([true, true]), '"Pre-linguistic humans don\'t lack minds" denies "Pre-linguistic humans lack minds", and the other way', J(denies));
    const step = asWritten(() => ev(`var trees = [{ id: 'M', type: 'contention', texts: ['Pre-linguistic humans lack minds.'], collapsed: [], children: [{ id: 'O', type: 'objection',
        texts: ["If babies think, then pre-linguistic humans don't lack minds.", 'Babies think.'], collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return st && st.rule ? st.rule.name : null;`));
    ok(step === 'modus ponens', 'so an objection that gives the denial is certified, read as written', J(step));
    // Found beside it: "Free will exists" had been "[free] will exists".
    const will = [
        ['Free will exists.', '[free will] exists'],
        ['Free will is an illusion.', '[free will] is an illusion'],
        ['Free will really exists.', '[free will] really exists'],
        ['Might makes right.', '[might] makes right'],
        ['The can is empty.', '[the can] is empty'],
        ['Mary will exist.', '[mary] will exist'],
        ['Mary will not exist.', '[mary] will not exist'],
        ['Poe can fly.', '[poe] can fly'],
        ['We will miss the bus.', '[we] will miss the bus'],
    ];
    const wgot = will.map(([t]) => split(t));
    ok(wgot.every((g, i) => g === will[i][1]), '"will", "can", "might" before a finite verb ("will exists", "can is") are nouns; before a plain one, helping verbs, as before', J(wgot));
    const mt = ev(`var trees = [{ id: 'M', type: 'contention', texts: ['Free will does not exist.'], collapsed: [], children: [{ id: 'S', type: 'support',
        texts: ['If free will exists, then we are responsible.', 'We are not responsible.'], collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return st ? { rule: st.rule ? st.rule.name : null, why: (st.why && st.why.text || '') } : null;`);
    ok(mt && mt.rule === 'modus tollens', '"If free will exists, then we are responsible", "we are not responsible": "free will does not exist", by modus tollens (it had been "Free will not exists")', J(mt));
}

console.log('\n-- words joined by "and" take "are", not "is" (r27.125) --');
{
    // Found beside the weather "it": "Bob met Al and Cy, and Al is tall" had
    // been "Bob met Al" and "Cy, and Al is tall", unread -- "Cy and Al" taken
    // for the subject of "is".
    const parts = t => ev(`var f = parseClaim(${J(t)}); return f ? f.kind + ': ' + (f.parts ? f.parts.map(claimShowForm).join(' | ') : claimShowForm(f)) : null;`);
    const cases = [
        ['Bob met Al and Cy, and Al is tall.', 'and: bob met Al and Cy | al is tall'],
        ['Bob met Al and Cy and Al is tall.', 'and: bob met Al and Cy | al is tall'],
        ['Bob likes the cat and the dog, and the dog is tall.', 'and: bob likes the cat and the dog | the dog is tall'],
        ['Bob met Al and Cy, and Al has a dog.', 'and: bob met Al and Cy | al has a dog'],
        ['Bob met Al and Cy and Al does not run.', 'and: bob met Al and Cy | al does not run'],
        ['Bob met Al, Cy and Dee, and Al was tall.', 'and: bob met Al, Cy and Dee | al was tall'],
    ];
    const got = cases.map(([t]) => parts(t));
    ok(got.every((g, i) => g === cases[i][1]), 'before "is", "was", "has", "does", the clause begins at the last name, and what is joined before it is the object', J(got));
    const kept = [
        ['Bob met Al, and Cy and Al are tall.', 'and: bob met Al | cy and Al are tall'],
        ['Bob met Al and both Cy and Al are tall.', 'and: bob met Al | both Cy and Al are tall'],
        ['Bob runs and Socrates is wise.', 'and: bob runs | socrates is wise'],
        ['Bob runs and the news is good.', 'and: bob runs | the news is good'],
    ];
    const kgot = kept.map(([t]) => parts(t));
    ok(kgot.every((g, i) => g === kept[i][1]), 'and before "are", joined words are the subject still; "Socrates" and "the news", which end in -s, take "is"', J(kgot));
    const starts = ev(`return ['Al and Cy is tall', 'Al and Cy are tall', 'Al, Cy and Dee is tall', 'Al, Cy and Dee are tall', 'Al or Cy is tall', 'the cat and the dog is tall',
        'the cat, the dog and the cow is tall', 'the cat, the dog and the cow are tall', 'the cat, the dog or the cow is tall']
        .map(function (t) { return claimSynClauseStart(claimTokens(normalizeClaimText(t))); });`);
    ok(J(starts) === J([false, true, false, true, true, false, false, true, true]), 'a list closed by "and" is joined too; "or" takes "is"', J(starts));
    const st = ev(`var trees = [{ id: 'M', type: 'contention', texts: ['Al is tall.'], collapsed: [], children: [{ id: 'S', type: 'support',
        texts: ['Bob met Al and Cy, and Al is tall.'], collapsed: [], children: [] }] }];
        var s = collectDeductiveSteps(trees)[0]; return s && s.rule ? s.rule.name : (s && s.why ? s.why.text : null);`);
    ok(st === 'conjunction elimination', 'so "Al is tall" follows from it, by conjunction elimination (it had been "worded differently": "cy and" in one and not the other)', J(st));
}

console.log('\n-- a comma before "and" divides clauses (r27.126) --');
{
    // The user: "Independent clauses in the same sentence should be divided
    // by commas." "Bob met Al and Cy, and Al met Dee" had been "Bob met Al"
    // and "Cy, and Al met Dee", "Cy, and Al" taken for one subject.
    const parts = t => ev(`var f = parseClaim(${J(t)}); return f ? f.kind + ': ' + (f.parts ? f.parts.map(claimShowForm).join(' | ') : claimShowForm(f)) : null;`);
    const cases = [
        ['Bob met Al and Cy, and Al met Dee.', 'and: bob met Al and Cy | al met Dee'],
        ['Bob met Al, and Cy and Al met Dee.', 'and: bob met Al | cy and Al met Dee'],
        ['Bob met Al, Cy, and Dee, and Al met Eve.', 'and: bob met Al, Cy, and Dee | al met Eve'],
        ['Mary left and Bob and Ann cried.', 'and: mary left | bob and Ann cried'],
        ['Bob likes Al and Cy and Al likes Dee.', 'and: bob likes Al and Cy | al likes Dee'],
    ];
    const got = cases.map(([t]) => parts(t));
    ok(got.every((g, i) => g === cases[i][1]), 'the comma says which "and" joins the clauses; a list of three keeps its comma; where nothing else can be meant, no comma is needed', J(got));
    const asked = ev(`var r = parseClaimFull('Bob met Al and Cy and Al met Dee.'), n = r.notes.filter(function (x) { return x.kind === 'ambiguous'; })[0];
        return n ? [r.form.kind, n.message, n.readings.map(function (x) { return x.replace(/\\uE000/g, ''); })] : null;`);
    ok(J(asked) === J(['atom', '"and" can group this two ways', ['bob met al, and cy and al met dee', 'bob met al and cy, and al met dee']]),
        'with no comma, and either way English ("Cy and Al met Dee", or Bob met Al and Cy), asked: each reading with its comma', J(asked));
    const back = ['bob met al, and cy and al met dee', 'bob met al and cy, and al met dee'].map(t => ev(`var r = parseClaimFull(${J(t)});
        return r.notes.filter(function (x) { return x.kind === 'ambiguous' && /group/.test(x.message); }).length;`));
    ok(J(back) === J([0, 0]), 'and each reading, read back, asks nothing more of its "and"s', J(back));
    const st = ev(`var trees = [{ id: 'M', type: 'contention', texts: ['Al met Dee.'], collapsed: [], children: [{ id: 'S', type: 'support',
        texts: ['Bob met Al and Cy, and Al met Dee.'], collapsed: [], children: [] }] }];
        var s = collectDeductiveSteps(trees)[0]; return s && s.rule ? s.rule.name : (s && s.why ? s.why.text : null);`);
    ok(st === 'conjunction elimination', 'so "Al met Dee" follows from it (it had been "worded differently")', J(st));
}

console.log('\n-- a clause by its shape, where the lists do not know its verb (r27.127) --');
{
    // The user: "shouldn't the part of speech of each of these phrases be
    // evaluated by the internal syntax tree?" "Bob likes the cat and the dog
    // and the dog likes Bob" had been one claim: "the dog and the dog likes"
    // no subject and verb, the clause test had said "cannot tell", and the
    // "and" splitter guessed; with "feeds" and "adores", which no list knows,
    // the older test had found no clause in "Bob feeds the cat and the dog".
    const parts = t => ev(`var f = parseClaim(${J(t)}); return f ? f.kind + ': ' + (f.parts ? f.parts.map(claimShowForm).join(' | ') : claimShowForm(f)) : null;`);
    const cases = [
        ['Bob likes the cat and the dog and the dog likes Bob.', 'and: bob likes the cat and the dog | the dog likes Bob'],
        ['Bob likes the cat and the dog and the dog adores Bob.', 'and: bob likes the cat and the dog | the dog adores Bob'],
        ['Bob feeds the cat and the dog and the dog adores Bob.', 'and: bob feeds the cat and the dog | the dog adores Bob'],
        ['Bob likes Rex and the dog and the dog adores Bob.', 'and: bob likes Rex and the dog | the dog adores Bob'],
        ['Bob likes Rex, and the cat and the dog adore Bob.', 'and: bob likes Rex | the cat and the dog adore Bob'],
    ];
    const got = cases.map(([t]) => parts(t));
    ok(got.every((g, i) => g === cases[i][1]), 'a verb in -s takes no subject joined by "and", and the clause begins after it', J(got));
    const starts = ev(`return ['the dog adores Bob', 'the cat and the dog adore Bob', 'the dog and the dog adores Bob', 'the dog adores', 'Bob feeds the cat and the dog']
        .map(function (t) { return claimSynClauseStart(claimTokens(normalizeClaimText(t))); });`);
    ok(J(starts) === J([true, true, false, false, true]),
        'a verb no list knows makes a clause where its subject and an object that ends the clause stand around it ("the dog adores" alone, which may be all one noun phrase, as before)', J(starts));
    const st = ev(`var trees = [{ id: 'M', type: 'contention', texts: ['The dog adores Bob.'], collapsed: [], children: [{ id: 'S', type: 'support',
        texts: ['Bob feeds the cat and the dog and the dog adores Bob.'], collapsed: [], children: [] }] }];
        var s = collectDeductiveSteps(trees)[0]; return s && s.rule ? s.rule.name : (s && s.why ? s.why.text : null);`);
    ok(st === 'conjunction elimination', 'so "The dog adores Bob" follows from it', J(st));
}

console.log('\n-- a clause after "after", "before", "as" (r27.128) --');
{
    // The user: "parse language into its syntactical components correctly."
    // "Mary left after Bob arrived" had been "[Mary left after Bob] arrived":
    // the phrase of a participle after its noun ("swans seen so far") ran on
    // past "after", so a thing called "Mary left after Bob" arrived -- and
    // with "everything that arrived was greeted", "Mary left after Bob was
    // greeted" was certified. The words settle it where they can; where both
    // groupings are English, it is asked where a step turns on it.
    const cases = [
        ['Mary left after Bob arrived.', '[mary] left after bob arrived'],
        ['Mary acted as Bob would act.', '[mary] acted as bob would act'],
        ['Mary laughed as Bob arrived.', '[mary] laughed as bob arrived'],
        ['Mary stayed until Bob arrived.', '[mary] stayed until bob arrived'],
        ['The dog died before the vet arrived.', '[the dog] died before the vet arrived'],
        ['Some student died before the vet arrived.', '[some student] died before the vet arrived'],
        ['The man seen after the party left early.', '[the man seen after the party] left early'],
        ['The book written before the war sold well.', '[the book written before the war] sold well'],
        ['The letters sent after the election arrived late.', '[the letters sent after the election] arrived late'],
        ['The swans seen so far are white.', '[the swans seen so far] are white'],
        ['Theories proposed by philosophers fail.', '[theories proposed by philosophers] fail']];
    const got = cases.map(([t]) => split(t));
    ok(J(got) === J(cases.map(c => c[1])),
        'a name, or a verb that takes no object, is the verb before "after", "before", "as"; "seen", "written", and a verb that must have an object, say which thing is meant', J(got));
    const asked = ev(`return ['The dog left after Bob arrived.', 'The students left before the lecture ended.', 'Every dog left after Bob arrived.',
            'Mary left after Bob arrived.', 'The letters sent after the election arrived late.']
        .map(function (t) { var n = parseClaimFull(t).notes.filter(function (x) { return x.kind === 'ambiguous' && x.grouping; })[0];
            return n ? n.message.replace(/\\uE000/g, '') + ' | ' + n.readings.map(claimLabel).join(' / ') : null; });`);
    ok(J(asked) === J(['"left after Bob" may say which dog is meant, or what the dog did | the dog that was left after Bob arrived / the dog left, after Bob arrived',
        '"left before the lecture" may say which students are meant, or what the students did | the students that were left before the lecture ended / the students left, before the lecture ended',
        '"left after Bob" may say which dog is meant, or what every dog did | every dog that was left after Bob arrived / every dog left, after Bob arrived',
        null, null]), 'where both groupings are English, it is asked: which dog is meant, or what the dog did', J(asked));
    const back = ev(`return ['the dog that was left after Bob arrived', 'the dog left, after Bob arrived', 'every dog left, after Bob arrived'].map(function (t) {
        var r = parseClaimFull(t); return (r.form ? claimKey(r.form).replace(/\\uE000/g, '') : null) + ' ' + r.notes.filter(function (x) { return x.kind === 'ambiguous'; }).length; });`);
    ok(J(back) === J(['P:the dog that was left after bob|~did arrived 0', 'P:the dog|~did left after bob arrived 0', 'U:=dog|~did left after bob arrived 0']),
        'each reading, written in the box, reads as itself and asks nothing more', J(back));
    const step = (ps, c) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support',
        texts: ${J(ps)}, collapsed: [], children: [] }] }];
        return deductiveStepTagText(collectDeductiveSteps(trees)[0]);`);
    ok(step(['Mary left after Bob arrived.', 'Everything that arrived was greeted.'], 'Mary left after Bob was greeted.') === '? not recognized' &&
        step(['Mary acted as Bob would act.'], 'Something would act.') === '? not recognized',
        '"Mary left after Bob arrived" and "everything that arrived was greeted" no longer give "Mary left after Bob was greeted" (it had been certified)');
    ok(step(['The dog left after Bob arrived.', 'Everything that arrived was greeted.'], 'The dog left after Bob was greeted.') === '? ambiguous' &&
        step(['The dog left after Bob arrived.'], 'Something arrived.') === '? ambiguous' &&
        step(['Every dog left after Bob arrived.', 'Rex is a dog.'], 'Rex left after Bob arrived.') === '? ambiguous',
        'where a step turns on the grouping, it waits for the answer');
    ok(asWritten(() => step(['Every dog left after Bob arrived.', 'Rex is a dog left after Bob.'], 'Rex arrived.')) === '? not recognized',
        'read as written, it is read as its first reading says, word for word: nothing follows from a third way of reading it');
    ok(asWritten(() => step(['The dog left after Bob arrived.', 'If the dog left after Bob arrived, then Al cried.'], 'Al cried.')) === '✓ modus ponens' &&
        step(['The dog left after Bob arrived.', 'If the dog left after Bob arrived, then Al cried.'], 'Al cried.') === '? ambiguous' &&
        step(['The letters sent after the election arrived late.', 'Everything that arrived late was lost.'], 'The letters sent after the election were lost.') === '✓ universal modus ponens',
        'a step that follows either way follows as written, and with Semantic mode on asks (r27.184); "sent", with no object after it, says which letters are meant');
}

console.log('\n-- "both" after a subject; "not only ... but also" (r27.131) --');
{
    // "Bob and Mary both left" had kept "both" in what was said ("both left"),
    // so "Bob left" did not follow; "Bob and Al did not both leave" had been
    // read as neither leaving, with a verb "bothed leave"; "Bob is not only
    // rich but also happy" had asked whether Bob is "not both only rich and
    // happy"; "Bob, Al and Cy each left" had been "both Bob, Al and Cy left".
    const keys = ['Bob and Mary both left.', 'Bob and Mary have both left.', 'Bob and Al did not both leave.', "Bob and Al didn't both leave.",
        'Bob and Al both did not leave.', 'Bob and Mary are not both tall.', 'Bob, Al and Cy each left.',
        'Bob is not only rich but also happy.', 'Bob not only sings but also dances.', 'Bob is not only rich, but he is also happy.', 'Not only Bob but also Mary left.'].map(key);
    ok(J(keys) === J(['C[P:bob|~did left;P:mary|~did left]', 'C[P:bob|~have left;P:mary|~have left]', 'N(C[P:bob|~did left;P:al|~did left])',
        'N(C[P:bob|~did left;P:al|~did left])', 'C[N(P:bob|~did left);N(P:al|~did left)]', 'N(C[P:bob|=tall;P:mary|=tall])',
        'C[P:bob|~did left;P:al|~did left;P:cy|~did left]', 'C[P:bob|=rich;P:bob|=happy]', 'C[P:bob|~sing;P:bob|~dance]', 'C[P:bob|=rich;P:bob|=happy]',
        'C[P:bob|~did left;P:mary|~did left]']),
        '"both" after the subject says it of each; "not" before "both" denies that both did, after it denies it of each; "not only ... but also" says both', J(keys));
    ok(J(['Not only is Bob rich, but he is also happy.', 'Bob is not only rich.'].map(key)) === J(['C[P:bob|=rich;P:bob|=happy]', 'N(P:bob|=only rich)']),
        'the inverted "not only is Bob rich, but ..." as before; "not only" with no "but" is left as it was');
    const step = (ps, c) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support',
        texts: ${J(ps)}, collapsed: [], children: [] }] }];
        return deductiveStepTagText(collectDeductiveSteps(trees)[0]);`);
    ok(step(['Bob and Mary both left.'], 'Bob left.') === '✓ conjunction elimination' &&
        step(['Bob and Al did not both leave.', 'Bob left.'], 'Al did not leave.') === '✓ conjunctive syllogism' &&
        step(['Bob did not leave or Al did not leave.'], 'Bob and Al did not both leave.') === '✓ De Morgan’s laws' &&
        step(['Bob and Al did not both leave.'], 'Bob did not leave.') === '? not recognized' &&
        step(['Bob is not only rich but also happy.'], 'Bob is rich.') === '✓ conjunction elimination',
        'so "Bob left" follows; "not both" with "Bob left" gives "Al did not leave", and De Morgan gives "not both"; "not both" alone gives neither denial');
}

console.log('\n-- a clause or a phrase set off by commas: "Bob, who is rich, can pay" (r27.139) --');
{
    // The commas set it off, and what it says of Bob is a claim of its own
    // (the user: commas settle grouping). These had been read as one claim.
    const keys = ['Bob, who is rich, can pay.', 'Bob, a doctor, can pay.', 'The dog, which barked, left.', 'Paris, the capital of France, is big.',
        'My brother, who lives in Paris, is rich.'].map(key);
    ok(J(keys) === J(['C[P:bob|=rich;P:bob|~can pay]', 'C[P:bob|=doctor;P:bob|~can pay]', 'C[P:the dog|~did barked;P:the dog|~did left]',
        'C[P:paris|=capital of france;P:paris|=big]', 'C[P:my brother|~live in paris;P:my brother|=rich]']),
        'a "who" or "which" clause, or a phrase naming what it is, set off by commas: two claims of one thing', J(keys));
    const kinds = ev(`return ['Bob, who I like, can pay.', 'Bob, the dog and the cat left.', 'Bob, however, can pay.', 'If Bob, who is rich, pays then Al leaves.']
        .map(function (t) { return parseClaim(t).kind; });`);
    ok(J(kinds) === J(['atom', 'and', 'pred', 'if']), 'not "who I like", whose verb is not its own; not a list; not "however"; not inside an "if"', J(kinds));
    const step = (ps, c) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support',
        texts: ${J(ps)}, collapsed: [], children: [] }] }];
        return deductiveStepTagText(collectDeductiveSteps(trees)[0]);`);
    // "Will pay": "can pay" asks which is meant (r27.169).
    ok(step(['Bob, who is rich, will pay.'], 'Bob is rich.') === '✓ conjunction elimination' && step(['Bob, a doctor, will pay.'], 'Bob is a doctor.') === '✓ conjunction elimination' &&
        step(['Mark Twain, who wrote Huckleberry Finn, was born in Missouri.'], 'Mark Twain wrote Huckleberry Finn.') === '✓ conjunction elimination',
        'so "Bob is rich", "Bob is a doctor", "Mark Twain wrote Huckleberry Finn" follow');
}

console.log('\n-- "if ..., then B and C" and "thinks that B and C" without a comma: asked where a step turns on it (r27.189) --');
{
    // The user: "these are ambiguous because of a lack of commas and 'both...
    // and' structure"; "It depends on whether validity turns on the
    // interpretation ... If so, even if it's the most unusual case, then we
    // disambiguate".
    const said = t => ev(`var r = parseClaimFull(${J(t)}), n = r.notes.filter(function (x) { return x.kind === 'ambiguous'; })[0];
        return { key: claimKey(r.form).replace(//g, ''), readings: n ? n.readings.map(function (l, i) { var w = claimReadingWords(l, ${J(t)});
            return (claimReadingRoundTrips({ text: ${J(t)}, site: n.site, message: n.message }, i, w) ? '' : 'NOT BACK: ') + w; }) : [], step: !!(n && n.stepDecides) };`);
    const ifs = said('If it rains, then the ground is wet and the match is off.'), or = said('If it rains then the ground is wet or the match is off.');
    ok(ifs.key === 'I(P:it|~rain>C[P:the ground|=wet;P:the match|=off])' && ifs.step &&
        J(ifs.readings) === J(['If it rains, then both the ground is wet and the match is off.', 'The match is off, and if it rains, then the ground is wet.']) &&
        J(or.readings) === J(['If it rains, then either the ground is wet or the match is off.', 'The match is off, or if it rains, then the ground is wet.']),
        '"if it rains, then the ground is wet and the match is off" offers both groupings, as the comma does, each reading back (since r27.193 the second without numbers); elsewhere "then" takes in both, as before', J([ifs, or]));
    const none = ['If it rains, then the ground is wet and slippery.', 'If it rains, then Poe is black and flies.', 'If it rains, then both the ground is wet and the match is off.',
        'Bob thinks that Poe is black and that Fido is white.', 'Bob thinks that Poe and Fido are black.', 'Bob thinks that both Poe is black and Fido is white.',
        'Bob thinks that Poe is black and white.'].map(t => said(t).readings.length);
    ok(none.every(k => k === 0), 'no question where "and" joins no clause of its own, after "both", or before "that" again', J(none));
    const thinks = [said('Bob thinks that Poe is black and Fido is white.'), said('Bob thinks that Poe is black, and Fido is white.')];
    ok(thinks.every(t => t.key === 'P:bob|~think that poe is black and fido is white' && t.step) &&
        J(thinks[0].readings) === J(['Fido is white, and Bob thinks that Poe is black.', 'Bob thinks that both Poe is black and Fido is white.']) &&
        J(thinks[1].readings) === J(['Fido is white, and Bob thinks that Poe is black.', 'Bob thinks that both Poe is black, and Fido is white.']),
        '"Bob thinks that Poe is black and Fido is white", comma or none, offers "Fido is white, and Bob thinks that Poe is black" and "Bob thinks that both ..." (it had offered the first only, and asked nothing); elsewhere all of it is thought', J(thinks));
    const steps = [[['If it rains, then the ground is wet and the match is off.'], 'The match is off.'], [['If it rains, then the ground is wet and the match is off.', 'It rains.'], 'The ground is wet and the match is off.'],
        [['If physicalism is false, then zombies are possible and zombies are not possible.'], 'Physicalism is true.'], [['If it rains, then the ground is wet and the match is off.'], 'Bob left.'],
        [['Bob thinks that Poe is black and Fido is white.'], 'Fido is white.'], [['Bob thinks that Poe is black and Fido is white.'], 'Bob thinks that both Poe is black and Fido is white.']]
        .map(([ps, c]) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
            var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, asked: st && st.why ? (st.why.ambiguous || []).map(function (a) { return a.readings.length; }) : [] };`));
    // r27.201 (the user, of a reading that gives the step in two: "It follows,
    // but not in one step"): modus ponens and the one-box reductio wait too --
    // on the other grouping each takes more than one step.
    ok(steps[0].rule === null && J(steps[0].asked) === J([2]) && steps[1].rule === null && J(steps[1].asked) === J([2]) && steps[2].rule === null && steps[2].asked[0] === 2 &&
        steps[3].rule === null && J(steps[3].asked) === J([]) && steps[4].rule === null && J(steps[4].asked) === J([2]),
        'a step waits for the answer where one reading gives it and another does not ("so the match is off"), or gives it only in more than one step (modus ponens and the one-box reductio, on the other grouping; r27.201); it does not follow, unasked, where none does', J(steps));
    // r27.199: on the reading that thinks it all, the box only says again what
    // it supports; on the other, it does not give it -- so it asks (it had
    // said "only repeats", as read before the answer).
    ok(ev(`var trees = [{ id: 'M', type: 'contention', texts: ['Bob thinks that both Poe is black and Fido is white.'], collapsed: [], children: [{ id: 'S', type: 'support', texts: ['Bob thinks that Poe is black and Fido is white.'], collapsed: [], children: [] }] }];
            var st = collectDeductiveSteps(trees)[0]; return st && st.why ? st.why.text : '';`) === 'Did you mean \u201cFido is white, and Bob thinks that Poe is black\u201d or \u201cBob thinks that both Poe is black and Fido is white\u201d?' &&
        ev(`return claimSame(parseClaim('Bob thinks that both Poe is black and Fido is white.'), parseClaim('Bob thinks that Poe is black and Fido is white.', { site: 0, reading: 1 }));`),
        '"thinks that both P and Q" says what "thinks that P and Q" says on the reading that thinks it all: "both" after "that" only groups -- so where the other reading does not give it, it asks (r27.199)');
    // r27.190 (the user, of making a list and "and then" inside a that-clause
    // ask the same way: "Yes").
    const list = said('Mary knows that Poe flies, Fido sings, and Rex barks.'), then = said('Mary believes that Ann left and then Bob cried.');
    // Since r27.192 (the user: "We should never offer paraphrases with
    // parentheses"), "that" again before each part, and "first ... and then".
    // Since r27.195 the parts after the first go first ("Rex barks, and Mary
    // knows that Poe flies, Fido sings" had spliced two claims in the clause).
    ok(list.step && J(list.readings) === J(['Fido sings, Rex barks, and Mary knows that Poe flies.', 'Mary knows that Poe flies, that Fido sings, and that Rex barks.']) &&
        then.step && then.key === 'P:mary|~believe that ann left and then bob cried' &&
        J(then.readings) === J(['First Mary believes that Ann left, and then Bob cried.', 'Mary believes that first Ann left and then Bob cried.']),
        'a list in a that-clause, and an "and then" in one, offer both readings, each reading back -- "that" again before each part, or "that first ... and then", for all of it; "first ..., and then ..." for the sequence; elsewhere all of it is in the that-clause, as before (r27.190, r27.192)', J([list, then]));
    // r27.192: "that" again, "first ... and then" inside a that-clause only group it.
    const same = (x, y) => ev(`var a = parseClaim(${J(x)}), b = parseClaim(${J(y)}); return !!a && !!b && claimSame(a, b);`);
    ok(same('Bob thinks that Poe is black and that Fido is white.', 'Bob thinks that Poe is black and Fido is white.') &&
        same('Mary knows that Poe flies, that Fido sings, and that Rex barks.', 'Mary knows that Poe flies, Fido sings, and Rex barks.') &&
        same('Mary believes that first Ann left and then Bob cried.', 'Mary believes that Ann left and then Bob cried.') &&
        key('Mary knows that Poe flies and that dog barks.') === 'P:mary|~know that poe flies and that dog barks',
        '"thinks that P and that Q", "knows that P, that Q, and that R", "believes that first A and then B": what they say without the repeated "that" or the "first" (r27.192); "and that dog barks" keeps its "that"');
    const hint = ev(`var trees = [{ id: 'M', type: 'contention', texts: ['Poe is black and Fido is white.'], collapsed: [], children: [{ id: 'W', type: 'weak-objection', texts: ['It has not been established that Poe is black and Fido is white.'], collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return st && st.why ? st.why.text : '';`);
    ok(/for instance \u201cIf we lack reasons to think that both Poe is black and Fido is white, then we are not entitled to conclude that both Poe is black and Fido is white\u201d/.test(hint) && !/\(/.test(hint),
        'the bare-challenge hint groups a compound claim with "both ... and", not brackets (r27.192)', hint);
    ok(key('First Mary believes that Ann left, and then Bob cried.').replace(/\uE000/g, '') === 'T[P:mary|~believe that ann left;P:bob|~did cried]' &&
        key('First Ann left, and then Bob cried.').replace(/\uE000/g, '') === 'T[P:ann|~did left;P:bob|~did cried]',
        '"first A, and then B" is the sequence of the two, split at the "and then" that pairs with "first" where the that-clause would take in the rest (r27.190)');
    const held = [[['Mary believes that Ann left and then Bob cried.'], 'Bob cried.'], [['Mary knows that Poe flies, Fido sings, and Rex barks.'], 'Rex barks.']]
        .map(([ps, c]) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
            var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, asked: st && st.why ? (st.why.ambiguous || []).map(function (a) { return a.readings.length; }) : [] };`));
    ok(held.every(h => h.rule === null && J(h.asked) === J([2])), 'so "Bob cried", "Rex barks": asked, where one reading gives them and the other does not (r27.190)', J(held));
}

console.log('\n-- the letter "A" at the start of a that-clause is no article (r27.191) --');
{
    // At the start of a that-clause "A" loses its capital, and with the commas
    // set aside "A, B" had looked like an article and its noun.
    const keys = ['Bob believes that A, B, and C.', 'Bob believes A, B, and C.', 'Bob denies that A, B, and C.', 'Bob believes that An, Bo, and Cy left.',
        'Bob believes that A implies B.', 'Bob believes that a raven is black.', 'Bob believes a lie.'].map(key);
    ok(J(keys) === J(['P:bob|~believe that a b and c', 'P:bob|~believe that a b and c', 'P:bob|~deny that a b and c', 'P:bob|~believe that an bo and cy left',
        'P:bob|~believe that a implies b', 'P:bob|~believe that raven is black', 'P:bob|~believe lie']),
        '"A" before a comma, or before a verb in -s, is a letter or a name, not the article ("believes that A, B, and C", "An, Bo, and Cy", "A implies B"); "a raven", "a lie" still drop theirs', J(keys));
    const restated = ev(`var trees = [{ id: 'M', type: 'contention', texts: ['Bob believes that A, B, and C.'], collapsed: [], children: [{ id: 'S', type: 'support', texts: ['Bob believes that B and C.'], collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, why: st && st.why ? st.why.text : '' };`);
    ok(!restated.rule && !/only repeats/.test(restated.why), '"Bob believes that B and C" no longer restates "Bob believes that A, B, and C" (it had)', J(restated));
}

console.log('\n-- readings without numbers; three readings of "neither ... if" (r27.193) --');
{
    // The user: "I don't mind numbered readings, and it would be good for the
    // app to be able to recognize them. I think both should be allowed, but the
    // second one ('The match is off, and if...') should be the default
    // disambiguation instead of the numbered version"; of "neither": "there's 3
    // readings, and each of them need to be available for the user to select
    // between".
    const said = t => ev(`var r = parseClaimFull(${J(t)}), n = r.notes.filter(function (x) { return x.kind === 'ambiguous'; })[0];
        return { key: claimKey(r.form).replace(/\uE000/g, ''), unread: r.notes.some(function (x) { return x.kind === 'unread'; }), readings: n ? n.readings.map(function (l, i) { var w = claimReadingWords(l, ${J(t)});
            return (claimReadingRoundTrips({ text: ${J(t)}, site: n.site, message: n.message }, i, w) ? '' : 'NOT BACK: ') + w; }) : [] };`);
    const cases = [
        ['It is not the case that Poe flies and Fido sings.', ['It is not the case that both Poe flies and Fido sings.', 'Fido sings, and it is not the case that Poe flies.']],
        ['Poe flies if it rains and Fido sings.', ['Poe flies if both it rains and Fido sings.', 'Fido sings, and if it rains, then Poe flies.']],
        // A clause with a pronoun is not put first, ahead of what it points back to: numbered.
        ['If the raven is black, then the raven is wise and it sings.', ['If the raven is black, then both the raven is wise and it sings.', '(1) If the raven is black, then the raven is wise, and (2) it sings.']],
        ['Poe flies and Fido sings if it rains.', ['If it rains, then both Poe flies and Fido sings.', 'Poe flies, and if it rains, then Fido sings.']],
        ['Poe flies and sings if it rains.', ['If it rains, then Poe flies and sings.', 'Poe flies, and if it rains, then Poe sings.']],
        ['Either Poe flies or Fido sings if it rains.', ['If it rains, then either Poe flies or Fido sings.', 'Poe flies, or if it rains, then Fido sings.']],
        // Since r27.195 without the group "the ground is wet, the match is off",
        // two claims spliced; and "Ann did not leave, and then Bob cried".
        ['If it rains, then the ground is wet, the match is off, and the roads close.', ['If it rains, then (1) the ground is wet, (2) the match is off, and (3) the roads close.',
            'The match is off, the roads close, and if it rains, then the ground is wet.']],
        ['It is not the case that Ann left and then Bob cried.', ['It is not the case that first Ann left and then Bob cried.', 'Ann did not leave, and then Bob cried.']],
        ['Mary left and then Bob cried if it rained.', ['If it rained, then Mary left and then Bob cried.', 'Mary left, and then, if it rained, Bob cried.']],
        ['Poe flies and Fido sings or Rex barks and Ann runs.', ['Both Poe flies and Fido sings, or both Rex barks and Ann runs.', 'Poe flies, either Fido sings or Rex barks, and Ann runs.']],
        ['Poe flies, and if it rains, Fido sings, and Rex barks.', ['Poe flies, and if it rains, then both Fido sings and Rex barks.', 'Poe flies, Rex barks, and if it rains, then Fido sings.']]];
    const got = cases.map(([t]) => said(t).readings);
    ok(cases.every(([, want], i) => J(got[i]) === J(want)),
        'readings are offered without numbers where English has words for them -- what stands on its own first, then what a condition, a denial or a sequence takes in -- each reading back; the whole of a list of three after "then" stays numbered, and so does a reading that would put a pronoun ahead of what it points back to', J(got));
    const neither = [said('Neither Poe flies nor Fido sings if it rains.'), said('Neither Poe flies nor Fido sings unless it rains.')];
    // Since r27.196 four (the user: "if all 4 readings are possible, we should
    // do all 4"): the condition on both clauses or on the last alone, the
    // denial inside it or outside it.
    ok(J(neither[0].readings) === J(['If it rains, then neither Poe flies nor Fido sings.', 'Both it is not the case that if it rains, then Poe flies, and it is not the case that if it rains, then Fido sings.',
            'Poe does not fly, and if it rains, then Fido does not sing.', 'Poe does not fly, and it is not the case that if it rains, then Fido sings.']) &&
        J(neither[1].readings) === J(['Unless it rains, neither Poe flies nor Fido sings.', 'Both it is not the case that unless it rains, Poe flies, and it is not the case that unless it rains, Fido sings.',
            'Poe does not fly, and unless it rains, Fido does not sing.', 'Poe does not fly, and it is not the case that unless it rains, Fido sings.']),
        '"neither A nor B if C" offers four readings, each reading back: the condition on both clauses or on the last alone, the denial inside it or outside it (it had offered "Neither (A nor B if C)", which did not read back; r27.193 offered three)', J(neither));
    const numbered = [said('(1) If it rains, then the ground is wet, and (2) the match is off.'), said('If it rains, then (1) the ground is wet, (2) the match is off, and (3) the roads close.')];
    ok(numbered[0].key === 'C[I(P:it|~rain>P:the ground|=wet);P:the match|=off]' && !numbered[0].readings.length &&
        numbered[1].key === 'I(P:it|~rain>C[P:the ground|=wet;P:the match|=off;P:the roads|~close])' && !numbered[1].readings.length,
        'numbered readings are still read when written, and ask nothing', J(numbered));
    const names = ['Both Poe and Fido fly if it rains.', 'Either Poe or Fido flies if it rains.'].map(said);
    ok(names.every(n => !n.readings.length) && names[0].key === 'I(P:it|~rain>C[P:poe|~fly;P:fido|~fly])',
        '"both Poe and Fido fly if it rains": names joined, not clauses -- no question (it had offered "(1) Poe, and (2) Fido fly if it rains")', J(names));
    const lists = [key('Poe flies, Rex barks, and if it rains, then Fido sings.'), key('The match is off, the roads close, and if it rains, then the ground is wet.'), key('In Paris, Poe flies, and if it rains, then Fido sings.')]
        .map(k => k.replace(/\uE000/g, ''));
    ok(lists[0] === 'C[P:poe|~fly;P:rex|~bark;I(P:it|~rain>P:fido|~sing)]' && lists[1] === 'C[P:the match|=off;P:the roads|~close;I(P:it|~rain>P:the ground|=wet)]' &&
        /^A:/.test(lists[2]), '"A, B, and if C, then D": the clauses before the commas are the list\'s first items (they had been read as one clause, "poe flies rex barks"); a phrase in front is no clause', J(lists));
    const quoted = said("It is not the case that we can't conclude that God exists from 'Everything has a cause' and 'There is no infinite regress'.");
    ok(/^N\(W\(/.test(quoted.key) && !quoted.readings.length,
        '"we can\'t conclude that ... from \'A\' and \'B\'" under a denial asks nothing: the quoted claims are what "from" joins (it had offered "\'B\', and it is not the case that ... from \'A\'")', J(quoted));
    const weather = said('If the street is wet and the sky is grey, then it is cold.');
    ok(weather.readings.includes('It is cold if both the street is wet and the sky is grey.'), 'the weather "it" put first groups its conditions with "both ... and" (it had been "if (the street is wet and the sky is grey)")', J(weather));
    const jtb = said('S knows that p iff S believes that p, p is true, and S is justified.');
    ok(J(jtb.readings) === J(['S knows that it is the case that p iff S believes that p, p is true, and S is justified.',
            '(1) S believes that p, (2) p is true, and (3) S is justified, iff S knows that p.',
            '(1) If S knows that p, then S believes that p, and if S believes that p, then S knows that p, (2) p is true, and (3) S is justified.',
            // Since r27.195: no group "S believes that p, p is true" (spliced), and
            // S believing all three, as two conditionals.
            'If S knows that p, then S believes that p, that p is true, and that S is justified, and if S believes that p, that p is true, and that S is justified, then S knows that p.']),
        '"S knows that p iff (a list)": what "knows that" takes in said last, where it takes in no more, the list numbered; where the "iff" takes in part of the list, its two ways as two conditionals -- each reading back (they had been bracketed, "(S knows that p) iff ...")', J(jtb));
    ok(key('(1) S believes that p, (2) p is true, and (3) S is justified, iff S knows that p.') === 'B[I(C[P:s|~believe that p;A:p;P:s|=justified]>P:s|~know that p);I(P:s|~know that p>C[P:s|~believe that p;A:p;P:s|=justified])]' &&
        key('(1) Poe flies, (2) Fido sings, and (3) Rex barks iff Ann runs.') === 'C[P:poe|~fly;P:fido|~sing;B[I(P:rex|~bark>P:ann|~run);I(P:ann|~run>P:rex|~bark)]]',
        'a numbered list at the start of a box ends at ", iff", as one after "if" ends at "then"; without the comma the last item keeps its "iff"');
    // No reading anywhere puts words in brackets.
    const sweep = ['Neither Poe flies nor Fido sings if it rains.', 'Poe is a bird that is black, white, or grey.', 'If the street is wet and the sky is grey, then it is cold.',
        'Poe flies iff Fido sings, Rex barks, and Ann runs.', 'It is not the case that Poe flies, Fido sings, and Rex barks.', 'Necessarily, Poe flies iff Fido sings, Rex barks, and Ann runs.',
        'S knows that p iff S believes that p, p is true, and S is justified.'].concat(cases.map(c => c[0]))
        .map(t => ev(`var r = parseClaimFull(${J(t)}); return r.notes.filter(function (x) { return x.readings; }).reduce(function (a, n) { return a.concat(n.readings.map(function (l) { return claimReadingWords(l, ${J(t)}); })); }, []);`));
    const bracketed = [].concat(...sweep).filter(w => /\((?!(?:\d{1,2}|[ivx]{1,4})\))/.test(w));
    ok(!bracketed.length, 'no reading puts words in brackets (numbers alone may be)', J(bracketed));
    const step = ev(`var trees = [{ id: 'M', type: 'contention', texts: ['Poe does not fly.'], collapsed: [], children: [{ id: 'S', type: 'support', texts: ['Neither Poe flies nor Fido sings if it rains.'], collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, asked: st && st.why ? (st.why.ambiguous || []).map(function (a) { return a.readings.length; }) : [] };`);
    ok(step.rule === null && J(step.asked) === J([4]), '"so, Poe does not fly" waits for the answer: some of its four readings give it, and some do not', J(step));
}

console.log('\n-- no spliced groups; "neither" of names; a conditional is no step in a sequence (r27.195) --');
{
    const said = t => ev(`var r = parseClaimFull(${J(t)}), n = r.notes.filter(function (x) { return x.kind === 'ambiguous'; })[0];
        return { key: claimKey(r.form).replace(//g, ''), readings: n ? n.readings.map(function (l, i) { var w = claimReadingWords(l, ${J(t)});
            return (claimReadingRoundTrips({ text: ${J(t)}, site: n.site, message: n.message }, i, w) ? '' : 'NOT BACK: ') + w; }) : [] };`);
    // The user: "there should be only two readings of 'Neither Poe nor Fido
    // flies if it rains', and it's the wide vs narrow scope of the negation".
    const neither = ['Neither Poe nor Fido flies if it rains.', 'Neither the dogs nor Fido flies if it rains.', 'Neither Poe nor the dogs fly if it rains.'].map(said);
    ok(J(neither.map(n => n.readings)) === J([
            ['If it rains, then neither Poe nor Fido flies.', 'Both it is not the case that if it rains, then Poe flies, and it is not the case that if it rains, then Fido flies.'],
            ['If it rains, then neither the dogs nor Fido flies.', 'Both it is not the case that if it rains, then the dogs fly, and it is not the case that if it rains, then Fido flies.'],
            ['If it rains, then neither Poe nor the dogs fly.', 'Both it is not the case that if it rains, then Poe flies, and it is not the case that if it rains, then the dogs fly.']]) &&
        !said('Both Poe and Fido fly if it rains.').readings.length,
        '"neither Poe nor Fido flies if it rains" offers the denial\'s two scopes, each name with its own verb ("the dogs fly"), each reading back (it had asked nothing); "both Poe and Fido" still asks nothing', J(neither));
    // The user, of "first Ann laughed if Mary left, and then Bob cried": "I
    // only see: 'If Mary left and then Bob cried, then Ann laughed'".
    const seq = [said('Ann laughed if Mary left and then Bob cried.'), said('Ann laughed unless Mary left and then Bob cried.'), said('Mary left and then Bob cried if it rained.')];
    ok(!seq[0].readings.length && seq[0].key === 'I(T[P:mary|~did left;P:bob|~did cried]>P:ann|~did laughed)' &&
        !seq[1].readings.length && seq[1].key === 'D[P:ann|~did laughed;T[P:mary|~did left;P:bob|~did cried]]' &&
        J(seq[2].readings) === J(['If it rained, then Mary left and then Bob cried.', 'Mary left, and then, if it rained, Bob cried.']),
        '"Ann laughed if Mary left and then Bob cried" asks nothing: the sequence is the condition, for a conditional is no step in a sequence; "Mary left, and then, if it rained, Bob cried" is still offered', J(seq));
    // The user, of the reading that splices: "If so, then I agree with you".
    const groups = [said('If it rains, then the ground is wet and the match is off and the roads close.'), said('Poe flies iff Fido sings, Rex barks, and Ann runs.'),
        said('If it rains, then Mary knows that Poe flies, Fido sings, and Rex barks.')];
    ok(J(groups[0].readings) === J(['If it rains, then (1) the ground is wet, (2) the match is off, and (3) the roads close.', 'The match is off, the roads close, and if it rains, then the ground is wet.',
            'The roads close, and if it rains, then both the ground is wet and the match is off.']) &&
        J(groups[1].readings) === J(['Poe flies iff (1) Fido sings, (2) Rex barks, and (3) Ann runs.', '(1) Poe flies iff Fido sings, (2) Rex barks, and (3) Ann runs.']) &&
        J(groups[2].readings) === J(['If it rains, then (1) Mary knows that Poe flies, (2) Fido sings, and (3) Rex barks.', 'Fido sings, Rex barks, and if it rains, then Mary knows that Poe flies.',
            'If it rains, then Mary knows that Poe flies, that Fido sings, and that Rex barks.']),
        'parts joined by "and" may group ("the ground is wet and the match is off"), parts commas alone join may not; a that-clause first may take in the list, with "that" again before each part (the user: "B")', J(groups));
}

console.log('\n-- a helping verb that is a noun too, where only the noun is English (r27.197) --');
{
    // The user: "After 'the', you need a noun phrase, so, 'The can hit the
    // wall' has only one reading as far as I can tell".
    const read = t => ev(`var r = parseClaimFull(${J(t)}); return { key: claimKey(r.form).replace(/\uE000/g, ''), asks: r.notes.filter(function (n) { return n.kind === 'ambiguous' && (n.readings || []).length; }).length,
        unread: r.notes.filter(function (n) { return n.kind === 'unread'; }).map(function (n) { return n.message; }) };`);
    const nouns = ['The can hit the wall.', 'The tin can rusted.', 'The tin can rolls.', 'The tin can did hit the wall.', 'The divine will commanded it.', 'The king\'s might crushed the rebels.',
        'The must fermented.', 'His might did hurt them.', 'The does eat grass.', 'Two does eat grass.', 'Our free will matters.', 'Every can is empty.'].map(read);
    // Since r27.198 "did hit" keys as "hit".
    ok(J(nouns.map(n => n.key)) === J(['P:the can|~hit the wall', 'P:the tin can|~did rusted', 'P:the tin can|~roll', 'P:the tin can|~hit the wall', 'P:the divine will|~did commanded it',
            "P:the king's might|~did crushed the rebels", 'P:the must|~did fermented', 'P:his might|~hurt them', 'P:the does|~eat grass', 'P:two does|~eat grass', 'P:our free will|~matter', 'U:=can|=empty']) &&
        nouns.every(n => !n.asks),
        'just after a determiner, or before what no modal takes (a past that is not its plain form, an -s word, another helping verb), "can", "will", "might", "must" and "does" are nouns, and nothing is asked ("The can hit the wall" had asked "Did you mean \'The is able to hit the wall\'...?")', J(nouns));
    const more = [read("God's will cannot be known."), read("Bob's will left Ann the farm."), read('Her will hurt Bob.'), read('Bob opened the can.'), read('Free will and determinism are compatible.')];
    ok(/^N\(P:god's will\|/.test(more[0].key) && /^P:bob's will\|~did left/.test(more[1].key) && /^P:her will\|~hurt bob$/.test(more[2].key) &&
        more[3].key === 'P:bob|~did opened the can' && !more[3].unread.length && /^A:free will and determinism together are compatible$/.test(more[4].key),
        '"God\'s will cannot be known", "Bob\'s will left ...", "Her will hurt Bob" have their nouns for subjects; "Bob opened the can" is read (it had been a clause cut short); "Free will and determinism are compatible" is one claim of the two together (it had been two, "free will" and "determinism is compatible")', J(more));
    const modal = ['The dog can swim.', 'The tin can hit the wall.', 'Good will come of it.', 'The free will win.', 'Bob does eat grass.', 'Mary can\'t swim, but the dog can.'].map(read);
    ok(modal[0].key === 'P:the dog|~can swim' && modal[1].key === 'P:the tin|~can hit the wall' && /^P:good\|~will come/.test(modal[2].key) && /^P:the free\|~will win/.test(modal[3].key) &&
        modal[4].key === 'P:bob|~eat grass' && modal[5].key === 'C[N(P:mary|~can swim);P:the dog|~can swim]',
        'where the modal is English -- "the dog can swim", "good will come of it" ("good" may be a noun), "the free will win", "the tin can hit the wall" (both are; asked later) -- it is read as before; an emphatic "does" still folds ("Bob does eat grass"); "but the dog can" is still the modal, its verb from the clause before', J(modal));
    const step = ev(`var trees = [{ id: 'M', type: 'contention', texts: ['The can is dented.'], collapsed: [], children: [{ id: 'S', type: 'support', texts: ['Everything that hit the wall is dented.', 'The can hit the wall.'], collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return st && st.rule ? st.rule.name : (st && st.why ? st.why.text : '');`);
    ok(step === 'universal modus ponens', '"Everything that hit the wall is dented; the can hit the wall; so the can is dented" follows (it had been held for "Did you mean \'The is able to hit the wall\'...?")', step);
}

console.log('\n-- a helping verb that may be a noun, where both are English; "is going to" (r27.198) --');
{
    // The user, of asking where both are English, under rule (a): "Sure"; of
    // teaching "is going to" as future "will": "ok".
    const said = t => ev(`var r = parseClaimFull(${J(t)}), ns = r.notes.filter(function (x) { return x.kind === 'ambiguous' && (x.readings || []).length; });
        return { key: claimKey(r.form).replace(//g, ''), asks: ns.map(function (n) { return { step: !!n.stepDecides, readings: n.readings.map(function (l, i) { var w = claimReadingWords(l, ${J(t)});
            return (claimReadingRoundTrips({ text: ${J(t)}, site: n.site, message: n.message }, i, w) ? '' : 'NOT BACK: ') + w; }) }; }) };`);
    const tin = said('The tin can hit the wall.'), must = said('The new must cost more.'), bob = said('Bob can hit the wall.'), marys = said("Mary's can hit the wall."), might = said('His might hurt them.');
    const kinds = (pre, post) => ['metaphysically', 'logically', 'physically'].map(k => pre + k + post);
    ok(J(tin.asks.map(a => a.readings)) === J([['The tin is able to hit the wall.'].concat(kinds('It is ', ' possible for the tin to hit the wall.'), ['The tin is allowed to hit the wall.', 'The tin can did hit the wall.'])]) &&
        must.asks.length === 1 && must.asks[0].readings[must.asks[0].readings.length - 1] === 'The new must did cost more.' &&
        J(bob.asks[0].readings) === J(['Bob is able to hit the wall.'].concat(kinds('It is ', ' possible for Bob to hit the wall.'), ['Bob is allowed to hit the wall.'])) &&
        marys.asks[0].readings.includes("Mary's can did hit the wall.") && might.asks.some(a => a.readings.includes('His might did hurt them.')),
        '"the tin can hit the wall" offers the noun beside the helping verb\'s readings, with "did" on its verb ("The tin can did hit the wall"); so "must", "might", "may"; not without a determiner ("Bob can")', J([tin, must, bob, marys]));
    const will = said('His last will cost him the farm.');
    ok(will.key === 'P:his last|~will cost him the farm' && J(will.asks.filter(a => a.step).map(a => a.readings)) === J([['His last will did cost him the farm.', 'His last is going to cost him the farm.']]),
        '"His last will cost him the farm" offers "His last will did cost him the farm" or "His last is going to cost him the farm", asked where a step turns on it', J(will));
    const keys = ['Bob is going to win.', 'Bob is not going to win.', 'Bob is going to school.', 'Bob did hit the wall.', 'Mary did read the book.', 'Some may read it.'].map(key).map(k => k.replace(//g, ''));
    const same = (x, y) => ev(`var a = parseClaim(${J(x)}), b = parseClaim(${J(y)}); return !!a && !!b && claimSame(a, b);`);
    ok(J(keys) === J(['P:bob|~will win', 'N(P:bob|~will win)', 'P:bob|=going to school', 'P:bob|~hit the wall', 'P:mary|~read the book', 'A:some may read it']) &&
        same('His last is going to cost him the farm.', 'His last will cost him the farm.') && same('Bob did hit the wall.', 'Bob hit the wall.'),
        '"is going to win" says what "will win" says (not "going to school"); "did hit" what "hit" says, a past spelled as its plain form being read with no tense; "Some may read it" is read as before r27.197', J(keys));
    const step = (ps, c) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, asked: st && st.why ? (st.why.ambiguous || []).map(function (a) { return a.readings.length; }) : [] };`);
    const held = step(['Everything that cost Ann the farm is cursed.', 'The old will cost Ann the farm.'], 'The old will is cursed.'),
        mp = step(['If the old will cost Ann the farm, then Ann is sad.', 'The old will cost Ann the farm.'], 'Ann is sad.');
    ok(held.rule === null && J(held.asked) === J([2]) && mp.rule === 'modus ponens',
        'a step that one reading gives waits for the answer; modus ponens stands, the clause read the same way in both boxes', J([held, mp]));
}

console.log('\n-- r27.199: every question asked where a step turns on it --');
{
    // The user, of which rule every question follows: "(a)" -- ask where a
    // step turns on it; of doing it next: "ok".
    const step = (ps, c, kind) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: ${J(kind || 'support')}, texts: ${J(ps)}, collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, why: st && st.why ? st.why.text || '' : '',
            asked: st && st.why ? (st.why.ambiguous || []).filter(function (a) { return a.readings.length; }).map(function (a) { return a.readings.length; }) : [] };`);
    const mp = step(['If Poe can fly, then Poe is a bird.', 'Poe can fly.'], 'Poe is a bird.'), flies = step(['Poe flies.'], 'Poe can fly.'), none = step(['Bob might win.'], 'Bob wins.');
    ok(mp.rule === 'modus ponens' && !mp.why && flies.rule === null && J(flies.asked) === J([5]) && none.rule === null && !none.why,
        'a step stands where every reading gives it ("if Poe can fly, ..." and "Poe can fly": one question, whether or not a name opens the box), waits where some do ("Poe flies", so "Poe can fly"), and does not follow, unasked, where none does ("Bob might win", so "Bob wins")', J([mp, flies, none]));
    const dog = step(['Every dog that barks is hungry.', 'A dog barks.'], 'The dog is hungry.');
    ok(dog.rule === null && dog.why === 'Did you mean “Every dog barks”, “Some dog barks”, or “Generally, a dog barks”?',
        'each box is read as written too: "a dog barks" gives "the dog is hungry" as written, where none of "every dog", "some dog" and "generally, a dog" does -- so the step waits for the answer, as it did', J(dog));
    // Said of a kind (r27.203): "possible for" alone asks which.
    const only = step(['Poe can fly.', 'Bob might win.'], 'It is physically possible for Poe to fly.');
    ok(only.why === 'Did you mean “Poe is able to fly”, “It is metaphysically possible for Poe to fly”, “It is logically possible for Poe to fly”, “It is physically possible for Poe to fly”, or “Poe is allowed to fly”?',
        'a step that waits asks what it turns on, and nothing else: not "might", which no answer of it changes', J(only));
    const lone = step(['We cannot conclude that God exists.'], 'God exists.', 'weak-objection'),
        lack = step(["If we lack reasons to think that the tests are reliable, then we can't conclude that the tests are reliable.", 'We lack reasons to think that the tests are reliable.'], 'The tests are reliable.', 'weak-objection'),
        repeats = step(['Poe can fly.'], 'Poe can fly.'), denied = step(["Poe can't fly."], 'Poe can fly.', 'objection');
    ok(J(lone.asked) === J([2]) && J(lack.asked) === J([2]) && /only repeats/.test(repeats.why) && !repeats.asked.length && J(denied.asked) === J([5, 5]),
        'a reading on which the box only says again what it is for, or a premise is idle, is valid but no argument: where another reading does not give the step, it asks ("we cannot conclude that God exists", a bare challenge on one reading; "we lack reasons ..." beside "if ..., then it is impossible for us to conclude ...", its conditional idle); where every reading is so, it does not ("only repeats")', J([lone, lack, repeats, denied]));
    const raised = step(['Bob does not think that it rains.'], 'Bob thinks that it does not rain.');
    ok(raised.why === 'Did you mean “It is not the case that Bob thinks that it rains” or “Bob thinks that it does not rain”?',
        '"does not think that it rains": the thought that it is not so, worded as one would write it -- "Bob thinks that it does not rain", which a step to those words turns on (it had been "thinks that it is not the case that it rains")', J(raised));
    const tin = step(['The tin can hit the wall.'], 'The tin can did hit the wall.');
    // And, said as where a step waits, not that a premise is not needed.
    const person = ev(`claimStepTurnsNow = true;
        try { var w = diagnoseDeductiveStep(['All ravens are black.', 'Poe is a raven.', 'Poe can fly.'], 'Poe is black.', false, null, false); return w ? w.text : ''; } finally { claimStepTurnsNow = false; }`);
    ok(tin.why === 'Did you mean “The tin is able to hit the wall”, “It is metaphysically possible for the tin to hit the wall”, “It is logically possible for the tin to hit the wall”, “It is physically possible for the tin to hit the wall”, “The tin is allowed to hit the wall”, or “The tin can did hit the wall”?' &&
        person === 'Did you mean “Poe is able to fly”, “It is metaphysically possible for Poe to fly”, “It is logically possible for Poe to fly”, “It is physically possible for Poe to fly”, or “Poe is allowed to fly”?',
        'where the step waits, the question is all it says: what the words as written would give is no hint, nor that a premise is not needed', J([tin, person]));
}

console.log('\n-- r27.200: the gaps r27.199 turned up --');
{
    // The user, of the gaps: "“et's try to fix these"; of "the dog" after "a
    // dog barks": "'the dog' has to refer back to the premise that generated
    // it ... What do you suggest?".
    const step = (ps, c) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, why: st && st.why ? st.why.text || '' : '' };`);
    const darii = step(['Every dog that barks is hungry.', 'Some dog barks.'], 'Some dog is hungry.'), plural = step(['All dogs that bark are hungry.', 'Some dogs bark.'], 'Some dogs are hungry.');
    ok(darii.rule === 'existential syllogism' && plural.rule === 'existential syllogism',
        '"every dog that barks is hungry" and "some dog barks" give "some dog is hungry", by existential syllogism: the kind is the "some" premise\'s two, together; so with "all dogs that bark"', J([darii, plural]));
    const the = step(['Every dog that barks is hungry.', 'Some dog barks.'], 'The dog is hungry.'), a = step(['Every dog that barks is hungry.', 'A dog barks.'], 'The dog is hungry.');
    ok(the.rule === 'universal modus ponens' && a.rule === null && a.why === 'Did you mean “Every dog barks”, “Some dog barks”, or “Generally, a dog barks”?',
        '"the dog" is the one "some dog" speaks of, as with "a dog": so "a dog barks", answered "some dog barks", gives "the dog is hungry"', J([the, a]));
    const forMary = [step(['Bob made a cake for Mary to have.'], 'Bob made a cake.'), step(["Bob bought a book on Mary's behalf."], 'Bob bought a book.'),
        step(['Bob made a cake for Mary.'], 'Bob made a cake.'), step(['Bob made Mary a cake.'], 'Bob made a cake.'), step(['Bob did not make a cake for Mary to have.'], 'Bob did not make a cake.')];
    // Named dropping a modifier since r27.201, as "quickly" is.
    ok(forMary[0].rule === 'dropping a modifier' && forMary[1].rule === 'dropping a modifier' && forMary[2].rule === 'dropping a modifier' &&
        forMary[3].rule === 'dropping a modifier' && !forMary[3].why && forMary[4].rule === null,
        'what is done for someone is done: "for Mary to have" and "on Mary\'s behalf" left out, by dropping a modifier; so "Bob made a cake for Mary" gives "Bob made a cake" on both readings, the box as written keeping it from standing no more, and "Bob made Mary a cake" follows on both its readings too, since r27.202 ("Bob made Mary into a cake" gives "Bob made a cake"); not under "not"', J(forMary));
    // "Everyone who is able to fly" splits since r27.202; a kind the reader
    // does not split keeps its article.
    const hint = step(['Everyone who is afraid of the dark is careful.'], 'Poe is careful.');
    ok(hint.why === '\u201cEveryone who is afraid of the dark is careful\u201d would give \u201cPoe is careful\u201d once it is shown that \u2018Poe is a person that is afraid of the dark\u2019.',
        'the case a rule needs, with its article: "Poe is a person that is afraid of the dark" (it had been "Poe is person that ...")', J(hint));
}

console.log('\n-- r27.201: three settings; a step in one; a denied part in its own words --');
{
    // The user, of Semantic mode: "If you want it to always ask, it does. If
    // you want it to only ask if a step turns on it, it does. If you want it
    // to never ask, it never asks"; of the mockup: "A"; of "it is not the case
    // that it rains, and it snows", so "it does not rain or it does not
    // snow": "It follows, but not in one step"; of "(1) It is not the case
    // that it rains, or (2) it snows": "The numbering is not necessary".
    const run = (rules, ps, c) => ev(`state.logic = { base: 'standard', rules: ${rules} }; claimRulesCache = null;
        var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0], out = { rule: st && st.rule ? st.rule.name : null, why: st && st.why ? st.why.text || '' : '' };
        state.logic = { base: 'standard', rules: { semantic: true } }; claimRulesCache = null; return out;`);
    const settings = ev(`var out = [{ semantic: 'always' }, {}, { semantic: true }, { semantic: false }].map(function (r) { state.logic = { base: 'standard', rules: r }; return claimSemanticSetting(); });
        state.logic = { base: 'standard', rules: { semantic: true } }; return out;`);
    const MP = [['If Poe can fly, then Poe is a bird.', 'Poe can fly.'], 'Poe is a bird.'], BAKERY = [['Mary runs and Bob owns the bakery.'], 'Bob owns the bakery.'];
    // A map switched on before (semantic: true) is checked anew after
    // "always": its steps are kept by the setting's value.
    // A map that says nothing is "never" since r27.207 ("turns" before).
    const always = run("{ semantic: 'always' }", ...MP), on = run('{ semantic: true }', ...MP), turns = run('{ semantic: true }', ...MP), never = run('{ semantic: false }', ...MP),
        bakery = run("{ semantic: 'always' }", ...BAKERY), bakeryTurns = run('{ semantic: true }', ...BAKERY);
    ok(J(settings) === J(['always', 'never', 'turns', 'never']) && always.rule === null && /^“If Poe can fly, then Poe is a bird\.”: did you mean /.test(always.why) &&
        on.rule === 'modus ponens' && turns.rule === 'modus ponens' && never.rule === 'modus ponens' && bakery.rule === null &&
        bakery.why === 'Did you mean “Mary runs, and Bob owns, the bakery” or “Mary runs, and Bob owns the bakery”?' && bakeryTurns.rule === 'conjunction elimination',
        'three settings: "always ask", every question held for its answer ("Mary runs, and Bob owns, the bakery"); "ask where a step turns on it", as a map switched on had it; "never ask", the default since r27.207 -- each step checked anew when the setting changes', J([settings, always, on, turns, never, bakery, bakeryTurns]));
    const two = run('{ semantic: true }', ['It is not the case that it rains and it snows.'], 'It does not rain or it does not snow.');
    ok(two.rule === null && two.why === 'Did you mean “It is not the case that both it rains and it snows” or “It does not rain, and it snows”?',
        'a step stands where every reading gives it in one step: on "it does not rain, and it snows" it takes two, so it asks (r27.200 had let it stand)', J(two));
    const words = ev(`return ['It is not the case that it rains or it snows.', 'It is not the case that it rains and it snows.', 'It is not the case that it rains, it snows, or it hails.'].map(function (t) {
        var n = parseClaimFull(t).notes.filter(function (x) { return x.kind === 'ambiguous'; })[0]; return n ? claimReadingWords(n.readings[1], t) : null; });`);
    ok(J(words) === J(['It does not rain, or it snows.', 'It does not rain, and it snows.', 'Either it does not rain, it snows, or it hails.']),
        'the first part alone denied, in its own words, and no numbers: "It does not rain, or it snows" (it had been "(1) It is not the case that it rains, or (2) it snows"); three with "or", "Either ..." (r27.202)', J(words));
    ok(ev(`return DEDUCTIVE_OPTIONAL_RULES.find(function (r) { return r.id === 'modifiers'; }).gloss;`).indexOf('"Bob made a cake for Mary to have" gives "Bob made a cake"') > 0,
        'dropping a modifier says so of "for Mary to have" too');
}

console.log('\n-- r27.202: "made into"; ability and the kinds of possibility; the case a rule needs --');
{
    // The user, of "made X into Y" gives "made Y": "ok"; of ability giving
    // physical possibility, and the kinds nesting: "yes, I want both"; of the
    // case said with the reading it needs: "ok"; of the hint: "Shouldn't it
    // be 'Set Semantic mode to "Ask" in the Logic panel ...'? Why the commas?".
    const step = (ps, c) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
        var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, why: st && st.why ? st.why.text || '' : '' };`);
    const into = [step(['Bob made Mary into a cake.'], 'Bob made a cake.'), step(['Bob made the clay into a pot.'], 'Bob made a pot.'), step(['Bob did not make Mary into a cake.'], 'Bob did not make a cake.')];
    ok(into[0].rule === 'making X into Y' && into[1].rule === 'making X into Y' && into[2].rule === null,
        '"Bob made Mary into a cake" gives "Bob made a cake", as "the clay into a pot" gives "a pot"; not under "not"', J(into));
    const able = [step(['Poe is able to fly.'], 'It is physically possible for Poe to fly.'), step(['Poe is able to fly.'], 'It is possible for Poe to fly.'),
        step(['Poe is not able to fly.'], 'It is not physically possible for Poe to fly.')];
    ok(able[0].rule === 'ability gives possibility' && able[1].rule === null &&
        able[1].why === 'Did you mean “It is metaphysically possible for Poe to fly”, “It is logically possible for Poe to fly”, or “It is physically possible for Poe to fly”?' && able[2].rule === null &&
        key('It is physically possible for Poe to fly.').replace(//g, '') === key('It is physically possible that Poe flies.').replace(//g, ''),
        'what one is able to do is possible -- physically; "possible for" alone asks which kind, in one step only physically (r27.203); not "not able"; "it is physically possible for Poe to fly" says what "... that Poe flies" says', J(able));
    const kinds = [step(['It is physically possible that Poe flies.'], 'It is logically possible that Poe flies.'), step(['It is physically possible for Poe to fly.'], 'It is metaphysically possible for Poe to fly.'),
        step(['It is logically necessary that Poe flies.'], 'It is physically necessary that Poe flies.'), step(['It is logically possible that Poe flies.'], 'It is physically possible that Poe flies.'),
        step(['Poe is able to fly.'], 'It is logically possible for Poe to fly.')];
    ok(kinds[0].rule === 'kinds of possibility' && kinds[1].rule === 'kinds of possibility' && kinds[2].rule === 'kinds of possibility' && kinds[3].rule === null &&
        kinds[4].rule === null && /^Getting to “It is logically possible for Poe to fly” takes two steps\. First, “Poe is able to fly” gives “It is physically possible for Poe to fly” by ability gives possibility\. Then /.test(kinds[4].why),
        'the kinds nest: physically possible gives metaphysically and logically possible, logically necessary gives physically necessary -- not the other way; from "able" to "logically possible", two steps, the one between them said', J(kinds));
    const short = step(['Everyone who is able to fly is happy.', 'Poe can fly.'], 'Poe is happy.'), shown = step(['Everyone who is able to fly is happy.', 'Poe is a person.', 'Poe is able to fly.'], 'Poe is happy.');
    ok(short.why === '“Everyone who is able to fly is happy” would give “Poe is happy” once it is shown that ‘Poe is a person’, with “Poe can fly” read as “Poe is able to fly”.' &&
        shown.rule === 'universal modus ponens',
        'the case a rule needs, and the reading a box needs for it: "once it is shown that \'Poe is a person\', with \'Poe can fly\' read as \'Poe is able to fly\'"; "everyone who is able to fly" is a person, and able to fly', J([short, shown]));
    ok(ev(`return CLAIM_SEMANTIC_HINT;`) === 'On another reading of its words, the step follows: set Semantic mode to “Ask where a step turns on it” in the Logic panel to choose that reading.',
        'the hint names the setting, without commas');
    const notes = ev(`return [LOGIC_GROUP_GLOSSES.able, LOGIC_GROUP_GLOSSES.kinds, (DEDUCTIVE_EXTENSIONS.find(function (g) { return g.id === 'kinds'; }) || {}).label];`);
    ok(/"Poe is able to fly" gives "it is physically possible for Poe to fly"/.test(notes[0]) && /^Word meaning, not logic: what is physically possible is metaphysically possible/.test(notes[1] || '') &&
        notes[2] === 'Word meaning: kinds of possibility',
        'in the Logic panel: "Word meaning: kinds of possibility", with its note, and the note of "can" and "-able" says what ability gives', J(notes));
}

console.log('\n-- r27.203: which kind of "possible"; "can" of five; the reductio\'s two "possible"s --');
{
    // The user, of a reductio on "both zombies are possible and zombies are
    // not possible", that asks which kind each is: "ok"; of a bare "possible"
    // asking which kind where a step turns on it: "ok"; of the five readings
    // of "can": "ok"; of the numbers left: "I'll go with your recommendation".
    const step = (ps, c, rules) => ev(`state.logic = { base: 'standard', rules: ${J(Object.assign({ semantic: true }, rules || {}))} }; deductiveCache.clear();
        try { var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
            var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, why: st && st.why ? st.why.text || '' : '' }; }
        finally { state.logic = { base: 'standard', rules: { semantic: true } }; deductiveCache.clear(); }`);
    const readings = t => ev(`return parseClaimFull(${J(t)}).notes.filter(function (n) { return n.kind === 'ambiguous'; }).map(function (n) { return n.readings.map(function (l) { return claimReadingWords(l, ${J(t)}); }); });`);
    const both = 'If physicalism is false, then both zombies are possible and zombies are not possible.';
    const z = [step([both], 'Physicalism is true.'),
        step(['If physicalism is false, then both zombies are metaphysically possible and zombies are not possible.'], 'Physicalism is true.'),
        step(['If physicalism is false, then both zombies are metaphysically possible and zombies are not metaphysically possible.'], 'Physicalism is true.'),
        step(['If physicalism is false, then both zombies are metaphysically possible and zombies are not physically possible.'], 'Physicalism is true.'),
        step([both], 'Physicalism is true.', { semantic: false })];
    ok(z[0].rule === null && z[0].why.indexOf('“' + both + '”: did you mean “If physicalism is false, then both zombies are metaphysically possible and zombies are not possible”') === 0 &&
        z[0].why.indexOf('did you mean “If physicalism is false, then both zombies are possible and zombies are not metaphysically possible”') > 0 &&
        z[1].rule === null && z[1].why.indexOf('Did you mean “If physicalism is false, then both zombies are metaphysically possible and zombies are not metaphysically possible”') === 0 &&
        z[2].rule === 'reductio' && z[3].rule === null && /differ: “physically” in one where the other has “metaphysically”/.test(z[3].why) && z[4].rule === 'reductio',
        'a reductio on "both zombies are possible and zombies are not possible" asks which kind each "possible" is -- two questions, answering one leaves the other (each had kept the other from being offered, and the reductio stood); of one kind, it stands; of two, they differ; never asking, as written, it stands', J(z));
    const mt = [step(['If it rains, then it is possible that Poe flies.', 'It is not possible that Poe flies.'], 'It does not rain.'),
        step(['If it rains, then it is possible that Poe flies.', 'It is not possible that Poe flies.'], 'It does not rain.', { semantic: false })];
    ok(J(readings('It is not possible that Poe flies.')) === J([['It is metaphysically impossible that Poe flies.', 'It is logically impossible that Poe flies.', 'It is physically impossible that Poe flies.',
            'It has been established that Poe does not fly.', 'We know that Poe does not fly.']]) &&
        mt[0].rule === null && /“It is not possible that Poe flies[.]”: did you mean “It is metaphysically impossible that Poe flies”/.test(mt[0].why) && mt[1].rule === 'modus tollens' &&
        key('It is not possible that Poe flies.') === 'N(A:possible, poe flies)' && key('It is not possible that Poe flies.') === key('It is not the case that it is possible that Poe flies.'),
        '"it is not possible that Poe flies" asks which kind, as "it is impossible that" does; as written, it denies "it is possible that Poe flies": modus tollens (it had been read as said of "it")', J(mt));
    const kinds = (pre, post) => ['metaphysically', 'logically', 'physically'].map(k => pre + k + post);
    ok(J(readings('It is possible for Poe to fly.')) === J([kinds('It is ', ' possible for Poe to fly.')]) &&
        J(readings('It is impossible for Poe to fly.')) === J([kinds('It is ', ' impossible for Poe to fly.')]) &&
        J(readings('It is not possible for Poe to fly.')) === J([kinds('It is not ', ' possible for Poe to fly.')]) &&
        J(readings('Poe can fly.')) === J([['Poe is able to fly.'].concat(kinds('It is ', ' possible for Poe to fly.'), ['Poe is allowed to fly.'])]),
        '"it is possible for Poe to fly", "impossible", "not possible": which kind, metaphysically, logically or physically; "Poe can fly": able, possible of each kind, or allowed', '');
    const esse = [step(['Poe flies.'], 'It is physically possible for Poe to fly.'), step(['Poe flies.'], 'It is logically possible that Poe flies.'), step(['Poe flies.'], 'It is metaphysically possible for Poe to fly.')];
    ok(esse[0].rule === 'ab esse ad posse' && esse[1].rule === 'ab esse ad posse' && esse[2].rule === null && /by axiom T/.test(esse[2].why),
        'what is, is physically and logically possible (ab esse ad posse); metaphysically, by the map\'s axiom T, where its system has it', J(esse));
    const keys = ['It is physically possible for Poe to fly or swim.', 'It is not physically possible for Poe to beat any player.', 'It is metaphysically possible for Mary to sing and Bob cannot dance.'].map(key);
    ok(J(keys) === J(['D[◇phys(P:poe|~fly);◇phys(P:poe|~swim)]', '□phys(N(P:poe|~beat player))', 'C[◇meta(P:mary|~sing);N(P:bob|~can dance)]']) &&
        step(['It is physically possible for Poe to fly or swim.', 'It is not physically possible for Poe to fly.'], 'It is physically possible for Poe to swim.').rule === 'disjunctive syllogism',
        'of a kind: "to fly or swim", possible to fly or possible to swim (so disjunctive syllogism); "not ... to beat any player", no player; "to sing and Bob cannot dance", two claims', J(keys));
    ok(J(readings('It is not the case that it rains, it snows, or it hails.')) === J([['It is not the case that either it rains, it snows, or it hails.', 'Either it does not rain, it snows, or it hails.']]) &&
        J(readings('If physics is complete, then it rains and it snows.')) === J([['If physics is complete, then both it rains and it snows.', 'It snows, and if physics is complete, then it rains.']]) &&
        J(readings('It snows if it rains and it is cold.')) === J([['It snows if both it rains and it is cold.', 'It is cold, and if it rains, then it snows.']]) &&
        J(readings('It is not the case that it rains or it snows.')) === J([['It is not the case that either it rains or it snows.', 'It does not rain, or it snows.']]),
        'no numbers where words read back as they do: "it is not the case that either it rains, it snows, or it hails"; the weather\'s "it" may go first ("It snows, and if physics is complete, then it rains"); a denial in its own words still comes first ("It does not rain, or it snows")', '');
    const notes = ev(`return [LOGIC_GROUP_GLOSSES.able, (DEDUCTIVE_OPTIONAL_RULES.find(function (g) { return g.id === 'ab-esse-ad-posse'; }) || {}).gloss];`);
    ok(/"Poe flies" gives "it is physically possible for Poe to fly" and "it is logically possible for Poe to fly"/.test(notes[0]) && /"Poe flies" gives "it is physically possible for Poe to fly"/.test(notes[1] || ''),
        'the Logic panel says what "what is, can be" gives', J(notes));
}

console.log('\n-- r27.204: a pronoun before the one name it may be: the name, or someone else --');
{
    // The user, of "Despite her doubts, Mary agreed" and "With his help, Bob
    // won": "they should behave the same, however obvious one reading is"; of
    // asking, the name offered with "Other": "ok".
    const step = (ps, c, rules) => ev(`state.logic = { base: 'standard', rules: ${J(Object.assign({ semantic: true }, rules || {}))} }; deductiveCache.clear();
        try { var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
            var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, why: st && st.why ? st.why.text || '' : '' }; }
        finally { state.logic = { base: 'standard', rules: { semantic: true } }; deductiveCache.clear(); }`);
    const asked = t => ev(`return parseClaimFull(${J(t)}).notes.filter(function (n) { return n.kind === 'ambiguous' && n.pronoun; })
        .map(function (n) { return [n.message, n.readings.length, (n.texts || [])[0] || null]; });`);
    const asks = ['Before she left, Mary called.', 'Despite her doubts, Mary agreed.', 'With his help, Bob won.', 'His dog loves Bob.', 'If he wins, then Bob is happy.', 'In his view, Bob is right.',
        'According to her, Mary is right.'].map(asked);
    ok(J(asks.map(a => a.length === 1 ? a[0][2] : null)) === J(['Before Mary left, Mary called.', "Despite Mary's doubts, Mary agreed.", "With Bob's help, Bob won.", "Bob's dog loves Bob.",
            'If Bob wins, then Bob is happy.', "In Bob's view, Bob is right.", 'According to Mary, Mary is right.']) &&
        asks.every(a => a[0][1] === 2 && /may be “(?:Mary|Bob)”, or someone the box does not name$/.test(a[0][0])),
        'a pronoun before the box\'s one name -- after a clause or a phrase in front, or "his" before a noun -- may be that name or someone the box does not name: asked, the name offered, and "Other" (it had been the name after a clause, and no one after a phrase or in "His dog loves Bob")', J(asks));
    const none = ['She met Mary.', 'He said that Bob left.', 'Before she met her, Mary left.'].map(asked);
    ok(none.every(a => a.length === 1 && a[0][1] === 0 && /has nothing in this box to refer to/.test(a[0][0])),
        'not where it cannot be the name -- the subject of a clause the name is in, or two in one clause, one the other\'s object: it has nothing in this box to refer to, as before', J(none));
    const s = [step(['If he wins, then Bob is happy.', 'Bob wins.'], 'Bob is happy.'), step(['Although she was tired, Mary agreed.'], 'Mary agreed.'),
        step(['Although she was tired, Mary agreed.'], 'Mary was tired.'), step(['If he wins, then Bob is happy.', 'Bob wins.'], 'Bob is happy.', { semantic: false }),
        step(['If Bob wins, then Bob is happy.', 'Bob wins.'], 'Bob is happy.'), step(['His dog loves Bob.'], 'Something loves Bob.')];
    ok(s[0].rule === null && s[0].why === 'Did you mean “If Bob wins, then Bob is happy”, or is “he” someone else?' &&
        s[1].rule === 'conjunction elimination' && s[2].rule === null && s[2].why === 'Did you mean “Although Mary was tired, Mary agreed”, or is “she” someone else?' &&
        s[3].rule === 'modus ponens' && s[4].rule === 'modus ponens' && s[5].rule === 'existential introduction',
        'where a step turns on it, it asks "Did you mean ..., or is "he" someone else?"; where it holds whoever the pronoun is, it stands ("Although she was tired, Mary agreed", so "Mary agreed"); never asking, the pronoun is read as the name, as before r27.204 (r27.205); with the name, modus ponens', J(s));
}

console.log('\n-- r27.205: a pronoun after the one name asks too --');
{
    // The user, of asking after the name too -- the name, or someone else,
    // where a step turns on it, reversing "the only available referent is the
    // referent" (2026-09-28): "ok".
    const step = (ps, c, rules) => ev(`state.logic = { base: 'standard', rules: ${J(Object.assign({ semantic: true }, rules || {}))} }; deductiveCache.clear();
        try { var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
            var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, why: st && st.why ? st.why.text || '' : '' }; }
        finally { state.logic = { base: 'standard', rules: { semantic: true } }; deductiveCache.clear(); }`);
    const asked = t => ev(`return parseClaimFull(${J(t)}).notes.filter(function (n) { return n.kind === 'ambiguous' && n.pronoun; }).map(function (n) { return n.message; });`);
    const s = [step(['Bob left and then she cried.'], 'Bob cried.'), step(['Bob left and then she cried.'], 'Bob left.'), step(['Bob left and then she cried.'], 'Bob cried.', { semantic: false }),
        step(['When Mary exits the room and sees a ripe red tomato, she learns a new fact.', 'If, when Mary exits the room and sees a ripe red tomato, she learns a new fact, then physicalism is false.'], 'Physicalism is false.')];
    // With a comma between the clauses since r27.206.
    ok(s[0].rule === null && s[0].why === 'Did you mean “Bob left, and then Bob cried”, or is “she” someone else?' && s[1].rule === 'conjunction elimination' && s[2].rule === 'conjunction elimination' &&
        s[3].rule === 'modus ponens',
        'after the name too: "Bob left and then she cried", so "Bob cried", asks -- it had been read with Bob, the box\'s one name, and followed; "Bob left" follows whoever she is; never asking, it is read with the name, as before; the same clause in two boxes is one question, so modus ponens stands', J(s));
    const more = ['Mary said that the dog bit her.', 'Bob is sad about learning that someone never loved him.', 'Mary believes that she is late.'].map(asked);
    ok(more.every(m => m.length === 1 && /may be “(?:Mary|Bob)”, or someone the box does not name$/.test(m[0])),
        'so across "that" ("said that the dog bit her", "believes that she is late") and in "learning that someone never loved him"', J(more));
}

console.log('\n-- r27.206: a comma between independent clauses in the app\'s own wordings; "yet" without one --');
{
    // The user: "I just don't want the app to recommend sentences without
    // commas for independent clauses. Others can omit them when it doesn't
    // force an ambiguity, however, and the app should be able to parse them
    // appropriately."
    const step = (ps, c, rules) => ev(`state.logic = { base: 'standard', rules: ${J(Object.assign({ semantic: true }, rules || {}))} }; deductiveCache.clear();
        try { var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [{ id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
            var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, why: st && st.why ? st.why.text || '' : '' }; }
        finally { state.logic = { base: 'standard', rules: { semantic: true } }; deductiveCache.clear(); }`);
    const commas = ts => ev(`return typeof claimClauseCommas === 'function' ? ${J(ts)}.map(function (t) { return claimClauseCommas(t); }) : null;`);
    const put = ['Bob left and then Bob cried', 'Bob left, Mary cried and Ann laughed', 'Bob sings and either Mary dances or Ann runs', 'Bob is happy and so is Mary',
        'Poe must fly or Poe swims', 'There is a god and God is good', 'Bob left and if Mary cried, then Ann laughed'];
    ok(J(commas(put)) === J(['Bob left, and then Bob cried', 'Bob left, Mary cried, and Ann laughed', 'Bob sings, and either Mary dances or Ann runs', 'Bob is happy, and so is Mary',
            'Poe must fly, or Poe swims', 'There is a god, and God is good', 'Bob left, and if Mary cried, then Ann laughed']),
        'a comma between two clauses an "and", "but", "or" or "yet" joins at the top of the sentence: "Bob left, and then Bob cried"; a series takes its last one; one "and" at the top before "either ... or"', J(commas(put)));
    const kept = ['It is not the case that it rains and it snows', 'If it rains, then it is wet and it is cold', 'Necessarily, Bob left and Mary cried', 'Possibly Bob left and Mary cried',
        'Either it is raining or it is cold, and it is snowing', 'Bob sings and Mary dances, or Ann runs', 'Bob is tall and kind', 'Bob loves Mary and Ann', 'O and R together make an attack',
        '"All ravens fly" and "some ravens fly" have one subject', 'No save is asked for -- and a declined save writes nothing'];
    ok(J(commas(kept)) === J(kept),
        'not where the clauses are under something before them ("that", "if", a phrase or an adverb in front), inside "either ... or", where two kinds of joining word would leave it unclear which joins what, nor between words, letters or quotations', J(commas(kept)));
    const s = [step(['Bob bought a book for Mary and Al cried.'], 'Bob bought Mary a book.'), step(['If it is cold and the street is wet, then Bob stays in.', 'It is cold, and the street is wet.'], 'Bob stays in.')];
    ok(s[0].why === 'Did you mean “Bob bought a book on Mary\'s behalf, and Al cried” or “Bob bought Mary a book, and Al cried”?' && s[1].rule === 'modus ponens',
        'the readings offered say it, and written in so, the box reads as the reading: modus ponens', J(s));
    const typo = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['Mary cried.'], collapsed: [], x: 0, y: 0, children: [
            { id: 'A', type: 'support', texts: ['Bob left and  Mary cried.'], collapsed: [], children: [] } ] }];
        ensureCollabFields(state); selectedIds = []; render(); deductiveChecked.add('A'); refreshDerivationTags();
        var tag = document.querySelector('.derivation-tag[data-step="A"]'); deductiveChecked.clear(); refreshDerivationTags();
        return tag ? tag.title : null;`);
    ok(/has a typo: two spaces after “and” — “Bob left, and Mary cried\.”\. Read as “Bob left, and Mary cried\.”, the step follows by conjunction elimination/.test(typo || ''),
        'so a typo\'s fix: "Bob left, and Mary cried"', J(typo));
    const yet = [step(['Bob left yet Mary stayed.'], 'Mary stayed.'), step(['Zombies are conceivable yet physicalism is true.'], 'Physicalism is true.'),
        step(['Bob is tall yet kind.'], 'Bob is kind.')];
    const time = ev(`return ['Bob may yet win.', 'Bob has not yet left.', 'Bob is yet to leave.'].map(function (t) { var f = parseClaim(t); return f ? f.kind : null; });`);
    ok(yet[0].rule === 'conjunction elimination' && yet[1].rule === 'conjunction elimination' && yet[2].rule === 'conjunction elimination' &&
        J(time) === J(['pred', 'not', 'pred']),
        '"yet" between two clauses without a comma joins them, as with one ("Bob left yet Mary stayed", so "Mary stayed"; it had been read as one claim), and between two adjectives, as "but" does; not the "yet" of time ("Bob may yet win", "has not yet left", "is yet to leave", "has yet to be shown")', J([yet, time]));
}

console.log('\n-- r27.207: "Never ask" is the default --');
{
    // The user, of making it the default: "Do this. Since logic students will
    // be using it, they'll be better with it off."
    const r = ev(`var keep = state.logic, out = {};
        var step = function (rules, ps, c) { state.logic = rules === null ? null : { base: 'standard', rules: rules }; claimRulesCache = null; deductiveCache.clear();
            var trees = [{ id: 'M', type: 'contention', texts: [c], collapsed: [], children: [{ id: 'S', type: 'support', texts: ps, collapsed: [], children: [] }] }];
            var st = collectDeductiveSteps(trees)[0]; return { rule: st && st.rule ? st.rule.name : null, why: st && st.why ? st.why.text || '' : '' }; };
        state.logic = null; claimRulesCache = null; out.none = claimSemanticSetting();
        state.logic = { base: 'standard', rules: {} }; claimRulesCache = null; out.empty = claimSemanticSetting();
        out.she = step(null, ['Bob left and then she cried.'], 'Bob cried.');
        out.can = step({}, ['Poe can fly.'], 'Poe is able to fly.');
        out.on = step({ semantic: true }, ['Bob left and then she cried.'], 'Bob cried.');
        state.logic = { base: 'standard', rules: {} };
        switchSemanticSetting('turns'); out.turns = [state.logic.rules.semantic, claimSemanticSetting()];
        switchSemanticSetting('always'); out.always = [state.logic.rules.semantic, claimSemanticSetting()];
        switchSemanticSetting('never'); out.never = ['semantic' in state.logic.rules, claimSemanticSetting()];
        state.logic = keep; claimRulesCache = null; deductiveCache.clear(); return out;`);
    ok(r.none === 'never' && r.empty === 'never' && r.she.rule === 'conjunction elimination' && r.can.rule === null &&
        r.on.rule === null && r.on.why === 'Did you mean “Bob left, and then Bob cried”, or is “she” someone else?' &&
        J(r.turns) === J([true, 'turns']) && J(r.always) === J(['always', 'always']) && J(r.never) === J([false, 'never']),
        'a map that says nothing reads each box as written and asks nothing: "Bob left and then she cried", so "Bob cried", with "she" read as Bob, and "Poe can fly" gives no "able"; switched to "Ask where a step turns on it", the map says so, and it asks; "Never ask" says nothing', J(r));
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
