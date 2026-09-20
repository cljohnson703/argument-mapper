'use strict';
const fs=require('fs'), assert=require('assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const errors=[],vc=new VirtualConsole(); vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(process.argv[2]||'argument-mapper-r27.html','utf8'),{
    runScripts:'dangerously',pretendToBeVisual:true,url:'https://localhost/identity-test',virtualConsole:vc,
    beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},addEventListener(){}});
        w.ResizeObserver=class{observe(){} unobserve(){} disconnect(){}};
        const ctx=new Proxy({},{get:(_,p)=>p==='measureText'?()=>({width:40}):()=>ctx});
        w.HTMLCanvasElement.prototype.getContext=()=>ctx; w.alert=()=>{};w.confirm=()=>true;w.prompt=()=>null;}
});
const call=(fn,input)=>{dom.window.__input=input;return dom.window.eval(`(${fn})(window.__input)`);};
let count=0;const failures=[];function check(ok,label){count++;if(!ok)failures.push(label);}
const rule=(p,c)=>call(`x => (certifyStep(x.p.map(parseClaim),[parseClaim(x.c)],false)||{}).id`,{p,c});
try{
    for(const phrase of ['identical to','the same individual as','the same person as','the same object as','the same entity as']){
        const p='Ada is '+phrase+' Bea';
        check(rule([p],'Bea is identical to Ada')==='identity-symmetry','symmetry: '+phrase);
        check(rule([p,'Bea is identical to Cy'],'Ada is identical to Cy')==='identity-transitivity','transitivity: '+phrase);
        check(rule([p,'Ada is tall'],'Bea is tall')==='identity-substitution','substitution: '+phrase);
        check(rule([p,'Ada is not tall'],'Bea is not tall')==='identity-substitution','negative substitution: '+phrase);
        check(rule([p,'Bea is tall'],'Ada is tall')==='identity-substitution','reverse substitution: '+phrase);
        check(call(`x => claimDenies(parseClaim('Ada is not '+x+' Bea'),parseClaim('Ada is '+x+' Bea')) && claimDenies(parseClaim("Ada isn't "+x+' Bea'),parseClaim('Ada is '+x+' Bea'))`,phrase),'identity denial and contraction: '+phrase);
    }
    for(const [p,c,want] of [
        [['a = b'],'b = a','identity-symmetry'],
        [['a = b','b = c'],'a = c','identity-transitivity'],
        [['b = a','c = b'],'a = c','identity-transitivity'],
        [['a = b','P(a)'],'P(b)','identity-substitution'],
        [['a = b','R(a,c)'],'R(b,c)','identity-substitution'],
        [['a = b','R(c,a)'],'R(c,b)','identity-substitution'],
        [['a = b','R(a,a)'],'R(b,b)','identity-substitution'],
        [['a = b','¬R(a,c)'],'¬R(b,c)','identity-substitution']
    ])check(rule(p,c)===want,JSON.stringify({p,c,want}));
    for(const [p,c] of [
        [['Ada is tall','Bea is tall'],'Ada is identical to Bea'],
        [['Ada is not identical to Bea','Ada is tall'],'Bea is tall'],
        [['Ada is similar to Bea','Ada is tall'],'Bea is tall'],
        [['Ada is identical to Bea','Cy is tall'],'Bea is tall'],
        [['Ada is identical to Bea','Ada is tall','Cy is happy'],'Bea is tall'],
        [['Ada is identical to Bea','Cy believes that Ada is tall'],'Cy believes that Bea is tall'],
        [['Ada is identical to Bea','We cannot conclude that Ada is tall'],'We cannot conclude that Bea is tall'],
        [['Ada is identical to Bea','Ada is necessarily tall'],'Bea is necessarily tall'],
        [['Ada is identical to Bea','Ada is a fictional character'],'Bea is a fictional character'],
        [['a = b','R(a,c)'],'R(c,b)'],
        [['a = b','R(a,c)'],'S(b,c)'],
        [['a = b','∀a P(a)'],'∀b P(b)'],
        [['a = b','P(a)'],'P(c)'],
        [['a = b','b = c'],'a = d'],
        [['¬(a = b)','¬(b = c)'],'a = c'],
        [['Ada is Bea','Ada is tall'],'Bea is tall'],
        [['a = b','R(a,c)'],'R(b,b)'],
        [['¬(a = b)'],'a = b']
    ])check(!rule(p,c),'no unsafe certificate: '+JSON.stringify({p,c}));
    check(call(`() => parseClaimFull('Ada is identical to someone').notes.some(n=>n.kind==='ambiguous')`),'indefinite identity flagged');
    check(call(`() => claimSame(parseClaim('∀x (x = a)'),parseClaim('∀y (y = a)')) && !claimSame(parseClaim('∀x (x = a)'),parseClaim('∀a (a = a)'))`),'identity respects quantified variable binding');
    check(call(`() => (certifyStep([parseClaim('If Ada is identical to Bea, then Ada is tall'),parseClaim('Ada is the same person as Bea')],[parseClaim('Ada is tall')],false)||{}).id === 'modus-ponens'`),'identity wording composes with MP');
    for(const [p,c] of [
        [['Ada is identical to Bea'],'Bea is identical to Ada'],
        [['Ada is identical to Bea','Ada is tall'],'Bea is tall'],
        [['a = b','R(a,c)'],'R(b,c)']
    ])check(call(`x => {const d=deriveConclusion(x.p);return d && claimKey(parseClaim(d.text))===claimKey(parseClaim(x.c));}`,{p,c}),'derive and recheck: '+c);
    const map=call(`() => {
        const support={id:'S',type:'support',texts:['Ada is identical to Bea','Ada is tall'],children:[]};
        const root={id:'M',type:'contention',texts:['Bea is tall'],children:[support]};
        const run=()=>{const steps=collectDeductiveSteps([root]);const status=claimMapVerdict([root],steps)('M',0).status;return {status,label:VERDICT_LABEL[status],rule:steps[0]?.rule?.id};};
        const accepted=run(); support.children.push({id:'W',type:'weak-objection',texts:['It has not been shown that Ada is identical to Bea'],children:[]});
        const challenged=run();root.children=[];return {accepted,challenged,bare:run()};
    }`);
    check(map.accepted.status==='established'&&map.accepted.rule==='identity-substitution','supported identity conclusion warranted: '+JSON.stringify(map));
    check(map.challenged.status==='unestablished'&&map.challenged.label==='✗ Unwarranted'&&map.challenged.rule==='identity-substitution','weak identity challenge leaves validity intact: '+JSON.stringify(map));
    check(map.bare.status==='asserted'&&map.bare.label==='✗ Unwarranted','unsupported contention stays unwarranted');
    // Independently evaluate each new identity rule over every two-element
    // interpretation of a,b,c and every unary/binary predicate extension.
    const model=call(`() => {
        const examples=[
            [['a=b'],'b=a'],[['a=b','b=c'],'a=c'],[['a=b','P(a)'],'P(b)'],
            [['a=b','R(a,c)'],'R(b,c)'],[['a=b','R(c,a)'],'R(c,b)'],[['a=b','¬R(a,c)'],'¬R(b,c)']
        ].map(([p,c])=>({p:p.map(parseClaim),c:parseClaim(c)}));
        let checked=0;
        for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)for(let mask=0;mask<16;mask++){
            const env={a,b,c};
            const value=f=>f.kind==='identity'?env[f.left]===env[f.right]:f.kind==='not'?!value(f.inner):
                f.kind==='pred'?!!(mask&(1<<env[f.term])):!!(mask&(1<<(2*env[f.relation.args[0]]+env[f.relation.args[1]])));
            for(const x of examples){checked++;if(!certifyStep(x.p,[x.c],false)||(x.p.every(value)&&!value(x.c)))return {ok:false,checked};}
        }return {ok:true,checked};
    }`);
    check(model.ok,'finite-model soundness');count+=model.checked;
    check(errors.length===0,'runtime errors: '+errors.join(';'));
    assert.equal(failures.length,0,failures.join('\n'));
    console.log(count+' identity, scope, finite-model and assessment checks passed.');
}finally{dom.window.close();}
