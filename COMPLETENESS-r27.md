# Completeness and soundness of the Standard package

Standard's basis alone is complete for first-order logic with identity (no function symbols): if sentences Γ entail φ, some map derives φ from members of Γ. The derivation meets three conditions:

* every step in it is modus ponens, the basis's one rule;
* every box with nothing beneath it is a member of Γ, an axiom, or a universal closure of one;
* no extension is needed; they only shorten derivations.

The basis is Hilbert's, in Enderton's form: axioms closed under generalization, with modus ponens as the only rule. Maps hold no suppositions, and none are needed -- a supposition is discharged by the deduction theorem, which H1 and H2 give. The rules a map actually uses (conjunction elimination, the dilemma, reductio, and the rest) are all derived, and all on by default.

## The basis

Eight axiom schemas, what the other connectives abbreviate, every universal closure of those, and one rule.

| | schema |
|---|---|
| H1 | `A → (B → A)` |
| H2 | `(A → (B → C)) → ((A → B) → (A → C))` |
| H3 | `¬¬A → A` |
| Q1 | `∀x A → A[t/x]` |
| Q2 | `∀x (A → B) → (∀x A → ∀x B)` |
| Q3 | `A → ∀x A`, x not free in A |
| E1 | `t = t` |
| E2 | `t = s → (A → A′)`, A atomic |

**What the other connectives abbreviate.** `¬A` is `A → ⊥`; `A ∧ B` is `¬(A → ¬B)`; `A ∨ B` is `¬A → B`; `A ↔ B` is `(A → B) ∧ (B → A)`; `∃x A` is `¬∀x ¬A`. A map writes them as themselves, so each abbreviation is an axiom of the basis, both ways round. A system that treated them as mere shorthand would not need those; the price of reading `∧` as `∧` is five more schemas.

**Universal closure.** Every universal closure of an axiom is an axiom, as in Enderton. This does the work of the rule of generalization, which a map cannot check: Gen needs to know that the box below it is a theorem rather than something resting on a premise, and that is a property of the whole support chain, not of the step. Q3 is what Enderton adds for the same reason.

**The one rule is modus ponens.** Nothing else is basic. The rules the check offers — conjunction introduction and elimination, the dilemma, reductio, hypothetical syllogism, exportation, universal elimination, existential introduction and elimination, the identity rules — are steps in the **Intro and elimination** group, on by default, and each is derivable from the axioms (`logic-r27-hilbert-test.js`).

**Rule instances.** A conditional that states the step of any switched-on rule — its premises conjoined, its conclusion — needs no support while the *rule instances* switch is on (it is, by default). `(A ∧ ¬A) → ⊥` is Contradiction's; `((A ∧ B) → A)` is conjunction elimination's; `((P ∨ Q) ∧ ¬P) → Q` is disjunctive syllogism's. Switch a rule off and its conditional needs support again. Two things license none: *tautological consequence*, which would make every tautology a box needing no support, and a claim merely restated ("if P, then P"), which applies no rule at all and has its own switch. While double-negation replacement is on, the conditional need only state the step up to pairs of negations -- `¬¬(P ∧ Q) → P` is conjunction elimination's, `((A → B) ∧ ¬¬A) → B` modus ponens' -- and the explanation says a pair was taken out or put in. The pairs are an equivalence, so this adds nothing that is not derivable: `¬¬φ ↔ φ` is a theorem of the basis, and the rule's own soundness carries over. Order is content still: `¬(P ∨ ¬P) → (P ∧ ¬P)` commutes as well as it distributes, so De Morgan's alone does not state it -- unless *instances up to the replacements* is switched on, which lets a conditional state a step up to whatever the switched-on replacements allow. That adds nothing underivable either: each replacement is an equivalence with a derivation of its own, so a conditional it licenses is a theorem by the same argument, with the replacement's derivation spliced in. These are not axioms: the axioms are curried, as Hilbert's are, which is what lets modus ponens be the only rule. Switch the core steps off and a map is checked against the axioms alone.

## What the basis gives back

Everything it used to have as a rule, and in the same shapes. Each of these is derived from the axioms by modus ponens alone, every line checked in the app with every extension off:

* **Kleene's ten axioms for the connectives.** Since his system is complete for classical propositional logic and every one of his axioms is derived here, so is this basis: `(A ∧ B) → A` and `→ B`, `A → (B → (A ∧ B))`, `A → (A ∨ B)`, `(A → C) → ((B → C) → ((A ∨ B) → C))`, `(A → B) → ((A → ¬B) → ¬A)`, with H1, H2 and H3 already axioms.
* **⊥ and the conditional.** `⊥ → A`, `A → A`, and hypothetical syllogism in its curried form.
* **↔ and ∃.** Both biconditional rules, and `A(t) → ∃x A`.
* **Identity beyond E2.** Symmetry, transitivity, and substitution into a compound claim — E2 speaks only of atomic ones, as Enderton's sixth group does.

Hypotheses are discharged by the deduction theorem, which H1 and H2 make available: `h → f` for an axiom f by H1; `h → h` in five lines; and `h → C` from `h → X` and `h → (X → C)` by H2. That is what the long line counts are: 5,625 lines for the fifteen derivations.

**Independence.** That the propositional schemas are independent of one another is a classical result (Łukasiewicz's matrices), not something checked here. What is checked here is the other direction: that nothing else needs to be basic.

## The argument

Enderton's calculus, restricted to sentences, is complete. Its axioms are the universal closures of six groups, and its one rule is modus ponens:

1. tautologies;
2. `∀x α → α[t/x]`;
3. `∀x (α → β) → (∀x α → ∀x β)`;
4. `α → ∀x α` (x not free);
5. `x = x`;
6. `x = y → (α → α′)`, α atomic.

Groups 2 to 6 are Q1, Q2, Q3, E1 and E2, and closure under generalization is the same device. So the whole question is group 1: are the tautologies derivable?

They are, and by the oldest route. H1, H2 and H3, with `¬A` read as `A → ⊥`, are a complete basis for classical propositional logic — this is the system Łukasiewicz and Tarski studied, and it derives Kleene's ten axioms, each of which `logic-r27-hilbert-test.js` builds line by line in the app. Kleene's system proves every tautology; so does this one. ∃ is Enderton's `¬∀x ¬`, an axiom here in both directions rather than a definition, because a map writes `∃` as `∃`.

What a map cannot do is suppose. It does not need to: the deduction theorem is a theorem *about* this calculus, and the proofs it licenses are written out in full — `h → f` for an axiom f by H1, `h → h` in five lines, and H2 for a step under the supposition. Every derivation in the evidence below is written that way, with no line left unjustified.

Every extension is sound, and the model checker below checks each one. By completeness, each extension step is therefore derivable from the basis.

The two **catch-all steps** (off by default) are sound by construction rather than by that argument: they read a step propositionally, with every part they do not look inside -- an atom, a quantified claim, an identity -- counted as a letter, the same part the same letter. Whatever holds on every row of that table holds whatever those parts mean. *Tautological consequence* certifies a step when the conclusion holds on every row where the premises do; *equivalence replacement* swaps one part of a claim for a part that says the same on every row, at any depth, which stays sound under a quantifier for the same reason.

## The evidence

**`logic-r27-hilbert-test.js`.** With every extension off -- the axioms and modus ponens, nothing else -- fifteen derivations, 5,625 lines, each line an axiom, a closure of one, or modus ponens: Kleene's ten, `⊥ → A`, `A → A`, hypothetical syllogism, both ↔ rules, `A(t) → ∃x A`, and identity's symmetry, transitivity and compound substitution. It also checks what is and is not an axiom: `(A ∧ B) → A`, `A → (A ∨ B)`, `P → P` and `P ∨ ¬P` are not.

**`logic-r27-fol-test.js`.** The completeness sections run with the core steps on and every other extension off:

* Fifty closed instances of each of Enderton's schemas 2 to 5 are verified closures of basis rule instances; so are fifty of schema 6 in the form `(x = y ∧ α) → α′`. Its curried form is checked as not an instance.
* The definition of ∃ is derived both ways, for 12 random α (2,532 lines), the forward way by existential elimination.
* Every line of the following derivations is checked in the app. They are built by `logic-r27-basis-proofs.js`:
  * 30 random tautologies of four letters (7,934 lines);
  * 15 valid sequents, as their conditionals (4,007 lines);
  * 5 universal closures of tautologies with relations (9,940 lines).
* An independent model checker covers every model on domains of one to three things when the signature is small, and a sample otherwise. It checks each certified step and accepted rule instance in 1,500 random first-order steps and in candidate instances. These use relations, identity and nested quantifiers, in each rule's shape and near misses.
* Of all 256 categorical syllogism forms, exactly the 15 valid ones are certified, in symbols and in English.

**`logic-r27-basis-test.js`.** With the core steps on and nothing else, it checks the derivations for ¬¬A, ∃y B(y), P → P (six lines) and the work of the rules that discharge a supposition; what existential elimination takes and refuses; that curried conditionals and restatements are no instances; that `P → (P ∧ P)` is derived in 33 lines without absorption; and that "∀x F(x)" gives "∃x F(x)" only through a name. It also checks the extensions' switches and the Logic panel.

**`logical-theorem-r27-test.js`.** `P ∨ ¬P` from the core steps alone, in 39 lines, every one checked in the app.

Fuzzing through the rework, and once more on the final code, found no counter-model and no misreading. Over the rework:

* first-order: 20,000 steps and 825 rule instances;
* symbolic: 120,000 steps and 20,000 rule instances;
* English: 84,000 steps, and 12,000 more with a known outcome;
* Derive Parent: 902 premise groups, and none of the 398 conclusions it derived is invalid.

A further fuzzer, `fuzz-axiom.js`, puts random formulas, the shape of each axiom and mutations of them to the basis alone -- every extension switched off -- and checks whatever needs no support against the same oracle: 12,000 candidates, 4,304 accepted, no counter-model. This is the recogniser the whole argument rests on, so it is checked on input nobody chose.

Two more target this round's English and rules. `fuzz-english-3.js` builds sentences with their own first-order readings -- pronouns, "Poe is Edgar" identities, substitution into open relations, a quantifier-bound "it", restrictors that offer alternatives, substitution of equivalents, and traps such as the "it" of "it rains" and "some raven is black if it sings" -- and checks every certified step: 22,000 steps, about 8,300 certified, no counter-model. `fuzz-equiv.js` puts a biconditional and a claim with one side inside it to the app in symbols, with near misses: 30,000 cases, about 2,150 certified by substitution of equivalents, no counter-model. The English fuzzer has also been run with names of several words, titles and inner capitals in place of single names ("Clark Kent", "Dr. Jekyll", "J. S. Mill", "H2O", "McDonald"): 18,000 more steps, no counter-model.

Soundness is not the only thing a checker owes its user: it must not crash or freeze on what a box says. `fuzz-crash.js` puts junk to every part of the check -- the reader, the theorem check, the step check, the diagnosis and Derive Parent -- as random mixtures of English, symbols, quotation marks, links, emoji, right-to-left text, zero-width characters and pages-long runs: 31,500 steps across the round, 3,000 of them on the final code, no exception. It found a step of logic-word soup that took 26 seconds to diagnose, and behind it a reader that re-read the same words by one route and then another: twelve conditionals joined by "and" took 15,627 readings, and a run of thirty-two "iff"s filled the page's memory. Now each part of a sentence is read once; a box of more than 400 parts, or one needing more than 600 part-readings, is read as one claim and says so; and the near-miss hints, which re-run the check under looser matching, are skipped on a step whose boxes run past 1,500 characters. `fuzz-slow2.js` then finds no step over 400 milliseconds in 1,600 tries (400 on the final code), and a real pasted paragraph (1,100 characters of the knowledge argument) takes 50 milliseconds. Every sentence shape tried -- chains of conditionals, of "unless", of "only if", of denials -- now takes time in proportion to its length.

Brackets are what a user writes to settle a reading, and what the reading chooser writes. `fuzz-brackets.js` builds random structures of "and", "or", "not", "if" and "iff" over English clauses with every compound part bracketed, and constructions whose words settle the scope ("P iff Q, and Q iff R", "if P iff Q, then R"): it found brackets that were ignored, split inside or read as words, and a biconditional reader that split at its first "iff" -- one reading, "P iff Q, and Q iff R" as "P iff ((Q and Q) iff R)", certified an invalid step. On the r27.43 code, 20,000 sentences are each read as they say, 20,000 random steps certify nothing invalid, and of 20,000 steps shaped like rules and fallacies, with bracketed parts, it certifies 12,122 -- every rule instance -- and no fallacy; on the final code, 4,000 sentences and 8,000 steps more, with the same result.

The run on the final code (r27.44): 3,000 first-order steps and 326 instances, and again with every rule on; 11,950 symbolic steps and 2,000 instances, twice over; 9,022 English steps, 2,000 instances, 2,000 named fallacies and 2,000 steps with a known outcome; 6,000 steps of the newer English (pronouns, identities, restrictors, equivalents), 4,000 more with names of several words and titles; 3,000 substitutions of equivalents; 4,000 candidates for the basis alone; 4,000 bracketed sentences and 8,000 steps with bracketed parts; 445 premise groups for Derive Parent; 3,000 junk steps and 400 timed ones; and the 143 adversarial maps. No unsound step, no accepted invalid instance, no misreading, no rule instance left uncertified, no exception, no step over 400 milliseconds. A box with an inference word ("because", "therefore") is certified in no step, and a step shaped like a rule loses nothing to the flag unless its words hold one.

A model checker on small domains cannot prove validity. What these runs show is that no invalid step was found. Completeness rests on the argument above. The tests show that the app accepts each piece it uses.

## Limits

* Every step still needs one rule. A derivation from the basis alone can be long; the extensions shorten it, and the mapper does not search for proofs.
* English is read by a finite grammar. The completeness claim is for the symbolic language. English sentences inherit it only as far as they read as formulas.
