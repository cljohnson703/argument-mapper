'use strict';
// r27 Deductive check under stress: that it certifies no step that does not
// follow, reads what it reads correctly, and certifies what the rules cover.
//
// A semantic oracle decides validity independently of the app: propositional
// logic with monadic first-order logic and constants, decided exactly by
// enumerating models up to elementary equivalence (which kinds of thing exist,
// which kind each name is, and which sentence letters are true); above four
// predicates, by many random models (a counter-model found is real).
//
// Covers:
//   (1) hard cases, one by one: "any", "some" and denial; "and" and "or" in a
//       verb phrase (relations, modals); subjects joined; generics,
//       indefinites and numbers; an "it" bound by "something"; counterfactuals;
//       conditions after their claims; formulas; weak objections' wordings;
//   (2) formulas, seeded at random: every formula reads as written; no step the
//       check certifies is invalid (rule instances, their mutants, classic
//       fallacies, objections); every rule instance is certified;
//   (3) English, seeded at random, the same, over sentences whose meanings are
//       known -- quantifiers, denials, conditionals in every word order, "only
//       if", "unless", joined subjects and verb phrases, "any"/"no"/"nothing"
//       objects, modals, "if something is F, it is G" -- and steps with a known
//       outcome that the oracle cannot judge: weak objections, counterfactuals;
//   (4) Derive Parent: whatever it proposes follows from its premises;
//   (5) the main contention's verdict on hand-built maps: supports,
//       objections, rebuttals, weak ones, nested, and claims about one
//       argument checked against the map;
//   (6) Help.
//
// Run:  node logic-r27-stress-test.js [argument-mapper-r27.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const SRC = process.argv[2] || (__dirname + '/argument-mapper-r27.html');
const HTML = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
function ok(cond, label, detail) {
    if (cond) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}
const J = JSON.stringify;
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

/* ================= the oracle ================= */
const O = (function () {
    const module = { exports: {} };
    // A semantic oracle for the deductive check: propositional logic plus monadic
    // first-order logic with constants (no identity). Validity is decided exactly
    // by enumerating models up to elementary equivalence: which types (sets of
    // predicates) are inhabited, which type each constant has, and a valuation of
    // the sentence letters.
    //
    // Formulas:
    //   { op: 'letter', name } | { op: 'true' } | { op: 'false' }
    //   { op: 'pred', name, arg }            arg: a constant ('c:poe') or a variable ('x')
    //   { op: 'not', a } | { op: 'and'|'or'|'imp'|'iff', a, b }
    //   { op: 'all'|'some', v, body }

    const L = name => ({ op: 'letter', name });
    const Pr = (name, arg) => ({ op: 'pred', name, arg });
    const Not = a => ({ op: 'not', a });
    const And = (a, b) => ({ op: 'and', a, b });
    const Or = (a, b) => ({ op: 'or', a, b });
    const Imp = (a, b) => ({ op: 'imp', a, b });
    const Iff = (a, b) => ({ op: 'iff', a, b });
    const All = (v, body) => ({ op: 'all', v, body });
    const Some = (v, body) => ({ op: 'some', v, body });
    const TRUE = { op: 'true' }, FALSE = { op: 'false' };
    const fold = (op, list) => list.length === 0 ? (op === 'and' ? TRUE : FALSE) : list.reduce((x, y) => ({ op, a: x, b: y }));

    function vocabulary(formulas) {
        const letters = new Set(), preds = new Set(), consts = new Set();
        let quantified = false;
        formulas.forEach(function walkTop(f) {
            (function walk(f) {
                if (!f) return;
                switch (f.op) {
                    case 'letter': letters.add(f.name); break;
                    case 'pred': preds.add(f.name); if (!/^[a-z]$/.test(f.arg)) consts.add(f.arg); break;
                    case 'not': walk(f.a); break;
                    case 'and': case 'or': case 'imp': case 'iff': walk(f.a); walk(f.b); break;
                    case 'all': case 'some': quantified = true; walk(f.body); break;
                }
            })(f);
        });
        return { letters: [...letters], preds: [...preds], consts: [...consts], quantified };
    }

    // Compile to a closure over (model, env). model: { val (letter bits), types
    // (constant index -> type), S (bitmask of inhabited types), T }.
    function compile(f, idx) {
        switch (f.op) {
            case 'true': return () => true;
            case 'false': return () => false;
            case 'letter': { const bit = idx.letter.get(f.name); return m => ((m.val >> bit) & 1) === 1; }
            case 'pred': {
                const bit = idx.pred.get(f.name);
                if (/^[a-z]$/.test(f.arg)) { const v = f.arg; return (m, env) => ((env[v] >> bit) & 1) === 1; }
                const c = idx.cons.get(f.arg);
                return m => ((m.types[c] >> bit) & 1) === 1;
            }
            case 'not': { const a = compile(f.a, idx); return (m, env) => !a(m, env); }
            case 'and': { const a = compile(f.a, idx), b = compile(f.b, idx); return (m, env) => a(m, env) && b(m, env); }
            case 'or': { const a = compile(f.a, idx), b = compile(f.b, idx); return (m, env) => a(m, env) || b(m, env); }
            case 'imp': { const a = compile(f.a, idx), b = compile(f.b, idx); return (m, env) => !a(m, env) || b(m, env); }
            case 'iff': { const a = compile(f.a, idx), b = compile(f.b, idx); return (m, env) => a(m, env) === b(m, env); }
            case 'all': case 'some': {
                const body = compile(f.body, idx), v = f.v, all = f.op === 'all';
                return (m, env) => {
                    const e = Object.assign({}, env);
                    for (let t = 0; t < m.T; t++) {
                        if (!((m.S >> t) & 1)) continue;
                        e[v] = t;
                        if (body(m, e) !== all) return !all;
                    }
                    return all;
                };
            }
        }
        throw new Error('bad formula ' + JSON.stringify(f));
    }

    // Every model of the vocabulary, up to elementary equivalence, to `visit`,
    // which returns true to stop.
    function eachModel(voc, visit, limit) {
        const k = voc.preds.length, T = 1 << k, c = voc.consts.length, nl = voc.letters.length;
        if (k > 4) throw new Error('too many predicates: ' + k);
        const m = { val: 0, types: new Array(c).fill(0), S: 0, T };
        let count = 0;
        const withLetters = () => {
            for (let val = 0; val < (1 << nl); val++) {
                m.val = val; count++;
                if (visit(m)) return true;
                if (limit && count > limit) return true;
            }
            return false;
        };
        const withS = constMask => {
            if (!voc.quantified) { m.S = constMask; return withLetters(); }
            const full = T === 32 ? 0xffffffff : (2 ** T) - 1;
            if (T > 16) throw new Error('too many types');
            const comp = full & ~constMask;
            // every subset of the complement, added to the constants' types
            for (let e = comp; ; e = (e - 1) & comp) {
                const S = constMask | e;
                if (S !== 0) { m.S = S; if (withLetters()) return true; }
                if (e === 0) break;
            }
            return false;
        };
        const place = (i, mask) => {
            if (i === c) return withS(mask);
            for (let t = 0; t < T; t++) {
                m.types[i] = t;
                if (place(i + 1, mask | (1 << t))) return true;
            }
            return false;
        };
        return place(0, 0);
    }

    function indexOf(voc) {
        return {
            letter: new Map(voc.letters.map((n, i) => [n, i])),
            pred: new Map(voc.preds.map((n, i) => [n, i])),
            cons: new Map(voc.consts.map((n, i) => [n, i]))
        };
    }

    // premises ⊨ conclusion? Returns { valid, counter } (counter: a model as text).
    // Exact up to 4 predicates; above that, random models (a counter-model found
    // is real; none found is only likely validity: approx is set).
    let sampleSeed = 12345;
    const sampleRand = () => { sampleSeed = (sampleSeed * 1103515245 + 12345) % 2147483648; return sampleSeed / 2147483648; };
    function entails(premises, conclusion) {
        const voc = vocabulary(premises.concat([conclusion]));
        const idx = indexOf(voc);
        const P = premises.map(p => compile(p, idx)), C = compile(conclusion, idx);
        let counter = null;
        if (voc.preds.length > 4) {
            const k = voc.preds.length, T = 2 ** k, c = voc.consts.length, nl = voc.letters.length;
            const m = { val: 0, types: new Array(c).fill(0), S: 0, T };
            for (let i = 0; i < 40000 && !counter; i++) {
                m.val = Math.floor(sampleRand() * (2 ** nl));
                for (let j = 0; j < c; j++) m.types[j] = Math.floor(sampleRand() * T);
                // a few inhabited types, sometimes many
                let S = 0;
                const density = sampleRand() < 0.5 ? 2 / T : sampleRand();
                for (let t = 0; t < T; t++) if (sampleRand() < density) S |= (1 << t);
                m.types.forEach(t => { S |= (1 << t); });
                if (S === 0) S = 1 << Math.floor(sampleRand() * T);
                m.S = S >>> 0;
                if (P.every(p => p(m, {})) && !C(m, {})) counter = describe(voc, m);
            }
            return { valid: !counter, counter, approx: true };
        }
        eachModel(voc, m => {
            if (P.every(p => p(m, {})) && !C(m, {})) { counter = describe(voc, m); return true; }
            return false;
        });
        return { valid: !counter, counter };
    }
    function equivalent(a, b) {
        const x = entails([a], b);
        if (!x.valid) return { valid: false, counter: 'first true, second false: ' + x.counter };
        const y = entails([b], a);
        if (!y.valid) return { valid: false, counter: 'second true, first false: ' + y.counter };
        return { valid: true };
    }
    function satisfiable(fs) {
        const voc = vocabulary(fs);
        const idx = indexOf(voc);
        const F = fs.map(f => compile(f, idx));
        let found = false;
        eachModel(voc, m => (found = F.every(f => f(m, {}))));
        return found;
    }
    function describe(voc, m) {
        const typeText = t => '{' + voc.preds.filter((_, i) => (t >> i) & 1).join(',') + '}';
        const parts = [];
        if (voc.letters.length) parts.push('letters ' + voc.letters.map((n, i) => n + '=' + ((m.val >> i) & 1 ? 'T' : 'F')).join(' '));
        if (voc.consts.length) parts.push('constants ' + voc.consts.map((n, i) => n + ':' + typeText(m.types[i])).join(' '));
        if (voc.quantified) {
            const inhabited = [];
            for (let t = 0; t < m.T; t++) if ((m.S >> t) & 1) inhabited.push(typeText(t));
            parts.push('things of types ' + inhabited.join(' '));
        }
        return parts.join('; ');
    }

    function show(f) {
        switch (f.op) {
            case 'true': return '⊤';
            case 'false': return '⊥';
            case 'letter': return f.name;
            case 'pred': return f.name + '(' + f.arg + ')';
            case 'not': return '¬' + show(f.a);
            case 'and': return '(' + show(f.a) + ' ∧ ' + show(f.b) + ')';
            case 'or': return '(' + show(f.a) + ' ∨ ' + show(f.b) + ')';
            case 'imp': return '(' + show(f.a) + ' → ' + show(f.b) + ')';
            case 'iff': return '(' + show(f.a) + ' ↔ ' + show(f.b) + ')';
            case 'all': return '∀' + f.v + ' ' + show(f.body);
            case 'some': return '∃' + f.v + ' ' + show(f.body);
        }
        return '?';
    }

    // The app's reading of a sentence, as a formula. Its forms: atom, pred{term,
    // prop}, not, and/or{parts}, if{conds, cons}, all/some{subject, predicate},
    // unestablished{inner}. `key` gives the app's key of a form, for opaque parts.
    const APP_ANY = '∀any';
    function fromApp(form, keyOf) {
        const propAt = (prop, arg) => {
            if (prop === APP_ANY) return TRUE;
            if (prop.charAt(0) === '¬') return Not(propAt(prop.slice(1), arg));
            return Pr('P[' + prop + ']', arg);
        };
        const go = f => {
            switch (f.kind) {
                case 'atom': return L('A[' + f.text + ']');
                case 'pred': return propAt(f.prop, 'c:' + f.term);
                case 'not': return Not(go(f.inner));
                case 'and': return fold('and', f.parts.map(go));
                case 'or': return fold('or', f.parts.map(go));
                case 'if': return Imp(fold('and', f.conds.map(go)), go(f.cons));
                case 'all': return All('x', Imp(propAt(f.subject, 'x'), propAt(f.predicate, 'x')));
                case 'some': return Some('x', And(propAt(f.subject, 'x'), propAt(f.predicate, 'x')));
                case 'unestablished': return L('W[' + (f._key || (keyOf ? keyOf(f) : JSON.stringify(f.inner))) + ']');
            }
            throw new Error('unknown form kind ' + f.kind);
        };
        return go(form);
    }

    module.exports = { L, Pr, Not, And, Or, Imp, Iff, All, Some, TRUE, FALSE, fold, entails, equivalent, satisfiable, show, fromApp, vocabulary };
    return module.exports;
})();

/* ================= formulas at random ================= */
function symbolicGenerator(rand) {
    const pick = list => list[Math.floor(rand() * list.length)];
    const chance = p => rand() < p;
    // ---- formulas, named as the app names them ----
    const letter = n => O.L('A[' + n.toLowerCase() + ']');
    const pred = (F, arg) => O.Pr('P[§' + F.toLowerCase() + ']', /^[xyz]$/.test(arg) ? arg : 'c:' + arg);
    const LETTERS = ['P', 'Q', 'R', 'S'], PREDS = ['F', 'G', 'H'], CONSTS = ['a', 'b'];

    // A formula tree that remembers how it was built, for printing.
    // { op, ... } as the oracle's, with names in the app's naming.
    function genQuant() {
        const F = pick(PREDS), G = pick(PREDS.filter(p => p !== F));
        const lit = (P, neg) => neg ? O.Not(pred(P, 'x')) : pred(P, 'x');
        const n1 = chance(0.25), n2 = chance(0.35);
        switch (Math.floor(rand() * 9)) {
            case 0: return O.All('x', lit(F, n1));
            case 1: return O.Some('x', lit(F, n1));
            case 2: case 3: return O.All('x', O.Imp(lit(F, n1), lit(G, n2)));
            case 4: case 5: return O.Some('x', O.And(lit(F, n1), lit(G, n2)));
            case 6: return O.All('x', pick([O.And, O.Or, O.Iff])(lit(F, n1), lit(G, n2)));
            case 7: return O.Some('x', pick([O.Imp, O.Or])(lit(F, n1), lit(G, n2)));
            default: return O.All('x', O.Imp(lit(F, n1), pred(G, pick(CONSTS))));
        }
    }
    function genLeaf() {
        const r = rand();
        if (r < 0.45) return letter(pick(LETTERS));
        if (r < 0.75) return pred(pick(PREDS), pick(CONSTS));
        return genQuant();
    }
    function gen(depth) {
        if (depth <= 0 || chance(0.3)) return genLeaf();
        const r = rand();
        if (r < 0.2) return O.Not(gen(depth - 1));
        return pick([O.And, O.Or, O.Imp, O.Iff, O.Imp, O.And, O.Or])(gen(depth - 1), gen(depth - 1));
    }

    // ---- printing, in random spellings ----
    function spellings() {
        return {
            not: pick(['¬', '¬', '~', '-', '∼']),
            and: pick([' ∧ ', ' & ', ' · ', ' ^ ', ' /\\ ', '∧']),
            or: pick([' ∨ ', ' v ', ' | ', ' \\/ ', '∨']),
            imp: pick([' → ', ' -> ', ' ⊃ ', ' => ', '→']),
            iff: pick([' ↔ ', ' <-> ', ' ≡ ', ' <=> ', '↔']),
            all: pick(['∀x ', '∀x', '(x)', '(∀x)', '∀x.']),
            some: pick(['∃x ', '∃x', '(∃x)', '∃x.']),
            pred: pick(['Fx', 'F(x)']),
            paren: pick(['()', '()', '[]']),
            minimal: chance(0.4),
            wide: chance(0.3)
        };
    }
    const RANK = { iff: 1, imp: 2, or: 3, and: 4 };
    function print(f, sp, top, parent, side) {
        const [open, close] = [sp.paren[0], sp.paren[1]];
        // Minimal: leave out brackets that precedence makes unneeded (not around
        // ↔, and not on the left of →, which groups to the right).
        const needless = () => sp.minimal && parent && f.op !== 'iff' && parent !== 'iff' &&
            (RANK[f.op] > RANK[parent] || (f.op === parent && (f.op === 'and' || f.op === 'or')) || (f.op === 'imp' && parent === 'imp' && side === 'b'));
        const wrap = s => top || needless() ? s : open + s + close;
        switch (f.op) {
            case 'letter': return f.name.slice(2, -1).toUpperCase();
            case 'pred': {
                const F = f.name.slice(3, -1).toUpperCase(), a = f.arg.replace(/^c:/, '');
                return sp.pred === 'Fx' ? F + a : F + '(' + a + ')';
            }
            case 'not': return sp.not + print(f.a, sp, false);
            case 'and': case 'or': case 'imp': case 'iff': {
                const op = f.op, opText = sp[op];
                const glue = (sp.minimal && (opText === ' v ' || opText === ' | ') ) ? opText : opText;
                return wrap(print(f.a, sp, false, op, 'a') + glue + print(f.b, sp, false, op, 'b'));
            }
            case 'all': case 'some': {
                let q = f.op === 'all' ? sp.all : sp.some;
                const body = f.body;
                const binary = /^(?:and|or|imp|iff)$/.test(body.op);
                // "∀x Fx", "∀x ¬Fx", "∀x (Fx → Gx)"
                // "∀x Fx → Gx" can only mean "∀x (Fx → Gx)": written so when it is last.
                // (only when the variable turns up after the first part, or it would not be read so)
                const occurs = g => g.op === 'pred' ? g.arg === f.v : g.op === 'not' ? occurs(g.a) : g.a ? occurs(g.a) || occurs(g.b) : g.body ? occurs(g.body) : false;
                let b = binary ? (sp.wide && top && occurs(body.b) ? print(body, sp, true) : open + print(body, sp, true) + close) : print(body, sp, false);
                if (/[xX]$/.test(q) && !binary && /^[A-Z]/.test(b)) q = q + ' ';
                if (q === '∀x.' || q === '∃x.') q = q + ' ';
                return q + b;
            }
        }
        throw new Error('print ' + f.op);
    }

    // ---- rule instances ----
    const neg = f => f.op === 'not' ? f.a : O.Not(f);        // a denial as one would write it
    function closedFormula(depth) { return gen(depth); }
    function instance() {
        const A = closedFormula(1), B = closedFormula(1), C = closedFormula(1), D = closedFormula(1);
        const F = pick(PREDS), G = pick(PREDS.filter(p => p !== F)), H = pick(PREDS.filter(p => p !== F && p !== G));
        const a = pick(CONSTS);
        const px = (P, n) => n ? O.Not(pred(P, 'x')) : pred(P, 'x');
        const pa = (P, n) => n ? O.Not(pred(P, a)) : pred(P, a);
        const nF = chance(0.3), nG = chance(0.3), nH = chance(0.3);
        const all = (P, nP, Q, nQ) => O.All('x', O.Imp(px(P, nP), px(Q, nQ)));
        const some = (P, nP, Q, nQ) => O.Some('x', O.And(px(P, nP), px(Q, nQ)));
        const T = [
            ['modus ponens', [O.Imp(A, B), A], B],
            ['modus ponens (partial)', [O.Imp(A, O.Imp(B, C)), A], O.Imp(B, C)],
            ['modus tollens', [O.Imp(A, B), neg(B)], neg(A)],
            ['modus tollens (double negation)', [O.Imp(A, B), O.Not(B)], O.Not(A)],
            ['hypothetical syllogism', [O.Imp(A, B), O.Imp(B, C)], O.Imp(A, C)],
            ['constructive dilemma', [O.Or(A, B), O.Imp(A, C), O.Imp(B, D)], O.Or(C, D)],
            ['destructive dilemma', [O.Or(neg(C), neg(D)), O.Imp(A, C), O.Imp(B, D)], O.Or(neg(A), neg(B))],
            ['biconditional elimination', [O.Iff(A, B), A], B],
            ['biconditional elimination (right)', [O.Iff(A, B), B], A],
            ['biconditional elimination (denial)', [O.Iff(A, B), neg(A)], neg(B)],
            ['conjunction introduction', [A, B], O.And(A, B)],
            ['conjunction elimination', [O.And(A, B)], A],
            ['disjunction introduction', [A], O.Or(B, A)],
            ['disjunctive syllogism', [O.Or(A, B), neg(A)], B],
            ['Negation Elimination', [O.Not(O.Not(A))], A],
            ['existential introduction', [pa(F, nF)], O.Some('x', px(F, nF))],
            ['existential introduction (pair)', [O.And(pa(F, nF), pa(G, nG))], some(F, nF, G, nG)],
            ['universal elimination', [O.All('x', px(F, nF))], pa(F, nF)],
            ['universal elimination (conditional)', [all(F, nF, G, nG)], O.Imp(pa(F, nF), pa(G, nG))],
            ['universal modus ponens', [all(F, nF, G, nG), pa(F, nF)], pa(G, nG)],
            ['universal modus tollens', [all(F, nF, G, nG), neg(pa(G, nG))], neg(pa(F, nF))],
            ['universal syllogism', [all(F, nF, G, nG), all(G, nG, H, nH)], all(F, nF, H, nH)],
            ['existential syllogism', [some(F, nF, G, nG), all(G, nG, H, nH)], some(F, nF, H, nH)],
            ['reductio', [O.Imp(A, B), O.Imp(A, neg(B))], neg(A)],
            ['reductio (one)', [O.Imp(A, neg(A))], neg(A)],
            ['absorption', [O.Imp(A, B)], O.Imp(A, O.And(A, B))],
            ['quantifier negation (not all)', [O.Not(all(F, nF, G, nG))], O.Some('x', O.And(px(F, nF), neg(px(G, nG))))],
            ['quantifier negation (not some)', [O.Not(some(F, nF, G, nG))], O.All('x', O.Imp(px(F, nF), neg(px(G, nG))))],
            ['quantifier negation (not everything)', [O.Not(O.All('x', px(F, nF)))], O.Some('x', neg(px(F, nF)))],
            ['quantifier negation (not something)', [O.Not(O.Some('x', px(F, nF)))], O.All('x', neg(px(F, nF)))],
            ['double negation', [A], O.Not(O.Not(A))],
            ['De Morgan (and)', [O.Not(O.And(A, B))], O.Or(neg(A), neg(B))],
            ['De Morgan (or)', [O.Not(O.Or(A, B))], O.And(neg(A), neg(B))],
            ['De Morgan (back)', [O.And(neg(A), neg(B))], O.Not(O.Or(A, B))],
            ['transposition', [O.Imp(A, B)], O.Imp(neg(B), neg(A))],
            ['material implication', [O.Imp(A, B)], O.Or(neg(A), B)],
            ['material implication (back)', [O.Or(A, B)], O.Imp(neg(A), B)],
            ['material equivalence', [O.Iff(A, B)], O.Or(O.And(A, B), O.And(neg(A), neg(B)))],
            ['exportation', [O.Imp(O.And(A, B), C)], O.Imp(A, O.Imp(B, C))],
            ['distribution', [O.And(A, O.Or(B, C))], O.Or(O.And(A, B), O.And(A, C))],
            ['distribution (or)', [O.Or(A, O.And(B, C))], O.And(O.Or(A, B), O.Or(A, C))],
            ['tautology', [O.Or(A, A)], A],
            ['conversion (E)', [all(F, false, G, true)], all(G, false, F, true)],
            ['conversion (I)', [some(F, false, G, false)], some(G, false, F, false)],
            ['contraposition', [all(F, nF, G, nG)], O.All('x', O.Imp(neg(px(G, nG)), neg(px(F, nF))))],
            ['De Morgan on a part', [O.And(C, O.Not(O.And(A, B)))], O.And(C, O.Or(neg(A), neg(B)))],
            ['transposition on a part', [O.Or(C, O.Imp(A, B))], O.Or(C, O.Imp(neg(B), neg(A)))],
            ['material implication in a condition', [O.Imp(O.Imp(A, B), C)], O.Imp(O.Or(neg(A), B), C)]
        ];
        return pick(T);
    }

    // ---- fallacies: invalid forms that look like rules ----
    function fallacy() {
        const A = gen(1), B = gen(1), C = gen(1);
        const F = pick(PREDS), G = pick(PREDS.filter(p => p !== F)), H = pick(PREDS.filter(p => p !== F && p !== G));
        const a = pick(CONSTS);
        const px = P => pred(P, 'x'), pa = P => pred(P, a);
        const all = (P, Q) => O.All('x', O.Imp(px(P), px(Q)));
        const some = (P, Q) => O.Some('x', O.And(px(P), px(Q)));
        const T = [
            ['affirming the consequent', [O.Imp(A, B), B], A],
            ['denying the antecedent', [O.Imp(A, B), neg(A)], neg(B)],
            ['converse', [O.Imp(A, B)], O.Imp(B, A)],
            ['inverse', [O.Imp(A, B)], O.Imp(neg(A), neg(B))],
            ['affirming a disjunct', [O.Or(A, B), A], neg(B)],
            ['illicit exportation', [O.Imp(A, O.Imp(B, C))], O.Imp(O.Imp(A, B), C)],
            ['conjunction from disjunction', [O.Or(A, B)], A],
            ['not both to neither', [O.Not(O.And(A, B))], O.And(neg(A), neg(B))],
            ['biconditional from conditional', [O.Imp(A, B), A], O.Iff(A, B)],
            ['A conversion', [all(F, G)], all(G, F)],
            ['O conversion', [O.Some('x', O.And(px(F), O.Not(px(G))))], O.Some('x', O.And(px(G), O.Not(px(F))))],
            ['subalternation', [all(F, G)], some(F, G)],
            ['existential fallacy', [all(F, G), all(G, H)], some(F, H)],
            ['undistributed middle', [all(F, G), all(H, G)], all(F, H)],
            ['illicit major', [all(F, G), O.All('x', O.Imp(px(H), O.Not(px(F))))], O.All('x', O.Imp(px(H), O.Not(px(G))))],
            ['universal from existential', [some(F, G)], all(F, G)],
            ['composition', [O.And(O.Some('x', px(F)), O.Some('x', px(G)))], O.Some('x', O.And(px(F), px(G)))],
            ['division over or', [O.All('x', O.Or(px(F), px(G)))], O.Or(O.All('x', px(F)), O.All('x', px(G)))],
            ['universal modus ponens backwards', [all(F, G), pa(G)], pa(F)],
            ['universal modus tollens backwards', [all(F, G), O.Not(pa(F))], O.Not(pa(G))],
            ['not all to none', [O.Not(all(F, G))], O.All('x', O.Imp(px(F), O.Not(px(G))))],
            ['some not to not some', [O.Some('x', O.And(px(F), O.Not(px(G))))], O.Not(some(F, G))],
            ['existential to instance', [O.Some('x', px(F))], pa(F)],
            ['contraposition wrong way', [all(F, G)], O.All('x', O.Imp(O.Not(px(F)), O.Not(px(G))))],
            ['reductio wrong', [O.Imp(A, B), O.Imp(neg(A), neg(B))], neg(A)],
            ['hypothetical syllogism wrong', [O.Imp(A, B), O.Imp(A, C)], O.Imp(B, C)],
            ['dilemma wrong', [O.Or(A, B), O.Imp(A, C)], C],
            ['absorption wrong', [O.Imp(A, B)], O.Imp(B, O.And(A, B))]
        ];
        return pick(T);
    }

    // ---- mutations: small changes that usually break validity ----
    function subformulas(f, path, out) {
        out.push({ f, path });
        if (f.op === 'not') subformulas(f.a, path.concat(['a']), out);
        else if (/^(?:and|or|imp|iff)$/.test(f.op)) { subformulas(f.a, path.concat(['a']), out); subformulas(f.b, path.concat(['b']), out); }
        else if (f.op === 'all' || f.op === 'some') subformulas(f.body, path.concat(['body']), out);
        return out;
    }
    function replaceAt(f, path, g) {
        if (!path.length) return g;
        const copy = Object.assign({}, f);
        copy[path[0]] = replaceAt(f[path[0]], path.slice(1), g);
        return copy;
    }
    function mutate(formula) {
        const subs = subformulas(formula, [], []);
        const { f, path } = pick(subs);
        const r = rand();
        let g = null;
        if (r < 0.2) g = f.op === 'not' ? f.a : O.Not(f);
        else if (r < 0.35 && f.op === 'letter') g = letter(pick(LETTERS));
        else if (r < 0.45 && f.op === 'pred') g = pred(pick(PREDS), /^[xyz]$/.test(f.arg) ? f.arg : pick(CONSTS));
        else if (r < 0.55 && (f.op === 'all' || f.op === 'some')) g = Object.assign({}, f, { op: f.op === 'all' ? 'some' : 'all' });
        else if (r < 0.7 && f.op === 'imp') g = O.Imp(f.b, f.a);
        else if (r < 0.8 && (f.op === 'and' || f.op === 'or')) g = Object.assign({}, f, { op: f.op === 'and' ? 'or' : 'and' });
        else if (r < 0.9 && f.op === 'iff') g = O.Imp(f.a, f.b);
        else if (f.op === 'imp') g = O.Iff(f.a, f.b);
        else g = f.op === 'not' ? f.a : O.Not(f);
        return replaceAt(formula, path, g);
    }
    return { gen, spellings, print, instance, fallacy, mutate, neg, letter, pred };
}

/* ================= English at random ================= */
const makeEnglish = (function () {
    const module = { exports: {} };
    const require = () => O;

    module.exports = function makeGen(rand) {
        const pick = list => list[Math.floor(rand() * list.length)];
        const chance = p => rand() < p;

        const NAMES = ['Poe', 'Fido', 'Rex'];
        const NOUNS = [
            { sg: 'raven', pl: 'ravens', an: 'a' }, { sg: 'bird', pl: 'birds', an: 'a' },
            { sg: 'crow', pl: 'crows', an: 'a' }, { sg: 'philosopher', pl: 'philosophers', an: 'a' },
            { sg: 'owl', pl: 'owls', an: 'an' }
        ].map(n => Object.assign(n, { type: 'noun', prop: '=' + n.sg }));
        const ADJS = ['black', 'white', 'wise', 'happy', 'old'].map(a => ({ type: 'adj', word: a, prop: '=' + a }));
        const VERBS = [{ s: 'flies', base: 'fly' }, { s: 'sings', base: 'sing' }, { s: 'swims', base: 'swim' }, { s: 'thinks', base: 'think' }]
            .map(v => Object.assign(v, { type: 'verb', prop: '~' + v.base }));
        const CLAUSES = [
            { pos: 'it rains', negs: ['it does not rain', "it doesn't rain"] },
            { pos: 'the ground is wet', negs: ['the ground is not wet', "the ground isn't wet"] },
            { pos: 'the match is off', negs: ['the match is not off', "the match isn't off"] },
            { pos: 'God exists', negs: ['God does not exist', "God doesn't exist"] },
            { pos: 'the roads are icy', negs: ['the roads are not icy', "the roads aren't icy"] },
            { pos: 'the theory is true', negs: ['the theory is not true', 'the theory is false', "the theory isn't true"] }
        ];
        // Filled in from the app's own readings of the clauses (see calibrate).
        const clauseFormula = new Map();
        // The words a step may use: two nouns, two adjectives, a verb.
        let pool = null;
        const choose = (list, n) => { const copy = list.slice(), out = []; while (out.length < n) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]); return out; };
        function beginStep() { pool = { nouns: choose(NOUNS, 2), adjs: choose(ADJS, 2), verbs: choose(VERBS, 1) }; }
        beginStep();

        const P = (pred, arg) => {
            if (pred.prop === '∀any') return O.TRUE;
            return O.Pr('P[' + pred.prop + ']', arg === 'x' ? 'x' : 'c:' + arg.toLowerCase());
        };
        const lit = (pred, arg, neg) => neg ? O.Not(P(pred, arg)) : P(pred, arg);

        // ---- verb phrases ----
        const vpSg = (p, neg) => p.type === 'noun' ? (neg ? pick(['is not ', "isn't "]) : 'is ') + p.an + ' ' + p.sg
            : p.type === 'adj' ? (neg ? pick(['is not ', "isn't "]) : 'is ') + p.word
            : neg ? pick(['does not ', "doesn't "]) + p.base : p.s;
        const vpPl = (p, neg) => p.type === 'noun' ? (neg ? pick(['are not ', "aren't "]) : 'are ') + p.pl
            : p.type === 'adj' ? (neg ? pick(['are not ', "aren't "]) : 'are ') + p.word
            : neg ? pick(['do not ', "don't "]) + p.base : p.base;
        const anyPred = () => pick([pick(pool.nouns), pick(pool.adjs), pick(pool.adjs), pick(pool.verbs)]);

        // ---- simple claims ----
        function predication(name, pred) {
            name = name || pick(NAMES); pred = pred || anyPred();
            const f = P(pred, name);
            const negTexts = [name + ' ' + vpSg(pred, true), 'it is not the case that ' + name + ' ' + vpSg(pred, false)];
            if (pred.type === 'noun' && chance(0.2)) negTexts.push(name + ' is no ' + pred.sg);
            return { text: name + ' ' + vpSg(pred, false), f, negs: negTexts, kind: 'simple', name, pred,
                     neg: () => ({ text: name + ' ' + vpSg(pred, true), f: O.Not(f), negs: [name + ' ' + vpSg(pred, false)], kind: 'simple', name, pred, negated: true }) };
        }
        function clause() {
            const c = pick(CLAUSES);
            const f = clauseFormula.get(c.pos);
            return { text: c.pos, f, negs: c.negs.slice(), kind: 'simple',
                     neg: () => ({ text: pick(c.negs), f: O.Not(f), negs: [c.pos], kind: 'simple', negated: true }) };
        }
        function simple() {
            const r = rand();
            const c = r < 0.55 ? predication() : clause();
            return chance(0.3) ? c.neg() : c;
        }

        // ---- quantified claims ----
        function quant(forced) {
            const S = pick(pool.nouns);
            let Pd = anyPred();
            while (Pd === S) Pd = anyPred();
            const x = 'x';
            const kind = forced || pick(['all', 'all', 'no', 'some', 'someNot', 'notAll', 'everything', 'nothing', 'something', 'only', 'thereIs', 'thereIsNo']);
            const sg = (neg) => vpSg(Pd, neg), pl = (neg) => vpPl(Pd, neg);
            switch (kind) {
                case 'all': return {
                    text: pick(['all ' + S.pl + ' ' + pl(false), 'every ' + S.sg + ' ' + sg(false), 'each ' + S.sg + ' ' + sg(false), 'everything that is ' + S.an + ' ' + S.sg + ' ' + sg(false)]),
                    f: O.All(x, O.Imp(P(S, x), P(Pd, x))), kind: 'quant', S, Pd, q: 'all',
                    negs: ['not all ' + S.pl + ' ' + pl(false), 'not every ' + S.sg + ' ' + sg(false), 'some ' + S.pl + ' ' + pl(true)] };
                case 'no': return {
                    text: pick(['no ' + S.sg + ' ' + sg(false), 'no ' + S.pl + ' ' + pl(false), 'nothing that is ' + S.an + ' ' + S.sg + ' ' + sg(false), 'not a single ' + S.sg + ' ' + sg(false)]),
                    f: O.All(x, O.Imp(P(S, x), O.Not(P(Pd, x)))), kind: 'quant', S, Pd, q: 'no',
                    negs: ['some ' + S.pl + ' ' + pl(false), 'at least one ' + S.sg + ' ' + sg(false)] };
                case 'some': return {
                    text: pick(['some ' + S.pl + ' ' + pl(false), 'some ' + S.sg + ' ' + sg(false), 'at least one ' + S.sg + ' ' + sg(false), 'there is ' + S.an + ' ' + S.sg + ' that ' + sg(false)]),
                    f: O.Some(x, O.And(P(S, x), P(Pd, x))), kind: 'quant', S, Pd, q: 'some',
                    negs: ['no ' + S.sg + ' ' + sg(false), 'no ' + S.pl + ' ' + pl(false)] };
                case 'someNot': return {
                    text: pick(['some ' + S.pl + ' ' + pl(true), 'some ' + S.sg + ' ' + sg(true), 'there is ' + S.an + ' ' + S.sg + ' that ' + sg(true)]),
                    f: O.Some(x, O.And(P(S, x), O.Not(P(Pd, x)))), kind: 'quant', S, Pd, q: 'someNot',
                    negs: ['all ' + S.pl + ' ' + pl(false), 'every ' + S.sg + ' ' + sg(false)] };
                case 'notAll': return {
                    text: pick(['not all ' + S.pl + ' ' + pl(false), 'not every ' + S.sg + ' ' + sg(false)]),
                    f: O.Not(O.All(x, O.Imp(P(S, x), P(Pd, x)))), kind: 'quant', S, Pd, q: 'notAll',
                    negs: ['all ' + S.pl + ' ' + pl(false), 'every ' + S.sg + ' ' + sg(false)] };
                case 'everything': return {
                    text: 'everything ' + sg(false), f: O.All(x, P(Pd, x)), kind: 'quant', Pd, q: 'everything',
                    negs: ['not everything ' + sg(false), 'something ' + sg(true)] };
                case 'nothing': return {
                    text: 'nothing ' + sg(false), f: O.All(x, O.Not(P(Pd, x))), kind: 'quant', Pd, q: 'nothing',
                    negs: ['something ' + sg(false)] };
                case 'something': return {
                    text: 'something ' + sg(false), f: O.Some(x, P(Pd, x)), kind: 'quant', Pd, q: 'something',
                    negs: ['nothing ' + sg(false)] };
                case 'only': {
                    const A = pick(pool.adjs.concat(pool.verbs));
                    return { text: A.type === 'adj' ? 'only ' + S.pl + ' are ' + A.word : 'only ' + S.pl + ' ' + A.base,
                        f: O.All(x, O.Imp(P(A, x), P(S, x))), kind: 'quant', S, Pd: A, q: 'only', negs: [] };
                }
                case 'thereIs': return {
                    text: pick(['there is ' + S.an + ' ' + S.sg, 'there are ' + S.pl]), f: O.Some(x, P(S, x)), kind: 'quant', S, q: 'thereIs',
                    negs: ['there is no ' + S.sg, 'there are no ' + S.pl] };
                case 'thereIsNo': return {
                    text: pick(['there is no ' + S.sg, 'there are no ' + S.pl]), f: O.Not(O.Some(x, P(S, x))), kind: 'quant', S, q: 'thereIsNo',
                    negs: ['there is ' + S.an + ' ' + S.sg, 'there are ' + S.pl] };
            }
        }

        // ---- verb phrases joined: "Poe is black and old" ----
        function vpJoin() {
            const name = pick(NAMES);
            const [a, b] = choose(pool.adjs, 2);
            const v1 = pool.verbs[0];
            switch (Math.floor(rand() * 5)) {
                case 0: return { text: name + ' is ' + a.word + ' and ' + b.word, f: O.And(P(a, name), P(b, name)), kind: 'vp', negs: [] };
                case 1: return { text: name + ' is ' + pick(['', 'either ']) + a.word + ' or ' + b.word, f: O.Or(P(a, name), P(b, name)), kind: 'vp', negs: [name + ' is neither ' + a.word + ' nor ' + b.word] };
                case 2: return { text: name + ' is neither ' + a.word + ' nor ' + b.word, f: O.And(O.Not(P(a, name)), O.Not(P(b, name))), kind: 'vp', negs: [] };
                case 3: return { text: name + ' ' + v1.s + ' and is ' + a.word, f: O.And(P(v1, name), P(a, name)), kind: 'vp', negs: [] };
                default: return { text: name + ' is both ' + a.word + ' and ' + b.word, f: O.And(P(a, name), P(b, name)), kind: 'vp', negs: [] };
            }
        }

        // A claim that can sit inside a connective: one without "and"/"or" of its
        // own when it will be joined to another.
        function part() {
            for (let i = 0; i < 6; i++) { const c = anyPart(); if (!/ (?:and|or|nor) |^(?:neither|either|both) /.test(c.text)) return c; }
            return simple();
        }
        function anyPart() {
            const r = rand();
            if (r < 0.5) return simple();
            if (r < 0.85) return quant();
            return vpJoin();
        }
        const denial = c => c.neg && chance(0.6) ? c.neg() :
            { text: c.negs && c.negs.length && chance(0.8) ? pick(c.negs) : 'it is not the case that ' + c.text, f: O.Not(c.f), kind: 'simple', negs: [c.text], negated: true };

        // ---- compounds ----
        const wide = c => /^(?:it is not the case that|it is false that) /.test(c.text) || c.kind === 'vp' || / (?:and|or|nor) /.test(c.text);
        const cond = (a, b) => wide(b) ? pick([
            { text: 'if ' + a.text + ', then ' + b.text, f: O.Imp(a.f, b.f) },
            { text: 'if ' + a.text + ', ' + b.text, f: O.Imp(a.f, b.f) }
        ]) : wide(a) ? pick([
            { text: 'if ' + a.text + ', then ' + b.text, f: O.Imp(a.f, b.f) },
            { text: b.text + ' if ' + a.text, f: O.Imp(a.f, b.f) },
            { text: b.text + ' provided that ' + a.text, f: O.Imp(a.f, b.f) }
        ]) : pick([
            { text: 'if ' + a.text + ', then ' + b.text, f: O.Imp(a.f, b.f) },
            { text: 'if ' + a.text + ', ' + b.text, f: O.Imp(a.f, b.f) },
            { text: b.text + ' if ' + a.text, f: O.Imp(a.f, b.f) },
            { text: a.text + ' only if ' + b.text, f: O.Imp(a.f, b.f) },
            { text: b.text + ' provided that ' + a.text, f: O.Imp(a.f, b.f) }
        ]);
        const disj = (a, b) => wide(a) ? { text: 'either ' + a.text + ' or ' + b.text, f: O.Or(a.f, b.f) } : pick([
            { text: 'either ' + a.text + ' or ' + b.text, f: O.Or(a.f, b.f) },
            { text: a.text + ' or ' + b.text, f: O.Or(a.f, b.f) },
            { text: a.text + ' unless ' + b.text, f: O.Or(a.f, b.f) }
        ]);
        const conj = (a, b) => wide(a) ? { text: 'both ' + a.text + ' and ' + b.text, f: O.And(a.f, b.f) } : pick([
            { text: a.text + ' and ' + b.text, f: O.And(a.f, b.f) },
            { text: 'both ' + a.text + ' and ' + b.text, f: O.And(a.f, b.f) }
        ]);
        const iff = (a, b) => wide(a) && !wide(b) ? iff(b, a) : pick([
            { text: a.text + ' if and only if ' + b.text, f: O.Iff(a.f, b.f) },
            { text: a.text + ' just in case ' + b.text, f: O.Iff(a.f, b.f) }
        ]);
        const neither = (a, b) => / (?:nor|or|and) |^neither /.test(a.text + ' ' + b.text) ? { text: 'it is not the case that either ' + a.text + ' or ' + b.text, f: O.Not(O.Or(a.f, b.f)) }
            : { text: 'neither ' + a.text + ' nor ' + b.text, f: O.And(O.Not(a.f), O.Not(b.f)) };

        const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
        const sentence = c => cap(c.text) + (chance(0.5) ? '.' : '');

        // ---- rule instances (valid) ----
        function instance() {
            const A = chance(0.3) ? anyPart() : part(), B = part(), C = part(), D = part();
            const name = pick(NAMES), S = pick(pool.nouns);
            let M = pick(pool.nouns); while (M === S) M = pick(pool.nouns);
            let Adj = pick(pool.adjs.concat(pool.verbs));
            const T = [
                () => { const k = cond(A, B); return ['modus ponens', [k, A], B]; },
                () => { const k = cond(A, B); const nb = denial(B); return ['modus tollens', [k, nb], denial(A)]; },
                () => ['hypothetical syllogism', [cond(A, B), cond(B, C)], cond(A, C)],
                () => ['disjunctive syllogism', [disj(A, B), denial(A)], B],
                () => wide(A) ? ['disjunctive syllogism', [disj(A, B), denial(A)], B] : ['disjunctive syllogism (unless)', [{ text: A.text + ' unless ' + B.text, f: O.Or(A.f, B.f) }, denial(B)], A],
                () => ['constructive dilemma', [{ text: 'either ' + A.text + ' or ' + B.text, f: O.Or(A.f, B.f) }, cond(A, C), cond(B, D)], { text: 'either ' + C.text + ' or ' + D.text, f: O.Or(C.f, D.f) }],
                () => { const nc = denial(C), nd = denial(D), na = denial(A), nb = denial(B);
                        return ['destructive dilemma', [{ text: 'either ' + nc.text + ' or ' + nd.text, f: O.Or(nc.f, nd.f) }, cond(A, C), cond(B, D)], { text: 'either ' + na.text + ' or ' + nb.text, f: O.Or(na.f, nb.f) }]; },
                () => { const X = part(), Y = part(); return ['biconditional elimination', [iff(X, Y), X], Y]; },
                () => { const X = part(), Y = part(); return ['biconditional elimination (denial)', [iff(X, Y), denial(X)], denial(Y)]; },
                () => ['conjunction introduction', [A, B], conj(A, B)],
                () => ['modus ponens (only if in front)', [{ text: 'only if ' + B.text + ', ' + A.text, f: O.Imp(A.f, B.f) }, A], B],
                () => { const p = pick(pool.adjs.concat(pool.verbs)); const [N1, N2] = pool.nouns;
                        return ['universal modus ponens (nouns joined)', [{ text: 'all ' + N1.pl + ' and ' + N2.pl + ' ' + vpPl(p, false), f: O.And(O.All('x', O.Imp(P(N1, 'x'), P(p, 'x'))), O.All('x', O.Imp(P(N2, 'x'), P(p, 'x')))) }],
                            { text: 'all ' + N2.pl + ' ' + vpPl(p, false), f: O.All('x', O.Imp(P(N2, 'x'), P(p, 'x'))) }]; },
                () => ['biconditional elimination (commas)', [{ text: A.text + ' if, and only if, ' + B.text, f: O.Iff(A.f, B.f), skipIf: wide(A) }, B], A],
                () => ['conjunction elimination', [conj(A, B)], A],
                () => { const v = vpJoin(); if (v.f.op !== 'and' || v.f.a.op !== 'pred') return ['conjunction introduction', [A, B], conj(A, B)];
                        const first = / and is \w+$/.test(v.text) ? v.text.replace(/ and is \w+$/, '') : v.text.replace(/ is (?:both )?(\w+) and \w+$/, ' is $1');
                        return ['conjunction elimination (predicates)', [v], { text: first, f: v.f.a }]; },
                () => ['disjunction introduction', [A], { text: 'either ' + A.text + ' or ' + B.text, f: O.Or(A.f, B.f) }],
                () => { if (A.negated) return ['conjunction introduction', [A, B], conj(A, B)]; const nA = denial(A); return ['Negation Elimination', [{ text: 'it is not the case that ' + nA.text, f: O.Not(nA.f) }], A]; },
                () => { const p = pick(pool.adjs.concat(pool.verbs)); return ['existential introduction', [{ text: name + ' is ' + S.an + ' ' + S.sg + ' and ' + name + ' ' + vpSg(p, false), f: O.And(P(S, name), P(p, name)) }], { text: pick(['some ' + S.sg + ' ' + vpSg(p, false), 'at least one ' + S.sg + ' ' + vpSg(p, false)]), f: O.Some('x', O.And(P(S, 'x'), P(p, 'x'))) }]; },
                () => { const p = pick(pool.adjs.concat(pool.verbs)); return ['existential introduction (something)', [{ text: name + ' ' + vpSg(p, false), f: P(p, name) }], { text: 'something ' + vpSg(p, false), f: O.Some('x', P(p, 'x')) }]; },
                () => { const p = pick(pool.adjs.concat(pool.verbs)); return ['universal elimination', [{ text: 'everything ' + vpSg(p, false), f: O.All('x', P(p, 'x')) }], { text: name + ' ' + vpSg(p, false), f: P(p, name) }]; },
                () => { const q = quant('all'); return ['universal modus ponens', [q, { text: name + ' is ' + q.S.an + ' ' + q.S.sg, f: P(q.S, name) }], { text: name + ' ' + vpSg(q.Pd, false), f: P(q.Pd, name) }]; },
                () => { const q = quant('no'); return ['universal modus ponens (no)', [q, { text: name + ' is ' + q.S.an + ' ' + q.S.sg, f: P(q.S, name) }], { text: name + ' ' + vpSg(q.Pd, true), f: O.Not(P(q.Pd, name)) }]; },
                () => { const q = quant('all'); return ['universal modus tollens', [q, { text: name + ' ' + vpSg(q.Pd, true), f: O.Not(P(q.Pd, name)) }], { text: name + ' ' + vpSg(q.S, true), f: O.Not(P(q.S, name)) }]; },
                () => { const p = pick(pool.adjs.concat(pool.verbs)); return ['universal syllogism', [{ text: 'all ' + S.pl + ' are ' + M.pl, f: O.All('x', O.Imp(P(S, 'x'), P(M, 'x'))) }, { text: 'all ' + M.pl + ' ' + vpPl(p, false), f: O.All('x', O.Imp(P(M, 'x'), P(p, 'x'))) }], { text: 'all ' + S.pl + ' ' + vpPl(p, false), f: O.All('x', O.Imp(P(S, 'x'), P(p, 'x'))) }]; },
                () => { const p = pick(pool.adjs.concat(pool.verbs)); return ['existential syllogism', [{ text: 'some ' + S.pl + ' are ' + M.pl, f: O.Some('x', O.And(P(S, 'x'), P(M, 'x'))) }, { text: 'all ' + M.pl + ' ' + vpPl(p, false), f: O.All('x', O.Imp(P(M, 'x'), P(p, 'x'))) }], { text: 'some ' + S.pl + ' ' + vpPl(p, false), f: O.Some('x', O.And(P(S, 'x'), P(p, 'x'))) }]; },
                () => { const q = quant(pick(['all', 'some'])); return ['quantifier negation', [{ text: q.q === 'all' ? 'not all ' + q.S.pl + ' ' + vpPl(q.Pd, false) : 'it is not the case that some ' + q.S.pl + ' ' + vpPl(q.Pd, false), f: O.Not(q.f) }],
                    q.q === 'all' ? { text: 'some ' + q.S.pl + ' ' + vpPl(q.Pd, true), f: O.Some('x', O.And(P(q.S, 'x'), O.Not(P(q.Pd, 'x')))) } : { text: 'no ' + q.S.sg + ' ' + vpSg(q.Pd, false), f: O.All('x', O.Imp(P(q.S, 'x'), O.Not(P(q.Pd, 'x')))) }]; },
                () => { const na = denial(A), nb = denial(B); return ['De Morgan', [{ text: 'it is not the case that both ' + A.text + ' and ' + B.text, f: O.Not(O.And(A.f, B.f)) }], { text: 'either ' + na.text + ' or ' + nb.text, f: O.Or(na.f, nb.f) }]; },
                () => ['De Morgan (neither)', [neither(A, B)], { text: 'it is not the case that either ' + A.text + ' or ' + B.text, f: O.Not(O.Or(A.f, B.f)) }],
                () => { const nb = denial(B), na = denial(A); return ['transposition', [{ text: 'if ' + A.text + ', then ' + B.text, f: O.Imp(A.f, B.f) }], { text: 'if ' + nb.text + ', then ' + na.text, f: O.Imp(nb.f, na.f) }]; },
                () => { const na = denial(A); return ['material implication', [{ text: 'if ' + A.text + ', then ' + B.text, f: O.Imp(A.f, B.f) }], { text: 'either ' + na.text + ' or ' + B.text, f: O.Or(na.f, B.f) }]; },
                () => { const nb = denial(B); return ['reductio', [{ text: 'if ' + A.text + ', then ' + B.text, f: O.Imp(A.f, B.f) }, { text: 'if ' + A.text + ', then ' + nb.text, f: O.Imp(A.f, nb.f) }], denial(A)]; },
                () => ['exportation', [{ text: 'if ' + A.text + ' and ' + B.text + ', then ' + C.text, f: O.Imp(O.And(A.f, B.f), C.f) }], { text: 'if ' + A.text + ', then if ' + B.text + ', then ' + C.text, f: O.Imp(A.f, O.Imp(B.f, C.f)) }],
                () => { const q = quant('no'); return ['conversion', [q],
                    q.Pd.type === 'noun' ? { text: 'no ' + q.Pd.pl + ' are ' + q.S.pl, f: O.All('x', O.Imp(P(q.Pd, 'x'), O.Not(P(q.S, 'x')))) }
                    : q.Pd.type === 'adj' ? { text: 'nothing that is ' + q.Pd.word + ' is ' + q.S.an + ' ' + q.S.sg, f: O.All('x', O.Imp(P(q.Pd, 'x'), O.Not(P(q.S, 'x')))) }
                    : { text: 'nothing that ' + q.Pd.s + ' is ' + q.S.an + ' ' + q.S.sg, f: O.All('x', O.Imp(P(q.Pd, 'x'), O.Not(P(q.S, 'x')))) }]; },
                () => { const q = quant('all'); return ['contraposition', [q], { text: 'nothing that ' + vpSg(q.Pd, true) + ' is ' + q.S.an + ' ' + q.S.sg, f: O.All('x', O.Imp(O.Not(P(q.Pd, 'x')), O.Not(P(q.S, 'x')))) }]; }
            ];
            return pick(T)();
        }

        // ---- fallacies (invalid) ----
        function fallacy() {
            const A = part(), B = part(), C = part();
            const name = pick(NAMES), S = pick(pool.nouns);
            let M = pick(pool.nouns); while (M === S) M = pick(pool.nouns);
            const p = pick(pool.adjs.concat(pool.verbs));
            const T = [
                () => ['affirming the consequent', [cond(A, B), B], A],
                () => ['denying the antecedent', [cond(A, B), denial(A)], denial(B)],
                () => ['converse', [{ text: 'if ' + A.text + ', then ' + B.text, f: O.Imp(A.f, B.f) }], { text: 'if ' + B.text + ', then ' + A.text, f: O.Imp(B.f, A.f) }],
                () => wide(A) ? ['converse', [cond(A, B)], cond(B, A)] : ['only if reversed', [{ text: A.text + ' only if ' + B.text, f: O.Imp(A.f, B.f) }], { text: A.text + ' if ' + B.text, f: O.Imp(B.f, A.f) }],
                () => wide(A) ? ['affirming the consequent', [cond(A, B), B], A] : ['only if affirming', [{ text: A.text + ' only if ' + B.text, f: O.Imp(A.f, B.f) }, B], A],
                () => wide(A) ? ['converse', [cond(A, B)], cond(B, A)] : ['unless as if', [{ text: A.text + ' unless ' + B.text, f: O.Or(A.f, B.f) }], { text: A.text + ' if ' + B.text, f: O.Imp(B.f, A.f) }],
                () => wide(A) ? ['affirming a disjunct', [disj(A, B), A], denial(B)] : ['unless affirming', [{ text: A.text + ' unless ' + B.text, f: O.Or(A.f, B.f) }, B], denial(A)],
                () => ['affirming a disjunct', [disj(A, B), A], denial(B)],
                () => { const na = denial(A), nb = denial(B); return ['not both as neither', [{ text: 'it is not the case that both ' + A.text + ' and ' + B.text, f: O.Not(O.And(A.f, B.f)) }], conj(na, nb)]; },
                () => ['A conversion', [{ text: 'all ' + S.pl + ' are ' + M.pl, f: O.All('x', O.Imp(P(S, 'x'), P(M, 'x'))) }], { text: 'all ' + M.pl + ' are ' + S.pl, f: O.All('x', O.Imp(P(M, 'x'), P(S, 'x'))) }],
                () => ['only confused with all', [{ text: 'only ' + S.pl + ' are ' + M.pl, f: O.All('x', O.Imp(P(M, 'x'), P(S, 'x'))) }, { text: name + ' is ' + S.an + ' ' + S.sg, f: P(S, name) }], { text: name + ' is ' + M.an + ' ' + M.sg, f: P(M, name) }],
                () => ['universal modus ponens backwards', [{ text: 'all ' + S.pl + ' ' + vpPl(p, false), f: O.All('x', O.Imp(P(S, 'x'), P(p, 'x'))) }, { text: name + ' ' + vpSg(p, false), f: P(p, name) }], { text: name + ' is ' + S.an + ' ' + S.sg, f: P(S, name) }],
                () => ['universal modus tollens backwards', [{ text: 'all ' + S.pl + ' ' + vpPl(p, false), f: O.All('x', O.Imp(P(S, 'x'), P(p, 'x'))) }, { text: name + ' is not ' + S.an + ' ' + S.sg, f: O.Not(P(S, name)) }], { text: name + ' ' + vpSg(p, true), f: O.Not(P(p, name)) }],
                () => ['some to some not', [{ text: 'some ' + S.pl + ' ' + vpPl(p, false), f: O.Some('x', O.And(P(S, 'x'), P(p, 'x'))) }], { text: 'some ' + S.pl + ' ' + vpPl(p, true), f: O.Some('x', O.And(P(S, 'x'), O.Not(P(p, 'x')))) }],
                () => ['not all to none', [{ text: 'not all ' + S.pl + ' ' + vpPl(p, false), f: O.Not(O.All('x', O.Imp(P(S, 'x'), P(p, 'x')))) }], { text: 'no ' + S.sg + ' ' + vpSg(p, false), f: O.All('x', O.Imp(P(S, 'x'), O.Not(P(p, 'x')))) }],
                () => ['existential import', [{ text: 'all ' + S.pl + ' ' + vpPl(p, false), f: O.All('x', O.Imp(P(S, 'x'), P(p, 'x'))) }], { text: 'some ' + S.pl + ' ' + vpPl(p, false), f: O.Some('x', O.And(P(S, 'x'), P(p, 'x'))) }],
                () => ['existential import (no)', [{ text: 'no ' + S.sg + ' ' + vpSg(p, false), f: O.All('x', O.Imp(P(S, 'x'), O.Not(P(p, 'x')))) }], { text: 'some ' + S.pl + ' ' + vpPl(p, true), f: O.Some('x', O.And(P(S, 'x'), O.Not(P(p, 'x')))) }],
                () => ['undistributed middle', [{ text: 'all ' + S.pl + ' ' + vpPl(p, false), f: O.All('x', O.Imp(P(S, 'x'), P(p, 'x'))) }, { text: 'all ' + M.pl + ' ' + vpPl(p, false), f: O.All('x', O.Imp(P(M, 'x'), P(p, 'x'))) }], { text: 'all ' + S.pl + ' are ' + M.pl, f: O.All('x', O.Imp(P(S, 'x'), P(M, 'x'))) }],
                () => ['composition', [{ text: 'something is ' + S.an + ' ' + S.sg, f: O.Some('x', P(S, 'x')) }, { text: 'something ' + vpSg(p, false), f: O.Some('x', P(p, 'x')) }], { text: 'some ' + S.sg + ' ' + vpSg(p, false), f: O.Some('x', O.And(P(S, 'x'), P(p, 'x'))) }],
                () => ['generic instance', [{ text: S.pl + ' ' + vpPl(p, false), f: O.L('GENERIC[' + S.pl + ' ' + p.prop + ']'), opaque: true }, { text: name + ' is ' + S.an + ' ' + S.sg, f: P(S, name) }], { text: name + ' ' + vpSg(p, false), f: P(p, name) }],
                () => ['indefinite instance', [{ text: S.an + ' ' + S.sg + ' ' + vpSg(p, false), f: O.L('INDEF[' + S.sg + ' ' + p.prop + ']'), opaque: true }, { text: name + ' is ' + S.an + ' ' + S.sg, f: P(S, name) }], { text: name + ' ' + vpSg(p, false), f: P(p, name) }],
                () => ['existential to instance', [{ text: 'something ' + vpSg(p, false), f: O.Some('x', P(p, 'x')) }], { text: name + ' ' + vpSg(p, false), f: P(p, name) }],
                () => ['predicates: or to one', [{ text: name + ' is ' + pool.adjs[0].word + ' or ' + pool.adjs[1].word, f: O.Or(P(pool.adjs[0], name), P(pool.adjs[1], name)) }], { text: name + ' is ' + pool.adjs[0].word, f: P(pool.adjs[0], name) }],
                () => ['not both to not one', [{ text: name + ' is not both ' + pool.adjs[0].word + ' and ' + pool.adjs[1].word, f: O.Not(O.And(P(pool.adjs[0], name), P(pool.adjs[1], name))) }], { text: name + ' is not ' + pool.adjs[0].word, f: O.Not(P(pool.adjs[0], name)) }],
                () => ['hypothetical syllogism wrong', [cond(A, B), cond(A, C)], cond(B, C)],
                () => ['biconditional from conditional', [cond(A, B)], iff(A, B)]
            ];
            return pick(T)();
        }

        // ---- mutation of a claim: a close claim that usually means something else ----
        function mutateClaim(c) {
            const r = rand();
            if (r < 0.4) return denial(c);
            if (r < 0.7) return part();
            // swap a name or a word
            const names = NAMES.filter(n => c.text.indexOf(n) >= 0);
            if (names.length) {
                const from = pick(names); let to = pick(NAMES); while (to === from) to = pick(NAMES);
                return { text: c.text.split(from).join(to), f: renameConst(c.f, from.toLowerCase(), to.toLowerCase()), kind: c.kind, negs: [] };
            }
            return denial(c);
        }
        function renameConst(f, from, to) {
            if (f.op === 'pred') return f.arg === 'c:' + from ? O.Pr(f.name, 'c:' + to) : f;
            if (f.op === 'not') return O.Not(renameConst(f.a, from, to));
            if (f.a && f.b) return { op: f.op, a: renameConst(f.a, from, to), b: renameConst(f.b, from, to) };
            if (f.body) return { op: f.op, v: f.v, body: renameConst(f.body, from, to) };
            return f;
        }

        return { helpers: { P, vpSg, vpPl }, NAMES, NOUNS, ADJS, VERBS, CLAUSES, clauseFormula, beginStep, instance, fallacy, part, denial, mutateClaim, sentence, cap, quant, simple, vpJoin, cond, disj, conj, iff, neither };
    };

    return module.exports;
})();
const moreEnglish = (function () {
    const module = { exports: {} };
    const require = () => O;

    module.exports = function more(G, rand) {
        const pick = list => list[Math.floor(rand() * list.length)];
        const chance = p => rand() < p;
        const H = G.helpers;
        const opaque = (name, text) => ({ text, f: O.L('OPAQUE[' + name + ']'), opaque: true });
        const P = H.P;
        const two = list => { const a = pick(list); let b = pick(list); while (b === a) b = pick(list); return [a, b]; };

        // Objects: "owns a car" / "owns no car" / "does not own any car";
        // "knows something" / "knows nothing" / "does not know anything".
        const OBJECTS = [
            { s: 'owns', base: 'own', prop: '~own car', pos: 'a car', npi: 'owns any car', some: 'some car', negs: [['owns no car', 'own no car'], ['does not own any car', 'do not own any car'], ['does not own a car', 'do not own a car'], ["doesn't own any car", "don't own any car"]] },
            { s: 'knows', base: 'know', prop: '~know something', pos: 'something', npi: 'knows anything', some: 'something', negs: [['knows nothing', 'know nothing'], ['does not know anything', 'do not know anything'], ["doesn't know anything", "don't know anything"]] },
            { s: 'sees', base: 'see', prop: '~see someone', pos: 'someone', npi: 'sees anyone', some: 'someone', negs: [['sees no one', 'see no one'], ['does not see anyone', 'do not see anyone']] },
            { s: 'meets', base: 'meet', prop: '~meet somebody', pos: 'somebody', npi: 'meets anybody', some: 'somebody', negs: [['meets nobody', 'meet nobody'], ['does not meet anybody', 'do not meet anybody']] }
        ];
        const objClaim = (name, o, neg) => neg
            ? { text: name + ' ' + pick(o.negs)[0], f: O.Not(P({ prop: o.prop }, name)) }
            : { text: name + ' ' + o.s + ' ' + o.pos, f: P({ prop: o.prop }, name) };

        function oracleCase() {
            const [X, Y] = two(G.NAMES);
            const S = pick(G.NOUNS), [a, b] = two(G.ADJS), [v1, v2] = two(G.VERBS);
            const p = pick([S, a, v1]);
            const sg = (q, neg) => H.vpSg(q, neg), pl = (q, neg) => H.vpPl(q, neg);
            const o = pick(OBJECTS);
            const T = [
                // subjects joined
                () => ['joined: neither', [{ text: 'neither ' + X + ' nor ' + Y + ' ' + sg(p, false), f: O.And(O.Not(P(p, X)), O.Not(P(p, Y))) }], { text: Y + ' ' + sg(p, true), f: O.Not(P(p, Y)) }],
                () => ['joined: either', [{ text: 'either ' + X + ' or ' + Y + ' ' + sg(p, false), f: O.Or(P(p, X), P(p, Y)) }, { text: X + ' ' + sg(p, true), f: O.Not(P(p, X)) }], { text: Y + ' ' + sg(p, false), f: P(p, Y) }],
                () => ['joined: both', [{ text: 'both ' + X + ' and ' + Y + ' ' + pl(p, false), f: O.And(P(p, X), P(p, Y)) }], { text: X + ' ' + sg(p, false), f: P(p, X) }],
                () => ['joined: or', [{ text: X + ' or ' + Y + ' ' + sg(p, false), f: O.Or(P(p, X), P(p, Y)) }, { text: Y + ' ' + sg(p, true), f: O.Not(P(p, Y)) }], { text: X + ' ' + sg(p, false), f: P(p, X) }],
                () => ['fallacy: joined denial', [{ text: 'if both ' + X + ' and ' + Y + ' ' + pl(p, false) + ', then the match is off', f: O.Imp(O.And(P(p, X), P(p, Y)), G.clauseFormula.get('the match is off')) },
                    { text: 'the match is not off', f: O.Not(G.clauseFormula.get('the match is off')) }], { text: 'both ' + X + ' and ' + Y + ' ' + pl(p, true), f: O.And(O.Not(P(p, X)), O.Not(P(p, Y))) }],
                () => ['fallacy: X and Y are', [opaque('xandy', X + ' and ' + Y + ' ' + pl(p, false))], { text: X + ' ' + sg(p, false), f: P(p, X) }],
                () => ['fallacy: X or Y is not', [{ text: X + ' or ' + Y + ' ' + sg(p, true), f: O.Or(O.Not(P(p, X)), O.Not(P(p, Y))) }], { text: 'it is not the case that ' + X + ' or ' + Y + ' ' + sg(p, false), f: O.Not(O.Or(P(p, X), P(p, Y))) }],
                // objects
                () => ['objects: disjunctive syllogism', [{ text: 'either ' + X + ' ' + o.s + ' ' + o.pos + ' or ' + X + ' ' + sg(p, false), f: O.Or(P({ prop: o.prop }, X), P(p, X)) }, objClaim(X, o, true)], { text: X + ' ' + sg(p, false), f: P(p, X) }],
                () => ['objects: modus tollens', [{ text: 'if ' + X + ' ' + o.s + ' ' + o.pos + ', then ' + X + ' ' + sg(p, false), f: O.Imp(P({ prop: o.prop }, X), P(p, X)) }, { text: X + ' ' + sg(p, true), f: O.Not(P(p, X)) }], objClaim(X, o, true)],
                () => ['objects: no ... any', [{ text: 'no ' + S.sg + ' ' + o.npi, f: O.All('x', O.Imp(P(S, 'x'), O.Not(P({ prop: o.prop }, 'x')))) },
                    { text: X + ' is ' + S.an + ' ' + S.sg, f: P(S, X) }], objClaim(X, o, true)],
                () => ['fallacy: not ... some', [opaque('notsome', X + ' does not ' + o.base + ' ' + o.some)], { text: 'it is not the case that ' + X + ' ' + o.s + ' ' + o.some, f: O.Not(P({ prop: '~' + o.base + ' ' + o.some }, X)) }],
                () => ['fallacy: free choice any', [{ text: 'if ' + X + ' can not beat a player, then ' + X + ' is weak', f: O.Imp(O.Not(P({ prop: '~can beat player' }, X)), P({ prop: '=weak' }, X)) }, { text: X + ' is not weak', f: O.Not(P({ prop: '=weak' }, X)) }],
                    { text: X + ' can beat any player', f: P({ prop: '~can beat any player' }, X) }],
                // modals
                () => ['modal: can ... or', [{ text: X + ' can ' + v1.base + ' or ' + v2.base, f: O.Or(P({ prop: '~can ' + v1.base }, X), P({ prop: '~can ' + v2.base }, X)) }, { text: X + ' cannot ' + v1.base, f: O.Not(P({ prop: '~can ' + v1.base }, X)) }], { text: X + ' can ' + v2.base, f: P({ prop: '~can ' + v2.base }, X) }],
                () => ['modal: must ... and', [{ text: X + ' must ' + v1.base + ' and ' + v2.base, f: O.And(P({ prop: '~must ' + v1.base }, X), P({ prop: '~must ' + v2.base }, X)) }], { text: X + ' must ' + v2.base, f: P({ prop: '~must ' + v2.base }, X) }],
                () => ['fallacy: must ... or', [opaque('mustor', X + ' must ' + v1.base + ' or ' + v2.base), { text: 'it is not the case that ' + X + ' must ' + v1.base, f: O.Not(P({ prop: '~must ' + v1.base }, X)) }], { text: X + ' must ' + v2.base, f: P({ prop: '~must ' + v2.base }, X) }],
                () => ['fallacy: can ... and', [{ text: X + ' can ' + v1.base, f: P({ prop: '~can ' + v1.base }, X) }, { text: X + ' can ' + v2.base, f: P({ prop: '~can ' + v2.base }, X) }], opaque('canand', X + ' can ' + v1.base + ' and ' + v2.base)],
                // relations
                () => ['fallacy: between', [opaque('between', 'Poe is between Fido and Rex')], opaque('isrex', 'Poe is Rex')],
                () => ['fallacy: blend', [opaque('blend', 'the mixture is a blend of sand and water')], opaque('water', 'the mixture is water')],
                // numbers
                () => ['fallacy: one raven', [opaque('one', 'one ' + S.sg + ' ' + sg(p, true))], opaque('onenot', 'it is not the case that one ' + S.sg + ' ' + sg(p, false))],
                () => ['fallacy: two ravens', [opaque('two', 'two ' + S.pl + ' ' + pl(p, false)), { text: 'all ' + S.pl + ' are birds', f: O.All('x', O.Imp(P(S, 'x'), P({ prop: '=bird' }, 'x'))) }], opaque('twobirds', 'two birds ' + pl(p, false))],
                // pronouns bound by "something"
                () => ['bound: universal modus ponens', [{ text: 'if something is ' + S.an + ' ' + S.sg + ', then it ' + sg(p, false), f: O.All('x', O.Imp(P(S, 'x'), P(p, 'x'))) }, { text: X + ' is ' + S.an + ' ' + S.sg, f: P(S, X) }], { text: X + ' ' + sg(p, false), f: P(p, X) }],
                () => ['fallacy: bound it', [{ text: 'if something is ' + S.an + ' ' + S.sg + ', then it ' + sg(p, false), f: O.All('x', O.Imp(P(S, 'x'), P(p, 'x'))) }, opaque('itnot', 'it ' + sg(p, true))], { text: 'nothing is ' + S.an + ' ' + S.sg, f: O.All('x', O.Not(P(S, 'x'))) }]
            ];
            return pick(T)();
        }

        // Steps the oracle cannot judge: weak objections and counterfactuals.
        const WEAK = [
            ['it has not been shown that', false], ['it has not yet been established that', false], ['it has yet to be shown that', false],
            ['it is not known whether', true], ['it is unclear whether', true], ['it is an open question whether', true], ['it remains to be seen whether', true],
            ['we cannot conclude that', false], ["we can't conclude that", false], ['it cannot be concluded that', false], ['it does not follow that', false],
            ['there is no evidence that', false], ['there is no good reason to believe that', false], ['we have no reason to think that', false],
            ['we do not know that', false], ['we are not entitled to conclude that', false], ['nobody has shown that', false], ['no one knows whether', true],
            ['this does not show that', false], ['the argument fails to establish that', false], ['the evidence does not prove that', false],
            ['it is not obvious that', false], ['it is doubtful that', false], ["it's not been shown that", false],
            ['we are not warranted in believing that', false], ['it is not warranted to conclude that', false],
            ['there is insufficient warrant for believing that', false], ['we lack warrant for concluding that', false],
            ['there is not sufficient warrant for concluding that', false], ["we can't necessarily conclude that", false],
            ["it's not necessarily the case that", false], ['nothing shows that', false], ['the jury is still out on whether', true],
            ['there are no grounds for believing that', false], ['we lack evidence that', false], ['it is by no means clear that', false]
        ];
        function expectCase() {
            const A = G.part();
            let B = G.part(); while (B.text === A.text) B = G.part();
            const [words, whether] = pick(WEAK);
            const cap = G.cap;
            const nA = G.denial(A);
            const r = rand();
            if (r < 0.25) return { label: 'weak: ' + words, kind: 'weak-objection', premises: [cap(words + ' ' + A.text)], parent: cap(A.text), certify: true };
            if (r < 0.35) return { label: 'weak (denial side): ' + words, kind: 'weak-objection', premises: [cap(words + ' ' + A.text)], parent: cap(nA.text), certify: whether, soft: true };
            if (r < 0.45) return { label: 'weak, other claim: ' + words, kind: 'weak-objection', premises: [cap(words + ' ' + A.text)], parent: cap(B.text), certify: false, soft: true };
            if (r < 0.55) return { label: 'weak as objection: ' + words, kind: 'objection', premises: [cap(words + ' ' + A.text)], parent: cap(A.text), certify: false };
            if (r < 0.62) return { label: 'weak as support: ' + words, kind: 'support', premises: [cap(words + ' ' + A.text)], parent: cap(nA.text), certify: false };
            if (r < 0.7) return { label: 'weak by modus ponens: ' + words, kind: 'weak-objection', premises: [cap('if ' + B.text + ', then ' + words + ' ' + A.text), cap(B.text)], parent: cap(A.text), certify: true };
            if (r < 0.75) {
                const [w2] = pick(WEAK.filter(w => w[0] !== words));
                return { label: 'two wordings: ' + words + ' / ' + w2, kind: 'support', premises: [cap(words + ' ' + A.text)], parent: cap(w2 + ' ' + A.text), certify: false };
            }
            // claims about one argument
            if (r < 0.9) {
                const [C] = [G.part()];
                if (C.text !== A.text && C.text !== B.text) {
                    const q = c => "'" + cap(c.text) + "'";
                    const rel = cap("we can't conclude that " + A.text + ' from ' + q(B) + ' and ' + q(C));
                    const k2 = rand();
                    if (k2 < 0.25) return { label: 'about one argument: a premise not established', kind: 'support', premises: [cap('it has not been shown that ' + C.text)], parent: rel, certify: true };
                    if (k2 < 0.4) return { label: 'about one argument: a premise denied', kind: 'support', premises: [cap(G.denial(B).text)], parent: rel, certify: true, soft: true };
                    if (k2 < 0.55) return { label: 'about one argument: the conclusion not established', kind: 'support', premises: [cap('it has not been shown that ' + A.text)], parent: rel, certify: true };
                    if (k2 < 0.7) return { label: 'about one argument: not a challenge to the conclusion', kind: 'weak-objection', premises: [rel], parent: cap(A.text), certify: false };
                    if (k2 < 0.85) return { label: 'about one argument: not the outright claim', kind: 'support', premises: [rel], parent: cap('it has not been shown that ' + A.text), certify: false };
                    return { label: 'about one argument: unsound from a denied premise', kind: 'support', premises: [cap(G.denial(C).text)],
                        parent: cap('the argument from ' + q(B) + ' and ' + q(C) + ' to ' + q(A) + ' is unsound'), certify: true, soft: true };
                }
            }
            // counterfactuals
            const CF = [
                ['it had rained', 'it had not rained', 'the match would have been cancelled', 'the match would not have been cancelled'],
                ['Poe had been a raven', 'Poe had not been a raven', 'Poe would have been black', 'Poe would not have been black'],
                ['the vase had been dropped', 'the vase had not been dropped', 'the vase would have broken', 'the vase would not have broken']
            ];
            const [c, nc, q, nq] = pick(CF);
            const [c2, , q2, nq2] = pick(CF.filter(x => x[0] !== c));
            const k = rand();
            if (k < 0.2) return { label: 'counterfactual modus ponens', kind: 'support', premises: [cap('if ' + c + ', then ' + q), cap(c)], parent: cap(q), certify: true };
            if (k < 0.4) return { label: 'counterfactual modus tollens', kind: 'support', premises: [cap('if ' + c + ', then ' + q), cap(nq)], parent: cap(nc), certify: true };
            if (k < 0.55) return { label: 'counterfactual transposition', kind: 'support', premises: [cap('if ' + c + ', then ' + q)], parent: cap('if ' + nq + ', then ' + nc), certify: false };
            if (k < 0.7) return { label: 'counterfactual material implication', kind: 'support', premises: [cap('either ' + nc + ' or ' + q)], parent: cap('if ' + c + ', then ' + q), certify: false };
            if (k < 0.85) return { label: 'counterfactual exportation', kind: 'support', premises: [cap('if ' + c + ' and ' + c2 + ', then ' + q)], parent: cap('if ' + c + ', then if ' + c2 + ', then ' + q), certify: false };
            return { label: 'counterfactual hypothetical syllogism', kind: 'support', premises: [cap('if ' + c + ', then ' + q), cap('if ' + q + ', then ' + q2)], parent: cap('if ' + c + ', then ' + q2), certify: false };
        }
        return { oracleCase, expectCase };
    };

    return module.exports;
})();

/* ================= hard cases ================= */
// [expect, kind, premises, parent, label]; expect: 'yes', 'no', 'amb' (not
// certified, flagged ambiguous), or the rule's name. kind: S support, O
// objection, W weak objection.
const HARD_CASES = [
    // ---- "any", "some" and polarity ----
    ['no', 'S', ['If Poe can not beat a player, then Poe is weak', 'Poe is not weak'], 'Poe can beat any player', 'free-choice "any" is not the "a" a denial takes'],
    ['modus tollens', 'S', ['If Poe can beat any player, then Poe is a champion', 'Poe is not a champion'], 'Poe can not beat a player', '"any" in a condition is "a"'],
    ['modus tollens', 'S', ['If Poe can beat a player, then Poe is a champion', 'Poe is not a champion'], 'Poe cannot beat a player', 'MT with "a player"'],
    ['no', 'O', ['Poe does not like some raven'], 'Poe likes some raven', '"not ... some" does not deny "some"'],
    ['yes', 'O', ['Poe does not own any car'], 'Poe owns a car', '"not ... any" denies "a"'],
    ['yes', 'O', ['Poe owns no car'], 'Poe owns a car', '"no" before an object denies "a"'],
    ['no', 'S', ['If Poe gives no reason to anyone, then Poe is cruel', 'Poe is not cruel'], 'Poe gives a reason to anyone', 'free-choice "anyone"'],
    ['no', 'S', ['Not everyone loves someone'], 'Some people do not love someone', '"not ... someone" is not the dual of "not everyone loves someone"'],
    ['yes', 'O', ['Poe knows nothing'], 'Poe knows something', '"knows nothing" denies "knows something"'],
    ['yes', 'O', ['Poe does not know anything'], 'Poe knows something', '"does not know anything" denies "knows something"'],
    ['yes', 'O', ['Nobody loves anyone'], 'Somebody loves someone', '"nobody ... anyone"'],
    ['universal modus ponens', 'S', ['Everything that has any value is scarce', 'Gold has value'], 'Gold is scarce', '"any" in a universal\'s restrictor'],

    // ---- "and" and "or" inside a verb phrase ----
    ['no', 'S', ['Poe is between Fido and Rex'], 'Poe is Rex', '"between X and Y" is one relation'],
    ['no', 'S', ['The mixture is a blend of sand and water'], 'The mixture is water', '"a blend of X and Y"'],
    ['no', 'S', ['Poe is taller than Fido and Rex'], 'Poe is Rex', '"taller than X and Y"'],
    ['conjunction elimination', 'S', ['Poe is black and small'], 'Poe is small', 'adjectives joined'],
    ['conjunction elimination', 'S', ['Poe is a raven and black'], 'Poe is black', 'noun and adjective joined'],
    ['no', 'S', ['Poe must fly or swim', 'It is not the case that Poe must fly'], 'Poe must swim', '"must" does not spread over "or"'],
    ['disjunctive syllogism', 'S', ['Poe must fly or Poe must swim', 'It is not the case that Poe must fly'], 'Poe must swim', '"must" written twice'],
    ['amb', 'S', ['Poe can fly', 'Poe can swim'], 'Poe can fly and swim', '"can" over "and": each, or both together'],
    ['conjunction elimination', 'S', ['Poe must fly and swim'], 'Poe must fly', '"must" spreads over "and"'],
    ['disjunctive syllogism', 'S', ['Poe can fly or swim', 'Poe cannot fly'], 'Poe can swim', '"can" spreads over "or"'],

    // ---- subjects joined ----
    ['no', 'S', ['If Poe and Fido are ravens, then the flock is complete', 'The flock is not complete'], 'Poe and Fido are not ravens', '"Poe and Fido are not ravens" does not deny "Poe and Fido are ravens"'],
    ['no', 'O', ['Poe or Fido is not a raven'], 'Poe or Fido is a raven', '"X or Y is not" does not deny "X or Y is"'],
    ['no', 'S', ['All ravens are black', 'Neither Poe nor Fido is a raven'], 'Neither Poe nor Fido is black', '"neither Poe nor Fido" is no individual'],
    ['conjunction elimination', 'S', ['Neither Poe nor Fido is a raven'], 'Poe is not a raven', '"neither X nor Y is"'],
    ['disjunctive syllogism', 'S', ['Either Poe or Fido is a raven', 'Poe is not a raven'], 'Fido is a raven', '"either X or Y is"'],
    ['conjunction elimination', 'S', ['Both Poe and Fido are ravens'], 'Fido is a raven', '"both X and Y are"'],
    ['amb', 'S', ['Poe and Fido are ravens'], 'Poe is a raven', '"X and Y are": each, or together'],
    ['conjunction elimination', 'S', ['All ravens and crows are black'], 'All crows are black', 'nouns joined under "all"'],
    ['no', 'S', ['Some ravens and crows are black'], 'Crows are black', 'nouns joined under "some"'],
    ['conjunction elimination', 'S', ['No raven or crow is white'], 'No crow is white', 'nouns joined under "no"'],

    // ---- indefinites, generics, numbers ----
    ['direct denial', 'O', ['A raven is not black'], 'A raven is black', 'an indefinite and its denial, read as a generic\'s are'],
    ['no', 'O', ['One raven is not black'], 'One raven is black', '"one raven"'],
    ['no', 'S', ['Ravens are black', 'Poe is a raven'], 'Poe is black', 'a generic has exceptions'],
    ['no', 'S', ['A raven is black', 'Poe is a raven'], 'Poe is black', 'an indefinite'],
    ['direct denial', 'O', ['Ravens are not black'], 'Ravens are black', 'a generic and its denial (as textbooks read them)'],
    ['no', 'S', ['Exactly one raven is black'], 'Some raven is black', '"exactly one" is not read'],
    ['no', 'S', ['Two ravens are black', 'All ravens are birds'], 'Two birds are black', 'numbers are not read'],
    ['no', 'S', ['Only one raven is black', 'Poe is black'], 'Poe is a one raven', '"only one" is not "only"'],

    // ---- pronouns bound by "something" ----
    ['no', 'S', ['If something is a raven, then it is black', 'It is not black'], 'Nothing is a raven', '"it" is bound by "something"'],
    ['universal modus ponens', 'S', ['If something is a raven, then it is black', 'Poe is a raven'], 'Poe is black', '"if something is F, it is G" is "everything F is G"'],
    ['no', 'S', ['If someone is wise, then he is happy', 'Poe is wise'], 'Poe is happy', '"someone": Poe must also be a person'],

    ['no', 'S', ['If something is a stove, then it is hot', 'It is not hot'], 'Nothing is a stove', 'an "it" that may point back or stand for nothing'],
    ['no', 'S', ['If something is a stove, then it is hot', 'Poe is a stove'], 'Poe is hot', 'an "it" that may stand for nothing is not bound'],
    ['modus ponens', 'S', ['If something is white, then it rains', 'Something is white'], 'It rains', 'the "it" of weather'],
    ['modus tollens', 'S', ['If something is white, then it rains', 'It does not rain'], 'Nothing is white', 'the "it" of weather, by modus tollens'],

    // ---- counterfactuals ----
    ['no', 'S', ['If it had rained, then the match would have been cancelled'], 'If the match would not have been cancelled, then it had not rained', 'counterfactuals do not transpose'],
    ['modus ponens', 'S', ['If it had rained, then the match would have been cancelled', 'It had rained'], 'The match would have been cancelled', 'counterfactual modus ponens'],
    ['modus tollens', 'S', ['If it had rained, then the match would have been cancelled', 'The match would not have been cancelled'], 'It had not rained', 'counterfactual modus tollens'],
    ['no', 'S', ['If it had rained and it had been cold, then it would have snowed'], 'If it had rained, then if it had been cold, then it would have snowed', 'counterfactuals do not export'],
    ['no', 'S', ['If Poe were a raven, then Poe would be black', 'If Poe were black, then Poe would be happy'], 'If Poe were a raven, then Poe would be happy', 'counterfactuals do not chain (and the wording differs anyway)'],
    ['no', 'S', ['If it would rain, then it would snow', 'If it would snow, then it would be cold'], 'If it would rain, then it would be cold', 'counterfactual hypothetical syllogism'],

    // ---- conditions after their claims ----
    ['amb', 'S', ['It snows if it rains and it is cold'], 'It is cold', '"if" may take in "and"'],
    ['modus ponens', 'S', ['Not all crows are birds provided that Rex is white', 'Rex is white'], 'Not all crows are birds', '"not all" before a condition'],
    ['modus ponens', 'S', ['Rex is white or old only if some crows are old', 'Rex is white or old'], 'Some crows are old', 'verb phrases joined before "only if"'],
    ['modus ponens', 'S', ['Only if it is warm, Poe flies', 'Poe flies'], 'It is warm', '"only if" in front'],
    ['biconditional elimination', 'S', ['Poe flies if, and only if, it is warm', 'It is warm'], 'Poe flies', '"if, and only if,"'],
    ['amb', 'S', ['If it rains, then the ground is wet, and the match is off'], 'The match is off', '"and" after the comma'],
    ['modus ponens', 'S', ['If it rains, then the ground is wet and the match is off', 'It rains'], 'The ground is wet and the match is off', 'no comma: all consequent'],
    ['De Morgan’s laws', 'S', ['It is not the case that it rains or it snows'], 'It does not rain and it does not snow', '"it is not the case that" takes in the "or"'],
    ['conjunction elimination', 'S', ['Poe thinks and is wise'], 'Poe is wise', 'verb phrases joined after a plain verb'],
    ['no', 'O', ['Not surprisingly, Poe is black'], 'Surprisingly, Poe is black', '"not surprisingly" denies nothing'],
    ['no', 'S', ['Not necessarily, Poe is black'], 'Poe is not black', '"not necessarily" is not "not"'],

    ['no', 'S', ['If Poe is black, so is Fido', 'Poe is black'], 'So is Fido', 'a clause cut short is not read'],
    ['no', 'S', ['If the relation is asymmetric, then the relation is irreflexive', 'The relation is not irreflexive'], 'The relation is symmetric', '"asymmetric" is more than "not symmetric"'],
    ['no', 'S', ['Poe is black, and so is Fido'], 'Poe is black', 'a clause cut short leaves its sentence unread'],

    // ---- formulas ----
    ['no', 'S', ['∀x∀x∀y R(x,y)'], '∀z∀z∀z R(z,z)', 'bound variables are not confused'],
    ['modus ponens', 'S', ['∀x Fx → ∃x Gx', '∀x Fx'], '∃x Gx', 'a later quantifier over the same variable'],
    ['disjunctive syllogism', 'S', ['(P ∨ Q) ∨ R', '¬(P ∨ Q)'], 'R', 'a denial of two disjuncts at once'],
    ['disjunctive syllogism', 'S', ['It rains or it snows or the match is off', 'It is not the case that it rains or it snows'], 'The match is off', 'a denial of two disjuncts at once, in English'],
    ['tautology', 'S', ['Fb v Fb'], 'Fb', '"Fb v Fb"'],
    ['universal elimination', 'S', ['(x)Hx'], 'Ha', 'Copi "(x)Hx"'],
    ['universal elimination', 'S', ['∀xFx'], 'Fa', '"∀xFx" with no space'],

    // ---- weak objections: what has not been established ----
    ['direct challenge', 'W', ['We cannot conclude that God exists'], 'God exists', '"we cannot conclude that"'],
    ['direct challenge', 'W', ["We can't conclude that God exists"], 'God exists', '"we can\'t conclude that"'],
    ['direct challenge', 'W', ['It cannot be concluded that God exists'], 'God exists', '"it cannot be concluded that"'],
    ['direct challenge', 'W', ['It does not follow that God exists'], 'God exists', '"it does not follow that"'],
    ['direct challenge', 'W', ['There is no evidence that God exists'], 'God exists', '"there is no evidence that"'],
    ['direct challenge', 'W', ['We have no reason to believe that God exists'], 'God exists', '"we have no reason to believe that"'],
    ['direct challenge', 'W', ['It has yet to be shown that God exists'], 'God exists', '"it has yet to be shown that"'],
    ["direct challenge", 'W', ["It's not been shown that God exists"], 'God exists', '"it\'s not been shown"'],
    ['direct challenge', 'W', ['Nobody has shown that God exists'], 'God exists', '"nobody has shown that"'],
    ['direct challenge', 'W', ['This does not show that God exists'], 'God exists', '"this does not show that"'],
    ['direct challenge', 'W', ['The argument fails to establish that God exists'], 'God exists', '"the argument fails to establish that"'],
    ['direct challenge', 'W', ['It is not obvious that God exists'], 'God exists', '"it is not obvious that"'],
    ['direct challenge', 'W', ['It is doubtful that God exists'], 'God exists', '"it is doubtful that"'],
    ['direct challenge', 'W', ['It is unclear whether God exists'], 'God exists', '"it is unclear whether"'],
    ['direct challenge', 'W', ['It is unclear whether God exists'], 'God does not exist', '"whether": neither side is established'],
    ['direct challenge', 'W', ['It is an open question whether God exists'], 'God does not exist', '"an open question whether"'],
    ['direct challenge', 'W', ['It remains to be seen whether God exists'], 'God exists', '"it remains to be seen whether"'],
    ['direct challenge', 'W', ['For all we know, God does not exist'], 'God exists', '"for all we know, not P"'],
    ['direct challenge', 'W', ['That God exists has not been established'], 'God exists', '"that P has not been established"'],
    ['no', 'W', ['We cannot conclude that God exists'], 'God does not exist', '"that": only P is not established'],
    ['no', 'O', ['We cannot conclude that God exists'], 'God exists', 'an objection needs a denial'],
    ['no', 'S', ['It has not been shown that God exists'], 'God does not exist', 'ignorance is no disproof'],
    ['no', 'W', ["There is no evidence that some crows aren't wise"], 'Some crow is not wise', 'a claim in other words is not the box, even when not established'],
    ["direct challenge","W",["That God exists is not warranted"],"God exists","\"that P is not warranted\""],
    ["direct challenge","W",["We are not warranted in believing that God exists"],"God exists","\"we are not warranted in believing that\""],
    ["direct challenge","W",["It is not warranted to conclude that God exists"],"God exists","\"it is not warranted to conclude that\""],
    ["direct challenge","W",["There is insufficient warrant for believing that God exists"],"God exists","\"there is insufficient warrant for believing that\""],
    ["direct challenge","W",["We lack warrant for concluding that God exists"],"God exists","\"we lack warrant for concluding that\""],
    ["direct challenge","W",["There is not sufficient warrant for concluding that God exists"],"God exists","\"there is not sufficient warrant for\""],
    ["direct challenge","W",["Warrant for believing that God exists is lacking"],"God exists","\"warrant for believing that P is lacking\""],
    ["direct challenge","W",["The belief that God exists is not warranted"],"God exists","\"the belief that P is not warranted\""],
    ["direct challenge","W",["We can't necessarily conclude that God exists"],"God exists","\"we can't necessarily conclude that\""],
    ["direct challenge","W",["Nothing shows that God exists"],"God exists","\"nothing shows that\""],
    ["direct challenge","W",["The jury is still out on whether God exists"],"God does not exist","\"the jury is still out on whether\""],
    ["direct challenge","W",["Perhaps God does not exist"],"God exists","\"perhaps not P\""],
    ["direct challenge","W",["It's not necessarily the case that God exists"],"God exists","\"it's not necessarily the case that\""],
    ["direct challenge","W",["Poe is not necessarily guilty"],"Poe is guilty","\"X is not necessarily Y\""],
    ["direct challenge","W",["Poe doesn't necessarily fly"],"Poe flies","\"X does not necessarily Y\""],
    ["direct challenge","W",["That God exists isn't necessary"],"God exists","\"that P isn't necessary\""],
    ["amb","O",["God does not necessarily exist"],"God necessarily exists","\"not necessarily\": the modal sense is flagged"],
    ["amb","O",["Poe is not necessarily black"],"Poe is necessarily black","\"is not necessarily\": the modal sense is flagged"],
    ["no","O",["Poe is not necessarily guilty"],"Poe is guilty","\"not necessarily\" denies nothing"],
    ["no","W",["We can't conclude that God exists from 'Everything has a cause' and 'There is no infinite regress'"],"God exists","a claim about one argument does not challenge its conclusion outright"],
    ["a premise not established","S",["It has not been shown that there is no infinite regress"],"We can't conclude that God exists from 'Everything has a cause' and 'There is no infinite regress'","a premise not established"],
    ["a premise not established","S",["There is an infinite regress"],"We can't conclude that God exists from 'Everything has a cause' and 'There is no infinite regress'","a premise denied"],
    ["conclusion not established","S",["It has not been shown that God exists"],"We can't conclude that God exists from 'Everything has a cause' and 'There is no infinite regress'","the conclusion not established"],
    ["a false premise","S",["There is an infinite regress"],"The argument from 'Everything has a cause' and 'There is no infinite regress' to 'God exists' is unsound","a false premise makes it unsound"],
    ["no","S",["It has not been shown that there is no infinite regress"],"The argument from 'Everything has a cause' and 'There is no infinite regress' to 'God exists' is unsound","a premise not shown does not make it unsound"],
    ["an unsound argument","S",["The argument from 'Everything has a cause' and 'There is no infinite regress' to 'God exists' is unsound"],"We can't conclude that God exists from 'Everything has a cause' and 'There is no infinite regress'","unsound: not established"],
    ["an unsound argument","S",["The argument from 'Everything has a cause' and 'There is no infinite regress' to 'God exists' is invalid"],"The argument from 'Everything has a cause' and 'There is no infinite regress' to 'God exists' is unsound","invalid: unsound"],
    ["no","S",["We can't conclude that God exists from 'Everything has a cause' and 'There is no infinite regress'"],"It has not been shown that God exists","not established from one argument is not not established"],
    ["no","S",["We can't conclude that God exists from 'Everything has a cause'"],"We can't conclude that God exists from 'Everything has a cause' and 'There is no infinite regress'","from fewer premises, not from more"],
    ["no","S",["It has not been shown that everything is caused"],"We can't conclude that God exists from 'Everything has a cause' and 'There is no infinite regress'","the premise must be spelled as named"],
    ["no","S",["It has not been shown that there is no infinite regress"],"It does not follow from 'Everything has a cause' and 'There is no infinite regress' that God exists","an unsupported premise does not prove invalidity, in premise-first wording either"],
    ["a premise not established","S",["It has not been shown that there is no infinite regress"],"It cannot be concluded from 'Everything has a cause' and 'There is no infinite regress' that God exists","premise-first warrant wording remains supported"],
    ["a premise not established","S",["It has not been shown that there is no infinite regress"],"We cannot conclude from the premises that everything has a cause and that there is no infinite regress that God exists","\"from the premises that P1 and that P2\""],
    ["a premise not established","S",["It has not been shown that there is no infinite regress"],"'Everything has a cause' and 'There is no infinite regress' do not show that God exists","\"P1 and P2 do not show that P\""],
    ["no","S",["It has not been shown that there is no infinite regress"],"God exists does not follow from 'Everything has a cause' and 'There is no infinite regress'","\"does not follow from\" says invalid"],
    ["direct challenge","W",["We can't conclude that consciousness arises from the brain"],"Consciousness arises from the brain","a claim with \"from\" in it is not a claim about an argument"],
    ["no","O",["It is not the case that we can't conclude that God exists from 'Everything has a cause' and 'There is no infinite regress'"],"We can't conclude that God exists","denying a claim about one argument is no denial of the outright claim"],
    ["no","S",["If the universe is caused, then we can't conclude that God exists","It is not the case that we can't conclude that God exists from 'Everything has a cause' and 'There is no infinite regress'"],"The universe is not caused","modus tollens: a claim about one argument is not the outright claim it resembles"],
    ['modus ponens', 'W', ['If the evidence is circumstantial, then we cannot conclude that Poe is guilty', 'The evidence is circumstantial'], 'Poe is guilty', 'derived by modus ponens'],
    ['no', 'W', ['It has not been shown that it is not the case that it does not rain'], 'It rains', 'no rewriting inside "not shown"'],
    ['no', 'S', ['It has not been shown that God exists'], 'We cannot conclude that God exists', 'two ways of saying "not established" are different claims']
];

/* ================= the map's verdict ================= */
const VC = { C: 'God exists' };
const V_S = () => ({ id: 'S', type: 'support', texts: ['If the universe is caused, then God exists', 'The universe is caused'], collapsed: [], children: [] });
const V_O = () => ({ id: 'O', type: 'objection', texts: ['If evil exists, then God does not exist', 'Evil exists'], collapsed: [], children: [] });
const V_W = (id, text) => ({ id, type: 'weak-objection', texts: [text], collapsed: [], children: [] });
const V_R = (id, text) => ({ id, type: 'objection', texts: [text], collapsed: [], children: [] });
const V_at = (child, idx) => Object.assign(child, { targetIndex: idx });
const V_tree = (id, texts, children, type) => ({ id, type: type || 'contention', texts, collapsed: [], x: 30000, y: 30000, children });
const V_REL = "We can't conclude that God exists from 'If the universe is caused, then God exists' and 'The universe is caused'";
const V_UNSOUND = "The argument from 'If the universe is caused, then God exists' and 'The universe is caused' to 'God exists' is unsound";
// [label, trees, expected verdict of the first tree's box, a phrase its explanation has]
const VERDICT_CASES = [
    ['a valid support', [V_tree('M', [VC.C], [V_S()])], 'established', 'give it by modus ponens'],
    ['a valid support and an open, valid objection', [V_tree('M', [VC.C], [V_S(), V_O()])], 'unresolved', 'give its denial by modus ponens'],
    ['an open, valid objection alone', [V_tree('M', [VC.C], [V_O()])], 'refuted', 'No valid support stands'],
    ['the objection rebutted, with a support', [V_tree('M', [VC.C], [V_S(), Object.assign(V_O(), { children: [V_at(V_R('R', 'Evil does not exist'), 1)] })])], 'established', 'Nothing open and valid stands against it'],
    ['the objection weakly rebutted, with no support', [V_tree('M', [VC.C], [Object.assign(V_O(), { children: [V_at(V_W('WR', 'It has not been shown that evil exists'), 1)] })])], 'unresolved', 'has an open, valid weak rebuttal'],
    ['the objection weakly rebutted, with a support', [V_tree('M', [VC.C], [V_S(), Object.assign(V_O(), { children: [V_at(V_W('WR', 'It has not been shown that evil exists'), 1)] })])], 'unresolved', 'challenge remains unsettled'],
    ['a support and an open, valid weak objection', [V_tree('M', [VC.C], [V_S(), V_W('W', 'It has not been shown that God exists')])], 'unresolved', 'says it has not been established'],
    ['a support whose premise is weakly objected to', [V_tree('M', [VC.C], [Object.assign(V_S(), { children: [V_at(V_W('W', 'It has not been shown that the universe is caused'), 1)] })])], 'unestablished', 'we can’t conclude that ‘God exists’ from'],
    ['a support whose premise is refuted', [V_tree('M', [VC.C], [Object.assign(V_S(), { children: [V_at(V_R('R', 'The universe is not caused'), 1)] })])], 'unestablished', 'is refuted by an open, valid objection'],
    ['a support whose step is not certified', [V_tree('M', [VC.C], [{ id: 'S', type: 'support', texts: ['The universe is caused'], collapsed: [], children: [] }])], 'unestablished', 'is not certified'],
    ['an objection and a weak objection', [V_tree('M', [VC.C], [V_O(), V_W('W', 'It has not been shown that God exists')])], 'refuted', 'its denial follows'],
    ['a premise objected to, and that objection rebutted', [V_tree('M', [VC.C], [Object.assign(V_S(), { children: [V_at({ id: 'PO', type: 'objection', texts: ['If the universe is eternal, then the universe is not caused', 'The universe is eternal'], collapsed: [], children: [V_at(V_R('PR', 'The universe is not eternal'), 1)] }, 1)] })])], 'established', 'give it by modus ponens'],
    ['a claim about one argument, which the map undercuts', [V_tree('M', [V_REL], []), V_tree('T', [VC.C], [Object.assign(V_S(), { children: [V_at(V_W('W', 'It has not been shown that the universe is caused'), 1)] })], 'support')], 'established', 'is undercut'],
    ['a claim about one argument, which the map does not undercut', [V_tree('M', [V_REL], []), V_tree('T', [VC.C], [V_S()], 'support')], 'unestablished', 'that anything open and valid undercuts'],
    ['a claim about one argument, argued for below it', [V_tree('M', [V_REL], [{ id: 'A', type: 'support', texts: ['It has not been shown that the universe is caused'], collapsed: [], children: [] }])], 'established', 'by a premise not established'],
    ['an unsound argument, a premise refuted on the map', [V_tree('M', [V_UNSOUND], []), V_tree('T', [VC.C], [Object.assign(V_S(), { children: [V_at(V_R('R', 'The universe is not caused'), 1)] })], 'support')], 'established', 'is refuted'],
    ['an unsound argument, a premise only weakly objected to', [V_tree('M', [V_UNSOUND], []), V_tree('T', [VC.C], [Object.assign(V_S(), { children: [V_at(V_W('W', 'It has not been shown that the universe is caused'), 1)] })], 'support')], 'unestablished', ''],
    ['a claim about an objection, weakly rebutted on the map', [V_tree('M', ["We can't conclude that God does not exist from 'If evil exists, then God does not exist' and 'Evil exists'"], []), V_tree('T', [VC.C], [Object.assign(V_O(), { children: [V_at(V_W('WR', 'It has not been shown that evil exists'), 1)] })], 'support')], 'established', 'has an open, valid weak rebuttal'],
    ['no arguments at all', [V_tree('M', [VC.C], [])], 'asserted', '']
];

/* ================= the app ================= */
function makeWin() {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
    function stubs(win) {
        const { webcrypto } = require('crypto');
        if (!win.crypto || !win.crypto.randomUUID) Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
        win.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
        win.ResizeObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
        const ctx = new Proxy({}, { get: (_t, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        win.HTMLCanvasElement.prototype.getContext = () => ctx;
        win.indexedDB = { open() { const r = {}; setTimeout(() => r.onerror && r.onerror({ target: { error: new Error('idb off') } }), 0); return r; } };
        win.requestAnimationFrame = cb => win.setTimeout(() => cb(Date.now()), 0);
        win.cancelAnimationFrame = win.clearTimeout;
        win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true; win.prompt = () => null; win.open = () => null;
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://localhost/stress.html', beforeParse: stubs });
    return { dom, errors };
}
const PAGE = `
window.__stress = (function () {
    function annotate(f) {
        if (!f || typeof f !== 'object') return f;
        if (f.kind === 'unestablished') f._key = claimKey(f);
        if (f.inner) annotate(f.inner);
        if (f.cons) annotate(f.cons);
        (f.parts || []).forEach(annotate);
        (f.conds || []).forEach(annotate);
        return f;
    }
    var n = 0;
    return {
        read: function (text) { var r = parseClaimFull(text); return { form: r.form ? annotate(JSON.parse(JSON.stringify(r.form))) : null, key: r.form ? claimKey(r.form) : null, notes: r.notes }; },
        step: function (premises, parent, kind) {
            n++;
            var trees = [{ id: 'M' + n, type: 'contention', texts: [parent], collapsed: [], children: [{ id: 'S' + n, type: kind, texts: premises.slice(), collapsed: [], children: [] }] }];
            var s = collectDeductiveSteps(trees)[0];
            return { rule: s.rule ? s.rule.name : null, ambiguous: s.ambiguous, why: s.why ? s.why.text : null };
        },
        derive: function (texts) { var d = deriveConclusion(texts); return d ? { rule: d.rule.name, text: d.text } : null; },
        verdict: function (trees) {
            var steps = collectDeductiveSteps(trees), v = claimMapVerdict(trees, steps), x = v(trees[0].id, 0);
            return { status: x.status, why: claimVerdictWhy(v, x) };
        }
    };
})();
`;

(async () => {
    const W = makeWin();
    await new Promise(r => setTimeout(r, 400));
    W.dom.window.eval(PAGE);
    const call = (name, args) => JSON.parse(W.dom.window.eval('JSON.stringify(window.__stress.' + name + '.apply(null, ' + J(args) + '))'));
    const app = { read: t => call('read', [t]), step: (p, c, k) => call('step', [p, c, k || 'support']), derive: t => call('derive', [t]), verdict: trees => call('verdict', [trees]) };
    const sample = (list, n) => list.slice(0, n || 3).join(' ‖ ');

    /* ---------------- 1. hard cases ---------------- */
    console.log('\n-- hard cases --');
    {
        const kinds = { S: 'support', O: 'objection', W: 'weak-objection' };
        const groups = new Map();
        HARD_CASES.forEach(([expect, kind, premises, parent, label], i) => {
            const s = app.step(premises, parent, kinds[kind]);
            const good = expect === 'yes' ? !!s.rule : expect === 'no' ? !s.rule : expect === 'amb' ? !s.rule && s.ambiguous : s.rule === expect;
            // the sections of the list, by the comment lines they sit under
            const g = groups.get(kind) || { n: 0, bad: [] };
            g.n++;
            if (!good) g.bad.push(label + ': want ' + expect + ', got ' + (s.rule || 'nothing') + (s.ambiguous ? ' (ambiguous)' : ''));
            groups.set(kind, g);
        });
        const S = groups.get('S') || { n: 0, bad: [] }, Ob = groups.get('O') || { n: 0, bad: [] }, Wk = groups.get('W') || { n: 0, bad: [] };
        ok(S.bad.length === 0, 'supports: ' + S.n + ' hard cases certify, stay uncertified, or are flagged as they should', sample(S.bad));
        ok(Ob.bad.length === 0, 'objections: ' + Ob.n + ' hard cases deny or do not deny as they should', sample(Ob.bad));
        ok(Wk.bad.length === 0, 'weak objections: ' + Wk.n + ' ways of saying a claim has not been established', sample(Wk.bad));
    }

    /* ---------------- 2. formulas at random ---------------- */
    console.log('\n-- formulas at random --');
    {
        const rand = seeded(20260917);
        const G = symbolicGenerator(rand);
        const chance = p => rand() < p;
        const stats = { read: 0, misread: [], steps: 0, certified: 0, unsound: [], instances: 0, incomplete: [] };
        const readCache = new Map();
        const readText = t => { if (!readCache.has(t)) readCache.set(t, app.read(t)); return readCache.get(t); };
        const checkReading = (f, text) => {
            stats.read++;
            const r = readText(text);
            if (!r.form) { stats.misread.push(text + ' (not read)'); return; }
            const got = O.fromApp(r.form), vg = O.vocabulary([got]), vw = O.vocabulary([f]);
            if (vg.letters.some(l => vw.letters.indexOf(l) < 0) || vg.preds.some(p => vw.preds.indexOf(p) < 0)) return;     // left whole
            if (!O.equivalent(got, f).valid) stats.misread.push(text + ' read as ' + O.show(got));
        };
        const tryStep = (premises, conclusion, label, kind) => {
            const sp = G.spellings();
            const texts = premises.map(p => G.print(p, chance(0.7) ? sp : G.spellings(), true));
            const ctext = G.print(conclusion, chance(0.7) ? sp : G.spellings(), true);
            premises.forEach((p, i) => checkReading(p, texts[i]));
            checkReading(conclusion, ctext);
            stats.steps++;
            const s = app.step(texts, ctext, kind);
            const valid = O.entails(premises, kind === 'support' ? conclusion : O.Not(conclusion)).valid;
            if (s.rule) { stats.certified++; if (!valid) stats.unsound.push('[' + label + '] ' + texts.join(' | ') + ' => ' + ctext + ' by ' + s.rule); }
            return { s, valid, texts, ctext };
        };
        for (let i = 0; i < 400; i++) {
            const [label, premises, conclusion] = G.instance();
            stats.instances++;
            const res = tryStep(premises, conclusion, label, 'support');
            if (!res.s.rule && res.valid) stats.incomplete.push('[' + label + '] ' + res.texts.join(' | ') + ' => ' + res.ctext);
            if (chance(0.3)) tryStep(premises, G.neg(conclusion), label + ' (objection)', 'objection');
            const [flabel, fp, fc] = G.fallacy();
            tryStep(fp, fc, 'fallacy: ' + flabel, 'support');
            for (let k = 0; k < 2; k++) {
                const which = Math.floor(rand() * (premises.length + 1));
                const P2 = premises.slice(), C2 = which === premises.length ? G.mutate(conclusion) : conclusion;
                if (which < premises.length) P2[which] = G.mutate(premises[which]);
                tryStep(P2, C2, label + ' (mutant)', chance(0.85) ? 'support' : 'objection');
            }
        }
        ok(stats.misread.length === 0, stats.read + ' formulas each read as what they say (or are left whole)', sample(stats.misread));
        ok(stats.unsound.length === 0, stats.steps + ' steps -- rule instances, their mutants, fallacies, objections -- and none certified that does not follow (' + stats.certified + ' certified)', sample(stats.unsound));
        ok(stats.incomplete.length === 0, stats.instances + ' instances of the rules, in every spelling, all certified', sample(stats.incomplete));
    }

    /* ---------------- 3. English at random ---------------- */
    console.log('\n-- English at random --');
    {
        const rand = seeded(9172026);
        const chance = p => rand() < p;
        const G = makeEnglish(rand), M = moreEnglish(G, rand);
        const clauseConsts = new Set();
        G.CLAUSES.forEach(c => O.vocabulary([O.fromApp(app.read(G.cap(c.pos)).form)]).consts.forEach(k => clauseConsts.add(k)));
        const lettered = f => {
            if (f.op === 'pred' && clauseConsts.has(f.arg)) return O.L('L[' + f.name + '@' + f.arg + ']');
            if (f.op === 'not') return O.Not(lettered(f.a));
            if (f.a && f.b) return { op: f.op, a: lettered(f.a), b: lettered(f.b) };
            if (f.body) return { op: f.op, v: f.v, body: lettered(f.body) };
            return f;
        };
        const reading = form => lettered(O.fromApp(form));
        G.CLAUSES.forEach(c => G.clauseFormula.set(c.pos, reading(app.read(G.cap(c.pos)).form)));
        const stats = { read: 0, misread: [], foreign: [], steps: 0, certified: 0, unsound: [], instances: 0, incomplete: [], expected: 0, wrong: [] };
        const cache = new Map();
        const checkReading = (c, text) => {
            if (c.opaque) return;
            stats.read++;
            if (!cache.has(text)) cache.set(text, app.read(text));
            const r = cache.get(text);
            if (!r.form) { stats.misread.push(text + ' (not read)'); return; }
            const got = reading(r.form), vg = O.vocabulary([got]), vw = O.vocabulary([c.f]);
            const extra = vg.letters.filter(l => vw.letters.indexOf(l) < 0).concat(vg.preds.filter(p => vw.preds.indexOf(p) < 0), vg.consts.filter(p => vw.consts.indexOf(p) < 0));
            if (extra.length) { stats.foreign.push(text + ' read as ' + O.show(got)); return; }
            if (!O.equivalent(got, c.f).valid) stats.misread.push(text + ' read as ' + O.show(got));
        };
        const tryStep = (premises, conclusion, label, kind) => {
            const texts = premises.map(G.sentence), ctext = G.sentence(conclusion);
            premises.forEach((p, i) => checkReading(p, texts[i]));
            checkReading(conclusion, ctext);
            stats.steps++;
            const s = app.step(texts, ctext, kind);
            const valid = O.entails(premises.map(p => p.f), kind === 'support' ? conclusion.f : O.Not(conclusion.f)).valid;
            if (s.rule) { stats.certified++; if (!valid) stats.unsound.push('[' + label + '] ' + texts.join(' | ') + ' => ' + ctext + ' by ' + s.rule); }
            return { s, valid, texts, ctext };
        };
        for (let i = 0; i < 300; i++) {
            G.beginStep();
            const [label, premises, conclusion] = G.instance();
            stats.instances++;
            const res = tryStep(premises, conclusion, label, 'support');
            if (!res.s.rule && res.valid) stats.incomplete.push('[' + label + '] ' + res.texts.join(' | ') + ' => ' + res.ctext);
            if (chance(0.3)) tryStep(premises, G.denial(conclusion), label + ' (objection)', 'objection');
            const [flabel, fp, fc] = G.fallacy();
            tryStep(fp, fc, 'fallacy: ' + flabel, 'support');
            const which = Math.floor(rand() * (premises.length + 1));
            const P2 = premises.slice(); let C2 = conclusion;
            if (which === premises.length) C2 = G.mutateClaim(conclusion); else P2[which] = G.mutateClaim(premises[which]);
            tryStep(P2, C2, label + ' (mutant)', chance(0.8) ? 'support' : 'objection');
            G.beginStep();
            const [mlabel, mp, mc] = M.oracleCase();
            const mres = tryStep(mp, mc, mlabel, 'support');
            if (!mres.s.rule && mres.valid && !/^fallacy/.test(mlabel)) stats.incomplete.push('[' + mlabel + '] ' + mres.texts.join(' | ') + ' => ' + mres.ctext);
            const e = M.expectCase();
            if (!e.soft) {
                stats.expected++;
                const t = app.step(e.premises, e.parent, e.kind);
                if (!!t.rule !== e.certify) stats.wrong.push(e.label + ': ' + e.premises.join(' | ') + ' => ' + e.parent + ', got ' + (t.rule || 'nothing'));
            }
        }
        ok(stats.misread.length === 0 && stats.foreign.length === 0, stats.read + ' sentences each read as what they mean (or are left whole, flagged)', sample(stats.misread.concat(stats.foreign)));
        ok(stats.unsound.length === 0, stats.steps + ' steps -- rule instances, their mutants, fallacies, objections -- and none certified that does not follow (' + stats.certified + ' certified)', sample(stats.unsound));
        ok(stats.incomplete.length === 0, stats.instances + ' instances of the rules in English, and the newer constructions, all certified', sample(stats.incomplete));
        ok(stats.wrong.length === 0, stats.expected + ' weak objections and counterfactual steps come out as they should', sample(stats.wrong));
    }

    /* ---------------- 4. Derive Parent ---------------- */
    console.log('\n-- Derive Parent --');
    {
        const rand = seeded(1729);
        const G = makeEnglish(rand), M = moreEnglish(G, rand);
        const clauseConsts = new Set();
        G.CLAUSES.forEach(c => O.vocabulary([O.fromApp(app.read(G.cap(c.pos)).form)]).consts.forEach(k => clauseConsts.add(k)));
        const lettered = f => {
            if (f.op === 'pred' && clauseConsts.has(f.arg)) return O.L('L[' + f.name + '@' + f.arg + ']');
            if (f.op === 'not') return O.Not(lettered(f.a));
            if (f.a && f.b) return { op: f.op, a: lettered(f.a), b: lettered(f.b) };
            if (f.body) return { op: f.op, v: f.v, body: lettered(f.body) };
            return f;
        };
        G.CLAUSES.forEach(c => G.clauseFormula.set(c.pos, lettered(O.fromApp(app.read(G.cap(c.pos)).form))));
        let groups = 0, derived = 0;
        const bad = [];
        for (let i = 0; i < 300; i++) {
            G.beginStep();
            const [, premises] = i % 3 === 2 ? M.oracleCase() : G.instance();
            if (premises.some(p => p.opaque)) continue;
            groups++;
            const texts = premises.map(G.sentence);
            const d = app.derive(texts);
            if (!d) continue;
            derived++;
            const r = app.read(d.text);
            if (!r.form || !O.entails(premises.map(p => p.f), lettered(O.fromApp(r.form))).valid) bad.push(texts.join(' | ') + ' => ' + d.text + ' (' + d.rule + ')');
        }
        ok(derived > 50 && bad.length === 0, 'of ' + groups + ' premise groups, Derive Parent found ' + derived + ' conclusions, each one following from its premises', sample(bad));
    }

    /* ---------------- 5. the map's verdict ---------------- */
    console.log('\n-- the main contention’s verdict --');
    {
        const wrong = [];
        VERDICT_CASES.forEach(([label, trees, status, phrase]) => {
            const v = app.verdict(trees);
            if (v.status !== status || (phrase && v.why.indexOf(phrase) < 0)) wrong.push(label + ': ' + v.status + ' — ' + v.why);
        });
        ok(wrong.length === 0, VERDICT_CASES.length + ' maps: supports, objections, rebuttals and weak ones, nested, and claims about one argument, each with its verdict and why', sample(wrong, 4));
    }

    /* ---------------- 6. Help ---------------- */
    console.log('\n-- Help --');
    {
        const h = W.dom.window.document.getElementById('help-panel');
        const text = h.textContent;
        ok(text.includes('check one inference at a time') && text.includes('does not certify their truth'),
            'compact Help distinguishes inference validity from premise truth');
        ok(text.includes('Not recognized') && text.includes('cannot certify the step'),
            'Help explains an unrecognized step without declaring it invalid');
        ok(text.includes('without establishing its opposite') && text.includes('✓ Warranted') && text.includes('✗ Unwarranted'),
            'Help explains weak challenges and both warrant assessments');
        const rows = [...h.querySelectorAll('tr')].map(row => row.textContent);
        ok(rows.some(r => r.includes('check selected step') && r.includes('Shift+K')) &&
           rows.some(r => r.includes('Derive a parent') && r.includes('Shift+K')) &&
           rows.some(r => r.includes('Add parent') && r.includes('Alt+↑')),
            'Help keeps check, derive and parent shortcuts in its compact table');
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
