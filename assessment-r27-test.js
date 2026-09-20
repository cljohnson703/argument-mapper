'use strict';
const fs = require('fs');
const assert = require('assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(process.argv[2] || 'argument-mapper-r27.html', 'utf8');
const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/assessment-test',
    virtualConsole: new VirtualConsole(),
    beforeParse(w) {
        w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
        w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        const ctx = new Proxy({}, { get: (_, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        w.HTMLCanvasElement.prototype.getContext = () => ctx;
        w.alert = () => {}; w.confirm = () => true; w.prompt = () => null;
    }
});
try {
    const result = dom.window.eval(`(() => {
        const n = (id, type, texts, children = []) => ({ id, type, texts, children, collapsed: [], x: 30000, y: 30000 });
        const objection = n('O', 'objection', ['Zombies are metaphysically possible.', 'If zombies are metaphysically possible, then consciousness is non-physical.']);
        const root = n('M', 'contention', ['Consciousness is not non-physical.'], [objection]);
        const read = () => {
            const steps = collectDeductiveSteps([root]);
            const verdict = claimMapVerdict([root], steps);
            const v = verdict(root.id, 0);
            return { status: v.status, label: VERDICT_LABEL[v.status], why: claimVerdictWhy(verdict, v), rules: steps.map(s => [s.childId, s.rule && s.rule.name]) };
        };
        const unchallenged = read();
        objection.children = [n('W', 'weak-rebuttal', ['It has not been shown that zombies are metaphysically possible.'])];
        const weaklyRebutted = read();
        // Two additional inference layers between the weak challenge and the objection.
        objection.children = [n('S', 'support', ['Poe is a raven.', 'If Poe is a raven, then zombies are metaphysically possible.'], [
            n('T', 'support', ['Poe is a bird.', 'If Poe is a bird, then Poe is a raven.'], [
                n('U', 'weak-rebuttal', ['It has not been shown that Poe is a bird.'])
            ])
        ])];
        const nested = read();
        objection.children[0].children[0].children = [];
        const restored = read();
        root.children = [];
        const bare = read();
        root.children = [n('A', 'support', [root.texts[0]])];
        const supported = read();
        root.children.push(objection);
        const conflict = read();
        objection.children = [n('W2', 'weak-rebuttal', ['It has not been shown that zombies are metaphysically possible.'])];
        const supportedWeakDefense = read();
        objection.children = [n('R2', 'rebuttal', ['Zombies are not metaphysically possible.'])];
        const supportedStrongDefense = read();
        const plainText = root.texts[0];
        root.texts[0] = "From 'Zombies are metaphysically possible' and 'If zombies are metaphysically possible, then consciousness is non-physical', we cannot conclude that consciousness is non-physical";
        root.children = [objection];
        objection.children = [n('W3', 'weak-rebuttal', ['It has not been shown that zombies are metaphysically possible.'])];
        const qualifiedWeakDefense = read();
        root.texts[0] = plainText;
        const note = n('N', 'note', ['A note']);
        root.crossRefs = [[{ targetId: 'N', targetIdx: 0 }, { targetId: 'O', targetIdx: 0 }]];
        state.trees = [root, note];
        selectedIds = []; render();
        let badge = document.querySelector('#group-M .crossref-badge');
        const mixed = badge.textContent;
        badge.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        const rows = [...document.querySelectorAll('.reference-premise')].map(e => e.textContent);
        note.type = 'support'; render();
        const retagged = document.querySelector('#group-M .crossref-badge').textContent;
        root.crossRefs = [[{ targetId: 'M', targetIdx: 0 }]]; render();
        const contentionRef = document.querySelector('#group-M .crossref-badge').textContent;
        return { unchallenged, weaklyRebutted, nested, restored, bare, supported, conflict, supportedWeakDefense, supportedStrongDefense, qualifiedWeakDefense, mixed, rows, retagged, contentionRef };
    })()`);
    assert.equal(result.unchallenged.label, '✗ Unwarranted');
    assert.equal(result.weaklyRebutted.label, '✗ Unwarranted');
    assert.equal(result.nested.label, '✗ Unwarranted');
    assert.equal(result.restored.label, '✗ Unwarranted');
    for (const name of ['unchallenged', 'weaklyRebutted', 'nested', 'restored']) {
        assert.equal(result[name].rules.find(([id]) => id === 'O')[1], 'modus ponens', name);
    }
    assert.equal(result.bare.label, '✗ Unwarranted');
    assert.equal(result.supported.label, '✓ Warranted');
    assert.equal(result.conflict.label, '✗ Unwarranted');
    assert.equal(result.unchallenged.status, 'refuted');
    assert.equal(result.bare.status, 'asserted');
    assert.equal(result.supportedWeakDefense.label, '✗ Unwarranted');
    assert.match(result.supportedWeakDefense.why, /challenge remains unsettled/);
    assert.equal(result.supportedStrongDefense.label, '✓ Warranted');
    assert.equal(result.qualifiedWeakDefense.label, '✓ Warranted');
    assert.equal(result.qualifiedWeakDefense.rules.find(([id]) => id === 'O')[1], 'modus ponens');
    assert.match(result.conflict.why, /conflicting arguments/);
    assert.match(result.weaklyRebutted.why, /no surviving support for the contention/);
    assert.equal(result.mixed, '↗ Note · Premise');
    assert.equal(result.rows[0], 'Note · A note');
    assert.match(result.rows[1], /^↗ Zombies/);
    assert.equal(result.retagged, '↗ 2 premises');
    assert.equal(result.contentionRef, '↗ Contention');
    console.log('PASS: assessments, nested weak rebuttals, invariant modus ponens, and typed cross-references.');
    // Optional real-map diagnostic; the input file is read without modification.
    if (process.argv[3]) {
        const map = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
        dom.window.__assessmentInput = map.trees;
        const report = dom.window.eval(`(() => {
            const trees = window.__assessmentInput;
            const steps = collectDeductiveSteps(trees);
            const verdict = claimMapVerdict(trees, steps);
            const roots = trees.filter(n => n.type === 'contention').map(n => {
                const v = verdict(n.id, 0);
                return { text: n.texts[0], label: VERDICT_LABEL[v.status], why: claimVerdictWhy(verdict, v) };
            });
            const main = trees.find(n => n.type === 'contention');
            const original = main && main.texts[0];
            const variants = main ? ['Consciousness is not non-physical.', 'It is epistemically possible that consciousness is not non-physical.'].map(text => {
                main.texts[0] = text;
                const ss = collectDeductiveSteps(trees), vv = claimMapVerdict(trees, ss);
                const value = vv(main.id, 0);
                return { text, assessment: VERDICT_LABEL[value.status], why: claimVerdictWhy(vv, value),
                    topRule: ss.find(s => s.parentId === main.id)?.rule?.name || null };
            }) : [];
            if (main) main.texts[0] = original;
            return { roots, variants, steps: steps.map(s => ({ id: s.childId, premises: s.premiseTexts,
                target: s.conclusionText, kind: s.kind, rule: s.rule && s.rule.name,
                premiseStatuses: s.premiseTexts.map((_, j) => verdict(s.childId, j).status) })) };
        })()`);
        console.log(JSON.stringify(report, null, 2));
    }
} finally { dom.window.close(); }
