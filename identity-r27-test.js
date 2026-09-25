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
        [['a = b','¬R(a,c)'],'¬R(b,c)','identity-substitution'],
        // "Ada is Bea" is an identity too, since r27.33: "is" and a name.
        [['Ada is Bea','Ada is tall'],'Bea is tall','identity-substitution'],
        [['Ada is Bea'],'Bea is Ada','identity-symmetry'],
        [['Ada is Bea','Bea is Cy'],'Ada is Cy','identity-transitivity'],
        // A name goes into what is said of a thing, whatever the words are.
        [['Ada is Bea','Ada sings'],'Bea sings','identity-substitution'],
        [['Ada is Bea','Ada wrote a poem'],'Bea wrote a poem','identity-substitution'],
        [['Ada is Bea','Ada did not sing'],'Bea did not sing','identity-substitution'],
        [['Ada is Bea','Ada wants a raven'],'Bea wants a raven','identity-substitution'],
        // The one who believes is not read through what is believed.
        [['Ada is Bea','Ada believes that Cy is tall'],'Bea believes that Cy is tall','identity-substitution'],
        // And into an open relation, in either place.
        [['Ada is Bea','Cy is taller than Ada'],'Cy is taller than Bea','identity-substitution'],
        [['Ada is Bea','Cy admires Ada'],'Cy admires Bea','identity-substitution'],
        [['Ada is Bea','Cy is a friend of Ada'],'Cy is a friend of Bea','identity-substitution'],
        [['Ada is Bea','Ada is taller than Cy'],'Bea is taller than Cy','identity-substitution'],
        // Names of more than one word (r27.40).
        [['Clark Kent is Superman','Clark Kent wears glasses'],'Superman wears glasses','identity-substitution'],
        [['Clark Kent is Superman','Superman flies'],'Clark Kent flies','identity-substitution'],
        [['Clark Kent is Superman'],'Superman is Clark Kent','identity-symmetry'],
        [['Lois loves Clark Kent','Clark Kent is Superman'],'Lois loves Superman','identity-substitution'],
        [['Lois loves Superman','Clark Kent is Superman'],'Lois loves Clark Kent','identity-substitution'],
        [['Mark Twain is the same person as Samuel Clemens','Mark Twain wrote a novel'],'Samuel Clemens wrote a novel','identity-substitution'],
        [['Mark Twain is Samuel Clemens','Mark Twain is a writer'],'Samuel Clemens is a writer','identity-substitution'],
        // A title or an initial with a full stop (r27.41).
        [['Dr. Jekyll is Mr. Hyde','Dr. Jekyll is a doctor'],'Mr. Hyde is a doctor','identity-substitution'],
        [['Dr. Jekyll is Mr. Hyde'],'Mr. Hyde is Dr. Jekyll','identity-symmetry'],
        [['Dr. Jekyll is Mr. Hyde','Mr. Hyde commits crimes'],'Dr. Jekyll commits crimes','identity-substitution'],
        [['J. S. Mill is John Stuart Mill','J. S. Mill wrote a book'],'John Stuart Mill wrote a book','identity-substitution']
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
        [['a = b','R(a,c)'],'R(b,b)'],
        [['¬(a = b)'],'a = b'],
        // Said of the name rather than of the thing, or of what somebody
        // takes the thing to be: the name stays where it was written.
        [['Ada is Bea','Ada has four letters'],'Bea has four letters'],
        [['Ada is Bea','Ada rhymes with Nada'],'Bea rhymes with Nada'],
        [['Ada is Bea','Ada was believed to be dead'],'Bea was believed to be dead'],
        [['Ada is Bea','Ada has been called Addy'],'Bea has been called Addy'],
        [['Ada is Bea','Cy believes that Ada is tall'],'Cy believes that Bea is tall'],
        // A capitalized word that says what somebody is like is no name.
        [['Bob is Bavarian','Bob is tall'],'Bavarian is tall'],
        [['Bob is Republican','Bob is tall'],'Republican is tall'],
        [['Bob is Martian','Bob is tall'],'Martian is tall'],
        [['Bob is Buddhist','Bob is tall'],'Buddhist is tall'],
        [['Bob is Portuguese','Bob is tall'],'Portuguese is tall'],
        // What is sought, feared or worshipped may be sought under a name,
        // and a clause of its own says how somebody put it.
        [['Ada is Bea','Cy worships Ada'],'Cy worships Bea'],
        [['Ada is Bea','Cy is afraid of Ada'],'Cy is afraid of Bea'],
        [['Ada is Bea','Cy looks for Ada'],'Cy looks for Bea'],
        [['Ada is Bea','Cy wants Ada'],'Cy wants Bea'],
        [['Ada is Bea','Cy said that Ada sings'],'Cy said that Bea sings'],
        [['Ada is Bea','Cy heard that Ada sings'],'Cy heard that Bea sings'],
        [['Ada is Bea','Ada is necessarily tall'],'Bea is necessarily tall'],
        [['Ada is Bea','Ada is a fictional character'],'Bea is a fictional character'],
        // A description is not a term: nothing is carried through it.
        [['Ada is the winner','Ada is tall'],'The winner is tall'],
        [['Ada is the winner'],'The winner is Ada'],
        [['Ada is the F','Ada is tall'],'The F is tall'],
        // A part of a name is not the name, and Lois still thinks what she thought.
        [['Clark Kent is Superman','Kent wears glasses'],'Superman wears glasses'],
        [['Clark Kent is a reporter'],'Clark is a reporter'],
        [['Clark Kent is Superman','Lois believes that Clark Kent is a reporter'],'Lois believes that Superman is a reporter'],
        [['Clark Kent is Superman','Lois thinks Clark Kent is not Superman'],'Lois thinks Superman is not Superman'],
        [['Clark Kent is Superman','Clark Kent is believed to be weak'],'Superman is believed to be weak'],
        [['Mark Twain is American','Mark Twain is tall'],'American is tall'],
        [['Dr. Jekyll is a doctor'],'Mr. Hyde is a doctor'],
        [['Dr. Jekyll is a doctor'],'Jekyll is a doctor'],
        [['Dr. Jekyll is Mr. Hyde','Utterson believes that Dr. Jekyll is kind'],'Utterson believes that Mr. Hyde is kind'],
        [['The winner is tall','Ada is the winner'],'Ada is tall']
    ])check(!rule(p,c),'no unsafe certificate: '+JSON.stringify({p,c}));
    check(call(`() => parseClaimFull('Ada is identical to someone').notes.some(n=>n.kind==='ambiguous')`),'indefinite identity flagged');
    check(call(`() => /read as a name/.test((parseClaimFull('Ada is Bea').notes[0]||{}).message||'')`),'the reading says a second name was read as one');
    check(call(`() => parseClaimFull('Ada is tall').notes.length === 0 && parseClaimFull('Ada is a poet').notes.length === 0`),'and says nothing where nothing was read as a name');
    check(call(`() => /is a description, not a second name/.test((parseClaimFull('Ada is the winner').notes[0]||{}).message||'')`),'a description in the predicate says so, and is no second name');
    check(call(`() => /\u201cClark Kent\u201d is read as a name: this says Superman and Clark Kent are one thing/.test(((parseClaimFull('Superman is Clark Kent').notes[0]||{}).message||'').replace(/"/g, '\u201c').replace(/\u201c([^\u201c]*?)\u201c/, '\u201c$1\u201d'))`),
        'a name of more than one word is read as one name, and the note names it whole');
    check(call(`() => normalizeClaimText('Clark Kent is tired and he is late').replace(/\uE000/g, '') === 'clark kent is tired and clark kent is late' &&
        normalizeClaimText('Today Mary sings and she dances').replace(/\uE000/g, '') === 'today mary sings and mary dances'`),
        'a pronoun takes a name of more than one word as one name, and a common word before a name is no part of it');
    check(call(`() => (certifyStep([parseClaim('All Greeks are mortal'),parseClaim('Socrates is a Greek')],[parseClaim('Socrates is mortal')],false)||{}).id === 'universal-modus-ponens'`),
        'a capitalized plural of a kind of people is still a plural');
    check(call(`() => normalizeClaimText('J. S. Mill wrote a book and he died').replace(/\uE000/g, '') === 'j s mill wrote a book and j s mill died' &&
        normalizeClaimText('Bob met Dr. Smith. Smith is kind.').replace(/\uE000/g, '') === 'bob met dr smith. smith is kind' &&
        (certifyStep([parseClaim('St. Augustine is a saint'),parseClaim('Every saint is holy')],[parseClaim('St. Augustine is holy')],false)||{}).id === 'universal-modus-ponens'`),
        'the full stop of a title or an initial ends no sentence: the name after it is still a name, and a pronoun takes the whole name');
    check(call(`() => parseClaimFull('Ada is the same person as Bea').notes.length === 0 && (certifyStep([parseClaim('Ada is the same person as Bea'),parseClaim('Ada is tall')],[parseClaim('Bea is tall')],false)||{}).id === 'identity-substitution'`),'and an identity locution is untouched by it');
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
        const accepted=run(); support.children.push({id:'W',type:'weak-objection',texts:['If E, then it has not been shown that Ada is identical to Bea','E'],children:[]});
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
