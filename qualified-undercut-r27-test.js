'use strict';
const fs=require('fs'),assert=require('assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(process.argv[2]||'argument-mapper-r27.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://localhost/qualified-undercut',virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};const ctx=new Proxy({},{get:(_,p)=>p==='measureText'?()=>({width:40}):()=>ctx});w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.alert=()=>{};w.confirm=()=>true;}});
dom.window.fixture=fs.readFileSync('zombie-verdict-diagnostic.txt','utf8');
try{const result=dom.window.eval(`(()=>{
 let count=0;const check=(ok,why)=>{count++;if(!ok)throw Error(why);};
 const n=(id,type,texts,children=[])=>({id,type,texts:Array.isArray(texts)?texts:[texts],children});
 const read=trees=>{const steps=collectDeductiveSteps(trees);return {steps,v:claimMapVerdict(trees,steps)};};
 const trees=parseTextToState(fixture).trees;let r=read(trees);
 check(r.v(trees[0].id,0).status==='established','exact zombie map warranted with reference');
 check(r.steps.every(s=>s.rule),'every original inference still certified');
 check(r.steps.find(s=>s.referenceArgument)&&r.v.stepState(r.steps.find(s=>s.referenceArgument))==='active','reference support now active');
 (function walk(ns){ns.forEach(n=>{delete n.crossRefs;walk(n.children||[]);});})(trees);
 check(read(trees).v(trees[0].id,0).status==='established','reference and repeated-premise versions agree');
 const premise=n('B','objection',['If Q, then functionalism is ruled out.','Q'],[Object.assign(n('W','weak-rebuttal','It has not been shown that Q'),{targetIndex:1})]);
 const main=n('M','contention','Functionalism is not ruled out.',[premise]);r=read([main]);
 check(r.steps.every(s=>s.rule)&&r.v('M',0).status==='established','grounded undercut warrants not-ruled-out claim');
 check(r.v('M',0).mapRelative&&claimVerdictWhy(r.v,r.v('M',0)).includes('undercut'),'explanation identifies map-relative grounds');
 main.children.push(n('OTHER','objection','Functionalism is ruled out.'));r=read([main]);check(r.v('M',0).status!=='established','independent surviving exclusion blocks warrant');main.children.pop();
 main.children.push(n('UNKNOWN','objection','Some obscure observation.'));r=read([main]);check(r.v('M',0).status!=='established','unknown additional exclusion blocks warrant');main.children.pop();
 premise.children[0].texts=['An unclear criticism.'];r=read([main]);check(r.v('M',0).status!=='established','unknown rebuttal is not a grounded undercut');
 premise.children[0].texts=['It has not been shown that Q'];premise.children[0].children=[n('WW','weak-objection','It has not been shown that it has not been shown that Q')];r=read([main]);
 check(r.v('M',0).status!=='established','weakly challenged undercut does not warrant exclusion claim');premise.children[0].children=[];
 const weak=n('RW','weak-objection','It has not been shown that R');
 const derivation=n('RS','support',['If R, then Q','R'],[Object.assign(weak,{targetIndex:1})]);
 premise.children=[Object.assign(derivation,{targetIndex:1}),Object.assign(n('ALT','support','An obscure alternative.'),{targetIndex:1})];r=read([main]);
 check(r.v('M',0).status!=='established','unknown alternative support prevents complete undercut');
 premise.children.pop();r=read([main]);check(r.v('M',0).status==='established','fully grounded indirect undercut warrants qualification');
 premise.children=[Object.assign(n('W','weak-rebuttal','It has not been shown that Q'),{targetIndex:1})];
 main.texts=['Functionalism is true.'];premise.texts=['If Q, then functionalism is not true.','Q'];r=read([main]);check(r.v('M',0).status!=='established','undercut does not establish functionalism');
 main.texts=['Functionalism is not true.'];premise.texts=['If Q, then functionalism is true.','Q'];r=read([main]);check(r.v('M',0).status!=='established','undercut does not establish ordinary negation');
 main.texts=['Functionalism is not ruled out.'];main.children=[];r=read([main]);check(r.v('M',0).status!=='established','bare qualified contention not automatically warranted');
 // Linked and direct evidence receive the same assessment.
 const claim=n('CLAIM','support','Q');claim.crossRefs=[[{argumentId:'loop',kind:'support',childIds:[],premises:[{targetId:'M',targetIdx:0}]}]];
 main.crossRefs=[[{argumentId:'attack',kind:'objection',childIds:[],premises:[{targetId:'CLAIM',targetIdx:0}]}]];r=read([main,claim]);check(r.v('M',0).status!=='established','circular references cannot provide warrant');
 return {count};
})()`);assert.deepEqual(errors,[]);console.log('PASS: '+result.count+' qualified-undercut checks, including the exact Zombie Argument Map.');}finally{dom.window.close();}
