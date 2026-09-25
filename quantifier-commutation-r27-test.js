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
 const positives=[
 ['∃x ∃y R(x,y)','∃y ∃x R(x,y)'],
 ['∀x ∀y R(x,y)','∀y ∀x R(x,y)'],
 ['∃x ∃y R(x,y)','∃a ∃b R(b,a)'],
 ['~(∀x ∀y R(x,y))','~(∀y ∀x R(x,y))'],
 ['P -> (∃x ∃y R(x,y))','P -> (∃y ∃x R(x,y))'],
 ['∀z ∃x ∃y R(z,x,y)','∀z ∃y ∃x R(z,x,y)']
 ];
 for(const [p,c] of positives){
  check(rule([p],c)==='quantifier-commutation','direct '+p);
  // A conditional that states the step needs no support while the rule and
  // "rule instances" are both on (r27.30); switch the rule off and it does.
  check(call(x=>logicalTheorem('('+x[0]+') -> ('+x[1]+')')?.rule.id,[p,c])==='quantifier-commutation','its conditional is a rule instance '+p);
  check(call(x=>{ setDeductiveRule(['quantifier-commutation'], false);
    const r = logicalTheorem('('+x[0]+') -> ('+x[1]+')'); setDeductiveRule(['quantifier-commutation'], true); return !r; },[p,c]),
    'switched off, no free instance '+p);
 }
 check(rule(['There is an individual x such that there is an individual y such that x admires y'],
 'There is an individual y such that there is an individual x such that x admires y')==='quantifier-commutation','explicit English binders');
 check(rule(['∀z ∃x ∃y (R(z,x,y) & ∀x S(x,y))'],
 '∀z ∃y ∃x (R(z,x,y) & ∀x S(x,y))')==='quantifier-commutation','inner shadowing preserved');
 for(const [p,c] of [
 ['∀x ∃y R(x,y)','∃y ∀x R(x,y)'],
 ['∃x ∃y R(x,y)','∃y ∃x R(y,x)'],
 ['∃x ∃y R(x,y,z)','∃y ∃z R(z,y,z)'],
 ['∃x ∃y R(x,y)','∃x R(x,x)'],
 ['(∀x ∀y R(x,y)) & (∃x ∃y S(x,y))','(∀y ∀x R(x,y)) & (∃y ∃x S(x,y))']
 ])check(!call(x=>quantifiedCommutationReplacement([parseClaim(x[0])],parseClaim(x[1])),[p,c]),'reject swap '+p+' => '+c);
 for(const [p,c,id] of [
 ['R(a,b)','∃x R(x,b)','existential-introduction'],
 ['∃x R(x,b)','∃y ∃x R(x,y)','existential-introduction'],
 ['∀x R(x)','R(a)','axiom-q1']            // Q1 itself, now that the basis is Hilbert's
 ])check(call(x=>logicalTheorem('('+x[0]+') -> ('+x[1]+')')?.rule.id,[p,c])===id,'quantified certificate '+p);
 for(const s of ['P v ~P','P -> P','(∃x R(x)) -> R(a)','(∀x ∃y R(x,y)) -> (∃y ∀x R(x,y))'])check(!call(x=>logicalTheorem(x),s),'no automatic license '+s);
 // Exhaust every binary relation on a two-element domain using an independent evaluator.
 function value(t,env,mask){
  if(t.op==='all'||t.op==='some')return [0,1][t.op==='all'?'every':'some'](v=>value(t.body,{...env,[t.v]:v},mask));
  if(t.op==='pred')return !!(mask & (1 << (2*env[t.args[0]]+env[t.args[1]])));
  if(t.op==='not')return !value(t.a,env,mask);
  throw Error('Unexpected test AST '+t.op);
 }
 for(const [p,c] of positives.slice(0,4)){
  const trees=call(x=>x.map(s=>parseClaim(s).folTree),[p,c]);
  for(let mask=0;mask<16;mask++)check(value(trees[0],{},mask)===value(trees[1],{},mask),'finite model '+p+' / '+mask);
 }
 check(errors.length===0,errors.join('; '));assert.equal(failures.length,0,failures.join('\n'));console.log(count+' quantifier commutation checks passed.');
}finally{dom.window.close();}
