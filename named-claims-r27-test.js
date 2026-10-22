'use strict';
/**
 * Named claims (r27.116; the user: 'there are some nodes that involve naming
 * a principle, like: "Ex nihilo principle: Nothing comes from nothing". I want
 * the content of the principle to be counted, not the name of the principle.
 * It's sort of doing double duty as a premise and a definition such that all
 * instances of the ex nihilo principle refer to the definition.').
 *
 *   node named-claims-r27-test.js [argument-mapper-r27.html]
 *
 * 1. A box "<name>: <claim>" says its claim: a principle, a law, a thesis
 *    and their kin, an "-ism", an acronym, a name with its acronym. A kind of
 *    claim alone ("Definition:") names nothing. Not a clause before the colon.
 * 2. Wherever the map says the name as a claim, it is read as its claim: "the
 *    ex nihilo principle is true", "... is false", "holds", "if the PSR, then
 *    ...", "physicalism implies that ...", the name alone. Not as an object,
 *    an appositive's noun, or one of two nouns joined.
 * 3. The colors: the claim's words where its name is.
 * 4. A premise link to the box reads its claim, without its name; a name in
 *    a named claim is read too; a name given two claims is read as neither,
 *    and the check says so.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/named-claims-test', virtualConsole: vc,
    beforeParse(w) {
        const { webcrypto } = require('crypto');
        if (!w.crypto || !w.crypto.randomUUID) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
        w.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
        w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        const ctx = new Proxy({}, { get: (_, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
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
// A step, with other boxes on the map (`defs`, each a contention of its own,
// ids D0, D1, ...): its tag, its rule, what the check says, its premises as
// read, and their colors.
const step = (premises, conclusion, defs, type) => ev(`
    var child = { id: 'A', type: ${J(type || 'support')}, texts: ${J(premises)}, collapsed: [], children: [] };
    state.trees = [{ id: 'M', type: 'contention', texts: [${J(conclusion)}], collapsed: [], x: 0, y: 0, children: [child] }]
        .concat(${J(defs || [])}.map(function (t, j) { return { id: 'D' + j, type: 'contention', texts: [t], collapsed: [], x: 2000, y: 300 * j, children: [] }; }));
    deductiveCache.clear(); ensureCollabFields(state); selectedIds = []; render();
    if (!inferenceColorsOn) cycleInferenceColors();
    var steps = collectDeductiveSteps(state.trees); applyInferenceColors(steps);
    var s = steps.find(function (x) { return x.childId === 'A'; });
    var colors = s.premiseTexts.map(function (_, j) {
        var rd = document.querySelector('.node[data-node-id="A"][data-node-idx="' + j + '"] .rendered-text'), o = [];
        if (rd) rd.querySelectorAll('span.ic').forEach(function (sp) {
            if (sp.parentElement.closest('span.ic')) return;
            var cls = sp.className.replace(/^ic /, '');
            sp.childNodes.forEach(function (c) { var k = c.nodeType === 1 && c.matches('span.ic-neg') ? cls + ' ic-neg' : cls;
                if (o.length && o[o.length - 1].c === k) o[o.length - 1].t += c.textContent; else o.push({ c: k, t: c.textContent }); });
        });
        return o.filter(function (p) { return p.t.trim(); }).map(function (p) { return p.c + ': ' + p.t.trim(); });
    });
    return { tag: deductiveStepTagText(s), rule: s.rule ? s.rule.name : null, why: s.why && s.why.text || '', read: s.premiseTexts, colors: colors };`);
const key = t => ev(`return claimKey(parseClaim(${J(t)}));`);
const ENP = 'Ex nihilo principle: Nothing comes from nothing.';

console.log('\n-- 1. a box that names its claim says the claim --');
{
    ok(key(ENP) === key('Nothing comes from nothing.') && key('The ex nihilo principle: Nothing comes from nothing.') === key('Nothing comes from nothing.'),
        '"Ex nihilo principle: ..." (it had been one claim, its name and all)', key(ENP));
    ok(key('The principle of sufficient reason (PSR): Everything has an explanation.') === key('Everything has an explanation.') &&
        key('PSR: Everything has an explanation.') === key('Everything has an explanation.') && key('Physicalism: Everything is physical.') === key('Everything is physical.') &&
        key('The law of identity: Everything is identical to itself.') === key('Everything is identical to itself.'),
        'a name with its acronym, an acronym, an "-ism", "the law of ..."');
    ok(key('Definition: A bachelor is an unmarried man.') === key('A bachelor is an unmarried man.') && J(ev(`return claimNamedLabel('Definition: A bachelor is an unmarried man.');`).names) === '[]',
        '"Definition:" is a kind of claim: read as its claim, and naming nothing');
    ok(key('There are two options: stay or go.') !== key('Stay or go.') && ev(`return claimNamedLabel('There are two options: stay or go.');`) === null &&
        ev(`return claimNamedLabel('My favorite principle: pizza.');`) === null && ev(`return claimNamedLabel('Bob said: Poe is black.');`) === null,
        'not a clause before the colon, nor a name with no claim after it');
    ok(key('Premise 1: Nothing comes from nothing.') === key('Nothing comes from nothing.'), 'a label as before');
    ok(ev(`return document.getElementById('help-panel').textContent;`).includes('To give a claim a name, write the name before a colon (Ex nihilo principle: Nothing comes from nothing): the box says the claim'),
        'Help says how to name a claim');
}

console.log('\n-- 2. the name, said as a claim, is read as its claim --');
{
    const own = step([ENP, 'If nothing comes from nothing, then the universe has a cause.'], 'The universe has a cause.');
    ok(own.rule === 'modus ponens', 'the box itself, a premise: its claim', J(own));
    const ref = step(['If the ex nihilo principle is true, then the universe has a cause.', 'Nothing comes from nothing.'], 'The universe has a cause.', [ENP]);
    ok(ref.rule === 'modus ponens' && ref.read[0] === 'If (Nothing comes from nothing) is true, then the universe has a cause.',
        'its name elsewhere on the map: "the ex nihilo principle is true" is its claim', J(ref));
    ok(step(['If the ex nihilo principle is true, then the universe has a cause.', ENP], 'The universe has a cause.').rule === 'modus ponens', 'the name and the box in one step');
    const ob = step(['If quantum fluctuations occur, then the ex nihilo principle is false.', 'Quantum fluctuations occur.'], ENP, [], 'objection');
    ok(ob.rule === 'modus ponens', '"... is false": the denial of its claim, an objection to the box', J(ob));
    const forms = [
        step(['If the PSR, then the universe has an explanation.', 'Everything has an explanation.'], 'The universe has an explanation.', ['PSR: Everything has an explanation.']),
        step(['If the principle of sufficient reason holds, then the universe has an explanation.', 'The PSR is true.'], 'The universe has an explanation.',
            ['The principle of sufficient reason (PSR): Everything has an explanation.']),
        step(['If physicalism is true, then zombies are impossible.', 'Everything is physical.'], 'Zombies are impossible.', ['Physicalism: Everything is physical.']),
        step(['Physicalism implies that zombies are impossible.', 'Physicalism.'], 'Zombies are impossible.', ['Physicalism: Everything is physical.']),
        step(['If the ex nihilo principle does not hold, then something came from nothing.', 'The ex nihilo principle is mistaken.'], 'Something came from nothing.', [ENP])];
    ok(forms.every(x => x.rule === 'modus ponens'), '"if the PSR, then", "holds", "the PSR is true", "physicalism is true", "implies", the name alone, "does not hold", "is mistaken"',
        J(forms.map(x => [x.rule, x.read])));
    const kept = [
        step(['If Aquinas accepts the ex nihilo principle, then Aquinas is consistent.', 'Aquinas accepts the ex nihilo principle.'], 'Aquinas is consistent.', [ENP]),
        step(['Physicalism, the view that everything is physical, is popular.'], 'Physicalism is popular.', ['Physicalism: Everything is physical.']),
        step(['Theism and atheism are rival views.'], 'Theism is a view.', ['Theism: God exists.'])];
    ok(kept[0].rule === 'modus ponens' && kept.every(x => J(x.read) === J(x.read.map(String)) && !/\(/.test(x.read.join(' '))),
        'as a noun it stays a name: "accepts the ex nihilo principle", "Physicalism, the view that ...", "Theism and atheism"', J(kept.map(x => x.read)));
}

console.log('\n-- 3. the colors --');
{
    const ref = step(['If the ex nihilo principle is true, then the universe has a cause.', 'Nothing comes from nothing.'], 'The universe has a cause.', [ENP]);
    ok(J(ref.colors) === J([['ic-rest: If', 'ic-k0: the ex nihilo principle is true', 'ic-rest: , then', 'ic-c: the universe has a cause', 'ic-rest: .'],
        ['ic-k0: Nothing comes from nothing', 'ic-rest: .']]), 'the name, where its claim meets the other premise, that claim\'s color', J(ref.colors));
    const own = step([ENP, 'If nothing comes from nothing, then the universe has a cause.'], 'The universe has a cause.');
    ok(J(own.colors[0]) === J(['ic-rest: Ex nihilo principle:', 'ic-k0: Nothing comes from nothing', 'ic-rest: .']), 'the box: its claim colored, its name not', J(own.colors[0]));
    const ob = step(['If quantum fluctuations occur, then the ex nihilo principle is false.', 'Quantum fluctuations occur.'], ENP, [], 'objection');
    ok(ob.colors[0].includes('ic-c: the ex nihilo principle') && ob.colors[0].includes('ic-c ic-neg: is false'), 'an objection\'s "is false" red', J(ob.colors[0]));
}

console.log('\n-- 4. links, names in named claims, a name given two claims --');
{
    const link = step(['If [S1](#box:D0), then the universe has a cause.', 'Nothing comes from nothing.'], 'The universe has a cause.', [ENP]);
    ok(link.rule === 'modus ponens' && link.read[0] === 'If (Nothing comes from nothing), then the universe has a cause.', 'a premise link to the box reads its claim, without its name', J(link));
    const nested = step(['The theistic principle is true.', 'The PSR is true.'], 'God exists.', ['PSR: Everything has an explanation.', 'Theistic principle: If the PSR is true, then God exists.']);
    ok(nested.rule === 'modus ponens', 'a name inside a named claim is read too', J(nested));
    const loop = step(['The alpha principle is true.'], 'The beta principle is true.', ['Alpha principle: The beta principle is true.', 'Beta principle: The alpha principle is true.']);
    ok(typeof loop.tag === 'string', 'names that stand for each other: read no further than once round', J(loop));
    const two = step(['If the ex nihilo principle is true, then the universe has a cause.', 'Nothing comes from nothing.'], 'The universe has a cause.',
        [ENP, 'Ex nihilo principle: Something cannot come from nothing.']);
    ok(!two.rule && two.why === '“ex nihilo principle” names more than one claim on this map (“Nothing comes from nothing” and “Something cannot come from nothing”), so it is read as neither: give each its own name.',
        'a name given two claims is read as neither, and the check says so', J(two));
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
