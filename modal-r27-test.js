'use strict';
/**
 * Metaphysical necessity (r27.101). The user, 2026-10-13: modal logic as
 * groups a map switches on, one kind of necessity at a time ("Shouldn't we do
 * one of temporal, doxastic, epistemic, logical, metaphysical, physical ...?"),
 * metaphysical first; the system chosen from the cube of K and the axioms D,
 * T, 4, B and 5, by switching the axioms on; S5 when the group is first on.
 *
 *   node modal-r27-test.js [argument-mapper-r27.html]
 *
 * 1. Reading: "it is metaphysically necessary that P", "... possible ...",
 *    "... impossible ...", "in every metaphysically possible world, P", □ and
 *    ◇; a denial is the dual ("not possibly P" is "necessarily not P").
 * 2. Each axiom's steps, in each of the cube's fifteen systems, certified
 *    exactly where every frame of the system (up to three worlds) has them --
 *    judged here by a Kripke model checker of the test's own.
 * 3. Modal duality, as written and in English; one claim said twice is no
 *    step; the claims inside matched as strictly as any.
 * 4. With the group off nothing modal follows, and the check says what would
 *    take the step: the group switched on, or an axiom.
 * 5. "Necessarily", "it is necessary that", "possibly", "it is impossible
 *    that", "in every possible world": asked, with the group on, which kind
 *    is meant -- the answer written into the box. "Can" stays as it is.
 * 6. The Logic panel: the group off by default; on, S5, with D, 4 and B
 *    implied (ticked and grayed); each choice of axioms named from the cube,
 *    and every implication the closure draws true of the frames.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/modal-test', virtualConsole: vc,
    beforeParse(w) {
        const { webcrypto } = require('crypto');
        if (!w.crypto || !w.crypto.randomUUID) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
        w.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
        w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        const ctx = new Proxy({}, { get: (_, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
        w.indexedDB = { open() { const r = {}; setTimeout(() => r.onerror && r.onerror({ target: { error: new Error('x') } }), 0); return r; },
            deleteDatabase() { const r = {}; setTimeout(() => r.onsuccess && r.onsuccess({}), 0); return r; } };
        w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
        w.cancelAnimationFrame = w.clearTimeout;
        w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true; w.prompt = () => null; w.open = () => null;
    }
});
const W = dom.window, J = JSON.stringify;
const ev = src => JSON.parse(W.eval('JSON.stringify((function(){' + src + '})())'));
let passed = 0, failed = 0;
function ok(cond, label, detail) {
    if (cond) { passed++; console.log('  ✓ ' + label); }
    else { failed++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}
// The map's modal settings: off, or on with these axioms chosen.
const setModal = axioms => ev(`state.logic = { base: 'standard', rules: ${axioms ? J(Object.assign({ 'modal-meta': true },
    ...['D', 'T', '4', 'B', '5'].map(a => ({ ['modal-meta-' + a]: axioms.includes(a) })))) : '{}'} }; deductiveCache.clear(); return 1;`);
const key = t => ev(`return claimKey(parseClaim(${J(t)}));`);
const step = (premises, conclusion) => ev(`
    state.trees = [{ id: 'M', type: 'contention', texts: [${J(conclusion)}], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ${J(premises)}, collapsed: [], children: [] } ] }];
    deductiveCache.clear(); ensureCollabFields(state);
    var s = collectDeductiveSteps(state.trees)[0];
    return { tag: deductiveStepTagText(s), rule: s.rule ? s.rule.name : null, why: s.why && s.why.text || '', asks: !!s.ambiguous };`);

// A Kripke model checker of the test's own: is the step valid (truth at a
// world) in every frame, up to three worlds, with the axioms' conditions?
const COND = {
    D: (R, n) => R.every(row => row.some(Boolean)),
    T: (R, n) => R.every((row, w) => row[w]),
    4: (R, n) => R.every((row, w) => row.every((r, v) => !r || R[v].every((s, u) => !s || R[w][u]))),
    B: (R, n) => R.every((row, w) => row.every((r, v) => !r || R[v][w])),
    5: (R, n) => R.every((row, w) => row.every((r, v) => !r || row.every((s, u) => !s || R[v][u]))),
};
const FRAMES = {};
function frames(n, axioms) {
    const k = n + [...axioms].sort().join('');
    if (FRAMES[k]) return FRAMES[k];
    const out = [];
    for (let bits = 0; bits < (1 << (n * n)); bits++) {
        const R = Array.from({ length: n }, (_, w) => Array.from({ length: n }, (_, v) => !!(bits & (1 << (w * n + v)))));
        if (axioms.every(a => COND[a](R, n))) out.push(R);
    }
    return (FRAMES[k] = out);
}
function holds(f, w, R, V) {
    switch (f[0]) {
        case 'P': return V[w];
        case '¬': return !holds(f[1], w, R, V);
        case '→': return !holds(f[1], w, R, V) || holds(f[2], w, R, V);
        case '□': return R[w].every((r, v) => !r || holds(f[1], v, R, V));
        case '◇': return R[w].some((r, v) => r && holds(f[1], v, R, V));
    }
}
function valid(premises, conclusion, axioms) {
    for (let n = 1; n <= 3; n++) for (const R of frames(n, axioms))
        for (let bits = 0; bits < (1 << n); bits++) {
            const V = Array.from({ length: n }, (_, w) => !!(bits & (1 << w)));
            for (let w = 0; w < n; w++) if (premises.every(p => holds(p, w, R, V)) && !holds(conclusion, w, R, V)) return false;
        }
    return true;
}
const show = f => f[0] === 'P' ? 'P' : f[0] === '→' ? '(' + show(f[1]) + ' → ' + show(f[2]) + ')' : f[0] + show(f[1]);
const p = ['P'], nec = a => ['□', a], poss = a => ['◇', a], not = a => ['¬', a];
// The cube's fifteen systems, as chosen axioms, and their names.
const SYSTEMS = { K: [], D: ['D'], T: ['T'], K4: ['4'], D4: ['D', '4'], S4: ['T', '4'], K5: ['5'], D5: ['D', '5'], K45: ['4', '5'], D45: ['D', '4', '5'],
    KB: ['B'], DB: ['D', 'B'], B: ['T', 'B'], KB5: ['B', '5'], S5: ['T', '5'] };

console.log('\n-- 1. reading --');
{
    ok(key('It is metaphysically necessary that God exists.') === '□meta(P:god|~exist)' && key('It is metaphysically possible that zombies exist.') === '◇meta(P:zombies|~exist)',
        '"it is metaphysically necessary that P", "... possible that P"');
    ok(key('It is not metaphysically possible that zombies exist.') === key('It is metaphysically necessary that zombies do not exist.') &&
        key('It is metaphysically impossible that zombies exist.') === '□meta(N(P:zombies|~exist))' &&
        key('It is not metaphysically necessary that God exists.') === '◇meta(N(P:god|~exist))',
        'a denial is the dual: "not possibly P" is "necessarily not P"; "impossible"; "not necessarily P" is "possibly not P"');
    ok(key('In every metaphysically possible world, God exists.') === '□meta(P:god|~exist)' &&
        key('There is a metaphysically possible world in which zombies exist.') === '◇meta(P:zombies|~exist)', 'possible worlds, so named');
    ok(key('□P') === '□meta(A:p)' && key('◇(P → Q)') === '◇meta(I(A:p>A:q))' && key('□P → P') === 'I(□meta(A:p)>A:p)' && key('$\\Box P$') === '□meta(A:p)',
        '□ and ◇, and LaTeX\'s \\Box');
    ok(key('It is metaphysically necessary that God exists and evil exists.') === '□meta(C[P:god|~exist;P:evil|~exist])' &&
        key('It is metaphysically necessary that God exists, and evil exists.') === 'C[□meta(P:god|~exist);P:evil|~exist]',
        'what follows "that" runs to the end -- unless a comma before "and" ends it');
    ok(/^A:necessarily/.test(key('Necessarily, God exists.')), 'with the group off, "necessarily" is read as before: one claim');
}

console.log('\n-- 2. each axiom, in each of the fifteen systems --');
{
    const A = p, B2 = ['P'];
    const steps = [
        ['T', [nec(A)], A], ['T', [A], poss(A)], ['D', [nec(A)], poss(A)],
        ['4', [nec(A)], nec(nec(A))], ['4', [poss(poss(A))], poss(A)],
        ['B', [A], nec(poss(A))], ['B', [poss(nec(A))], A],
        ['5', [poss(A)], nec(poss(A))], ['5', [poss(nec(A))], nec(A)],
        ['K', [nec(['→', A, nec(A)]), nec(A)], nec(nec(A))],
        ['none', [A], nec(A)], ['none', [poss(A)], A], ['none', [poss(A)], nec(A)], ['none', [nec(poss(A))], poss(nec(A))],
    ];
    let right = 0, wrong = [];
    for (const [name, axioms] of Object.entries(SYSTEMS)) {
        setModal(axioms);
        for (const [, P, C] of steps) {
            const certified = !!step(P.map(show), show(C)).rule, holdsIn = valid(P, C, axioms);
            if (certified && !holdsIn) wrong.push('UNSOUND ' + name + ': ' + P.map(show).join(', ') + ' ⊢ ' + show(C));
            else if (!certified && holdsIn) wrong.push('missed ' + name + ': ' + P.map(show).join(', ') + ' ⊢ ' + show(C));
            else right++;
        }
    }
    ok(!wrong.length, 'certified exactly where the system\'s frames have it: ' + right + ' of ' + (15 * steps.length), wrong.slice(0, 6).join(' | '));
    setModal(['T', '5']);
    const names = [step(['□P'], 'P').rule, step(['P'], '◇P').rule, step(['□P'], '◇P').rule, step(['□P'], '□□P').rule, step(['P'], '□◇P').rule, step(['◇□P'], '□P').rule];
    ok(J(names) === J(['axiom T', 'axiom T', 'axiom D', 'axiom 4', 'axiom B', 'axiom 5']), 'each named by its axiom', J(names));
    ok(step(['It is metaphysically necessary that God exists.'], 'God exists.').rule === 'axiom T' &&
        step(['It is metaphysically possible that it is metaphysically necessary that God exists.'], 'It is metaphysically necessary that God exists.').rule === 'axiom 5' &&
        step(['It is metaphysically necessary that if God exists, then evil is a mystery.', 'It is metaphysically necessary that God exists.'],
            'It is metaphysically necessary that evil is a mystery.').rule === 'axiom K' &&
        step(['It is metaphysically necessary that if God exists, then evil is a mystery.', 'It is metaphysically possible that God exists.'],
            'It is metaphysically possible that evil is a mystery.').rule === 'axiom K',
        'in English: T, 5 ("possibly necessarily, so necessarily"), and K for necessity and for possibility');
}

console.log('\n-- 3. duality, and strict matching --');
{
    setModal(['T', '5']);
    ok(step(['It is not metaphysically possible that zombies exist.'], 'It is metaphysically necessary that zombies do not exist.').rule === 'modal duality' &&
        step(['It is not metaphysically necessary that God exists.'], 'It is metaphysically possible that God does not exist.').rule === 'modal duality' &&
        step(['¬◇P'], '□¬P').rule === 'modal duality' && step(['¬□¬P'], '◇P').rule === 'modal duality' && step(['¬◇¬P'], '□¬¬P').rule === 'modal duality',
        'modal duality, in English and as written');
    ok(/only repeats/.test(step(['It is metaphysically impossible that zombies exist.'], 'It is not metaphysically possible that zombies exist.').why) &&
        /only repeats/.test(step(['In every metaphysically possible world, God exists.'], 'It is metaphysically necessary that God exists.').why),
        'one claim said twice is no step: "impossible" and "not possible"; "in every possible world" and "necessary"');
    ok(!step(['It is metaphysically necessary that God exists.'], 'God is existent.').rule &&
        !step(['It is metaphysically necessary that if God exists, then evil is a mystery.', 'It is metaphysically necessary that God is real.'],
            'It is metaphysically necessary that evil is a mystery.').rule, 'the claims inside matched strictly: "exists" is not "is existent"');
    ok(step(['If it is metaphysically necessary that God exists, then evil is a mystery.', 'It is metaphysically necessary that God exists.'], 'Evil is a mystery.').rule === 'modus ponens',
        'a modal claim is a claim like any other to the other rules: modus ponens on it');
    ok(step(['If it is metaphysically necessary that God exists, then evil is a mystery.', 'In every metaphysically possible world, God exists.'], 'Evil is a mystery.').rule === 'modus ponens',
        'its operator\'s words are logic, as a quantifier\'s are: "in every metaphysically possible world" matches "it is metaphysically necessary that"');
    ok(/^Worded the same way each time, the premises would give “Plato was right” by modus ponens, but ‘the soul survives the death of a body’ and ‘the soul survives the death of the body’ differ/.test(
        step(['If it is metaphysically necessary that the soul survives the death of the body, then Plato was right.', 'It is metaphysically necessary that the soul survives the death of a body.'], 'Plato was right.').why),
        'and the check says which words inside differ');
    ok(step(['It is not the case that it is metaphysically possible that it does not rain.'], 'It is metaphysically necessary that it is not the case that it does not rain.').rule === 'modal duality',
        'duality as the schema has it, in English: "not possibly not P" to "necessarily not not P"');
    ok(step(['□P ∧ Q'], 'Q ∧ □P').rule === 'commutation' && step(['¬(□P ∧ Q)'], '¬□P ∨ ¬Q').rule === 'De Morgan’s laws' &&
        step(['It is metaphysically necessary that God exists, and evil exists.'], 'Evil exists, and it is metaphysically necessary that God exists.').rule === 'commutation',
        'to the rules of first-order logic a modal claim is one claim: commutation, De Morgan');
    ok(step(['□P → Q', '¬Q'], 'R').why === 'The premises give “◇¬P” by modus tollens, but not “R”.' && key('∀x □F(x)') !== key('∀x ◇F(x)'),
        'said in symbols: "◇¬P", the denial of "□P"; and inside a quantifier, kept apart');
    ok(ev(`var a = parseClaim('Mary is happy.'), b = Object.assign(parseClaim('Mary is happy.'), { src: 'mary is very happy' });
        return claimSame(claimModal('nec', a), claimModal('nec', a)) && !claimSame(claimModal('nec', a), claimModal('nec', b));`),
        'two modal claims are one only where the claims inside are worded alike');
    ok(ev(`var f = claimFolOf(parseClaim('It is metaphysically necessary that God exists.')), s = readSymbolicClaim('□P ∧ Q');
        return !!f && f.op === 'letter' && JSON.stringify(s.folTree).indexOf('"nec"') < 0 && JSON.stringify(s.parts[0].folTree).indexOf('"nec"') < 0;`),
        'to the first-order rules a modal claim is one letter: in English, and in a formula and its parts');
    ok(ev(`var f = claimModal('poss', parseClaim('God does not exist.'));
        return [claimSayForm(f, { texts: ['God does not exist.'], style: 0 }), claimShowForm(f)];`).every(t => /^it is metaphysically possible that god does not exist$/i.test(t)),
        'said in words, and shown in what the check says');
}

console.log('\n-- 4. the group off, or an axiom missing --');
{
    setModal(null);
    const off = step(['It is metaphysically necessary that God exists.'], 'God exists.');
    ok(!off.rule && off.why === 'With Metaphysical necessity switched on in the Logic panel, the premises would give “God exists” by axiom T.', 'off: nothing follows, and the check says what would take it', J(off));
    setModal(['T']);
    const t = step(['It is metaphysically possible that God exists.'], 'It is metaphysically necessary that it is metaphysically possible that God exists.');
    ok(!t.rule && t.why === 'The premises would give “It is metaphysically necessary that it is metaphysically possible that God exists” by axiom 5, which this map\'s system, T, does not have: switch on 5 in the Logic panel.',
        'in T, "possibly, so necessarily possibly" takes axiom 5, and the check says so', J(t));
    ok(!step(['P'], '□P').rule && !/would give/.test(step(['P'], '□P').why), 'no system gives "P, so necessarily P": nothing is said of one');
}

console.log('\n-- 5. necessity without its kind: asked --');
{
    setModal(['T', '5']);
    const n = step(['Necessarily, God exists.'], 'God exists.');
    // r27.166 (the user: "the user is notified only when two valid
    // disambiguations are available"): "necessarily" offers one kind, so it
    // is no question to choose in -- the step waits, and says why. With
    // "possibly", "for all we know" or "metaphysically possible": asked.
    ok(!n.rule && n.asks && n.why === '“Necessarily, God exists.” is ambiguous: "necessarily" does not say which kind of necessity is meant: metaphysical, logical, physical, or what is known.',
        '"necessarily": the step waits, and says that which kind is meant is not said -- no lone reading offered as the one it follows on', J(n));
    ok(step(['It is necessary that God exists.'], 'God exists.').asks && step(['It is impossible that zombies exist.'], 'Zombies do not exist.').asks &&
        step(['In every possible world, God exists.'], 'God exists.').asks &&
        step(['God exists.'], 'Possibly, God exists.').why === 'Did you mean “For all we know, God exists” or “It is metaphysically possible that God exists”?',
        '"it is necessary that", "it is impossible that", "in every possible world", and "possibly", asked with "for all we know" or "metaphysically possible"');
    const chosen = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['God exists.'], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ['Necessarily, God exists.'], collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); render();
        var s = collectDeductiveSteps(state.trees)[0]; openReadingChooser(s, document.body);
        var row = Array.prototype.find.call(document.querySelectorAll('#reading-chooser .rc-row'), function (r) { return /metaphysically necessary/.test(r.textContent); });
        if (row) { var radio = row.querySelector('input'); radio.checked = true; radio.dispatchEvent(new Event('change')); document.querySelector('#reading-chooser .rc-apply').click(); }
        closeReadingChooser();
        deductiveCache.clear(); var t = collectDeductiveSteps(state.trees)[0];
        return { box: findNodeContext(state.trees, 'A').node.texts[0], rule: t.rule ? t.rule.name : null };`);
    ok(chosen.box === 'Necessarily, God exists.' && chosen.rule === null && step(['It is metaphysically necessary that God exists.'], 'God exists.').rule === 'axiom T',
        'no reading to write in: the box stays as it is, the step waiting; said "metaphysically necessary", it follows by axiom T', J(chosen));
    setModal(null);
    ok(!step(['Necessarily, God exists.'], 'God exists.').asks, 'with the group off, nothing is asked');
    setModal(['T', '5']);
    ok(step(['Mary sings.'], 'Mary can sing.').why === 'Did you mean “Mary is able to sing”, “It is possible for Mary to sing”, or “Mary is allowed to sing”?' &&
        step(['Mary sings.'], 'It is possible for Mary to sing.').rule === 'ab esse ad posse', '"can" stays as it is: asked which, and "possible for" follows by ab esse ad posse');
}

console.log('\n-- 6. the Logic panel --');
{
    const panel = () => ev(`renderLogicPanel(); var b = document.getElementById('eval-logic-body'), m = b.querySelector('[data-modal="meta"]');
        return { on: m.checked, hidden: document.getElementById('logic-modal-meta-body').hidden, system: b.querySelector('[data-modal-name="meta"]').textContent,
            axioms: Array.prototype.map.call(b.querySelectorAll('input[data-axiom]'), function (c) { return c.dataset.axiom + (c.checked ? '+' : '-') + (c.disabled ? '/' : ''); }).join(' ') };`);
    setModal(null);
    const off = panel();
    ok(!off.on && off.hidden, 'off by default, the axioms hidden', J(off));
    ev(`document.querySelector('[data-modal="meta"]').click(); return 1;`);
    const on = panel();
    ok(on.on && !on.hidden && on.system === 'S5' && on.axioms === 'D+/ T+ 4+/ B+/ 5+', 'switched on: S5, T and 5 chosen, D, 4 and B implied (ticked and grayed)', J(on));
    ev(`document.querySelector('input[data-axiom="5"]').click(); return 1;`);
    const t = panel();
    ev(`document.querySelector('input[data-axiom="4"]').click(); return 1;`);
    const s4 = panel();
    ok(t.system === 'T' && t.axioms === 'D+/ T+ 4- B- 5-' && s4.system === 'S4', '5 off: T; 4 on: S4', J([t, s4]));
    ok(ev(`return state.logic.rules;`)['modal-meta-4'] === true && ev(`return state.logic.rules;`)['modal-meta-5'] === false, 'the choice is the map\'s: kept in its settings');
    ok(ev(`return Array.prototype.map.call(document.querySelectorAll('#eval-logic-base option'), function (o) { return o.textContent; });`).every(t => !/Modal/.test(t)),
        'no "Modal (later)" among the base logics: modal logic is a group');
    ok(ev(`return document.getElementById('help-panel').textContent;`).includes('switch on Metaphysical necessity in the Logic panel and choose its axioms (S5 to start)') &&
        ev(`return Array.prototype.some.call(document.querySelectorAll('style'), function (s) { return s.textContent.indexOf('.logic-modal label.implied') >= 0; });`),
        'Help says how, and an implied axiom has its look');
    // Every choice of axioms named from the cube, and every implication the
    // closure draws true of the frames: what a choice gives, its frames have.
    const names = ev(`var out = {}; for (var m = 0; m < 32; m++) { var c = ['D', 'T', '4', 'B', '5'].filter(function (_, i) { return m & (1 << i); });
        out[c.join('')] = { name: claimModalSystem(claimModalClosure(c)), has: Array.from(claimModalClosure(c)) }; } return out;`);
    let wrongs = [];
    Object.entries(names).forEach(([c, r]) => {
        const chosen = c.split('').filter(Boolean);
        if (!Object.prototype.hasOwnProperty.call(SYSTEMS, r.name)) wrongs.push(c + ' named ' + r.name);
        ['D', 'T', '4', 'B', '5'].forEach(a => {
            const implied = [1, 2, 3].every(n => frames(n, chosen).every(R => COND[a](R, n)));
            if (implied !== r.has.includes(a)) wrongs.push(c + (implied ? ' should give ' : ' should not give ') + a);
        });
    });
    Object.entries(SYSTEMS).forEach(([name, axioms]) => { if (names[axioms.join('')].name !== name) wrongs.push(axioms.join('') + ' named ' + names[axioms.join('')].name + ', not ' + name); });
    ok(!wrongs.length, 'all 32 choices of axioms: named from the cube, and each closure true of the frames', wrongs.slice(0, 5).join(' | '));
}

console.log('\n-- 7. "would" and "could" --');
{
    // r27.112 (the user, 2026-10-20: '"Everyone would" is ∀x □P vs "Someone
    // could not", ∃x ◇~P, and ∀x □P is equivalent to ~∃x ◇~P, and ~∃x ◇~P
    // straightforwardly contradicts ∃x ◇~P'; "Let's add that as a switch but
    // leave it on by default").
    const attack = (ps, c) => ev(`state.trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], x: 0, y: 0, children: [
        { id: 'O', type: 'objection', texts: ${J(ps)}, collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); var s = collectDeductiveSteps(state.trees)[0]; return s.rule ? s.rule.name : null;`);
    const IF = 'If real experiences are not more valuable than fake ones in the world of the experience machine, then everyone would rationally choose to plug into the experience machine.';
    const R = 'Real experiences are not more valuable than fake ones in the world of the experience machine.';
    const S = 'Someone could rationally choose not to plug into the experience machine.';
    setModal(null);
    const on = attack([IF, R], S), mt = step(['If it rains, then Bob would choose to stay.', 'Bob could choose not to stay.'], 'It does not rain.');
    const same = [key('Everyone would decide to leave.') === key('No one could decide not to leave.'), key('Bob would choose to stay.') === key('It is not the case that Bob could choose not to stay.'),
        step(['If it rains, then Bob would choose to stay.', 'It rains.'], 'Bob could not choose not to stay.').rule === 'modus ponens'];
    ok(on === 'modus ponens' && mt.rule === 'modus tollens' && same.every(Boolean),
        '"everyone would rationally choose to plug in" denies "someone could rationally choose not to plug in": the objection follows by modus ponens; modus tollens with "could choose not to"; "everyone would decide to leave" is "no one could decide not to leave"',
        J([on, mt, same]));
    ev(`state.logic = { base: 'standard', rules: { 'modal-would': false } }; deductiveCache.clear(); return 1;`);
    const off = attack([IF, R], S);
    ok(off === null && key('Bob would choose to stay.') !== key('It is not the case that Bob could choose not to stay.'),
        'switched off, not certified: "would" after "then" makes a what-if claim, as before', J(off));
    setModal(null);
    const wet = step(['If it rains, the ground would be wet.', 'It rains.'], 'The ground is wet.');
    ok(wet.rule === 'modus ponens', 'a "would" not said of a choice is a what-if, as before: "if it rains, the ground would be wet" and "it rains" give "the ground is wet"', J(wet));
    const panel = ev(`renderLogicPanel(); var b = document.getElementById('eval-logic-body'), w = b.querySelector('[data-modal="would"]');
        var r = { checked: w.checked, label: w.nextSibling.textContent }; w.click();
        r.off = state.logic.rules['modal-would'] === false && !b.querySelector('[data-modal="would"]').checked; w.click();
        r.on = b.querySelector('[data-modal="would"]').checked; state.logic = { base: 'standard', rules: {} }; deductiveCache.clear(); return r;`);
    ok(panel.checked && panel.label === '“Would” and “could”' && panel.off && panel.on,
        'the Logic panel: "“Would” and “could”" under Modal logic, on by default; it switches off and back on', J(panel));
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
