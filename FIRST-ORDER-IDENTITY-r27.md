# Identity in the Standard package

Explicit natural-language identity between simple names now has its own parsed form. Supported frames are `A is identical to B` and `A is the same individual/person/object/entity as B`, with `is not` and contracted denials. Identity here is numerical identity, not qualitative resemblance. Pronouns and indefinite referents in these frames are flagged for clarification. Bare copular statements are not reinterpreted as identity.

The checker certifies symmetry, transitivity (either orientation of the premises), and substitution. It can derive and recheck identity conclusions and simple property substitutions through Derive Parent. Symbolic `a = b` works inside Boolean formulas; symbolic relations preserve predicate names and argument order.

Substitution is structural and deliberately restricted to explicit identity operands, simple single-word copular predicates, unary symbolic predicates, and argument positions in symbolic relations, with negations of those forms. It does not search-and-replace text or enter epistemic, modal, quoted, quantified, or arbitrary English relation contexts. All premises in the group must be used. Substitution currently replaces every matching argument in a relation, rather than enumerating all optional subsets of occurrences.

The existing weak-challenge assessment applies without adding epistemic operators to first-order logic. A supported identity-based conclusion can be True; challenging a necessary identity premise leaves it Open while preserving the valid inference. An unsupported main contention remains Open.

`identity-r27-test.js` checks positive and adversarial English/symbolic cases, generated conclusions, operand and predicate preservation, bound-variable boundaries, and the map's assessment. An independent two-element model evaluator checks six representative rule instances across all assignments to three constants and all unary/binary predicate extensions (768 checks). This finite check supplements the rule tests; it is not a proof of completeness or unrestricted English understanding.

Remaining first-order work includes general quantified relational formulas, explicit assumption scopes and witness conditions, more English relation syntax, and broader scope disambiguation. The current map still checks one registered rule per step; failure to certify is not a countermodel or a proof of invalidity.
