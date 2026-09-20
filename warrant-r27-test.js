'use strict';
const fs = require('fs');
const assert = require('assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [];
const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || 'argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/warrant-test', virtualConsole: vc,
    beforeParse(w) {
        w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
        w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        const ctx = new Proxy({}, { get: (_, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
        w.alert = () => {}; w.confirm = () => true; w.prompt = () => null;
    }
});
let count = 0;
const check = (condition, message) => { count++; assert.ok(condition, message); };
const call = (fn, arg) => { dom.window.__input = arg; return dom.window.eval(`(${fn})(window.__input)`); };
const P = ['Zombies are metaphysically possible', 'If zombies are metaphysically possible, then consciousness is non-physical'];
const C = 'consciousness is non-physical';
const templates = [];
// Explicit speaker/passive families: contractions must preserve qualification scope.
const epistemicFrames = [];
for (const denial of ["can't", 'cannot', 'can not', 'can’t']) {
    for (const subject of ['We', 'One']) for (const action of ['conclude', 'be certain'])
        epistemicFrames.push(`${subject} ${denial} ${action}`);
    epistemicFrames.push(`It ${denial} be concluded`);
}
for (const denial of ["isn't", 'is not', 'isn’t']) epistemicFrames.push(`It ${denial} certain`);
for (const frame of epistemicFrames) templates.push(q => `${frame} that ${C} from ${q}.`);
const locutions = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'warrant-locutions-r27.json'), 'utf8'));
templates.push(...locutions.supported.map(t => q => t.replaceAll('{Q}', q).replaceAll('{C}', C)));
for (const grounds of ['basis', 'grounds', 'warrant', 'justification', 'reason', 'evidence', 'support']) {
    for (const denial of ['have no', "don't have any", "don't have sufficient", "don't have adequate", 'lack']) {
        templates.push(q => `We ${denial} ${grounds} for concluding that ${C} from ${q}.`);
    }
    templates.push(q => `There is no ${grounds} for concluding that ${C} from ${q}.`);
}
for (const supply of ['give', 'provide', 'supply', 'offer', 'furnish']) {
    for (const grounds of ['basis', 'grounds', 'warrant', 'justification', 'reason', 'evidence', 'support']) {
        for (const act of ['conclude', 'infer', 'believe', 'accept', 'assert', 'claim']) {
            templates.push(q => `The premises ${q} ${supply} us no ${grounds} to ${act} that ${C}.`);
            templates.push(q => `The premises ${q} don't ${supply} us sufficient ${grounds} to ${act} that ${C}.`);
        }
    }
}
for (const status of ['unestablished', 'unproven', 'unproved', 'unwarranted', 'unjustified', 'not established', 'not proven', 'not proved', 'not warranted', 'not justified']) {
    templates.push(q => `The premises ${q} leave the conclusion that ${C} ${status}.`);
}
for (const manner of ['reasonably', 'justifiably', 'legitimately']) {
    for (const act of ['conclude', 'infer', 'believe', 'accept', 'assert', 'claim']) {
        templates.push(q => `We can't ${manner} ${act} that ${C} from ${q}.`);
    }
    for (const passive of ['concluded', 'inferred', 'asserted']) {
        templates.push(q => `The conclusion that ${C} cannot ${manner} be ${passive} from ${q}.`);
    }
}
for (const verb of ['establish', 'show', 'demonstrate', 'prove']) {
    for (const denial of ['do not', "don't", 'cannot', "can't", 'fail to', "don't suffice to", 'are insufficient to', "aren't sufficient to", 'are not enough to']) {
        templates.push(q => `The premises ${q} ${denial} ${verb} that ${C}.`);
    }
}
for (const verb of ['warrant', 'justify', 'license']) {
    for (const act of ['concluding', 'inferring', 'believing', 'accepting', 'asserting', 'claiming']) {
        templates.push(q => `The premises ${q} don't ${verb} ${act} that ${C}.`);
    }
}
for (const verb of ['provide', 'supply', 'give', 'furnish', 'offer']) {
    for (const ground of ['warrant', 'justification', 'grounds', 'evidence', 'support']) {
        templates.push(q => `The premises ${q} do not ${verb} sufficient ${ground} for concluding that ${C}.`);
    }
}
for (const participle of ['established', 'shown', 'demonstrated', 'proven', 'proved']) {
    for (const negative of ["isn't", "hasn't been", "hasn't yet been", "can't be"]) {
        templates.push(q => `The conclusion that ${C} ${negative} ${participle} by the premises ${q}.`);
    }
}
for (const speaker of ['We', 'I', 'You', 'One', 'They']) {
    for (const act of ['conclude', 'infer', 'believe', 'accept', 'assert', 'claim']) {
        templates.push(q => `${speaker} can't ${act} that ${C} from the premises ${q}.`);
        templates.push(q => `${speaker} cannot ${act} from the premises ${q} that ${C}.`);
    }
}
// Independently written examples, including premise-first and passive word order.
templates.push(
    q => `Given ${q}, we can't conclude that ${C}.`,
    q => `From the premises ${q}, one cannot infer that ${C}.`,
    q => `On the strength of ${q}, we cannot conclude that ${C}.`,
    q => `We aren't justified in believing that ${C} on the basis of ${q}.`,
    q => `I'm not entitled to conclude that ${C} from ${q}.`,
    q => `It's unjustified to infer that ${C} from ${q}.`,
    q => `It would be unwarranted to assert that ${C} on the basis of ${q}.`,
    q => `It hasn't yet been established that ${C} from ${q}.`,
    q => `There are insufficient grounds from ${q} for concluding that ${C}.`,
    q => `There is no adequate justification in ${q} for believing that ${C}.`,
    q => `We have no reason to believe that ${C} from ${q}.`,
    q => `There is insufficient warrant for concluding that ${C} from ${q}.`,
    q => `The premises ${q}, taken together, don't establish that ${C}.`,
    q => `The statements ${q} together do not demonstrate that ${C}.`,
    q => `The premises ${q} fall short of establishing that ${C}.`,
    q => `The premises ${q} are inadequate for demonstrating that ${C}.`,
    q => `The conclusion that ${C} can't be inferred from ${q}.`,
    q => `We can’t conclude that ${C} from ${q}.`,
    q => `The premises ${q} don’t establish that ${C}.`,
    q => `The premises ${q} stop short of establishing that ${C}.`,
    q => `The premises ${q} don't furnish a sufficient basis for concluding that ${C}.`,
    q => `The premises ${q} don't give us an adequate reason to believe that ${C}.`,
    q => `The premises ${q} are not enough to justify the conclusion that ${C}.`,
    q => `The conclusion that ${C} remains unestablished by ${q}.`,
    q => `Given ${q}, it cannot be established that ${C}.`,
    q => `From ${q}, it hasn't yet been shown that ${C}.`,
    q => `On the basis of ${q}, there is no warrant for concluding that ${C}.`,
    q => `To infer that ${C} from ${q} would be unwarranted.`,
    q => `Believing that ${C} on the basis of ${q} is unjustified.`,
    q => `Nothing in ${q} establishes that ${C}.`,
    q => `Taken together, the premises ${q} don't show that ${C}.`,
    q => `The premises ${q} aren't a sufficient basis for believing that ${C}.`,
    q => `The premises ${q} aren't an adequate reason to conclude that ${C}.`,
    q => `We lack a basis for concluding that ${C} from ${q}.`,
    q => `We lack an adequate reason to believe that ${C} from ${q}.`,
    q => `We don't have a sufficient basis for concluding that ${C} from ${q}.`
);
try {
    for (const frame of epistemicFrames) {
        const result = call(`frame => {
            const p = parseClaim('Poe is black'), n = parseClaim('Poe is not black');
            const f = parseClaim(frame + ' that Poe is black');
            const negative = parseClaim(frame + ' that Poe is not black');
            const whether = parseClaim(frame + ' whether Poe is black');
            return { weak: claimUnestablishedOf(f,p), denial: claimDenies(f,p),
                scope: claimUnestablishedOf(negative,n) && !claimUnestablishedOf(negative,p),
                whether: whether.kind === 'unestablished' && whether.whether && !claimSame(f,whether),
                positive: !claimSame(f,parseClaim('We can conclude that Poe is not black')) };
        }`,frame);
        check(result.weak && !result.denial && result.scope && result.whether && result.positive,
            'qualification and negation scope: '+frame+' '+JSON.stringify(result));
        const map = call(`input => {
            const root = {id:'M',type:'contention',texts:[input.text],children:[
                {id:'A',type:'objection',texts:input.p,children:[]}]};
            const run = () => {
                const steps = collectDeductiveSteps([root]);
                return {status:claimMapVerdict([root],steps)('M',0).status,
                    mp:steps.some(s => s.warrantTarget && s.rule && s.rule.name === 'modus ponens')};
            };
            const accepted = run();
            root.children[0].children.push({id:'W',type:'weak-rebuttal',
                texts:['It has not been shown that zombies are metaphysically possible'],children:[]});
            return {accepted,undercut:run()};
        }`,{text:`${frame} that ${C} from ${P.map(p => '"'+p+'"').join(' and ')}.`,p:P});
        check(map.accepted.status === 'refuted' && map.accepted.mp &&
            map.undercut.status === 'established' && map.undercut.mp,
            'valid MP survives undercutting for '+frame+': '+JSON.stringify(map));
    }
    const bad = [];
    for (const quotes of [['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’']]) {
        const q = P.map(p => quotes[0] + p + quotes[1]).join(' and ');
        for (const template of templates) {
            const text = template(q);
            const result = call(`text => {
                const f = parseClaim(text);
                return { kind: f && f.kind, quoted: f && f.quotedPremises,
                    count: f && f.from && f.from.length,
                    paraphrase: f && claimSame(f, parseClaim(${JSON.stringify(`We cannot conclude that ${C} from ` + P.map(p => '"' + p + '"').join(' and '))})),
                    same: f && f.from && sameClaims(f.from, ${JSON.stringify(P)}.map(parseClaim)),
                    conclusion: f && f.inner && claimSame(f.inner, parseClaim(${JSON.stringify(C)})) };
            }`, text);
            count++;
            if (!(result.kind === 'unestablished' && result.quoted && result.count === 2 && result.same && result.conclusion && result.paraphrase)) bad.push({ text, result });
        }
    }
    assert.equal(bad.length, 0, JSON.stringify(bad.slice(0, 12), null, 2));
    const q = P.map(p => '"' + p + '"').join(' and ');
    const main = `The premises ${q} do not establish that ${C}.`;
    for (const template of locutions.distinct) {
        const text = template.replaceAll('{Q}', q).replaceAll('{C}', C);
        const equal = call(`input => claimSame(parseClaim(input.text), parseClaim(input.main))`, { text, main });
        check(!equal, 'preserve distinct meaning: ' + text);
    }
    for (const template of locutions.ambiguous) {
        const text = template.replaceAll('{Q}', q).replaceAll('{C}', C);
        const result = call(`text => { const r = parseClaimFull(text); return { flag: r.notes.some(n => n.kind === 'ambiguous' && n.always),
            identity: !!certifyStep([r.form], [r.form], false) }; }`, text);
        check(result.flag && !result.identity, 'unresolved local reference is flagged, even in an identity step: ' + text);
    }
    const results = call(`input => {
        const n = (id, type, texts, children = []) => ({id, type, texts, children, collapsed: [], x: 30000, y: 30000});
        const a = n('A', 'objection', input.p.slice());
        const root = n('M', 'contention', [input.main], [a]);
        const run = () => { const ss = collectDeductiveSteps([root]), vv = claimMapVerdict([root], ss), st = ss[0];
            return { status: vv('M', 0).status, rule: st.rule && st.rule.name, target: !!st.warrantTarget,
                why: st.warrantTarget && warrantStepExplanation(st, vv) }; };
        const accepted = run();
        a.children = [n('W', 'weak-rebuttal', ['It has not been shown that zombies are metaphysically possible'])];
        const challenged = run();
        a.children[0].children = [n('R', 'rebuttal', ['It is not the case that it has not been shown that zombies are metaphysically possible'])];
        const restored = run();
        a.children = []; a.texts.reverse(); const reordered = run();
        a.texts.push('Poe is a raven'); const extra = run();
        a.texts = input.p.slice(0, 1); const missing = run();
        a.texts = ['Zombies are conceivable', input.p[1]]; const changed = run();
        a.texts = input.p; a.type = 'support'; const wrongDirection = run();
        a.type = 'objection'; a.children = [n('W', 'weak-rebuttal', ['It has not been shown that zombies are metaphysically possible'])];
        state.trees = [root]; selectedIds = []; deductiveLive = true; render(); openDeductiveCheck();
        return { accepted, challenged, restored, reordered, extra, missing, changed, wrongDirection,
            tag: document.querySelector('.derivation-tag[data-step="A"]').title,
            row: document.querySelector('.logic-step[data-step="A"]').textContent };
    }`, { main, p: P });
    check(results.accepted.status === 'refuted', 'accepted argument defeats warrant claim');
    check(results.challenged.status === 'established', 'weak rebuttal establishes warrant challenge');
    check(results.restored.status === 'refuted', 'rebutting the weak rebuttal restores the argument');
    for (const name of ['accepted', 'challenged', 'restored', 'reordered']) check(results[name].rule === 'modus ponens', name + ': inference stays valid');
    for (const name of ['extra', 'missing', 'changed', 'wrongDirection']) check(!results[name].target && !results[name].rule, name + ': no misleading warrant certificate');
    check(/leaves the conclusion open/.test(results.tag), 'tag separates inference and warrant: ' + results.tag);
    check(!/∴ not:/.test(results.row) && /∴consciousness is non-physical/.test(results.row), 'list shows the actual derived conclusion');
    const negative = [
        `The premises ${q} do not entail that ${C}.`,
        `The premises ${q} do not imply that ${C}.`,
        `${C} does not follow from ${q}.`,
        `It doesn't follow from ${q} that ${C}.`,
        `The premises ${q} might not establish that ${C}.`,
        `The premises ${q} establish that ${C}.`,
        `The premises ${q} do not disprove that ${C}.`,
        `The premises ${q} do not conclusively establish that ${C}.`,
        `The premises ${q} will never establish that ${C}.`,
        `The premises ${q} may fail to establish that ${C}.`,
        `The premises ${q} do not necessarily establish that ${C}.`,
        `We cannot conclude whether ${C} from ${q}.`,
        `The premises ${q} are unlikely to establish that ${C}.`,
        `The zombie argument does not establish that ${C}.`,
        `These premises do not establish that ${C}.`,
        `The premises ${q} do not establish that conclusion.`
    ];
    for (const text of negative) {
        const special = call(`input => { const root = {id:'M',type:'contention',texts:[input.text],children:[{id:'A',type:'objection',texts:input.p,children:[]}]}; return !!collectDeductiveSteps([root])[0].warrantTarget; }`, { text, p: P });
        check(!special, 'near miss: ' + text);
    }
    const structural = call(`() => {
        const three = claimQuotedPremises(normalizeClaimText('"Poe is a raven", "Grass is green", and "If Poe is a raven and grass is green, then Poe is black"'));
        const apostrophe = claimQuotedPremises(normalizeClaimText("'Mary's bird is black' and 'If Mary's bird is black, then Poe is black'"));
        const epistemic = parseClaim('For all we know, Poe is not black');
        const ordinary = parseClaim('Poe is black');
        return { count: three && three.length, apostrophe: apostrophe && apostrophe.length,
            equivalent: claimUnestablishedOf(epistemic, ordinary) && claimUnestablishedOf(parseClaim('It is not known that Poe is black'), ordinary),
            knowledge: claimSame(ordinary, parseClaim('It is known that Poe is black')),
            necessity: claimSame(ordinary, parseClaim('It is logically necessary that Poe is black')),
            modalNotes: parseClaimFull('Poe is not necessarily black').notes.length };
    }`);
    check(structural.count === 3, 'Oxford comma and conjunction inside a quoted premise');
    check(structural.apostrophe === 2, 'possessive apostrophes inside single quotes');
    check(structural.equivalent, 'epistemic possibility of not-P stays a weak challenge to P');
    check(!structural.knowledge && !structural.necessity, 'plain assertions acquire no knowledge or necessity operator');
    check(structural.modalNotes > 0, 'not necessarily retains modal ambiguity information');
    const safety = call(`input => {
        const a = {id:'A', type:'objection', texts:input.p, children:[]};
        const root = {id:'M', type:'contention', texts:[input.main], children:[a]};
        const snapshot = () => { const ss = collectDeductiveSteps([root]); const vv = claimMapVerdict([root], ss);
            return { status: vv('M',0).status, rule: ss[0].rule && ss[0].rule.name }; };
        a.children = [{id:'S',type:'support',texts:['Poe is a raven','If Poe is a raven, then zombies are metaphysically possible'],children:[
            {id:'W',type:'weak-rebuttal',texts:['It has not been shown that Poe is a raven'],children:[]}
        ]}];
        const nested = snapshot();
        root.texts = ['The premises "Poe is a bird" and "Grass is green" do not establish that Poe is black'];
        a.texts = ['Poe is a bird','Grass is green'];
        a.children = [{id:'W',type:'weak-rebuttal',texts:['It has not been shown that Poe is a bird'],children:[]}];
        const uncertified = snapshot();
        return {nested, uncertified};
    }`, { main, p: P });
    check(safety.nested.status === 'established' && safety.nested.rule === 'modus ponens', 'nested undercut supports warrant claim without invalidating inference');
    check(safety.uncertified.status === 'unresolved' && !safety.uncertified.rule, 'uncertified inference requires clarification and is not proof of a warrant claim');
    for (const quotes of [['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’']]) {
        const trickyPremises = ['The evidence does not establish that Poe is black', 'If the evidence does not establish that Poe is black, then Poe is a raven'];
        const list = trickyPremises.map(p => quotes[0] + p + quotes[1]).join(' and ');
        for (const text of [
            `The premises ${list} do not establish that Poe is a raven`,
            `We cannot conclude from ${list} that Poe is a raven`,
            `Given ${list}, it cannot be established that Poe is a raven`
        ]) {
            const parsed = call(`input => { const f = parseClaim(input.text); return f && f.kind === 'unestablished' && f.quotedPremises &&
                sameClaims(f.from, input.premises.map(parseClaim)) && claimSame(f.inner, parseClaim('Poe is a raven')); }`, { text, premises: trickyPremises });
            check(parsed, 'outer wording ignores quoted warrant vocabulary: ' + text);
        }
    }
    for (const [sentence, explicit] of [
        ['If Poe is a raven, then it is black', 'If Poe is a raven, then Poe is black'],
        ['Ada is tall and she is kind', 'Ada is tall and Ada is kind'],
        ['The geese are noisy and they are hungry', 'The geese are noisy and the geese are hungry'],
        ['If something is a raven, then it is black', 'Every raven is black']
    ]) {
        const result = call(`input => { const r = parseClaimFull(input.sentence); return {same: claimKey(r.form) === claimKey(parseClaim(input.explicit)),
            flagged: r.notes.some(n => n.kind === 'ambiguous' && n.always)}; }`, {sentence,explicit});
        check(result.same && !result.flagged, 'unique same-premise referent: ' + sentence + ' ' + JSON.stringify(result));
    }
    for (const sentence of ['She is kind', 'Ada is tall and Bea is kind and she is happy',
        'If Ada is a friend of Bea, then she is kind', 'If something is a stove, then it is hot', 'If Poe is a stove, then it is hot',
        'The geese are noisy and it is hungry']) {
        const result = call(`text => { const r = parseClaimFull(text); return {flag: r.notes.some(n => n.kind === 'ambiguous' && n.always),
            certified: !!certifyStep([r.form],[r.form],false)}; }`, sentence);
        check(result.flag && !result.certified, 'unresolved or competing referents prevent certification: ' + sentence);
    }
    check(call(`() => (certifyStep(['Poe is a raven', 'If Poe is a raven, then it is black'].map(parseClaim),
        [parseClaim('Poe is black')], false) || {}).name`) === 'modus ponens', 'resolved local pronoun participates in a certified inference');
    for (const [inflected,base] of [['lies','lie'], ['dies','die'], ['ties','tie'], ['vies','vie'], ['belies','belie'],
        ['underlies','underlie'], ['unties','untie'], ['quizzes','quiz'], ['whizzes','whiz'], ['buses','bus'],
        ['busses','bus'], ['focuses','focus'], ['focusses','focus'], ['gases','gas'], ['biases','bias'], ['aliases','alias']]) {
        const result = call(`input => { const a = parseClaim('Ada ' + input.inflected), b = parseClaim('Ada does ' + input.base),
            n = parseClaim('Ada doesn’t ' + input.base); return claimKey(a) === claimKey(b) && claimDenies(a,n); }`, {inflected,base});
        check(result, 'present inflection and contracted denial: ' + inflected + '/' + base);
    }
    const verbs = [
        ['dug','dig'], ['underwent','undergo'], ['misunderstood','misunderstand'], ['rewrote','rewrite'],
        ['retold','retell'], ['overthrew','overthrow'], ['outgrew','outgrow'], ['undid','undo'], ['redid','redo'],
        ['outdid','outdo'], ['overdid','overdo'], ['foretold','foretell'], ['forbore','forbear'], ['slew','slay'],
        ['went','go'], ['saw','see'], ['taught','teach'], ['bought','buy'], ['caught','catch'], ['chose','choose'],
        ['bit','bite'], ['laid','lay'], ['leant','lean'], ['lit','light'], ['lighted','light'], ['spilt','spill'], ['spat','spit'],
        ['travelled','travel'], ['cancelled','cancel'], ['labelled','label'], ['modelled','model'], ['marvelled','marvel'],
        ['levelled','level'], ['signalled','signal'], ['focussed','focus'], ['worshipped','worship'], ['benefitted','benefit'],
        ['panicked','panic'], ['picnicked','picnic'], ['trafficked','traffic']
    ];
    for (const [past, base] of verbs) {
        const result = call(`input => {
            const a = parseClaim('Ada ' + input.past), b = parseClaim('Ada did ' + input.base);
            const n = parseClaim('Ada didn’t ' + input.base), present = parseClaim('Ada does ' + input.base);
            return { same: claimKey(a) === claimKey(b), denial: claimDenies(a,n) && claimDenies(n,a),
                tense: claimKey(a) !== claimKey(present) };
        }`, {past,base});
        check(result.same && result.denial && result.tense, 'irregular tense and contracted denial: ' + past + '/' + base + ' ' + JSON.stringify(result));
    }
    for (const [base,past] of [['beat','beat'], ['shed','shed'], ['bear','bore'], ['grind','ground'], ['wind','wound']]) {
        const result = call(`input => claimPastForm(input.base) === input.past &&
            claimDenies(parseClaim('Ada did ' + input.base), parseClaim('Ada did not ' + input.base))`, {base,past});
        check(result, 'auxiliary determines past without guessing from bare homograph: ' + base);
    }
    for (const participle of ['arisen','awoken','borne','beaten','bitten','blown','forbidden','forgiven','frozen','lain','mown',
        'overtaken','rung','sawn','sewn','shaken','shrunk','sown','sunk','sworn','swollen','torn','undergone','rewritten']) {
        const result = call(`word => { const a = parseClaim('Ada has ' + word), b = parseClaim('Ada hasn’t ' + word);
            return CLAIM_PARTICIPLES.has(word) && claimDenies(a,b) && claimKey(a) !== claimKey(parseClaim('Ada had ' + word)); }`, participle);
        check(result, 'past participle supports contracted denial and preserves perfect tense: ' + participle);
    }
    const nouns = [['geese','goose'], ['children','child'], ['mice','mouse'], ['oxen','ox'], ['criteria','criterion'],
        ['analyses','analysis'], ['hypotheses','hypothesis'], ['formulae','formula'], ['larvae','larva'],
        ['vertebrae','vertebra'], ['alumnae','alumna'], ['antennae','antenna'], ['curricula','curriculum'],
        ['syllabi','syllabus'], ['foci','focus'], ['loci','locus'], ['radii','radius'], ['algae','alga'],
        ['strata','stratum'], ['errata','erratum'], ['memoranda','memorandum'], ['automata','automaton'],
        ['data','datum'], ['media','medium'], ['qualia','quale'], ['lice','louse'], ['elves','elf'], ['hooves','hoof'],
        ['scarves','scarf'], ['addenda','addendum'], ['antitheses','antithesis'], ['bacilli','bacillus'], ['codices','codex'],
        ['corpora','corpus'], ['genera','genus'], ['millennia','millennium'], ['minima','minimum'], ['maxima','maximum'],
        ['noumena','noumenon'], ['oases','oasis'], ['ova','ovum'], ['phyla','phylum'], ['polyhedra','polyhedron'],
        ['quanta','quantum'], ['spectra','spectrum'], ['synopses','synopsis'], ['vortices','vortex'], ['wharves','wharf'],
        ['passersby','passerby'], ['cities','city'], ['babies','baby'], ['theories','theory'], ['possibilities','possibility'],
        ['zombies','zombie'], ['movies','movie'], ['pies','pie'], ['cookies','cookie'], ['potatoes','potato'], ['heroes','hero'],
        ['cactuses','cactus'], ['funguses','fungus'], ['syllabuses','syllabus'], ['octopuses','octopus'], ['statuses','status'],
        ['bonuses','bonus'], ['buses','bus'], ['gases','gas'], ['biases','bias'], ['aliases','alias'], ['focuses','focus'],
        ['campuses','campus'], ['censuses','census'], ['viruses','virus'], ['apparatuses','apparatus'], ['prospectuses','prospectus'],
        ['quizzes','quiz'], ['fezzes','fez']];
    for (const [plural,singular] of nouns) {
        const result = call(`input => {
            const a = parseClaim('All ' + input.plural + ' are observable');
            const b = parseClaim('Every ' + input.singular + ' is observable');
            const n = parseClaim('Some ' + input.singular + ' is not observable');
            return {same: claimKey(a) === claimKey(b), denial: claimDenies(a,n),
                number: claimKey(parseClaim('The ' + input.plural + ' are observable')) !== claimKey(parseClaim('The ' + input.singular + ' is observable'))};
        }`, {plural,singular});
        check(result.same && result.denial && result.number, 'plural quantification preserves individual number: ' + plural + '/' + singular + ' ' + JSON.stringify(result));
    }
    for (const noun of ['sheep','deer','moose','fish','salmon','trout','bison','aircraft','spacecraft','offspring','species','series','means']) {
        const result = call(`noun => {
            const singular = parseClaim('The ' + noun + ' is observable'), plural = parseClaim('The ' + noun + ' are observable');
            const ns = parseClaim('The ' + noun + ' is not observable'), np = parseClaim('The ' + noun + ' are not observable');
            const unresolved = parseClaimFull('The ' + noun + ' can move');
            return claimKey(singular) !== claimKey(plural) && claimDenies(singular,ns) && claimDenies(plural,np) &&
                !claimDenies(singular,np) && !claimDenies(plural,ns) && claimPluralNoun(noun) === noun && claimSingularNoun(noun) === noun &&
                unresolved.notes.some(n => n.kind === 'ambiguous' && n.always) && !certifyStep([unresolved.form],[unresolved.form],false);
        }`, noun);
        check(result, 'unchanging noun distinguishes number, denial, and unresolved modal subject: ' + noun);
    }
    for (const [sentence,explicit] of [
        ['The sheep is hungry and it is noisy', 'The sheep is hungry and the sheep is noisy'],
        ['The sheep are hungry and they are noisy', 'The sheep are hungry and the sheep are noisy']
    ]) {
        check(call(`input => claimKey(parseClaim(input.sentence)) === claimKey(parseClaim(input.explicit))`, {sentence,explicit}),
            'local pronoun carries the antecedent number: ' + sentence);
    }
    check(call(`() => !!certifyStep(['Every sheep is observable', 'The sheep is a sheep'].map(parseClaim), [parseClaim('The sheep is observable')], false)`),
        'invariant singular noun remains eligible for universal instantiation');
    check(call(`() => !certifyStep(['Every sheep is observable', 'The sheep are sheep'].map(parseClaim), [parseClaim('The sheep is observable')], false)`),
        'plural group is not silently treated as one member');
    check(call(`() => (certifyStep(['The sheep are hungry', 'If the sheep are hungry, then they are noisy'].map(parseClaim),
        [parseClaim('The sheep are noisy')], false) || {}).name`) === 'modus ponens', 'plural local reference works in modus ponens');
    for (const [plural,a,b] of [['axes','axis','axe'], ['bases','basis','base'], ['ellipses','ellipsis','ellipse']]) {
        const result = call(`input => { const r = parseClaimFull('All ' + input.plural + ' are observable');
            return r.notes.some(n => n.kind === 'ambiguous' && n.always) &&
                claimKey(r.form) !== claimKey(parseClaim('Every ' + input.a + ' is observable')) &&
                claimKey(r.form) !== claimKey(parseClaim('Every ' + input.b + ' is observable')); }`, {plural,a,b});
        check(result, 'ambiguous plural cannot silently select a singular: ' + plural);
    }
    for (const sentence of ['Ada dug', 'All geese are observable', 'Ada has rewritten the report']) {
        const result = call(`sentence => {
            const p = [sentence, 'If ' + sentence + ', then Poe is black'];
            const root = {id:'M',type:'contention',texts:['The premises ' + p.map(s => JSON.stringify(s)).join(' and ') + ' do not establish that Poe is black'],
                children:[{id:'A',type:'objection',texts:p,children:[]}]};
            const steps = collectDeductiveSteps([root]);
            return !!steps[0].warrantTarget && steps[0].rule && steps[0].rule.name;
        }`, sentence);
        check(result === 'modus ponens', 'morphology inside quoted warrant premises: ' + sentence);
    }
    check(errors.length === 0, 'no page errors: ' + errors.join('; '));
    console.log(count + ' warrant checks passed (' + templates.length + ' wording templates × 4 quote styles, plus inference and interface checks).');
} finally { dom.window.close(); }
