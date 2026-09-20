# One quantifier move per step

Universal elimination and existential introduction now match arbitrary parsed predicate formulas, including nested quantifiers, relations, identity and Boolean structure. Matching checks binder depth, consistent replacement of free occurrences, shadowing and variable capture. It removes or introduces exactly one outer quantifier. It neither chains instantiations nor supplies a named witness from an existential premise.

Examples:

* `∀x ∃y R(x,y)` → `∃y R(a,y)` is one universal elimination.
* `∀y R(a,y)` → `∃x ∀z R(x,z)` is one existential introduction, with a harmless renaming of the bound variable.
* `∀x ∀y R(x,y)` → `R(a,b)` needs two steps and is not certified as one move.
* `∀x ∃y R(x,y)` → `∃y ∀x R(x,y)` is not certified: it changes the witness dependency.
* `∀x ∃y R(x,y)` → `∃y R(y,y)` is rejected as variable capture.

Explicit English scope is supported through `For every individual x, …` and `There is/exists an individual y such that …`. These can nest. Bodies currently support simple copular predicates and the extensional relations admire, love, help, visit and follow, including their denials. For example:

> For every individual x, there is an individual y such that x admires y.

This permits:

> There is an individual y such that Ada admires y.

It does not permit switching to a single person admired by everyone. Some ordinary quantified-object forms, such as “Every student admires someone,” are now flagged for scope clarification, including inside larger clauses. This warning is a finite grammatical safeguard, not exhaustive English scope analysis.

The new rules retain the existing requirement to use every premise in the group. Derive Parent does not guess instantiation terms or existential generalizations. Weak challenges use the same parsed forms: a challenged universal premise can leave the conclusion Open without invalidating universal elimination. No assumption/subproof UI or unrestricted universal introduction is added.

`quantifier-r27-test.js` covers positive and negative instances, explicit English, the one-move boundary, capture, shadowing, witness dependencies and map assessments. An independent two-element relation-model evaluator supplements these tests.
