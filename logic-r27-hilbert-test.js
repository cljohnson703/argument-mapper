'use strict';
/**
 * Standard's basis is Hilbert's: eight axiom schemas, their universal
 * closures, and modus ponens. Every other rule the check offers is derivable
 * from them, so none of them need be basic.
 *
 *   node logic-r27-hilbert-test.js [argument-mapper-r27.html]
 *
 * 1. The axioms: what the app takes as needing no support, and what it does
 *    not (a curried form that is no axiom, "P → P", "P ∨ ¬P").
 * 2. With every extension off, only modus ponens certifies a step.
 * 3. The derivations: Kleene's ten propositional axioms, the ↔ and ∃ ones,
 *    and identity's symmetry, transitivity and compound substitution -- each
 *    built by logic-r27-hilbert-proofs.js and checked line by line in the app.
 *    Kleene's system is complete, so deriving all ten shows this basis is.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const H = require('./logic-r27-hilbert-proofs.js');
const { L, BOT, NOT, IMP, AND, OR, IFF, ALL, SOME, PR, print, Ax, Hyp, Use, Mp, deduce, Proof } = H;

const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || 'argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/hilbert-test', virtualConsole: vc,
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
const rule = (ps, c) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [
    { id: 'S', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] }] }];
    var s = collectDeductiveSteps(trees)[0]; return s.rule ? s.rule.name : null;`);
const thm = t => ev('var r = logicalTheorem(' + J(t) + '); return r ? (r.axiom ? (r.closure ? "closure" : "axiom") : "instance") : null;');
const allOff = () => ev('setDeductiveRule([].concat.apply([], DEDUCTIVE_EXTENSIONS.map(function (g) { return g.rules; })), false); return 1;');
let passed = 0, failed = 0;
function ok(cond, label, detail) {
    if (cond) { passed++; console.log('  ✓ ' + label); }
    else { failed++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

// --- the axioms, as shorthands ---------------------------------------------
const A = L('A'), B = L('B'), C = L('C');
const h1 = (x, y) => Ax(IMP(x, IMP(y, x)));
const dnE = x => Ax(IMP(NOT(NOT(x)), x));
const negOut = x => Ax(IMP(NOT(x), IMP(x, BOT)));
const negIn = x => Ax(IMP(IMP(x, BOT), NOT(x)));
const andOut = (x, y) => Ax(IMP(AND(x, y), NOT(IMP(x, NOT(y)))));
const andIn = (x, y) => Ax(IMP(NOT(IMP(x, NOT(y))), AND(x, y)));
const orIn = (x, y) => Ax(IMP(IMP(NOT(x), y), OR(x, y)));
const orOut = (x, y) => Ax(IMP(OR(x, y), IMP(NOT(x), y)));
const iffOut = (x, y) => Ax(IMP(IFF(x, y), AND(IMP(x, y), IMP(y, x))));
const iffIn = (x, y) => Ax(IMP(AND(IMP(x, y), IMP(y, x)), IFF(x, y)));
const ID = (l, r) => ({ op: 'identity', left: l, right: r });
const refl = t => Ax(ID(t, t));
const sub = (l, r, from, to) => Ax(IMP(ID(l, r), IMP(from, to)));
const F = t => PR('F', [t]), G = t => PR('G', [t]);

// --- lemmas ----------------------------------------------------------------
const explosion = x => deduce([BOT], Mp(Mp(Mp(Hyp(BOT), h1(BOT, NOT(x))), negIn(NOT(x))), dnE(x)));
const fromNotBot = (y, tree) => Mp(Mp(tree, negIn(NOT(y))), dnE(y));
const conjRight = (x, y) => {
    const impBot = Mp(Mp(Hyp(AND(x, y)), andOut(x, y)), negOut(IMP(x, NOT(y))));
    const bot = Mp(Mp(Hyp(NOT(y)), h1(NOT(y), x)), impBot);
    return deduce([AND(x, y)], fromNotBot(y, deduce([NOT(y)], bot)));
};
const conjLeft = (x, y) => {
    const impBot = Mp(Mp(Hyp(AND(x, y)), andOut(x, y)), negOut(IMP(x, NOT(y))));
    const xToNotY = deduce([x], Mp(Mp(Hyp(x), Mp(Hyp(NOT(x)), negOut(x))), Use(explosion(NOT(y)))));
    return deduce([AND(x, y)], fromNotBot(x, deduce([NOT(x)], Mp(xToNotY, impBot))));
};
const adjunction = (x, y) => {
    const bot = Mp(Hyp(y), Mp(Mp(Hyp(x), Hyp(IMP(x, NOT(y)))), negOut(y)));
    return deduce([x, y], Mp(Mp(deduce([IMP(x, NOT(y))], bot), negIn(IMP(x, NOT(y)))), andIn(x, y)));
};

// --- the derivations -------------------------------------------------------
const CASES = [];
CASES.push(['A → A', H.selfImp(A)]);
CASES.push(['explosion  ⊥ → A', explosion(A)]);
{
    const bot = Mp(Mp(Hyp(A), Hyp(IMP(A, B))), Mp(Mp(Hyp(A), Hyp(IMP(A, NOT(B)))), negOut(B)));
    CASES.push(['Kleene 9, reductio  (A → B) → ((A → ¬B) → ¬A)',
        deduce([IMP(A, B), IMP(A, NOT(B))], Mp(deduce([A], bot), negIn(A)))]);
}
CASES.push(['Kleene 3, simplification  (A ∧ B) → A', conjLeft(A, B)]);
CASES.push(['Kleene 4, simplification  (A ∧ B) → B', conjRight(A, B)]);
CASES.push(['Kleene 5, adjunction  A → (B → (A ∧ B))', adjunction(A, B)]);
{
    const bot = Mp(Hyp(A), Mp(Hyp(NOT(A)), negOut(A)));
    CASES.push(['Kleene 6, addition  A → (A ∨ B)',
        deduce([A], Mp(deduce([NOT(A)], Mp(bot, Use(explosion(B)))), orIn(A, B)))]);
}
{
    const hnc = Hyp(NOT(C));
    const nA = Mp(deduce([A], Mp(Mp(Hyp(A), Hyp(IMP(A, C))), Mp(hnc, negOut(C)))), negIn(A));
    const c = Mp(Mp(nA, Mp(Hyp(OR(A, B)), orOut(A, B))), Hyp(IMP(B, C)));
    CASES.push(['Kleene 8, proof by cases  (A → C) → ((B → C) → ((A ∨ B) → C))',
        deduce([IMP(A, C), IMP(B, C), OR(A, B)], fromNotBot(C, deduce([NOT(C)], Mp(c, Mp(hnc, negOut(C))))))]);
}
CASES.push(['hypothetical syllogism  (A → B) → ((B → C) → (A → C))',
    deduce([IMP(A, B), IMP(B, C), A], Mp(Mp(Hyp(A), Hyp(IMP(A, B))), Hyp(IMP(B, C))))]);
CASES.push(['biconditional elimination  (A ↔ B) → (A → B)',
    deduce([IFF(A, B)], Mp(Mp(Hyp(IFF(A, B)), iffOut(A, B)), Use(conjLeft(IMP(A, B), IMP(B, A)))))]);
CASES.push(['biconditional introduction  (A → B) → ((B → A) → (A ↔ B))',
    deduce([IMP(A, B), IMP(B, A)], Mp(Mp(Hyp(IMP(B, A)), Mp(Hyp(IMP(A, B)), Use(adjunction(IMP(A, B), IMP(B, A))))), iffIn(A, B)))]);
{
    const Fx = PR('F', ['x']), All = ALL('x', NOT(Fx));
    const bot = Mp(Hyp(F('a')), Mp(Mp(Hyp(All), Ax(IMP(All, NOT(F('a'))))), negOut(F('a'))));
    CASES.push(['existential generalization  F(a) → ∃x F(x)',
        deduce([F('a')], Mp(Mp(deduce([All], bot), negIn(All)), Ax(IMP(NOT(All), SOME('x', Fx)))))]);
}
// Identity: what Enderton's atomic E2 leaves to be derived.
CASES.push(['identity symmetry  a = b → b = a',
    deduce([ID('a', 'b')], Mp(refl('a'), Mp(Hyp(ID('a', 'b')), sub('a', 'b', ID('a', 'a'), ID('b', 'a')))))]);
{
    const ba = Mp(refl('a'), Mp(Hyp(ID('a', 'b')), sub('a', 'b', ID('a', 'a'), ID('b', 'a'))));
    const ca = Mp(ba, Mp(Hyp(ID('b', 'c')), sub('b', 'c', ID('b', 'a'), ID('c', 'a'))));
    CASES.push(['identity transitivity  a = b → (b = c → a = c)',
        deduce([ID('a', 'b'), ID('b', 'c')], Mp(refl('a'), Mp(ca, sub('c', 'a', ID('a', 'a'), ID('c', 'a')))))]);
}
{
    const hab = Hyp(ID('a', 'b')), hc = Hyp(AND(F('a'), G('a')));
    const fb = Mp(Mp(hc, Use(conjLeft(F('a'), G('a')))), Mp(hab, sub('a', 'b', F('a'), F('b'))));
    const gb = Mp(Mp(hc, Use(conjRight(F('a'), G('a')))), Mp(hab, sub('a', 'b', G('a'), G('b'))));
    CASES.push(['substitution into a compound claim  a = b → ((F(a) ∧ G(a)) → (F(b) ∧ G(b)))',
        deduce([ID('a', 'b'), AND(F('a'), G('a'))], Mp(gb, Mp(fb, Use(adjunction(F('b'), G('b'))))))]);
}

try {
    console.log('\n-- the axioms --');
    allOff();
    const axioms = [['A → (B → A)', 'H1'], ['(A → (B → C)) → ((A → B) → (A → C))', 'H2'], ['¬¬A → A', 'H3'],
        ['(∀x F(x)) → F(a)', 'Q1'], ['(∀x (F(x) → G(x))) → ((∀x F(x)) → (∀x G(x)))', 'Q2'], ['P → (∀x P)', 'Q3'],
        ['a = a', 'E1'], ['(a = b) → (F(a) → F(b))', 'E2'],
        ['¬A → (A → ⊥)', 'definition of ¬'], ['(A → ⊥) → ¬A', 'definition of ¬'],
        ['(A ∧ B) → ¬(A → ¬B)', 'definition of ∧'], ['(A ∨ B) → (¬A → B)', 'definition of ∨'],
        ['(A ↔ B) → ((A → B) ∧ (B → A))', 'definition of ↔'], ['(∃x F(x)) → ¬(∀x ¬F(x))', 'definition of ∃']];
    const notAxioms = axioms.filter(([t]) => thm(t) !== 'axiom').map(([t, n]) => n + ': ' + t);
    ok(!notAxioms.length, 'the eight schemas and the five definitions are the axioms, both ways round where they are equivalences', notAxioms.join(' ‖ '));
    ok(thm('∀x (F(x) → (G(x) → F(x)))') === 'closure' && thm('∀x ((F(x) ∧ G(x)) → F(x))') === null,
        'every universal closure of an axiom is an axiom; a closure of something else is not');
    const refused = ['(A ∧ B) → A', 'A → (A ∨ B)', '⊥ → A', '(A → B) → ((A → ¬B) → ¬A)', 'F(a) → (∃x F(x))',
        'P → P', 'P ∨ ¬P', '(a = b) → ((F(a) ∧ G(a)) → (F(b) ∧ G(b)))'].filter(t => thm(t));
    ok(!refused.length, 'what is derivable is no axiom: simplification, addition, explosion, Kleene\'s negation axiom, existential generalization, substitution into a compound claim', refused.join(' ‖ '));
    ok(rule(['A → B', 'A'], 'B') === 'modus ponens' && !rule(['A ∧ B'], 'A') && !rule(['A', 'B'], 'A ∧ B') && !rule(['A → B', 'B → C'], 'A → C'),
        'with every extension off, modus ponens is the only step');

    console.log('\n-- every rule the basis dropped, derived from it --');
    let lines = 0;
    for (const [label, tree] of CASES) {
        const P = new Proof();
        let wrong = [];
        try {
            P.write(tree);
            P.lines.forEach((ln, i) => {
                const text = print(ln.f);
                const got = ln.from === 'axiom' ? thm(text) : rule(ln.from.map(k => print(P.lines[k].f)), text);
                if (got !== 'axiom' && got !== 'closure' && got !== 'modus ponens') wrong.push((i + 1) + '. ' + text);
            });
        } catch (e) { wrong = [e.message]; }
        lines += P.lines.length;
        ok(!wrong.length, label + ' — ' + P.lines.length + ' lines', wrong.slice(0, 2).join(' | '));
    }
    ok(lines > 4000, 'all ' + CASES.length + ' derivations together: ' + lines + ' lines, each an axiom, a closure of one, or modus ponens');
    ok(!errors.length, 'no page errors', errors.slice(0, 2).join(' | '));
} catch (err) {
    failed++;
    console.log('  ✗ FAIL: threw — ' + err.message);
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
