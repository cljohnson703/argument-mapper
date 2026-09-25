'use strict';
const fs = require('fs'), assert = require('assert/strict');
const {JSDOM, VirtualConsole} = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || 'argument-mapper-r27.html','utf8'), {
    runScripts:'dangerously', pretendToBeVisual:true, url:'https://localhost/position-rules-test', virtualConsole:vc,
    beforeParse(w) {
        w.matchMedia = () => ({matches:false,addListener(){},addEventListener(){}});
        w.ResizeObserver = class {observe(){} unobserve(){} disconnect(){}};
        const ctx = new Proxy({}, {get:(_,p) => p === 'measureText' ? (() => ({width:40})) : (() => ctx)});
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
        w.alert = () => {}; w.confirm = () => true; w.prompt = () => null;
    }
});
const call = (fn,input) => {dom.window.__input = input; return dom.window.eval(`(${fn})(window.__input)`);};
let count = 0; const failures = [];
function check(ok,label) {count++; if (!ok) failures.push(label);}
const symbolic = s => /^(?:[PQRS]|not | or | )+$/.test(s) ? s.replaceAll('not ','¬').replaceAll(' or ',' ∨ ') : s;
const rule = (p,c) => call(`x => certifyStep(x.p.map(s => parseClaim(s)),[parseClaim(x.c)],false)?.id || null`,{p:p.map(symbolic),c:symbolic(c)});

try {
 const a='Poe is a raven', b='Poe is black';
 const same=(x,y)=>call(x=>claimSame(parseClaim(x[0]),parseClaim(x[1])),[x,y]);
 // Both positions, with and without then, must preserve direction and
 // actually work in an inference, not merely produce a similar parse key.
 for(const marker of ['if','provided','provided that','providing','providing that','as long as','so long as',
   'on condition that','on the condition that','in the event that','in the case that',
   'on the assumption that','assuming','assuming that','supposing','supposing that','whenever']) {
   for(const [p,q,notP,notQ] of [[a,b,'Poe is not a raven','Poe is not black'],['~P','Q','P','~Q']]) {
     for(const text of [`${marker} ${p}, ${q}`,`${marker} ${p}, then ${q}`,`${q} ${marker} ${p}`,`${q}, ${marker} ${p}`]) {
       check(same(text,`If ${p}, then ${q}`),'condition position: '+text);
       check(rule([text,p],q)==='modus-ponens','MP: '+text);
       check(rule([text,notQ],notP)==='modus-tollens','MT: '+text);
       check(!rule([text,q],p),'no affirming consequent: '+text);
     }
   }
 }
 for(const quote of [['',''],['"','"'],["'","'"],['“','”'],['‘','’']]) {
   const wrap=s=>quote[0]+s+quote[1];
   for(const [p,q] of quote[0] ? [['P','Q'],[a,b]] : [['P','Q']]) {
     for(const kind of ['necessary','sufficient','necessary and sufficient','sufficient and necessary']) {
       const expected=kind.includes(' and ')?`${p} iff ${q}`:kind==='sufficient'?`If ${p}, then ${q}`:`If ${q}, then ${p}`;
       for(const text of [`${wrap(p)} is ${kind} for ${wrap(q)}`,`${wrap(p)} is a ${kind} condition for ${wrap(q)}`,`A ${kind} condition for ${wrap(q)} is ${wrap(p)}`]) {
         check(same(text,expected),'necessary/sufficient frame: '+text);
         if(!kind.includes(' and ')) check(!same(text,kind==='sufficient'?`If ${q}, then ${p}`:`If ${p}, then ${q}`),'condition direction: '+text);
       }
     }
   }
   for(const clause of quote[0]?['P',a]:['P']) for(const copula of ['is',"isn't",'is not','isn’t']) {
     const text=`${wrap(clause)} ${copula} untrue`;
     check(same(text,copula==='is'?`It is not the case that ${clause}`:clause),'untrue polarity: '+text);
   }
 }
 // Passive that-clauses change position; neither their content nor warrant
 // status may change. Full clauses expose phrase-boundary mistakes.
 for(const clause of [a,'Poe is not black',`If ${a}, then ${b}`]) {
   for(const verb of ['concluded','inferred','determined','established','shown','proven','proved','demonstrated','ascertained','known','assumed','taken for granted']) {
     for(const denial of ['cannot',"can't",'can not','can’t']) {
       const front=`It ${denial} be ${verb} that ${clause}`;
       const back=`That ${clause} ${denial} be ${verb}`;
       check(same(front,back),'passive hedge position: '+back);
       check(rule([`If (${front}), then R`,back],'R')==='modus-ponens','passive hedge MP: '+back);
       check(!rule([front],clause),'hedge does not assert its content: '+front);
     }
   }
   for(const status of ['unestablished','unproved','unproven','undetermined','uncertain','unresolved']) {
     for(const verb of ['is','remains']) check(same(`It ${verb} ${status} that ${clause}`,`That ${clause} ${verb} ${status}`),'status position: '+status);
   }
   for(const passive of ['shown','established','proven','proved','demonstrated','settled','determined']) {
     check(same(`It has yet to be ${passive} that ${clause}`,`That ${clause} has yet to be ${passive}`),'yet position: '+passive);
     check(same(`It remains to be ${passive} that ${clause}`,`That ${clause} remains to be ${passive}`),'remains position: '+passive);
   }
 }
 const inner=`If ${a}, then ${b}`, hedge=`It cannot be established that ${inner}`;
 for(const [open,close] of [['(',')'],['"','"'],["'","'"],['“','”'],['‘','’']]) {
   for(const condition of [open+hedge+close,`It cannot be established that ${open}${inner}${close}`]) {
     for(const conditional of [`If ${condition}, then R`,`If ${condition}, R`,`R if ${condition}`,`R, if ${condition}`]) {
       check(rule([conditional,hedge],'R')==='modus-ponens','nested conditional scope: '+conditional);
     }
   }
 }
 const ambiguous=`If ${hedge}, then R`;
 check(call(s=>parseClaimFull(s).notes.some(n=>n.kind==='ambiguous'),ambiguous),'ungrouped nested conditional flagged');
 check(!rule([ambiguous,hedge],'R'),'ungrouped nested conditional not certified');
 check(!same('"P" "Q"','P & Q'),'separate quotes not stripped as one group');
 check(!same('(P) (Q)','P & Q'),'separate parentheses not stripped as one group');
 for(const [subject,be] of [['We','are'],['One','is'],['I','am'],['You','are'],['They','are']]) {
   for(const verb of ['conclude','infer','determine','establish','ascertain','show','prove','demonstrate','know','be sure','be certain']) {
     for(const phrase of ['unable to','not able to']) {
       const text=`${subject} ${be} ${phrase} ${verb} that ${a}`;
       const other=`${subject} cannot ${verb} that ${a}`;
       check(same(text,other),'ability paraphrase: '+text);
       check(rule([`If ${other}, then R`,text],'R')==='modus-ponens','ability MP: '+text);
     }
   }
 }
 // Reports with different subjects or epistemic force are not synonyms.
 for(const [x,y] of [
   [`I do not know that ${a}`,`You do not know that ${a}`],
   [`It has not been shown that ${a}`,`It cannot be shown that ${a}`],
   [`We cannot rule out that ${a}`,`We cannot conclude that ${a}`],
   ['Oxygen is necessary for life','If life, then oxygen'],
   ['Poe is untrue','~Poe'],
   [`We are able to establish that ${a}`,`We are unable to establish that ${a}`],
   [`It is probably true that ${a}`,a],
   [`It is known that ${a}`,a],
   [`It is logically necessary that ${a}`,a],
   ['All ravens are black','Some ravens are black']
 ]) check(!same(x,y),'do not conflate: '+x+' / '+y);
 // Source-backed alternates must work as co-premises, in either order,
 // while retaining the tense distinction from present/perfect forms.
 const variants=JSON.parse(fs.readFileSync('language-data/reviewed-variants.json','utf8'));
 for(const [base,forms] of Object.entries(variants.pastAlternatives)) for(const [x,y] of Object.entries(forms)) {
   for(const [first,second] of [[x,y],[y,x]]) {
     check(rule([`If Ada ${first}, then Ada is happy`,`Ada ${second}`],'Ada is happy')==='modus-ponens','past variant MP: '+first+'/'+second);
     check(call(x=>claimDenies(parseClaim(x[0]),parseClaim(x[1])),[`Ada ${first}`,`Ada did not ${base}`]),'past variant denial: '+first);
     check(!same(`Ada ${first}`,`Ada has ${first}`),'past/perfect not erased: '+first);
   }
 }
 const morphology=JSON.parse(fs.readFileSync('language-data/audit.json','utf8'));
 for(const {singular,plural} of morphology.nouns.filter(x=>x.disposition==='imported plural')) {
   check(rule([`All ${plural} are observable`,`Poe is a ${singular}`],'Poe is observable')==='universal-modus-ponens','noun inference: '+plural+'/'+singular);
   // No existential import, people included (2026-09-22): "all people are P"
   // is "∀x (person(x) → P(x))", true if there are no people.
   check(!rule([`All ${plural} are observable`],`Some ${plural} are observable`),'no existential import: '+plural);
 }
 for(const [plural,{singular}] of Object.entries(variants.nounVariants)) {
   check(rule([`All ${plural} are observable`,`Poe is a ${singular}`],'Poe is observable')==='universal-modus-ponens','reviewed plural inference: '+plural);
   check(!rule([`All ${plural} are observable`],`Some ${plural} are observable`),'reviewed plural has no existential import: '+plural);
   check(!same(`Poe is ${plural[0].toUpperCase()+plural.slice(1)}`,`Poe is ${singular[0].toUpperCase()+singular.slice(1)}`),'reviewed plural preserves proper names: '+plural);
 }
 for(const [plural,singular] of [['indexes','index'],['indices','index'],['appendixes','appendix'],['appendices','appendix'],
   ['formulas','formula'],['formulae','formula'],['cactuses','cactus'],['cacti','cactus'],['octopuses','octopus'],
   ['focuses','focus'],['foci','focus'],['funguses','fungus'],['fungi','fungus'],['syllabuses','syllabus'],['syllabi','syllabus'],
   ['antennas','antenna'],['antennae','antenna'],['mediums','medium'],['media','medium'],['fish','fish'],['fishes','fish'],
   ['dwarfs','dwarf'],['hoofs','hoof'],['hooves','hoof'],['scarfs','scarf'],['scarves','scarf'],['persons','person'],['people','person']]) {
   check(rule([`All ${plural} are observable`,`Poe is a ${singular}`],'Poe is observable')==='universal-modus-ponens','existing alternate plural: '+plural);
 }
 check(rule(['P -> Q','Q -> P'],'P <-> Q')!==null,'biconditional introduction already covered');
 check(!rule(['P -> Q','P -> R'],'P <-> Q'),'one direction insufficient for biconditional');
 for(const c of ['P','~P','P & Q','P -> Q','forall x P(x)']) check(rule(['⊥'],c)==='explosion','bottom elimination: '+c);
 check(!rule(['~⊥'],'P'),'not bottom does not explode');
 check(!rule(['P -> ⊥'],'Q'),'conditional bottom does not explode');
 check(!rule([`We cannot conclude that ${a}`,a],'Q'),'weak objection does not explode');
 check(rule(['~P -> ⊥'],'P')==='indirect-proof','retain classical reductio, now named indirect proof');
 check(call(()=>!logicalTheorem('P v ~P') && !logicalTheorem('P -> P')),'no automatic arbitrary tautologies');
 check(errors.length===0,errors.join('; '));
 assert.equal(failures.length,0,failures.join('\n'));
 console.log(count+' language position, morphology, hedge and rule audit checks passed.');
} finally {dom.window.close();}
