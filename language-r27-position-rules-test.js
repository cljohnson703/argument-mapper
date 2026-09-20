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
    // Mixed English/symbolic negation must survive Markdown cleanup. In
    // classical Standard mode, Q unless P is Q or P (not exclusive or).
    for (const neg of ['~','¬','∼','!','-','−','not ','\\neg ']) {
        for (const text of [`Q unless ${neg}P`,`Unless ${neg}P, Q`]) {
            check(rule([text,'P'],'Q') === 'disjunctive-syllogism', 'unless denial, positive premise: '+text);
            check(!rule([text,'~P'],'Q'), 'unless denial, negative premise cannot eliminate: '+text);
            check(call(`s => claimSame(parseClaim(s),parseClaim('Q ∨ ¬P'))`,text), 'unless is inclusive or: '+text);
        }
    }
    for (const text of ['Q unless P','Unless P, Q']) {
        check(rule([text,'~P'],'Q') === 'disjunctive-syllogism','plain unless: '+text);
        check(!rule([text,'P'],'Q'),'no affirming a disjunct: '+text);
    }
    for (const pair of [['If ~P, then Q','Q if ~P'],['Q or ~P','~P or Q']]) {
        check(call(`x => claimSame(parseClaim(x[0]),parseClaim(x[1]))`,pair),'mixed negation in other connectives: '+pair);
    }
    check(call(`() => stripClaimMarkup('Q unless ~P') === 'Q unless ~P'`),'preserve single tilde in text cleanup');
    check(call(`() => stripClaimMarkup('~~obsolete~~') === 'obsolete'`),'paired Markdown strikethrough still strips');
    for (const text of ['Q unless ~P','Unless ~P, Q']) {
        const result = call(`s => {
            const root={id:'M',type:'contention',texts:['Q'],children:[{id:'S',type:'support',texts:[s,'~P'],children:[]}]};
            const step=collectDeductiveSteps([root])[0];
            return {rule:step.rule?.id,counterexample:step.counterexample};
        }`,text);
        check(!result.rule && result.counterexample?.p === false && result.counterexample?.q === false,
            'canvas step finds the counterexample: '+text);
    }
    const a = 'Poe is a raven', b = 'Poe is black';
    for (const marker of ['if','provided','provided that','providing','providing that','as long as','so long as',
        'on condition that','on the condition that','in the event that','on the assumption that',
        'assuming','assuming that','supposing','supposing that','whenever']) {
        for (const text of [`${marker} ${a}, ${b}`,`${marker} ${a}, then ${b}`,`${b} ${marker} ${a}`,`${b}, ${marker} ${a}`]) {
            check(call(`x => claimSame(parseClaim(x),parseClaim('If Poe is a raven, then Poe is black'))`,text),'equivalent: '+text);
            check(rule([text,a],b) === 'modus-ponens','MP: '+text);
            check(rule([text,'Poe is not black'],'Poe is not a raven') === 'modus-tollens','MT: '+text);
            check(!rule([text,b],a),'no converse: '+text);
        }
    }
    // Anaphors/scope do not become safe merely by moving the condition.
    for (const marker of ['if','supposing that','on the assumption that','providing that']) {
        check(call(`s => parseClaimFull(s).notes.some(n => n.kind === 'ambiguous')`,`${b} ${marker} ${a} and Fido is white`), 'scope flag: '+marker);
    }
    const quoted = '"Poe is a raven" and "If Poe is a raven, then Poe is black"';
    for (const verb of ['conclude','infer','establish','determine']) for (const neg of ["can't",'cannot','can not','can’t']) {
        for (const subject of ['we','one']) {
            const frame = `${subject} ${neg} ${verb} that ${b}`;
            check(call(`x => claimSame(parseClaim(x[0]),parseClaim(x[1]))`,[
                `From ${quoted}, ${frame}`, `${frame} from ${quoted}`]),'hedge position: '+frame);
        }
    }
    for (const verb of ['concluded','inferred','established','determined']) for (const neg of ["can't",'cannot','can not','can’t']) {
        const frame = `it ${neg} be ${verb} that ${b}`;
        for (const [open,close] of [['"','"'],["'","'"],['“','”'],['‘','’']]) {
            const quotes = quoted.replace(/"([^"]+)"/g,(_,s) => open+s+close);
            check(call(`x => {
                const front=parseClaim(x[0]), back=parseClaim(x[1]);
                return front.kind==='unestablished' && !!front.from && claimSame(front,back);
            }`,[`From ${quotes}, ${frame}`,`${frame} from ${quotes}`]), 'passive hedge/quotes: '+frame+' '+open);
        }
    }
    for (const pair of [
        [['P or Q','not P or R'],'Q or R'],
        [['P or Q','not P or Q'],'Q'],
        [['P or Q or R','not P or S'],'Q or R or S'],
        [['Poe is a raven or Fido is white','Poe is not a raven or Ada is happy'],'Fido is white or Ada is happy']
    ]) for (const premises of [pair[0],[...pair[0]].reverse()]) check(rule(premises,pair[1]) === 'resolution','resolution: '+premises);
    for (const pair of [
        [['P or Q','P or R'],'Q or R'],
        [['P or Q or R','not P or S'],'Q or S'],
        [['P or Q','not P or not Q'],'R'],
        [['P','We cannot conclude that P'],'Q']
    ]) check(!rule(...pair),'reject invalid/weak explosion: '+pair);
    check(rule(['P','not P'],'Q') === 'explosion','classical explosion');
    check(rule(['not P','P'],'Q') === 'explosion','explosion order');
    check(rule(['If P, then Q','If P, then not Q'],'not P') === 'reductio','retain reductio');
    check(rule(['If P, then not P'],'not P') === 'reductio','retain one-premise reductio');
    check(!rule(['If P, then Q','If R, then not Q'],'not P'),'different assumptions are not reductio');
    check(call(`() => deriveConclusion(['P ∨ Q','¬P ∨ R'])?.rule.id === 'resolution'`),'derive resolution');
    check(call(`() => deriveConclusion(['P','not P']) === null`),'do not invent an arbitrary conclusion');
    const explosionMap = call(`() => {
        const group = {id:'S',type:'support',texts:['P','not P'],children:[]};
        const root = {id:'M',type:'contention',texts:['Q'],children:[group]};
        const steps = collectDeductiveSteps([root]);
        const verdict = claimMapVerdict([root],steps), v = verdict('M',0);
        return {rule:steps[0].rule?.id,label:VERDICT_LABEL[v.status],why:claimVerdictWhy(verdict,v)};
    }`);
    check(explosionMap.rule === 'explosion' && explosionMap.label === '✗ Unwarranted' && explosionMap.why.includes('contradictory'), 'valid explosion is not warranted: '+JSON.stringify(explosionMap));
    // Exhaustive truth-table oracle over all pairs of two-literal clauses.
    // It evaluates the original strings independently of the parser.
    const literals = ['P','not P','Q','not Q','R','not R'];
    const val = (s,m) => s.startsWith('not ') ? !m[s.slice(4)] : m[s];
    for (const x of literals) for (const y of literals) for (const z of literals) {
        const premises = [`${x} or ${y}`,`${x.startsWith('not ') ? x.slice(4) : 'not '+x} or ${z}`];
        const conclusion = y === z ? y : `${y} or ${z}`;
        check(!!rule(premises,conclusion),'resolution instance: '+premises);
        for (let bits = 0; bits < 8; bits++) {
            const m = {P:!!(bits&1),Q:!!(bits&2),R:!!(bits&4)};
            check(!premises.every(p => p.split(' or ').some(l => val(l,m))) || conclusion.split(' or ').some(l => val(l,m)), 'truth table: '+premises+' => '+conclusion);
        }
    }
    check(!errors.length,errors.join('; '));
    assert.equal(failures.length,0,failures.join('\n'));
    console.log(count+' phrase-position, hedging, classical-rule and truth-table checks passed.');
} finally {dom.window.close();}
