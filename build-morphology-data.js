'use strict';
// Offline, reproducible import. Raw snapshots and licenses live in language-data.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = __dirname;
const read = name => fs.readFileSync(path.join(root, 'language-data', name), 'utf8').replace(/^\uFEFF/, '');
const sources = JSON.parse(read('sources.json'));
for (const source of sources) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'language-data', source.file))).digest('hex');
    if (actual !== source.sha256) throw Error('Snapshot hash mismatch: ' + source.file);
}
const verbs = JSON.parse(read('verbs.json')), nouns = JSON.parse(read('plurals.json'));
const word = s => /^[a-z]+(?:-[a-z]+)*$/.test(s);
const ambiguousPast = new Set(['bore','lay','ground','wound','smelt','saw','fell','found','bound','left','rose','bid','read','shed']);
const ambiguousPlural = new Set(['axes','bases','ellipses','data','graffiti','premises']);
const past = {}, plurals = {}, participles = new Set(), audit = {verbs:[], nouns:[]};
const owners = {};
for (const [base, forms] of Object.entries(verbs)) for (const [p] of forms) (owners[p] ||= new Set()).add(base);
for (const [base, forms] of Object.entries(verbs)) {
    const spellings = [...new Set(forms.map(f => f[0]))];
    for (const [,p] of forms) if (word(p) && (!verbs[p] || p === base)) participles.add(p);
    let reason;
    if (!word(base) || spellings.some(p => !word(p))) reason = 'outside single-word grammar';
    else if (['be','have','do','lie'].includes(base)) reason = 'auxiliary or sense-sensitive: existing parser policy';
    else if (spellings.length !== 1) reason = 'multiple past forms: retained, not automatically equated';
    else if (spellings[0] === base) reason = 'unchanged tense spelling: requires context';
    else if (ambiguousPast.has(spellings[0]) || verbs[spellings[0]] || owners[spellings[0]].size !== 1) reason = 'homograph: requires context';
    else { past[spellings[0]] = base; reason = 'imported past form'; }
    audit.verbs.push({base, forms, disposition:reason});
}
const nounOwners = {};
for (const [s,p] of Object.entries(nouns)) (nounOwners[p] ||= new Set()).add(s);
for (const [s,p] of Object.entries(nouns)) {
    let reason;
    if (!word(s) || !word(p)) reason = 'outside single-word grammar';
    else if (s === p) reason = 'unchanged or uncountable: retained, existing number policy';
    else if (['this','that'].includes(s)) reason = 'demonstrative, not a noun';
    else if (ambiguousPlural.has(p) || nounOwners[p].size !== 1) reason = 'ambiguous singular: requires context';
    else { plurals[p] = s; reason = 'imported plural'; }
    audit.nouns.push({singular:s, plural:p, disposition:reason});
}
const reviewed = JSON.parse(read('reviewed-variants.json'));
// Explicitly reviewed alternate plurals supplement the one-form upstream
// table. Do not guess Latin endings or silently override a homograph.
for (const [plural, entry] of Object.entries(reviewed.nounVariants || {})) {
    if (!word(plural) || !word(entry.singular) || !/^https:\/\//.test(entry.source) ||
        ambiguousPlural.has(plural) || (plurals[plural] && plurals[plural] !== entry.singular)) {
        throw Error('Invalid reviewed plural: ' + plural);
    }
    plurals[plural] = entry.singular;
}
const spellings = {...reviewed.spellingPairs}, presentBases = {};
for (const [uk,us] of Object.entries(reviewed.verbSpellingPairs)) {
    presentBases[us+'s'] = us;
    for (const [a,b] of [[uk,us],[uk+'s',us+'s'],[uk+'d',us+'d'],[uk.slice(0,-1)+'ing',us.slice(0,-1)+'ing']]) spellings[a]=b;
}
const pastVariants = {};
// "Analyses" is also the plural noun of analysis; normalize only as a verb.
delete spellings.analyses;
for (const [base,pairs] of Object.entries(reviewed.pastAlternatives)) {
    audit.verbs.find(row => row.base === base).reviewedAlternatives = pairs;
    const forms = new Set(verbs[base].map(f => f[0]));
    for (const [variant,canonical] of Object.entries(pairs)) {
        if (!forms.has(variant) || !forms.has(canonical) || ambiguousPast.has(variant)) throw Error('Unverified alternative: '+variant);
        past[variant] = base;
        past[canonical] = base;
        pastVariants[variant] = canonical;
    }
}
audit.reviewed = reviewed;
const data = {past, plurals, participles:[...participles].sort(), spellings, presentBases, pastVariants, compoundPlurals:reviewed.compoundPlurals};
const js = '    // BEGIN GENERATED MORPHOLOGY\n    // Online source snapshots, licenses, exclusions: language-data/.\n    const CLAIM_VENDOR_MORPHOLOGY = ' + JSON.stringify(data) + ';\n    // END GENERATED MORPHOLOGY';
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const legal = '<!-- BEGIN MORPHOLOGY LICENSES -->\n<details><summary>Word-form data sources and licenses</summary><p>Adapted from RosaeNLG english-verbs-irregular and Sindre Sorhus irregular-plurals. The imported tables are filtered; local additions and ambiguity policies are described in the source distribution.</p><pre>' + escape(read('verbs-LICENSE.txt') + '\n\n' + read('plurals-LICENSE.txt')) + '</pre></details>\n<!-- END MORPHOLOGY LICENSES -->';
const file = path.join(root, 'argument-mapper-r27.html');
const old = fs.readFileSync(file, 'utf8');
let updated = old.includes('// BEGIN GENERATED MORPHOLOGY') ? old.replace(/    \/\/ BEGIN GENERATED MORPHOLOGY[\s\S]*?    \/\/ END GENERATED MORPHOLOGY/, js) : old.replace('    const CLAIM_GENERIC_HEADS', js + '\n    const CLAIM_GENERIC_HEADS');
updated = updated.includes('<!-- BEGIN MORPHOLOGY LICENSES -->') ? updated.replace(/<!-- BEGIN MORPHOLOGY LICENSES -->[\s\S]*?<!-- END MORPHOLOGY LICENSES -->/, legal) : updated.replace('        <h2>Cross-References</h2>', legal + '\n        <h2>Cross-References</h2>');
const report = JSON.stringify(audit, null, 2) + '\n';
const auditFile = path.join(root, 'language-data', 'audit.json');
if (process.argv.includes('--check')) {
    const normalizeLines = text => text.replace(/\r\n/g, '\n');
    if (normalizeLines(updated) !== normalizeLines(old) || normalizeLines(fs.readFileSync(auditFile,'utf8')) !== normalizeLines(report)) throw Error('Run node build-morphology-data.js to update generated data.');
} else {
    fs.writeFileSync(file, updated);
    fs.writeFileSync(auditFile, report);
}
console.log(JSON.stringify({sourceVerbs:Object.keys(verbs).length, sourceNouns:Object.keys(nouns).length,
    importedPast:Object.keys(past).length, importedPlurals:Object.keys(plurals).length, participles:participles.size}));
