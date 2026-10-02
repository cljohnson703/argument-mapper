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
        var st = collectDeductiveSteps(trees)[0]; return st ? { rule: st.rule ? st.rule.name : null, tag: deductiveStepTagText(st), asked: (st.why && st.why.ambiguous || []).map(function (a) { return a.readings.length; }) } : null;`);
    const yes = tag(['Mary sings and loves Bob.'], 'Mary loves Bob.'), wait = tag(['Mary sings and loves Bob.'], 'Mary sings.');
    ok(yes && yes.rule === 'conjunction elimination' && wait && !wait.rule && J(wait.asked) === '[2]',
        'on the map: "so Mary loves Bob" is certified; "so Mary sings" offers the two readings', J([yes, wait]));
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
    ok(hall.key === 'C[P:mary|~did sang;P:mary|~did danced in the hall]' && hall.notes.length === 1 && !hall.notes[0].always &&
        hall.notes[0].message === '"in the hall" may go with "sang" as well as "danced", or with "danced" alone' &&
        J(hall.notes[0].readings) === J(['mary sang, and danced, in the hall', 'mary sang, and mary danced in the hall']),
        'a place after two verbs is asked about, when a step needs it; meanwhile the box says what both readings say', J(hall));
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
    ok(sang && sang.rule === 'conjunction elimination' && inHall && !inHall.rule && J(inHall.asked) === '[2]' && risky && !risky.rule && J(risky.asked) === '[2]',
        'on the map: "so Mary sang" passes; "so Mary sang in the hall" asks; the "if" step that needs the hall for "danced" only asks, not passes', J([sang, inHall, risky]));
    ok(owns && owns.rule === 'conjunction elimination' && runs && !runs.rule && J(runs.asked) === '[2]',
        '"so Bob owns the bakery" passes on every reading; "so Mary runs" asks', J([owns, runs]));
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
    const readings = 'if it rains, then poe flies and sings | (1) poe flies, and (2) poe sings if it rains';
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
        three[0].readings[1] === '(1) Poe flies, (2) if it rains, then Poe sings, and (3) Fido barks.',
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
    const twice = ev(`var r = parseClaimFull('If the raven is black, then the raven is wise and it sings.'); return { key: claimKey(r.form).replace(/\uE000/g, ''), asks: r.notes.filter(function (n) { return n.kind === 'ambiguous'; }).length };`);
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
        notesOf('It is not the case that Poe flies, and Fido sings.', { site: 0, reading: 1 }).key === 'C[N(P:poe|~fly);P:fido|~sing]' &&
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
    const yes = [tag(['We can conceive of zombies.'], 'Zombies are conceivable.'), tag(['We can conceive of zombies.'], 'Zombies can be conceived.'),
        tag(['Zombies can be conceived.'], 'Zombies are conceivable.'), tag(['Mary can prove the theorem.'], 'The theorem is provable.')];
    ok(yes.every(r => r && r.rule === 'meaning of \u2018-able\u2019'),
        '"we can conceive of zombies" gives "zombies are conceivable" and "zombies can be conceived", by the meaning of "-able"; so "provable"', J(yes));
    const no = [tag(['Zombies are conceivable.'], 'We can conceive of zombies.'), tag(['We cannot conceive of zombies.'], 'Zombies are not conceivable.'),
        tag(['We can read the book.'], 'The book is readable.'), tag(['We can conceive of a zombie.'], 'Zombies are conceivable.')];
    ok(no.every(r => r && !r.rule), 'never the other way; nor from "cannot"; nor for a word whose meaning has moved ("readable"); nor from another number', J(no));
    const direct = tag(['If zombies are conceivable, then zombies are possible.', 'We can conceive of zombies.'], 'Zombies are possible.');
    ok(direct && !direct.rule && /\u201cWe can conceive of zombies\.\u201d gives \u201cZombies are conceivable\u201d by the meaning of \u2018-able\u2019: with that as a box of its own, this would follow by modus ponens\./.test(direct.why),
        'the direct route is not one step: its explanation names the box that is missing', J(direct));
    const off = ev(`var was = state.logic; state.logic = { base: 'standard', rules: {} }; setDeductiveRule('able-meaning', false);
        var trees = [{ id: 'M', type: 'contention', texts: ['Zombies are conceivable.'], collapsed: [], children: [{ id: 'S', type: 'support', texts: ['We can conceive of zombies.'], collapsed: [], children: [] }] }];
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

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
