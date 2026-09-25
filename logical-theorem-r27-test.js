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
 for(let n=1;n<=12;n++) for(let k=n+1;k>=0;k-=2) {
  const p='~'.repeat(n)+'P v (~P v Q)', c='~'.repeat(k)+'P -> (~P v Q)';
  check(rule([p],c)==='material-implication','material implication preserves/removes pairs: '+p+' => '+c);
 }
 check(!rule(['~~P v (~P v Q)'],'~~P -> (~P v Q)'),'opposite parity is invalid');
 check(rule(['~(P v ~P) -> (P & ~P)','(P & ~P) -> ⊥'],'~(P v ~P) -> ⊥')==='hypothetical-syllogism','excluded middle proof: HS');
 check(rule(['~(P v ~P) -> ⊥'],'P v ~P')==='indirect-proof','excluded middle proof: indirect proof');
 // Excluded middle from the basis alone, every extension off: with N for
 // ~(P v ~P), "N -> ~P", so "N -> (P v ~P)" and "N -> ~N"; ~N; P v ~P. No
 // curried instance ("(P v ~P) -> (N -> ⊥)" is exportation's work), no absorption.
 call(()=>{ setDeductiveRule([].concat.apply([], DEDUCTIVE_EXTENSIONS.map(g => g.rules)), false); setDeductiveRule(DEDUCTIVE_EXTENSIONS.filter(function (g) { return g.id === "core"; })[0].rules, true); });
 {
  // Every line of the library's derivation (logic-r27-basis-proofs.js), checked
  // in the app: rule instances, hypothetical syllogism, exportation, the one
  // reductio the basis has, and Negation Elimination. The ⊥ form of reductio
  // is derived on the way (negIntro), not assumed.
  const N='~(P v ~P)', E='(P v ~P)', inst=t=>call(x=>{ const r=logicalTheorem(x); return r ? r.rule.id : null; },t);
  const printN = n => n.op === 'andN' ? '(' + n.parts.map(printN).join(' ∧ ') + ')'
    : n.op === 'not' ? '¬' + (/^(?:pred|letter|not|bottom)$/.test(n.a.op) ? printN(n.a) : '(' + printN(n.a) + ')')
    : /^(?:and|or|imp|iff)$/.test(n.op) ? '(' + printN(n.a) + ' ' + { and: '∧', or: '∨', imp: '→', iff: '↔' }[n.op] + ' ' + printN(n.b) + ')'
    : n.op === 'bottom' ? '⊥' : n.name;
  const BP = require('./logic-r27-basis-proofs.js')(printN);
  const proof = new BP.Proof(), top = new BP.Top(proof);
  BP.lem(top, { op: 'letter', name: 'P' });
  const bad = proof.lines.map((ln, i) => {
    const text = printN(ln.f);
    const got = ln.from === 'theorem' ? inst(text) : rule(ln.from.map(k => printN(proof.lines[k].f)), text);
    return got ? null : (i + 1) + '. ' + text;
  }).filter(Boolean);
  check(!bad.length && proof.lines.length > 20, 'P v ~P from the basis alone, every extension off, in ' + proof.lines.length + ' lines, each certified -- ' + (bad.slice(0, 2).join(' | ') || 'all good'));
  check(inst('(P & ~P) -> ⊥') === 'contradiction-introduction' && inst('(P -> ⊥) -> ~P') === 'def-negation',
    'Contradiction is a rule instance of a core rule; "(P -> ⊥) -> ~P" is an axiom, half of what ¬ abbreviates');
  check(!inst('(P v ~P) -> ('+N+' -> ⊥)'), 'a curried form, "(P v ~P) -> (N -> ⊥)", is no rule instance');
  check(!rule(['P -> (~(P v ~P) -> ⊥)'],'~(P v ~P) -> (P -> ⊥)'),'with every extension off, the conditions of a conditional do not trade places in one step');
 }
 call(()=>{ state.logic = null; claimRulesCache = null; });
 check(rule(['P -> (~(P v ~P) -> ⊥)'],'~(P v ~P) -> (P -> ⊥)')==='commutation','with the defaults, commutation lets them trade places, and the proof is shorter');
 check(rule(['P','~P'],'⊥')==='contradiction-introduction','contradiction from co-premises');
 check(!rule(['P','Q'],'⊥'),'consistent premises do not imply bottom');
 // Rule instances come from the basis only.
 for(const t of ['(P & ~P) -> ⊥','~~~P -> ~P','~P -> (~P v Q)','Q -> (~P v Q)','P -> (P v P)','(P & (P v P)) -> P',
  '((P -> Q) & (Q -> R)) -> (P -> R)','((P & Q) -> R) -> (P -> (Q -> R))','(P & Q) -> (Q & P)'])
  check(call(x=>!!logicalTheorem(x),t),'logical theorem: '+t);
 for(const t of ['⊥','P','P v ~P','P -> P','(P v Q) -> (P v Q)','P -> Q','(P v Q) -> P',"We can't conclude that P",'∀x P(x)','∀x (F(x) → F(x))',
  '(P & Q) -> (P & Q)'])
  check(call(x=>!logicalTheorem(x),t),'no automatic warrant: '+t);
 // Since r27.30, a conditional that states the step of any switched-on rule
 // needs no support -- not only the core ones.
 for(const [t,id] of [['~(P v ~P) -> (~P & ~~P)','de-morgan'],['~(P -> P) -> (P & ~P)','negated-conditional'],
  [' ((P -> Q) & ~Q) -> ~P'.trim(),'modus-tollens'],['((P v Q) & ~P) -> Q','disjunctive-syllogism']])
  check(call(x=>logicalTheorem(x)?.rule.id,t)===id,'a rule instance while its rule is on: '+t);
 check(call(()=>{ setDeductiveRule(['de-morgan'], false);
  const off = !logicalTheorem('~(P v ~P) -> (~P & ~~P)'); setDeductiveRule(['de-morgan'], true); return off; }),
  'switch the rule off and its conditional needs support again');
 // "(P -> ⊥) -> ~P" is an axiom now: half of what ¬ abbreviates.
 check(call(x=>logicalTheorem(x)?.rule.id,'(P -> ⊥) -> ~P')==='def-negation','the ¬ definition is an axiom, either way round');
 // Since r27.30 a conditional stating any switched-on rule's step needs no
 // support: these state indirect proof and consequentia mirabilis.
 check(call(x=>logicalTheorem(x)?.rule.id,'(~P -> ⊥) -> P')==='indirect-proof','indirect proof, as a rule instance');
 check(call(x=>logicalTheorem(x)?.rule.id,'(P -> ~P) -> ~P')==='consequentia-mirabilis','consequentia mirabilis, as a rule instance');
 // Absorption is an extension now, so its instance is no automatic warrant;
 // with it on, it still takes its step. "P -> P" is proved from the basis in
 // six lines, Contradiction to Negation Elimination (logic-r27-basis-test.js).
 check(call(x=>logicalTheorem(x)?.rule.id,'(P -> Q) -> (P -> (P & Q))')==='absorption' && rule(['P -> Q'],'P -> (P & Q)')==='absorption',
  'absorption is a familiar step now, and its conditional states that step, so it needs no support while the rule is on');
 check(call(x=>!!logicalTheorem(x),'(P & ~P) -> ⊥') && rule(['(P & ~P) -> ⊥'],'P -> (~P -> ⊥)')==='exportation' &&
  rule(['P -> (~P -> ⊥)','(~P -> ⊥) -> ~~P'],'P -> ~~P')==='hypothetical-syllogism' &&
  rule(['P -> ~~P','~~P -> P'],'P -> P')==='hypothetical-syllogism',
  'P -> P proved from rule instances: Contradiction, exportation, the derived "(~P -> ⊥) -> ~~P", Negation Elimination, hypothetical syllogism');
 check(rule(['P -> P','P -> P','P v P'],'P')==='proof-by-cases' && rule(['P -> P'],'~P v P')==='material-implication' && !rule(['P -> P'],'P v ~P'),
  'with it, P v P gives P by proof by cases, and ~P v P follows by material implication (P v ~P by commutation after it)');
 // Extra instances, when a map switches them on.
 check(call(()=>{ setDeductiveRule(['instance-restatement','instance-excluded-middle'], true);
  const on = !!logicalTheorem('P -> P') && !!logicalTheorem('P v ~P') && !!logicalTheorem('∀x (F(x) → F(x))');
  setDeductiveRule(['instance-restatement','instance-excluded-middle'], false);
  return on && !logicalTheorem('P -> P') && !logicalTheorem('P v ~P'); }),'extra rule instances, P -> P and P v ~P, when switched on');
 check(call(()=>parseClaim('⊥').kind==='bottom' && claimKey(parseClaim('⊥'))!==claimKey(parseClaim('P'))),'bottom is its own logical constant');
 const ui=call(()=>{
  const n=(id,type,texts,children=[])=>({id,type,texts:Array.isArray(texts)?texts:[texts],children,collapsed:[],x:30000,y:30000});
  const leaves=n('L','support',['P -> (P v P)']);
  const middle=n('S','support',['P -> (P & (P v P))','(P & (P v P)) -> P'],[leaves]);
  const root=n('M','contention','P -> P',[middle]);state.trees=[root];
  deductiveLive=true;render();const steps=collectDeductiveSteps(state.trees);
  const out={steps:steps.every(s=>!!s.rule),warrant:claimMapVerdict(state.trees,steps)('M',0).status,
   tags:document.querySelectorAll('.logical-theorem-tag').length,
   exportOn:buildExportSVG().includes('RULE INSTANCE'),
   external:[...document.querySelectorAll('.logical-theorem-tag')].every(t=>t.parentElement.classList.contains('node-group'))};
  const tag=document.querySelector('.logical-theorem-tag'),box=[...tag.parentElement.children].find(e=>e.classList.contains('node')&&e.dataset.nodeIdx===tag.dataset.theoremIdx);
  for(const [obj,props] of [[box,{offsetLeft:20,offsetTop:40,offsetWidth:200,offsetHeight:100}],[tag,{offsetWidth:100,offsetHeight:14}]]) for(const [k,v] of Object.entries(props))Object.defineProperty(obj,k,{value:v,configurable:true});
  placeLogicalTheoremTags();out.centered=tag.style.left==='70px'&&tag.style.top==='133px';
  deductiveLive=false;deductiveChecked.clear();refreshDerivationTags();out.off=!document.querySelector('.logical-theorem-tag')&&!buildExportSVG().includes('RULE INSTANCE');
  state.trees=[n('M','contention','P v ~P')];out.noPremises=claimMapVerdict(state.trees,[])('M',0).status;
  state.trees[0].texts=['P'];out.contingent=claimMapVerdict(state.trees,[])('M',0).status;
  state.trees=[n('M','contention','⊥',[n('C','support',['P','~P'])])];
  out.contradiction=claimMapVerdict(state.trees,collectDeductiveSteps(state.trees))('M',0).status;
  state.trees=[n('M','contention','Q -> (P v Q)'),n('N','note','Q -> (P v Q)')];state.trees[0].crossRefs=[[{targetId:'N',targetIdx:0}]];
  deductiveLive=true;render();out.noteExcluded=document.querySelectorAll('.logical-theorem-tag').length===1;
  out.crossref=!!document.querySelector('#group-M .crossref-badge')&&!!document.querySelector('#group-M .logical-theorem-tag');
  state.trees[0].texts=['P'];render();out.edited=!document.querySelector('.logical-theorem-tag');
  return out;
 });
 check(ui.contradiction!=='established','contradictory premises cannot warrant bottom');check(ui.noteExcluded&&ui.crossref&&ui.edited,'notes excluded, reference badge coexists, edits remove stale tags');
 check(ui.steps,'all proof steps valid');check(ui.warrant==='established','proof warranted');check(ui.tags===2,'theorems tagged');check(ui.external,'tags outside clipping nodes');check(ui.centered,'centered across bottom border');check(ui.exportOn&&ui.off,'deductive toggle controls tags and export');check(ui.noPremises!=='established'&&ui.contingent!=='established','standalone excluded middle and contingent claims need support');
 const soundness=call(()=>{
  const atoms=['P','Q','⊥'], forms=[...atoms,...atoms.map(a=>'~'+a)];
  for(const a of atoms)for(const b of atoms)for(const op of ['&','v','->'])forms.push('('+a+' '+op+' '+b+')');
  const evalTree=(f,P,Q)=>{switch(f.op){case 'bottom':return false;case 'letter':return f.name.toUpperCase()==='P'?P:Q;case 'not':return !evalTree(f.a,P,Q);case 'and':return evalTree(f.a,P,Q)&&evalTree(f.b,P,Q);case 'or':return evalTree(f.a,P,Q)||evalTree(f.b,P,Q);case 'imp':return !evalTree(f.a,P,Q)||evalTree(f.b,P,Q);default:throw Error('unexpected '+f.op);}};
  let checked=0;const wrong=[];
  for(const a of forms)for(const b of forms){const text='('+a+') -> ('+b+')';if(!logicalTheorem(text))continue;checked++;const tree=readSymbolicClaim(text).folTree;for(const P of [false,true])for(const Q of [false,true])if(!evalTree(tree,P,Q))wrong.push(text);}
  return {checked,wrong};
 });
 check(soundness.checked>50&&!soundness.wrong.length,'independent truth-table audit: '+JSON.stringify(soundness));
 check(errors.length===0,errors.join('; '));
 assert.equal(failures.length,0,failures.join('\n'));console.log(count+' rule instance and material implication checks passed.');
}finally{dom.window.close();}