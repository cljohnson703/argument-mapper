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
  const n=(id,type,children=[])=>({id,type,texts:['P'],children,collapsed:[],x:30000,y:30000});
  state.trees=[n('M','contention',[n('S','support'),n('O','objection'),n('WO','weak-objection',[n('WS','support')])]),n('R','rebuttal'),n('WR','weak-rebuttal'),n('N','note')];render();
  let out=[],dash=[],stack=[];const ctx={fillStyle:'',strokeStyle:'',lineWidth:1,fillRect(...box){out.push({kind:'fill',color:this.fillStyle,box});},strokeRect(...box){out.push({kind:'stroke',color:this.strokeStyle,dash:dash.slice(),box});},setLineDash(v){dash=v.slice();},save(){stack.push({dash:dash.slice(),color:this.strokeStyle,width:this.lineWidth});},restore(){const s=stack.pop();dash=s.dash;this.strokeStyle=s.color;this.lineWidth=s.width;}};
  document.getElementById('minimap').getContext=()=>ctx;
  const scan=light=>{document.body.classList.toggle('bg-light',light);out=[];updateMinimap();return out;};
  const dark=scan(false),light=scan(true);minimapVisible=false;out=[];updateMinimap();return {dark,light,hidden:out.length===0};
 });
 const filled=r=>r.filter(x=>x.kind==='fill').map(x=>x.color);
 for(const c of ['#ff6250','#ffb780','#f0e28c'])check(filled(result.light).includes(c)&&filled(result.dark).includes(c),'shared role color '+c);
 check(filled(result.light).includes('#8a8a8a')&&filled(result.light).includes('#303840'),'distinct support and contention in light mode');
 check(filled(result.dark).includes('#666')&&filled(result.dark).includes('#a8b1b8'),'preserve dark neutral colors');
 for(const r of [result.dark,result.light]){
  const weak=r.filter(x=>x.kind==='stroke'&&x.dash.length);check(weak.length===3,'weak attacks and their support branches use hollow dashed markers');
  check(weak.filter(x=>x.color==='#ff6250').length===2&&weak.filter(x=>x.color==='#ffb780').length===1,'weak role colors remain distinguishable');
  check(weak.every(x=>x.box[2]>=4&&x.box[3]>=3),'minimum weak marker size');
  check(r[r.length-1].kind==='stroke'&&!r[r.length-1].dash.length,'viewport remains solid');
 }
 check(result.hidden,'hidden minimap does not draw');check(errors.length===0,errors.join('; '));assert.equal(failures.length,0,failures.join('\n'));console.log(count+' minimap palette and weak-marker checks passed.');
}finally{dom.window.close();}