'use strict';
/**
 * Standard's basis and its extensions, and the Logic panel.
 *
 *   node logic-r27-basis-test.js [argument-mapper-r27.html]
 *
 * 1. The basis is always on; every other rule is an extension, in groups a
 *    map switches on and off, the familiar ones on by default. Only the basis
 *    gives rule instances ("P → P" and "P ∨ ¬P" are extra instances, off).
 * 2. Order and grouping are part of a claim: commutation, association and
 *    idempotence are rules (on by default); off, the long way still works.
 * 3. With every extension off, the basis alone derives what was asked for:
 *    ¬¬A from A, and ∃y B(y) from ∃x B(x).
 * 4. Rules inside quantifiers, on English claims ("Some raven is black ⊢
 *    Something is black"); quantifier distribution one way only.
 * 5. Exceptions ("every raven except Fido"), denials in the object ("a raven
 *    that Poe does not love"), "person" as a head noun, and scope flagged,
 *    not settled ("it is not the case that A and B").
 * 6. What a denial in a word takes in ("a non-raven or black", "a non-raven
 *    that is black"), and a junction after a relative clause ("everything
 *    that is a raven or black"): read as said, or flagged -- never split into
 *    fragments that certify invalid steps.
 * 7. The Logic panel: built from the extensions, bound to the map's
 *    settings, saved with the map, merged between collaborators (last writer
 *    wins), and left alone by undo.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || 'argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/basis-test', virtualConsole: vc,
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
    var s = collectDeductiveSteps(trees)[0]; return { rule: s.rule ? s.rule.name : null, ambiguous: !!s.ambiguous, why: s.why ? s.why.text : '', restates: !!s.restates };`);
const rule = (ps, c) => step(ps, c).rule;
const thm = t => ev('var r = logicalTheorem(' + J(t) + '); return r ? r.rule.name : null;');
const key = t => ev('var f = parseClaim(' + J(t) + '); return f ? claimKey(f) : null;');
const fol = t => ev('var f = parseClaim(' + J(t) + '); var g = f && claimFolOf(f); return g ? symbolicText(g, {}) : null;');
// Everything off: the basis alone -- Hilbert's axioms and modus ponens.
const allOff = () => ev('setDeductiveRule([].concat.apply([], DEDUCTIVE_EXTENSIONS.map(function (g) { return g.rules; })), false); return 1;');
// The core steps on and nothing else: the rules that were the basis until
// r27.29, each of them derivable from the axioms (logic-r27-hilbert-test.js).
const coreOnly = () => ev('setDeductiveRule([].concat.apply([], DEDUCTIVE_EXTENSIONS.map(function (g) { return g.rules; })), false); setDeductiveRule(DEDUCTIVE_EXTENSIONS.filter(function (g) { return g.id === "core"; })[0].rules, true); return 1;');
const defaults = () => ev('state.logic = null; claimRulesCache = null; return 1;');
let passed = 0, failed = 0;
function ok(cond, label, detail) {
    if (cond) { passed++; console.log('  ✓ ' + label); }
    else { failed++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}
// A derivation the library builds, with every line checked in the app.
let libRun = null;
// A formula printed as the app writes it (for logic-r27-basis-proofs.js).
const printN = n => n.op === 'andN' ? '(' + n.parts.map(printN).join(' ∧ ') + ')'
    : n.op === 'not' ? '¬' + (/^(?:pred|letter|not|bottom)$/.test(n.a.op) ? printN(n.a) : '(' + printN(n.a) + ')')
    : /^(?:and|or|imp|iff)$/.test(n.op) ? '(' + printN(n.a) + ' ' + { and: '∧', or: '∨', imp: '→', iff: '↔' }[n.op] + ' ' + printN(n.b) + ')'
    : n.op === 'bottom' ? '⊥' : n.op === 'letter' ? n.name : n.name + '(' + (n.args || []).join(',') + ')';
const show = ([p, c]) => p.join(' | ') + ' ⊢ ' + c;
// Steps expected to pass by the rule named, to be flagged, or to be neither passed nor flagged.
const passes = cases => cases.filter(([p, c, r]) => rule(p, c) !== r).map(x => show(x) + ' [' + rule(x[0], x[1]) + ']');
const flagged = cases => cases.filter(([p, c]) => { const s = step(p, c); return s.rule || !s.ambiguous; }).map(show);
const refused = cases => cases.filter(([p, c]) => rule(p, c)).map(x => show(x) + ' [' + rule(x[0], x[1]) + ']');

try {
    console.log('\n-- the basis and its extensions --');
    {
        const groups = ev('return DEDUCTIVE_EXTENSIONS.map(function (g) { return g.id + ":" + g.on; });');
        ok(J(groups) === J(['core:true', 'familiar:true', 'replacement:true', 'structural:true', 'quantifier:true', 'inside:true', 'negations:false', 'instances:false', 'catchall:false']),
            'nine groups of extensions; the core steps and the familiar ones on by default, negations anywhere, extra rule instances and the catch-alls off', J(groups));
        const basisSet = ev('return [DEDUCTIVE_BASIS.has("modus-ponens"), DEDUCTIVE_AXIOMS.length, ["and-elim", "hypothetical-syllogism", "exportation", "quantifier-distribution", "null-quantification", "reductio", "universal-elimination", "existential-introduction", "existential-elimination"].every(function (id) { return !DEDUCTIVE_BASIS.has(id) && DEDUCTIVE_CORE.indexOf(id) >= 0; })];');
        const shared = ev('return DEDUCTIVE_EXTENSIONS.some(function (g) { return g.rules.some(function (id) { return DEDUCTIVE_BASIS.has(id); }); });');
        ok(basisSet[0] && basisSet[1] === 13 && basisSet[2] && !shared,
            'the basis is modus ponens and the axioms; every intro and elim rule is a core step, derivable from them, and no extension is in the basis', J(basisSet));
        const outOfBasis = ev('var fam = DEDUCTIVE_EXTENSIONS.filter(function (g) { return g.id === "familiar"; })[0].rules; return ["absorption", "modus-ponens-together", "subalternation", "predicate-congruence", "constructive-dilemma"].every(function (id) { return !DEDUCTIVE_BASIS.has(id) && fam.indexOf(id) >= 0; });');
        ok(outOfBasis, 'absorption, modus ponens on several conditions, subalternation, predicate congruence and the constructive dilemma are familiar steps, not basis rules');
        coreOnly();
        const basis = [
            [['P -> Q', 'P'], 'Q', 'modus ponens'],
            [['P -> Q', 'Q -> R'], 'P -> R', 'hypothetical syllogism'],
            [['(P & Q) -> R'], 'P -> (Q -> R)', 'exportation'],
            [['∀x (F(x) → G(x))'], '(∀x F(x)) → (∀x G(x))', 'quantifier distribution'],
            [['P'], '∀x (P)', 'vacuous quantifier']];
        ok(!passes(basis).length, 'with every extension off, the basis rules still certify', passes(basis).join(' ‖ '));
        const gone = [[['P -> Q', '~Q'], '~P'], [['P v Q', '~P'], 'Q'], [['~(P & Q)'], '~P v ~Q'], [['P & Q'], 'Q & P'], [['Some raven is black'], 'Something is black']];
        ok(!refused(gone).length, 'and modus tollens, disjunctive syllogism, De Morgan, commutation and the rules inside quantifiers do not', refused(gone).join(' ‖ '));
        defaults();
        ok(rule(['P -> Q', '~Q'], '~P') === 'modus tollens', 'back to the defaults, modus tollens again');
        ev('setDeductiveRule(["modus-tollens"], false); return 1;');
        const stored = ev('return state.logic.rules;');
        ok(rule(['P -> Q', '~Q'], '~P') === null && J(stored) === J({ 'modus-tollens': false }), 'one rule switched off; only what differs from the defaults is stored', J(stored));
        ev('setDeductiveRule(["modus-tollens"], true); return 1;');
        ok(J(ev('return state.logic.rules;')) === '{}' && rule(['P -> Q', '~Q'], '~P') === 'modus tollens', 'switched back on, nothing is stored');
        defaults();
        // Modus ponens takes one condition, the first. "If A, and if B, then C"
        // is "if A and B, then C", so both conditions at once, or the conjuncts
        // of one condition, are one step while that familiar step is on.
        const together = [
            [['If it rains, and if it is cold, then it snows', 'It rains', 'It is cold'], 'It snows', 'modus ponens, conditions together'],
            [['If it rains and it is cold, then it snows', 'It rains', 'It is cold'], 'It snows', 'modus ponens, conditions together'],
            [['If it rains and it is cold, then it snows', 'It rains and it is cold'], 'It snows', 'modus ponens'],
            [['If it rains, and if it is cold, then it snows', 'It rains'], 'If it is cold, then it snows', 'modus ponens']];
        ok(!passes(together).length, 'modus ponens on several conditions, given one by one: one step, by a familiar rule', passes(together).join(' ‖ '));
        ev('setDeductiveRule(["modus-ponens-together"], false); return 1;');
        const apart = [[['If it rains, and if it is cold, then it snows', 'It rains', 'It is cold'], 'It snows'],
            [['If it rains and it is cold, then it snows', 'It rains', 'It is cold'], 'It snows']];
        ok(!refused(apart).length && rule(['If it rains, and if it is cold, then it snows', 'It rains'], 'If it is cold, then it snows') === 'modus ponens' &&
            thm('((A → (B → C)) ∧ A ∧ B) → C') === null && thm('((A → B) ∧ A) → C') === null && thm('((A → B) ∧ A) → B') === 'modus ponens',
            'switched off, each condition takes its own step; either way the rule instance is the basis one, on a single condition', refused(apart).join(' ‖ '));
        defaults();
        ok(thm('P → P') === null && thm('P ∨ ¬P') === null && thm('(P ∧ Q) → P') === 'conjunction elimination',
            'only the basis gives rule instances: "(P ∧ Q) → P" is one; "P → P" and "P ∨ ¬P" are not, by default');
        ev('setDeductiveRule(["instance-restatement", "instance-excluded-middle"], true); return 1;');
        ok(thm('P → P') === 'restatement' && thm('P ∨ ¬P') === 'excluded middle', 'with extra rule instances on, they are');
        defaults();
        // "P → P" from the basis: Contradiction, exportation, the derived
        // "(¬P → ⊥) → ¬¬P", hypothetical syllogism, Negation Elimination,
        // hypothetical syllogism. The third line is no rule instance now that
        // the basis has one reductio, so the library proves it (negIntro).
        coreOnly();
        libRun = build => {
            const BP = require('./logic-r27-basis-proofs.js')(printN), proof = new BP.Proof(), top = new BP.Top(proof);
            build(BP, top);
            const names = proof.lines.map(ln => ln.from === 'theorem' ? thm(printN(ln.f)) : rule(ln.from.map(k => printN(proof.lines[k].f)), printN(ln.f)));
            return { lines: proof.lines.length, names, bad: proof.lines.map((ln, i) => names[i] ? null : (i + 1) + '. ' + printN(ln.f)).filter(Boolean) };
        };
        const P = { op: 'letter', name: 'P' };
        const ni = libRun((BP, top) => BP.negIntro(top, P));
        ok(!ni.bad.length && ni.names.indexOf('reductio') >= 0 && thm('(P → ⊥) → ¬P') === 'definition of ¬',
            '"(P → ⊥) → ¬P" is an axiom -- half of what ¬ abbreviates -- and the core steps still derive it in ' + ni.lines + ' lines',
            J(ni.bad.slice(0, 2)));
        const self = libRun((BP, top) => BP.selfImp(top, P));
        ok(!self.bad.length, 'P → P from the basis, in ' + self.lines + ' lines', J(self.bad.slice(0, 2)));
        const pp = [thm('(P ∧ ¬P) → ⊥'), rule(['(P ∧ ¬P) → ⊥'], 'P → (¬P → ⊥)'), thm('¬¬P → P'),
            rule(['P → ¬¬P', '¬¬P → P'], 'P → P')];
        ok(J(pp) === J(['Contradiction', 'exportation', 'H3, double negation', 'hypothetical syllogism']), 'its instances and its last step', J(pp));
        defaults();
    }

    console.log('\n-- order and grouping --');
    {
        const on = [
            [['Alice sings and Bob dances'], 'Bob dances and Alice sings', 'commutation'],
            [['Alice sings or Bob dances'], 'Bob dances or Alice sings', 'commutation'],
            [['P & (Q & R)'], '(P & Q) & R', 'association'],
            [['P v P'], 'P', 'idempotence'],
            [['Fido barks or Fido barks'], 'Fido barks', 'idempotence']];
        ok(!passes(on).length, 'commutation, association and idempotence are rules, on by default', passes(on).join(' ‖ '));
        ev('setDeductiveRule(["commutation", "association", "idempotence", "distribution"], false); return 1;');
        const off = step(['Alice sings and Bob dances'], 'Bob dances and Alice sings');
        ok(!off.rule && /order or grouping/.test(off.why), 'off, "Alice sings and Bob dances" does not give "Bob dances and Alice sings" in one step, and the check says why', off.why);
        const long = [rule(['Alice sings and Bob dances'], 'Bob dances'), rule(['Alice sings and Bob dances'], 'Alice sings'), rule(['Bob dances', 'Alice sings'], 'Bob dances and Alice sings')];
        ok(J(long) === J(['conjunction elimination', 'conjunction elimination', 'conjunction introduction']), 'the long way: each part, then the two joined in the new order', J(long));
        defaults();
    }

    console.log('\n-- the basis alone: the derivations asked for --');
    {
        coreOnly();
        // ¬¬A from A: the rule instance "(A ∧ ¬A) → ⊥", exportation, modus
        // ponens, and then the derived "(¬A → ⊥) → ¬¬A" with modus ponens.
        const nn = [thm('(A ∧ ¬A) → ⊥'), rule(['(A ∧ ¬A) → ⊥'], 'A → (¬A → ⊥)'), rule(['A → (¬A → ⊥)', 'A'], '¬A → ⊥'),
            rule(['(¬A → ⊥) → ¬¬A', '¬A → ⊥'], '¬¬A')];
        ok(J(nn) === J(['Contradiction', 'exportation', 'modus ponens', 'modus ponens']) && thm('A → (¬A → ⊥)') === null && rule(['A'], '¬¬A') === null,
            '¬¬A from A: (A ∧ ¬A) → ⊥, a rule instance; exportation; modus ponens; then the derived "(¬A → ⊥) → ¬¬A" -- "A → (¬A → ⊥)" is no instance, and ¬¬A no one step', J(nn));
        defaults();
        ok(rule(['¬A → ⊥'], '¬¬A') === 'negation introduction' && rule(['¬A → ⊥'], 'A') === 'indirect proof' &&
            rule(['A → ¬A'], '¬A') === 'consequentia mirabilis' && rule(['A → B', 'A → ¬B'], '¬A') === 'reductio',
            'the three derived forms are named and on by default; the basis keeps the two-conditional reductio');
        const forms = [[['A → ⊥'], '¬A'], [['¬A → ⊥'], 'A'], [['A → ¬A'], '¬A']];
        ev('setDeductiveRule(["negation-introduction", "indirect-proof", "consequentia-mirabilis"], false); return 1;');
        ok(!refused(forms).length && rule(['A → B', 'A → ¬B'], '¬A') === 'reductio',
            'each switches off on its own, and reductio stays', refused(forms).join(' ‖ '));
        coreOnly();
        // ∃y B(y) from ∃x B(x): the closure of an existential introduction
        // instance, then existential elimination -- three lines.
        const ex = [thm('∀x (B(x) → ∃y B(y))'), rule(['∃x B(x)', '∀x (B(x) → ∃y B(y))'], '∃y B(y)')];
        const closedEx = ev('var r = logicalTheorem("∀x (B(x) → ∃y B(y))"); return !!(r && r.closure);');
        ok(J(ex) === J(['existential introduction', 'existential elimination']) && closedEx && rule(['∃x B(x)'], '∃y B(y)') === null,
            '∃y B(y) from ∃x B(x): the closure of the instance B(a) → ∃y B(y), then existential elimination (not one step)', J(ex));
        // What ∃ elimination takes, and what it refuses.
        const eeRefused = [[['∃x B(x)', '∀x (B(x) → C(x))'], 'C(x)'], [['∃x B(x)', '∃x (B(x) → (∃y B(y)))'], '∃y B(y)'],
            [['∃x B(x)', '∀x (C(x) → (∃y B(y)))'], '∃y B(y)']];
        ok(!refused(eeRefused).length && thm('((∃x B(x)) ∧ (∀x (B(x) → (∃y B(y))))) → (∃y B(y))') === 'existential elimination',
            'existential elimination needs the universal, with the variable gone from what follows; its rule instance is the conditional of the two premises',
            refused(eeRefused).join(' ‖ '));
        // The two ∃ forms it replaced are derivable, so they are extensions.
        const exForms = [[['∀x (F(x) → G(x))'], '(∃x F(x)) → (∃x G(x))'], [['∃x P'], 'P']];
        ok(!refused(exForms).length, 'with every extension off, quantifier distribution\'s ∃ form and the vacuous ∃ are gone from the basis', refused(exForms).join(' ‖ '));
        defaults();
        ok(rule(['∀x (F(x) → G(x))'], '(∃x F(x)) → (∃x G(x))') === 'quantifier distribution, anywhere' && rule(['∃x P'], 'P') === 'vacuous quantifier, anywhere',
            'on by default, both are still one step, by the "anywhere" rules');
        coreOnly();
        // The work of the rules that discharge a supposition, done by known rules.
        // Two conditions' consequents joined: "A → (X → R)" and "A → X" give
        // "A → R" by reductio, with no absorption (logic-r27-basis-proofs.js).
        const cp = [rule(['(P ∧ ¬R) → (P → R)'], '((P ∧ ¬R) ∧ P) → R'),
            rule(['((P ∧ ¬R) ∧ P) → R', '((P ∧ ¬R) ∧ P) → ¬R'], '¬((P ∧ ¬R) ∧ P)'),
            rule(['(P ∧ ¬R) → P', '(P ∧ ¬R) → ¬P'], '¬(P ∧ ¬R)'),
            rule(['P → (¬R → ⊥)', '(¬R → ⊥) → ¬¬R'], 'P → ¬¬R')];
        ok(J(cp) === J(['exportation', 'reductio', 'reductio', 'hypothetical syllogism']),
            'conditional proof\'s work without absorption: the steps of the reductio that joins "A → (X → R)" with "A → X"', J(cp));
        const HS = '((F(x) → G(x)) ∧ (G(x) → H(x))) → (F(x) → H(x))', XP = '(F(x) → G(x)) → ((G(x) → H(x)) → (F(x) → H(x)))';
        const ui = [thm('∀x (' + HS + ')'), thm('∀x ((' + HS + ') → (' + XP + '))'),
            rule(['∀x ((' + HS + ') → (' + XP + '))'], '(∀x (' + HS + ')) → (∀x (' + XP + '))'),
            rule(['(∀x (' + HS + ')) → (∀x (' + XP + '))', '∀x (' + HS + ')'], '∀x (' + XP + ')'),
            rule(['∀x (' + XP + ')'], '(∀x (F(x) → G(x))) → (∀x ((G(x) → H(x)) → (F(x) → H(x))))'),
            rule(['(∀x (F(x) → G(x))) → (∀x ((G(x) → H(x)) → (F(x) → H(x))))', '∀x (F(x) → G(x))'], '∀x ((G(x) → H(x)) → (F(x) → H(x)))'),
            rule(['∀x ((G(x) → H(x)) → (F(x) → H(x)))'], '(∀x (G(x) → H(x))) → (∀x (F(x) → H(x)))'),
            rule(['(∀x (G(x) → H(x))) → (∀x (F(x) → H(x)))', '∀x (G(x) → H(x))'], '∀x (F(x) → H(x))')];
        ok(J(ui) === J(['hypothetical syllogism', 'exportation', 'quantifier distribution', 'modus ponens', 'quantifier distribution', 'modus ponens', 'quantifier distribution', 'modus ponens']),
            'universal introduction\'s work: ∀x(F → G) and ∀x(G → H) give ∀x(F → H) by closures of instances (hypothetical syllogism, exportation), quantifier distribution and modus ponens', J(ui));
        // ∃x(F ∧ G) ⊢ ∃x F: the universal says of each thing that if it is F and
        // G then something is F -- two steps under ∀ -- and then ∃ elimination.
        const ee = [thm('∀x ((F(x) ∧ G(x)) → F(x))'), thm('∀x (F(x) → (∃y F(y)))'),
            thm('∀x (((((F(x) ∧ G(x)) → F(x)) ∧ (F(x) → (∃y F(y)))) → ((F(x) ∧ G(x)) → (∃y F(y)))))'),
            rule(['∃x (F(x) ∧ G(x))', '∀x ((F(x) ∧ G(x)) → (∃y F(y)))'], '∃y F(y)')];
        ok(J(ee) === J(['conjunction elimination', 'existential introduction', 'hypothetical syllogism', 'existential elimination']),
            'existential elimination\'s work: ∃x(F ∧ G) gives ∃y F from closures of a conjunction elimination, an existential introduction and a hypothetical syllogism instance', J(ee));
        ok(thm('(P → Q) → ((Q → R) → (P → R))') === null && thm('((P → Q) ∧ (Q → R)) → (P → R)') === 'hypothetical syllogism' && thm('(P → Q) → (P → Q)') === null,
            'a rule instance takes its premises as its antecedent: curried, "(P → Q) → ((Q → R) → (P → R))" is none; a restatement is none');
        // Absorption is derivable, doubling included: "(P ∧ P) → (P ∧ P)" is no
        // instance, but it is proved as "X → X", and exportation gives
        // "P → (P → (P ∧ P))"; the reductio above then gives "P → (P ∧ P)".
        ok(thm('(P ∧ P) → (P ∧ P)') === null && thm('P → (P ∧ P)') === null && rule(['P → Q'], 'P → (P ∧ Q)') === null,
            'with every extension off, neither "P → (P ∧ P)" nor a restatement is a rule instance, and absorption takes no step');
        const dupLines = (() => {
            const BP = require('./logic-r27-basis-proofs.js')(printN), proof = new BP.Proof(), top = new BP.Top(proof);
            BP.dup(top, { op: 'letter', name: 'P' });
            const names = proof.lines.map((ln, i) => ln.from === 'theorem' ? thm(printN(ln.f)) : rule(ln.from.map(k => printN(proof.lines[k].f)), printN(ln.f)));
            const bad = proof.lines.map((ln, i) => names[i] ? null : (i + 1) + '. ' + printN(ln.f)).filter(Boolean);
            return { lines: proof.lines.length, bad, absorbed: names.indexOf('absorption') >= 0 };
        })();
        ok(!dupLines.bad.length && dupLines.lines === 51 && !dupLines.absorbed,
            'absorption is derivable: "P → (P ∧ P)" in ' + dupLines.lines + ' lines from the basis alone, each certified, none of them absorption', J(dupLines.bad.slice(0, 2)));
        defaults();
        ok(rule(['P → Q'], 'P → (P ∧ Q)') === 'absorption' && rule(['P → P'], 'P → (P ∧ P)') === 'absorption',
            'on by default, absorption still takes its step in one line');
    }

    console.log('\n-- the steps added on 2026-09-23 --');
    {
        defaults();
        // The dilemma, told apart: one consequent is proof by cases, two are
        // the constructive dilemma proper.
        const dilemmas = [
            [['A ∨ B', 'A → C', 'B → C'], 'C', 'proof by cases'],
            [['A → B', 'C → D', 'A ∨ C'], 'B ∨ D', 'constructive dilemma'],
            [['A → B', 'C → D', '¬B ∨ ¬D'], '¬A ∨ ¬C', 'destructive dilemma']];
        ok(!passes(dilemmas).length, 'proof by cases and the constructive dilemma are two rules, named apart', passes(dilemmas).join(' ‖ '));
        // What the textbooks call these.
        const names = [[['¬¬A'], 'A', 'double-negation elimination'], [['A → B', '¬B'], '¬A', 'modus tollens']];
        ok(!passes(names).length, '¬¬A ⊢ A is double-negation elimination, not "negation elimination": that name belongs to deriving ⊥ from A and ¬A', passes(names).join(' ‖ '));
        // The replacements the list was missing.
        const swaps = [
            [['A ∨ (A ∧ B)'], 'A', 'Boolean absorption'],
            [['(A ∧ (A ∨ B)) ∨ C'], 'A ∨ C', 'Boolean absorption'],
            [['A ∨ ⊥'], 'A', '⊥ laws'],
            [['(A ∧ ¬A) ∨ B'], '⊥ ∨ B', '⊥ laws']];   // at the top, Contradiction claims it first
        ok(!passes(swaps).length, 'Boolean absorption and the ⊥ laws, at any depth', passes(swaps).join(' ‖ '));
        // The quantifier and identity steps the list was missing.
        ok(rule(['∀x F(x)'], '∃x F(x)') === 'subalternation' && !rule(['Every raven is black'], 'Some raven is black') &&
            rule(['a = b'], 'F(a) ↔ F(b)') === 'predicate congruence',
            'subalternation (unrestricted only) and predicate congruence');
        // Zero-premise shortcuts, off by default.
        ok(!thm('¬(P ∧ ¬P)') && !thm('P ∨ ¬P') && !thm('P → P'), 'the zero-premise shortcuts stay off by default');
        ev('setDeductiveRule(["instance-noncontradiction", "instance-excluded-middle", "instance-restatement"], true); return 1;');
        ok(thm('¬(P ∧ ¬P)') === 'noncontradiction' && thm('P ∨ ¬P') === 'excluded middle' && thm('P → P') === 'restatement',
            'switched on, noncontradiction joins excluded middle and restatement');
        defaults();
        // The catch-alls: off by default, and tried last when on.
        ok(!rule(['A → (B ∨ C)', '¬B', 'A'], 'C'), 'a truth-functional step with no name of its own is not certified by default');
        ev('setDeductiveRule(["tautological-consequence", "equivalence-replacement"], true); return 1;');
        const catchAll = [
            [['A → (B ∨ C)', '¬B', 'A'], 'C', 'tautological consequence'],
            [['(A ∨ B) ∧ (¬A ∨ C)'], 'B ∨ C', 'tautological consequence'],
            [['A → B', '¬B'], '¬A', 'modus tollens'],
            [['∀x (¬(F(x) ∧ G(x)))'], '∀x (¬F(x) ∨ ¬G(x))', 'De Morgan\u2019s laws']];
        ok(!passes(catchAll).length, 'with the catch-alls on, every truth-functional step certifies -- and a step with a name of its own keeps it', passes(catchAll).join(' ‖ '));
        const stillRefused = [[['A ∨ B'], 'A'], [['∃x F(x)'], 'F(a)'], [['∀x F(x)', 'F(a) → G(a)'], '∀x G(x)']];
        ok(!refused(stillRefused).length, 'and what is not truth-functionally valid is still refused', refused(stillRefused).join(' ‖ '));
        defaults();
    }

    console.log('\n-- pronouns, and what a rule instance follows --');
    {
        // A pronoun takes the one name its own claim gives, and the reading
        // says so; with two names it is left alone and flagged.
        // normalizeClaimText marks a proper name with U+E000; strip it here.
        const normed = t => ev('return normalizeClaimText(' + J(t) + ');').replace(/\uE000/g, '');
        ok(normed('When Mary exits the room, she learns a new fact') === 'when mary exits the room, mary learns a new fact' &&
            normed('Mary told Alice she was late') === 'mary told alice she was late' &&
            normed('She met Mary') === 'she met mary',
            'a pronoun takes the one name its own claim gives, and only where the name comes first');
        ok(ev('return claimNotes("When Mary exits the room, she learns a new fact").some(function (n) { return /read as/.test(n.message); });'),
            'the reading says what it made of the pronoun, so a wrong guess is visible');
        ok(rule(['Mary sings and she dances'], 'Mary dances') === 'conjunction elimination' &&
            step(['Mary told Alice she was late'], 'Alice was late').ambiguous,
            'so a step through a pronoun goes through, and two names stay ambiguous');
        // A denial may be written with or without a pair of negations while
        // double negation is on, which it is by default (r27.32).
        ok(thm('\u00ac(P \u2228 \u00acP) \u2192 (\u00acP \u2227 P)') === 'De Morgan\u2019s laws' && thm('\u00ac(P \u2228 \u00acP) \u2192 (\u00acP \u2227 \u00ac\u00acP)') === 'De Morgan\u2019s laws' &&
            thm('P \u2192 \u00ac\u00acP') === 'double-negation replacement' && !thm('\u00ac(P \u2228 \u00acP) \u2192 (P \u2227 \u00acP)'),
            'De Morgan writes a denial either way; the parts keep their order, so "P \u2227 \u00acP" is a commutation further on');
        ev('setDeductiveRule(["double-negation"], false); return 1;');
        ok(!thm('P \u2192 \u00ac\u00acP') && thm('\u00ac(P \u2228 \u00acP) \u2192 (\u00acP \u2227 P)') === 'De Morgan\u2019s laws',
            'switched off, no pair is added on its own -- though a rule\'s own result may still lose one, as it always could');
        defaults();
        // With double-negation replacement on, a conditional states a rule's
        // step up to pairs of negations (asked for 2026-09-23).
        ok(thm('¬¬(P ∧ Q) → P') === 'conjunction elimination' && thm('(P ∧ Q) → ¬¬P') === 'conjunction elimination' &&
            thm('((A → B) ∧ ¬¬A) → B') === 'modus ponens' && !thm('P → P'),
            'a pair of negations anywhere in a rule instance is that rule\'s business, and a restatement is still none');
        defaults();
        // A rule and then a replacement is two steps: one conditional states
        // them only with the extra instances switched on (asked for 2026-09-23).
        ok(!thm('¬(P ∨ ¬P) → (P ∧ ¬P)') && !thm('¬(P ∧ Q) → (¬Q ∨ ¬P)'),
            'by default the order of a list is content, so De Morgan alone does not state a commuted result');
        ev('setDeductiveRule(["instance-up-to-replacement"], true); return 1;');
        ok(thm('¬(P ∨ ¬P) → (P ∧ ¬P)') === 'De Morgan’s laws' &&
            thm('¬(P ∧ Q) → (¬Q ∨ ¬P)') === 'De Morgan’s laws' &&
            thm('((P ∧ Q) ∧ R) → (R ∧ (Q ∧ P))') === 'commutation',
            'switched on, the replacements that are on may be taken on the way');
        ok(ev('var r = logicalTheorem("¬(P ∨ ¬P) → (P ∧ ¬P)"); return /order or grouping/.test(r.explanation);'),
            'and the explanation says the order or grouping was changed');
        ok(!thm('(P ∨ Q) → (Q ∧ P)') && !thm('¬(P ∨ Q) → (¬P ∨ ¬Q)') && !thm('P → P'),
            'and nothing invalid follows, nor a restatement');
        ev('setDeductiveRule(["commutation"], false); return 1;');
        ok(!thm('¬(P ∨ ¬P) → (P ∧ ¬P)'),
            'with commutation off the order is content again, switch or no switch');
        defaults();
        ok(ev('var r = logicalTheorem("¬¬(P ∧ Q) → P"); return /pair of negations/.test(r.explanation);'),
            'and the explanation says a pair was taken out or put in');
        ev('setDeductiveRule(["double-negation"], false); return 1;');
        ok(!thm('¬¬(P ∧ Q) → P') && thm('(P ∧ Q) → P') === 'conjunction elimination',
            'switched off, the conditional must state the step exactly');
        defaults();
        // "Poe is Edgar" is an identity: "is" and a name, not a property.
        ok(rule(['Poe is Edgar', 'Poe is a raven'], 'Edgar is a raven') === 'identity substitution' &&
            rule(['Poe is Edgar'], 'Edgar is Poe') === 'identity symmetry' &&
            rule(['Poe is Edgar', 'Edgar is Lenore'], 'Poe is Lenore') === 'identity transitivity',
            'the identity rules reach "Poe is Edgar", not only "a = b"');
        ok(!rule(['Bob is Greek', 'Bob is a teacher'], 'Greek is a teacher') && !rule(['Poe is a raven'], 'A raven is Poe'),
            'a capitalized adjective is no name, and "is a raven" is no identity');
        ok(rule(['Every raven except Fido is black', 'Bob is a raven', 'Bob is not Fido'], 'Bob is black') === 'universal modus ponens',
            'and the exception machinery still matches "Bob is not Fido"');
        // Pronouns in object and possessive position, too.
        ok(normed('Mary studied color and her knowledge is complete') === "mary studied color and mary's knowledge is complete" &&
            normed('Poe wrote a poem and his raven is black') === "poe wrote a poem and poe's raven is black" &&
            normed('Lenore admired Poe and she praised him') === 'lenore admired poe and she praised him',
            '"him", "his" and "her" take the name too, and two names still stop it');
        ok(normed('Bob praised her') === 'bob praised her' && normed('Poe wrote a poem about her') === 'poe wrote a poem about her' &&
            normed('Mary left because the dog bit her') === 'mary left because the dog bit mary',
            'an object pronoun in the name\'s own clause is somebody else -- English would say "herself" -- but across a clause it is the name');
        ok(normed('Mary is tired. Her work is done') === "mary is tired. mary's work is done" && normed('Mary hurt herself') === 'mary hurt herself',
            'a capitalized pronoun is no second name, and "herself" is not "her"');
        ok(normed("Mary's car stalled and she ran") === "mary's car stalled and mary ran" &&
            normed('The storm hit Mary and then it hit her again') === 'the storm hit mary and then it hit mary again' &&
            normed('Mary and her sister left') === "mary and mary's sister left",
            'a possessive name is still that name, and an adverb after the pronoun ends the clause rather than being owned');
        ok(normed('Mary said he loves her') === 'mary said he loves her' &&
            normed('Poe wrote his poem and she read it') === 'poe wrote his poem and she read it' &&
            normed('He left and Mary arrived and she smiled') === 'he left and mary arrived and mary smiled',
            'two genders of pronoun are two people, so one name reads neither -- one gender still reads');
        ok(normed('Mary left and then she hurt her') === 'mary left and then mary hurt her' &&
            normed('Mary is a doctor and her patients trust her') === "mary is a doctor and mary's patients trust mary",
            'an object pronoun is measured from the last reading of the name, and a possessive is no such reading');
        ok(normed('Before she left, Mary called') === 'before mary left, mary called' &&
            normed('When she exits the room, Mary learns a new fact') === 'when mary exits the room, mary learns a new fact' &&
            normed('She met Mary') === 'she met mary',
            'a pronoun may come first in a clause that waits for its main one, and nowhere else');
        // Inside what somebody believes, says or knows, a pronoun reads as any
        // other (the user, 2026-09-28: "In 'Mary believes that she is late', if
        // that's all the content we have, then 'she' refers to 'Mary'").
        ok(normed('Mary believes that she is late') === 'mary believes that mary is late' &&
            normed('Mary said that the dog bit her') === 'mary said that the dog bit mary' &&
            normed('Mary knows that she is in the room') === 'mary knows that mary is in the room' &&
            ev('return claimSame(parseClaim("Mary believes that she is late"), parseClaim("Mary believes that Mary is late"));'),
            'a pronoun inside what somebody believes or says is the box\'s one name, as anywhere else, and the two claims are one');
        ok(ev('return claimNotes("Bob believes that it rains").length === 0 && claimNotes("Mary believes that she is late").some(function (n) { return /"she" is read as "Mary"/.test(n.message); });') &&
            normed('When Mary exits the room, she learns a new fact') === 'when mary exits the room, mary learns a new fact' &&
            normed('Mary knows her brother') === "mary knows mary's brother",
            'and the box says so, as it does outside one; an "it" of the weather there asks nothing');
        // "Just in case" is a biconditional here, and the box says so.
        ok(/if and only if/.test(ev('return (claimNotes("Bob runs just in case Mary runs")[0] || {}).message || "";')) &&
            ev('return claimNotes("Bob runs if and only if Mary runs").length;') === 0 &&
            rule(['Bob runs just in case Mary runs', 'Mary runs'], 'Bob runs') === 'biconditional elimination',
            '"just in case" is read as "if and only if", and the reading says so');
        // "Anyone" in the object's place is "everyone", unless denied or supposed.
        ok(rule(['Bob loves anyone', 'Mary is a person'], 'Bob loves Mary') === 'universal modus ponens' &&
            rule(['Bob loves everyone who sings', 'Mary is a person', 'Mary sings'], 'Bob loves Mary') === 'universal modus ponens' &&
            rule(['Bob loves anyone who sings', 'Mary is a person who sings'], 'Bob loves Mary') === 'universal modus ponens' &&
            rule(['Bob loves everything that sings', 'Fido sings'], 'Bob loves Fido') === 'universal modus ponens',
            'in the object\'s place, "anyone" is "everyone", and "everyone who sings" keeps its relative clause');
        ok(!rule(['Bob loves anyone'], 'Bob loves Mary') && !rule(['Bob loves everyone who sings', 'Mary is a person'], 'Bob loves Mary') &&
            !rule(['If Bob loves anyone, Bob is happy', 'Mary is a person'], 'Bob loves Mary') && !rule(['Bob loves anyone'], 'Bob loves someone'),
            'and it still needs the case, gives nothing from a condition, and has no existential import');
        ok(ev('return ["Bob loves anyone", "Bob loves anybody", "Bob helps anything", "Bob loves everybody"].every(function (t) { var f = parseClaim(t); return !f.folTree; });'),
            'a quantifier word is no name in a first-order tree');
        // Derive Parent reaches what the check certifies (r27.41).
        const derived = ts => { const d = ev('var d = deriveConclusion(' + J(ts) + '); return d ? [d.rule.name, d.text] : null;'); return d ? d.join(': ') : null; };
        ok(derived(['Every raven that sings is black', 'Fido is a raven', 'Fido sings']) === 'universal modus ponens: Fido is black' &&
            derived(['Every raven is black if it sings', 'Fido is a raven', 'Fido sings']) === 'universal modus ponens: Fido is black' &&
            derived(['If a raven sings, it is black', 'Fido is a raven', 'Fido sings']) === 'universal modus ponens: Fido is black' &&
            derived(['Every bird that is black or white is happy', 'Tweety is a bird', 'Tweety is black']) === 'universal modus ponens: Tweety is happy',
            'Derive Parent takes a case spread over several premises, a bound "it", and one alternative of a kind');
        ok(derived(['Bob runs if and only if Mary runs', 'Bob runs and Ann sings']) === 'substitution of equivalents: Mary runs and Ann sings' &&
            derived(['Dr. Jekyll is Mr. Hyde', 'Mr. Hyde commits crimes']) === 'identity substitution: Dr. Jekyll commits crimes' &&
            derived(['Only Bob runs']) === null,
            'it offers the substitution of equivalents, keeps a title\'s full stop, and derives nothing from an ambiguous box');
        // Part of a name an identity gives whole says so, in the map's own spelling.
        ok(/Did you mean \u2018Clark Kent\u2019 where it says \u2018Kent\u2019\? The identity is about Clark Kent; if Kent is someone else, it says nothing about them\./.test(step(['Clark Kent is Superman', 'Kent wears glasses'], 'Superman wears glasses').why) &&
            /Did you mean \u2018Dr\. Jekyll\u2019 where it says \u2018Jekyll\u2019\?/.test(step(['Dr. Jekyll is Mr. Hyde', 'Jekyll is a doctor'], 'Mr. Hyde is a doctor').why),
            'a step that uses part of a name an identity gives whole asks whether the whole name was meant, since it may be someone else');
        // A very long step still gets its check, but not the near-miss hints (r27.43).
        const longPremise = Array.from({ length: 110 }, (_, k) => 'Bob' + k + ' runs').join(' and ');
        ok(ev('return claimHintsAffordable(["x".repeat(1600)]) === false && claimHintsAffordable(["Bob runs"]) === true;') &&
            longPremise.length > 1500 && rule([longPremise], 'Bob7 runs') === 'conjunction elimination',
            'a step longer than the hint limit is still checked, and a valid one still certified');
        // A box with hundreds of parts is one claim, matched as written (r27.43).
        const hugeBox = Array.from({ length: 150 }, (_, k) => 'if P' + k + ' then Q' + k).join(' and ');
        const cnf40 = Array.from({ length: 40 }, (_, k) => '(P' + k + ' \u2228 \u00acQ' + k + ' \u2228 R' + k + ')').join(' \u2227 ');
        const chain = n => Array.from({ length: n }, (_, k) => 'if P' + k + ' then Q' + k).join(' and ');
        ok(ev('var f = parseClaim(' + J(hugeBox) + '); return f.kind === "atom" && claimNotes(' + J(hugeBox) + ').some(function (n) { return /too long for the check to take apart/.test(n.message); });') &&
            ev('var f = parseClaim(' + J(cnf40) + '); return f.kind !== "atom" && claimFormSize(f, 1000) < CLAIM_PARTS_LIMIT;'),
            'a box with hundreds of parts is read as one claim, and says so; a forty-clause formula is still taken apart');
        ok(ev('var f = parseClaim(' + J(chain(12)) + '); return f.kind === "and" && f.parts.length === 12 && f.parts.every(function (p) { return p.kind === "if"; });') &&
            ev('var f = parseClaim(' + J(chain(40)) + '); return f.kind === "and" && f.parts.length === 40;') &&
            ev('var t = ' + J(chain(150)) + '; return claimRestatement([parseClaim(t)], [parseClaim(t)]);'),
            'conditionals side by side are read part by part, however many; a box too long to take apart is still the same claim as itself');
        ok(key('If it rains, then the ground is wet, and if it snows, then the roads are icy, and if it hails, then the crops fail') ===
            key('(if it rains, then the ground is wet) and (if it snows, then the roads are icy) and (if it hails, then the crops fail)'),
            'three conditionals joined by "and" are three conditionals (the third was read into the first)');

        // Biconditionals, read with their scope (r27.43).
        const flagged = t => ev('return parseClaim(' + J(t) + ').kind === "atom" && claimNotes(' + J(t) + ').some(function (n) { return n.kind === "ambiguous"; });');
        ok(fol('P iff Q, and Q iff R') === '((p \u2194 q) \u2227 (q \u2194 r))' &&
            fol('Bob sings iff Mary dances, Mary dances iff Ann runs, and Ann runs iff Bob sings').split('\u2194').length === 4,
            'biconditionals side by side are each read (P iff Q, and Q iff R was P iff ((Q and Q) iff R))');
        ok(rule(['P iff Q, and Q iff R', 'not Q', 'not R'], 'P') === null,
            'from "P iff Q, and Q iff R", not-Q and not-R, P is not certified');
        ok(fol('P iff (Q iff R)') === '(p \u2194 (q \u2194 r))' && fol('(P iff Q) iff R') === '((p \u2194 q) \u2194 r)',
            'brackets group a biconditional on either side');
        ok(fol('if P iff Q, then R') === '((p \u2194 q) \u2192 r)' && fol('If and only if Mary dances, Bob sings') === fol('Bob sings iff Mary dances'),
            'a biconditional inside a condition is the condition; "if and only if P, Q" is "Q if and only if P"');
        ok(flagged('P iff Q iff R') && flagged('if P, then Q iff R') && flagged('Necessarily, Bob sings iff Mary dances') &&
            flagged('Bob believes that Mary sings iff Ann dances') && flagged('Bob sings iff Mary dances, and Ann runs') &&
            flagged('Bob sings, and Mary dances iff Ann runs') && flagged('Bob sings iff Mary dances if Ann runs') &&
            flagged('Bob sings iff Mary dances unless Ann runs'),
            'a run of "iff", a condition, "necessarily" or a belief in front, a comma "and", or an "if" beside it: flagged, each reading offered');
        ok(ev('var t = "P iff Q iff R", r = parseClaimFull(t).notes.filter(function (n) { return n.kind === "ambiguous"; })[0];' +
                'var a = parseClaim(t, { site: r.site, reading: 0 }), b = parseClaim(t, { site: r.site, reading: 1 });' +
                'return claimKey(a) === claimKey(parseClaim("P iff Q, and Q iff R")) && claimKey(b) === claimKey(parseClaim("P iff (Q iff R)"));'),
            'the readings of a run: each equivalent to the next, or grouped');
        ok(fol('It is not the case that P iff Q') === '(\u00acp \u2194 q)' && fol('Bob sings iff Mary dances and Ann runs').indexOf('\u2227') > 0,
            'a denial in front is not flagged (both readings say the same); "and" without a comma stays inside');
        const run32 = Array.from({ length: 32 }, (_, k) => 'P' + k).join(' iff ');
        ok(ev('var t0 = Date.now(), r = parseClaimFull(' + J(run32) + '), s = r.notes.filter(function (n) { return n.kind === "ambiguous"; })[0];' +
                'var g = parseClaimFull(' + J(run32) + ', { site: s.site, reading: 1 });' +
                'return r.form.kind === "atom" && g.form.kind === "atom" && g.notes.some(function (n) { return /too long/.test(n.message); }) && Date.now() - t0 < 5000;'),
            'a run of thirty-two "iff"s is flagged at once, and its grouped reading -- which doubles at each "iff" -- is refused as too long');
        ok(ev('var t = "P iff Q because R"; return parseClaim(t).kind === "atom" && claimNotes(t).some(function (n) { return /because/.test(n.message); });') &&
            ev('var t = "if Bob sings, then Mary dances because Ann runs"; return parseClaim(t).kind === "atom";') &&
            ev('var t = "if Poe is black, so is Fido"; return claimNotes(t).some(function (n) { return /cut short/.test(n.message); });'),
            '"because" makes the whole sentence one claim, not only the part it is in; "so is" is still a clause cut short');

        // Brackets group, in English as in symbols (r27.43): a group is one
        // claim, and no connective is found inside it.
        ok(fol('(Bob sings) and (Mary dances)') === fol('Bob sings and Mary dances') &&
            fol('if Bob sings, then (Mary dances and Ann runs)') === fol('if Bob sings, then Mary dances and Ann runs') &&
            fol('(P or Q) and R') === '((p \u2228 q) \u2227 r)' && fol('P and (Q or R)') === '(p \u2227 (q \u2228 r))' &&
            fol('either (P and Q) or R') === '((p \u2227 q) \u2228 r)' && fol('(if P, then Q), and R') === '((p \u2192 q) \u2227 r)' &&
            fol('\u201cBob sings\u201d or \u201cMary dances\u201d') === fol('Bob sings or Mary dances'),
            'a bracketed part is one claim: "(P or Q) and R", "if P, then (Q and R)", "either (P and Q) or R", quoted clauses');
        ok(fol('(P) and (God exists if and only if God exists)') !== null && fol('it is not the case that (if P, then Q)') === '\u00ac(p \u2192 q)' &&
            ev('return !claimNotes("it is not the case that (if P, then Q)").some(function (n) { return n.kind === "ambiguous"; });'),
            'no connective is found inside a bracket; a denial of a bracketed conditional is not flagged');
        ok(key('(if it rains, then the ground is wet) and (if it snows, then the roads are icy) and (if it hails, then the crops fail)') ===
            key('If it rains, then the ground is wet, and if it snows, then the roads are icy, and if it hails, then the crops fail'),
            'bracketed conditionals joined by "and" are the conditionals joined');
        // A "not" and a quantifier in different clauses are no scope question.
        ok(fol('Poe is not white and each raven is white').indexOf('\u2227') > 0 &&
            ev('return !claimNotes("Either it is not the case that each owl is white or Rex is white").some(function (n) { return n.kind === "ambiguous"; });') &&
            fol('Either there is a crow that is not black or everything is an owl').indexOf('\u2228') > 0 &&
            ev('return claimNotes("Poe does not love each raven").some(function (n) { return n.kind === "ambiguous"; });') &&
            fol('Either Fido does not think or no owl is black').indexOf('∨') > 0,
            'a scope flag stays in its clause; "or everything is an owl" is a claim of its own, not more of a "that"');
        ok(rule(['Either it rains or it snows', 'If it rains, then the ground is wet', 'If it snows, then the ground is wet'], 'Either the ground is wet or the ground is wet') === 'constructive dilemma' &&
            rule(['Either God does not exist or Fido is black', 'If it rains, then God exists', 'If it rains, then Fido is not black'], 'Either it does not rain or it does not rain') === 'destructive dilemma' &&
            rule(['Either God does not exist or Fido is black', 'If it rains, then God exists', 'If it rains, then Fido is not black'], 'It does not rain') === 'destructive dilemma',
            'the dilemmas give their literal instances where parts repeat, and the single claim too');
        // Every flagged reading can be written into its box, in plain words.
        const flaggedTexts = ['If Bob sings, then Mary dances, and Ann runs', 'Bob sings iff Mary dances iff Ann runs', 'If Bob sings, then Mary dances iff Ann runs',
            'Necessarily, Bob sings iff Mary dances', 'Bob believes that Mary sings iff Ann dances', 'Bob sings iff Mary dances, and Ann runs',
            'Bob sings iff Mary dances if Ann runs', 'It is not the case that Bob sings and Mary dances', 'Poe does not love each raven', 'Poe does not love a raven',
            'Bob does not think that it rains', 'Only Bob runs', 'Even if it rains, the match goes on', 'Bob sings and Mary dances or Ann runs'];
        ok(ev('var bad = []; ' + J(flaggedTexts) + '.forEach(function (t) { parseClaimFull(t).notes.filter(function (n) { return n.kind === "ambiguous"; }).forEach(function (n) {' +
                'n.readings.forEach(function (label, i) { var w = claimReadingWords(label, t); if (/\uE000/.test(w) || !claimReadingRoundTrips({ text: t, site: n.site }, i, w)) bad.push(t + " / " + w); }); }); });' +
                'return bad.length === 0 || bad;'),
            'each reading the chooser offers can be written into the box, and reads back as that reading');

        // Inference words in a box are flagged, and no step with one is certified (r27.44).
        const flagOf = t => ev('var f = claimInferenceFlag(' + J(t) + '); return f ? f.kind + ":" + f.word : null;');
        const tagOf = (ps, c) => ev('var trees = [{ id: "M", type: "contention", texts: [' + J(c) + '], collapsed: [], children: [{ id: "S", type: "support", texts: ' + J(ps) + ', collapsed: [], children: [] }] }];' +
            'var st = collectDeductiveSteps(trees)[0]; return { rule: st.rule ? st.rule.name : null, tag: deductiveStepTagText(st), why: st.why ? st.why.text : "" };');
        ok(flagOf('The ground is wet because it rains') === 'reason:because' && flagOf('Since the soul is simple, it is indestructible') === 'reason:since' &&
            flagOf('It rains, so the ground is wet') === 'inference:so' && flagOf('It rains; therefore the ground is wet') === 'inference:therefore' &&
            flagOf('Therefore, the soul is immortal') === 'marker:therefore' && flagOf('The soul is therefore immortal') === 'marker:therefore' &&
            flagOf('It follows that the soul is immortal') === 'marker:it follows that' && flagOf('Hence God exists') === 'marker:hence' && flagOf('P \u2234 Q') === 'inference:\u2234',
            '"because", "since", "so", "therefore", "hence", "it follows that", "\u2234" are flagged: a reason inside, a whole inference, or a claim that says it was inferred');
        ok(flagOf('Bob has lived here since 1990') === null && flagOf('The argument "P because Q" is invalid') === null && flagOf('So long as it rains, the ground is wet') === null &&
            flagOf('If Poe is black, so is Fido') === null && flagOf('It is not warranted to conclude that God exists') === null && flagOf('Bob ran so that he would win') === null &&
            flagOf('Thus far, nothing is known') === null && flagOf('Bob acted accordingly') === null,
            'not flagged: "since" of time, quoted words, "so long as", "so is", a weak objection\'s "to conclude", "so that", "thus far", "accordingly" of manner');
        const t1 = tagOf(['Bob sings', 'Mary dances'], 'Therefore, Bob sings'), t2 = tagOf(['Bob sings because Mary dances'], 'Bob sings');
        ok(t1.rule === null && t1.tag === '\u2717 \u201ctherefore\u201d in a box' && /Leave it out/.test(t1.why) &&
            t2.rule === null && /put \u201cMary dances\u201d in a box of its own under \u201cBob sings\u201d/.test(t2.why),
            'a step with such a box is not certified: its tag names the word, and says how to split the box or that the word should go');
        ok(ev('return logicalTheorem("Therefore, if P and Q, then P") === null && !!logicalTheorem("If P and Q, then P");'),
            'a box with an inference word is no theorem');

        // Numbered lists (r27.44): where the numbering begins, one list, each item one claim.
        ok(fol('S knows that p iff (1) S believes that p, (2) p is true, and (3) S is justified') === null &&
            fol('(S knows that p) iff (1) S believes that p, (2) p is true, and (3) S is justified').split('\u2227').length === 3 &&
            fol('If Bob sings, then (1) Mary dances, (2) Ann runs, and (3) Tom walks') === fol('If Bob sings, then Mary dances and Ann runs and Tom walks') &&
            key('(1) If Bob sings, then Mary dances, (2) Ann runs, and (3) Tom walks') === key('(If Bob sings, then Mary dances) and (Ann runs) and (Tom walks)') &&
            fol('If (1) Bob sings, (2) Mary dances, and (3) Ann runs, then Tom walks') === fol('If Bob sings and Mary dances and Ann runs, then Tom walks') &&
            fol('Bob sings iff (i) Mary dances, (ii) Ann runs, or (iii) Tom walks') === fol('Bob sings iff Mary dances or Ann runs or Tom walks') &&
            fol('(a) Bob sings and (b) Mary dances') === fol('Bob sings and Mary dances'),
            'a numbered list is one list where its numbering begins: after "iff", after "then", as the whole box, or as a condition ending at "then"; (i) and (a) number too');
        ok(ev('var t = "(1) and (2) entail (3)"; return parseClaim(t).kind === "atom" && claimNotes(t).some(function (n) { return /refer to other claims/.test(n.message); });') &&
            ev('return parseClaim("Premise (1) is false").kind === "atom";'),
            'numbers in brackets that make no list refer to other claims: one claim, noted (it had given "(2) entail (3)")');
        ok(ev('var t = "If Bob sings, then Mary dances, Ann runs, and Tom walks", n = parseClaimFull(t).notes.filter(function (x) { return x.kind === "ambiguous"; })[0];' +
                'return n.readings.length === 3 && n.readings.every(function (l, i) { var w = claimReadingWords(l, t); return /\(1\)/.test(w) && claimReadingRoundTrips({ text: t, site: n.site }, i, w); });') &&
            ev('var t = "S knows that p iff S believes that p, p is true, and S is justified", n = parseClaimFull(t).notes.filter(function (x) { return x.kind === "ambiguous"; })[0];' +
                'return n.readings.length === 4 && n.readings.every(function (l, i) { return claimReadingRoundTrips({ text: t, site: n.site }, i, claimReadingWords(l, t)); });'),
            'a list of three after "then" or "iff" stays flagged, its readings numbered; "S knows that p iff ..." is settled in one choice');

        // "Both ... and", "either ... or", "neither ... nor" group, as brackets do (r27.45).
        ok(fol('Bob sings, and both Mary dances and Ann runs') === fol('Bob sings and (Mary dances and Ann runs)') &&
            fol('Either Bob sings or Mary dances, and Ann runs') === fol('(Bob sings or Mary dances) and Ann runs') &&
            fol('Neither Bob sings nor Mary dances, and Ann runs').indexOf('\u2227 nl_prop_~run(ann))') > 0 &&
            fol('Bob sings and either Mary dances or Ann runs') === fol('Bob sings and (Mary dances or Ann runs)') &&
            fol('Tom walks if both Bob sings and Mary dances') === fol('If Bob sings and Mary dances, then Tom walks') &&
            fol('Either Fido is neither wise nor black or the ground is wet') === fol('(Fido is neither wise nor black) or the ground is wet') &&
            fol('Bob loves both Mary and Ann, and Tom sings').indexOf('nl_prop_~sing(tom)') > 0,
            'a "both", "either" or "neither" holds its own group: "A, and both B and C"; "either A or B, and C"; "A and either B or C" is not flagged');
        const readingsOf = t => ev('var r = parseClaimFull(' + J(t) + ').notes.filter(function (n) { return n.kind === "ambiguous"; })[0];' +
            'return r ? r.readings.map(function (l) { return claimReadingWords(l, ' + J(t) + '); }) : [];');
        ok(readingsOf('If Bob sings, then Mary dances, Ann runs, and Tom walks')[2] === '(1) If Bob sings, then both Mary dances and Ann runs, and (2) Tom walks' &&
            readingsOf('Bob sings and Mary dances or Ann runs').join(' | ') === 'Both Bob sings and Mary dances, or Ann runs | Bob sings, and either Mary dances or Ann runs' &&
            readingsOf('Poe is not black or white').join(' | ') === 'Poe is not either black or white | Poe is either not black or white' &&
            readingsOf('If Bob sings, then Mary dances, and Ann runs').join(' | ') === 'If Bob sings, then both Mary dances and Ann runs | (1) If Bob sings, then Mary dances, and (2) Ann runs',
            'the chooser writes its readings with "both", "either" and numbering, not brackets, where English can');

        // Conditions together, and the premises that give them (r27.45).
        ok(rule(['Imagination is a non-physical event', 'Imaginary objects can cause people to feel fear',
                'If imaginary objects can cause people to feel fear and imagination is a non-physical event, then non-physical events can cause people to feel fear.'],
                'Non-physical events can cause people to feel fear') === 'modus ponens, conditions together' &&
            rule(['Poe is small and black', 'Fido sings', 'If Poe is black and small and Fido sings, then Rex flies'], 'Rex flies') === null,
            'a premise that the reader takes as two claims ("a non-physical event") gives its run of the conditions; in another order it does not');
        const tA = "Poe isn't overdetermined", tB = 'Poe has a physical cause', tC = 'Mary causes the effect', tD = 'Mary is physical';
        const low = t => t.charAt(0).toLowerCase() + t.slice(1);
        ok(['If ' + low(tA) + ' and ' + low(tB) + ' and ' + low(tC) + ', then ' + low(tD),
            'If ' + low(tA) + ', and if ' + low(tB) + ', and if ' + low(tC) + ', then ' + low(tD),
            'If ' + low(tA) + ', ' + low(tB) + ', and ' + low(tC) + ', then ' + low(tD)].every(k => rule([tC, tB, tA, k], tD) === 'modus ponens, conditions together') &&
            fol('Mary dances, Ann runs, Tom walks, and Sue swims').split('\u2227').length === 4,
            '"if A and B and C", "if A, and if B, and if C", "if A, B, and C" are one condition list');

        // "Given that": a reason or a condition, flagged (r27.45).
        ok(readingsOf('Given that Bob sings, Mary dances').join(' | ') === 'Because Bob sings, Mary dances | If Bob sings, then Mary dances' &&
            readingsOf('Mary dances given that Bob sings').join(' | ') === 'Mary dances because Bob sings | Mary dances if Bob sings' &&
            ev('var t = "Given that Bob sings, Mary dances", n = parseClaimFull(t).notes.filter(function (x) { return x.kind === "ambiguous"; })[0];' +
                'return n.always && n.readings.every(function (l, i) { return claimReadingRoundTrips({ text: t, site: n.site }, i, claimReadingWords(l, t)); });'),
            '"given that" is flagged, and offers "because" and "if"');

        // A letter after a plural is a shorthand for it (r27.45).
        ok(key('Physical effects E are fully caused by purely physical events') === key('Physical effects are fully caused by purely physical events') &&
            ev('return claimNotes("Physical effects E are fully caused by purely physical events").some(function (n) { return /shorthand/.test(n.message); });') &&
            rule(['All physical effects are fully caused by purely physical events', 'Physical effects E is a physical effect'], 'Physical effects E are fully caused by purely physical events') === null &&
            key('Bob sees E') !== key('Bob sees') && key('The mind causes E') !== key('The mind causes') && /\ba and b\b/i.test(key('The students A and B are tall').replace(//g, '')),
            '"physical effects E" is about physical effects, not one thing called that: no universal modus ponens with an empty premise; "Bob sees E" keeps its E');
        ok(ev('return claimSayPart(parseClaim("The ravens are ravens"), ["The ravens are ravens"]) === "The ravens are ravens" && claimSayPart(parseClaim("Poe is a raven"), ["Poe is a raven"]) === "Poe is a raven";'),
            'the checker words a plural case in the plural ("The ravens are ravens"), a singular one in the singular');
        ok(ev('var b = document.getElementById("eval-logic-fold"); var t0 = b.title; toggleLogicPanelFold(); var t1 = b.title, f = document.getElementById("eval-logic").classList.contains("folded"); toggleLogicPanelFold();' +
                'return /Collapse/.test(t0) && /Expand/.test(t1) && f;'),
            'the Logic panel folds from a button that says so');
        // A pronoun the quantifier binds (asked for 2026-09-23).
        ok(rule(['Every raven is black if it sings', 'Fido is a raven', 'Fido sings'], 'Fido is black') === 'universal modus ponens' &&
            rule(['Every raven that sings is black', 'Fido is a raven', 'Fido sings'], 'Fido is black') === 'universal modus ponens' &&
            rule(['Everything is black if it is a raven', 'Fido is a raven'], 'Fido is black') === 'universal modus ponens' &&
            rule(['No raven is black if it sings', 'Fido is a raven', 'Fido sings'], 'Fido is not black') === 'universal modus ponens',
            'a pronoun the quantifier binds is read as what it speaks of, in either clause');
        ok(step(['Every raven is black if it sings'], 'Every raven that sings is black').restates === true,
            'and says what the relative clause says (so the one only restates the other)');
        ok(!rule(['Every raven is black if it rains', 'Fido is a raven', 'Fido sings'], 'Fido is black') &&
            !rule(['Some raven is black if it sings', 'Fido is a raven', 'Fido sings'], 'Fido is black') &&
            !rule(['If every raven sings, it is black', 'Fido is a raven', 'Fido sings'], 'Fido is black'),
            'not the "it" of "it rains", not "some", and not a whole claim in the condition');
        // A restrictor that offers alternatives.
        ok(rule(['Every bird that is black or white is happy', 'Tweety is a bird', 'Tweety is black or white'], 'Tweety is happy') === 'universal modus ponens' &&
            rule(['Every bird that sings or dances is happy', 'Tweety is a bird', 'Tweety sings or dances'], 'Tweety is happy') === 'universal modus ponens',
            'a relative clause may offer alternatives, of an adjective as of a verb');
        // One alternative is enough, as each part of a list is (asked for 2026-09-23).
        ok(rule(['Every bird that is black or white is happy', 'Tweety is a bird', 'Tweety is black'], 'Tweety is happy') === 'universal modus ponens' &&
            rule(['Every bird that is black or white is happy', 'Tweety is a bird and Tweety is white'], 'Tweety is happy') === 'universal modus ponens' &&
            rule(['Everything that is black or white is happy', 'Fido is black'], 'Fido is happy') === 'universal modus ponens',
            'one alternative of the kind shows a thing to be of it, as each part of a list does');
        ok(!rule(['Every bird that is black or white is happy', 'Tweety is a bird', 'Tweety is red'], 'Tweety is happy'),
            'but an alternative the kind does not offer shows nothing');
        // A universal short of its case says what is missing.
        ok(/once it is shown that \u2018Tweety is a bird\u2019/.test(step(['Every bird that is black or white is happy', 'Tweety is black'], 'Tweety is happy').why) &&
            /once it is shown that \u2018Fido sings\u2019/.test(step(['Every raven is black if it sings', 'Fido is a raven'], 'Fido is black').why) &&
            /once it is shown that \u2018Tweety is black or white\u2019/.test(step(['Every bird that is black or white is happy', 'Tweety is a bird', 'Tweety is red'], 'Tweety is happy').why),
            'a universal short of its case says, in English, what the case still needs');
        // "Only Bob runs" and "even if": flagged, and each reading offered.
        const onlyWhy = step(['Only Bob runs'], 'Bob runs');
        ok(!onlyWhy.rule && onlyWhy.ambiguous && /Read as \u201cBob runs, and everything that runs is Bob\u201d, the step follows by conjunction elimination/.test(onlyWhy.why) &&
            /Read as \u201ceverything that runs is Bob\u201d, the step follows by universal modus ponens/.test(step(['Only Bob runs', 'Mary runs'], 'Mary is Bob').why),
            '"only Bob runs" is ambiguous, and the reading each step needs is named');
        const evenWhy = step(['Even if Mary runs, Bob runs'], 'Bob runs');
        ok(!evenWhy.rule && evenWhy.ambiguous && /Read as \u201cBob runs, and if Mary runs, then Bob runs\u201d, the step follows by conjunction elimination/.test(evenWhy.why) &&
            /Read as \u201cif Mary runs, then Bob runs\u201d, the step follows by modus ponens/.test(step(['Bob runs even if Mary runs', 'Mary runs'], 'Bob runs').why),
            '"even if" is ambiguous in either order, and the reading each step needs is named');
        // A premised equivalence lets either side stand for the other.
        ok(rule(['P ↔ Q', 'P ∧ R'], 'Q ∧ R') === 'substitution of equivalents' &&
            rule(['P ↔ Q', 'R → P'], 'R → Q') === 'substitution of equivalents' &&
            rule(['Fido is black if and only if Fido sings', 'Fido is black and Fido is a raven'], 'Fido sings and Fido is a raven') === 'substitution of equivalents',
            'a biconditional lets either side stand for the other inside another claim');
        ok(!rule(['P ↔ Q', 'Bob believes that P'], 'Bob believes that Q') &&
            !rule(['Ada is Bea', 'Ada might be tall'], 'Bea might be tall'),
            'but not inside what somebody believes, nor what is merely possible of a thing');
        ok(ev('return claimNotes("If Mary runs, then she wins and her time is good")[0].message;').indexOf('are read as') > 0,
            'and the note says "are" of two pronouns');

        defaults();

        defaults();
        // A claim the reader leaves whole is matched as written, so a pronoun
        // inside it settles nothing and is not flagged (reported 2026-09-23:
        // the knowledge-argument map would not verify because of "she").
        const mary = ['While in the room, Mary has acquired all the physical facts there are about color sensations, including the sensation of seeing red.',
            'When Mary exits the room and sees a ripe red tomato, she learns a new fact about the sensation of seeing red.',
            'If, while in the room, Mary has acquired all the physical facts there are about color sensations, including the sensation of seeing red, and if, when Mary exits the room and sees a ripe red tomato, she learns a new fact about the sensation of seeing red, then there are non-physical facts about color sensations.'];
        const maryStep = step(mary, 'There are non-physical facts about color sensations.');
        ok(maryStep.rule === 'modus ponens, conditions together' && !maryStep.ambiguous,
            'a pronoun inside a claim the reader leaves whole no longer makes the step ambiguous', J(maryStep));
        ok(step(['She is happy'], 'Mary is happy').ambiguous && !rule(['Mary is happy'], 'She is happy'),
            'a pronoun the reading depends on -- the subject of a predication -- is still flagged');
        // A conditional that states any switched-on rule's step needs no
        // support; switch the rule off and it does.
        ok(thm('¬(P ∨ ¬P) → (¬P ∧ ¬¬P)') === 'De Morgan’s laws' && thm('((P ∨ Q) ∧ ¬P) → Q') === 'disjunctive syllogism' &&
            thm('(P → Q) → (P → (P ∧ Q))') === 'absorption',
            'a rule instance follows the rules that are on, not the core ones only');
        ev('setDeductiveRule(["de-morgan"], false); return 1;');
        ok(!thm('¬(P ∨ ¬P) → (¬P ∧ ¬¬P)'), 'with De Morgan off, its conditional needs support again');
        defaults();
        ok(!thm('P → P') && !thm('(P ∧ Q) → (P ∧ Q)') && !thm('¬(P ∨ ¬P) → (P ∧ ¬P)'),
            'a restatement still applies no rule, and three rules at once is no instance');
        ev('setDeductiveRule(["tautological-consequence"], true); return 1;');
        ok(!thm('P → P'), 'tautological consequence licenses no rule instance: every tautology would need no support');
        defaults();
    }

    console.log('\n-- rules inside quantifiers, and distribution one way --');
    {
        const lifted = [
            [['Some raven is black'], 'Something is black', 'conjunction elimination under ∃'],
            [['Every raven is black', 'Every raven is old'], 'Every raven is black and old', 'conjunction introduction under ∀'],
            [['Every raven is a black bird'], 'Every raven is black', 'conjunction elimination under ∀'],
            [['Some raven is black'], 'Some raven is black or white', 'disjunction introduction under ∃'],
            [['Some philosopher is wise', 'Every philosopher is a person'], 'Some person is wise', 'conjunction introduction under ∃'],
            [['Everything is black'], 'Everything is a non-raven or black', 'disjunction introduction under ∀'],
            [['Everything is a non-raven or black'], 'Every raven is black', 'material implication under ∀']];
        ok(!passes(lifted).length, 'English claims: a rule applied to what a quantifier says', passes(lifted).join(' ‖ '));
        ev('setDeductiveRule(["under-quantifier"], false); return 1;');
        ok(!refused(lifted.slice(0, 2)).length, 'with the rules inside quantifiers off, not in one step', refused(lifted.slice(0, 2)).join(' ‖ '));
        defaults();
        const dist = [
            [['∀x (F(x) → G(x))'], '(∀x F(x)) → (∀x G(x))', 'quantifier distribution'],
            [['∀x (F(x) → G(x))'], '(∃x F(x)) → (∃x G(x))', 'quantifier distribution, anywhere']];
        const back = [[['(∀x F(x)) → (∀x G(x))'], '∀x (F(x) → G(x))'], [['(∃x F(x)) → (∃x G(x))'], '∀x (F(x) → G(x))']];
        ok(!passes(dist).length && !refused(back).length, 'quantifier distribution one way, not back', passes(dist).concat(refused(back)).join(' ‖ '));
        // A kind carries no existential import: "every raven is black" is
        // "∀x (raven x → black x)" and "some raven is black" is
        // "∃x (raven x ∧ black x)". Unrestricted, it does: the domain is not
        // empty, which is subalternation, a familiar step.
        const noImport = [[['Everyone loves Fido'], 'Someone loves Fido'], [['Every raven is black'], 'Some raven is black']];
        ok(!refused(noImport).length,
            'no existential import for a kind: "all people are P" is "∀x (person(x) → P(x))", so "Everyone loves Fido" gives no "Someone loves Fido"',
            refused(noImport).join(' ‖ '));
        ok(rule(['∀x F(x)'], '∃x F(x)') === 'subalternation' && rule(['Everything is black'], 'Something is black') === 'subalternation',
            'unrestricted, it does: "∀x A" gives "∃x A", since the domain is not empty');
        coreOnly();
        const imp = [thm('(∀x F(x)) → F(a)'), thm('F(a) → (∃x F(x))'), rule(['(∀x F(x)) → F(a)', 'F(a) → (∃x F(x))'], '(∀x F(x)) → (∃x F(x))'),
            rule(['(∀x F(x)) → (∃x F(x))', '∀x F(x)'], '∃x F(x)')];
        ok(J(imp) === J(['Q1', 'existential introduction', 'hypothetical syllogism', 'modus ponens']),
            '"∀x F(x)" gives "∃x F(x)" the standard way, through a name: universal elimination, existential introduction -- four lines, not one step', J(imp));
        defaults();
    }

    console.log('\n-- exceptions, denials in the object, persons, scope --');
    {
        const good = [
            [['Every raven except Fido is black', 'Bob is a raven', 'Bob is not Fido'], 'Bob is black', 'universal modus ponens'],
            [['Every raven except Fido is black', 'Bob is a raven and Bob is not Fido'], 'Bob is black', 'universal modus ponens'],
            [['Everyone except Fido sings', 'Bob is a person', 'Bob is not Fido'], 'Bob sings', 'universal modus ponens'],
            [['Every raven that Poe loves is black', 'Fido is a raven', 'Poe loves Fido'], 'Fido is black', 'universal modus ponens'],
            [['Poe does not love every raven'], 'There is a raven that Poe does not love', 'quantifier negation'],
            [['There is a raven that Poe does not love'], 'Poe does not love every raven', 'quantifier negation'],
            [['Poe loves no raven'], 'There is no raven that Poe loves', 'quantifier negation'],
            [['Every person that sings is happy', 'Fido is a person', 'Fido sings'], 'Fido is happy', 'universal modus ponens'],
            [['All who sing are happy', 'Mary is a person', 'Mary sings'], 'Mary is happy', 'universal modus ponens'],
            [['It is not the case that both it rains and it snows'], 'It does not rain or it does not snow', 'De Morgan’s laws'],
            [['It is not the case that either it rains or it snows'], 'It does not rain and it does not snow', 'De Morgan’s laws'],
            [['Poe does not love a single raven', 'Fido is a raven'], 'Poe does not love Fido', 'universal modus ponens'],
            [['Every bird that sings or dances is happy', 'Fido is a bird', 'Fido sings or dances'], 'Fido is happy', 'universal modus ponens']];
        ok(!passes(good).length, 'exceptions by name, object relatives and object quantifier negation, persons, scope marked by "both" and "either"', passes(good).join(' ‖ '));
        const noStep = [
            [['Every raven except Fido is black', 'Bob is a raven'], 'Bob is black'],
            [['Every person that sings is happy', 'Fido sings'], 'Fido is happy'],
            [['All who sing are happy', 'Mary sings'], 'Mary is happy']];
        ok(!refused(noStep).length, 'what is not given is not assumed: that Bob is not Fido, that Fido is a person', refused(noStep).join(' ‖ '));
        const flags = [
            [['Every raven except Fido is black'], 'Fido is not black'],
            [['It is not the case that it rains and it snows'], 'It does not rain or it does not snow'],
            [['It is not the case that it rains or it snows'], 'It does not rain and it does not snow'],
            [['It is not the case that the match is off if it rains'], 'It rains and the match is not off'],
            [['Poe does not love each raven', 'Fido is a raven'], 'Poe does not love Fido'],
            [['Bob does not think that it rains'], 'Bob thinks that it does not rain'],
            [['Poe does not love Fido and Bob'], 'Poe does not love Fido'],
            [['Poe does not love a raven', 'Fido is a raven'], 'Poe does not love Fido']];
        ok(!flagged(flags).length, 'flagged with both readings: von Fintel\'s "except", a denial before "and", "or" or a condition, "not ... each", neg-raising, "not" with "Fido and Bob"', flagged(flags).join(' ‖ '));
    }

    console.log('\n-- what a denial in a word takes in --');
    {
        ok(fol('Everything is a non-raven or black') === '∀_0 (¬nl_property_raven(_0) ∨ nl_property_black(_0))',
            '"everything is a non-raven or black": each thing is a non-raven, or black', fol('Everything is a non-raven or black'));
        ok(key('Every non-raven that is black is a crow') === 'U:(¬=raven&=black)|=crow' && key('Fido is a non-raven that is black') === 'C[N(P:fido|=raven);P:fido|=black]',
            '"a non-raven that is black": a non-raven, and black', key('Fido is a non-raven that is black'));
        ok(fol('Everything is impossible or unlikely') === '∀_0 (¬nl_property_possible(_0) ∨ ¬nl_property_likely(_0))', '"impossible or unlikely": each word its own denial', fol('Everything is impossible or unlikely'));
        ok(key('Every non-member of the club is a guest') === 'U:¬=member of the club|=guest', 'a denial takes in its own complement: "a non-member of the club"');
        const invalid = [
            [['Everything is a non-raven or black'], 'Nothing is a raven or black'],
            [['Some bird is a non-raven or black'], 'Not every bird is a raven or black'],
            [['Every non-raven that is black is a crow', 'Fido is not a raven that is black'], 'Fido is a crow'],
            [['Fido is not a raven that is black'], 'Fido is a non-raven that is black']];
        ok(!refused(invalid).length, 'none of the invalid steps the wider reading certified', refused(invalid).join(' ‖ '));
        ok(rule(['Every non-raven that is black is a crow', 'Fido is not a raven', 'Fido is black'], 'Fido is a crow') === 'universal modus ponens', 'and the valid one: Fido is not a raven, and is black');
    }

    console.log('\n-- a junction after a relative clause --');
    {
        ok(key('Everything that is a raven or black is a crow') === 'U:=raven or black|=crow' && key('Every bird that is black and white is a crow') === 'U:(=bird&=black&=white)|=crow',
            '"everything that is a raven or black is a crow" is one claim about what is a raven or black', key('Everything that is a raven or black is a crow'));
        const invalid = [
            [['Black is a crow'], 'Everything that is a raven or black is a crow'],
            [['Everything that is a raven or black is a crow', 'Black is not a crow'], 'Everything that is a raven'],
            [['Every bird that sings or dances is happy', 'Dances is not happy'], 'Every bird that sings'],
            [['It rains'], 'Everything that is a raven or it rains']];
        ok(!refused(invalid).length, 'no fragment is split off and certified', refused(invalid).join(' ‖ '));
        ok(!flagged([[['Fido is white'], 'Fido is a bird that is black or white']]).length, '"a bird that is black or white": a bird that is black-or-white, or a black bird or white -- flagged');
        ok(rule(['Fido is white'], 'Fido is a raven or white') === 'disjunction introduction', 'with no relative clause, the "or" joins the predicates');
        ok(key('Either it is not the case that Fido is white and wise or the roads are icy') !== null && /^D\[/.test(key('Either it is not the case that Fido is white and wise or the roads are icy')),
            'the "that" of "the case that" is not a relative pronoun', key('Either it is not the case that Fido is white and wise or the roads are icy'));
        const junctions = [
            [['Every raven is black or white', 'Fido is a raven'], 'Fido is black or white', 'universal modus ponens'],
            [['Every raven is black and old', 'Fido is a raven'], 'Fido is black and old', 'universal modus ponens'],
            [['Everything that is black or white is a crow', 'Fido is black or white'], 'Fido is a crow', 'universal modus ponens'],
            [['Every raven is black or white'], 'If Fido is a raven, then Fido is black or white', 'universal elimination'],
            [['Every raven is black or white', 'Fido is neither black nor white'], 'Fido is not a raven', 'universal modus tollens']];
        ok(!passes(junctions).length, 'a predicate with "or" or "and", said of one thing: universal modus ponens, elimination and modus tollens', passes(junctions).join(' ‖ '));
    }

    console.log('\n-- the Logic panel --');
    {
        ev('toggleEvalOverview(); return 1;');
        const built = ev(`var b = document.getElementById('eval-logic-body');
            return { groups: b.querySelectorAll('.logic-group-row').length, symbols: [].map.call(b.querySelectorAll('.logic-sym'), function (x) { return x.textContent; }).join(''),
                options: [].map.call(document.querySelectorAll('#eval-logic-base option'), function (o) { return o.textContent + (o.disabled ? '-' : '+'); }),
                rules: b.querySelectorAll('input[data-rule]').length, lists: b.querySelectorAll('.logic-rules').length };`);
        ok(built.groups === 9 && built.symbols === 'H1H2H3Q1Q2Q3E1E2' && J(built.options) === J(['Standard+', 'Intuitionistic (later)-', 'Modal (later)-']),
            'at the bottom of the Evaluation Overview: Standard (others later), the eight axiom schemas, nine groups of steps', J(built));
        const want = ev('return DEDUCTIVE_EXTENSIONS.reduce(function (n, g) { return n + (g.rules.length > 1 ? g.rules.length : 0); }, 0);');
        ok(built.rules === want && built.lists === 7, 'a switch for each rule of a group with more than one', built.rules + ' of ' + want);
        // A map with a modus tollens step.
        ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['It does not rain'], collapsed: [], children: [
            { id: 'S', type: 'support', texts: ['If it rains, then the match is off', 'The match is not off'], collapsed: [], children: [] }] }]; render(); return 1;`);
        const mt = () => ev('var s = collectDeductiveSteps(state.trees)[0]; return s.rule ? s.rule.name : null;');
        ok(mt() === 'modus tollens', 'a modus tollens step, certified by default');
        ev('document.getElementById("logic-group-familiar").click(); return 1;');
        const off = ev('var g = document.getElementById("logic-group-familiar"); return { checked: g.checked, ind: g.indeterminate, n: Object.keys(state.logic.rules).length, stamped: !!state._logicVersion };');
        ok(mt() === null && !off.checked && !off.ind && off.n === 21 && off.stamped, 'Familiar steps switched off: its twenty-one rules off, stamped, and the step no longer certified', J(off));
        ev('document.getElementById("logic-group-familiar").click(); return 1;');
        ok(mt() === 'modus tollens' && J(ev('return state.logic.rules;')) === '{}', 'and on again');
        ev('document.querySelector("[data-rule=\\"modus-tollens\\"]").click(); return 1;');
        const part = ev('var g = document.getElementById("logic-group-familiar"); return { checked: g.checked, ind: g.indeterminate, count: document.querySelector("[data-count=\\"familiar\\"]").textContent };');
        ok(mt() === null && !part.checked && part.ind && part.count === '20 of 21', 'one rule of a group off: the group half on, "20 of 21"', J(part));
        // Undo leaves the settings alone; the map's edits it undoes.
        ev('pushHistory(); state.trees[0].texts = ["It does not rain at all"]; render(); undo(); return 1;');
        const undone = ev('return { text: state.trees[0].texts[0], rules: state.logic.rules, inSnapshot: /modus-tollens/.test(historySnapshot()) };');
        ok(undone.text === 'It does not rain' && J(undone.rules) === J({ 'modus-tollens': false }) && !undone.inSnapshot,
            'settings, not edits: undo leaves them alone, and the undo stack does not hold them', J(undone));
        // Saved with the map, and opened with it.
        const saved = ev('return JSON.stringify(state);');
        ev('state.logic = null; claimRulesCache = null; return 1;');
        ev('openMapText(' + J(saved) + '); return 1;');
        ok(J(ev('return state.logic && state.logic.rules;')) === J({ 'modus-tollens': false }) && mt() === null, 'saved with the map, and in force when it is opened again');
        // Merged between collaborators: the newer settings win.
        const merged = ev(`var t = [{ id: 1, texts: ['x'], children: [] }];
            var a = { name: 'm', trees: t, logic: { base: 'standard', rules: { commutation: false } }, _logicVersion: { ts: 100, by: 'a' } };
            var b = { name: 'm', trees: t, logic: { base: 'standard', rules: { 'double-negation': true } }, _logicVersion: { ts: 200, by: 'b' } };
            var n = { name: 'm', trees: t };
            return { ab: mergeStates(a, b, {}).logic.rules, ba: mergeStates(b, a, {}).logic.rules, na: mergeStates(n, a, {}).logic.rules, none: 'logic' in mergeStates(n, n, {}) };`);
        ok(J(merged.ab) === J({ 'double-negation': true }) && J(merged.ba) === J({ 'double-negation': true }) && J(merged.na) === J({ commutation: false }) && !merged.none,
            'merged between collaborators: the newer settings win, either way round; a map with none takes the other\'s', J(merged));
        // A viewer of a shared map sees the switches, and cannot change them.
        const viewer = ev(`_collab = { role: 'viewer' }; renderLogicPanel();
            var all = [].slice.call(document.querySelectorAll('#eval-logic input'));
            var out = { disabled: all.every(function (x) { return x.disabled; }), select: document.getElementById('eval-logic-base').disabled };
            _collab = null; renderLogicPanel(); return out;`);
        ok(viewer.disabled && viewer.select, 'a viewer sees the switches, disabled', J(viewer));
        ev('document.querySelector("[data-rule=\\"modus-tollens\\"]").click(); return 1;');
        ok(J(ev('return state.logic.rules;')) === '{}', 'back to the defaults');
        defaults();
    }
    // ---- r27.46: the user's decisions of 2026-09-24 ----
    {
        const tagOf = (ps, c, kind) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [
            { id: 'S', type: ${J(kind || 'support')}, texts: ${J(ps)}, collapsed: [], children: [] }] }];
            var s = collectDeductiveSteps(trees)[0]; return [deductiveStepTagText(s), s.why ? s.why.text : ''];`);
        // A bare denial is no argument.
        const bare = tagOf(['Poe is not black'], 'Poe is black', 'objection');
        ok(bare[0] === '✗ bare denial' && /only denies/.test(bare[1]) && /not an argument/.test(bare[1]) &&
            tagOf(['It is not the case that Poe is black'], 'Poe is black', 'weak-objection')[0] === '✗ bare denial' &&
            rule(['If Poe is white, then Poe is not black', 'Poe is white'], 'Poe is black') === null &&
            tagOf(['If Poe is white, then Poe is not black', 'Poe is white'], 'Poe is black', 'objection')[0] === '✓ modus ponens',
            'an objection that only states the denial of its box is a bare denial, no argument; one that argues for it passes', J(bare));
        // Slips of agreement are asked, with fixes; names, relative clauses and
        // nouns of both numbers are no slips.
        const slip = tagOf(['Conscious mental occurrences causes physical effects E', 'If conscious mental occurrences cause physical effects E, then dualism is true'], 'Dualism is true');
        const slips = t => ev('return claimAgreementSlips(' + J(t) + ').map(function (x) { return x.fixes; });');
        ok(slip[0] === '? grammar' && /slip of agreement/.test(slip[1]) && /Conscious mental occurrences cause physical effects E/.test(slip[1]) &&
            /A conscious mental occurrence causes physical effects E/.test(slip[1]),
            'a slip of agreement ("occurrences causes") is not passed over: the step asks, offering the verb or the noun made to agree', J(slip));
        ok(['Socrates is mortal.', 'Descartes was not a materialist.', 'Alice sings and Bob dances.', 'Everything that flies is a bird.',
            'Every bird that sings or dances is happy.', 'The sheep is observable.', 'The Beatles is a band.', 'Sports cars go fast.',
            'That God exists has not been established.', 'Zombies are possible.'].every(t => slips(t).length === 0) &&
            J(slips('The ravens is black.')) === J([['The ravens are black.', 'The raven is black.']]) &&
            J(slips('A raven are black.')) === J([['A raven is black.', 'Ravens are black.']]),
            'names, relative clauses, verbs joined, nouns of both numbers and plural modifiers are no slips; a plural with "is" is');
        // Generics are asked; a kind's predicate and a modal are not asked outright.
        const gen = tagOf(['Mosquitoes carry malaria', 'Bob is a mosquito'], 'Bob carries malaria');
        ok(gen[0] === '? generic' && /all mosquitoes carry malaria/.test(gen[1]) && /most mosquitoes carry malaria/.test(gen[1]) &&
            rule(['All mosquitoes carry malaria', 'Bob is a mosquito'], 'Bob carries malaria') === 'universal modus ponens' &&
            rule(['If zombies are possible, then physicalism is false', 'Zombies are possible'], 'Physicalism is false') === 'modus ponens' &&
            rule(['If functionalism is true, then a mere series of lights can produce consciousness', 'A mere series of lights can not produce consciousness'], 'Functionalism is not true') === 'modus tollens',
            'a generic asks all, some or most where the answer decides the step; "zombies are possible" and "a series of lights can ..." ask nothing here', J(gen));
        // An indefinite in an if-clause asks, in whole sentences.
        const ifA = tagOf(['If a raven sings, it is black', 'Fido is a raven', 'Fido sings'], 'Fido is black');
        ok(ifA[0] === '? generic' && /“every raven that sings is black” or “generally, if a raven sings, it is black”/.test(ifA[1]) &&
            /Read as “every raven that sings is black”, the step follows by universal modus ponens/.test(ifA[1]) &&
            ev('var e = parseClaimFull("If a raven sings, it is black").notes.filter(function (n) { return n.generic; })[0];' +
                'return !!e && claimReadingRoundTrips({ text: "If a raven sings, it is black", site: e.site }, 0, "Every raven that sings is black.");'),
            'an indefinite in an if-clause asks: any one (every raven that sings is black), or in general -- and the answer reads back', J(ifA));
        // A conditional's "would" belongs to the "if".
        ok(rule(['If Mary knew everything, Mary would not be surprised', 'Mary is surprised'], "Mary doesn't know everything") === 'modus tollens' &&
            rule(['If Mary had known everything, Mary would not be surprised', 'Mary is surprised'], "Mary didn't know everything") === 'modus tollens' &&
            rule(['If the vase had been dropped, the vase would have broken', 'The vase was dropped'], 'The vase broke') === 'modus ponens' &&
            rule(['If God existed, there would be no evil', 'There is evil'], 'God does not exist') === 'modus tollens' &&
            rule(['Mary would not be surprised'], 'Mary is not surprised') === null,
            'a conditional\'s "would" belongs to the "if": modus tollens and ponens take the plain claims; "would" said alone stays', '');
        const past = tagOf(['If Mary knew everything, Mary would not be surprised', 'Mary is surprised'], "Mary didn't know everything");
        ok(past[0] === '? ambiguous' && /read as the present/.test(past[1]) && /Read as “if Mary had known everything, Mary would not be surprised”, the step follows by modus tollens/.test(past[1]),
            '"if she knew", with "would", is the present; the past is a reading, offered as "had known"', J(past));
        // The user's Mary steps, in their words.
        const S5 = 'While in the room, Mary has acquired all the physical facts there are about color sensations, including the sensation of seeing red.';
        const S6 = 'When Mary exits the room and sees a ripe red tomato, she learns a new fact about the sensation of seeing red, namely its subjective character.';
        ok(tagOf(['If while in the room, Mary has acquired all the physical facts there are about color sensations, including the sensation of seeing red, then she would not be surprised when she leaves the room.',
                'Mary is surprised when she leaves the room.'], S5, 'objection')[0] === '✓ modus tollens' &&
            tagOf(['If Mary acquires knowledge-how when she exits the room and sees a ripe red tomato, then she does not learn a new fact about the sensation of seeing red, namely its subjective character.',
                'Mary acquires knowledge-how when she exits the room and sees a ripe red tomato.'], S6, 'objection')[0] === '✓ modus ponens' &&
            rule([S5, S6, 'If, while in the room, Mary has acquired all the physical facts there are about color sensations, including the sensation of seeing red, and when Mary exits the room and sees a ripe red tomato, she learns a new fact about the sensation of seeing red, namely its subjective character, then there are non-physical facts about color sensations.'],
                'There are non-physical facts about color sensations.') === 'modus ponens, conditions together',
            'the Mary\'s Room steps pass in their own words: "would" with "when", a time frame, "and sees ..." in the when-clause, and "its" with its noun before it');
        ok(ev('return claimDenies(parseClaim("Mary is surprised when she leaves the room"), parseClaim("Mary is not surprised when she leaves the room"));') === true &&
            tagOf(['Mary eats it', 'If Mary eats it, then Mary is full'], 'Mary is full')[0] === '\u2717 no referent',
            '"not" at a time is the denial of what is so then; a pronoun with nothing before it in its box has no referent, and the step says so', '');
        // The Evaluation Overview: a click on a note shows its box; no Go to or Delete; a trash can.
        const panel = ev(`var calls = [], real = panToNodeBox; panToNodeBox = function (id, idx) { calls.push([id, idx]); };
            state.trees = [{ id: 'M', type: 'contention', texts: ['Poe is black'], collapsed: [], x: 30000, y: 30000, children: [],
                statuses: ['contested'], evalThreads: [[{ id: 'c1', text: 'Is Poe a raven?', ts: 1 }]] }];
            ensureCollabFields(state); selectedIds = []; render();
            if (!evalOverviewOpen) toggleEvalOverview(); renderEvalOverview();
            var row = document.querySelector('.eval-row'), note = row.querySelector('.eval-comment-text'), entry = row.querySelector('textarea');
            note.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            var afterNote = calls.length;
            if (entry) entry.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            var trash = row.querySelector('.eval-comment-actions .eval-comment-trash');
            var out = { afterNote: afterNote, afterEntry: calls.length, goto: !!document.querySelector('.eval-row-goto'), del: !!document.querySelector('.eval-row-delete'),
                trash: !!trash && !!trash.querySelector('svg') && trash.title === 'Delete', text: /Go to|Delete/.test(row.textContent) };
            panToNodeBox = real; if (evalOverviewOpen) toggleEvalOverview();
            return out;`);
        // "should" in a then-clause is not "would": it hedges or says what ought
        // to be; the diagnosis says "would" would give the step. And a generic's
        // subject may be a noun compound, its predicate one that splits.
        const should = tagOf(['If Mary knew the facts, then Mary should not be surprised', 'Mary is surprised'], "Mary doesn't know the facts");
        ok(should[0] === '? not recognized' && /With “would” for “should”, this would follow by modus tollens/.test(should[1]) &&
            rule(['If color sensations are non-physical events, then physicalism is false', 'Color sensations are non-physical events'], 'Physicalism is false') === 'modus ponens' &&
            tagOf(['Color sensations are non-physical events', 'Red is a color sensation'], 'Red is a non-physical event')[0] === '? generic',
            '"should" is not "would" (and the diagnosis says so); a generic ("color sensations are ...") is asked where its answer decides the step, not in a modus ponens that holds on every answer', J(should));
        // A box moved past its co-premises takes its branch -- a child with no
        // target of its own too (it stands on the first box).
        const moved = ev(`var node = { id: 'G', type: 'support', texts: ['A', 'B', 'C'], collapsed: [], children: [
                { id: 'X', type: 'objection', texts: ['x'], collapsed: [], children: [] },
                { id: 'Y', type: 'objection', texts: ['y'], collapsed: [], children: [], targetIndex: 2 }] };
            state.trees = [{ id: 'M', type: 'contention', texts: ['M'], collapsed: [], x: 30000, y: 30000, children: [node] }];
            ensureCollabFields(state); moveTextWithin(node, 0, 3);
            var at = function (id) { return boxOf(node, node.children.filter(function (c) { return c.id === id; })[0]); };
            return [node.texts.join(''), at('X'), at('Y')];`);
        ok(J(moved) === J(['BCA', 2, 1]), 'a box moved past its co-premises takes its branch with it, and the others keep theirs', J(moved));
        ok(panel.afterNote === 1 && panel.afterEntry === 1 && !panel.goto && !panel.del && panel.trash && !panel.text,
            'the Evaluation Overview: a click on a note shows its box, the text entry box does not; no "Go to" or "Delete"; a note is deleted by its trash can', J(panel));
    }
    // ---- r27.48: a challenge is an argument; the that-clause convention ----
    {
        const tagOf = (ps, c, kind) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [
            { id: 'S', type: ${J(kind || 'support')}, texts: ${J(ps)}, collapsed: [], children: [] }] }];
            var s = collectDeductiveSteps(trees)[0]; return [deductiveStepTagText(s), s.why ? s.why.text : ''];`);
        // The verdict on M, and each step's tag by the box it comes from.
        const verdictOf = trees => ev(`var trees = ${J(trees)}, steps = collectDeductiveSteps(trees), tags = {};
            steps.forEach(function (s) { tags[s.childId] = deductiveStepTagText(s); });
            return { status: claimMapVerdict(trees, steps)('M', 0).status, tags: tags };`);
        const node = (id, type, texts, children) => ({ id, type, texts, collapsed: [], children: children || [] });
        const offered = why => { const m = /for instance \u201c(.*)\u201d and \u201c(.*)\u201d\./.exec(why); return m ? [m[1], m[2]] : null; };
        // A weak objection that only says its box has not been established
        // is a bare challenge: no force. The premises its message offers
        // instead pass, and do challenge.
        const bc = tagOf(['It has not been shown that Poe is black'], 'Poe is black', 'weak-objection'), offer = offered(bc[1]);
        const bareMap = node('M', 'contention', ['Poe is black'], [node('W', 'weak-objection', ['It has not been shown that Poe is black'])]);
        const arguedMap = node('M', 'contention', ['Poe is black'], [node('W', 'weak-objection', offer || [])]);
        ok(bc[0] === '\u2717 bare challenge' && !!offer && tagOf(offer, 'Poe is black', 'weak-objection')[0] === '\u2713 modus ponens' &&
            verdictOf([bareMap]).status === 'asserted' && verdictOf([arguedMap]).status === 'unresolved',
            'a bare challenge ("It has not been shown that P" alone) has no force; the premises it offers instead pass, and challenge', J([bc, offer]));
        // For a conditional box, the offer brackets the box, so that each
        // "then" has its "if" -- and it passes.
        const cb = tagOf(['It has not been shown that if Poe is a raven, then Poe is black'], 'If Poe is a raven, then Poe is black', 'weak-objection'), coffer = offered(cb[1]);
        ok(cb[0] === '\u2717 bare challenge' && !!coffer && /that \(if Poe is a raven, then Poe is black\)/.test(coffer[0]) &&
            tagOf(coffer, 'If Poe is a raven, then Poe is black', 'weak-objection')[0] === '\u2713 modus ponens',
            'the offer is checked before it is made: a conditional box is bracketed in it', J([cb, coffer]));
        // A bare step whose box is argued for below it is an argument through
        // that argument; alone it has no force.
        const zombie = ['If zombies are possible, then physicalism is false', 'Zombies are possible'];
        const denied = verdictOf([node('M', 'contention', ['Physicalism is true'], [node('O', 'objection', ['Physicalism is false'])])]);
        const deniedBelow = verdictOf([node('M', 'contention', ['Physicalism is true'], [node('O', 'objection', ['Physicalism is false'], [node('OS', 'support', zombie)])])]);
        const restated = verdictOf([node('M', 'contention', ['Physicalism is false'], [node('S', 'support', ['Physicalism is false'], [node('SS', 'support', zombie)])])]);
        ok(denied.status === 'asserted' && denied.tags.O === '\u2717 bare denial' &&
            deniedBelow.status === 'refuted' && deniedBelow.tags.O === '\u2713 argued below' && deniedBelow.tags.OS === '\u2713 modus ponens' &&
            restated.status === 'established' && restated.tags.S === '\u2713 argued below',
            'a bare denial or a restatement argued for below its box stands or falls with that argument ("\u2713 argued below"); alone it has no force', J([denied, deniedBelow, restated]));
        // It says so, in place of what the bare step lacks; and the offer's
        // words are cased as the step's own are.
        const whyOf = trees => ev(`var trees = ${J(trees)}, steps = collectDeductiveSteps(trees), out = {};
            steps.forEach(function (s) { out[s.childId] = s.why ? s.why.text : ''; }); return out;`);
        const belowWhy = whyOf([node('M', 'contention', ['Physicalism is true.'], [node('O', 'objection', ['Physicalism is false.'], [node('OS', 'support', zombie)])])]);
        const phys = tagOf(['It has not been shown that physicalism is true.'], 'Physicalism is true.', 'weak-objection');
        const bareWhy = tagOf(['Physicalism is false.'], 'Physicalism is true.', 'objection');
        ok(belowWhy.O === '\u201cPhysicalism is false\u201d only denies \u201cPhysicalism is true\u201d, but it is argued for in the boxes below it: this objection stands or falls with that argument.' &&
            /that physicalism is true, then we can\u2019t conclude that physicalism is true\u201d/.test(phys[1]) && /that Poe is black, then/.test(bc[1]) &&
            /only denies \u201cPhysicalism is true\u201d\. A denial/.test(bareWhy[1]),
            'a step argued below says so; the offer writes a common noun small after "that" and keeps a name\'s capital; a quoted box ends without its own full stop', J([belowWhy.O, phys[1], bareWhy[1]]));
        // r27.49 -- the user: "A bare 'not P' doesn't need to be rejected ...
        // There's no premise for the rebuttal to attack." An attack on a bare
        // step that nothing argues for below it has nothing to answer.
        const onBare = verdictOf([node('M', 'contention', ['P'], [node('O', 'objection', ['not P'], [node('R', 'rebuttal', ['If Q, then P', 'Q'])])])]);
        const onChallenge = verdictOf([node('M', 'contention', ['P'], [node('W', 'weak-objection', ['It has not been shown that P'],
            [node('R', 'weak-rebuttal', ['If Q, then it has not been shown that it has not been shown that P', 'Q'])])])]);
        const onRestated = verdictOf([node('M', 'contention', ['Poe is black'], [node('S', 'support', ['Poe is black'],
            [node('X', 'objection', ['If Poe is a dove, then Poe is not black', 'Poe is a dove'])])])]);
        const onArgued = verdictOf([node('M', 'contention', ['P'], [node('O', 'objection', ['not P'],
            [node('OS', 'support', ['If S, then not P', 'S']), node('R', 'rebuttal', ['If Q, then P', 'Q'])])])]);
        ok(onBare.status === 'asserted' && onBare.tags.R === '\u2717 nothing to rebut' &&
            onChallenge.status === 'asserted' && onChallenge.tags.R === '\u2717 nothing to rebut' &&
            onRestated.status === 'asserted' && onRestated.tags.X === '\u2717 nothing to object to' &&
            onArgued.status === 'unresolved' && onArgued.tags.O === '\u2713 argued below' && onArgued.tags.R === '\u2713 modus ponens',
            'a rebuttal of a bare denial or challenge has nothing to rebut, an objection to a restatement nothing to object to -- no force; once the box is argued for below it, both are ordinary steps',
            J([onBare, onChallenge, onRestated, onArgued]));
        // A bare step is one however it is spelled; where spelling stands
        // between a step and its rule, the hint names the word that differs.
        const spelled = tagOf(['If the evidence is weak, then it is not known that God Exists', 'The evidence is weak'], 'God exists', 'weak-objection');
        ok(tagOf(['It has not been shown that God Exists'], 'God exists', 'weak-objection')[0] === '\u2717 bare challenge' &&
            tagOf(['God does not Exist'], 'God exists', 'objection')[0] === '\u2717 bare denial' &&
            tagOf(['God Exists'], 'God exists')[0] === '\u2717 restates its box' &&
            spelled[0] === '\u2717 spelled differently' && /\u2018Exists\u2019 and \u2018exists\u2019 differ in capital letters/.test(spelled[1]) && !/\u2018God\u2019/.test(spelled[1]),
            'a bare denial, challenge or restatement is one however it is spelled; a spelling hint names only the word that differs', J(spelled));
        // "It is the case that" groups all that follows it, as brackets do --
        // to the end, or to the "then" of its if-clause.
        const notes = t => ev('return parseClaimFull(' + J(t) + ').notes.filter(function (n) { return n.kind === "ambiguous"; }).length;');
        const same = (x, y) => ev('var a = parseClaim(' + J(x) + '), b = parseClaim(' + J(y) + '); return !!a && !!b && claimSame(a, b);');
        ok(notes('If Bob believes that it is the case that Mary sings iff Ann dances, then Tom walks') === 0 &&
            same('If Bob believes that it is the case that Mary sings iff Ann dances, then Tom walks', 'If Bob believes that (Mary sings iff Ann dances), then Tom walks') &&
            notes('S knows that it is the case that p iff S believes that p, p is true, and S is justified') === 0 &&
            same('S knows that it is the case that p iff S believes that p, p is true, and S is justified', 'S knows that (p iff S believes that p, p is true, and S is justified)') &&
            notes('Bob thinks that it is the case that Poe is black, and Fido is white') === 0 && notes('Bob thinks that Poe is black, and Fido is white') === 1 &&
            notes('Bob believes that Mary sings iff Ann dances') === 1,
            '"it is the case that" groups all that follows it, like brackets, in an if-clause too; the "and" after it is what is thought; without it, both still ask');
        // The attitude's other reading is said with the that-clause last.
        ok(ev('var t = "Bob thinks that Poe is black, and Fido is white.", n = parseClaimFull(t).notes.filter(function (x) { return x.kind === "ambiguous"; })[0];' +
                'var w = claimReadingWords(n.readings[0], t); return w === "Fido is white, and Bob thinks that Poe is black." && claimReadingRoundTrips({ text: t, site: n.site }, 0, w);'),
            '"Bob thinks that P, and Q", with Q a claim of its own, is offered as "Q, and Bob thinks that P", and reads back so');
    }
    // ---- r27.50: a pronoun tracks its referent in the box ----
    {
        const tagOf = (ps, c, kind) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [
            { id: 'S', type: ${J(kind || 'support')}, texts: ${J(ps)}, collapsed: [], children: [] }] }];
            return deductiveStepTagText(collectDeductiveSteps(trees)[0]);`);
        const normed = t => ev('return normalizeClaimText(' + J(t) + ');').replace(/\uE000/g, '');
        const asks = t => ev('return parseClaimFull(' + J(t) + ').notes.some(function (n) { return n.kind === "ambiguous" && n.pronoun; });');
        // The user's step (2026-09-25): "she" in what "we" conclude is Mary,
        // the box's one name; the de se reading needs Mary to be the one who
        // concludes. With no name in the box, "she" is asked about.
        const S5 = 'While in the room, Mary has acquired all the physical facts there are about color sensations, including the sensation of seeing red.';
        const O1 = 'If while in the room, Mary has acquired all the physical facts there are about color sensations, including the sensation of seeing red, then we would not conclude that she is surprised when she leaves the room.';
        ok(tagOf([O1, 'We conclude that Mary is surprised when she leaves the room.'], S5, 'objection') === '\u2713 modus tollens' &&
            tagOf([O1, 'We conclude that she is surprised when she leaves the room.'], S5, 'objection') === '\u2717 no referent' &&
            normed('We conclude that Mary is surprised when she leaves the room') === 'we conclude that mary is surprised when mary leaves the room',
            'a pronoun in what "we" conclude is the box\'s one name ("she" is Mary); with no name in the box it has no referent (said, not asked: the user, 2026-09-28), so a lone "she" is never matched with another box\'s');
        ok(normed('Mary believes that she is late') === 'mary believes that mary is late' && normed('Bob believes that she is late') === 'bob believes that bob is late' &&
            normed('When Mary left, she thought that she was late') === 'when mary left, mary thought that mary was late' &&
            normed('Mary is late, and we all think that she is tired') === 'mary is late, and we all think that mary is tired',
            'the one who believes is a referent like any other (since 2026-09-28); where it is "we", "I", "you" or "they", it is none, and the pronoun reads as the name');
        ok(asks('We conclude that she is surprised when she leaves the room.') && asks('I think that she is late.') && asks('She is surprised when she leaves the room.') &&
            asks('In the story, she is surprised.') && asks('Apparently, she is late.') &&
            !asks('When the teacher arrives, she opens the door.') && !asks('If a student cheats, he fails.') && !asks('We believe that every mother loves her child.') &&
            !asks('Mary believes that she is late.') && !asks('When Mary exits the room, she learns a new fact.'),
            'a "he" or "she" with nothing before it to go back to is asked about, in a claim kept whole too; a noun phrase before it, a quantifier, or a believer who may be its referent keeps it as written');
        ok(normed('Apparently, she is late') === 'apparently, she is late' && normed('Usually, he is early') === 'usually, he is early',
            'a hedge or frame word in front ("Apparently", "Usually") is no name for "she"');
        // The user: "The nodes are supposed to be standalone, intelligible
        // sentences whose pronouns only refer to referent within the node."
        ok(asks('After the storm, she left.') && asks('The storm is violent, and she left.') && asks('We conclude that after the storm, she left.') &&
            !asks('The teacher is late, and she is tired.') && !asks('When the dog barks, he wags his tail.'),
            'a "he" or "she" goes back only to someone -- a person or an animal -- in its box: "the storm" is no one, so it is asked about');
        ok(asks("Mary's mother left, and she cried.") && asks('Mary saw the teacher, and she smiled.') &&
            asks('When the teacher arrives, Mary opens the door and she smiles.') &&
            normed('Mary is a teacher, and she is tired') === 'mary is a teacher, and mary is tired' &&
            normed('Mary left because the teacher scolded her') === 'mary left because the teacher scolded mary' &&
            asks("Mary's dog barked and she ran.") && normed('Mary left because the dog bit her') === 'mary left because the dog bit mary',
            'another person or animal before the pronoun leaves it ambiguous ("Mary\'s dog barked and she ran": the dog may be "she"), and it is asked about -- but not a noun after "is", nor the subject of an object pronoun\'s own clause');
        const titleNote = ev('return parseClaimFull("In Hamlet, Ophelia is mad, and she drowns.").notes.map(function (n) { return n.message; }).join(" | ");');
        ok(normed("In 'Hamlet', Ophelia is mad, and she drowns") === "in 'hamlet', ophelia is mad, and ophelia drowns" &&
            normed('In "Hamlet", Ophelia is mad, and she drowns') === 'in "hamlet", ophelia is mad, and ophelia drowns' &&
            normed('In \u2018Hamlet\u2019, Ophelia is mad, and she drowns') === "in 'hamlet', ophelia is mad, and ophelia drowns" &&
            !asks("In 'Hamlet', Ophelia is mad, and she drowns.") && asks('In Hamlet, Ophelia is mad, and she drowns.') &&
            /put it in quotation marks/.test(titleNote) &&
            normed("Byron wrote 'She Walks in Beauty'") === "byron wrote 'she walks in beauty'" && !asks("Byron wrote 'She Walks in Beauty'."),
            'a name in quotation marks is mentioned, not used: "she" can only be Ophelia; unquoted, "Hamlet" is asked about, with a note to quote the title; a quoted "She" is no pronoun', titleNote);
    }
    // ---- r27.51: "do", "at all", "no longer", the light theme's pill ----
    {
        const tagOf = (ps, c, kind) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [
            { id: 'S', type: ${J(kind || 'support')}, texts: ${J(ps)}, collapsed: [], children: [] }] }];
            return deductiveStepTagText(collectDeductiveSteps(trees)[0]);`);
        const normed = t => ev('return normalizeClaimText(' + J(t) + ');').replace(/\uE000/g, '');
        // The user: "'do' isn't fundamentally changing anything here."
        ok(normed('We do conclude that Mary is surprised') === 'we conclude that mary is surprised' && normed('Poe does sing') === 'poe sings' &&
            normed('Poe did sing') === 'poe sang' && normed('Ada does quiz') === 'ada quizzes' &&
            normed('Mary does the dishes') === 'mary does the dishes' && normed('Mary did well') === 'mary did well' && normed('We do so') === 'we do so' &&
            normed('Ada did beat') === 'ada did beat' && normed('Do we conclude that Poe sings') === 'do we conclude that poe sings' &&
            tagOf(['If Poe is a raven, then Poe sings.', 'Poe is a raven.'], 'Poe does sing.') === '\u2713 modus ponens',
            'an emphatic "do" says no more than the plain verb in its tense; "do" with an object, a question, and a "did" that alone says the tense stay');
        ok(normed('Mary is not at all surprised') === 'mary is not surprised' && normed('Mary is not surprised at all') === 'mary is not surprised' &&
            normed('We must win at all costs') === 'we must win at all costs' && normed('Mary is calm at all times') === 'mary is calm at all times' &&
            tagOf(['If Poe is a raven, then Poe is not at all white.', 'Poe is white.'], 'Poe is a raven.', 'objection') === '\u2713 modus tollens',
            '"at all" only stresses a claim ("not at all surprised"), except where it says "every" ("at all times")');
        // The user's step, with "not" (and "do", "at all"); "no longer" does
        // not hide the one who concludes.
        const S5 = 'While in the room, Mary has acquired all the physical facts there are about color sensations, including the sensation of seeing red.';
        const O1 = 'If while in the room, Mary has acquired all the physical facts there are about color sensations, including the sensation of seeing red, then we would not conclude that she is at all surprised when she leaves the room.';
        ok(tagOf([O1, 'We do conclude that Mary is surprised when she leaves the room.'], S5, 'objection') === '\u2713 modus tollens' &&
            normed('Then we would no longer conclude that Mary is late and that she is tired') === 'then we would no longer conclude that mary is late and that mary is tired',
            'the user\'s modus tollens passes with "do" and "at all"; "no longer" stands between "we" and "conclude", as "not" does');
        // The light theme's Unwarranted pill (the dark theme's pale amber was
        // about 1.9:1 on a white box).
        ok(/body\.bg-light\s*\{[^}]*--logic-unwarranted:\s*#8a6100/.test(Array.from(W.document.querySelectorAll('style')).map(x => x.textContent).join('\n')),
            'in the light theme the Unwarranted pill is dark amber, as its ambiguous tags are');
        const asks = t => ev('return parseClaimFull(' + J(t) + ').notes.some(function (n) { return n.kind === "ambiguous" && n.pronoun; });');
        // "Would no longer" in a would-conditional: "would not". The user's step, as written.
        const O1b = 'If while in the room, Mary has acquired all the physical facts there are about color sensations, including the sensation of seeing red, then we would no longer conclude that she is at all surprised when she leaves the room.';
        const longer = ev('return parseClaimFull(' + J(O1b) + ').notes.filter(function (n) { return /no longer/.test(n.message); }).length;');
        ok(tagOf([O1b, 'We do conclude that Mary is surprised when she leaves the room.'], S5, 'objection') === '\u2713 modus tollens' && longer === 1 &&
            ev('return !claimSame(parseClaim("We no longer conclude that Poe is white"), parseClaim("We do not conclude that Poe is white"));'),
            'the user\'s step as written: "we would no longer conclude" is "we would not conclude" in what the conditional says would follow, noted once -- and "we no longer conclude" alone is not "we do not conclude"');
        // The user's pronoun rule: what the box calls "it" is not its "she".
        // Its "it" is the cat (r27.54: no clause can be the subject of "bit her
        // again"), and "her" is Mary.
        ok(normed('The cat bit Mary and then it bit her again') === 'the cat bit mary and then it bit mary again' && !asks('The cat bit Mary and then it bit her again') &&
            normed('The cat bit Mary, and it ran, and she cried') === 'the cat bit mary, and it ran, and mary cried' &&
            asks("Mary's dog barked and she ran.") && asks("Mary's dog chased the ball and she caught it.") && asks('It is clear that the cat bit Mary and she cried.'),
            'an animal the box calls "it" is not also its "he" or "she" ("her" is Mary); where the box does not say what it calls the animal, or its "it" may be two things, the pronoun is still asked about');
        // A pronoun asked about offers its referents; the chosen one reads back.
        const offered = ev(`var t = "Mary's dog barked and she ran.", n = parseClaimFull(t).notes.filter(function (x) { return x.pronoun; })[0];
            return { words: n.readings.map(function (l) { return claimReadingWords(l, t); }),
                back: n.readings.map(function (l, i) { return claimReadingRoundTrips({ text: t, site: n.site }, i, claimReadingWords(l, t)); }),
                chosen: claimKey(parseClaim(t, { site: n.site, reading: 0 })) === claimKey(parseClaim("Mary's dog barked and Mary ran.")) };`);
        ok(J(offered.words) === J(["Mary's dog barked and Mary ran.", "Mary's dog barked and Mary's dog ran."]) && offered.back.every(Boolean) && offered.chosen &&
            tagOf(["Mary's dog barked and Mary ran."], 'Mary ran.') === '\u2713 conjunction elimination',
            'a pronoun asked about offers the box with each someone it may be in its place; a choice reads back, and "Mary\'s dog barked and Mary ran" gives "Mary ran"', J(offered));
        // A pronoun in a predicate: the claim's subject, an earlier clause --
        // not, for an object, its own subject.
        ok(!asks('The teacher loves her job.') && asks('The teacher praised her.') && !asks('The teacher left and the student praised her.') &&
            !asks('The cat chased its tail.') && asks('Mary chased it.'),
            'a pronoun in a predicate may go back to the claim\'s subject or an earlier clause, but an object not to the subject of its own clause');
        ok(ev('return claimKey(parseClaim("Mary\'s dog barked")) === "P:mary\'s dog|~did barked" && claimKey(parseClaim("This gives you no reason")) === "N(P:this|~give you reason)";'),
            'a possessive or "my" opens a subject ("Mary\'s dog barked"); "this" before a verb is the subject itself');
    }
    // ---- r27.52: the someone a pronoun goes back to; the "it" of "it is clear that" ----
    {
        const tagOf = (ps, c, kind) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [
            { id: 'S', type: ${J(kind || 'support')}, texts: ${J(ps)}, collapsed: [], children: [] }] }];
            return deductiveStepTagText(collectDeductiveSteps(trees)[0]);`);
        const asks = t => ev('return parseClaimFull(' + J(t) + ').notes.some(function (n) { return n.kind === "ambiguous" && n.pronoun; });');
        const plain = t => String(key(t)).replace(/\uE000/g, '');
        const offers = t => ev(`var t = ${J(t)}, n = parseClaimFull(t).notes.filter(function (x) { return x.pronoun; })[0];
            return n ? n.readings.map(function (l, i) { var w = claimReadingWords(l, t); return claimReadingRoundTrips({ text: t, site: n.site }, i, w) ? w : 'NOT BACK: ' + w; }) : null;`);
        // After any clause, not only "the teacher is tired": the one someone before it.
        ok(plain('The teacher left and she cried.') === 'C[P:the teacher|~did left;P:the teacher|~did cried]' && !asks('The teacher left and she cried.') &&
            tagOf(['The teacher left and she cried.'], 'The teacher cried.') === '\u2713 conjunction elimination' &&
            tagOf(['If the teacher left, then she cried.', 'The teacher left.'], 'The teacher cried.') === '\u2713 modus ponens' &&
            asks('The teacher praised the student and she cried.') && asks('Every teacher left and she cried.') && asks('The storm raged and she left.') &&
            !asks('A teacher left and she cried.'),
            'a "he" or "she" after a clause whose subject is the one someone before it is that someone -- not where the box gives two, a quantifier, or no one ("a teacher" is read in: r27.54)');
        // A "he" and a "she" are two people, as with a name.
        ok(asks('The teacher is tired and he cried and she laughed.') && asks('The teacher left and he cried and she laughed.') &&
            asks('Mary left and he cried and she laughed.') && !asks('The teacher is tired and she told the boy that he left.'),
            'one someone is not both a "he" and a "she": asked, as with a name -- but two people may be');
        // An object pronoun is not its clause's subject, named earlier or not.
        ok(asks('The teacher is tired and she praised her.') && asks('The teacher is tired and the teacher praised her.') && asks('The teacher praised her.') &&
            !asks('The teacher praised the student and the student thanked her.') && !asks('The teacher is tired and she said that her car broke.'),
            'an object pronoun is not the subject of its own clause, wherever the box names that subject; a possessive may be');
        // The "it" of "it is clear that": what follows, not a thing.
        ok(!asks('It is clear that the cat bit Mary.') && !asks('Bob left and it is obvious that Mary cried.') && !asks('Bob left and it is hard to say whether Mary cried.') &&
            !asks('It is a fact that Mary cried.') && !asks('It is unclear why Mary cried.') &&
            plain('Bob left and it is clear that Mary cried.') === 'C[P:bob|~did left;P:it|=clear that mary cried]' &&
            plain('The book is old and it is clear that Mary cried.') === 'C[P:the book|=old;P:it|=clear that mary cried]',
            'the "it" of "it is clear that", "it is hard to say whether", "it is a fact that" stands for what follows: no referent is asked for, and it is no earlier thing',
            J(['It is clear that the cat bit Mary.', 'Bob left and it is obvious that Mary cried.', 'Bob left and it is hard to say whether Mary cried.', 'It is a fact that Mary cried.', 'It is unclear why Mary cried.'].map(asks).concat([key('Bob left and it is clear that Mary cried.'), key('The book is old and it is clear that Mary cried.')])));
        ok(asks('It is clear that she left.') && asks('It seems that she left.') && !asks('The teacher left and it is clear that she cried.') &&
            asks('It is a claim that Mary made.') && asks('It is hard to read.') && asks('It is so heavy that Bob cannot lift it.'),
            'what follows it is read as any clause ("it is clear that she left" asks who she is); "it is a claim that Mary made", "it is hard to read" have an "it" that is a thing');
        ok(!asks('It seems that it rained.') && !asks('It is clear that it rained.') && !asks('Bob left and it seems that it is raining.') &&
            !asks('It seems that it has been raining.') && asks('It seems that it broke.') && asks('It is clear that it has a tail that wags.'),
            'an "it" in what follows that stands for nothing ("it rained", "it is raining", "it is clear that") asks for no referent; one that is a thing does');
        // "That" after an adjective, a participle, a content noun, or "so": no relative clause.
        ok(plain('Bob left and it is known that Mary cried.') === 'C[P:bob|~did left;P:it|=known that mary cried]' &&
            plain('The box is so heavy that Bob cannot lift it.') === 'P:the box|=so heavy that bob can not lift the box' && !asks('The box is so heavy that Bob cannot lift it.') &&
            plain('Poe is a raven that Mary loves.') === 'C[P:poe|=raven;P:mary|~love poe]',
            '"clear that Mary cried", "known that ...", "so heavy that ..." are no relative clauses ("Mary cried it"); "a raven that Mary loves" is one',
            J([key('Bob left and it is known that Mary cried.'), key('The box is so heavy that Bob cannot lift it.'), asks('The box is so heavy that Bob cannot lift it.'), key('Poe is a raven that Mary loves.')]));
        // Offers settle every pronoun at once.
        ok(J(offers('Lenore admired Poe and she praised him')) === J(['Lenore admired Poe and Lenore praised Poe', 'Lenore admired Poe and Poe praised Lenore']) &&
            J(offers('Lenore admired Poe and she praised her.')) === J(['Lenore admired Poe and Lenore praised Poe.', 'Lenore admired Poe and Poe praised Lenore.']) &&
            J(offers('It is clear that the cat bit Mary and she cried.')) === J(['It is clear that the cat bit Mary and the cat cried.', 'It is clear that the cat bit Mary and Mary cried.']) &&
            J(offers('Poe wrote his poem and she read it')) === J([]),
            'a pronoun asked about is offered with every open pronoun given someone at once -- a "he" and a "she" two people, an object not its subject -- and each offer reads back; "that the cat" is no someone', J([offers('Lenore admired Poe and she praised him'), offers('It is clear that the cat bit Mary and she cried.')]));
    }
    // ---- r27.53: no referent said, not asked; "it" after a clause; typos ----
    {
        const tagOf = (ps, c, kind) => ev(`var trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], children: [
            { id: 'S', type: ${J(kind || 'support')}, texts: ${J(ps)}, collapsed: [], children: [] }] }];
            return deductiveStepTagText(collectDeductiveSteps(trees)[0]);`);
        // The pronoun note: 'missing', 'ambiguous' (with its offers), or 'read' (one
        // referent, read in: since r27.54), with the box's reading.
        const note = t => ev(`var t = ${J(t)}, r = parseClaimFull(t), n = r.notes.filter(function (x) { return x.pronoun || x.typo; })[0];
            return n ? { kind: n.typo ? 'typo' : n.auto || n.kind === 'unread' ? 'read' : n.missing ? 'missing' : 'ambiguous', message: n.message, key: r.form ? claimKey(r.form) : null,
                offers: (n.readings || []).map(function (l, i) { var w = n.typo ? l : claimReadingWords(l, t); return n.typo || claimReadingRoundTrips({ text: t, site: n.site }, i, w) ? w : 'NOT BACK: ' + w; }) } : null;`);
        const kind = t => { const n = note(t); return n ? n.kind : null; };
        // The user's cases: nothing to ask, so the step says the referent is missing.
        const every = note('Every teacher left and she cried.'), both = note('The teacher is tired and he cried and she laughed.'), herself = note('The teacher is tired and the teacher praised her.');
        ok(every.kind === 'missing' && /“every teacher” reaches no pronoun outside its own clause/.test(every.message) &&
            both.kind === 'missing' && /“he” and “she” are two people, and the box names only “the teacher”/.test(both.message) &&
            herself.kind === 'missing' && /“her” is not “the teacher”, the subject of its own clause \(that would be “herself”\)/.test(herself.message) &&
            tagOf(['Every teacher left and she cried.'], 'The teacher cried.') === '\u2717 no referent' &&
            kind('After the storm, she left.') === 'missing' && kind('The cat chased it.') === 'missing' && kind('It is heavy.') === 'missing',
            'a pronoun with nothing in its box to refer to is said to have none, not asked about: a quantifier reaches no pronoun past its clause, "he" and "she" are two people, an object is not its own clause\'s subject', J([every, both, herself]));
        // Several: asked, with the offers. One: that one, read in (the user, 2026-09-28:
        // "Mustn't 'she' in the teacher sentence refer to the teacher, as that's the
        // only available referent?"). After "a teacher", the "she" that opens the next
        // clause is dropped -- "A teacher left and cried", one teacher -- and where it
        // cannot be, the box is read as one claim.
        const dog = note("Mary's dog barked and she ran."), teacher = note('A teacher left and she cried.'), praised = note('A teacher left and Bob praised her.');
        ok(dog.kind === 'ambiguous' && J(dog.offers) === J(["Mary's dog barked and Mary ran.", "Mary's dog barked and Mary's dog ran."]) &&
            teacher.kind === 'read' && teacher.key === key('A teacher left and cried.') && /“she” as “the teacher”/.test(teacher.message) &&
            praised.kind === 'read' && /^A:/.test(praised.key) && note('Someone knocked, and she was angry.').key === key('Someone knocked and was angry.') &&
            tagOf(["Mary's dog barked and she ran."], 'Mary ran.') === '? ambiguous',
            'two or more referents: "? ambiguous", with each; one: read in, and said -- after "a teacher", "A teacher left and cried", else one claim', J([dog, teacher, praised]));
        // (a): an "it" after a whole clause may be the thing or what the clause says --
        // where a clause could be its predicate's subject: "that the vase is broken
        // surprised Mary" is English, "that Poe is a raven is black" is not (r27.54).
        const vase = note('The vase is broken and it surprised Mary.'), cat = note('The cat bit Mary and then it bit her again.'), poe = note('If Poe is a raven, then it is black.');
        ok(vase.kind === 'ambiguous' && J(vase.offers) === J(['The vase is broken and the vase surprised Mary.', 'The vase is broken and the fact that the vase is broken surprised Mary.']) &&
            cat.kind === 'read' && cat.key === key('The cat bit Mary and then the cat bit Mary again.') &&
            poe.kind === 'read' && poe.key === key('If Poe is a raven, then Poe is black.') &&
            note('The book is old and it is heavy.').key === key('The book is old and the book is heavy.') &&
            note('Mary saw the vase and dropped it.').key === key('Mary saw the vase and dropped the vase.') &&
            kind('Poe is a raven, and it surprised Mary.') === 'ambiguous' &&
            kind('Mary left and it surprised Bob.') === 'read' && kind('If the vase is broken, then it is worthless.') === 'ambiguous' &&
            tagOf(['The vase is broken and it surprised Mary.'], 'The vase surprised Mary.') === '? ambiguous' &&
            tagOf(['The vase is broken and the vase surprised Mary.'], 'The vase surprised Mary.') === '\u2713 conjunction elimination',
            'an "it" after a whole clause may be the thing or what the clause says, and is asked about (the user\'s choice, 2026-09-28) -- but not where no clause could be its predicate\'s subject ("is black", "bit her again", "is heavy", "dropped it"): there it is the thing', J([vase, cat, poe]));
        ok(kind('It is clear that it is raining.') === null && kind("It is clear that it's raining.") === null && kind('It seems that it rained.') === null &&
            kind('The cat chased its tail.') !== 'ambiguous' && kind('The teacher left and she cried.') !== 'ambiguous' && kind('If a raven sings, then it is black.') === null &&
            kind('Mary believes that she is late.') === null &&
            kind('If it rains, and if it is cold, then it snows.') === null && kind('It is not the case that it rains.') === null &&
            kind('If it rains, then it is not warranted to conclude that everything is a philosopher.') === null && kind('The box is so heavy that Bob cannot lift it.') !== 'ambiguous',
            'no question: an "it" that stands for nothing ("it is clear that it\'s raining", "it is cold", "it is not the case that"), "its" with its noun, a pronoun a quantifier binds, and an object whose clause has another subject');
        // r27.54: a phrase in front names no referent; only the living see, and a fact may help.
        const framed = note('According to the teacher, she left.');
        ok(framed.kind === 'missing' && /“According to the teacher” says in whose view, or where, the rest holds/.test(framed.message) &&
            note('The dog saw Mary and then it saw her again.').key === key('The dog saw Mary and then the dog saw Mary again.') &&
            kind('The vase broke and it helped Mary.') === 'ambiguous' && kind('In Hamlet, Ophelia is mad, and she drowns.') === 'ambiguous' &&
            ev('var n = parseClaimFull(\'The argument from "Poe is black" and "If Poe is black, then Fido is white" does not establish its conclusion.\').notes; return n.some(function (x) { return x.reference; }) && !n.some(function (x) { return x.pronoun; });'),
            '"according to the teacher" names no referent (an unquoted name there still may: "In Hamlet"); "saw her again" takes no clause as subject, "helped Mary" may; an unnamed conclusion stays the warrant reader\'s note', J(framed));
        // r27.55: "again" keeps the roles of what happened before (the user, 2026-09-28).
        const again = note('Mary praised Ann, and then she praised her again.');
        ok(again.kind === 'read' && again.key === key('Mary praised Ann, and then Mary praised Ann again.') &&
            kind('Mary praised Ann, and then she praised her.') === 'ambiguous' && kind('Mary praised Ann and then she thanked her again.') === 'ambiguous' &&
            note('The teacher praised the student and then she praised her again.').key === key('The teacher praised the student and then the teacher praised the student again.'),
            '"again" with the same verb: its subject is the one who did it before, its object the one it was done to -- without "again", or with another verb, still asked', J(again));
        // r27.55: in what somebody believes or says, a pronoun reads as any other.
        ok(kind('Mary told Ann that she is late.') === 'ambiguous' && kind('The teacher said that she praised her.') === 'missing' &&
            note('The teacher believes that she is late.').key === key('The teacher believes that the teacher is late.') &&
            kind('Every teacher loves her job.') === null && kind('A teacher loves her job.') === null && kind('We conclude that she is surprised.') === 'missing',
            'a pronoun in what is believed or said: one referent read in, two asked about, none said; bound by "every teacher" or "a teacher" in its own clause, settled');
        // r27.55: past verbs joined are each said of the subject.
        const joined = (ps, c) => tagOf(ps, c);
        ok(joined(['Some teacher left and cried.'], 'Some teacher cried.') === '\u2713 conjunction elimination under \u2203' &&
            joined(['Mary left and cried.'], 'Mary cried.') === '\u2713 conjunction elimination' &&
            joined(['Every teacher left the room and cried.'], 'Every teacher cried.') === '\u2713 conjunction elimination under \u2200' &&
            joined(['Mary bought bread and milk.'], 'Mary milked.') !== '\u2713 conjunction elimination' &&
            joined(['Mary washed and dried the dishes.'], 'Mary washed.') !== '\u2713 conjunction elimination' &&
            !/^\u2713/.test(joined(['Some teacher left.', 'Some teacher cried.'], 'Some teacher left and cried.')),
            '"left and cried", "left the room and cried": each said of the subject, under "some" and "every" too -- not "bought bread and milk", not "washed and dried the dishes", and two "some"s are not one');
        // r27.56: "Alice and Bob ate the pizza": each, or together -- asked where it
        // decides the step, and either reading can be written into the box. (The
        // user's "ate the whole pizza" is read as together since r27.57, below.)
        const pizza = ev(`var t = 'Alice and Bob ate the pizza.', n = parseClaimFull(t).notes.filter(function (x) { return /each, or of them together/.test(x.message); })[0];
            return n.readings.map(function (l, i) { var w = claimReadingWords(l, t); return claimReadingRoundTrips({ text: t, site: n.site }, i, w) ? w : 'NOT BACK: ' + w; });`);
        ok(J(pizza) === J(['Both Alice and Bob ate the pizza.', 'Alice and Bob together ate the pizza.']) &&
            tagOf(['Alice and Bob ate the pizza.'], 'Bob ate the pizza.') === '? ambiguous' &&
            tagOf(['Alice and Bob together ate the whole pizza.'], 'Bob ate the whole pizza.') === '? not recognized' &&
            key('Alice and Bob each ate the whole pizza.') === key('Both Alice and Bob ate the whole pizza.') &&
            key('Alice and Bob ate the whole pizza together.') === key('Alice and Bob together ate the whole pizza.') &&
            key('Poe and Fido together are ravens.') === key('Poe and Fido are ravens together.'),
            '"Alice and Bob ate the pizza" does not give "Bob ate the pizza" unasked; "Both Alice and Bob ..." and "Alice and Bob together ..." are its readings, written in and read back; "each" is "both"', J(pizza));
        // r27.57 (the user: "(b) Read some predicates as 'together' without asking"):
        // what takes two, and using up a whole thing, are said of the two together,
        // with a note; the rest is still asked about.
        const said = t => ev(`var r = parseClaimFull(${J(t)}); return { key: r.form ? claimKey(r.form) : null, notes: r.notes.map(function (n) { return n.kind + ': ' + n.message; }) };`);
        const met = said('Alice and Bob met.'), friends = said('Alice and Bob are friends.'), whole = said('Alice and Bob ate the whole pizza.');
        ok(met.key === key('Alice and Bob together met.') && J(met.notes) === J(['unread: "met" is said of the two together: what takes two']) &&
            friends.key === key('Alice and Bob together are friends.') && /what takes two/.test(friends.notes.join(' ')) &&
            whole.key === key('Alice and Bob together ate the whole pizza.') && /a whole thing is used up once/.test(whole.notes.join(' ')) &&
            tagOf(['Alice and Bob ate the whole pizza.'], 'Bob ate the whole pizza.') === '? not recognized' &&
            tagOf(['Alice and Bob met.'], 'Bob met.') === '? not recognized' &&
            ['Alice and Bob ate the pizza.', 'Alice and Bob met Carol.', 'Alice and Bob are tall.'].every(t => said(t).notes.some(n => /^ambiguous: .*each, or of them together/.test(n))),
            '"met", "are friends", "ate the whole pizza" are said of the two together, unasked and noted, and give nothing of each; "ate the pizza", "met Carol", "are tall" are still asked about',
            J([met, friends, whole]));
        // r27.57: "James left" -- a name in -s at the start of the box, before a verb
        // that shows no number, is a name; a plural of a known noun is still a generic.
        ok(said('James left.').notes.length === 0 && key('James left.').replace(/\uE000/g, '') === 'P:james|~did left' &&
            said('Socrates will die.').notes.length === 0 && said('Descartes doubted.').notes.length === 0 &&
            said('Ravens left.').notes.some(n => /"ravens" without "all" is a generic/.test(n)),
            '"James left", "Socrates will die", "Descartes doubted" ask nothing; "Ravens left" is asked about as a generic');
        // r27.57: "A and then B" (the user: "Should it? I don't get the concern") gives
        // A, B and "A and B"; it says the order besides, so neither "A and B" nor A
        // and B apart give it, and "B and then A" is another claim.
        ok(key('Mary left and then Bob cried.').replace(/\uE000/g, '') === 'T[P:mary|~did left;P:bob|~did cried]' &&
            tagOf(['Mary left and then Bob cried.'], 'Bob cried.') === '✓ conjunction elimination' &&
            tagOf(['Mary left and then Bob cried.'], 'Mary left.') === '✓ conjunction elimination' &&
            tagOf(['Mary left and then Bob cried.'], 'Mary left and Bob cried.') === '✓ conjunction elimination' &&
            tagOf(['Mary left and Bob cried.'], 'Mary left and then Bob cried.') === '? not recognized' &&
            tagOf(['Mary left.', 'Bob cried.'], 'Mary left and then Bob cried.') === '? not recognized' &&
            tagOf(['Mary left and then Bob cried.'], 'Bob cried and then Mary left.') === '? not recognized' &&
            tagOf(['Mary left and then Bob cried.'], 'Bob cried and Mary left.') === '? not recognized' &&
            tagOf(['It is not the case that (Mary left and then Bob cried).'], 'Either Mary did not leave, or Bob did not cry.') === '? not recognized' &&
            tagOf(['It is not the case that Mary left and then Bob cried.'], 'It is not the case that (Mary left and then Bob cried).') === '? ambiguous' &&
            tagOf(['If Mary left and then Bob cried, then Ann laughed.', 'Mary left and then Bob cried.'], 'Ann laughed.') === '✓ modus ponens' &&
            tagOf(['If Mary left and then Bob cried, then Ann laughed.', 'Mary left and Bob cried.'], 'Ann laughed.') === '? not recognized' &&
            key('Mary left and then cried.') === key('Mary left and then she cried.'),
            '"A and then B" gives A, B and "A and B", and is given by none of them; "B and then A" is another claim; its denial is no De Morgan; "if A and then B, then C" keeps its condition whole');
        // Lists: a chain is one claim; beside an "and" the commas say which joins the
        // whole, or the box is asked about with both groupings to write in; beside
        // "or" it is asked about (English wordings since r27.58, below) and brackets
        // settle it too; inside a that-clause it stays in the words.
        const chain = ev(`var t = 'Mary left and then Bob cried and Ann laughed.', n = parseClaimFull(t).notes.filter(function (x) { return x.kind === 'ambiguous'; })[0];
            return n ? n.readings.map(function (l, i) { var w = claimReadingWords(l, t); return claimReadingRoundTrips({ text: t, site: n.site }, i, w) ? w : 'NOT BACK: ' + w; }) : null;`);
        const plain = t => key(t).replace(/\uE000/g, '');
        ok(plain('Mary left and then Bob cried and then Ann laughed.') === 'T[P:mary|~did left;P:bob|~did cried;P:ann|~did laughed]' &&
            plain('Mary left and then Bob cried, and Ann laughed.') === 'C[T[P:mary|~did left;P:bob|~did cried];P:ann|~did laughed]' &&
            plain('Mary left, and then Bob cried and Ann laughed.') === 'T[P:mary|~did left;C[P:bob|~did cried;P:ann|~did laughed]]' &&
            J(chain) === J(['Mary left, and then Bob cried and Ann laughed.', 'Mary left and then Bob cried, and Ann laughed.']) &&
            said('Mary left and then Bob cried or Ann laughed.').notes.some(n => /^ambiguous: "and then" and "or" can group this two ways/.test(n)) &&
            plain('(Mary left and then Bob cried) or Ann laughed.') === 'D[T[P:mary|~did left;P:bob|~did cried];P:ann|~did laughed]' &&
            plain('Mary left and then (Bob cried or Ann laughed).') === 'T[P:mary|~did left;D[P:bob|~did cried;P:ann|~did laughed]]' &&
            plain('If Mary left and then Bob cried, then Ann laughed.') === 'I(T[P:mary|~did left;P:bob|~did cried]>P:ann|~did laughed)' &&
            plain('Mary believes that Ann left and then Bob cried.') === 'P:mary|~believe that ann left and then bob cried' &&
            tagOf(['Mary left and then Bob cried and then Ann laughed.'], 'Mary left and Ann laughed.') === '✓ conjunction elimination' &&
            tagOf(['Mary left and then Bob cried and then Ann laughed.'], 'Mary left and then Ann laughed.') === '? not recognized',
            'a chain of "and then" is one claim; with an "and" beside it, the commas group it or both groupings are offered and read back; "or" beside it is asked about, and brackets settle it; a that-clause keeps it', J(chain));
        // r27.57: "Mary and her sister left", "Mary and Bob's sister left": a
        // possessive opens a noun phrase, as "the" does. (Said of each since r27.58.)
        ok(plain('Mary and her sister left.') === "C[P:mary|~did left;P:mary's sister|~did left]" &&
            plain("Mary and Bob's sister left.") === "C[P:mary|~did left;P:bob's sister|~did left]",
            'the joined subject of "Mary and her sister left" is "Mary and her sister"');
        // r27.58 (the user: "Weren't we avoiding brackets and using 'either... or' and
        // 'both... and'?"; "Ask, with English wordings"): "and then" beside "or",
        // "if", "unless" or a denial is asked about with wordings to write in --
        // "either ... or", "first ... and then" (a sequence grouped, as "both ...
        // and" groups a list), and numbering -- each read back as its reading.
        const offers = t => ev(`var t = ${J(t)}, n = parseClaimFull(t).notes.filter(function (x) { return x.kind === 'ambiguous'; })[0];
            return n ? [n.message].concat(n.readings.map(function (l, i) { var w = claimReadingWords(l, t); return claimReadingRoundTrips({ text: t, site: n.site }, i, w) ? w : 'NOT BACK: ' + w; })) : null;`);
        const scopes = [offers('Mary left and then Bob cried or Ann laughed.'), offers('Mary left or Bob cried and then Ann laughed.'),
            offers('Ann laughed if Mary left and then Bob cried.'), offers('Mary left and then Bob cried if Ann laughed.'),
            offers('Ann laughed unless Mary left and then Bob cried.'), offers('It is not the case that Mary left and then Bob cried.')];
        ok(J(scopes) === J([
            ['"and then" and "or" can group this two ways', 'Either Mary left and then Bob cried, or Ann laughed.', 'Mary left, and then either Bob cried or Ann laughed.'],
            ['"and then" and "or" can group this two ways', 'Either Mary left or Bob cried, and then Ann laughed.', 'Either Mary left, or Bob cried and then Ann laughed.'],
            ['"if" can take in all of what comes before or after it, or only part of it', 'Ann laughed if first Mary left and then Bob cried.', '(1) Ann laughed if Mary left, and then (2) Bob cried.'],
            ['"if" can take in all of what comes before or after it, or only part of it', 'If Ann laughed, then Mary left and then Bob cried.', '(1) Mary left, and then (2) Bob cried if Ann laughed.'],
            ['"unless" can take in all of what comes before or after it, or only part of it', 'Ann laughed unless first Mary left and then Bob cried.', '(1) Ann laughed unless Mary left, and then (2) Bob cried.'],
            ['"it is not the case that" can deny all of the "and then", or only its first part', 'It is not the case that first Mary left and then Bob cried.', '(1) It is not the case that Mary left, and then (2) Bob cried.']]) &&
            plain('First Mary left and then Bob cried.') === 'T[P:mary|~did left;P:bob|~did cried]' &&
            plain('It is not the case that first Mary left and then Bob cried.') === 'N(T[P:mary|~did left;P:bob|~did cried])' &&
            plain('(1) Ann laughed if Mary left, and then (2) Bob cried.') === 'T[I(P:mary|~did left>P:ann|~did laughed);P:bob|~did cried]' &&
            J(ev("return ['mary saw the first raven and then bob cried', 'it is not the case that first mary left and then bob cried'].map(function (t) { return claimPairGroups(claimTopLevelMask(t)).map(function (g) { return t.slice(g.from, g.end); }); });"))
                === J([[], ['first mary left and then bob cried']]) &&
            tagOf(['It is not the case that first Mary left and then Bob cried.'], 'Either Mary did not leave, or Bob did not cry.') === '? not recognized',
            '"and then" beside "or", "if", "unless" and a denial: each question offers two English wordings, and each reads back as its reading; "first ... and then" groups; "the first" does not', J(scopes));
        // r27.58 (the user, of "Mary left and then cried and laughed": "Mary's crying
        // and laughing come after she left"): verbs under one subject -- "then"
        // takes in the verbs after it, and those before it came first; a comma
        // before a later "and" sets it apart. Verb lists with commas are read.
        ok(plain('Mary left and then cried and laughed.') === 'T[P:mary|~did left;C[P:mary|~did cried;P:mary|~did laughed]]' &&
            plain('Mary left and cried and then laughed.') === 'T[C[P:mary|~did left;P:mary|~did cried];P:mary|~did laughed]' &&
            plain('Mary left and then cried, and laughed.') === 'C[T[P:mary|~did left;P:mary|~did cried];P:mary|~did laughed]' &&
            plain('Mary left, cried, and then laughed.') === 'T[C[P:mary|~did left;P:mary|~did cried];P:mary|~did laughed]' &&
            plain('Mary left, cried, and laughed.') === 'C[P:mary|~did left;P:mary|~did cried;P:mary|~did laughed]' &&
            plain('Mary left and cried, and laughed.') === 'C[P:mary|~did left;P:mary|~did cried;P:mary|~did laughed]' &&
            plain('Mary washed and dried the dishes.') === 'P:mary|~did washed and dried the dishes' &&
            tagOf(['Mary left and then cried and laughed.'], 'Mary cried and laughed.') === '✓ conjunction elimination' &&
            tagOf(['Mary left and then cried and laughed.'], 'Mary left.') === '✓ conjunction elimination',
            '"Mary left and then cried and laughed": the crying and laughing after the leaving; verb lists with commas are three verbs, not "left cried" or a subject "and"');
        // r27.58 (the user, of "Alice and Bob left and then Carol cried": "three
        // claims"): a clause with its own subject ends a joined subject's verb
        // phrase -- not inside a that-clause.
        ok(plain('Alice and Bob left and then Carol cried.') === 'T[C[P:alice|~did left;P:bob|~did left];P:carol|~did cried]' &&
            plain('Alice and Bob left and Carol cried.') === 'C[C[P:alice|~did left;P:bob|~did left];P:carol|~did cried]' &&
            tagOf(['Alice and Bob left and then Carol cried.'], 'Carol cried.') === '✓ conjunction elimination' &&
            said('Alice and Bob said that Carol left and Dan cried.').notes.some(n => /^ambiguous: .*each, or of them together/.test(n)),
            '"Alice and Bob left and then Carol cried" is Alice and Bob leaving, and then Carol crying; a that-clause still runs to the end');
        // r27.58 (the user, of "Mary and her sister left": "This only has one
        // reading"; "Verbs alone, plural nouns"): said of each, unasked, with a note.
        const sister = said('Mary and her sister left.');
        ok(sister.notes.includes('unread: "left" is said of each of them: with nothing after the verb, there is nothing for them to share') &&
            !sister.notes.some(n => /^ambiguous/.test(n)) &&
            plain('Poe and Fido are ravens.') === 'C[P:poe|=raven;P:fido|=raven]' &&
            said('Poe and Fido are ravens.').notes.includes('unread: "are ravens" is said of each of them: a plural noun is said of each one') &&
            plain('Alice and Bob did not leave.') === 'C[N(P:alice|~did left);N(P:bob|~did left)]' &&
            tagOf(['Mary and her sister left.'], 'Mary left.') === '✓ conjunction elimination' &&
            tagOf(['Poe and Fido are ravens.'], 'Fido is a raven.') === '✓ conjunction elimination' &&
            ['Alice and Bob are tall.', 'Alice and Bob ate the pizza.', 'Alice and Bob met Carol.', 'Alice and Bob will be late.', 'Alice and Bob are two philosophers.']
                .every(t => said(t).notes.some(n => /^ambiguous: .*each, or of them together/.test(n))) &&
            key('Alice and Bob are brothers.') === key('Alice and Bob together are brothers.'),
            'verbs alone and "are" + a plural noun are said of each, unasked and noted; adjectives, objects and numbers are still asked; "are brothers" is said of the two together');
        // r27.56: what the sweep found.
        ok(key('Jones is late and Jones cried.').replace(/\uE000/g, '') === 'C[P:jones|=late;P:jones|~did cried]' &&
            kind('It rains only if it is cloudy.') === null && kind('If it had rained and it had been cold, then it would have snowed.') === null &&
            kind('It is not the case that both it rains and it is cold.') === null &&
            kind('Mary left and then she hurt her.') === 'missing' && kind('Poe wrote a poem about her.') === 'missing' &&
            /“he” and “her” are two people/.test((note('Mary said he loves her.') || {}).message || '') &&
            note('The storm hit Mary and then it hit her again.').message.indexOf('“the storm”') >= 0 &&
            (note('Ravens are black and they fly.') || {}).kind === 'read' && key('Ravens are black and they fly.').replace(/\uE000/g, '') === 'C[P:ravens|=black;P:ravens|~fly]',
            'a name ending in -s opens a clause of its own; the weather\'s "it" asks nothing; "her" after "she" is someone else; "the storm hit Mary" is no thing; a plural may be "they"');
        // A clause is no thing: "that ..." as a subject, "which" after an adjective.
        ok(key('That the vase is broken surprised Mary.').replace(//g, '') === 'A:that the vase is broken surprised mary' &&
            key('The vase is broken, which is sad.') === 'P:the vase|=broken which is sad' && key('Poe is a raven, which is black.') === key('Poe is a raven that is black.'),
            '"That the vase is broken surprised Mary" is one claim (it had been "that the vase is Mary" and more); "which" after "broken" is no relative clause on the vase; after a noun it still is');
        // Typos: "✗ typo?", with the fix; the box is read as fixed, and the step waits for it.
        const typo = note('Mary  left the  room.'), twice = note('The the raven is black.');
        ok(typo.kind === 'typo' && /two spaces after “Mary”; two spaces after “the”/.test(typo.message) && J(typo.offers) === J(['Mary left the room.']) &&
            twice.kind === 'typo' && J(twice.offers) === J(['The raven is black.']) &&
            J(['Poe is black , and Fido is white.', 'Poe is black,and Fido is white.', 'Poe is black.Fido is white.', 'Poe is black,, and Fido is white.', 'Poe is black..'].map(function (t) { return note(t).offers[0]; })) ===
                J(['Poe is black, and Fido is white.', 'Poe is black, and Fido is white.', 'Poe is black. Fido is white.', 'Poe is black, and Fido is white.', 'Poe is black.']) &&
            ['Wait... Poe is black.', 'Bob said "the  cat" twice.', 'It costs 1,000 dollars.', 'E.g. Poe is black.', 'Bob had had enough.', 'P  \u2227  Q'].every(function (t) { var n = note(t); return !n || n.kind !== 'typo'; }) &&
            tagOf(['If Poe is black, then Fido is white.', 'Poe  is black.'], 'Fido is white.') === '\u2717 typo?' &&
            ev('return claimKey(parseClaim("Poe  is black")) === claimKey(parseClaim("Poe is black"));'),
            'a typo -- extra spaces, a space before a comma or none after one, "the the", ",," -- is "\u2717 typo?" with its fix; quotations, an ellipsis, numbers, "e.g.", "had had" and formulas are left alone; the box is read as fixed, and the step waits for the fix', J([typo, twice]));
    }
    ok(errors.length === 0, 'no JSDOM script errors', errors.join('; '));
} finally {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    dom.window.close();
    process.exitCode = failed ? 1 : 0;
}
