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
 check(rule(['~(P v ~P) -> ⊥'],'P v ~P')==='reductio','excluded middle proof: reductio');
 check(rule(['P','~P'],'⊥')==='contradiction-introduction','contradiction from co-premises');
 check(!rule(['P','Q'],'⊥'),'consistent premises do not imply bottom');
 for(const t of ['~(P v ~P) -> (P & ~P)','(P & ~P) -> ⊥','~~~P -> ~P','~P -> (~P v Q)','Q -> (~P v Q)'])
  check(call(x=>!!logicalTheorem(x),t),'logical theorem: '+t);
 for(const t of ['⊥','P','P v ~P','P -> P','(P v Q) -> (P v Q)','P -> Q','(P v Q) -> P',"We can't conclude that P",'∀x P(x)'])
  check(call(x=>!logicalTheorem(x),t),'no automatic warrant: '+t);
 check(call(()=>parseClaim('⊥').kind==='bottom' && claimKey(parseClaim('⊥'))!==claimKey(parseClaim('P'))),'bottom is its own logical constant');
 const ui=call(()=>{
  const n=(id,type,texts,children=[])=>({id,type,texts:Array.isArray(texts)?texts:[texts],children,collapsed:[],x:30000,y:30000});
  const leaves=n('L','support',['~(P v ~P) -> (P & ~P)','(P & ~P) -> ⊥']);
  const middle=n('S','support','~(P v ~P) -> ⊥',[leaves]);
  const root=n('M','contention','P v ~P',[middle]);state.trees=[root];
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