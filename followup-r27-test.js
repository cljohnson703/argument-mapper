'use strict';
const fs=require('fs'),assert=require('assert/strict');const {JSDOM,VirtualConsole}=require('jsdom');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(process.argv[2]||'argument-mapper-r27.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://localhost/followup-test',virtualConsole:vc,
beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},addEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const ctx=new Proxy({},{get:(_,p)=>p==='measureText'?()=>({width:80}):()=>ctx});w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.alert=()=>{};w.confirm=()=>true;w.prompt=()=>null;}});
const call=(fn,x)=>{dom.window.__input=x;return dom.window.eval(`(${fn})(window.__input)`);};
let count=0;const failures=[];function check(ok,msg){count++;if(!ok)failures.push(msg);}
try{
const packing=call(`()=>{
const toolbar=document.getElementById('toolbar'),change=document.getElementById('group-change-type'),view=document.getElementById('group-view'),file=document.getElementById('group-file');
const wasLeft=document.body.classList.contains('toolbar-left');document.body.classList.remove('toolbar-left');
let viewWidth=700,fileWidth=500;
toolbar.getBoundingClientRect=()=>({right:1600});change.getBoundingClientRect=()=>({right:900});
view.getBoundingClientRect=()=>({width:viewWidth});file.getBoundingClientRect=()=>({width:fileWidth});
const read=()=>{arrangeToolbarGroups();return [...toolbar.children].filter(e=>e.classList.contains('toolbar-group')).map(e=>e.id).join(',');};
try{const fallback=read();viewWidth=600;const preferred=read();viewWidth=700;fileWidth=700;const narrow=read();document.body.classList.add('toolbar-left');const sidebar=read();return {fallback,preferred,narrow,sidebar};}
finally{[toolbar,change,view,file].forEach(el=>delete el.getBoundingClientRect);document.body.classList.toggle('toolbar-left',wasLeft);arrangeToolbarGroups();}
}`);
const usual='group-add-nodes,group-change-type,group-view,group-file';
check(packing.fallback==='group-add-nodes,group-change-type,group-file,group-view','File fills space when View is too wide');
check(packing.preferred===usual,'View takes priority when it fits');
check(packing.narrow===usual,'No forced packing when neither group fits');
check(packing.sidebar===usual,'Sidebar retains its section order');
const premises=['Zombies are metaphysically possible','If zombies are metaphysically possible, then consciousness is non-physical'];
const C='consciousness is non-physical';
const frames=[];
for(const [verb,passive] of [['conclude','concluded'],['infer','inferred'],['determine','determined'],['establish','established'],['ascertain','ascertained'],['show','shown'],['prove','proven'],['demonstrate','demonstrated']]){
for(const subject of ['we','one'])for(const negative of ["can't",'cannot','can’t'])frames.push(`${subject} ${negative} ${verb}`);
for(const negative of ["can't",'cannot','can’t'])frames.push(`it ${negative} be ${passive}`);
}
for(const [left,right] of [['"','"'],["'","'"],['“','”'],['‘','’']]){
const q=premises.map(p=>left+p+right).join(' and ');
for(const frame of frames)for(const text of [`${frame} that ${C} from ${q}`,`From ${q}, ${frame} that ${C}`,`${frame} from ${q} that ${C}`]){
check(call(`x=>{const f=parseClaim(x.text);return f.kind==='unestablished'&&f.quotedPremises&&sameClaims(f.from,x.premises.map(parseClaim))&&claimSame(f.inner,parseClaim(x.C));}`,{text,premises,C}),'frame/quote/position: '+text);
}
for(const text of [`From ${q}, we can't rule out that consciousness is physical`,`We cannot rule out that consciousness is physical from ${q}`,`It cannot be ruled out from ${q} that consciousness is physical`]){
check(call(`x=>{const f=parseClaim(x.text);return f.kind==='unestablished'&&f.quotedPremises&&claimDenies(f.inner,parseClaim('consciousness is physical'))&&claimSame(f.inner,parseClaim(x.C));}`,{text,C}),'rule-out relative scope: '+text);
}
const malformed=`It's not necessarily the case that ${C} follows from ${q}`;
check(call(`text=>{const r=parseClaimFull(text);return r.notes.some(n=>n.kind==='unread')&&!certifyStep([r.form],[r.form],false);}`,malformed),'malformed nested that-clause rejected');
check(call(`text=>{const f=parseClaim(text);return f.kind==='unestablished'&&!!f.from;}`,`It's not necessarily the case that ${left}Consciousness is non-physical${right} follows from ${q}`),'quoted nested that-clause accepted');
}
check(call(`()=>claimUnestablishedOf(parseClaim('It is not necessarily true that Poe is black'),parseClaim('Poe is black'))`),'not necessarily true locution');
check(call(`()=>!claimSame(parseClaim('It is necessarily true that Poe is black'),parseClaim('Poe is black'))`),'necessity not silently erased');
const ui=call(`()=>{
const n=(id,type,texts,children=[])=>({id,type,texts,children,x:30000,y:30000,collapsed:[]});
const s=n('S','support',['Poe is a raven','If Poe is a raven, then Poe is black']);
const root=n('M','contention',['Poe is black'],[s]),note=n('N','note',['A note']);
s.crossRefs=[[{targetId:'N',targetIdx:0}],[]];state.trees=[root,note];selectedIds=[];deductiveLive=false;render();toggleDeductiveLive();
showContextMenu(10,10,'S',0);const menu=document.getElementById('context-menu');
const labels=[...menu.querySelectorAll('.ctx-item')].map(b=>b.textContent);
const badge=document.querySelector('.crossref-badge');
const svg=buildExportSVG();const tagCount=document.querySelectorAll('.derivation-tag').length;
const active=document.getElementById('logic-btn').classList.contains('active');
const reference=!!badge&&badge.parentElement.classList.contains('has-crossrefs')&&parseFloat(getComputedStyle(badge).bottom)>=0;
const badgeStyle=getComputedStyle(badge),nodeStyle=getComputedStyle(badge.parentElement);
if(getComputedStyle(badge.parentElement.querySelector('.rendered-text')).marginBottom!=='0px'||getComputedStyle(badge.parentElement.querySelector('textarea')).marginBottom!=='0px')throw new Error('Text must not add a second gap above the cross-reference badge');
if(badgeStyle.left!=='50%'||badgeStyle.transform!=='translateX(-50%)'||parseFloat(nodeStyle.paddingBottom)<parseFloat(badgeStyle.lineHeight)+parseFloat(badgeStyle.bottom))throw new Error('Cross-reference must be centered and stay clear of the text');
document.body.classList.add('toolbar-left');
if(getComputedStyle(document.getElementById('toolbar')).gap!=='8px'||getComputedStyle(document.getElementById('group-view')).gap!=='8px')throw new Error('Original sidebar spacing must be preserved');
const left=[...menu.querySelectorAll('button')].find(b=>b.textContent.startsWith('Left co-premise'));
const right=[...menu.querySelectorAll('button')].find(b=>b.textContent.startsWith('Right co-premise'));
const context=menu.textContent.includes('Add Premise')&&!!left&&!!right&&labels.some(t=>t.startsWith('Parent'))&&!menu.textContent.includes('Add Child');
const directions=left?.getAttribute('onclick').includes("'left'")&&right?.getAttribute('onclick').includes("'right'");
deductiveLive=false;render();const off=buildExportSVG();
return {active,reference,context,directions,tagCount,exportCount:(svg.match(/data-deductive-tag=/g)||[]).length,valid:svg.includes('MODUS PONENS'),verdict:svg.includes('WARRANTED'),off:!off.includes('data-deductive-tag='),help:!!document.querySelector('#help-panel #group-color-key')&&!document.getElementById('key-btn'),file:!!document.getElementById('group-file')};
}`);
for(const name of ['active','reference','context','directions','valid','verdict','off','help','file'])check(ui[name],'UI/export '+name+': '+JSON.stringify(ui));
check(ui.tagCount>0&&ui.tagCount===ui.exportCount,'all visible tags exported');
check(errors.length===0,errors.join(';'));assert.equal(failures.length,0,failures.slice(0,12).join('\n'));console.log(count+' phrase-position, quotation, toolbar and export checks passed.');
}finally{dom.window.close();}
