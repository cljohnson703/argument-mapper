'use strict';
/**
 * Qualified claims, positions, plurals and wording.
 *
 *   node language-r27-qualifier-test.js [argument-mapper-r27.html]
 *
 * 1. A qualifier is never dropped or folded into a subject: "I think that P",
 *    "probably P", "according to Bob, P", "in Hamlet, P", "apparently P" do
 *    not give P, nor anything about P's subject.
 * 2. Hedges that say how likely P is ("probably", "likely", "might",
 *    "presumably") challenge P when a reason brings them, as "perhaps" does
 *    (alone, they are bare challenges: no argument); "possibly" and
 *    "it is possible that" are flagged (what we know, or what could be);
 *    "when", "given that", "in case", "while" are flagged, not read as "if"
 *    or "and"; "Bob thinks that P" says something of Bob.
 * 3. Position: a phrase moved ("Y, if X"; "P, probably"; "P, Bob thinks")
 *    leaves the claim as it was; different words stay different claims.
 * 4. Plurals of every spelling class singularize; verbs in -es, -ies, -oes
 *    deny by "does not"; textbook forms ("only if P is Q", "otherwise",
 *    "ravens are all black", "the only", gerunds, "suppose").
 * 5. Quantifiers inside a predicate are logic too: "loves every raven" is
 *    "loves all ravens", "loves a raven" is "loves some raven"; a verb that
 *    can take its object together ("gathered all the sheep") keeps "all".
 * 6. A step that would follow if two claims were worded alike says which
 *    words differ; "the argument with premises “A” and “B” is unsound" is
 *    read as a claim about that argument.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || 'argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/qualifier-test', virtualConsole: vc,
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
// One step as the map checks it: kind 'support' | 'objection' | 'weak-objection'.
const step = (ps, c, kind) => ev(`var n = 0; var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [
    { id: 'S', type: ${J(kind || 'support')}, texts: ${J(ps)}, collapsed: [], children: [] }] }];
    var s = collectDeductiveSteps(trees)[0]; return { rule: s.rule ? s.rule.name : null, ambiguous: !!s.ambiguous, why: s.why ? s.why.text : '', bare: !!s.bare, bareChallenge: !!s.bareChallenge };`);
const same = (x, y) => ev('var a = parseClaim(' + J(x) + '), b = parseClaim(' + J(y) + '); return !!a && !!b && claimSame(a, b);');
const kindOf = t => ev('var f = parseClaim(' + J(t) + '); return f ? f.kind : null;');
let passed = 0, failed = 0;
function ok(cond, label, detail) {
    if (cond) { passed++; console.log('  ✓ ' + label); }
    else { failed++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}
const none = (cases, kind) => cases.filter(([p, c]) => step(p, c, kind).rule).map(([p, c]) => p.join(' | ') + ' ⊢ ' + c);
const all = (cases, kind) => cases.filter(([p, c]) => !step(p, c, kind).rule).map(([p, c]) => p.join(' | ') + ' ⊢ ' + c);

try {
    console.log('\n-- a qualifier is never dropped --');
    {
        const leaks = [
            [['All ravens are black.', 'I think that Poe is a raven.'], 'I think that Poe is black.'],
            [['All ravens are black.', 'Probably, Poe is a raven.'], 'Probably, Poe is black.'],
            [['All ravens are black.', 'It seems that Poe is a raven.'], 'It seems that Poe is black.'],
            [['I think that Poe is black.'], 'Something is black.'],
            [['Supposedly Poe is a raven.', 'All ravens are black.'], 'Supposedly Poe is black.'],
            [['Everyone who is a thief is guilty.', 'Allegedly, Poe is a thief.'], 'Allegedly, Poe is guilty.'],
            [['According to Bob, Poe is a raven.', 'All ravens are black.'], 'According to Bob, Poe is black.'],
            [['Probably, Poe is black.'], 'Poe is black.'], [['Poe is black, I think.'], 'Poe is black.'], [['Apparently, Poe is black.'], 'Poe is black.'],
            [['In Hamlet, Poe is a raven.'], 'Poe is a raven.'], [['Sometimes Poe is black.'], 'Poe is black.'], [['Usually, ravens are black.', 'Poe is a raven.'], 'Poe is black.'],
            [['Poe apparently is black.'], 'Poe is black.'], [['Poe, I think, is black.'], 'Poe is black.'], [['Clearly Poe is black.'], 'Poe is black.'],
            [['Bob thinks that Poe is black and Fido is white.'], 'Fido is white.'], [['Bob said that Poe is a raven.', 'All ravens are black.'], 'Bob said that Poe is black.'],
            [['Necessarily, God exists.'], 'God exists.'], [['Allegedly Poe is a thief.'], 'Someone is a thief.']
        ];
        ok(none(leaks).length === 0, 'no hedge, attitude or frame is dropped (' + leaks.length + ' steps)', none(leaks).join(' ‖ '));
        ok(kindOf('Apparently, Poe is black.') === 'atom' && kindOf('According to Bob, Poe is black.') === 'atom' && kindOf('In Hamlet, Poe is a raven.') === 'atom',
            'a qualified claim is read as one claim');
        ok(step(['If, in functionalism, zombies are not metaphysically possible, then functionalism is false.', 'In functionalism, zombies are not metaphysically possible.'],
            'Functionalism is false.').rule === 'modus ponens', 'one claim still takes part in modus ponens as written');
    }

    console.log('\n-- hedges that challenge a denial, and those flagged --');
    {
        // Alone, a hedge only says that the box has not been established: a
        // bare challenge, which is no argument.
        const hedges = ['Probably, Poe is not black.', 'Poe is probably not black.', 'Poe probably is not black.', 'Poe is not black, probably.',
            'It is likely that Poe is not black.', 'It is unlikely that Poe is black.', 'That Poe is black is unlikely.', 'Poe is unlikely to be black.',
            'Chances are that Poe is not black.', 'There is a good chance that Poe is not black.', 'It might be that Poe is not black.',
            'It may not be the case that Poe is black.', 'Presumably, Poe is not black.', 'In all likelihood, Poe is not black.',
            'Perhaps Poe is not black.', 'Poe is not black, perhaps.', 'It is not likely that Poe is black.'];
        const unflagged = hedges.filter(t => { const s = step([t], 'Poe is black.', 'weak-objection'); return s.rule || !s.bareChallenge; });
        ok(unflagged.length === 0, 'a probability hedge alone is a bare challenge (' + hedges.length + ')', unflagged.join(' ‖ '));
        // Brought by a reason, it challenges the box it objects to.
        const challenges = ['Poe is probably not black.', 'probably Poe is not black.', 'probably, Poe is not black.', 'Poe probably is not black.',
            'it is likely that Poe is not black.', 'it is unlikely that Poe is black.', 'that Poe is black is unlikely.', 'Poe is unlikely to be black.',
            'chances are that Poe is not black.', 'there is a good chance that Poe is not black.', 'it might be that Poe is not black.',
            'it may not be the case that Poe is black.', 'presumably Poe is not black.', 'in all likelihood, Poe is not black.',
            'perhaps Poe is not black.', 'it is not likely that Poe is black.'].map(t => [['If Poe is a crow, then ' + t, 'Poe is a crow.'], 'Poe is black.']);
        ok(all(challenges, 'weak-objection').length === 0, 'brought by a reason, probability hedges challenge the box they object to (' + challenges.length + ')', all(challenges, 'weak-objection').join(' ‖ '));
        const flagged = ['Possibly, Poe is not black.', 'It is possible that Poe is not black.', 'Poe is possibly not black.'];
        ok(flagged.every(t => { const s = step([t], 'Poe is black.', 'weak-objection'); return !s.rule && s.ambiguous && /a challenge needs reasons too/.test(s.why); }) &&
            ['possibly Poe is not black.', 'it is possible that Poe is not black.', 'Poe is possibly not black.'].every(t => { const s = step(['If Poe is a crow, then ' + t, 'Poe is a crow.'], 'Poe is black.', 'weak-objection');
                return !s.rule && s.ambiguous && /Read as “for all we know, Poe is not black”, the step follows by modus ponens/.test(s.why) && !/read as one claim/.test(s.why); }),
            '"possibly" is flagged, not read as "for all we know" (alone, that reading is a bare challenge)');
        const conditions = [[['When Poe is a raven, Poe is black.', 'Poe is a raven.'], 'Poe is black.'], [['Poe is black when Poe is a raven.', 'Poe is a raven.'], 'Poe is black.'],
            [['Given that Poe is a raven, Poe is black.', 'Poe is a raven.'], 'Poe is black.'], [['Poe is black given that Poe is a raven.', 'Poe is a raven.'], 'Poe is black.'],
            [['In case Poe is a raven, Poe is black.', 'Poe is a raven.'], 'Poe is black.'], [['While Poe is black, Fido is white.'], 'Fido is white.'],
            [['Poe is a raven only when Poe is black.', 'Poe is a raven.'], 'Poe is black.']];
        ok(conditions.every(([p, c]) => { const s = step(p, c); return !s.rule && s.ambiguous; }), '"when", "given that", "in case", "while", "only when" are flagged, not read as "if" or "and"');
        ok(!step(['Apparently, Poe is not black.'], 'Poe is black.', 'weak-objection').rule, '"apparently" does not challenge');
    }

    console.log('\n-- claims about what someone thinks --');
    {
        ok(step(['Everyone thinks that Poe is black.', 'Bob is a person.'], 'Bob thinks that Poe is black.').rule === 'universal modus ponens' &&
           step(['All philosophers think that Poe is black.', 'Bob is a philosopher.'], 'Bob thinks that Poe is black.').rule === 'universal modus ponens',
           'what everyone thinks, Bob thinks: the thinker is the subject');
        ok(step(['Bob thinks that Poe is black.'], 'It is not the case that Bob thinks that Poe is black.', 'objection').bare === true, 'a denied attitude is its denial (so the objection is a bare denial)');
        // "Bob does not think that P" may say that he thinks it is not so (neg-raising): flagged, both readings named.
        const raised = step(['Bob thinks that Poe is black.'], 'Bob does not think that Poe is black.', 'objection');
        ok(!raised.rule && raised.ambiguous && /does not think/.test(raised.why), '"does not think that P" is flagged: no such thought, or the thought that not P', raised.why);
        const s = step(['Bob thinks that Poe is black, and Fido is white.'], 'Fido is white.');
        ok(!s.rule && s.ambiguous, '"Bob thinks that P, and Q": whether Q is Bob\'s is flagged');
    }

    console.log('\n-- position --');
    {
        const clauses = [['Poe is a raven', 'Poe is black'], ['it rains', 'the roads are wet'], ['Socrates is a man', 'Socrates is mortal']];
        const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
        const classes = (a, b) => ({
            'if A then B': [`If ${a}, then ${b}.`, `If ${a}, ${b}.`, `${cap(b)} if ${a}.`, `${cap(b)}, if ${a}.`, `Provided that ${a}, ${b}.`, `${cap(b)}, provided that ${a}.`,
                `As long as ${a}, ${b}.`, `${cap(b)} as long as ${a}.`, `In the event that ${a}, ${b}.`, `${cap(b)} in the event that ${a}.`, `Assuming that ${a}, ${b}.`,
                `${cap(b)}, assuming that ${a}.`, `Suppose ${a}; then ${b}.`, `${cap(a)} only if ${b}.`, `Only if ${b}, ${a}.`],
            'A iff B': [`${cap(a)} if and only if ${b}.`, `${cap(a)} iff ${b}.`, `${cap(a)} just in case ${b}.`, `${cap(a)} exactly when ${b}.`, `${cap(a)} if, and only if, ${b}.`],
            'A or B': [`${cap(a)} or ${b}.`, `Either ${a} or ${b}.`, `${cap(a)} or else ${b}.`, `${cap(a)}, otherwise ${b}.`, `${cap(a)} unless ${b}.`, `Unless ${b}, ${a}.`],
            // "B and A" is another claim: commutation, not a moved phrase.
            'A and B': [`${cap(a)} and ${b}.`, `${cap(a)} but ${b}.`, `${cap(a)}; ${b}.`, `${cap(a)}, yet ${b}.`, `Although ${b}, ${a}.`, `Moreover, ${a} and ${b}.`],
            'not A': [`It is not the case that ${a}.`, `It is false that ${a}.`, `It is not true that ${a}.`, `It isn't the case that ${a}.`],
            'probably A': [`Probably, ${a}.`, `Probably ${a}.`, `${cap(a)}, probably.`],
            'likely': [`It is likely that ${a}.`, `That ${a} is likely.`, `It's likely that ${a}.`],
            'apparently A': [`Apparently, ${a}.`, `Apparently ${a}.`, `${cap(a)}, apparently.`],
            'according to Bob': [`According to Bob, ${a}.`, `${cap(a)}, according to Bob.`],
            'Bob thinks': [`Bob thinks that ${a}.`, `Bob thinks ${a}.`, `${cap(a)}, Bob thinks.`],
            'not shown': [`It has not been shown that ${a}.`, `That ${a} has not been shown.`],
            'when (flagged)': [`When ${a}, ${b}.`, `${cap(b)} when ${a}.`]
        });
        const off = [];
        let count = 0;
        clauses.forEach(([a, b]) => Object.entries(classes(a, b)).forEach(([name, list]) => list.forEach(t => { count++; if (!same(list[0], t)) off.push(name + ': ' + t); })));
        ok(off.length === 0, 'a moved phrase leaves the claim as it was (' + count + ' phrasings)', off.slice(0, 6).join(' ‖ '));
        const apart = [['If Poe is a raven, then Poe is black.', 'If Poe is black, then Poe is a raven.'], ['Poe is a raven only if Poe is black.', 'Poe is a raven if Poe is black.'],
            ['Probably, Poe is black.', 'Presumably, Poe is black.'], ['It is likely that Poe is black.', 'It is probable that Poe is black.'],
            ['It is likely that Poe is black.', 'It is very likely that Poe is black.'], ['According to Bob, Poe is black.', 'According to Ann, Poe is black.'],
            ['Bob thinks that Poe is black.', 'Poe is black.'], ['When Poe is a raven, Poe is black.', 'If Poe is a raven, then Poe is black.']];
        ok(apart.every(([x, y]) => !same(x, y)), 'different words stay different claims');
        // Quantifier words are logic: one claim in "all", "every", "each", "whatever".
        ok(step(['If every raven is black, then Poe is a bird.', 'All ravens are black.'], 'Poe is a bird.').rule === 'modus ponens' &&
           step(['If each raven is black, then Poe is a bird.', 'Whatever is a raven is black.'], 'Poe is a bird.').rule === 'modus ponens' &&
           step(['If no raven is white, then Poe is a bird.', 'Not a single raven is white.'], 'Poe is a bird.').rule === 'modus ponens',
           'quantifier words are logic: "every raven" is "all ravens", "each" is "whatever is", "no" is "not a single"');
        const generic = step(['If every raven is black, then Poe is a bird.', 'Ravens are black.'], 'Poe is a bird.');
        ok(!step(['If some raven is black, then Poe is a bird.', 'All ravens are black.'], 'Poe is a bird.').rule && !generic.rule && generic.ambiguous &&
           !step(['If all Greeks are mortal, then Poe is a bird.', 'All greeks are mortal.'], 'Poe is a bird.').rule,
           'but "some" is not "all", a generic is flagged, and a term keeps its spelling');
        ok(step(['Not all ravens are black.'], 'Some ravens are not black.').rule === 'quantifier negation', 'wordings that differ by a denial are named quantifier negation');
    }

    console.log('\n-- quantified objects --');
    {
        const denies = (x, y) => ev('var a = parseClaim(' + J(x) + '), b = parseClaim(' + J(y) + '); return !!a && !!b && claimDenies(a, b);');
        const sets = [
            ['Poe loves every raven.', 'Poe loves all ravens.', 'Poe loves each raven.', 'Poe loves all the ravens.', 'Poe loves each and every raven.', 'Poe loves every single raven.', 'Poe loves any raven.', 'Poe loves all of the ravens.'],
            ['Poe loves some raven.', 'Poe loves a raven.', 'Poe loves at least one raven.', 'Poe loves some ravens.'],
            ['Poe loves everyone.', 'Poe loves everybody.', 'Poe loves all people.', 'Poe loves every person.'],
            ['Poe fears every black raven.', 'Poe fears all black ravens.'],
            ['Poe does not love every raven.', 'Poe does not love all ravens.'],
            ['Poe helps someone.', 'Poe helps somebody.', 'Poe helps some person.', 'Poe helps a person.'],
            ['Poe knows everything.', 'Poe knows all things.', 'Poe knows every thing.']];
        const off = [];
        sets.forEach(set => set.forEach(t => { if (!same(set[0], t)) off.push(t); }));
        ok(off.length === 0, 'an object in "every", "all", "each", "any" is one claim; in "some", "a", "at least one" another (' + sets.flat().length + ' phrasings)', off.join(' ‖ '));
        const apart = [['Poe loves every raven.', 'Poe loves some raven.'], ['Poe gathered all the sheep.', 'Poe gathered every sheep.'], ['Poe loves every raven.', 'Poe loves the ravens.'],
            ['Poe loves every raven.', 'Poe loves ravens.'], ['Poe does not love every raven.', 'Poe loves no raven.']];
        ok(apart.every(([x, y]) => !same(x, y)), 'but "every" is not "some", "gathered all" (together) is not "gathered every", and "the ravens" or bare "ravens" is not "every raven"',
            apart.filter(([x, y]) => same(x, y)).map(p => p.join(' / ')).join(' ‖ '));
        const den = [['Poe loves no raven.', 'Poe loves some raven.'], ['Poe loves nobody.', 'Poe loves someone.'], ["Poe doesn't love any raven.", 'Poe loves a raven.'], ['Poe does not love all ravens.', 'Poe loves every raven.']];
        ok(den.every(([x, y]) => denies(x, y)), 'and "loves no raven", "loves nobody", "does not love any raven", "does not love all ravens" deny their positives',
            den.filter(([x, y]) => !denies(x, y)).map(p => p.join(' / ')).join(' ‖ '));
        ok(step(['If Poe loves every raven, then Poe is kind.', 'Poe loves all ravens.'], 'Poe is kind.').rule === 'modus ponens' &&
           step(['If Poe loves a raven, then Poe is kind.', 'Poe loves some raven.'], 'Poe is kind.').rule === 'modus ponens' &&
           !step(['If Poe loves every raven, then Poe is kind.', 'Poe loves a raven.'], 'Poe is kind.').rule,
           'so modus ponens goes through across "every"/"all" and "a"/"some", not across "every"/"a"');
        ok(step(['Everyone loves all ravens.', 'Bob is a person.'], 'Bob loves every raven.').rule === 'universal modus ponens', 'and inside a universal: everyone loves all ravens, so Bob loves every raven');
        // Relative clauses are read; objects a reading holds back are flagged with that reading.
        ok(step(['Poe loves every raven that sings.', 'Fido is a raven that sings.'], 'Poe loves Fido.').rule === 'universal modus ponens' &&
           step(['Poe loves all ravens that sing.', 'Fido is a raven and Fido sings.'], 'Poe loves Fido.').rule === 'universal modus ponens' &&
           step(['All ravens that sing are black.', 'Fido is a raven that sings.'], 'Fido is black.').rule === 'universal modus ponens' &&
           !step(['Poe loves every raven that sings.', 'Fido is a raven.'], 'Poe loves Fido.').rule &&
           step(['Poe manages to love every raven.', 'Fido is a raven.'], 'Poe manages to love Fido.').rule === 'universal modus ponens',
           'a relative clause is part of the kind ("every raven that sings"), and "manages to" passes the object through');
        const flagged = [[['Poe must love every raven.', 'Fido is a raven.'], 'Poe must love Fido.', /of each raven there is/],
            [['Poe seeks every unicorn.', 'Uni is a unicorn.'], 'Poe seeks Uni.', /under a description/], [['Poe wants to meet every raven.', 'Fido is a raven.'], 'Poe wants to meet Fido.', /under a description/],
            [['Poe loves the mother of every raven.', 'Fido is a raven.'], 'Poe loves the mother of Fido.', /each raven's own/],
            [['Poe fed every raven.', 'Fido is a raven.'], 'Poe fed Fido.', /in the past/], [['Poe has read every book.', 'Ulysses is a book.'], 'Poe has read Ulysses.', /after "has"/],
            [['Poe is afraid of every raven.', 'Fido is a raven.'], 'Poe is afraid of Fido.', /under a description/]];
        const unflagged = flagged.filter(([p, c, why]) => { const r = step(p, c); return r.rule || !r.ambiguous || !why.test(r.why) || !/the step follows by universal modus ponens/.test(r.why); });
        ok(unflagged.length === 0, 'after a modal, a verb of seeking or wanting, "the mother of", the past, the perfect or fear, the case is flagged with the reading that gives it',
            unflagged.map(([p, c]) => p.join(' | ') + ' ⊢ ' + c + ' [' + step(p, c).why.slice(0, 120) + ']').join(' ‖ '));
        ok(!step(['Poe loves almost every raven.', 'Fido is a raven.'], 'Poe loves Fido.').rule && !step(['Poe does not love every raven.', 'Fido is a raven.'], 'Poe does not love Fido.').rule,
            'and "almost every" and "does not love every" give no case');
    }

    console.log('\n-- plurals, verbs, and the textbook forms --');
    {
        const nouns = 'tree horse state game machine picture value eye shoe prize cache church age bus premise idea photo taxi menu mosquito circus gas atlas box glass knife cave prosthesis virus species sheep goose analysis thesis criterion phenomenon child person man woman mouse ox'.split(' ');
        const plural = { horse: 'horses', bus: 'buses', gas: 'gases', atlas: 'atlases', box: 'boxes', glass: 'glasses', knife: 'knives', prosthesis: 'prostheses', virus: 'viruses',
            species: 'species', sheep: 'sheep', goose: 'geese', analysis: 'analyses', thesis: 'theses', criterion: 'criteria', phenomenon: 'phenomena', child: 'children',
            person: 'people', man: 'men', woman: 'women', mouse: 'mice', ox: 'oxen', church: 'churches', cache: 'caches', mosquito: 'mosquitoes', circus: 'circuses',
            taxi: 'taxis', menu: 'menus', prize: 'prizes', age: 'ages', premise: 'premises', idea: 'ideas', photo: 'photos', shoe: 'shoes', cave: 'caves' };
        const an = w => /^[aeiou]/.test(w) ? 'an ' + w : 'a ' + w;
        const bad = nouns.filter(n => step(['All ' + (plural[n] || n + 's') + ' are real.', 'Pat is ' + an(n) + '.'], 'Pat is real.').rule !== 'universal modus ponens');
        ok(bad.length === 0, 'plurals of every spelling class match their singulars (' + nouns.length + ' nouns)', bad.join(', '));
        const verbs = [['freezes', 'freeze'], ['aches', 'ache'], ['tiptoes', 'tiptoe'], ['goes home', 'go home'], ['echoes Bob', 'echo Bob'], ['watches birds', 'watch birds'],
            ['buzzes', 'buzz'], ['sizes things', 'size things'], ['flies', 'fly'], ['has feathers', 'have feathers'], ['does homework', 'do homework']];
        const vbad = verbs.filter(([v, b]) => step(['Poe ' + v + '.'], 'Poe does not ' + b + '.', 'objection').bare !== true);
        ok(vbad.length === 0, 'verbs in -es, -ies, -oes and irregulars deny by "does not" (' + verbs.length + ')', vbad.map(v => v[0]).join(', '));
        const forms = [
            [['Only if Poe is a raven is Poe black.', 'Poe is black.'], 'Poe is a raven.'], [['Only if Poe is a raven does Poe fly.', 'Poe flies.'], 'Poe is a raven.'],
            [['Poe is black, otherwise Poe is white.', 'Poe is not black.'], 'Poe is white.'], [['Ravens are all black.', 'Poe is a raven.'], 'Poe is black.'],
            [['Ravens all fly.', 'Poe is a raven.'], 'Poe flies.'], [['The only black things are ravens.', 'Poe is a black thing.'], 'Poe is a raven.'],
            [['Ravens are the only black things.', 'Poe is a black thing.'], 'Poe is a raven.'], [["Poe's being black is equivalent to Poe's being a raven.", 'Poe is a raven.'], 'Poe is black.'],
            [["Poe's being a raven implies that Poe is black.", 'Poe is a raven.'], 'Poe is black.'], [['Poe being a raven is sufficient for Poe being black.', 'Poe is a raven.'], 'Poe is black.'],
            [['Poe being black is necessary for Poe being a raven.', 'Poe is a raven.'], 'Poe is black.'], [['Suppose Poe is a raven; then Poe is black.', 'Poe is a raven.'], 'Poe is black.'],
            [['No raven is white.', 'Bert is a raven.'], 'Bert is not white.']];
        ok(all(forms).length === 0, 'textbook forms: only if (inverted), otherwise, floating "all", "the only", gerunds, suppose (' + forms.length + ')', all(forms).join(' ‖ '));
        ok(!step(['Poe is black, otherwise Poe is white.', 'Poe is black.'], 'Poe is white.').rule && !step(['The ravens are all black.', 'Poe is a raven.'], 'Poe is black.').rule,
            'and not their look-alikes: affirming a disjunct; "the ravens" (which ravens?)');
    }

    console.log('\n-- wording and claims about one argument --');
    {
        const s = step(["If we don't possess mutually acceptable, or independently motivated, premises that a mere series of flashing lights and control circuitry can't produce consciousness, then we can't conclude that a mere series of flashing lights can't produce consciousness.",
            "We don't possess mutually acceptable, or independently motivated, premises that a mere series of flashing lights and control circuitry can't produce consciousness."],
            "A mere series of flashing lights and control circuitry can't produce consciousness.", 'weak-objection');
        ok(!s.rule && /Worded the same way each time, this would follow by modus ponens/.test(s.why) && /“and control circuitry” is in one and not the other/.test(s.why),
            'a step that would follow if two claims were worded alike says which words differ', s.why);
        ok(ev('var f = parseClaim("The argument with premises “Zombies are metaphysically possible” and “If zombies are metaphysically possible, then consciousness is non-physical” is unsound."); return f.kind === "unsound" && f.from.length === 2;'),
            '"the argument with premises “A” and “B” is unsound" is about that argument');
        ok(step(['Zombies are not metaphysically possible.'], 'The argument with premises “Zombies are metaphysically possible” and “If zombies are metaphysically possible, then consciousness is non-physical” to the conclusion that consciousness is non-physical is unsound.').rule === 'a false premise',
            'a false premise makes it unsound');
        ok(kindOf('The claim that Poe is black, “Q”, is surprising.') === 'atom', 'quoted words no reading takes up are one claim');
    }
    ok(errors.length === 0, 'no JSDOM script errors', errors.join('; '));
} finally {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    dom.window.close();
    process.exitCode = failed ? 1 : 0;
}
