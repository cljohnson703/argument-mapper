'use strict';
const fs=require('fs'),assert=require('assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(process.argv[2]||'argument-mapper-r27.html','utf8'),{
    runScripts:'dangerously',pretendToBeVisual:true,url:'https://localhost/quantifier-test',virtualConsole:vc,
    beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},addEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
        const ctx=new Proxy({},{get:(_,p)=>p==='measureText'?()=>({width:40}):()=>ctx});w.HTMLCanvasElement.prototype.getContext=()=>ctx;
        w.alert=()=>{};w.confirm=()=>true;w.prompt=()=>null;}
});
const call=(fn,x)=>{dom.window.__input=x;return dom.window.eval(`(${fn})(window.__input)`);};
let count=0;const failures=[];function check(ok,msg){count++;if(!ok)failures.push(msg);}
const cases=[
    ['∀x ∃y R(x,y)','∃y R(a,y)','universal-elimination'],
    ['∀x ∀y R(x,y)','∀y R(a,y)','universal-elimination'],
    ['∀x ∀y R(x,y)','∀z R(y,z)','universal-elimination'],
    ['∀x (P(x) → Q(x))','P(a) → Q(a)','universal-elimination'],
    ['∀x (P(x) ∧ Q(x))','P(a) ∧ Q(a)','universal-elimination'],
    ['∀x (x = a)','b = a','universal-elimination'],
    ['∀x ∃x P(x)','∃y P(y)','universal-elimination'],
    ['∀x ∃y R(x,y)','∃z R(a,z)','universal-elimination'],
    ['R(a,b)','∃x R(x,b)','existential-introduction'],
    ['R(a,a)','∃x R(x,x)','existential-introduction'],
    ['∀y R(a,y)','∃x ∀z R(x,z)','existential-introduction'],
    ['P(a) ∧ Q(a)','∃x (P(x) ∧ Q(x))','existential-introduction'],
    ['For every individual x, there is an individual y such that x admires y','There is an individual y such that Ada admires y','universal-elimination'],
    ['For every individual x, x is tall','Ada is tall','universal-elimination'],
    ['For every individual x, x is not tall','Ada is not tall','universal-elimination'],
    ['For every individual x, x admires Ada','Bea admires Ada','universal-elimination'],
    ['Ada admires Bea','There exists an individual x such that Ada admires x','existential-introduction'],
    ['For every individual y, Ada admires y','There is an individual x such that for every individual z, x admires z','existential-introduction'],
    ['∀x ∀y R(x,y)','R(a,b)',null],
    ['∀x (P(x) ∧ Q(x))','P(a)',null],
    ['∀x ∃y R(x,y)','∃y R(y,y)',null],
    ['∀x ∀y R(x,y)','∀y R(y,y)',null],
    ['∀x ∃y R(x,y)','∃y ∀x R(x,y)',null],
    ['∃x P(x)','P(a)',null],
    ['P(a)','∀x P(x)',null],
    ['∀x R(x,x)','R(a,b)',null],
    ['R(a,b)','∃x R(x,x)',null],
    ['∀y R(y,y)','∃x ∀y R(x,y)',null],
    ['∀x ∃x P(x)','∃y P(a)',null],
    ['For every individual x, there is an individual y such that x admires y','There is an individual y such that for every individual x, x admires y',null],
    ['There is an individual x such that x is tall','Ada is tall',null],
    ['For every individual x, for every individual y, x admires y','Ada admires Bea',null],
    ['For every individual x, x admires Ada','Ada admires Bea',null]
];
try{
    for(const [p,c,want] of cases){const got=call(`x=>(certifyStep([parseClaim(x.p)],[parseClaim(x.c)],false)||{}).id||null`,{p,c});check(got===want,JSON.stringify({p,c,want,got}));}
    check(call(`()=>!certifyStep([parseClaim('∀x P(x)'),parseClaim('Q(a)')],[parseClaim('P(a)')],false)`),'do not ignore extra premise');
    for(const s of ['Every student admires someone','All students read a book','If every student admires someone, then Poe is black','For every individual x, x thinks that y is happy']){
        check(call(`s=>{const r=parseClaimFull(s);return r.notes.length>0&&!certifyStep([r.form],[r.form],false);}`,s),'unresolved scope unsupported certificate: '+s);
    }
    // Explicit scope must be observable in both the form and the assessment.
    check(call(`()=>claimKey(parseClaim('For every individual x, there is an individual y such that x admires y')) !== claimKey(parseClaim('There is an individual y such that for every individual x, x admires y'))`),'keep quantifier order');
    check(call(`()=>{
        const support={id:'S',type:'support',texts:['For every individual x, x is tall'],children:[]};
        const root={id:'M',type:'contention',texts:['Ada is tall'],children:[support]};
        const run=()=>{const steps=collectDeductiveSteps([root]);return {label:VERDICT_LABEL[claimMapVerdict([root],steps)('M',0).status],rule:steps[0]?.rule?.id};};
        const accepted=run();support.children=[{id:'W',type:'weak-objection',texts:['It has not been shown that for every individual x, x is tall'],children:[]}];
        const challenged=run();return accepted.label==='✓ Warranted'&&challenged.label==='✗ Unwarranted'&&accepted.rule==='universal-elimination'&&challenged.rule==='universal-elimination';
    }`),'nested English works with weak challenges without changing validity');
    const model=call(`()=>{
        const pairs=[['∀x ∃y R(x,y)','∃y R(a,y)'],['∀x ∀y R(x,y)','∀z R(y,z)'],['∀y R(a,y)','∃x ∀z R(x,z)'],['R(a,a)','∃x R(x,x)']].map(([p,c])=>[parseClaim(p).folTree,parseClaim(c).folTree]);
        let checked=0;
        const evaluate=(f,env,mask)=>{
            if(f.op==='pred')return !!(mask&(1<<(2*env[f.args[0]]+env[f.args[1]])));
            if(f.op==='all')return [0,1].every(v=>evaluate(f.body,{...env,[f.v]:v},mask));
            if(f.op==='some')return [0,1].some(v=>evaluate(f.body,{...env,[f.v]:v},mask));
            throw Error('unhandled model node');
        };
        for(let mask=0;mask<16;mask++)for(let a=0;a<2;a++)for(let y=0;y<2;y++)for(const [p,c] of pairs){checked++;if(evaluate(p,{a,y},mask)&&!evaluate(c,{a,y},mask))return {ok:false,checked};}
        return {ok:true,checked};
    }`);
    check(model.ok,'independent finite-model evaluation');count+=model.checked;
    check(errors.length===0,errors.join(';'));
    assert.equal(failures.length,0,failures.join('\n'));console.log(count+' nested-quantifier, single-rule and capture checks passed.');
}finally{dom.window.close();}
