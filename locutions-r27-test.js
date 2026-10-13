'use strict';
/**
 * What students write (the user, 2026-10-12: "My students seem to be able to
 * come up with all kinds of locutions that don't produce validities when they
 * intuitively should. Add/delete/edit anything that will improve the app." --
 * and "I want to be sure not to accommodate things that seem valid when they
 * actually aren't"). Each is a reading (r27.96); each comes with the fallacies
 * it must not let through. Then the user's answers (2026-10-13): no lone
 * supposition, "must" held back for the modal extensions, "clearly" flagged,
 * the people shortcut said in a note, "biconditional to conditional" a
 * familiar step, and "it rains" told apart from "it is raining".
 *
 *   node locutions-r27-test.js [argument-mapper-r27.html]
 *
 * 1. Words the reader had misread: "free will" (no clause cut short), a name
 *    in -s ("Socrates loves wisdom"), the past "read", "even or odd", a
 *    condition word that is no name ("Assuming Socrates ...").
 * 2. Variables: "for any x, if x is a man, then x is mortal"; "for some x";
 *    "if x is a man, then x is mortal" with no "for any x" -- asked.
 * 3. People: "anyone who is a man", "if someone is a man, then he is mortal",
 *    "... then that person is mortal" -- every man, and the note says so;
 *    "anyone who is wise" is still a person who is wise.
 * 4. "Must" is read as written: reading it as what follows is a modal step,
 *    which waits for the modal extensions. "Should" as before.
 * 5. Said around a claim: "it is a fact that", "the fact is that", a box's
 *    label ("P1:", "C:", "1."). A supposition on its own is flagged; "assume
 *    that P, then Q" is a conditional, as "suppose P, then Q" is. "Clearly",
 *    "obviously", "of course" are flagged as "therefore" is.
 * 6. Necessary and sufficient conditions between gerunds: "being a man is
 *    sufficient for being mortal", "having free will is necessary for being
 *    responsible", "being responsible requires having free will".
 * 7. "The same as", "identical to", "one and the same as" (its "and" joins
 *    nothing); "not not"; "which means ..." flagged as "this means that ..."
 *    is.
 * 8. "Biconditional to conditional": "A if and only if B" gives "if A, then
 *    B" in one step, a familiar step that can be switched off.
 * 9. "It rains" and "it is raining": a step that would follow but for them
 *    says so; it never follows.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/locutions-test', virtualConsole: vc,
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
// A box as the check reads it: its form shown, its kind, what it asks.
const read = t => ev(`var r = parseClaimFull(${J(t)});
    return { said: claimShowForm(r.form).split(String.fromCharCode(57344)).join(''), kind: r.form && r.form.kind,
        asked: r.notes.filter(function (n) { return n.kind === 'ambiguous'; }).map(function (n) { return n.message; }),
        notes: r.notes.map(function (n) { return n.kind + ': ' + n.message; }) };`);
// A step's tag, and, where it is asked about, the chooser's rows: [ok] for
// a reading the box can be rewritten to in one click.
const step = (premises, conclusion) => ev(`
    state.trees = [{ id: 'M', type: 'contention', texts: [${J(conclusion)}], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ${J(premises)}, collapsed: [], children: [] } ] }];
    deductiveCache.clear(); ensureCollabFields(state); render();
    var s = collectDeductiveSteps(state.trees)[0], rows = [];
    if (s.ambiguous) { openReadingChooser(s, document.body);
        rows = Array.prototype.map.call(document.querySelectorAll('#reading-chooser .rc-row'), function (r) {
            return (/rc-unfit/.test(r.className) ? '[unfit] ' : '[ok] ') + r.textContent; });
        closeReadingChooser(); }
    return { tag: deductiveStepTagText(s), rows: rows, rule: s.rule ? s.rule.name : null };`);
const certifies = (premises, conclusion, rule) => { const s = step(premises, conclusion); return s.tag === '✓ ' + rule; };
// Not certified, and no reading of it is offered as following.
const refused = (premises, conclusion) => { const s = step(premises, conclusion); return !s.rule && !s.rows.some(r => /the step follows by/.test(r)); };

console.log('\n-- 1. words the reader had misread --');
{
    ok(read('We have free will.').said === 'we have free will' && read('We have free will.').kind === 'pred', '"free will" is a noun: no clause cut short', J(read('We have free will.')));
    ok(certifies(['If we have free will, then we are responsible.', 'We have free will.'], 'We are responsible.', 'modus ponens'), 'so modus ponens on it');
    ok(refused(['If we have free will, then we are responsible.', 'We do not have free will.'], 'We are not responsible.'), 'denying the antecedent is no step');
    ok(certifies(['Socrates loves wisdom.', 'If Socrates loves wisdom, then Socrates is a philosopher.'], 'Socrates is a philosopher.', 'modus ponens'),
        'a name in -s before a verb in -s: "Socrates loves wisdom"');
    ok(refused(['All philosophers love wisdom.', 'Socrates loves wisdom.'], 'Socrates is a philosopher.'), 'and from "all philosophers love wisdom", no converse');
    ok(certifies(['Every student read the book.', 'Ann is a student.'], 'Ann read the book.', 'universal modus ponens'), '"every student read the book": "read" is the past');
    ok(refused(['Every student read the book.', 'Ann read the book.'], 'Ann is a student.'), 'and no converse');
    ok(certifies(['Every integer is even or odd.', 'Seven is an integer.'], 'Seven is even or odd.', 'universal modus ponens') &&
        certifies(['Every number is odd or even.', 'Seven is a number.'], 'Seven is odd or even.', 'universal modus ponens'), '"even or odd": "even" stands as a predicate');
    ok(refused(['Every integer is even or odd.', 'Seven is an integer.'], 'Seven is odd.') && refused(['Every integer is even or odd.'], 'Every integer is even.'),
        'and gives neither alternative alone');
    ok(read('Assuming Socrates is a man, he is mortal.').kind === 'if', '"Assuming" opens a condition', J(read('Assuming Socrates is a man, he is mortal.')));
    ok(certifies(['Assuming Socrates is a man, he is mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'modus ponens') &&
        certifies(['Provided Socrates is a man, he is mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'modus ponens'),
        'and is no part of a name: "he" is Socrates, not "Assuming Socrates"');
}

console.log('\n-- 2. variables --');
{
    ok(certifies(['For any x, if x is a man, then x is mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens'), '"for any x, if x is a man, then x is mortal"');
    ok(read('For some x, x is wise.').said === 'something is wise' && read('There is an x such that x is wise.').said === 'something is wise' &&
        read('For all x, x is mortal.').said === 'everything is mortal', '"for some x", "there is an x such that", "for all x"');
    ok(refused(['For any x, if x is a man, then x is mortal.', 'Socrates is mortal.'], 'Socrates is a man.'), 'affirming the consequent is no step');
    const bare = step(['If x is a man, then x is mortal.', 'Socrates is a man.'], 'Socrates is mortal.');
    ok(bare.tag === '? ambiguous' && /^\[ok\] For any x, if x is a man, then x is mortal\. — the step follows by universal modus ponens/.test(bare.rows[0]) &&
        /^\[unfit\] "x" names one thing/.test(bare.rows[1] || ''), 'with no "for any x": asked, "for any x" one click away', J(bare));
    ok(refused(['If x is a man, then x is mortal.', 'Socrates is mortal.'], 'Socrates is a man.') && refused(['x is a man.'], 'Socrates is a man.') &&
        refused(['If x is a man, then x is mortal.'], 'Socrates is mortal.'), 'and no fallacy on any reading');
    ok(read('If x is a man, then x is mortal.').kind === 'if', 'read as written until a step turns on it');
}

console.log('\n-- 3. people --');
{
    ok(certifies(['Anyone who is a man is mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens') &&
        certifies(['Whoever is a man is mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens'),
        '"anyone who is a man", "whoever is a man": every man -- a man is a person');
    ok(read('Everyone who is wise is happy.').said !== read('Everything that is wise is happy.').said &&
        refused(['Everyone who is wise is happy.', 'The cat is wise.'], 'The cat is happy.'), '"everyone who is wise" is still a person who is wise');
    ok(refused(['Anyone who is a man is mortal.', 'Fido is a dog.'], 'Fido is mortal.'), 'and Fido is not given as a man');
    ok(certifies(['Anyone who is a philosopher loves wisdom.', 'Socrates is a philosopher.'], 'Socrates loves wisdom.', 'universal modus ponens'),
        'so "anyone who is a philosopher"');
    ok(read('Anyone who is a man is mortal.').notes.includes('unread: "anyone who is a man" is read as every man: a man is a person') &&
        read('Whoever is a philosopher loves wisdom.').notes.includes('unread: "whoever is a philosopher" is read as every philosopher: a philosopher is a person') &&
        read('All who are philosophers love wisdom.').notes.includes('unread: "all who are philosophers" is read as every philosopher: a philosopher is a person'),
        'and says so, in a note (the user, 2026-10-13)', J(read('Anyone who is a man is mortal.').notes));
    ok(!read('Everyone who is wise is happy.').notes.some(n => /is a person/.test(n)), 'no note where "person" is kept');
    ok(refused(['Anyone who is a mother is caring.', 'Tabby is a mother.'], 'Tabby is caring.') &&
        refused(['Anyone who is a king is powerful.', 'The white king is a king.'], 'The white king is powerful.') &&
        refused(['Anyone who is a patient is sick.', 'Fido is a patient.'], 'Fido is sick.') &&
        refused(['Everyone who is a friend is loyal.', 'Fido is a friend.'], 'Fido is loyal.'),
        'not nouns that may name an animal or a thing: "a mother" (a cat), "a king" (in chess), "a patient" (at a vet), "a friend"');
    const he = read('If someone is a man, then he is mortal.');
    ok(he.kind === 'all' && he.said === read('Everyone who is a man is mortal.').said && he.notes.some(n => /"he" is read as the "someone" in the condition/.test(n)),
        '"if someone is a man, then he is mortal": what "everyone who is a man is mortal" says, and says so', J(he));
    ok(certifies(['If someone is a man, then he is mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens') &&
        certifies(['If anyone is a man, then that person is mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens') &&
        certifies(['If somebody is a man, then they are mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens') &&
        certifies(['If someone is a man, then that person is mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens'),
        '"he", "that person", "they": the someone again');
    ok(refused(['If someone is a man, then he is mortal.', 'Socrates is mortal.'], 'Socrates is a man.') &&
        refused(['If someone is a man, then he is mortal.', 'Socrates is not a man.'], 'Socrates is not mortal.') &&
        refused(['If someone is a man, then he is mortal.'], 'Someone is mortal.') && refused(['If someone is a man, then he is mortal.'], 'Everyone is mortal.') &&
        refused(['If someone is wise, then he is happy.', 'The cat is wise.'], 'The cat is happy.'),
        'no fallacy: no converse, no inverse, no existential import, and "someone who is wise" a person');
}

console.log('\n-- 4. "must" read as written --');
{
    // Reading "must" as what follows is axiom T for a modality: a modal step,
    // for the modal extensions (the user, 2026-10-13).
    ['Socrates must be mortal.', 'If Socrates is a man, then Socrates must be mortal.', 'It must be the case that Socrates is mortal.', 'All men must be mortal.']
        .forEach(t => ok(!read(t).asked.some(m => /"must"/.test(m)), '"must" asks nothing: ' + t, J(read(t))));
    ok(refused(['If Socrates is a man, then Socrates must be mortal.', 'Socrates is a man.'], 'Socrates is mortal.') &&
        refused(['All men are mortal.', 'Socrates is a man.'], 'Socrates must be mortal.') &&
        refused(['Socrates must be mortal.', 'If Socrates is mortal, then Socrates is not a god.'], 'Socrates is not a god.'),
        'so no step through it gives the plain claim, or "must" from it');
    ok(certifies(['If Socrates is a man, then Socrates must be mortal.', 'Socrates is a man.'], 'Socrates must be mortal.', 'modus ponens'),
        'a step in its own words still follows');
    ok(refused(['Socrates is mortal.'], 'Socrates must be mortal.') && refused(['Socrates must be mortal.'], 'Socrates is necessarily mortal.') &&
        refused(['If you are a citizen, you must vote.', 'You are a citizen.'], 'You vote.'), 'and nothing modal: not "what is, must be", nor a duty done');
    const sh = step(['If Socrates is a man, then Socrates should be mortal.', 'Socrates is a man.'], 'Socrates is mortal.');
    ok(!sh.rule && !sh.rows.some(r => /^\[ok\]/.test(r)), '"should" as before: "it should be here by now" does not say that it is', J(sh));
}

console.log('\n-- 5. said around a claim --');
{
    ok(certifies(['It is a fact that all men are mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens') &&
        certifies(['The fact is that all men are mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens') &&
        certifies(['The truth is that all men are mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens'),
        '"it is a fact that P", "the fact is that P", "the truth is that P": P');
    ok(refused(['Mary thinks that it is a fact that God exists.'], 'God exists.') && refused(['It is a fact that some men are mortal.'], 'All men are mortal.') &&
        refused(['It is a fact that God exists.'], 'Evil exists.'), 'but not what someone thinks is a fact');
    // No lone supposition (the user, 2026-10-13: "We can't have lone
    // supposition nodes (we require conditionals to be made of them typically)").
    const lone = step(['Suppose that God exists.', 'If God exists, then evil does not exist.'], 'Evil does not exist.');
    ok(lone.tag === '✗ “suppose that” in a box', 'a supposition on its own is flagged', J(lone));
    ok(ev(`return claimInferenceFlag('Suppose that God exists.').message;`) ===
        'In “Suppose that God exists.”, “suppose that” sets out a supposition, not a claim. Say what it leads to in the same box: “If God exists, then …”.',
        'and the check says what to write instead');
    ok(step(['Assume God exists.'], 'God exists.').tag === '✗ “assume” in a box' &&
        step(['Let us suppose, for the sake of argument, that God exists.'], 'God exists.').tag === '✗ “let us suppose, for the sake of argument, that” in a box' &&
        step(['God exists.'], 'Suppose that God exists.').tag === '✗ “suppose that” in a box', '"assume", "let us suppose ...", as premise or conclusion');
    ok(certifies(['Suppose that God exists, then evil does not exist.', 'God exists.'], 'Evil does not exist.', 'modus ponens') &&
        certifies(['Assume that God exists, then evil does not exist.', 'God exists.'], 'Evil does not exist.', 'modus ponens') &&
        certifies(['Let us suppose that God exists; then evil does not exist.', 'God exists.'], 'Evil does not exist.', 'modus ponens'),
        'with what it leads to, a conditional: "suppose that P, then Q", "assume that P, then Q", "let us suppose that P; then Q"');
    ok(['We suppose that God exists.', 'It is supposed that God exists.', 'Mary supposes that God exists.', 'We assume that God exists.']
        .every(t => read(t).kind === 'pred' && read(t).said !== 'god exists' && !ev(`return claimInferenceFlag(${J(t)});`)) &&
        refused(['We suppose that God exists.'], 'God exists.') && refused(['Mary supposes that God exists.'], 'God exists.'),
        'a report of supposing is a claim, not flagged, and not the claim supposed');
    // "Clearly", "obviously", "of course": flagged as "therefore" is (the user's choice, 2026-10-13).
    const clear = step(['All men are mortal.', 'Socrates is a man.'], 'Clearly, Socrates is mortal.');
    ok(clear.tag === '✗ “clearly” in a box' && ev(`return claimInferenceFlag('Clearly, Socrates is mortal.').message;`) ===
        'In “Clearly, Socrates is mortal.”, “clearly” says how sure the writer is: the check cannot use it, and in a premise it makes the claim sound established. Leave it out.',
        '"clearly" says how sure the writer is: leave it out', J(clear));
    ok(step(['All men are mortal.', 'Obviously Socrates is a man.'], 'Socrates is mortal.').tag === '✗ “obviously” in a box' &&
        step(['All men are mortal.', 'Socrates is obviously a man.'], 'Socrates is mortal.').tag === '✗ “obviously” in a box' &&
        step(['All men are mortal.', 'Socrates is, of course, a man.'], 'Socrates is mortal.').tag === '✗ “of course” in a box' &&
        step(['All men are mortal.', 'Socrates is clearly a man.'], 'Socrates is mortal.').tag === '✗ “clearly” in a box' &&
        step(['All men are mortal.', 'Socrates is a man.'], 'It is clear that Socrates is mortal.').tag === '✗ “it is clear that” in a box',
        'at the start, set off by commas, or said of the claim ("is obviously", "is clearly a man"), and "it is clear that"');
    ok(['Mary speaks clearly.', 'The road is clearly marked.', 'Clearly written rules are useful.', 'Mary thinks that Bob is obviously wrong.',
        'It happens as a matter of course.', 'The sign is clearly visible.'].every(t => ev(`return claimInferenceFlag(${J(t)});`) === null),
        'not "clearly" of manner, nor inside what someone thinks, nor "a matter of course"');
    ok(!ev(`return claimInferenceFlag('We know that God exists.');`), '"we know that" is not flagged: a knowledge claim, for an epistemic extension');
    ok(refused(['We know that all men are mortal.', 'Socrates is a man.'], 'Socrates is mortal.'), 'and it gives no step yet');
    ok(certifies(['P1: All men are mortal.', 'P2: Socrates is a man.'], 'C: Socrates is mortal.', 'universal modus ponens') &&
        read('Conclusion: Socrates is mortal.').said === 'socrates is mortal' && read('1. All men are mortal.').said === 'all men are mortal' &&
        read('Premise 2: Socrates is a man.').said === 'socrates is a man', 'a box\'s label goes: "P1:", "C:", "Conclusion:", "1.", "Premise 2:"');
    ok(refused(['P1: All men are mortal.', 'P2: Fido is a dog.'], 'C: Fido is mortal.'), 'and the labels prove nothing');
}

console.log('\n-- 6. necessary and sufficient conditions --');
{
    ok(read('Being a man is sufficient for being mortal.').said === read('Everything that is a man is mortal.').said &&
        read('Being a man is necessary for being mortal.').said === read('Everything that is mortal is a man.').said,
        '"sufficient for": everything that is the one is the other; "necessary for": the other way', J([read('Being a man is sufficient for being mortal.'), read('Being a man is necessary for being mortal.')]));
    ok(certifies(['Being a man is sufficient for being mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens') &&
        certifies(['Being a man is a sufficient condition for being mortal.', 'Socrates is a man.'], 'Socrates is mortal.', 'universal modus ponens') &&
        certifies(['Having free will is necessary for being responsible.', 'We are responsible.'], 'We have free will.', 'universal modus ponens') &&
        certifies(['Having free will is a necessary condition for being responsible.', 'We are responsible.'], 'We have free will.', 'universal modus ponens') &&
        certifies(['Being responsible requires having free will.', 'We are responsible.'], 'We have free will.', 'universal modus ponens'),
        'steps on them: "sufficient condition", "necessary condition", "requires"');
    ok(read('Being a man is necessary and sufficient for being an adult male.').kind === 'and', '"necessary and sufficient": both ways');
    ok(refused(['Being a man is necessary for being mortal.', 'Socrates is a man.'], 'Socrates is mortal.') &&
        refused(['Being a man is sufficient for being mortal.', 'Socrates is mortal.'], 'Socrates is a man.') &&
        refused(['Having free will is necessary for being responsible.', 'We have free will.'], 'We are responsible.') &&
        refused(['Being responsible requires having free will.', 'We have free will.'], 'We are responsible.') &&
        refused(['Being a man is sufficient for being mortal.'], 'Being mortal is sufficient for being a man.') &&
        refused(['Being a man is necessary for being mortal.'], 'Being a man is sufficient for being mortal.') &&
        refused(['Being a man is sufficient for being mortal.', 'Socrates is not a man.'], 'Socrates is not mortal.'),
        'no fallacy: a necessary condition is not a sufficient one, nor the converse');
    ok(refused(['Oxygen is necessary for fire.', 'There is oxygen.'], 'There is fire.') && refused(['Oxygen is necessary for fire.', 'There is fire.'], 'There is oxygen.'),
        'nouns that name no claim ("oxygen", "fire") are not read so');
}

console.log('\n-- 7. identity, "not not", "which means" --');
{
    ok(read('Hesperus is the same as Phosphorus.').kind === 'identity' && read('Hesperus is identical to Phosphorus.').kind === 'identity' &&
        read('Hesperus is one and the same planet as Phosphorus.').kind === 'identity', '"the same as", "identical to", "one and the same planet as"');
    ok(certifies(['Hesperus is the same as Phosphorus.', 'Hesperus is bright.'], 'Phosphorus is bright.', 'identity substitution'), 'substitution on it');
    ok(read('Hesperus is one and the same as Phosphorus.').kind === 'identity' && read('Mark Twain is one and the same as Samuel Clemens.').kind === 'identity' &&
        certifies(['Hesperus is one and the same as Phosphorus.', 'Hesperus is bright.'], 'Phosphorus is bright.', 'identity substitution'),
        '"one and the same as": its "and" joins nothing');
    ok(read('Mark Twain is identical with Samuel Clemens.').kind === 'identity' &&
        certifies(['Mark Twain is identical with Samuel Clemens.', 'Mark Twain wrote Huckleberry Finn.'], 'Samuel Clemens wrote Huckleberry Finn.', 'identity substitution'),
        'names of two words: "identical with"');
    ok(['He is the same as Socrates.', 'He is the same person as Samuel Clemens.', 'Someone is the same person as Samuel Clemens.', 'Samuel Clemens is identical with something.']
        .every(t => read(t).kind === 'atom' && read(t).asked.some(m => /an identity needs a name on each side/.test(m))),
        'a pronoun, or "someone", is no name, beside a name of one word or two: asked');
    ok(refused(['Hesperus is the same as Phosphorus.'], 'Phosphorus is a planet.') &&
        refused(['Hesperus is the same as Phosphorus.', 'Hesperus is visible in the evening.'], 'Phosphorus is visible in the morning.'), 'and nothing else');
    ok(certifies(['Poe is not not black.'], 'Poe is black.', 'double-negation elimination'), '"Poe is not not black": two denials');
    ok(refused(['Poe is not not black.'], 'Poe is not black.') && refused(['Poe is not black.'], 'Poe is not not black.'), 'not one');
    const w = step(['All men are mortal.', 'Socrates is a man.'], 'Which means Socrates is mortal.');
    ok(w.tag === '✗ “which means” in a box', '"which means" without "that" is an inference word too', J(w));
    ok(ev(`return claimInferenceFlag('This means war.', null);`) === null && ev(`return claimInferenceFlag('This shows courage.', null);`) === null,
        'no flag where no claim follows: "this means war", "this shows courage"');
    ok(ev(`var f = claimInferenceFlag('This shows Socrates is mortal.', null); return f && f.word;`) === 'this shows', '"this shows Socrates is mortal" flagged');
}

console.log('\n-- 8. biconditional to conditional --');
{
    // One step, not material equivalence and then conjunction elimination (the
    // user, 2026-10-13): a familiar step, on, that a map can switch off.
    ok(certifies(['Poe is a raven if and only if Poe is black.'], 'If Poe is a raven, then Poe is black.', 'biconditional to conditional') &&
        certifies(['Poe is a raven if and only if Poe is black.'], 'If Poe is black, then Poe is a raven.', 'biconditional to conditional') &&
        certifies(['A ↔ B'], 'A → B', 'biconditional to conditional') && certifies(['A ↔ B'], 'B → A', 'biconditional to conditional'),
        '"A if and only if B" gives "if A, then B" and "if B, then A", in words or symbols');
    ok(ev(`return DEDUCTIVE_EXTENSIONS.find(function (g) { return g.id === 'familiar'; }).rules.indexOf('biconditional-to-conditional') >= 0;`),
        'listed with the familiar steps in the Logic panel');
    const off = (() => {
        W.eval(`state.logic = Object.assign({}, state.logic || {}, { rules: { 'biconditional-to-conditional': false } }); deductiveCache.clear();`);
        try { return step(['Poe is a raven if and only if Poe is black.'], 'If Poe is a raven, then Poe is black.'); }
        finally { W.eval(`state.logic = Object.assign({}, state.logic, { rules: {} }); deductiveCache.clear();`); }
    })();
    ok(!off.rule, 'switched off, it is two steps again', J(off));
    ok(refused(['Poe is a raven if and only if Poe is black.'], 'If Poe is not a raven, then Poe is black.') &&
        refused(['If Poe is a raven, then Poe is black.'], 'Poe is a raven if and only if Poe is black.') &&
        refused(['A ↔ B'], 'A ∧ B'), 'and nothing else: not a conditional it does not hold, nor the converse');
    ok(certifies(['Poe is a raven if and only if Poe is black.', 'Poe is a raven.'], 'Poe is black.', 'biconditional elimination'), 'with A, it gives B, as before');
}

console.log('\n-- 9. "it rains" and "it is raining" --');
{
    const why = (premises, conclusion) => ev(`
        state.trees = [{ id: 'M', type: 'contention', texts: [${J(conclusion)}], collapsed: [], x: 0, y: 0, children: [
            { id: 'A', type: 'support', texts: ${J(premises)}, collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); render();
        var s = collectDeductiveSteps(state.trees)[0];
        return { tag: deductiveStepTagText(s), why: s.why && s.why.text, rule: s.rule ? s.rule.name : null };`);
    const mp = why(['If it rains, then the ground is wet.', 'It is raining.'], 'The ground is wet.');
    ok(!mp.rule && mp.why === 'Worded the same way each time, this would follow by modus ponens, but ‘it is raining’ and ‘it rains’ differ: “is raining” in one where the other has “rains”.',
        'a step that would follow but for them says so -- and does not follow', J(mp));
    const mt = why(['If it rains, then the ground is wet.', 'The ground is not wet.'], 'It is not raining.');
    ok(!mt.rule && /follow by modus tollens, but ‘it is raining’ and ‘it rains’ differ/.test(mt.why || ''), 'so a denial: modus tollens', J(mt));
    const ds = why(['Either Poe flies or Mary sings.', 'Poe is not flying.'], 'Mary sings.');
    ok(!ds.rule && /follow by disjunctive syllogism, but ‘poe is flying’ and ‘poe flies’ differ: “is flying” in one where the other has “flies”/.test(ds.why || ''),
        'disjunctive syllogism', J(ds));
    ok(refused(['Poe flies.'], 'Poe is flying.') && refused(['Poe is flying.'], 'Poe flies.'), 'neither gives the other');
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
