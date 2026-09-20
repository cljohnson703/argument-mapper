'use strict';
const fs = require('fs'), assert = require('assert/strict'), path = require('path');
const {JSDOM, VirtualConsole} = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || 'argument-mapper-r27.html','utf8'), {
    runScripts:'dangerously', pretendToBeVisual:true, url:'https://localhost/language-test', virtualConsole:vc,
    beforeParse(w) {
        w.matchMedia = () => ({matches:false,addListener(){},addEventListener(){}});
        w.ResizeObserver = class {observe(){} unobserve(){} disconnect(){}};
        const ctx = new Proxy({}, {get:(_,p) => p === 'measureText' ? (() => ({width:40})) : (() => ctx)});
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
        w.alert = () => {}; w.confirm = () => true; w.prompt = () => null;
    }
});
const call = (fn,input) => { dom.window.__input = input; return dom.window.eval(`(${fn})(window.__input)`); };
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname,'logical-locutions-r27.json'),'utf8'));
let count = 0; const failures = [];
function check(ok,label) { count++; if (!ok) failures.push(label); }
try {
    const variants = JSON.parse(fs.readFileSync(path.join(__dirname,'language-data/reviewed-variants.json'),'utf8'));
    for (const frame of ["We aren't sure",'We are not certain',"One isn't sure",'One is not certain',"I am not sure","They aren't certain"]) {
        check(call(`x => claimUnestablishedOf(parseClaim(x+' that Poe is black'),parseClaim('Poe is black'))`,frame),'uncertainty: '+frame);
    }
    for (const frame of ["We can't rule out",'One cannot rule out','It cannot be ruled out','We can’t rule out the possibility']) {
        for (const p of ['Poe is black','Poe is not black','Poe is black and Fido is white']) {
            check(call(`x => {
                const claim = parseClaim(x.p), f = parseClaim(x.frame+' that '+x.p);
                return f.kind === 'unestablished' && claimKey(f.inner) === claimKey(negateClaim(claim)) &&
                    !claimSame(f,claim) && !claimUnestablishedOf(f,claim);
            }`,{frame,p}),'rule out preserves scope: '+frame+' '+p);
        }
    }
    const analysisReading = call(`() => ['Ada analyses evidence','Ada analyzes evidence','Ada does not analyze evidence'].map(s => ({s,f:parseClaim(s),key:claimKey(parseClaim(s))}))`);
    check(call(`() => claimKey(parseClaim('Ada analyses evidence')) === claimKey(parseClaim('Ada analyzes evidence')) && claimDenies(parseClaim('Ada analyses evidence'),parseClaim('Ada does not analyze evidence'))`),'analyses as verb, not noun: '+JSON.stringify(analysisReading));
    for (const [a,b] of [['Ada did found companies','Ada did find companies'],['Ada did fell trees','Ada did fall trees'],['Ada did lay eggs','Ada did lie eggs']])
        check(call(`x => claimKey(parseClaim(x[0])) !== claimKey(parseClaim(x[1]))`,[a,b]),'auxiliary disambiguates homographs: '+a);
    for (const [uk,us] of call(`() => Object.entries(CLAIM_VENDOR_MORPHOLOGY.spellings)`)) {
        check(call(`x => claimSame(parseClaim('Poe is '+x[0]),parseClaim('Poe is '+x[1]))`,[uk,us]),'regional spelling: '+uk);
        check(call(`x => !claimSame(parseClaim('Poe is '+x[0][0].toUpperCase()+x[0].slice(1)),parseClaim('Poe is '+x[1][0].toUpperCase()+x[1].slice(1)))`,[uk,us]),'preserve proper-name spelling: '+uk);
        check(call(`x => (certifyStep([parseClaim('If Poe is '+x[0]+', then Poe is happy'),parseClaim('Poe is '+x[1])],[parseClaim('Poe is happy')],false)||{}).name === 'modus ponens'`,[uk,us]),'regional MP: '+uk);
    }
    for (const [base,pairs] of Object.entries(variants.pastAlternatives)) for (const [a,b] of Object.entries(pairs)) {
        check(call(`x => claimKey(parseClaim('Ada '+x.a)) === claimKey(parseClaim('Ada '+x.b)) && claimDenies(parseClaim('Ada '+x.a),parseClaim('Ada did not '+x.base))`,{a,b,base}), 'reviewed past alternatives: '+a);
    }
    for (const [uk,us] of Object.entries(variants.verbSpellingPairs)) {
        check(call(`x => (certifyStep([parseClaim('If Ada '+x[0]+'s evidence, then Ada is happy'),parseClaim('Ada '+x[1]+'s evidence')],[parseClaim('Ada is happy')],false)||{}).name === 'modus ponens'`,[uk,us]),'regional verb MP: '+uk);
        for (const [sentence,denial] of [[`Ada ${uk}s evidence`,`Ada does not ${us} evidence`],
            [`Ada ${uk}d evidence`,`Ada did not ${us} evidence`]])
            check(call(`x => claimDenies(parseClaim(x[0]),parseClaim(x[1]))`,[sentence,denial]),'regional verb denial: '+sentence);
    }
    for (const [plural,singular] of Object.entries(variants.compoundPlurals)) {
        check(call(`x => claimKey(parseClaim('All '+x.plural+' are happy')) === claimKey(parseClaim('Every '+x.singular+' is happy'))`,{plural,singular}),'compound plural: '+plural);
        if (!plural.includes(' ')) check(call(`x => claimPluralWord(x.plural) && !claimPluralWord(x.singular)`,{plural,singular}),'compound number: '+plural);
    }
    for (const [a,b] of [
        ['Ada wrote','Ada has written'], ['Ada was writing','Ada wrote'],
        ['Ada has written','Ada had written'], ['Ada sees Bea','Bea sees Ada'],
        ['Poe is a licence','Poe is a license'], ['Poe is a promise','Poe is a promize'],
        ['Poe is a metre','Poe is a meter'],
        ['We cannot rule out that Poe is black','We cannot conclude that Poe is black'],
        ['It is not the case that Poe is black and Fido is white','Poe is not black and Fido is not white']
    ]) check(call(`x => claimKey(parseClaim(x[0])) !== claimKey(parseClaim(x[1]))`,[a,b]),'preserve meaning: '+a);
    for (const group of corpus.equivalent) for (const text of group.forms) {
        check(call(`input => claimKey(parseClaim(input.text)) === claimKey(parseClaim(input.canonical))`, {text,canonical:group.canonical}), text);
    }
    for (const [a,b] of corpus.distinct) check(call(`input => claimKey(parseClaim(input.a)) !== claimKey(parseClaim(input.b))`,{a,b}), 'distinct: '+a);
    for (const text of corpus.equivalent[0].forms) {
        check(call(`text => (certifyStep([parseClaim(text),parseClaim('Poe is a raven')], [parseClaim('Poe is black')],false)||{}).name === 'modus ponens'`,text), 'MP: '+text);
        check(call(`text => !certifyStep([parseClaim(text),parseClaim('Poe is black')], [parseClaim('Poe is a raven')],false)`,text), 'no converse: '+text);
        check(call(`text => (certifyStep([parseClaim(text),parseClaim('Poe is not black')], [parseClaim('Poe is not a raven')],false)||{}).name === 'modus tollens'`,text), 'MT: '+text);
    }
    const audit = JSON.parse(fs.readFileSync(path.join(__dirname,'language-data/audit.json'),'utf8'));
    for (const row of audit.verbs.filter(r => r.disposition === 'imported past form')) {
        const past = row.forms[0][0];
        check(call(`input => { const a = parseClaim('Ada '+input.past), n = parseClaim('Ada did not '+input.base);
            return claimDenies(a,n) && claimKey(a) !== claimKey(parseClaim('Ada does '+input.base)); }`,{past,base:row.base}), 'verb: '+row.base+'/'+past);
    }
    for (const row of audit.nouns.filter(r => r.disposition === 'imported plural')) {
        check(call(`input => claimKey(parseClaim('All '+input.plural+' are observable')) === claimKey(parseClaim('Every '+input.singular+' is observable'))`,row), 'noun: '+row.singular+'/'+row.plural);
    }
    check(audit.verbs.length === Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname,'language-data/verbs.json'),'utf8'))).length, 'every source verb has an audit row');
    check(audit.nouns.length === Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname,'language-data/plurals.json'),'utf8'))).length, 'every source noun has an audit row');
    check(call(`() => !Object.hasOwn(CLAIM_VENDOR_MORPHOLOGY.past,'lay') && !Object.hasOwn(CLAIM_VENDOR_MORPHOLOGY.plurals,'axes')`), 'ambiguous source forms are not silently normalized');
    for (const word of call(`() => CLAIM_VENDOR_MORPHOLOGY.participles`)) check(call(`word => CLAIM_PARTICIPLES.has(word)`,word), 'source participle: '+word);
    require('child_process').execFileSync(process.execPath,[path.join(__dirname,'build-morphology-data.js'),'--check']);
    check(errors.length === 0, errors.join('; '));
    assert.equal(failures.length,0,failures.join('\n'));
    console.log(count+' source-data and general logical-locution checks passed.');
} finally {dom.window.close();}
