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
 const positive=["it's the case that P","it’s the case that P",'it is the case that P','P is the case','P is true',"it's true that P",'it is true that P','it is not false that P',"it isn't false that P",'P is not false',"P isn't false",'the proposition that P is true','the proposition that P is not false','"P" is the case',"'P' is true"];
 const negative=['it is false that P','it is not true that P',"it isn't true that P",'it is not the case that P',"it isn't the case that P",'P is false','P is not true',"P isn't true",'P is not the case',"P isn't the case",'"P" is false',"'P' is not the case"];
 for(const [forms,premise,denial] of [[positive,'P','~P'],[negative,'~P','P']]) for(const wrapper of forms){
  check(call(x=>claimSame(parseClaim(x[0]),parseClaim(x[1])),[wrapper,premise]),'truth wrapper: '+wrapper);
  for(const text of ['If '+wrapper+', then Q','If '+wrapper+', Q','Q if '+wrapper,'Q, if '+wrapper]){
   check(rule([text,premise],'Q')==='modus-ponens','MP: '+text);
   check(!rule([text,denial],'Q'),'wrong polarity: '+text);
   check(!rule([text,'Q'],premise),'no affirming consequent: '+text);
  }
 }
 for(const marker of ['provided','provided that','providing','providing that','supposing','supposing that'])for(const text of [marker+' P, Q','Q '+marker+' P'])check(rule([text,'P'],'Q')==='modus-ponens','conditional marker: '+text);
 const reports=['we suppose P','we suppose that P','one supposes P','one supposes that P','P is supposed','it is supposed that P','we take P to be the case','one takes P to be the case','P is taken to be the case','it is taken to be the case that P','we take P to be true','one takes P to be true','P is taken to be true','it is taken to be true that P'];
 for(const report of reports)for(const text of ['If '+report+', then Q','Q if '+report])check(!rule([text,'P'],'Q'),'do not confuse assumption with truth: '+text);
 for(const [a,b] of [['Poe is true','Poe'],['Poe is not false','Poe'],['We take P to be true','P'],['"P v Q" is false','~P v Q']])check(call(x=>!claimSame(parseClaim(x[0]),parseClaim(x[1])),[a,b]),'preserve meaning: '+a);
 check(call(()=>claimSame(parseClaim('(P v Q) is false'),parseClaim('~(P v Q)'))),'parenthesized truth operand');
 for(const text of ['It is not false that Poe is a raven',"It isn’t false that Poe is a raven",'"Poe is a raven" is the case',"'Poe is a raven' is not false",'the proposition that Poe is a raven is true']){
  check(call(x=>claimSame(parseClaim(x),parseClaim('Poe is a raven')),text),'English truth wrapper: '+text);
  for(const sentence of ['If '+text+', then Poe is black','Poe is black if '+text])check(rule([sentence,'Poe is a raven'],'Poe is black')==='modus-ponens','English MP: '+sentence);
 }
 for(const text of ['"P v Q" is false',"'P v Q' is not true",'“P v Q” is not the case'])check(call(x=>claimSame(parseClaim(x),parseClaim('~(P v Q)')),text),'quote-delimited scope: '+text);
 check(call(()=>claimSame(parseClaim('P & ~P -> ⊥'),parseClaim('(P & ~P) -> ⊥'))&&!claimSame(parseClaim('P & ~P -> ⊥'),parseClaim('P & (~P -> ⊥)'))),'Help precedence matches parser');
 check(errors.length===0,errors.join('; '));assert.equal(failures.length,0,failures.join('\n'));console.log(count+' conditional truth-wrapper checks passed.');
}finally{dom.window.close();}