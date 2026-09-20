'use strict';
const fs=require('fs'),assert=require('assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(process.argv[2]||'argument-mapper-r27.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://localhost/reference-menu-tests',virtualConsole:vc,beforeParse(w){
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};
 const ctx=new Proxy({},{get:(_,p)=>p==='measureText'?()=>({width:40}):()=>ctx});w.HTMLCanvasElement.prototype.getContext=()=>ctx;
 w.alert=()=>{};w.confirm=()=>true;w.prompt=()=>null;
}});
try{
const count=dom.window.eval(`(()=>{
 let count=0;const check=(v,m)=>{count++;if(!v)throw Error(m);};
 const n=(id,type,texts,children=[])=>({id,type,texts:Array.isArray(texts)?texts:[texts],children,collapsed:[],x:30000,y:30000});
 const ref=(id,idx=0)=>({targetId:id,targetIdx:idx}),arg=(id,refs=[],childIds=[])=>({argumentId:id,kind:'support',premises:refs,childIds});
 const m=n('M','contention','Q'),p=n('P','support','P'),c=n('C','support','If P, then Q'),q=n('Q','support','Q');
 state.trees=[m,p,c,q];m.crossRefs=[[ref('P'),ref('C'),ref('Q')]];render();openReferenceArguments('M',0);
 const pop=()=>document.querySelector('.reference-arguments-popover'),cards=()=>[...document.querySelectorAll('.reference-argument-card')];
 const row=(id,group)=>[...(group||pop()).querySelectorAll('.crossref-popover-row')].find(r=>r.dataset.targetId===id);
 const drag=(source,target,copy=false)=>{
   const transfer={effectAllowed:'',dropEffect:'',setData(){}};
   for(const [el,type] of [[source,'dragstart'],[target,'dragover'],[target,'drop']]){
     const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:transfer});Object.defineProperty(e,'ctrlKey',{value:copy});el.dispatchEvent(e);
   }
 };
 check(getComputedStyle(pop()).width==='280px','old compact width');check(!pop().querySelector('select'),'no persistent form controls');
 check(getComputedStyle(row('P').querySelector('button')).whiteSpace==='nowrap','compact truncated row');
 drag(row('P'),row('C'));check(referenceArguments(m,0).length===1,'drop two links together creates group');
 check(referenceArguments(m,0)[0].premises.length===2&&collectDeductiveSteps(state.trees)[0].rule,'drag grouping certifies MP');
 check(m.crossRefs[0].filter(r=>!isReferenceArgument(r)).length===1,'unrelated link left outside group');
 // Context menus work both with mouse and the keyboard context-menu key.
 row('Q').querySelector('button').dispatchEvent(new KeyboardEvent('keydown',{key:'ContextMenu',bubbles:true,cancelable:true}));
 let menu=document.querySelector('.reference-context-menu');check(!!menu&&menu.textContent.includes('Add to group'),'keyboard premise menu');
 [...menu.querySelectorAll('button')].find(b=>b.textContent==='Argument type…').click();
 menu=document.querySelector('.reference-context-menu');[...menu.querySelectorAll('button')].find(b=>b.textContent==='Weak Objection').click();
 check(referenceArguments(m,0).length===2&&referenceArguments(m,0)[1].kind==='weak-objection','type menu creates typed argument');
 check(getComputedStyle(cards()[1]).borderStyle==='dashed','weak group uses dashed border');
 drag(row('P',cards()[0]),cards()[1],true);check(referenceArguments(m,0)[0].premises.length===2&&referenceArguments(m,0)[1].premises.length===2,'modifier drag reuses premise');
 drag(row('P',cards()[0]),pop().querySelector('.reference-ungrouped'));check(referenceArguments(m,0)[0].premises.length===1&&m.crossRefs[0].some(r=>!isReferenceArgument(r)&&r.targetId==='P'),'drag apart ungroups one membership');
 check(state.trees.length===4,'drag never duplicates premise nodes');
 // A child co-premise is individually movable, without dragging siblings.
 const cp=n('CP','support',['P','R']);m.children=[cp];m.crossRefs=[[arg('A',[ref('C')],['CP']),arg('B',[ref('Q')])]];render();openReferenceArguments('M',0);
 drag(row('CP',cards()[0]),cards()[1]);
 const groups=referenceArguments(m,0),members=a=>referenceArgumentMembers(state.trees,m,0,a);
 check(members(groups[0]).some(r=>r.targetId==='CP'&&r.targetIdx===1)&&!members(groups[0]).some(r=>r.targetId==='CP'&&r.targetIdx===0),'moving child leaves sibling in source group');
 check(members(groups[1]).some(r=>r.targetId==='CP'&&r.targetIdx===0&&r.local),'moved child remains linked to original local box');
 check(collectDeductiveSteps(state.trees).length===2,'split child not additionally checked as implicit argument');
 check(document.querySelectorAll('#group-CP > .reference-argument-marker').length===0,'group details stay in reference menu');
 const before=JSON.stringify(m.crossRefs);pop().dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));
 const restored=findNodeContext(state.trees,'M').node;check(JSON.stringify(restored.crossRefs)!==before&&restored.crossRefs[0][0].childIds.includes('CP'),'undo works while menu has focus');
 // Notes and read-only sessions never become editable inference premises.
 const note=n('NOTE','note','Remember this');state.trees.push(note);restored.crossRefs[0].push(ref('NOTE'));render();openReferenceArguments('M',0);
 check(!row('NOTE').draggable,'notes cannot be dragged into arguments');
 const prior=JSON.stringify(restored.crossRefs);transferReferenceMember('M',0,ref('NOTE'),null,'new');check(JSON.stringify(restored.crossRefs)===prior,'helper rejects note grouping');
 reviewMode=true;openReferenceArguments('M',0);check([...pop().querySelectorAll('.crossref-popover-row')].every(r=>!r.draggable),'read-only disables dragging');reviewMode=false;
 armCrossRefPicking('M',0);reviewMode=true;completeCrossRefPicking('Q',0);reviewMode=false;check(JSON.stringify(restored.crossRefs)===prior,'read-only rechecked when picker completes');
 for(const [type,color,attack,weak] of [
   ['contention','support','objection','weak-objection'],
   ['objection','objection','rebuttal','weak-rebuttal'],
   ['weak-objection','objection','rebuttal','weak-rebuttal'],
   ['rebuttal','rebuttal','objection','weak-objection'],
   ['weak-rebuttal','rebuttal','objection','weak-objection']
 ]){
   const parent=n('T',type,'P'),source=n('TS','support','P');parent.crossRefs=[[arg('TA',[ref('TS')])]];state.trees=[parent,source];render();openReferenceArguments('T',0);
   check(cards()[0].dataset.color===color,'support inherits color of '+type);
   check((getComputedStyle(cards()[0]).borderStyle==='dashed')===type.startsWith('weak-'),'support inherits border of '+type);
   cards()[0].querySelector('legend button').click();
   [...document.querySelectorAll('.reference-context-menu button')].find(b=>b.textContent==='Argument type…').click();
   const labels=[...document.querySelectorAll('.reference-context-menu button')].map(b=>b.textContent.replace('✓ ',''));
   check(JSON.stringify(labels)===JSON.stringify(['Support',KIND_NAME[attack],KIND_NAME[weak]]),'child-compatible menu for '+type);
   for(const stored of ['support','objection','rebuttal','weak-objection','weak-rebuttal']){
     parent.crossRefs[0][0].kind=stored;
     const child=n('TC',stored,'P');parent.children=[child];
     const steps=collectDeductiveSteps(state.trees),reference=steps.find(s=>s.referenceArgument),ordinary=steps.find(s=>!s.referenceArgument);
     const expected=stored==='support'?'support':stored.startsWith('weak-')?weak:attack;
     check(reference.kind===expected&&ordinary.kind===expected,'reference and child agree: '+type+' / '+stored);
   }
 }
 // Inherited sides, not just the parent's stored type, govern support nodes.
 const ancestor=n('ANC','objection','P'),parent=n('PAR','support','P'),source=n('SRC','support','P');ancestor.children=[parent];parent.crossRefs=[[arg('INHERITED',[ref('SRC')])]];state.trees=[ancestor,source];render();openReferenceArguments('PAR',0);
 check(cards()[0].dataset.color==='objection','support under objection inherits red through support parent');
 ancestor.type='rebuttal';render();openReferenceArguments('PAR',0);check(cards()[0].dataset.color==='rebuttal','parent retag updates reference color');
 return count;
})()`);
assert.deepEqual(errors,[]);console.log('PASS: '+count+' compact reference-menu checks (dragging, context menus, individual co-premises, reuse, undo and read-only).');
}finally{dom.window.close();}
