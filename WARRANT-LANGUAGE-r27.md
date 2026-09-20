# Explicit warrant claims in r27

A box can deny that a specified argument establishes its conclusion without asserting that the conclusion is false. Write the conclusion explicitly and quote the complete premises. For example:

> The premises “Zombies are metaphysically possible” and “If zombies are metaphysically possible, then consciousness is non-physical” do not establish that consciousness is non-physical.

The quotation identifies sentences, not a named argument or a neighboring box. Premise order does not matter; omitted, additional, or changed premises do not identify the same premise set. Existing strict spelling and spacing checks still apply.

## Recognized constructions

Explicit regression coverage includes “we/one can't conclude that”, “it can't be concluded that”, “we/one can't be certain that”, and “it isn't certain that”. Each accepts expanded contractions (`cannot`, `can not`, `is not`) and straight or curly apostrophes. With a complete quoted premise list introduced by `from`, these constructions also receive map-level tests: the objection retains its modus ponens certificate both before and after a required premise is undercut. Without that list, they are qualified challenges to the explicit conclusion, not references to an unspecified argument. “Whether P”, uncertainty about not-P, and assertions of not-P remain distinct from uncertainty about P. The misspelling “conluded” is not registered as “concluded”.

The following are templates, not suggested standalone box texts. Replace **Q** with the complete quoted premise list and **C** with the explicit conclusion.

| Construction | Examples of registered vocabulary |
|---|---|
| The premises Q do not establish that C | establish, show, demonstrate, prove |
| Q cannot establish that C | cannot, can't, do not, don't, fail to, don't suffice to |
| Q do not warrant concluding that C | warrant, justify, license; concluding, inferring, believing, accepting, asserting, claiming |
| Q do not provide sufficient grounds for concluding that C | provide, supply, give, furnish, offer; warrant, justification, grounds, evidence, support |
| Q are insufficient to establish that C | insufficient, inadequate, not sufficient, not enough |
| Q fall short of establishing that C | establishing, showing, demonstrating, proving, warranting, justifying |
| Q are inadequate for demonstrating that C | establishing, showing, demonstrating, proving |
| The conclusion that C has not been established by Q | is not, has not been, has not yet been, cannot be; established, shown, demonstrated, proved, proven, concluded, inferred |
| C is not justified on the basis of Q | justified, warranted; by, from, on the basis of |
| We cannot conclude that C from Q | we, I, you, one, they; conclude, infer, believe, accept, assert, claim |
| We cannot conclude from Q that C | from, on the basis of, on the strength of |
| Given Q, we cannot conclude that C | given, from, on the basis of, on the strength of |
| We are not justified in believing that C from Q | justified, warranted; believing, concluding, inferring, accepting, asserting, claiming |
| We are not entitled to conclude that C from Q | am/is/are, with the relevant speaker |
| It is unwarranted to infer that C from Q | unwarranted, unjustified, not warranted, not justified |
| There are insufficient grounds from Q for concluding that C | insufficient, inadequate, not enough, no adequate, no sufficient |
| We have no reason to believe that C from Q | existing warrant/grounds vocabulary also supports quoted premise lists |
| Q give us no basis to conclude that C | give, provide, supply, offer, furnish; basis, grounds, warrant, justification, reason, evidence, support |
| Q do not give us an adequate reason to conclude that C | sufficient, adequate, enough, any; optional explicit recipient |
| Q leave the conclusion that C unestablished | unestablished, unproven, unproved, unwarranted, unjustified, and their explicit negations |
| The conclusion that C remains unestablished by Q | remains, is still; unestablished, unproven, unproved, unwarranted, unjustified |
| Q stop short of establishing that C | establishing, showing, demonstrating, proving, warranting, justifying |
| We cannot reasonably infer that C from Q | reasonably, justifiably, legitimately; active and passive forms |
| From Q, it cannot be established that C | passive premise-first construction |
| From Q, there is no warrant for concluding that C | basis, grounds, warrant, justification, reason, evidence, support |
| To infer that C from Q would be unwarranted | infinitive or gerund as subject; unwarranted, unjustified, not warranted, not justified |
| Q are not enough to justify the conclusion that C | warrant, justify, license; conclusion, claim, belief |
| Nothing in Q establishes that C | establishes, shows, demonstrates, proves, warrants, justifies |
| We lack a basis for concluding that C from Q | lack a basis, lack an adequate reason, have no basis, do not have a sufficient basis, and related combinations |
| Q are not a sufficient basis for believing that C | a sufficient basis, an adequate reason, and related combinations |

The parser combines the phrase families; it does not register every sentence separately. `CLAIM_NOT_CONTRACTIONS` and `expandClaimContractions` normalize common contractions, including curly apostrophes. Straight single/double and curly single/double quotation marks are supported. Possessive apostrophes inside a quoted sentence remain part of that sentence. Commas, an Oxford comma, and conjunctions inside quoted premises are tested.

Quoted contents are masked before matching the surrounding construction, then restored before parsing the embedded claims. Thus a premise containing “does not establish that” cannot supply the outer sentence’s warrant verb. Leading “Taken together,” and the equivalent registered introductions are supported.

`WARRANT_RELATIONS` defines the new construction families. The existing `CLAIM_NOT_ESTABLISHED`, `CLAIM_UNESTABLISHED_AFTER`, and `CLAIM_GROUNDS_LACKING` registries remain in use. `claimQuotedPremises` validates explicit premise lists. Recognized quoted warrant paraphrases match structurally while preserving the identities of the embedded claims.

## Evaluation

1. Parse the warrant claim into its explicit conclusion and quoted premise set.
2. Match an objection's complete premise group against that set.
3. Certify the inference to the named conclusion using the existing rule engine.
4. Evaluate premise challenges independently of inference validity.
5. Show the actual inferred conclusion and explain whether the argument establishes it.

A surviving certified argument defeats the warrant claim. A successful weak rebuttal to a required premise supports the warrant claim while leaving the underlying conclusion open on this argument. Another argument may settle the conclusion. Merely failing to recognize an inference is not proof of invalidity or lack of warrant.

## Boundaries

The current regression corpus exercises 796 warrant templates in four quotation styles, plus map evaluation, local references, morphology, and negative examples. Additional sweeps cover nominal forms (belief, acceptance, inference), possessives, omitted “that,” perfect aspect, source prepositions, sufficiency, and contractions. These are compositional constructions, not a promise to recognize arbitrary English. General logical-expression coverage is documented separately in `STANDARD-LANGUAGE-r27.md`; online word-form snapshots and their audit are in `language-data/`.

The September 18 pass added nominal articles (“does not justify a belief that”), recipient phrases (“insufficient for us to conclude that”), and nominal absence of warrant (“the claim that C lacks justification from Q”). Tests distinguish these from two-sided openness, conditional insufficiency, and frequency qualifiers.

## Local references and word forms

References may resolve within one premise. Supported warrant frames include “Given Q, these premises …”, “from these premises: Q”, and “The argument from Q to C … its conclusion.” The quoted list and conclusion must determine a unique referent. Competing or missing referents produce an ambiguity flag and prevent certification, including identity steps. No reference is resolved using another box.

The ordinary sentence reader also resolves simple named subjects in conditionals and conjunctions, such as “If Poe is a raven, then it is black” and “Ada is tall and she is kind.” It retains the existing quantified binding in “If something is a raven, then it is black.” It conservatively flags more complicated pronoun constructions it cannot resolve. Dummy weather subjects, including “It had rained,” are not entity references; “it is hot” with an available entity can be ambiguous.

Irregular past forms, participles, alternative past spellings, and plural nouns have additional regression coverage. Tests preserve tense and number: “went” is keyed with “did go,” not “goes”; “All geese” agrees with “Every goose,” but “the geese” is not “the goose.” The quoted premise identity checks still apply. Consonant-y plurals and common -ie exceptions (including “zombies”) are tested. “Axes,” “bases,” and “ellipses” retain their spelling and flag ambiguous singularization.

Present-tense exceptions include “lies/lie,” “quizzes/quiz,” “focuses/focus,” and “biases/bias.” A verb following do/does is already bare and is not singularized again. Alternate past spellings such as travelled/traveled and focussed/focused share their past-tense key; -ic verbs use -icked. Additional plural spellings include cactuses, syllabuses, statuses, and quizzes.

For the registered invariant nouns (sheep, deer, moose, fish, salmon, trout, bison, aircraft, spacecraft, offspring, species, series, means), a definite subject retains the number supplied by its determiner or verb. “The sheep is observable” and “the sheep are observable” differ, including under negation. A plural group is not a singular quantifier instance. “The sheep can move” leaves number unresolved, so it is flagged; “this sheep” or “these sheep” resolves that uncertainty. Local pronouns preserve the resolved antecedent's number. Generated noun inflections leave these nouns unchanged.

Reference audits used [Ginger’s irregular verb list](https://www.gingersoftware.com/content/grammar-rules/verbs/list-of-irregular-verbs) and the [irregular-plurals reference data](https://github.com/sindresorhus/irregular-plurals/blob/main/irregular-plurals.json). Neither is treated as an exhaustive semantic dictionary. The plural reference includes uncountables and chooses one spelling for nouns with alternatives; it cannot be inverted blindly into a logic checker. Homographs such as “ground” and “wound” are used for past-form generation after an explicit auxiliary, rather than newly treated as automatic past-tense cues. Complex word senses and arbitrary pronoun resolution remain outside the guaranteed grammar.

“Do not entail,” “might not establish,” “do not disprove,” and “the conclusion is false” do not mean “do not establish.” Plain P does not imply that P is known or necessary. “Not necessarily P” retains its existing ambiguity analysis; explicit epistemic challenges retain their weak-challenge behavior.

“It does not follow from Q that C” is a denial of entailment, just like “C does not follow from Q.” “Whether C” asks about both sides and is not treated as a one-sided denial of warrant for C. “Has not yet established” concerns present warrant; it does not say “will never establish.” Merely inserting “conclusively,” “necessarily,” or “might” does not produce a registered equivalent.

No finite grammar covers every equivalent English sentence. These are supported constructions, not a completeness claim or a general English theorem prover. Unrecognized wording may remain uncertified. The broader existing stress corpus exercises symbolic and English rule instances, fallacies, modal ambiguities, and near misses. `warrant-r27-test.js` adds a separate paraphrase and behavior corpus for this feature.

Run `node warrant-r27-test.js` for the new corpus and `node run-all-tests.js` for all regressions. The optional diagnostic `node assessment-r27-test.js argument-mapper-r27.html path-to-map.json` reads a real map without modifying it.
