'use strict';
/**
 * Adjectives: which split, and what is flagged.
 *
 *   node language-r27-adjective-test.js [argument-mapper-r27.html]
 *
 * 1. An intersective adjective splits: "Poe is a black raven" is "Poe is
 *    black and Poe is a raven", and "a raven that is black"; so it gives
 *    each part, the parts give it, and a universal's subject or predicate is
 *    matched by its parts ("all black ravens", "every raven is a black bird").
 * 2. A subsective one leaves its noun standing: "a good pianist" is a
 *    pianist; that it is good is flagged (? ambiguous), not passed -- as for
 *    "a small elephant", "a moral philosopher", "a careful driver", "a Greek
 *    teacher", "a true friend", "a total stranger".
 * 3. A privative or non-subsective one, a material one, an idiom and a word
 *    not known leave neither standing: "a fake gun", "a former president",
 *    "a stone lion", "a black box", "a zombie argument" -- each flagged.
 * 4. What must stay apart does: "the black raven" (a description), "not a
 *    black raven" and "a non-black raven", "not a valid argument" and "an
 *    invalid argument", "was a black raven" (the past is not split).
 * 5. Reading: "black ravens fly" and "some black ravens fly" have "black
 *    ravens" as their subject; "evil exists" and "evil causes suffering" have
 *    "evil"; "a black and white raven", "black and noisy birds" are one noun.
 * 6. Soundness: random steps about individuals, judged by the same meanings
 *    (split, noun and whole, or whole), are never certified when invalid.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || 'argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/adjective-test', virtualConsole: vc,
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
const step = (ps, c, kind) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [
    { id: 'S', type: ${J(kind || 'support')}, texts: ${J(ps)}, collapsed: [], children: [] }] }];
    var s = collectDeductiveSteps(trees)[0]; return { rule: s.rule ? s.rule.name : s.restates ? 'restates its box' : null, ambiguous: !!s.ambiguous, why: s.why ? s.why.text : '' };`);
// The rule a step follows by, from the checker alone (no diagnosis).
const certify = (ps, c) => ev('var P = ' + J(ps) + '.map(function (t) { return parseClaim(t); }), C = parseClaim(' + J(c) + ');' +
    'if (!C || P.some(function (p) { return !p; })) return { rule: null }; var r = certifyStep(P, [C], false); return { rule: r ? r.name : null };');
const key = t => ev('var f = parseClaim(' + J(t) + '); return f ? claimKey(f) : null;');
const same = (x, y) => ev('var a = parseClaim(' + J(x) + '), b = parseClaim(' + J(y) + '); return !!a && !!b && claimSame(a, b);');
let passed = 0, failed = 0;
function ok(cond, label, detail) {
    if (cond) { passed++; console.log('  ✓ ' + label); }
    else { failed++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}
const show = ([p, c]) => p.join(' | ') + ' ⊢ ' + c;
// Steps expected to pass, with the rule; and steps expected to be flagged, not passed.
const passes = cases => cases.filter(([p, c, rule]) => step(p, c).rule !== rule).map(x => show(x) + ' [' + step(x[0], x[1]).rule + ']');
const flagged = cases => cases.filter(([p, c]) => { const s = step(p, c); return s.rule || !s.ambiguous; }).map(show);
const neither = cases => cases.filter(([p, c]) => step(p, c).rule).map(show);

try {
    console.log('\n-- an intersective adjective splits --');
    {
        // In the order written: "a black raven" is black, then a raven; "a raven that is black", a raven, then black.
        ok(key('Poe is a black raven.') === 'C[P:poe|=black;P:poe|=raven]' && key('Poe is a raven that is black.') === 'C[P:poe|=raven;P:poe|=black]' &&
           key('All black ravens are birds.') === 'U:(=black&=raven)|=bird' && key('All ravens that are black are birds.') === 'U:(=raven&=black)|=bird' &&
           key('Every black raven is a bird.') === key('All black ravens are birds.'),
           '"a black raven" is "black" and "a raven"; "a raven that is black" is "a raven" and "black"', key('Poe is a black raven.'));
        const cases = [
            [['Poe is a black raven.'], 'Poe is black.', 'conjunction elimination'], [['Poe is a black raven.'], 'Poe is a raven.', 'conjunction elimination'],
            [['Poe is black.', 'Poe is a raven.'], 'Poe is a black raven.', 'conjunction introduction'],
            [['Poe is a black raven.'], 'Poe is black and Poe is a raven.', 'restates its box'], [['Poe is a raven that is black.'], 'Poe is a raven and Poe is black.', 'restates its box'],
            [['Poe is a raven that is black.'], 'Poe is a black raven.', 'commutation'], [['All ravens that are black are birds.'], 'All black ravens are birds.', 'commutation'],
            [['All black ravens are birds.', 'Poe is a black raven.'], 'Poe is a bird.', 'universal modus ponens'],
            [['All black ravens are birds.', 'Poe is black and Poe is a raven.'], 'Poe is a bird.', 'universal modus ponens'],
            [['All ravens that are black are birds.', 'Poe is a raven that is black.'], 'Poe is a bird.', 'universal modus ponens'],
            [['Every raven is a black bird.', 'Poe is a raven.'], 'Poe is a black bird.', 'universal modus ponens'],
            [['All black ravens are birds.', 'Poe is not a bird.'], 'Poe is not a black raven.', 'universal modus tollens'],
            [['Poe is not a black raven.', 'Poe is a raven.'], 'Poe is not black.', 'conjunctive syllogism'],
            [['Poe is a raven that is black.'], 'Some raven is black.', 'existential introduction'], [['Poe is a black raven.'], 'There is a black raven.', 'existential introduction'],
            [['Poe is a black raven and Poe flies.'], 'Some black raven flies.', 'existential introduction'],
            [['All black ravens are birds.', 'All birds are animals.'], 'All black ravens are animals.', 'universal syllogism'],
            [['All ravens that are black are birds.', 'All birds are animals.'], 'All ravens that are black are animals.', 'universal syllogism'],
            [['If Poe is a black raven, then Poe is a bird.', 'Poe is black and Poe is a raven.'], 'Poe is a bird.', 'modus ponens'],
            [['If something is a raven, then it is a black bird.', 'Poe is a raven.'], 'Poe is a black bird.', 'universal modus ponens']];
        ok(passes(cases).length === 0, 'it gives each part, its parts give it, and a universal is matched by the parts (' + cases.length + ')', passes(cases).join(' ‖ '));
        const words = [
            [['Socrates is a Greek philosopher.'], 'Socrates is Greek.', 'conjunction elimination'], [['This is a valid argument.'], 'This is valid.', 'conjunction elimination'],
            [['This is an invalid argument.'], 'This is not valid.', 'conjunction elimination'], [['Knowledge is justified true belief.'], 'Knowledge is true.', 'conjunction elimination'],
            [['Pain is a mental state.'], 'Pain is mental.', 'conjunction elimination'], [['Poe is a non-black raven.'], 'Poe is not black.', 'conjunction elimination'],
            [['Poe is a non-black raven.'], 'Poe is a raven.', 'conjunction elimination'], [['Poe is a black and white raven.'], 'Poe is white.', 'conjunction elimination'],
            [['Poe is a very black raven.'], 'Poe is very black.', 'conjunction elimination'], [['Bob is a kind man.'], 'Bob is kind.', 'conjunction elimination'],
            [['Poe is an old black raven.'], 'Poe is black.', 'conjunction elimination'], [['Kant is a moral philosopher.'], 'Kant is a philosopher.', 'conjunction elimination'],
            [['Poe is a good pianist.'], 'Poe is a pianist.', 'conjunction elimination'], [['This is a gun that is fake.'], 'This is a gun.', 'conjunction elimination']];
        ok(passes(words).length === 0, 'colours, nationalities, "valid", "invalid", "non-", "true" of a belief, "mental" of a state, a trait of a man; a noun kept standing (' + words.length + ')', passes(words).join(' ‖ '));
    }

    console.log('\n-- flagged, not passed --');
    {
        const sub = [[['Poe is a good pianist.'], 'Poe is good.'], [['Dumbo is a small elephant.'], 'Dumbo is small.'], [['Kant is a moral philosopher.'], 'Kant is moral.'],
            [['Bob is a careful driver.'], 'Bob is careful.'], [['Bob is a Greek teacher.'], 'Bob is Greek.'], [['Ann is a true friend.'], 'Ann is true.'],
            [['Bob is a total stranger.'], 'Bob is total.'], [['Poe is an old black raven.'], 'Poe is old.'],
            [['All good pianists practice.', 'Poe is a pianist that is good.'], 'Poe practices.']];
        ok(flagged(sub).length === 0, 'a subsective adjective, said of the thing alone: good, small, moral, careful (of a driver), Greek (of a teacher), true (of a friend), total (' + sub.length + ')', flagged(sub).join(' ‖ '));
        const non = [[['This is a fake gun.'], 'This is a gun.'], [['Bob is a former president.'], 'Bob is a president.'], [['Bob is an alleged thief.'], 'Bob is a thief.'],
            [['This is a stone lion.'], 'This is a lion.'], [['This is a false dilemma.'], 'This is a dilemma.'], [['The mind is a black box.'], 'The mind is black.'],
            [['The mind is a black box.'], 'The mind is a box.'], [['This is a zombie argument.'], 'This is an argument.'], [['This is a zombie argument.'], 'This is a zombie.']];
        ok(flagged(non).length === 0, 'a privative, material or unknown modifier, and an idiom: neither part passes, each is flagged (' + non.length + ')', flagged(non).join(' ‖ '));
        const s = step(['This is a fake gun.'], 'This is a gun.'), t = step(['Poe is a good pianist.'], 'Poe is good.');
        ok(/a fake gun need not be a gun/.test(s.why) && /Read as “a gun that is fake”, the step follows by conjunction elimination/.test(s.why) && !/Worded the same way/.test(s.why) &&
           /a good pianist is a pianist, but need not be good/.test(t.why), 'the flag says why, and what reading would make the step follow', s.why + ' ‖ ' + t.why);
    }

    console.log('\n-- what stays apart --');
    {
        const apart = [[['Poe is black and Poe is a raven.'], 'Poe is the black raven.'], [['Poe is not a black raven.'], 'Poe is a non-black raven.'],
            [['Poe is a non-black raven.'], 'Poe is not a black raven.'], [['The argument is not a valid argument.'], 'The argument is an invalid argument.'],
            [['Poe is a black raven.'], 'Poe is a raven that is white.'], [['Poe was black.', 'Poe was a raven.'], 'Poe was a black raven.'],
            [['All ravens are black.', 'Poe is a raven.'], 'Poe is a black raven.']];
        ok(neither(apart).length === 0, 'a description, "not a black raven" and "a non-black raven", "not valid" and "invalid" of an argument, the past (' + apart.length + ')', neither(apart).join(' ‖ '));
        ok(!same('Poe is a good pianist.', 'Poe is a pianist that is good.') && !same('Poe is a fake gun.', 'Poe is a gun that is fake.') && !same('Poe is a black raven.', 'Poe is a raven that is black.'),
           '"a good pianist" is not "a pianist that is good", nor "a fake gun" "a gun that is fake"; "a black raven" is "a raven that is black" by commutation');
    }

    console.log('\n-- reading --');
    {
        ok(key('Black ravens fly.') === 'P:black ravens|~fly' && key('Some black ravens fly.') === 'E:(=black&=raven)|~fly' && key('Some black raven flies.') === 'E:(=black&=raven)|~fly',
           '"black ravens fly" and "some black ravens fly" have "black ravens" as their subject', key('Black ravens fly.') + ' / ' + key('Some black ravens fly.'));
        ok(key('Evil exists.') === 'P:evil|~exist' && key('Evil causes suffering.') === 'P:evil|~cause suffering' && key('Good triumphs over evil.') === 'P:good|~triumph over evil' &&
           key('Some good comes from evil.') === 'E:=good|~come from evil' && key('God is good and evil exists.') === 'C[P:god|=good;P:evil|~exist]',
           '"evil exists", "evil causes suffering", "good triumphs over evil" have a noun for their subject');
        ok(key('Poe is a black and white raven.') === 'C[P:poe|=black;P:poe|=raven;P:poe|=white]' && key('Ravens are black and noisy birds.') === 'C[P:ravens|=black;P:ravens|=bird;P:ravens|=noisy bird]' &&
           key('Poe is a philosopher and poet.') === 'C[P:poe|=philosopher;P:poe|=poet]', 'adjectives joined before one noun say it once; nouns joined stay two', key('Ravens are black and noisy birds.'));
        const generic = step(['All black ravens fly.'], 'Black ravens fly.'), g2 = step(['Black ravens fly.', 'Poe is a black raven.'], 'Poe flies.');
        ok(!g2.rule && g2.ambiguous && /without "all" is a generic/.test(g2.why), 'a plural with adjectives is a generic, flagged as "ravens fly" is', g2.why);
    }

    console.log('\n-- soundness --');
    {
        // Claims about individuals, from nouns and adjectives whose kinds are
        // known; each read by the meaning its kind gives, and every certified
        // step checked against every assignment of its atoms.
        const nouns = ['raven', 'bird', 'pianist', 'gun'], names = ['Poe', 'Rex'];
        const adjs = { black: 'int', white: 'int', valid: 'int', good: 'sub', small: 'sub', fake: 'non', former: 'non', zombie: 'unk' };
        let seed = 7;
        const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
        const pick = xs => xs[Math.floor(rand() * xs.length)];
        const an = w => (/^[aeiou]/.test(w) ? 'an ' : 'a ') + w;
        const atom = (pred, x) => ({ op: 'atom', name: pred + '(' + x + ')' });
        const And = (a, b) => ({ op: 'and', a, b }), Or = (a, b) => ({ op: 'or', a, b }), Not = a => ({ op: 'not', a }), If = (a, b) => ({ op: 'if', a, b });
        const np = (a, n, x) => adjs[a] === 'int' ? And(atom(a, x), atom(n, x)) : adjs[a] === 'sub' ? And(atom(n, x), atom(a + ' ' + n, x)) : atom(a + ' ' + n, x);
        function simple() {
            const x = pick(names), n = pick(nouns), a = pick(Object.keys(adjs)), r = rand();
            if (r < 0.3) return { t: x + ' is ' + an(a + ' ' + n), f: np(a, n, x.toLowerCase()) };
            if (r < 0.45) return { t: x + ' is ' + an(n), f: atom(n, x.toLowerCase()) };
            if (r < 0.6 && adjs[a] !== 'unk') return { t: x + ' is ' + a, f: atom(a, x.toLowerCase()) };
            if (r < 0.7) return { t: x + ' is ' + an(n) + ' that is ' + a, f: And(atom(n, x.toLowerCase()), atom(a, x.toLowerCase())) };
            if (r < 0.85) return { t: x + ' is not ' + an(a + ' ' + n), f: Not(np(a, n, x.toLowerCase())) };
            return { t: x + ' is not ' + an(n), f: Not(atom(n, x.toLowerCase())) };
        }
        function claim() {
            const r = rand();
            if (r < 0.55) return simple();
            const p = simple(), q = simple();
            if (r < 0.7) return { t: p.t + ' and ' + q.t, f: And(p.f, q.f) };
            if (r < 0.85) return { t: p.t + ' or ' + q.t, f: Or(p.f, q.f) };
            return { t: 'if ' + p.t + ', then ' + q.t, f: If(p.f, q.f) };
        }
        const atoms = (f, out) => { if (f.op === 'atom') out.add(f.name); else ['a', 'b'].forEach(k => f[k] && atoms(f[k], out)); return out; };
        const val = (f, v) => f.op === 'atom' ? v[f.name] : f.op === 'not' ? !val(f.a, v) : f.op === 'and' ? val(f.a, v) && val(f.b, v)
            : f.op === 'or' ? val(f.a, v) || val(f.b, v) : !val(f.a, v) || val(f.b, v);
        function valid(ps, c) {
            const names = [...[c].concat(ps).reduce((s, f) => atoms(f, s), new Set())];
            for (let m = 0; m < 1 << names.length; m++) {
                const v = {}; names.forEach((n, i) => { v[n] = !!(m & (1 << i)); });
                if (ps.every(p => val(p, v)) && !val(c, v)) return false;
            }
            return true;
        }
        const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
        // Steps shaped like the rules, with words drawn at random -- a noun
        // phrase's parts, the parts to the phrase, modus ponens and tollens,
        // syllogisms -- and steps of random claims; valid or not by the words.
        const phrase = () => { const x = pick(names), n = pick(nouns), a = pick(Object.keys(adjs)); return { x, n, a, X: x.toLowerCase() }; };
        const say = {
            np: v => ({ t: v.x + ' is ' + an(v.a + ' ' + v.n), f: np(v.a, v.n, v.X) }),
            n: v => ({ t: v.x + ' is ' + an(v.n), f: atom(v.n, v.X) }),
            adj: v => ({ t: v.x + ' is ' + v.a, f: atom(v.a, v.X) }),
            rel: v => ({ t: v.x + ' is ' + an(v.n) + ' that is ' + v.a, f: And(atom(v.n, v.X), atom(v.a, v.X)) }),
            both: v => ({ t: v.x + ' is ' + v.a + ' and ' + v.x + ' is ' + an(v.n), f: And(atom(v.a, v.X), atom(v.n, v.X)) }) };
        const not = c => ({ t: c.t.replace(/ is /, ' is not '), f: Not(c.f) });
        const other = v => Object.assign({}, v, rand() < 0.5 ? { a: pick(Object.keys(adjs)) } : { n: pick(nouns) });
        const forms = Object.keys(say), anyForm = v => say[pick(adjs[v.a] === 'unk' ? forms.filter(k => k !== 'adj' && k !== 'both' && k !== 'rel') : forms)](v);
        const near = v => rand() < 0.7 ? v : other(v);
        const If2 = (p, q) => ({ t: 'if ' + p.t + ', then ' + q.t, f: If(p.f, q.f) }), Or2 = (p, q) => ({ t: p.t + ' or ' + q.t, f: Or(p.f, q.f) });
        const templates = [
            () => { const v = phrase(); return [[anyForm(v)], anyForm(near(v))]; },
            () => { const v = phrase(); return [[say.adj(v), say.n(v)], anyForm(near(v))]; },
            () => { const v = phrase(), w = phrase(), p = anyForm(v), q = anyForm(w); return [[If2(p, q), anyForm(near(v))], q]; },
            () => { const v = phrase(), w = phrase(), p = anyForm(v), q = anyForm(w); return [[If2(p, q), not(anyForm(near(w)))], not(p)]; },
            () => { const v = phrase(); return [[not(say.np(v)), say.n(near(v))], not(say.adj(near(v)))]; },
            () => { const v = phrase(), w = phrase(), p = anyForm(v), q = anyForm(w); return [[Or2(p, q), not(anyForm(near(v)))], q]; },
            () => { const k = rand() < 0.5 ? 1 : 2; return [Array.from({ length: k }, claim), rand() < 0.5 ? claim() : simple()]; }];
        let certified = 0, validCount = 0;
        const bad = [];
        for (let i = 0; i < 2000; i++) {
            const [ps, c] = pick(templates)();
            if (ps.concat([c]).some(p => /\bis (?:not )?zombie\b/.test(p.t))) continue;
            const s = certify(ps.map(p => cap(p.t) + '.'), cap(c.t) + '.');
            const good = valid(ps.map(p => p.f), c.f);
            if (good) validCount++;
            if (!s.rule) continue;
            certified++;
            if (!good) bad.push(ps.map(p => p.t).join(' | ') + ' ⊢ ' + c.t + ' [' + s.rule + ']');
        }
        ok(bad.length === 0 && certified > 200, 'no invalid step is certified (2000 steps; ' + certified + ' certified, ' + validCount + ' valid by the words)', bad.slice(0, 4).join(' ‖ '));
    }
    ok(errors.length === 0, 'no JSDOM script errors', errors.join('; '));
} finally {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    dom.window.close();
    process.exitCode = failed ? 1 : 0;
}
