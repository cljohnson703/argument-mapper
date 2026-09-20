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
 const result=call(()=>{
 let checks=0;const test=(v,msg)=>{checks++;if(!v)throw Error(msg);};
 const n=(id,type,children=[])=>({id:String(id),type,texts:['P'],children,collapsed:[],x:30000,y:30000});
 const setup=(type='support',parent='contention')=>{state.trees=[n(1,parent,[n(2,type)])];selectedIds=['2-0'];reviewMode=false;presentMode=false;render();document.activeElement.blur();};
 const get=id=>findNodeContext(state.trees,String(id)).node;
 const press=(key,extra={})=>document.dispatchEvent(new KeyboardEvent('keydown',{key,code:'Key'+key.toUpperCase(),bubbles:true,cancelable:true,...extra}));
 for(const key of ['s','o'])for(const parent of ['contention','objection','weak-objection','rebuttal']){
 setup('support',parent);const want=parent.includes('objection')?'rebuttal':'objection';press(key);test(get(2).type===want,key+' toggles support under '+parent);press(key);test(get(2).type==='support',key+' toggles back under '+parent);
 }
 for(const parent of ['contention','objection','weak-objection','rebuttal']){
 setup('objection',parent);const strong=computeArgumentKinds(state.trees).get('2').kind;press('w');test(get(2).type==='weak-'+strong,'W weak '+strong);press('w');test(get(2).type===strong,'W strong '+strong);
 }
 setup('support');get(2).texts=['P','Q'];selectedIds=['2-0','2-1'];press('o');test(get(2).type==='objection','co-premises toggled once');undo();test(get(2).type==='support','single undo');redo();test(get(2).type==='objection','redo');
 setup('support');get(1).children.push(n(3,'objection'));selectedIds=['2-0','3-0'];press('s');test(get(2).type==='objection'&&get(3).type==='support','mixed selection toggles independently');
 for(const type of ['support','note','contention']){setup(type);press('w');test(get(2).type===type,'W leaves '+type+' unchanged');}
 state.trees=[n(4,'weak-rebuttal')];selectedIds=['4-0'];render();press('w');test(get(4).type==='rebuttal','free root retains rebuttal role');press('w');test(get(4).type==='weak-rebuttal','free root weak again');
 setup();press('o',{repeat:true});test(get(2).type==='support','held key does not repeatedly toggle');
 setup();reviewMode=true;press('o');test(get(2).type==='support','review guard');reviewMode=false;presentMode=true;press('o');test(get(2).type==='support','presentation guard');presentMode=false;
 setup();const field=document.createElement('textarea');document.body.appendChild(field);field.focus();press('s');test(get(2).type==='support','plain key while typing does not retype');field.blur();field.remove();press('s',{altKey:true});test(get(2).type==='objection','Alt+S toggles');press('w',{altKey:true});test(get(2).type==='weak-objection','Alt+W toggles');press('o',{altKey:true});test(get(2).type==='support','Alt+O toggles back');
 return checks;
 });
 check(result>30,'real keyboard and lifecycle checks: '+result);check(errors.length===0,errors.join('; '));assert.equal(failures.length,0,failures.join('\n'));console.log(result+' type-toggle keyboard checks passed.');
}finally{dom.window.close();}