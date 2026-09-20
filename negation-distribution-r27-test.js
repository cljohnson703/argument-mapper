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
 for(let mask=0;mask<32;mask++) {
  const letters=['P','Q','R','S','T'];
  const target=letters.map((s,i)=>(mask&(1<<i)?'~~':'')+s).join(' & ');
  check(rule(['~('+letters.map(s=>'~'+s).join(' v ')+')'],target)==='de-morgan','independent five-part simplification '+mask);
 }
 for(const a of [0,2])for(const b of [0,2])check(rule(['~(P -> ~Q)'],'~'.repeat(a)+'P & '+'~'.repeat(b)+'Q')==='negated-conditional','conditional '+a+','+b);
 for(const a of [0,2,4])for(const b of [0,2,4])check(rule(['~(~~~P v ~~~Q)'],'~'.repeat(a)+'P & '+'~'.repeat(b)+'Q')==='de-morgan','De Morgan '+a+','+b);
 for(const n of [0,2,4]) {
  check(rule(['~(∀x ~~~F(x))'],'∃x '+'~'.repeat(n)+'F(x)')==='quantifier-negation','universal dual '+n);
  check(rule(['~(∃x ~~~F(x))'],'∀x '+'~'.repeat(n)+'F(x)')==='quantifier-negation','existential dual '+n);
 }
 for(const target of ['~~~~P & Q','P & ~~~~Q','~P & Q','P & ~Q'])check(!rule(['~(P -> ~Q)'],target),'reject added/odd negations '+target);
 check(!rule(['~(∀x ~F(x))'],'∃x ~~~~F(x)'),'quantifier cannot add pairs');
 check(!rule(['~(∀x ~F(x))'],'∀x F(x)'),'quantifier cannot keep wrong quantifier');
 check(rule(['~(P <-> ~Q)'],'(P & Q) v (~P & ~Q)')==='negated-biconditional','negated biconditional partial simplification');
 check(rule(['~~~P -> ~~~Q'],'Q -> P')==='transposition','transposition removes pairs');
 check(rule(['~~~P -> Q'],'P v Q')==='material-implication','material implication removes pairs');
 check(!errors.length,errors.join('; '));assert.equal(failures.length,0,failures.join('\n'));console.log(count+' negation-distribution policy checks passed.');
} finally {dom.window.close();}
