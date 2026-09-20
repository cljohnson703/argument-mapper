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
 for(let n=2;n<=14;n++) for(let remove=2;remove<=n;remove+=2) {
  for(const wrap of [s=>s,s=>'('+s+') ∨ Q',s=>'Q unless '+s,s=>'('+s+') → Q']) {
   const p=wrap('~'.repeat(n)+'P'), c=wrap('~'.repeat(n-remove)+'P');
   check(rule([p],c)==='negation-elimination',p+' => '+c);
  }
 }
 for(let n=2;n<=14;n++) {
  check(!rule(['~'.repeat(n)+'P'],'~'.repeat(n-1)+'P'),'cannot remove odd count '+n);
  check(call(s=>!renderRichText(s).includes('<del>') && stripClaimMarkup(s)===s,'~'.repeat(n)+'P'),'preserve tildes '+n);
 }
 check(call(()=>!richTextEnabled&&!document.getElementById('richtext-toggle').checked),'Rich Text starts off');
 check(call(()=>renderRichText('~~old~~').includes('<del>old</del>')),'strikethrough still works');
 check(rule(['P ∨ Q','P → R','Q → R'],'R')==='constructive-dilemma','shared consequent cases');
 check(rule(['P ∨ Q','P → R','Q → S'],'R ∨ S')==='constructive-dilemma','general dilemma');
 check(!rule(['P ∨ Q','P → R','Q → S'],'R'),'do not discard other consequent');
 check(!rule(['P'],'~~~~P') || rule(['P'],'~~~~P')!=='negation-elimination','elimination cannot introduce negations');
 check(errors.length===0,errors.join('; '));
 assert.equal(failures.length,0,failures.join('\n'));console.log(count+' negation, rich-text and dilemma checks passed.');
} finally {dom.window.close();}
