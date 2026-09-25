'use strict';
// Proofs in Standard's basis alone: each line a basis rule instance (or the
// closure of one), or a step by one basis rule, as a map holds it. Used to
// show, line by line in the app with every extension switched off, that the
// basis derives every tautology (by truth tables: a case for each value of
// each letter), every valid sequent, and every universal closure of a
// tautology -- and ∃ as ∀'s dual.
//
// A rule instance is a conditional whose antecedent (or the conjuncts of it)
// gives its consequent by one rule: "(A ∧ ¬A) → ⊥", never "A → (¬A → ⊥)",
// which is exportation's work. The basis has one reductio -- two conditionals
// with the same condition -- so "(X → ⊥) → ¬X" is derived here (negIntro),
// not assumed. Absorption is not used: its work -- two
// conditions' consequents joined, even a claim with itself -- is done by
// hypothetical syllogism, exportation and reductio (sStep and dup below).
//
// Formulas: { op: 'letter'|'pred'|'identity'|'bottom'|'not'|'and'|'or'|'imp'|'iff'|'all'|'some'|'andN' }.
// A fact is { f, ctx, ref }. At a level (Top, Gen), ref is the line that
// states f (at Gen, its closure). In a context supposing A, ref is a fact of
// the enclosing context that states A → f -- so a supposition, which a map
// cannot hold, is carried as the condition of every line that depends on it.
module.exports = function (print) {
    const B = (op, a, b) => ({ op, a, b }), NOT = a => ({ op: 'not', a }), Q = (op, v, body) => ({ op, v, body });
    const BOT = { op: 'bottom' };
    const imp = (a, b) => B('imp', a, b), and = (a, b) => B('and', a, b), or = (a, b) => B('or', a, b), iff = (a, b) => B('iff', a, b);
    const chain = parts => parts.length === 1 ? parts[0] : { op: 'andN', parts };
    const key = f => print(f);

    // The lines: each { f, from: 'theorem' | [line numbers] }, a formula proved once.
    class Proof {
        constructor() { this.lines = []; this.have = new Map(); }
        theorem(f) { return this.have.has(key(f)) ? this.have.get(key(f)) : this.put(f, 'theorem'); }
        step(f, refs) { return this.have.has(key(f)) ? this.have.get(key(f)) : this.put(f, refs); }
        put(f, from) { this.lines.push({ f, from }); this.have.set(key(f), this.lines.length - 1); return this.lines.length - 1; }
    }
    // The map's own level: a fact is a line.
    class Top {
        constructor(proof) { this.proof = proof; this.memo = new Map(); }
        theorem(f) { return { f, ctx: this, ref: this.proof.theorem(f) }; }
        step(f, facts) { return { f, ctx: this, ref: this.proof.step(f, facts.map(x => this.own(x).ref)) }; }
        own(x) { if (x.ctx !== this) throw new Error('not a fact of this level: ' + key(x.f)); return x; }
        here(x) { return this.own(x); }
    }
    // Every line said of arbitrary things: a fact f is the line "∀v̄ f". The
    // closure of a rule instance needs no support; a step is taken under the
    // quantifiers by quantifier distribution and modus ponens.
    class Gen extends Top {
        constructor(proof, vars) { super(proof); this.vars = vars; }
        close(f, vars) { return (vars || this.vars).reduceRight((g, v) => Q('all', v, g), f); }
        theorem(f) { return { f, ctx: this, ref: this.proof.theorem(this.close(f)) }; }
        step(f, facts) {
            const P = this.proof, all = facts.map(x => this.own(x));
            if (all.length === 1) {
                const I = P.theorem(this.close(imp(all[0].f, f)));
                return { f, ctx: this, ref: this.mp(this.vars, all[0].f, f, I, all[0].ref) };
            }
            // Several premises: the instance "(p1 ∧ ... ∧ pk) → f" and, by the
            // closure of an exportation instance, "p1 → (... (pk → f))"; then
            // modus ponens under the quantifiers, a premise at a time.
            const I = imp(chain(all.map(x => x.f)), f);
            let E = f;
            for (let i = all.length - 1; i >= 0; i--) E = imp(all[i].f, E);
            let cur = E, line = this.mp(this.vars, I, E, P.theorem(this.close(imp(I, E))), P.theorem(this.close(I)));
            for (const x of all) { line = this.mp(this.vars, x.f, cur.b, line, x.ref); cur = cur.b; }
            return { f, ctx: this, ref: line };
        }
        // From "∀v̄ (A → C)" and "∀v̄ A", "∀v̄ C".
        mp(vars, A, C, cond, ant) {
            const P = this.proof, cl = (g, vs) => vs.reduceRight((h, v) => Q('all', v, h), g);
            if (!vars.length) return P.step(C, [cond, ant]);
            if (vars.length === 1) {
                const v = vars[0], d = P.step(imp(Q('all', v, A), Q('all', v, C)), [cond]);
                return P.step(Q('all', v, C), [d, ant]);
            }
            const pre = vars.slice(0, -1), v = vars[vars.length - 1];
            const inner = imp(Q('all', v, imp(A, C)), imp(Q('all', v, A), Q('all', v, C)));
            const K = P.theorem(cl(inner, pre));
            const F = this.mp(pre, Q('all', v, imp(A, C)), imp(Q('all', v, A), Q('all', v, C)), K, cond);
            return this.mp(pre, Q('all', v, A), Q('all', v, C), F, ant);
        }
    }
    // A step at any level or context: f from facts by one basis rule.
    const ruleAt = (c, f, facts) => c instanceof Ctx ? c.rule(f, facts) : c.step(f, facts);
    // A context supposing A, inside another context or a level. Its facts are
    // the enclosing context's conditionals "A → f".
    class Ctx {
        constructor(outer, A) { this.outer = outer; this.A = A; this.lifted = new Map(); this.selfFact = null; this.memo = new Map(); }
        get level() { let c = this; while (c instanceof Ctx) c = c.outer; return c; }
        own(x) { if (x.ctx !== this) throw new Error('not a fact of this context: ' + key(x.f)); return x; }
        // At the enclosing context or level: a rule instance; a step by one rule.
        oTheorem(f) { return this.outer.theorem(f); }
        oStep(f, facts) { return ruleAt(this.outer, f, facts); }
        // A → A: "(A ∧ ¬A) → ⊥" (Contradiction), exportation; "(¬A → ⊥) → ¬¬A"
        // (reductio), hypothetical syllogism; "¬¬A → A" (Negation Elimination),
        // hypothetical syllogism.
        self() {
            if (!this.selfFact) {
                const A = this.A;
                const a = this.oStep(imp(A, imp(NOT(A), BOT)), [this.oTheorem(imp(and(A, NOT(A)), BOT))]);
                const b = this.oStep(imp(A, NOT(NOT(A))), [a, this.outer.here(negIntro(this.level, NOT(A)))]);
                this.selfFact = { f: A, ctx: this, ref: this.oStep(imp(A, A), [b, this.oTheorem(imp(NOT(NOT(A)), A))]) };
            }
            return this.selfFact;
        }
        // A fact L of an enclosing context, here: "(L ∧ A) → L" (conjunction
        // elimination), exportation, modus ponens.
        here(x) {
            if (x.ctx === this) return x;
            if (x.ctx !== this.outer) x = this.outer.here(x);
            const k = key(x.f);
            if (this.lifted.has(k)) return this.lifted.get(k);
            const A = this.A, L = x.f;
            const b = this.oStep(imp(L, imp(A, L)), [this.oTheorem(imp(and(L, A), L))]);
            const out = { f: L, ctx: this, ref: this.oStep(imp(A, L), [b, x]) };
            this.lifted.set(k, out);
            return out;
        }
        theorem(f) { return this.here(this.level.theorem(f)); }
        // f from facts here by a conditional of the enclosing context: "p → f",
        // or "(p1 ∧ ... ∧ pk) → f": the facts joined, then hypothetical syllogism.
        apply(f, facts, lemma) {
            const own = facts.map(x => this.here(x)), lem = this.outer.here(lemma);
            const ant = own.length === 1 ? own[0].ref : this.join(own).ref;
            return { f, ctx: this, ref: this.oStep(imp(this.A, f), [ant, lem]) };
        }
        // f from facts here by one basis rule: its rule instance, applied.
        rule(f, facts) { return this.apply(f, facts, this.level.theorem(imp(chain(facts.map(x => x.f)), f))); }
        // "A → (p1 ∧ ... ∧ pk)", a list, from "A → p1", ...: for each more,
        // "(Y ∧ X) → XY" (conjunction introduction), exportation, hypothetical
        // syllogism, and sStep.
        join(own) {
            const A = this.A;
            let list = [own[0].f], ref = own[0].ref;
            for (let i = 1; i < own.length; i++) {
                const X = chain(list), Y = own[i].f, XY = chain(list.concat([Y]));
                // Y twice: "Y → (Y ∧ Y)", by absorption, and hypothetical syllogism.
                if (list.length === 1 && key(X) === key(Y)) { ref = this.oStep(imp(A, XY), [ref, this.outer.here(dup(this.level, Y))]); list = list.concat([Y]); continue; }
                const c = this.oStep(imp(Y, imp(X, XY)), [this.oTheorem(imp(and(Y, X), XY))]);
                const d = this.oStep(imp(A, imp(X, XY)), [own[i].ref, c]);
                ref = this.sStep(X, XY, d, ref);
                list = list.concat([Y]);
            }
            return { f: chain(list), ctx: this, ref };
        }
        // "A → R" from "A → (X → R)" and "A → X", without absorption: W is
        // "A ∧ ¬R"; "W ∧ X" gives R and ¬R, so ¬(W ∧ X) (reductio), so "W → ¬X";
        // W gives X too, so ¬W; so "A → ¬¬R", and "A → R".
        sStep(X, R, fXR, fX) {
            const A = this.A, W = and(A, NOT(R)), WX = and(W, X), o = (f, facts) => this.oStep(f, facts), t = f => this.oTheorem(f);
            const s1 = t(imp(W, A)), s2 = o(imp(W, imp(X, R)), [s1, fXR]), s3 = o(imp(W, X), [s1, fX]);
            const s4 = o(imp(WX, R), [s2]);
            const s7 = o(imp(WX, NOT(R)), [t(imp(WX, W)), t(imp(W, NOT(R)))]);
            const s8 = o(NOT(WX), [s4, s7]);
            const s12 = o(imp(W, imp(X, BOT)), [this.toBottom(WX, s8)]);
            const s14 = o(imp(W, NOT(X)), [s12, this.outer.here(negIntro(this.level, X))]);
            const s15 = o(NOT(W), [s3, s14]);
            const s19 = o(imp(A, imp(NOT(R), BOT)), [this.toBottom(W, s15)]);
            const s21 = o(imp(A, NOT(NOT(R))), [s19, this.outer.here(negIntro(this.level, NOT(R)))]);
            return o(imp(A, R), [s21, t(imp(NOT(NOT(R)), R))]);
        }
        // From ¬Z, a fact of the enclosing context, "Z → ⊥": "(¬Z ∧ Z) → ⊥", exportation, modus ponens.
        toBottom(Z, notZ) {
            const e = this.oStep(imp(NOT(Z), imp(Z, BOT)), [this.oTheorem(imp(and(NOT(Z), Z), BOT))]);
            return this.oStep(imp(Z, BOT), [e, notZ]);
        }
    }
    const lemma = (level, name, build) => { if (!level.memo.has(name)) level.memo.set(name, build()); return level.memo.get(name); };
    // "ψ → ⊥" of "(ψ ∧ ...) → ⊥" and so on: exportation, then the reductio
    // instance "(X → ⊥) → ¬X", then hypothetical syllogism -- "S → ¬X" from "(S ∧ X) → ⊥".
    const denyFrom = (T, S, X, bottomLine) => {
        const e = T.step(imp(S, imp(X, BOT)), [bottomLine]);
        return T.step(imp(S, NOT(X)), [e, negIntro(T, X)]);
    };

    // --- lemmas, proved once at a level ---------------------------------------------
    // ¬⊥: "⊥ → p" and "⊥ → ¬p" (explosion), then reductio.
    const notBottom = T => lemma(T, 'nb', () => {
        const p = { op: 'letter', name: 'Z' };
        return T.step(NOT(BOT), [T.theorem(imp(BOT, p)), T.theorem(imp(BOT, NOT(p)))]);
    });
    // (X → ⊥) → ¬X, from the basis's one reductio. "X → ¬⊥" holds of any X
    // (¬⊥, then weakening). Reductio's instance, its premises taken in the
    // order that puts that one first -- "((X → ¬⊥) ∧ (X → ⊥)) → ¬X" --
    // exports to "(X → ¬⊥) → ((X → ⊥) → ¬X)", and modus ponens discharges
    // it. Nothing here supposes anything, so it does not need the machinery
    // below -- which is what lets that machinery use it.
    const negIntro = (T, x) => lemma(T, 'ni ' + key(x), () => {
        const k = T.step(imp(NOT(BOT), imp(x, NOT(BOT))), [T.theorem(imp(and(NOT(BOT), x), NOT(BOT)))]);
        const z = T.step(imp(x, NOT(BOT)), [k, notBottom(T)]);
        const e = T.step(imp(imp(x, NOT(BOT)), imp(imp(x, BOT), NOT(x))),
            [T.theorem(imp(and(imp(x, NOT(BOT)), imp(x, BOT)), NOT(x)))]);
        return T.step(imp(imp(x, BOT), NOT(x)), [e, z]);
    });
    // (¬X → ⊥) → X: the above for ¬X, then Negation Elimination.
    const indirect = (T, x) => lemma(T, 'ip ' + key(x), () =>
        T.step(imp(imp(NOT(x), BOT), x), [negIntro(T, NOT(x)), T.theorem(imp(NOT(NOT(x)), x))]));
    // X → X, for any X: "(X ∧ ¬X) → ⊥" (Contradiction), exportation, "(¬X → ⊥) → ¬¬X"
    // (reductio), hypothetical syllogism, "¬¬X → X" (Negation Elimination), hypothetical syllogism.
    const selfImp = (T, x) => lemma(T, 'self ' + key(x), () => {
        const a = T.step(imp(x, imp(NOT(x), BOT)), [T.theorem(imp(and(x, NOT(x)), BOT))]);
        const b = T.step(imp(x, NOT(NOT(x))), [a, negIntro(T, NOT(x))]);
        return T.step(imp(x, x), [b, T.theorem(imp(NOT(NOT(x)), x))]);
    });
    // ψ → (ψ ∧ ψ), without absorption: "(ψ ∧ ψ) → (ψ ∧ ψ)" (X → X), exportation,
    // "ψ → (ψ → (ψ ∧ ψ))"; with "ψ → ψ", the reductio route (sStep) gives "ψ → (ψ ∧ ψ)".
    const dup = (T, p) => lemma(T, 'dup ' + key(p), () => {
        const pp = and(p, p), e = T.step(imp(p, imp(p, pp)), [selfImp(T, pp)]);
        return new Ctx(T, p).sStep(p, pp, e, selfImp(T, p));
    });
    // ψ → ¬¬ψ: "(ψ ∧ ¬ψ) → ⊥" (Contradiction), exportation, "(¬ψ → ⊥) → ¬¬ψ" (reductio), hypothetical syllogism.
    const dni = (T, p) => lemma(T, 'dni ' + key(p), () => {
        const e = T.step(imp(p, imp(NOT(p), BOT)), [T.theorem(imp(and(p, NOT(p)), BOT))]);
        return T.step(imp(p, NOT(NOT(p))), [e, negIntro(T, NOT(p))]);
    });
    // ¬D → ¬(ψ ∧ χ), D one of the two: "¬D and (ψ and χ)" laid out as one list; its
    // "¬D and D"; Contradiction; exportation; reductio.
    const denyConj = (T, p, q, side) => lemma(T, 'dc ' + side + key(and(p, q)), () => {
        const D = side ? q : p, J = and(p, q), N = NOT(D), list = chain([N, p, q]);
        const s1 = T.step(imp(and(N, J), and(N, D)), [T.theorem(imp(and(N, J), list)), T.theorem(imp(list, and(N, D)))]);
        const s2 = T.step(imp(and(N, J), BOT), [s1, T.theorem(imp(and(N, D), BOT))]);
        return denyFrom(T, N, J, s2);
    });
    // (¬ψ ∧ ¬χ) → ¬(ψ ∨ χ): supposing "(¬ψ ∧ ¬χ) ∧ (ψ ∨ χ)", "ψ → ⊥" and "χ → ⊥",
    // and ⊥ by constructive dilemma; exportation; reductio.
    const denyDisj = (T, p, q) => lemma(T, 'dd ' + key(or(p, q)), () => {
        const N = and(NOT(p), NOT(q)), D = or(p, q), C = new Ctx(T, and(N, D)), c0 = C.self();
        const cN = C.rule(N, [c0]), cD = C.rule(D, [c0]);
        const cp = C.apply(imp(p, BOT), [C.rule(NOT(p), [cN])], explode(T, p, BOT));
        const cq = C.apply(imp(q, BOT), [C.rule(NOT(q), [cN])], explode(T, q, BOT));
        return denyFrom(T, N, D, C.rule(BOT, [cD, cp, cq]).ref);
    });
    // ¬ψ → (ψ → χ): "(¬ψ ∧ ψ) → χ" (explosion), exportation.
    const explode = (T, p, q) => lemma(T, 'ex ' + key(imp(p, q)), () =>
        T.step(imp(NOT(p), imp(p, q)), [T.theorem(imp(and(NOT(p), p), q))]));
    // χ → (ψ → χ): "(χ ∧ ψ) → χ" (conjunction elimination), exportation.
    const weaken = (T, q, p) => lemma(T, 'wk ' + key(imp(q, imp(p, q))), () =>
        T.step(imp(q, imp(p, q)), [T.theorem(imp(and(q, p), q))]));
    // (ψ ∧ ¬χ) → ¬(ψ → χ): supposing "(ψ ∧ ¬χ) ∧ (ψ → χ)", χ by modus ponens,
    // and ⊥ by Contradiction; exportation; reductio.
    const denyImp = (T, p, q) => lemma(T, 'di ' + key(imp(p, q)), () => {
        const S = and(p, NOT(q)), I = imp(p, q), C = new Ctx(T, and(S, I)), c0 = C.self();
        const cS = C.rule(S, [c0]), cI = C.rule(I, [c0]);
        const cq = C.rule(q, [cI, C.rule(p, [cS])]);
        return denyFrom(T, S, I, C.rule(BOT, [cq, C.rule(NOT(q), [cS])]).ref);
    });
    // (ψ ∧ ¬χ) → ¬(ψ ↔ χ), and (¬ψ ∧ χ) → ¬(ψ ↔ χ): supposing the side and the
    // biconditional, the other side by biconditional elimination, then ⊥.
    const denyIff = (T, p, q, side) => lemma(T, 'df ' + side + key(iff(p, q)), () => {
        const [yes, no] = side ? [q, p] : [p, q];
        const S = side ? and(NOT(p), q) : and(p, NOT(q)), I = iff(p, q), C = new Ctx(T, and(S, I)), c0 = C.self();
        const cS = C.rule(S, [c0]), cI = C.rule(I, [c0]);
        const cno = C.rule(no, [cI, C.rule(yes, [cS])]);
        return denyFrom(T, S, I, C.rule(BOT, [cno, C.rule(NOT(no), [cS])]).ref);
    });
    // ψ ∨ ¬ψ, from the basis in seventeen lines: with N for ¬(ψ ∨ ¬ψ), "N → ¬ψ"
    // and so "N → (ψ ∨ ¬ψ)", "N → ¬N", ¬N (reductio), and ψ ∨ ¬ψ (Negation Elimination).
    const lem = (T, p) => lemma(T, 'lem ' + key(p), () => {
        const E = or(p, NOT(p)), N = NOT(E);
        const l1 = T.theorem(imp(p, E)), l3 = T.step(imp(E, imp(N, BOT)), [T.theorem(imp(and(E, N), BOT))]);
        const l5 = T.step(imp(and(p, N), BOT), [T.step(imp(p, imp(N, BOT)), [l1, l3])]);
        const l7 = T.step(imp(and(N, p), BOT), [T.theorem(imp(and(N, p), and(p, N))), l5]);
        const l10 = T.step(imp(N, NOT(p)), [T.step(imp(N, imp(p, BOT)), [l7]), negIntro(T, p)]);
        const l12 = T.step(imp(N, E), [l10, T.theorem(imp(NOT(p), E))]);
        const l15 = T.step(imp(N, NOT(N)), [T.step(imp(N, imp(N, BOT)), [l12, l3]), negIntro(T, N)]);
        // "N → ¬N" gives ¬N with "N → ¬¬N" (dni), by the basis's reductio:
        // a claim implying both ¬N and ¬¬N is false.
        return T.step(E, [T.step(NOT(N), [l15, dni(T, N)])]);
    });

    // --- truth tables -----------------------------------------------------------------
    // Kleene's three values of a formula, given some letters' values.
    function value3(f, v) {
        switch (f.op) {
            case 'letter': case 'pred': case 'identity': { const k = atomKey(f); return Object.prototype.hasOwnProperty.call(v, k) ? v[k] : undefined; }
            case 'bottom': return false;
            case 'not': { const a = value3(f.a, v); return a === undefined ? undefined : !a; }
            case 'and': { const a = value3(f.a, v), b = value3(f.b, v); return a === false || b === false ? false : a && b ? true : undefined; }
            case 'or': { const a = value3(f.a, v), b = value3(f.b, v); return a === true || b === true ? true : a === false && b === false ? false : undefined; }
            case 'imp': { const a = value3(f.a, v), b = value3(f.b, v); return a === false || b === true ? true : a === true && b === false ? false : undefined; }
            case 'iff': { const a = value3(f.a, v), b = value3(f.b, v); return a === undefined || b === undefined ? undefined : a === b; }
        }
        throw new Error('value of ' + f.op);
    }
    // An atom -- a letter, or a predicate of names and free variables -- by its text.
    const atomKey = f => f.op === 'letter' ? f.name : key(f);
    const atoms = new Map();
    const letters = (f, out = []) => { if (/^(?:letter|pred|identity)$/.test(f.op)) { const k = atomKey(f); atoms.set(k, f); if (!out.includes(k)) out.push(k); } else ['a', 'b'].forEach(k => f[k] && letters(f[k], out)); return out; };
    // A fact of φ, or of ¬φ, as φ is true or false where the context's letters say.
    function evaluate(C, f, v, lits, atom) {
        const T = C.level, memoKey = 'ev ' + key(f);
        if (C.memo.has(memoKey)) return C.memo.get(memoKey);
        let out;
        const val = g => evaluate(C, g, v, lits, atom);
        switch (f.op) {
            case 'letter': case 'pred': case 'identity': out = atom(atomKey(f)); break;
            case 'not': { const a = val(f.a); out = value3(f.a, v) ? C.apply(NOT(NOT(f.a)), [a], dni(T, f.a)) : a; break; }
            case 'and': {
                const [p, q] = [f.a, f.b], tp = value3(p, v), tq = value3(q, v);
                if (tp && tq) out = Object.assign({}, C.join([C.here(val(p)), C.here(val(q))]), { f });
                else out = C.apply(NOT(f), [val(tp === false ? p : q)], denyConj(T, p, q, tp === false ? 0 : 1));
                break;
            }
            case 'or': {
                const [p, q] = [f.a, f.b], tp = value3(p, v), tq = value3(q, v);
                if (tp || tq) out = C.rule(f, [val(tp ? p : q)]);
                else out = C.apply(NOT(f), [val(p), val(q)], denyDisj(T, p, q));
                break;
            }
            case 'imp': {
                const [p, q] = [f.a, f.b], tp = value3(p, v), tq = value3(q, v);
                if (tp === false) out = C.apply(f, [val(p)], explode(T, p, q));
                else if (tq) out = C.apply(f, [val(q)], weaken(T, q, p));
                else out = C.apply(NOT(f), [val(p), val(q)], denyImp(T, p, q));
                break;
            }
            case 'iff': {
                const [p, q] = [f.a, f.b], tp = value3(p, v), tq = value3(q, v);
                const half = (x, y, tx) => tx === false ? C.apply(imp(x, y), [val(x)], explode(T, x, y)) : C.apply(imp(x, y), [val(y)], weaken(T, y, x));
                // Its two halves, then biconditional introduction.
                if (tp === tq) out = C.rule(f, [half(p, q, tp), half(q, p, tq)]);
                else out = C.apply(NOT(f), [val(p), val(q)], denyIff(T, p, q, tp ? 0 : 1));
                break;
            }
            default: throw new Error('evaluate ' + f.op);
        }
        C.memo.set(memoKey, out);
        return out;
    }
    // A fact of τ: a case for each value of a letter, as far as τ needs it.
    function tautology(T, tau) {
        const order = letters(tau);
        const lit = (name, val) => val ? atoms.get(name) : NOT(atoms.get(name));
        function cases(chosen) {
            const v = Object.fromEntries(chosen.map(([n, x]) => [n, x]));
            if (value3(tau, v) === true) {
                // Supposing the letters' values, one conjunction: τ, and so "values → τ".
                const G = chosen.map(([n, x]) => lit(n, x)).reduce((g, l) => and(g, l));
                const C = new Ctx(T, G), lits = chosen.map(([n, x]) => lit(n, x));
                const atom = name => {
                    let fact = C.self(), g = G;
                    const i = chosen.findIndex(([n]) => n === name);
                    for (let j = chosen.length - 1; j > i; j--) { g = g.a; fact = C.rule(g, [fact]); }
                    return i > 0 ? C.rule(lits[i], [fact]) : fact;
                };
                return { G, fact: evaluate(C, tau, v, lits, atom) };
            }
            const name = order.find(n => !chosen.some(([m]) => m === n));
            const yes = cases(chosen.concat([[name, true]])), no = cases(chosen.concat([[name, false]]));
            const p = atoms.get(name), E = lem(T, p);
            if (!chosen.length) return { G: null, fact: T.step(tau, [E, yes.fact.ref, no.fact.ref]) };
            // "(G ∧ p) → τ" and "(G ∧ ¬p) → τ": by exportation, "G → (p → τ)" and "G → (¬p → τ)";
            // then, supposing G, constructive dilemma on "p or not p".
            const G = chosen.map(([n, x]) => lit(n, x)).reduce((g, l) => and(g, l));
            const e1 = T.step(imp(G, imp(p, tau)), [yes.fact.ref]), e2 = T.step(imp(G, imp(NOT(p), tau)), [no.fact.ref]);
            const M = new Ctx(T, G);
            const m1 = { f: imp(p, tau), ctx: M, ref: e1 }, m2 = { f: imp(NOT(p), tau), ctx: M, ref: e2 };
            return { G, fact: M.rule(tau, [M.here(E), m1, m2]) };
        }
        const r = cases([]);
        return r.fact.ctx === T ? r.fact : null;
    }
    // --- quantifier negation, by which ∃ is ∀'s dual ------------------------------
    // ∃xα → ¬∀x¬α: of each thing, "¬α → (α → ⊥)"; so "∀x¬α → ∀x(α → ⊥)" and
    // "∀x(α → ⊥) → (∃xα → ∃x⊥)" (distribution); supposing ∃xα and ∀x¬α,
    // ∃x⊥, and ⊥ (vacuous); exportation; reductio.
    function qnForward(T, x, a) {
        const E = Q('some', x, a), U = Q('all', x, NOT(a)), P = T.proof, G = new Gen(P, [x]);
        const q1 = G.step(imp(NOT(a), imp(a, BOT)), [G.theorem(imp(and(NOT(a), a), BOT))]);
        const q2 = T.step(imp(U, Q('all', x, imp(a, BOT))), [{ f: Q('all', x, imp(NOT(a), imp(a, BOT))), ctx: T, ref: q1.ref }]);
        const D = new Ctx(T, and(E, U)), d0 = D.self();
        const d1 = D.rule(E, [d0]), d2 = D.rule(U, [d0]);
        const d3 = D.apply(Q('all', x, imp(a, BOT)), [d2], q2);
        // "∃x α" and "∀x (α → ⊥)" give ⊥: existential elimination.
        const d4 = D.rule(BOT, [d1, d3]);
        return denyFrom(T, E, U, d4.ref);
    }
    // ¬∀x¬α → ∃xα: of each thing, "α → ∃xα" (the closure of an existential
    // introduction instance), so "¬∃xα → ¬α"; distribution and the vacuous
    // quantifier, "¬∃xα → ∀x¬α"; then, supposing ¬∀x¬α and ¬∃xα, a
    // contradiction; exportation; reductio.
    function qnBack(T, x, a) {
        const E = Q('some', x, a), U = Q('all', x, NOT(a)), P = T.proof;
        const G = new Gen(P, [x]), g1 = G.theorem(imp(a, E));
        const notE = G.step(imp(NOT(E), imp(E, BOT)), [G.theorem(imp(and(NOT(E), E), BOT))]);
        const Cg = new Ctx(G, and(imp(a, E), NOT(E))), c0 = Cg.self();
        const c1 = Cg.rule(imp(a, E), [c0]), c2 = Cg.rule(NOT(E), [c0]);
        const c3 = Cg.apply(imp(E, BOT), [c2], notE), c4 = Cg.rule(imp(a, BOT), [c1, c3]);
        // "α → ⊥" gives ¬α by the derived "(α → ⊥) → ¬α", not by a rule.
        const c5 = Cg.apply(NOT(a), [c4], negIntro(G, a));
        const g2 = G.step(imp(imp(a, E), imp(NOT(E), NOT(a))), [c5.ref]);
        const g3 = G.step(imp(NOT(E), NOT(a)), [g2, g1]);
        const t3 = { f: Q('all', x, imp(NOT(E), NOT(a))), ctx: T, ref: g3.ref };
        const h1 = T.step(imp(Q('all', x, NOT(E)), U), [t3]);
        const h3 = T.step(imp(NOT(E), U), [T.theorem(imp(NOT(E), Q('all', x, NOT(E)))), h1]);
        const D = new Ctx(T, and(NOT(U), NOT(E))), d0 = D.self();
        const d1 = D.rule(NOT(U), [d0]), d2 = D.rule(NOT(E), [d0]);
        const d3 = D.apply(U, [d2], h3), d4 = D.rule(BOT, [d3, d1]);
        const e = T.step(imp(NOT(U), imp(NOT(E), BOT)), [d4.ref]);
        return T.step(imp(NOT(U), E), [e, indirect(T, E)]);
    }
    return { Proof, Top, Gen, Ctx, B, NOT, Q, BOT, imp, and, or, iff, chain, tautology, ruleAt, value3, letters, qnForward, qnBack, selfImp, dup, negIntro, lem };
};
