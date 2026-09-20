# Online word-form snapshots

These are complete snapshots of the selected upstream datasets, not claims to contain every English word or sense.

* `verbs.json`: RosaeNLG `english-verbs-irregular`, 363 base verbs with arrays of [past, past participle] pairs. Copyright 2019 Ludan Stoecklé; Apache-2.0. The upstream README explicitly leaves choosing among alternative forms to the caller.
* `plurals.json`: Sindre Sorhus `irregular-plurals`, 419 entries; MIT. This source also includes regular spellings, nonchanging forms, mass nouns and demonstratives. It cannot safely be inverted as a complete singularization dictionary.

`sources.json` records exact upstream commit URLs and SHA-256 hashes. Original license files and upstream READMEs are retained. The upstream verb README has its own CC-BY-4.0 notice. Sources: [RosaeNLG](https://github.com/RosaeNLG/rosaenlg/tree/master/packages/english-verbs-irregular) and [irregular-plurals](https://github.com/sindresorhus/irregular-plurals).

## Import policy

Run `node build-morphology-data.js` to regenerate the embedded tables and `audit.json` offline. Run with `--check` to verify hashes and generated output. No dependency or network request is required to use the app.

Every source entry has an audit row. The automatic import currently provides 241 past-to-base mappings, 281 plural-to-singular mappings and 446 participle spellings. These counts include overlap with the prior hand-maintained tables. Curated entries take precedence; this import supplements them.

Multiple past forms are retained in the snapshot but are not automatically equated. Tense homographs, auxiliary verbs, ambiguous singulars, nonchanging nouns, demonstratives and forms outside the single-word grammar are classified explicitly. Existing parser rules can still handle some excluded entries. A disposition describes the import decision, not the full parser's ability to understand every sentence containing that word.

The generator preserves a source word's singular spelling (for example, cyclops) instead of stripping its final s. It keeps the original alternatives available for future work. The data do not perform word-sense disambiguation, and extending the lexicon does not make arbitrary English unambiguous.

The reviewed supplement now adds 12 past mappings from six source-verified alternative pairs (253 total past mappings), explicit regional spellings and eight compound plurals. `reviewed-variants.json` records the selection and references; `audit.json` includes it separately from the original automatic-import dispositions. Generator checks ensure selected past forms actually occur in the pinned source. Oxford and UPF spelling guidance informs the finite regional list; the implementation does not substitute arbitrary word endings.

To intentionally refresh upstream snapshots, run `fetch-morphology-sources.ps1` with network access, regenerate, inspect the audit changes, and rerun `language-r27-expanded-test.js` and the existing language regressions. Both original data licenses are embedded in the app's Help and survive the public build.
