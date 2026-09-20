'use strict';
const fs = require('fs'), assert = require('assert/strict');
const {JSDOM, VirtualConsole} = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || 'argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/weak-nesting', virtualConsole: vc,
    beforeParse(w) {
        w.matchMedia = () => ({matches: false, addEventListener() {}});
        w.ResizeObserver = class {observe() {} disconnect() {}};
        const ctx = new Proxy({}, {get: (_, p) => p === 'measureText' ? () => ({width: 40}) : () => ctx});
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
        w.alert = () => {}; w.confirm = () => true; w.prompt = () => null;
    }
});
try {
    const result = dom.window.eval(`(() => {
        const n = (id, type, text, children=[]) => ({id,type,texts:[text],children,collapsed:[],x:30000,y:30000});
        const read = trees => {
            const steps=collectDeductiveSteps(trees), verdict=claimMapVerdict(trees,steps), v=verdict('M',0);
            return {status:v.status,label:VERDICT_LABEL[v.status],why:claimVerdictWhy(verdict,v),
                steps:steps.map(st=>({id:st.childId,rule:st.rule?.id,state:verdict.stepState(st),counterexample:st.counterexample}))};
        };
        const support=n('S','support','P');
        const weak=n('W','weak-objection','It has not been shown that P');
        const root=n('M','contention','P',[support,weak]);
        const active=read([root]);
        weak.children=[n('WW','weak-rebuttal','It has not been shown that it has not been shown that P')];
        const weakOnWeak=read([root]);
        weak.children[0].children=[n('WWW','weak-objection','It has not been shown that it has not been shown that it has not been shown that P')];
        const threeWeak=read([root]);
        weak.children=[n('R','rebuttal','It is not the case that it has not been shown that P')];
        const strongDefense=read([root]);
        weak.children=[n('WW','weak-rebuttal','It has not been shown that it has not been shown that P')];
        const premise=n('P0','support','P',[weak]);
        const outer=n('M','contention','P',[premise]);
        const buried=read([outer]);
        root.children=[support,n('BAD','objection','Q')];
        const invalid=read([root]);
        root.children=[support,n('UNKNOWN','objection','The sky smiles')];
        const unknown=read([root]);
        root.children=[support,n('AMB','objection','For every individual x, x vaguely frobniculates somebody')];
        const ambiguous=read([root]);
        const contested=n('M','contention','P',[n('PS','support','P',[n('PW','weak-objection','It has not been shown that P')]),n('NO','objection','not P')]);
        const unsettledSupport=read([contested]);

        // A bounded independent oracle for chains of already certified attacks.
        // This isolates propagation from the separate natural-language tests.
        // Each fixture node begins accepted; strong accepted attacks defeat it,
        // weak accepted attacks leave it unsettled, and unsettled attacks do not cancel.
        const chains=[];
        for(let length=1;length<=6;length++) for(let mask=0;mask<(1<<length);mask++) {
            const kinds=Array.from({length},(_,i)=>(mask&(1<<i))?'weak-objection':'objection');
            let child=null; const steps=[];
            for(let i=length-1;i>=0;i--) {
                const current=n('C'+i,kinds[i],'X'+i,child?[child]:[]);
                if(child)steps.push({parentId:current.id,boxIdx:0,childId:child.id,kind:child.type,premiseTexts:child.texts,rule:{name:'fixture'},conclusionText:current.texts[0]});
                child=current;
            }
            const m=n('M','contention','P',[support,child]);
            steps.push({parentId:'M',boxIdx:0,childId:'S',kind:'support',premiseTexts:['P'],rule:{name:'fixture'},conclusionText:'P'},
                {parentId:'M',boxIdx:0,childId:child.id,kind:child.type,premiseTexts:child.texts,rule:{name:'fixture'},conclusionText:'P'});
            let attack='accepted';
            for(let i=length-1;i>=1;i--) attack=attack==='defeated'?'accepted':attack==='unsettled'?'unsettled':kinds[i]==='objection'?'defeated':'unsettled';
            const expected=attack==='defeated'?'established':'unresolved';
            const actual=claimMapVerdict([m],steps)('M',0).status;
            chains.push({kinds,expected,actual});
        }
        // Quoted warrant claims need an actual grounded undercut, not just a hedge.
        const a=n('A','objection','P');
        const w=n('UW','weak-rebuttal','It has not been shown that P');a.children=[w];
        const qualified=n('M','contention',"We cannot conclude that P from 'P'",[a]);
        const qualifiedGrounded=read([qualified]);
        w.children=[n('UWW','weak-objection','It has not been shown that it has not been shown that P')];
        const qualifiedUnsettled=read([qualified]);
        const qualifiedInvalid=read([n('M','contention',"We cannot conclude that P from 'Q'",[n('IQ','objection','Q')])]);
        // A valid entailment requiring more than one permitted move is not
        // certified merely because counterexample enumeration finds none.
        const multi=n('MULTI','support','P');multi.texts=['P','If P, then Q','If Q, then R'];
        const multiStep=read([n('M','contention','R',[multi])]);
        const counter = (p,c) => deductiveCounterexample(p.map(parseClaim),[parseClaim(c)]);
        const counterexamples={affirming:counter(['If P, then Q','Q'],'P'),
            modusPonens:counter(['If P, then Q','P'],'Q'),quantified:counter(['All ravens are black'],'P'),
            tooLarge:counter(['P and Q and R and S and T and U and V and W and X'],'Y')};
        state.trees=[n('M','contention','P',[n('BAD','objection','Q')])];deductiveLive=true;render();
        const tag=document.querySelector('.derivation-tag[data-step="BAD"]');
        const invalidUI={text:tag.textContent,title:tag.title,svg:buildExportSVG().includes('INVALID')};
        return {active,weakOnWeak,threeWeak,strongDefense,buried,invalid,unknown,ambiguous,unsettledSupport,chains,qualifiedGrounded,qualifiedUnsettled,qualifiedInvalid,multiStep,counterexamples,invalidUI};
    })()`);
    for(const name of ['active','weakOnWeak','threeWeak','buried','unknown','ambiguous','qualifiedUnsettled']) {
        assert.notEqual(result[name].status,'established',name);
        assert.equal(result[name].label,'✗ Unwarranted',name);
    }
    for(const name of ['weakOnWeak','threeWeak']) assert.ok(result[name].steps.every(st=>st.rule),name+': every weak move certified');
    assert.equal(result.strongDefense.status,'established');
    assert.equal(result.unsettledSupport.status,'unresolved','Unsettled positive support is not silently discarded to infer a decisive refutation');
    assert.equal(result.invalid.status,'established');
    assert.ok(result.invalid.steps.find(st=>st.id==='BAD').counterexample);
    assert.match(result.unknown.why,/needs clarification/);
    assert.equal(result.qualifiedGrounded.status,'established');
    assert.equal(result.qualifiedInvalid.status,'established');
    assert.match(result.qualifiedInvalid.why,/counterexample establishing invalidity/);
    assert.equal(result.multiStep.steps[0].rule,undefined);
    assert.equal(result.multiStep.steps[0].counterexample,null);
    assert.equal(result.multiStep.status,'unestablished');
    assert.equal(result.counterexamples.affirming.p,false);
    assert.equal(result.counterexamples.affirming.q,true);
    for(const name of ['modusPonens','quantified','tooLarge']) assert.equal(result.counterexamples[name],null,name);
    assert.equal(result.invalidUI.text,'✗ invalid');
    assert.match(result.invalidUI.title,/Every premise is true/);
    assert.equal(result.invalidUI.svg,true);
    for(const c of result.chains) assert.equal(c.actual,c.expected,JSON.stringify(c));
    assert.deepEqual(errors,[]);
    console.log('PASS: '+result.chains.length+' strong/weak propagation chains, nested English, invalid versus unknown steps, quoted warrants, and one-move limits.');
} finally { dom.window.close(); }
