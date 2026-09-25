'use strict';
/**
 * First-order soundness and completeness of the Standard package.
 *
 *   node logic-r27-fol-test.js [argument-mapper-r27.html]
 *
 * 1. Soundness: random first-order steps (relations, identity, quantifiers),
 *    in the shapes of every rule and their near misses, and random rule
 *    instances; each one the app certifies is checked by an independent
 *    model checker (every model on domains of 1-3 things when small, a
 *    sample otherwise). A counter-model is a real error.
 * 2. The categorical syllogisms: of all 256 forms, the app certifies exactly
 *    the fifteen valid ones, in symbols and in English.
 * 3. Completeness of the basis: with every extension switched off, every
 *    closed instance of Enderton's axioms but the definition of ∃ is a rule
 *    instance, and that definition (quantifier negation, both ways) is
 *    derived; random tautologies, valid sequents and universal closures of
 *    tautologies have derivations the app checks line by line -- by truth
 *    tables, a case for each value of each letter, a supposition carried as
 *    the condition of every line that depends on it (logic-r27-basis-proofs.js);
 *    modus ponens under long prefixes; classic proofs.
 * 4. Relations in English: a quantified object gives its case ("Poe loves
 *    every raven" and "Fido is a raven": "Poe loves Fido"), and no step with
 *    one that the model checker can refute is certified.
 */
const fs = require('fs'), assert = require('assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || 'argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/fol-test', virtualConsole: vc,
    beforeParse(w) {
        w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
        w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        const ctx = new Proxy({}, { get: (_, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
        w.alert = () => {}; w.confirm = () => true; w.prompt = () => null;
    }
});
const W = dom.window;
const ev = src => JSON.parse(W.eval('JSON.stringify((function(){' + src + '})())'));
const J = JSON.stringify;
const step = (ps, c) => ev('var P = ' + J(ps) + '.map(function (t) { return parseClaim(t); }), C = parseClaim(' + J(c) + ');' +
    'if (!C || P.some(function (p) { return !p; })) return "unread"; var r = certifyStep(P, [C], false); return r ? r.name : null;');
const thm = t => ev('var r = logicalTheorem(' + J(t) + '); return r ? r.rule.name : null;');
const tree = t => ev('var f = parseClaim(' + J(t) + '); return f && f.folTree ? f.folTree : null;');
let passed = 0, failed = 0;
function ok(cond, label, detail) {
    if (cond) { passed++; console.log('  ✓ ' + label); }
    else { failed++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

// --- an independent model checker ------------------------------------------------
function signature(trees) {
    const preds = new Map(), letters = new Set(), consts = new Set();
    trees.forEach(t => (function walk(n, bound) {
        switch (n.op) {
            case 'letter': letters.add(n.name.toLowerCase()); break;
            case 'pred': preds.set(n.name.toLowerCase() + '/' + n.args.length, n.args.length); n.args.forEach(a => { if (bound.indexOf(a) < 0) consts.add(a); }); break;
            case 'identity': [n.left, n.right].forEach(a => { if (bound.indexOf(a) < 0) consts.add(a); }); break;
            case 'not': walk(n.a, bound); break;
            case 'and': case 'or': case 'imp': case 'iff': walk(n.a, bound); walk(n.b, bound); break;
            case 'all': case 'some': walk(n.body, bound.concat(n.v)); break;
        }
    })(t, []));
    return { preds: [...preds.entries()], letters: [...letters], consts: [...consts] };
}
function value(a, M, env) {
    if (Object.prototype.hasOwnProperty.call(env, a)) return env[a];
    if (Object.prototype.hasOwnProperty.call(M.consts, a)) return M.consts[a];
    throw new Error('unbound name ' + a);
}
function holds(n, M, env) {
    switch (n.op) {
        case 'bottom': return false;
        case 'letter': return !!M.letters[n.name.toLowerCase()];
        case 'pred': return !!M.preds[n.name.toLowerCase() + '/' + n.args.length][n.args.reduce((acc, a) => acc * M.D + value(a, M, env), 0)];
        case 'identity': return value(n.left, M, env) === value(n.right, M, env);
        case 'not': return !holds(n.a, M, env);
        case 'and': return holds(n.a, M, env) && holds(n.b, M, env);
        case 'or': return holds(n.a, M, env) || holds(n.b, M, env);
        case 'imp': return !holds(n.a, M, env) || holds(n.b, M, env);
        case 'iff': return holds(n.a, M, env) === holds(n.b, M, env);
        case 'all': case 'some':
            for (let d = 0; d < M.D; d++) {
                const r = holds(n.body, M, Object.assign({}, env, { [n.v]: d }));
                if (n.op === 'all' && !r) return false;
                if (n.op === 'some' && r) return true;
            }
            return n.op === 'all';
    }
    throw new Error('op ' + n.op);
}
function mulberry(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function counterModel(premises, conclusion, seed) {
    const sig = signature(premises.concat([conclusion])), rng = mulberry(seed || 7);
    for (let D = 1; D <= 3; D++) {
        const bitsFor = sig.preds.map(([k, ar]) => [k, Math.pow(D, ar)]);
        const total = bitsFor.reduce((s, [, n]) => s + n, 0) + sig.letters.length, consts = Math.pow(D, sig.consts.length);
        const exhaustive = total <= 14 && Math.pow(2, total) * consts <= 3000;
        const count = exhaustive ? Math.pow(2, total) * consts : 3000;
        for (let t = 0; t < count; t++) {
            const M = { D, preds: {}, letters: {}, consts: {} };
            let i = 0;
            const bit = exhaustive ? () => !!(Math.floor(t / consts) & (1 << i++)) : () => (i++, rng() < 0.5);
            bitsFor.forEach(([k, n]) => { M.preds[k] = []; for (let j = 0; j < n; j++) M.preds[k][j] = bit(); });
            sig.letters.forEach(l => { M.letters[l] = bit(); });
            let c = exhaustive ? t % consts : Math.floor(rng() * consts);
            sig.consts.forEach(k => { M.consts[k] = c % D; c = Math.floor(c / D); });
            if (premises.every(p => holds(p, M, {})) && !holds(conclusion, M, {})) return M;
        }
    }
    return null;
}

// --- formulas ----------------------------------------------------------------------
const rng = mulberry(20260921);
const pick = a => a[Math.floor(rng() * a.length)];
const B = (op, a, b) => ({ op, a, b }), NOT = a => ({ op: 'not', a }), Q = (op, v, body) => ({ op, v, body }), L = n => ({ op: 'letter', name: n });
function print(n) {
    switch (n.op) {
        case 'bottom': return '⊥';
        case 'letter': return n.name;
        case 'pred': return n.name + '(' + n.args.join(',') + ')';
        case 'identity': return n.left + ' = ' + n.right;
        case 'not': return '¬' + (/^(?:pred|letter|not|bottom)$/.test(n.a.op) ? print(n.a) : '(' + print(n.a) + ')');
        case 'and': case 'or': case 'imp': case 'iff': {
            const w = x => /^(?:all|some)$/.test(x.op) ? '(' + print(x) + ')' : print(x);
            return '(' + w(n.a) + ' ' + { and: '∧', or: '∨', imp: '→', iff: '↔' }[n.op] + ' ' + w(n.b) + ')';
        }
        case 'all': case 'some': return (n.op === 'all' ? '∀' : '∃') + n.v + ' (' + print(n.body) + ')';
    }
}
function gen(depth, free, bound) {
    const terms = free.concat(bound), r = rng();
    if (depth <= 0 || r < 0.25) {
        const k = rng();
        if (k < 0.1 || !terms.length) return L(pick(['P', 'Q']));
        if (k < 0.55) return { op: 'pred', name: pick(['F', 'G', 'H']), args: [pick(terms)] };
        if (k < 0.9) return { op: 'pred', name: pick(['R', 'S']), args: [pick(terms), pick(terms)] };
        return { op: 'identity', left: pick(terms), right: pick(terms) };
    }
    if (r < 0.4) return NOT(gen(depth - 1, free, bound));
    if (r < 0.75) return B(pick(['and', 'or', 'imp', 'iff']), gen(depth - 1, free, bound), gen(depth - 1, free, bound));
    const v = pick(['x', 'y', 'z'].filter(v => bound.indexOf(v) < 0).concat(['x']));
    return Q(pick(['all', 'some']), v, gen(depth - 1, free, bound.concat(v)));
}
function subst(n, from, to) {
    switch (n.op) {
        case 'pred': return Object.assign({}, n, { args: n.args.map(a => a === from ? to : a) });
        case 'identity': return Object.assign({}, n, { left: n.left === from ? to : n.left, right: n.right === from ? to : n.right });
        case 'not': return NOT(subst(n.a, from, to));
        case 'and': case 'or': case 'imp': case 'iff': return B(n.op, subst(n.a, from, to), subst(n.b, from, to));
        case 'all': case 'some': return n.v === from ? n : Q(n.op, n.v, subst(n.body, from, to));
    }
    return n;
}
function substSome(n, from, to) {
    let done = false;
    const walk = (m, bound) => {
        const t = a => (a === from && bound.indexOf(a) < 0 && (rng() < 0.5 || !done)) ? (done = true, to) : a;
        switch (m.op) {
            case 'pred': return Object.assign({}, m, { args: m.args.map(t) });
            case 'identity': return Object.assign({}, m, { left: t(m.left), right: t(m.right) });
            case 'not': return NOT(walk(m.a, bound));
            case 'and': case 'or': case 'imp': case 'iff': return B(m.op, walk(m.a, bound), walk(m.b, bound));
            case 'all': case 'some': return Q(m.op, m.v, walk(m.body, bound.concat(m.v)));
        }
        return m;
    };
    return walk(n, []);
}
function shape() {
    const a = gen(2, ['x', 'a'], []), b = gen(2, ['x', 'a'], []), c = gen(2, ['a', 'b'], []), x = 'x', q = pick(['all', 'some']);
    const dual = op => op === 'all' ? 'some' : 'all', id = (l, r) => ({ op: 'identity', left: l, right: r });
    const list = [
        [[Q('all', x, B('and', a, b))], Q('all', x, a)], [[Q('all', x, B('imp', a, b)), Q('all', x, a)], Q('all', x, b)],
        [[Q('some', x, B('and', a, b))], Q('some', x, b)], [[Q('some', x, a), Q('all', x, B('imp', a, b))], Q('some', x, b)],
        [[Q('some', x, a), Q('some', x, B('imp', a, b))], Q('some', x, b)], [[Q('all', x, B('or', a, b)), Q('some', x, NOT(a))], Q('all', x, b)],
        [[Q('some', x, B('or', a, b)), Q('all', x, NOT(a))], Q('some', x, b)], [[Q('all', x, a)], Q('some', x, a)], [[Q('some', x, a)], Q('all', x, a)],
        [[Q('all', x, Q('some', 'y', subst(b, 'a', 'y')))], Q('some', 'y', Q('all', x, subst(b, 'a', 'y')))],
        [[Q('some', 'y', Q('all', x, subst(b, 'a', 'y')))], Q('all', x, Q('some', 'y', subst(b, 'a', 'y')))],
        [[c, Q('all', x, B('imp', c, a))], Q('all', x, a)], [[Q('all', x, B('imp', a, c)), Q('some', x, a)], c],
        [[Q(q, x, B('and', c, a))], B('and', c, Q(q, x, a))], [[Q(q, x, B('or', c, a))], B('or', c, Q(q, x, a))],
        [[Q(q, x, B('and', a, b))], B('and', Q(q, x, a), Q(q, x, b))], [[Q(q, x, B('or', a, b))], B('or', Q(q, x, a), Q(q, x, b))],
        [[Q(q, x, B('imp', c, a))], B('imp', c, Q(q, x, a))], [[Q(q, x, B('imp', a, c))], B('imp', Q(dual(q), x, a), c)],
        [[Q(q, x, B('imp', a, c))], B('imp', Q(q, x, a), c)], [[Q(q, x, B('and', a, b))], B('and', a, Q(q, x, b))],
        [[c], Q(q, x, c)], [[Q(q, x, c)], c], [[Q(q, x, a)], a],
        [[NOT(Q(q, x, a))], Q(dual(q), x, NOT(a))], [[Q(q, x, a)], NOT(Q(dual(q), x, NOT(a)))], [[Q(q, x, a)], NOT(Q(q, x, NOT(a)))],
        [[id('a', 'b'), c], substSome(c, 'a', 'b')], [[id('b', 'a'), c], substSome(c, 'a', 'b')], [[id('a', 'c'), c], substSome(c, 'a', 'b')],
        [[id('a', 'b'), Q('all', x, a)], Q('all', x, substSome(a, 'a', 'b'))], [[id('a', 'b'), Q('all', x, a)], Q('all', x, substSome(a, 'x', 'b'))],
        [[Q(q, x, NOT(NOT(a)))], Q(q, x, a)], [[Q(q, x, B('imp', a, b))], Q(q, x, B('or', NOT(a), b))], [[Q(q, x, B('imp', a, b))], Q(q, x, B('imp', b, a))],
        [[NOT(B('and', c, a)), c], NOT(a)], [[NOT(B('and', c, a)), NOT(c)], a], [[B('imp', c, a), B('imp', a, c)], B('iff', c, a)]
    ];
    return rng() < 0.85 ? pick(list) : [[gen(3, ['a', 'b'], [])].concat(rng() < 0.5 ? [gen(3, ['a', 'b'], [])] : []), gen(3, ['a', 'b'], [])];
}

try {
    console.log('\n-- soundness: first-order steps and rule instances --');
    {
        let certified = 0, unsound = [], instances = 0, badInstances = [], rules = new Set();
        for (let i = 0; i < 1500; i++) {
            const [P, C] = shape(), pt = P.map(print), ct = print(C);
            const rule = step(pt, ct);
            if (!rule || rule === 'unread') continue;
            certified++; rules.add(rule.replace(/ under [∀∃]+$/, ' under a quantifier'));
            if (counterModel(pt.map(tree), tree(ct), i + 1)) unsound.push(rule + ': ' + pt.join(' | ') + ' ⊢ ' + ct);
        }
        for (let i = 0; i < 400; i++) {
            const [P, C] = shape(), ante = P.length === 1 ? P[0] : P.reduce((x, y) => B('and', x, y));
            let t = B('imp', ante, C);
            if (rng() < 0.5) t = Q('all', 'w', subst(t, 'a', 'w'));
            const text = print(t), r = thm(text);
            if (!r) continue;
            instances++;
            if (counterModel([], tree(text), i + 3)) badInstances.push(r + ': ' + text);
        }
        ok(certified > 500 && !unsound.length, 'every certified first-order step is valid (' + certified + ' of 1500; ' + rules.size + ' rules)', unsound.slice(0, 3).join(' ‖ '));
        ok(instances > 50 && !badInstances.length, 'every accepted rule instance is valid (' + instances + ')', badInstances.slice(0, 3).join(' ‖ '));
    }

    console.log('\n-- categorical syllogisms --');
    {
        const sym = (m, s, p) => ({ A: `∀x (${s}(x) → ${p}(x))`, E: `∀x (${s}(x) → ¬${p}(x))`, I: `∃x (${s}(x) ∧ ${p}(x))`, O: `∃x (${s}(x) ∧ ¬${p}(x))` })[m];
        const noun = { S: 'sophists', M: 'mortals', P: 'philosophers' };
        const eng = (m, s, p) => ({ A: `All ${noun[s]} are ${noun[p]}.`, E: `No ${noun[s]} are ${noun[p]}.`, I: `Some ${noun[s]} are ${noun[p]}.`, O: `Some ${noun[s]} are not ${noun[p]}.` })[m];
        const figs = { 1: [['M', 'P'], ['S', 'M']], 2: [['P', 'M'], ['S', 'M']], 3: [['M', 'P'], ['M', 'S']], 4: [['P', 'M'], ['M', 'S']] };
        const letter = { S: 'F', M: 'G', P: 'H' };
        const wrong = [], valid = [];
        for (const f of [1, 2, 3, 4]) for (const a of 'AEIO') for (const b of 'AEIO') for (const c of 'AEIO') {
            const [maj, min] = figs[f];
            const ps = [sym(a, letter[maj[0]], letter[maj[1]]), sym(b, letter[min[0]], letter[min[1]])], cs = sym(c, 'F', 'H');
            const isValid = !counterModel(ps.map(tree), tree(cs));
            if (isValid) valid.push(f + a + b + c);
            const got = step(ps, cs), gotE = step([eng(a, maj[0], maj[1]), eng(b, min[0], min[1])], eng(c, 'S', 'P'));
            if (!!got !== isValid || !!gotE !== isValid) wrong.push(f + a + b + c + ' valid=' + isValid + ' symbols=' + got + ' English=' + gotE);
        }
        ok(valid.length === 15 && !wrong.length, 'of 256 forms, exactly the 15 valid moods are certified, in symbols and in English', wrong.slice(0, 4).join(' ‖ '));
        ok(step(['No philosophers are sophists.', 'All mortals are sophists.'], 'No mortals are philosophers.') === 'categorical syllogism (Cesare)' &&
           step(['All philosophers are mortals.', 'Some sophists are not mortals.'], 'Some sophists are not philosophers.') === 'categorical syllogism (Baroco)',
           'a syllogism is named by its mood');
    }

    console.log('\n-- completeness: Enderton\'s axioms are rule instances --');
    {
        const free = n => { const out = new Set(); (function w(m, b) { switch (m.op) {
            case 'pred': m.args.forEach(a => { if (!b.includes(a)) out.add(a); }); break; case 'identity': [m.left, m.right].forEach(a => { if (!b.includes(a)) out.add(a); }); break;
            case 'not': w(m.a, b); break; case 'and': case 'or': case 'imp': case 'iff': w(m.a, b); w(m.b, b); break; case 'all': case 'some': w(m.body, b.concat(m.v)); } })(n, []); return out; };
        const substitutable = (n, x, t, bound = []) => { switch (n.op) {
            case 'pred': return !n.args.includes(x) || !bound.includes(t); case 'identity': return ![n.left, n.right].includes(x) || !bound.includes(t);
            case 'not': return substitutable(n.a, x, t, bound); case 'and': case 'or': case 'imp': case 'iff': return substitutable(n.a, x, t, bound) && substitutable(n.b, x, t, bound);
            case 'all': case 'some': return n.v === x ? true : substitutable(n.body, x, t, bound.concat(n.v)); } return true; };
        const close = f => [...free(f)].filter(v => /^[wxyz]$/.test(v)).reduce((g, v) => Q('all', v, g), f);
        const g2 = vars => gen(2, vars, []);
        const schemas = {
            'Ax2 ∀xα → α[t/x]': () => { const a = g2(['x', 'y', 'a']), t = pick(['y', 'a', 'x']); return substitutable(a, 'x', t) ? close(B('imp', Q('all', 'x', a), subst(a, 'x', t))) : null; },
            'Ax3 ∀x(α→β) → (∀xα → ∀xβ)': () => { const a = g2(['x', 'y']), b = g2(['x', 'y']); return close(B('imp', Q('all', 'x', B('imp', a, b)), B('imp', Q('all', 'x', a), Q('all', 'x', b)))); },
            'Ax4 α → ∀xα': () => { const a = g2(['y', 'a']); return close(B('imp', a, Q('all', 'x', a))); },
            'Ax5 x = x': () => close({ op: 'identity', left: 'x', right: 'x' }),
            'Ax6, without exportation: (x = y ∧ α) → α′': () => { const ar = pick([1, 2]), args = Array.from({ length: ar }, () => pick(['x', 'y', 'a'])); const pos = args.map((a, i) => a === 'x' && rng() < 0.6 ? i : -1).filter(i => i >= 0);
                if (!pos.length) return null; const al = { op: 'pred', name: ar === 1 ? 'F' : 'R', args };
                return close(B('imp', B('and', { op: 'identity', left: 'x', right: 'y' }, al), Object.assign({}, al, { args: args.map((a, i) => pos.includes(i) ? 'y' : a) }))); },
        };
        // With every extension off: the basis's rule instances.
        ev('setDeductiveRule([].concat.apply([], DEDUCTIVE_EXTENSIONS.map(function (g) { return g.rules; })), false); setDeductiveRule(DEDUCTIVE_EXTENSIONS.filter(function (g) { return g.id === "core"; })[0].rules, true); return 1;');
        for (const [name, make] of Object.entries(schemas)) {
            let n = 0; const miss = [], invalid = [];
            for (let i = 0; i < 300 && n < 50; i++) {
                const f = make(); if (!f) continue;
                const text = print(f); n++;
                const r = thm(text);
                if (!r) miss.push(text);
                else if (counterModel([], tree(text), i + 5)) invalid.push(text);
            }
            ok(n >= 40 && !miss.length && !invalid.length, name + ': ' + n + ' closed instances, each a valid rule instance', (miss.concat(invalid)).slice(0, 2).join(' ‖ '));
        }
        const vars = ['x', 'y', 'z', 'u', 'v', 'w'];
        const mp = [1, 2, 3, 4, 5, 6].map(k => {
            const pre = f => vars.slice(0, k).reduceRight((g, v) => Q('all', v, g), f);
            const a = { op: 'pred', name: 'R', args: [vars[0], vars[k - 1]] }, b = { op: 'pred', name: 'S', args: [vars[k - 1], vars[0]] };
            return step([print(pre(B('imp', a, b))), print(pre(a))], print(pre(b)));
        });
        // Enderton writes Ax6 curried, "x = y → (α → α′)": that is E2, an axiom
        // of the basis. Uncurried, it states identity substitution's step, and
        // is a rule instance while the core steps are on.
        ok(thm('∀x (∀y ((x = y) → (F(x) → F(y))))') === 'substitution of identicals' && thm('∀x (∀y (((x = y) ∧ F(x)) → F(y)))') === 'identity substitution',
            'Ax6 as Enderton writes it is the axiom; uncurried, it is identity substitution as a rule instance');
        ok(step(['P'], '∀z (P)') === 'vacuous quantifier' && step(['∀z (P)'], '∀y (∀z (P))') === 'vacuous quantifier' && !step(['P'], '∀x (∀y (∀z (P)))') &&
           step(['∀x (∀y (P))'], '∀y (P)') === 'universal elimination', 'a sentence to its closure and back, a quantifier at a time');
        ev('state.logic = null; return 1;');
        // The rule inside quantifiers (an extension, on by default) does it in one step.
        ok(mp.every(r => r === null), 'with the extensions off, modus ponens under a prefix is no single step', J(mp));
        const mpOn = [1, 2, 3, 4, 5, 6].map(k => {
            const pre = f => vars.slice(0, k).reduceRight((g, v) => Q('all', v, g), f);
            const a = { op: 'pred', name: 'R', args: [vars[0], vars[k - 1]] }, b = { op: 'pred', name: 'S', args: [vars[k - 1], vars[0]] };
            return step([print(pre(B('imp', a, b))), print(pre(a))], print(pre(b)));
        });
        ok(mpOn.every((r, i) => r === 'modus ponens under ' + '∀'.repeat(i + 1)), 'with rules inside quantifiers on (the default), modus ponens under up to six universal quantifiers in one step', J(mpOn));
    }

    console.log('\n-- completeness: the basis alone derives tautologies, sequents, closures and ∃ --');
    {
        // Only the core steps on: each line a rule instance, or a step by one core
        // rule. The axioms beneath them are logic-r27-hilbert-test.js's business.
        ev('setDeductiveRule([].concat.apply([], DEDUCTIVE_EXTENSIONS.map(function (g) { return g.rules; })), false); setDeductiveRule(DEDUCTIVE_EXTENSIONS.filter(function (g) { return g.id === "core"; })[0].rules, true); return 1;');
        const off = { ds: step(['P v Q', '~P'], 'Q'), mt: step(['P -> Q', '~Q'], '~P'), comm: step(['P & Q'], 'Q & P'), lifted: step(['∃x (F(x) & G(x))'], '∃x F(x)') };
        ok(!off.ds && !off.mt && !off.comm && !off.lifted && step(['P -> Q', 'Q -> R'], 'P -> R') === 'hypothetical syllogism',
            'with every extension off, disjunctive syllogism, modus tollens, commutation and the rules inside quantifiers are gone; the basis stays', J(off));
        const printN = n => n.op === 'andN' ? '(' + n.parts.map(x => /^(?:all|some)$/.test(x.op) ? '(' + printN(x) + ')' : printN(x)).join(' ∧ ') + ')'
            : n.op === 'not' ? '¬' + (/^(?:pred|letter|not|bottom)$/.test(n.a.op) ? printN(n.a) : '(' + printN(n.a) + ')')
            : /^(?:and|or|imp|iff)$/.test(n.op) ? '(' + [n.a, n.b].map(x => /^(?:all|some)$/.test(x.op) ? '(' + printN(x) + ')' : printN(x)).join(' ' + { and: '∧', or: '∨', imp: '→', iff: '↔' }[n.op] + ' ') + ')'
            : /^(?:all|some)$/.test(n.op) ? (n.op === 'all' ? '∀' : '∃') + n.v + ' (' + printN(n.body) + ')' : print(n);
        const BP = require('./logic-r27-basis-proofs.js')(printN);
        const LET = ['P', 'Q', 'R', 'S'];
        const gp = d => d <= 0 || rng() < 0.3 ? L(pick(LET)) : rng() < 0.25 ? (c => c.op === 'not' ? c : NOT(c))(gp(d - 1)) : B(pick(['and', 'or', 'imp', 'iff']), gp(d - 1), gp(d - 1));
        const taut = n => { const ls = BP.letters(n); for (let m = 0; m < 1 << ls.length; m++) { const v = {}; ls.forEach((l, i) => { v[l] = !!(m & (1 << i)); }); if (!BP.value3(n, v)) return false; } return true; };
        const ATOMS = { P: { op: 'pred', name: 'F', args: ['z'] }, Q: { op: 'pred', name: 'R', args: ['z', 'w'] }, R: { op: 'pred', name: 'G', args: ['w'] }, S: { op: 'pred', name: 'H', args: ['a'] } };
        const lifted = n => n.op === 'letter' ? ATOMS[n.name] : n.op === 'not' ? NOT(lifted(n.a)) : n.a ? B(n.op, lifted(n.a), lifted(n.b)) : n;
        // Every line of a derivation, checked: [lines, bad].
        const checkProof = proof => {
            for (const ln of proof.lines) {
                if (ln.from === 'given') continue;
                const text = printN(ln.f), got = ln.from === 'theorem' ? thm(text) : step(ln.from.map(k => printN(proof.lines[k].f)), text);
                if (!got || got === 'unread') return (ln.from === 'theorem' ? '[instance] ' : ln.from.map(k => printN(proof.lines[k].f)).join(' | ') + ' ⊢ ') + text;
            }
            return null;
        };
        const run = (count, mode) => {
            let tried = 0, derived = 0, lineCount = 0; const bad = [];
            for (let n = 0; n < count; n++) {
                let tau, g = 0;
                do { tau = mode === 'sequent' ? B('imp', B('and', gp(2), gp(2)), gp(2)) : gp(mode === 'closure' ? 3 : 4); } while ((!taut(tau) || !BP.letters(tau).length) && ++g < 5000);
                if (!taut(tau)) continue;
                tried++;
                const goal = mode === 'closure' ? lifted(tau) : tau, proof = new BP.Proof();
                const level = mode === 'closure' ? new BP.Gen(proof, ['z', 'w']) : new BP.Top(proof);
                const fact = BP.tautology(level, goal), wrong = !fact ? 'no derivation' : checkProof(proof);
                lineCount += proof.lines.length;
                if (wrong) bad.push(printN(goal) + ' at ' + wrong); else derived++;
            }
            return { tried, derived, lineCount, bad };
        };
        const plain = run(30, 'plain'), seq = run(15, 'sequent'), closure = run(5, 'closure');
        ok(plain.tried >= 25 && plain.derived === plain.tried, 'random tautologies of four letters: ' + plain.derived + '/' + plain.tried + ' derived from the basis, ' + plain.lineCount + ' lines each checked', plain.bad.slice(0, 2).join(' ‖ '));
        ok(seq.tried >= 12 && seq.derived === seq.tried, 'valid sequents, as their conditionals: ' + seq.derived + '/' + seq.tried + ' derived, ' + seq.lineCount + ' lines', seq.bad.slice(0, 2).join(' ‖ '));
        ok(closure.tried >= 4 && closure.derived === closure.tried, 'universal closures of tautologies (∀z ∀w, with relations): ' + closure.derived + '/' + closure.tried + ' derived, every line said of all z and w, ' + closure.lineCount + ' lines', closure.bad.slice(0, 2).join(' ‖ '));
        // ∃ as ∀'s dual: quantifier negation both ways, from the basis.
        const qn = []; let qnLines = 0;
        for (let i = 0; i < 12; i++) {
            const a = gen(2, ['x', 'a'], []), proof = new BP.Proof(), top = new BP.Top(proof);
            (i % 2 ? BP.qnBack : BP.qnForward)(top, 'x', a);
            qnLines += proof.lines.length;
            const wrong = checkProof(proof);
            if (wrong) qn.push(printN(a) + ' at ' + wrong);
        }
        ok(!qn.length, 'Enderton\'s ∃xα ↔ ¬∀x¬α: both ways derived from the basis for 12 random α, ' + qnLines + ' lines', qn.slice(0, 2).join(' ‖ '));
        // Modus ponens under a prefix: quantifier distribution and modus ponens.
        const mps = [1, 2, 3, 4].map(k => {
            const vs = ['x', 'y', 'z', 'u'].slice(0, k), A = { op: 'pred', name: 'R', args: [vs[0], vs[k - 1]] }, C = { op: 'pred', name: 'S', args: [vs[k - 1], vs[0]] };
            const proof = new BP.Proof(), g = new BP.Gen(proof, vs);
            g.mp(vs, A, C, proof.put(g.close(B('imp', A, C)), 'given'), proof.put(g.close(A), 'given'));
            return checkProof(proof);
        });
        ok(mps.every(r => !r), 'modus ponens under one to four universal quantifiers, by quantifier distribution and modus ponens', mps.filter(Boolean).join(' ‖ '));
        ev('state.logic = null; return 1;');
    }

    console.log('\n-- classic first-order arguments --');
    {
        // Each line: [text, 'theorem' | 'premise' | [line numbers]].
        const check = lines => lines.every(([text, from], i) => {
            const got = from === 'premise' ? 'premise' : from === 'theorem' ? thm(text) : step(from.map(k => lines[k][0]), text);
            if (!got || got === 'unread') { console.log('      line ' + i + ' failed: ' + text); return false; }
            return true;
        });
        ok(step(['∃x ∀y R(x,y)'], '∀y ∃x R(x,y)') === 'universal elimination under ∀∃', '∃x∀y R ⊢ ∀y∃x R in one step, and not the converse: ' + step(['∀y ∃x R(x,y)'], '∃x ∀y R(x,y)'));
        ok(check([
            ['∀x (F(x) → G(x))', 'premise'],
            ['(∀x F(x)) → (∀x G(x))', [0]]
        ]) && thm('(∀x (F(x) → G(x))) → ((∀x F(x)) → (∀x G(x)))') === 'Q2', '∀x(F→G) ⊢ ∀xF → ∀xG: a core step, and Q2 itself as a box needing no support');
        ok(check([
            ['∀x (F(x) → (G(x) ∧ H(x)))', 'premise'], ['∃x F(x)', 'premise'],
            ['∃x (G(x) ∧ H(x))', [1, 0]],
            ['∃x G(x)', [2]]
        ]), '∀x(F → G ∧ H), ∃x F ⊢ ∃x G: modus ponens under ∃, conjunction elimination under ∃');
        ok(check([
            ['a = b', 'premise'], ['∀x (R(a,x) → S(x,a))', 'premise'],
            ['∀x (R(b,x) → S(x,a))', [0, 1]],
            ['∀x (R(b,x) → S(x,b))', [0, 2]]
        ]), 'identity substitution into a quantified formula, one place at a time');
        ok(check([
            ['∀x (F(x) ∨ G(x))', 'premise'], ['¬∃x G(x)', 'premise'],
            ['∀x ¬G(x)', [1]],
            ['∀x F(x)', [0, 2]]
        ]), 'quantifier negation, then disjunctive syllogism under ∀');
        ok(check([
            ['∀x (P → F(x))', 'premise'], ['P', 'premise'],
            ['P → ∀x F(x)', [0]],
            ['∀x F(x)', [2, 1]]
        ]), 'rules of passage, then modus ponens');
        ok(thm('∀x (x = x)') === 'identity' && thm('a = a') === 'identity' && !thm('a = b'), 'E1 needs no support, closed or not');
        ok(!thm('P v ~P') && !thm('P -> P') && !thm('∀x (F(x) → F(x))') && !thm('∀x (F(x) ∨ ¬F(x))'), 'tautologies and restatements need support (they are proved), quantified or not');
    }
    console.log('\n-- relations in English: quantified objects --');
    {
        // Claims with objects, each with its first-order formula; steps shaped
        // like the object rules (universal modus ponens and tollens, "no",
        // universal elimination, existential introduction, under a subject's
        // quantifier) and their near misses; every certified step checked by
        // the model checker above.
        const R = mulberry(20260922), rp = a => a[Math.floor(R() * a.length)];
        const NAMES = [['Poe', 'p'], ['Fido', 'f'], ['Rex', 'r']];
        const NOUNS = [['raven', 'ravens', 'Raven'], ['crow', 'crows', 'Crow']];
        const VERBS = [['loves', 'love', 'Love'], ['sees', 'see', 'See']];
        const pr = (name, ...args) => ({ op: 'pred', name, args });
        const an = n => (/^[aeiou]/.test(n) ? 'an ' : 'a ') + n;
        const is = (x, n) => ({ t: x[0] + ' is ' + an(n[0]), f: pr(n[2], x[1]) });
        const isNot = (x, n) => ({ t: x[0] + ' is not ' + an(n[0]), f: NOT(pr(n[2], x[1])) });
        const rel = (x, v, y) => ({ t: x[0] + ' ' + v[0] + ' ' + y[0], f: pr(v[2], x[1], y[1]) });
        const relNot = (x, v, y) => ({ t: x[0] + ' does not ' + v[1] + ' ' + y[0], f: NOT(pr(v[2], x[1], y[1])) });
        const every = (x, v, n) => ({ t: x[0] + ' ' + v[0] + ' ' + rp(['every ' + n[0], 'all ' + n[1], 'each ' + n[0], 'any ' + n[0]]), f: Q('all', 'z', B('imp', pr(n[2], 'z'), pr(v[2], x[1], 'z'))) });
        const none = (x, v, n) => ({ t: rp([x[0] + ' ' + v[0] + ' no ' + n[0], x[0] + ' does not ' + v[1] + ' any ' + n[0]]), f: Q('all', 'z', B('imp', pr(n[2], 'z'), NOT(pr(v[2], x[1], 'z')))) });
        const some = (x, v, n) => ({ t: x[0] + ' ' + v[0] + ' ' + rp([an(n[0]), 'some ' + n[0]]), f: Q('some', 'z', B('and', pr(n[2], 'z'), pr(v[2], x[1], 'z'))) });
        const notEvery = (x, v, n) => ({ t: x[0] + ' does not ' + v[1] + ' every ' + n[0], f: NOT(Q('all', 'z', B('imp', pr(n[2], 'z'), pr(v[2], x[1], 'z')))) });
        const everything = (x, v) => ({ t: x[0] + ' ' + v[0] + ' everything', f: Q('all', 'z', pr(v[2], x[1], 'z')) });
        const nothing = (x, v) => ({ t: x[0] + ' ' + v[0] + ' nothing', f: Q('all', 'z', NOT(pr(v[2], x[1], 'z'))) });
        const something = (x, v) => ({ t: x[0] + ' ' + v[0] + ' something', f: Q('some', 'z', pr(v[2], x[1], 'z')) });
        const allEvery = (m, v, n) => ({ t: 'Every ' + m[0] + ' ' + v[0] + ' every ' + n[0], f: Q('all', 'w', B('imp', pr(m[2], 'w'), Q('all', 'z', B('imp', pr(n[2], 'z'), pr(v[2], 'w', 'z'))))) });
        const allOf = (m, v, y) => ({ t: 'Every ' + m[0] + ' ' + v[0] + ' ' + y[0], f: Q('all', 'w', B('imp', pr(m[2], 'w'), pr(v[2], 'w', y[1]))) });
        const noneAny = (m, v, n) => ({ t: 'No ' + m[0] + ' ' + v[1] + 's any ' + n[0], f: Q('all', 'w', B('imp', pr(m[2], 'w'), Q('all', 'z', B('imp', pr(n[2], 'z'), NOT(pr(v[2], 'w', 'z')))))) });
        const noneOf = (m, v, y) => ({ t: 'No ' + m[0] + ' ' + v[0] + ' ' + y[0], f: Q('all', 'w', B('imp', pr(m[2], 'w'), NOT(pr(v[2], 'w', y[1])))) });
        const someEvery = (m, v, n) => ({ t: 'Some ' + m[0] + ' ' + v[0] + ' every ' + n[0], f: Q('some', 'w', B('and', pr(m[2], 'w'), Q('all', 'z', B('imp', pr(n[2], 'z'), pr(v[2], 'w', 'z'))))) });
        const someOf = (m, v, y) => ({ t: 'Some ' + m[0] + ' ' + v[0] + ' ' + y[0], f: Q('some', 'w', B('and', pr(m[2], 'w'), pr(v[2], 'w', y[1]))) });
        // A relative clause: "every raven that sings", "a raven that sings", "Fido sings".
        const SINGS = [['sings', 'sing', 'Sing'], ['flies', 'fly', 'Fly']];
        const everyThat = (x, v, n, u) => ({ t: x[0] + ' ' + v[0] + ' ' + rp(['every ' + n[0] + ' that ' + u[0], 'all ' + n[1] + ' that ' + u[1]]),
            f: Q('all', 'z', B('imp', B('and', pr(n[2], 'z'), pr(u[2], 'z')), pr(v[2], x[1], 'z'))) });
        const isThat = (y, n, u) => rp([{ t: y[0] + ' is ' + an(n[0]) + ' that ' + u[0], f: B('and', pr(n[2], y[1]), pr(u[2], y[1])) },
            { t: y[0] + ' is ' + an(n[0]) + ' and ' + y[0] + ' ' + u[0], f: B('and', pr(n[2], y[1]), pr(u[2], y[1])) }]);
        const allThat = (m, u, n) => ({ t: 'All ' + m[1] + ' that ' + u[1] + ' are ' + n[1], f: Q('all', 'w', B('imp', B('and', pr(m[2], 'w'), pr(u[2], 'w')), pr(n[2], 'w'))) });
        const and = (a, b) => ({ t: a.t + ' and ' + b.t.charAt(0).toLowerCase() + b.t.slice(1), f: B('and', a.f, b.f) });
        // Three words, and one of them sometimes swapped: the near misses.
        const words = () => ({ x: rp(NAMES), y: rp(NAMES), v: rp(VERBS), n: rp(NOUNS), m: rp(NOUNS) });
        const near = w => { const u = Object.assign({}, w), k = R(); if (k < 0.2) u.x = rp(NAMES); else if (k < 0.4) u.y = rp(NAMES); else if (k < 0.55) u.v = rp(VERBS); else if (k < 0.7) u.n = rp(NOUNS); return u; };
        const shapes = [
            w => { const u = near(w); return [[every(w.x, w.v, w.n), is(w.y, w.n)], rel(u.x, u.v, u.y)]; },
            w => { const u = near(w); return [[none(w.x, w.v, w.n), is(w.y, w.n)], relNot(u.x, u.v, u.y)]; },
            w => { const u = near(w); return [[every(w.x, w.v, w.n), relNot(w.x, w.v, w.y)], isNot(u.y, u.n)]; },
            w => { const u = near(w); return [[none(w.x, w.v, w.n), rel(w.x, w.v, w.y)], isNot(u.y, u.n)]; },
            w => { const u = near(w); return [[and(rel(w.x, w.v, w.y), is(w.y, w.n))], some(u.x, u.v, u.n)]; },
            w => { const u = near(w); return [[everything(w.x, w.v)], rel(u.x, u.v, u.y)]; },
            w => { const u = near(w); return [[nothing(w.x, w.v)], relNot(u.x, u.v, u.y)]; },
            w => { const u = near(w); return [[rel(w.x, w.v, w.y)], something(u.x, u.v)]; },
            w => { const u = near(w); return [[allEvery(w.m, w.v, w.n), is(w.y, w.n)], allOf(u.m, u.v, u.y)]; },
            w => { const u = near(w); return [[noneAny(w.m, w.v, w.n), is(w.y, w.n)], noneOf(u.m, u.v, u.y)]; },
            w => { const u = near(w); return [[someEvery(w.m, w.v, w.n), is(w.y, w.n)], someOf(u.m, u.v, u.y)]; },
            // Look-alikes that must not pass whatever the words.
            w => [[some(w.x, w.v, w.n), is(w.y, w.n)], rel(w.x, w.v, w.y)],
            w => [[notEvery(w.x, w.v, w.n), is(w.y, w.n)], relNot(w.x, w.v, w.y)],
            w => [[every(w.x, w.v, w.n)], some(w.x, w.v, w.n)],
            w => [[everything(w.x, w.v)], some(w.x, w.v, w.n)],
            w => [[every(w.x, w.v, w.n), is(w.y, w.n)], rel(w.y, w.v, w.x)],
            // Valid, but two rules: the case goes in as one conjunction, as for a subject.
            w => [[rel(w.x, w.v, w.y), is(w.y, w.n)], some(w.x, w.v, w.n)],
            // Relative clauses, and their near misses: another noun, another verb, the clause dropped.
            w => { const u = rp(SINGS), k = R(); return [[everyThat(w.x, w.v, w.n, u), k < 0.2 ? is(w.y, w.n) : isThat(w.y, k < 0.35 ? w.m : w.n, k < 0.5 ? rp(SINGS) : u)], rel(w.x, w.v, w.y)]; },
            w => { const u = rp(SINGS), k = R(), c = pr(w.n[2], w.y[1]); return [[allThat(w.m, u, w.n), k < 0.2 ? is(w.y, w.m) : isThat(w.y, w.m, k < 0.4 ? rp(SINGS) : u)],
                { t: w.y[0] + ' is ' + an(w.n[0]), f: c }]; }];
        let certified = 0, valid = 0;
        const bad = [], missed = [];
        for (let i = 0; i < 700; i++) {
            const [ps, c] = rp(shapes)(words());
            const got = step(ps.map(p => p.t + '.'), c.t + '.');
            const ok = !counterModel(ps.map(p => p.f), c.f, i + 1);
            if (ok) valid++;
            if (got && got !== 'unread') { certified++; if (!ok) bad.push(ps.map(p => p.t).join(' | ') + ' ⊢ ' + c.t + ' [' + got + ']'); }
        }
        ok(bad.length === 0 && certified > 150, 'no invalid step with a quantified object is certified (700 steps; ' + certified + ' certified, ' + valid + ' valid)', bad.slice(0, 3).join(' ‖ '));
        const cases = [
            [['Poe loves every raven.', 'Fido is a raven.'], 'Poe loves Fido.', 'universal modus ponens'],
            [['Poe loves no raven.', 'Fido is a raven.'], 'Poe does not love Fido.', 'universal modus ponens'],
            [['Poe loves every raven.', 'Poe does not love Fido.'], 'Fido is not a raven.', 'universal modus tollens'],
            [['Poe loves Fido and Fido is a raven.'], 'Poe loves a raven.', 'existential introduction'],
            [['Poe loves everything.'], 'Poe loves Fido.', 'universal elimination'],
            [['Every philosopher loves every raven.', 'Fido is a raven.'], 'Every philosopher loves Fido.', 'universal modus ponens under ∀'],
            [['Poe is taller than every raven.', 'Fido is a raven.'], 'Poe is taller than Fido.', 'universal modus ponens'],
            [['Poe gives every raven a worm.', 'Fido is a raven.'], 'Poe gives Fido a worm.', 'universal modus ponens']];
        const off = cases.filter(([p, c, r]) => step(p, c) !== r).map(([p, c, r]) => p.join(' | ') + ' ⊢ ' + c + ' [' + step(p, c) + ']');
        ok(off.length === 0, 'a quantified object gives its case: "loves every raven", "loves no raven", "is taller than every raven", under "every philosopher"', off.join(' ‖ '));
        const held = [[['Poe must love every raven.', 'Fido is a raven.'], 'Poe must love Fido.'], [['Poe seeks every unicorn.', 'Uni is a unicorn.'], 'Poe seeks Uni.'],
            [['Poe loved every raven.', 'Fido is a raven.'], 'Poe loved Fido.'], [['Poe has loved every raven.', 'Fido is a raven.'], 'Poe has loved Fido.'],
            [['Poe wants to love every raven.', 'Fido is a raven.'], 'Poe wants to love Fido.'], [['Poe loves the mother of every raven.', 'Fido is a raven.'], 'Poe loves the mother of Fido.'],
            [['Poe loves every raven that sings.', 'Fido is a raven.'], 'Poe loves Fido.'], [['Poe loves almost every raven.', 'Fido is a raven.'], 'Poe loves Fido.'],
            [['Poe is afraid of every raven.', 'Fido is a raven.'], 'Poe is afraid of Fido.'], [['Poe drinks water.', 'Evian is water.'], 'Poe drinks something.']];
        const passedHeld = held.filter(([p, c]) => { const r = step(p, c); return r && r !== 'unread'; }).map(([p, c]) => p.join(' | ') + ' ⊢ ' + c);
        ok(passedHeld.length === 0, 'but not past a modal, the past, a verb of seeking or wanting, "the mother of", "almost", or fear, nor to a case that fails the relative clause', passedHeld.join(' ‖ '));
    }
    ok(errors.length === 0, 'no JSDOM script errors', errors.join('; '));
} finally {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    dom.window.close();
    process.exitCode = failed ? 1 : 0;
}
