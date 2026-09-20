'use strict';
const fs=require('fs'),assert=require('assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(process.argv[2]||'argument-mapper-r27.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://localhost/indirect-warrant',virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};const ctx=new Proxy({},{get:(_,p)=>p==='measureText'?()=>({width:40}):()=>ctx});w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.alert=()=>{};w.confirm=()=>true;}});
try{const count=dom.window.eval(`(()=>{
 let count=0;const check=(ok,msg)=>{count++;if(!ok)throw Error(msg);};
 const n=(id,type,texts,children=[])=>({id,type,texts:Array.isArray(texts)?texts:[texts],children});
 const fixture=()=>{const reb=n('R','rebuttal',['If Q, then P','Q']),ob=n('O','objection','not P',[reb]),main=n('M','contention','P',[ob]);return {reb,ob,main,trees:[main]};};
 const read=(f,reverse=false,pre=false)=>{let steps=collectDeductiveSteps(f.trees);if(reverse)steps=steps.slice().reverse();const v=claimMapVerdict(f.trees,steps);if(pre)steps.forEach(s=>s.premiseRefs.forEach(r=>v(r.targetId,r.targetIdx)));return {v,steps,main:v('M',0)};};
 let f=fixture(),r=read(f);check(r.main.status==='established','successful rebuttal establishes main contention');
 check(r.main.supports.some(s=>s.indirectKind==='rebuttal'),'warrant records indirect proof');
 check(claimVerdictWhy(r.v,r.main).includes('successful rebuttal that establishes this contention'),'explanation identifies the actual supporting inference');
 check(r.steps.find(s=>s.childId==='R').rule.id==='modus-ponens','original one-step inference retained');
 f.ob.texts=['If Q, then not P','Q'];f.reb.texts=['not Q'];f.reb.targetIndex=1;
 check(read(f).main.status!=='established','premise-only rebuttal supplies no proof of main contention');
 f=fixture();f.reb.type='weak-rebuttal';f.reb.texts=['It has not been shown that not P'];check(read(f).main.status!=='established','weak challenge does not prove P');
 f=fixture();f.reb.texts=['not not P'];check(read(f).main.status==='established','explicit double negation supports contention');
 f=fixture();f.main.texts=['not P'];f.ob.texts=['P'];f.reb.texts=['If Q, then not P','Q'];check(read(f).main.status==='established','negative main contention also receives indirect proof');
 f=fixture();f.reb.texts=['If Ada is tall, then Bea is tall','Ada is tall'];f.main.texts=['Bea is tall'];f.ob.texts=['Bea is not tall'];check(read(f).main.status==='established','natural-language predicate case');
 f=fixture();f.reb.texts=['If Q, then S','Q','If S, then P'];check(read(f).main.status!=='established','cannot silently combine multiple inferential moves');
 f=fixture();f.main.children=[];f.trees.push(f.ob);check(read(f).main.status!=='established','unattached proof is not silently attached');
 // Each matrix case has an independent expected outcome: only an unopposed
 // rebuttal premise (or a provably invalid challenge) can carry its MP proof;
 // a surviving additional objection to the main claim blocks warrant.
 for(const premiseChallenge of ['none','strong','weak','invalid','unknown'])for(const mainChallenge of ['none','strong','weak'])for(const reverse of [false,true])for(const pre of [false,true]){
   f=fixture();
   const extra=premiseChallenge==='none'?null:n('PC',premiseChallenge==='weak'?'weak-objection':'objection',premiseChallenge==='strong'?'not Q':premiseChallenge==='weak'?'It has not been shown that Q':premiseChallenge==='invalid'?'S':'The sky smiles');
   if(extra){extra.targetIndex=1;f.reb.children=[extra];}
   if(mainChallenge!=='none')f.main.children.push(n('MC',mainChallenge==='weak'?'weak-objection':'objection',mainChallenge==='weak'?'It has not been shown that P':'not P'));
   const expected=['none','invalid'].includes(premiseChallenge)&&mainChallenge==='none';
   r=read(f,reverse,pre);check((r.main.status==='established')===expected,'matrix '+[premiseChallenge,mainChallenge,reverse,pre]);
 }
 // A linked rebuttal contributes exactly the same proof, using its original
 // source assessments; a dependency on the target cannot warrant itself.
 f=fixture();f.ob.children=[];const sources=n('SRC','support',['If Q, then P','Q']);
 f.ob.crossRefs=[[{argumentId:'A',kind:'rebuttal',childIds:[],premises:[{targetId:'SRC',targetIdx:0},{targetId:'SRC',targetIdx:1}]}]];f.trees.push(sources);
 check(read(f).main.status==='established','linked rebuttal supplies indirect proof');
 sources.children=[Object.assign(n('SW','weak-objection','It has not been shown that Q'),{targetIndex:1})];check(read(f).main.status!=='established','linked premise challenge propagates');
 f.ob.crossRefs[0][0].premises=[{targetId:'M',targetIdx:0}];check(read(f).main.status!=='established','reference to contention cannot prove itself');
 f.ob.crossRefs[0][0].premises=[{targetId:'MISSING',targetIdx:0}];check(read(f).main.status!=='established','missing referenced premise cannot prove contention');
 // A strong defense of the rebuttal's challenged premise restores its proof;
 // a weak defense alone leaves that premise unresolved.
 for(const weak of [false,true]){
   f=fixture();const attack=n('A','weak-objection','It has not been shown that Q',[n('B',weak?'weak-rebuttal':'rebuttal',weak?'It has not been shown that it has not been shown that Q':'It is not the case that it has not been shown that Q')]);attack.targetIndex=1;f.reb.children=[attack];
   check((read(f).main.status==='established')===!weak,'strong versus weak defense of rebuttal premise');
 }
 return count;
})()`);assert.deepEqual(errors,[]);console.log('PASS: '+count+' indirect-warrant checks, including inference order, pre-evaluation, references and challenges.');}finally{dom.window.close();}
