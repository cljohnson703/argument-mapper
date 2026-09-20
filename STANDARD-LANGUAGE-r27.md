# Standard logic language coverage

The current package uses classical inference rules plus the map's rules for objections, rebuttals and failure to establish a premise. The displayed assessments are Warranted and Unwarranted, relative to the argument as presented. Internal unresolved states do not change the underlying classical truth tables. Separate modal, higher-order, relevant and paraconsistent packages are future work.

## September 2026 audit

Negation-distribution policy: a named replacement may be followed by removal of any number of negation pairs anywhere in its resulting formula. Partial simplification on independent branches is allowed; introducing extra pairs is not. This applies to De Morgan, Negated Conditional, Negated Biconditional, transposition, material implication/equivalence, contraposition, and quantifier negation. The quantifier replacement preserves bindings and swaps universal/existential quantifiers; it does not also distribute the resulting negation through another connective in the same step. Opaque warrant reports are not rewritten internally.

For Negated Conditional, the expanded result of `~(P -> ~Q)` is `~~P & ~~Q`. All four choices that leave either or both pairs in place are accepted with the same label; adding four negations to P or Q is not. Negated Biconditional uses the exclusive-disjunction form `(P & ~Q) or (~P & Q)`, with the same optional pair-removal policy. Partial De Morgan simplifications work on longer conjunctions/disjunctions as well, without enumerating every combination in advance.

Negation Elimination replaces the former double-negation-elimination rule. One application can remove any positive even number of consecutive negations at one location, including within a conjunction, disjunction, or conditional. For example, `~~~~~P or Q` gives `~P or Q`, or `~~~P or Q`. It cannot remove an odd number, add negations, or silently rewrite an epistemic warrant claim. Double-negation introduction remains available through the existing equivalence rule. Constructive Dilemma already covers shared-consequent proof-by-cases arguments; there is no separate Proof by Cases rule to remove.

Material Implication retains the literal new negation when converting a disjunction to a conditional, and also permits removing even pairs: both `~~P v (~P v Q)` and `~~~~P v (~P v Q)` give `~~~P -> (~P v Q)`.

Recognized classical rule instances written as conditionals can be verified without assuming their antecedents. A conjunction in the antecedent can provide a rule's joint premises. Standalone tautologies (including Excluded Middle) and mere restatements such as `P -> P` are not automatically licensed. They require explicit support when presented as a main contention. This is a conservative rule-instance check, not a complete theorem prover; modal/warrant claims and ambiguous readings are not automatically certified. Verified formulas receive a green Rule Instance tag centered across the bottom border while Deductive is active, including in image exports. Recognition is recalculated from the text, not stored as a user-controlled axiom flag. Verified rule instances supply warrant, subject to the map's existing challenge assessment.

`⊥` (also `\bot`) is the contradiction constant. Contradiction derives it from `P` and `~P`, or from `P & ~P`. Reductio accepts `~C -> ⊥` as a route to `C`. Thus the conditionals `~(P v ~P) -> (P & ~P)` and `(P & ~P) -> ⊥` are verified rule instances; their Hypothetical Syllogism conclusion `~(P v ~P) -> ⊥` supports `P v ~P` by Reductio.

Rich Text is off by default for new edits. Existing saved formatting is preserved. Runs of logical tildes are protected from strikethrough interpretation in both rendering and logical text cleanup; ordinary paired `~~strikethrough~~` still works when formatting is enabled.

Conditional markers now share a vocabulary across leading and trailing positions: if, provided (that), providing (that), as long as, so long as, on (the) condition that, in the event that, on the assumption that, assuming (that), supposing (that), and whenever. Leading forms accept an optional then; trailing forms accept a separating comma. In particular, `Q, so long as P` is not mistaken for `P, so Q`. Ambiguous attachment still produces an ambiguity flag. Moving words arbitrarily is not meaning-preserving: only-if direction, quantifier scope, negation, and anaphora remain significant.

`Q unless P` and `Unless P, Q` mean inclusive `Q or P`. Logical tilde negation now survives English text cleanup; only paired Markdown strikethrough is removed. Symbolic subclauses are recognized inside English connectives, including `~P`, `¬P`, and `\neg P`. Thus `Q unless ~P` with `P` gives Q, whereas the same unless claim with `~P` does not. The latter has counterexample P=false, Q=false. A symbolic operator or explicit grouping is required when parsing a symbolic subclause, so ordinary names such as Poe are not mistaken for compact predicate notation P(o,e).

Added single-step classical resolution: `P or Q`, `not P or R` entail `Q or R`. Only one complementary pair is removed; remaining disjuncts must be preserved. Derive Parent can suggest this conclusion. Added explosion from a claim and its outright negation; an epistemic hedge does not qualify as a negation. Explosion certifies validity only: contradictory premises cannot jointly supply warrant, and Derive Parent does not invent arbitrary conclusions from them.

Reductio is retained and tested: `P → Q` and `P → ¬Q` give `¬P`; `P → ¬P` gives `¬P`. No rules were removed. Existing rules already cover modus ponens/tollens, hypothetical syllogism, both dilemmas (including shared-conclusion cases), conjunction/disjunction rules, biconditional elimination, double negation, equivalence transformations, identity substitution, quantifier instances, and categorical syllogisms. These are a finite set of single-step patterns, not a complete natural-deduction proof editor. General assumption discharge, arbitrary-object universal introduction, fresh-witness existential elimination, and proofs beyond the recognized premise-free rule instances still require explicit proof-context support; tree ancestry alone is not a discharged supposition.

The morphology audit checks every entry in the pinned upstream lists (363 verb bases and 419 noun entries), imported mappings, reviewed spelling alternatives, participles, and exclusions. The upstream noun list was also inspected online; this pass does not replace the pinned snapshots or claim that all English senses are covered. The lists remain those from [RosaeNLG](https://github.com/RosaeNLG/rosaenlg/tree/master/packages/english-verbs-irregular) and [irregular-plurals](https://github.com/sindresorhus/irregular-plurals). Rule review uses the [Open Logic Project's classical natural-deduction presentation](https://forallx.openlogicproject.org/html/Ch17.html).

`language-r27-position-rules-test.js` adds positional equivalence and fallacy checks, hedge contractions with conclude/infer/establish/determine, resolution and explosion examples, Reductio retention, a map-level explosion warrant check, and all eight truth assignments for 216 small resolution instances. Existing language, warrant, quantifier, identity, and randomized semantic-oracle tests supply broader coverage. No finite test corpus guarantees correct interpretation of every natural-language sentence.

## Additional constructions

Truth wrappers are transparent in Standard classical mode: `it is true that P`, `it is the case that P`, and `it is not false that P` express P; `it is false that P`, `it is not true that P`, and `it is not the case that P` express its denial. Contractions are supported. Suffix forms such as `P is true`, `P is the case`, and `P is not false` work for proposition letters, quoted statements, explicitly named propositions, and parenthesized symbolic formulas. These readings work in both front and trailing conditions. Undelimited complex suffix operands are not automatically stripped, because their scope can be unclear.

`Provided (that)`, `providing (that)`, and `supposing (that)` remain supported conditional markers. Reports such as `we suppose P`, `one supposes P`, `P is supposed`, `it is supposed that P`, and the corresponding `take/takes/taken ... to be true/the case` forms are not reduced to P. Supposing or accepting a statement does not entail its truth. Putting such a report after `if` does not make it equivalent to `if P`; use `supposing that P, Q` for the intended hypothetical conditional.

`conditional-truth-r27-test.js` checks truth polarity, both conditional positions, contractions, quoted and parenthesized scope, non-equivalent attitude reports, and the symbolic precedence documented briefly in Help.

The expanded corpus covers necessary and sufficient conditions, biconditionals, conjunctions, inclusive disjunctions, negation, truth wrappers, universal and existential quantification. It is independent of the warrant-claim corpus.

Examples, with P and Q replaced by complete clauses:

* `“P” is a sufficient condition for “Q”`: P implies Q.
* `“P” is a necessary condition for “Q”`: Q implies P.
* `“P” is a necessary and sufficient condition for “Q”`: both directions.
* `On the assumption that P, Q` and `Supposing that P, Q`: conditional constructions.
* `Both “P” and “Q” are true`: conjunction.
* `Both “P” and “Q” are false`: conjunction of denials, not merely denial of their conjunction.
* `P or Q, or both` and `At least one of “P” and “Q” is true`: inclusive disjunction.
* `It isn't so that P`, `The proposition that P is false`, and `“P” is false`: denial of P, preserving the scope of any.
* `It is the case that P` and `It is true that P`: transparent truth wrappers. Knowledge and necessity wrappers are not transparent.
* `Every single one of the ravens is black` and `Each and every one of the ravens is black`: universal quantification.
* `No single raven is white` and `There does not exist any raven that is white`: negative existential / universal denial.

The tests include wrong-direction conditionals, affirming the consequent, exclusive versus inclusive disjunction, exceptions to universal claims, exactly-one versus at-least-one, and modal qualifiers. Unknown constructions are not evidence that an argument is invalid. English scope, temporal readings and word senses still require care.

Classical interpretation references consulted: [OpenStax logical statements](https://openstax.org/books/introduction-philosophy/pages/5-2-logical-statements), [OpenStax compound statements](https://openstax.org/books/contemporary-mathematics/pages/2-2-compound-statements), and [Stanford introduction to propositional logic](https://logic.stanford.edu/intrologic/chapters/chapter_02.html).

## Tests and sources

The reviewed supplement in `language-data/reviewed-variants.json` adds explicit British/American spellings (including inflected forms), six selected alternate past-tense families from the verb snapshot, and eight compound plurals. Regional spellings match during checking; original box text is not rewritten, and generated conclusions retain the first corresponding spelling found in the premises. Capital-marked names remain distinct. This is a finite list, not a general suffix substitution. In particular, `analyses` normalizes as a verb but remains the plural of `analysis` as a noun. `licence/license` and `metre/meter` are deliberately not globally equated.

Additional qualification tests cover `we aren't sure that P`, `one is not certain that P`, and `we cannot rule out (the possibility) that P` / `it cannot be ruled out that P`. The latter challenges establishment of not-P, not establishment of P. Negation and conjunction inside P retain their scope. Tense/aspect differences and reversal of participants remain distinct; active/passive conversion is not added by this supplement.

Remaining audit work includes sense-sensitive alternate forms, accented nouns outside the present token grammar, and contextual interpretation of bare homographs. The source-import exclusions do not override earlier curated mappings: bare `found`, `fell`, and similar forms are not yet fully disambiguated by subject/context. Explicit `did find` versus `did found` is tested as distinct. These limitations must not be described as complete word-sense coverage.

`logical-locutions-r27.json` is the independently written phrasing corpus. `language-r27-expanded-test.js` checks these phrasings, inference direction, all automatically imported word-form mappings, source participles, and snapshot integrity. Existing deductive, English and randomized stress suites remain in use. See `language-data/README.md` for source snapshots and import exclusions, and `WARRANT-LANGUAGE-r27.md` for argument-warrant constructions.
