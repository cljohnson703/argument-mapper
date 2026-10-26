'use strict';
/**
 * A phrase that points back: "that road", "this very road", "those ravens",
 * "the same road" -- read as the phrase it points back to in its box, as a
 * pronoun is read as its referent (the user, 2026-10-06: "I also need to be
 * able to handle that-clauses that are anaphors, e.g., 'the long, dark, windy
 * X...., and that (very) X...'"). And adjectives before one noun, parted by
 * commas or joined by "and", one noun phrase.
 *
 *   node anaphora-r27-test.js [argument-mapper-r27.html]
 *
 * 1. The user's example: "that road" and "that very road" are "the long,
 *    dark, windy road", in a conjunction, a conditional, an object; "this",
 *    "the same", a plural, a modifier the phrase has.
 * 2. Two it may be: asked, with the reading that makes the step follow.
 * 3. As written: nothing before it in an earlier clause, its own clause,
 *    a "that" that opens a clause, "the same ... as", a kind, a modifier the
 *    phrase lacks, and a plain "the road".
 * 4. After "a road": joined, as "a teacher left and she cried" is.
 * 5. Adjectives before one noun: commas between them set nothing off; "and"
 *    between them joins no two subjects; an "it" is offered the whole phrase.
 */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
const dom = new JSDOM(fs.readFileSync(process.argv[2] || __dirname + '/argument-mapper-r27.html', 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/anaphora-test', virtualConsole: vc,
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
// A box as the check reads it: its claim's words, its kind, its notes.
const read = t => ev(`var r = parseClaimFull(${J(t)});
    return { said: claimShowForm(r.form), kind: r.form && r.form.kind, term: r.form && r.form.term || null,
        notes: r.notes.map(function (n) { return n.kind + ': ' + n.message; }) };`);
// A step's tag, and, where it is asked about, the chooser's rows.
const step = (premises, conclusion) => ev(`
    state.trees = [{ id: 'M', type: 'contention', texts: [${J(conclusion)}], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ${J(premises)}, collapsed: [], children: [] } ] }];
    deductiveCache.clear(); ensureCollabFields(state); render();
    var s = collectDeductiveSteps(state.trees)[0], rows = [];
    if (s.ambiguous) { openReadingChooser(s, document.body);
        rows = Array.prototype.map.call(document.querySelectorAll('#reading-chooser .rc-row'), function (r) { return (r.title ? r.title + Array.prototype.map.call(r.querySelectorAll('.rc-follows, .rc-own'), function (x) { return x.textContent; }).join('') : r.textContent); });
        closeReadingChooser(); }
    return { tag: deductiveStepTagText(s), rows: rows };`);
const LONG = 'The long, dark, windy road leads to the castle';

console.log('\n-- 1. the user\'s example --');
{
    const that = read(LONG + ', and that road is dangerous.');
    ok(that.said === 'the long, dark, windy road leads to the castle, and the long, dark, windy road is dangerous' &&
        that.notes.some(n => n === 'unread: read with “that road” as “the long, dark, windy road”, the one it can be in this box'),
        '"that road" is read as "the long, dark, windy road", and the box says so', J(that));
    ok(step([LONG + ', and that road is dangerous.'], 'The long, dark, windy road is dangerous.').tag === '✓ conjunction elimination' &&
        step([LONG + ', and that very road is dangerous.'], 'The long, dark, windy road is dangerous.').tag === '✓ conjunction elimination',
        'so "the long, dark, windy road is dangerous" follows, from "that road" and from "that very road": conjunction elimination');
    ok(step([LONG + ', and that road is dangerous.'], LONG + '.').tag === '✓ conjunction elimination',
        'and the other conjunct still follows as written');
    ok(step(['If the long, dark, windy road leads to the castle, then that road is dangerous.', LONG + '.'], 'The long, dark, windy road is dangerous.').tag === '✓ modus ponens',
        'in a conditional: "if ..., then that road is dangerous" gives modus ponens');
    ok(step(['Bob walked down the long, dark, windy road, and Mary feared that road.'], 'Mary feared the long, dark, windy road.').tag === '✓ conjunction elimination',
        'as an object: "Mary feared that road"');
    ok(step(['The long road leads to the castle, and this road is dangerous.'], 'The long road is dangerous.').tag === '✓ conjunction elimination' &&
        step(['The long road leads to the castle, and that same road is dangerous.'], 'The long road is dangerous.').tag === '✓ conjunction elimination' &&
        step(['The long road leads to the castle, and the same road leads to the village.'], 'The long road leads to the village.').tag === '✓ conjunction elimination',
        '"this road", "that same road" and "the same road" too');
    ok(step(['The black ravens are noisy, and those ravens fly.'], 'The black ravens fly.').tag === '✓ conjunction elimination',
        'a plural: "those ravens" are "the black ravens"');
    ok(step([LONG + ', and that dark road is dangerous.'], 'The long, dark, windy road is dangerous.').tag === '✓ conjunction elimination',
        'with a word the phrase has: "that dark road"');
    ok(step(['The teacher is tired, and that teacher cried.'], 'The teacher cried.').tag === '✓ conjunction elimination',
        'someone: "that teacher" is "the teacher"');
    ok(step(['The long road is long. That road is dangerous.'], 'The long road is dangerous.').tag === '✓ conjunction elimination',
        'in a second sentence of the box: "The long road is long. That road is dangerous."');
    const twice = read('The long road is wide, the long road leads to the castle, and that road is dangerous.');
    ok(twice.notes.some(n => n === 'unread: read with “that road” as “the long road”, the one it can be in this box'),
        'a phrase named twice is one thing: nothing asked', J(twice));
}

console.log('\n-- 2. two it may be: asked --');
{
    const two = step(['The long road and the short road meet, and that road is dangerous.'], 'The long road is dangerous.');
    ok(two.tag === '? ambiguous' && two.rows.length === 2 &&
        /^The long road and the short road meet, and the long road is dangerous\. — the step follows by conjunction elimination/.test(two.rows[0]) &&
        /^The long road and the short road meet, and the short road is dangerous\./.test(two.rows[1]),
        '"that road" after "the long road and the short road": asked, each offered, and the one that makes the step follow says so', J(two));
    const notes = read('The long road and the short road meet, and that road is dangerous.').notes;
    ok(notes.some(n => n === 'ambiguous: “that road” may be “the long road” or “the short road”'), 'the question names both', J(notes));
}

console.log('\n-- 3. as written --');
{
    const alone = read('That road is dangerous.');
    ok(alone.term === 'that road' && !alone.notes.length, 'nothing before it: "that road" is read as written, and nothing is said', J(alone));
    const own = read('The long road crosses that road.');
    ok(/that road$/.test(own.said) && !own.notes.some(n => /that road/.test(n)), 'in its own clause it is another road: as written', J(own));
    const know = read(LONG + ', and we know that road is dangerous.');
    ok(/we know that road is dangerous$/.test(know.said) && !know.notes.some(n => /that road/.test(n)),
        'after "know", "that" opens what is known: as written', J(know));
    const as = read('The long road leads to the castle, and Bob took the same road as Mary.');
    ok(/the same road as Mary$/i.test(as.said) && !as.notes.some(n => /same road/.test(n)), '"the same road as Mary": as written', J(as));
    const kind = read('Ravens are black, and those ravens fly.');
    ok(/those ravens fly$/.test(kind.said) && !kind.notes.some(n => /those ravens/.test(n)), 'after "ravens", said of a kind: as written', J(kind));
    ok(step([LONG + ', and that short road is dangerous.'], 'The long, dark, windy road is dangerous.').tag === '? not recognized',
        'with a word the phrase lacks ("that short road"): another road');
    ok(step(['The long road leads to the castle, and the road is dangerous.'], 'The long road is dangerous.').tag === '? not recognized',
        'a plain "the road" is its own phrase, as before: a box\'s "the road" may stand alone');
}

console.log('\n-- 4. after "a road" --');
{
    const a = read('A road leads to the castle, and that road is dangerous.');
    ok(a.notes.some(n => n === 'unread: read with “that road” as “the road”, the one it can be in this box: “A road leads to the castle and is dangerous.”'),
        '"a road ..., and that road ...": one road, joined, as "a teacher left and she cried" is', J(a));
}

console.log('\n-- 5. adjectives before one noun --');
{
    const commas = read('The long, dark, windy road is dangerous.');
    ok(commas.kind === 'pred' && commas.term === 'the long, dark, windy road' && !commas.notes.length,
        'commas between adjectives set nothing off: "the long, dark, windy road" is the subject (it had been read as one claim)', J(commas));
    // A phrase set off by commas still is set off, and since r27.139 it says
    // what Bob is, a claim of its own (it had been read as one claim).
    const bob = read('Bob, the teacher, is tired.');
    ok(bob.kind === 'and' && /^bob is the teacher, and Bob is tired$/i.test(bob.said) && !bob.notes.length, 'a phrase set off by commas still is: "Bob, the teacher," -- what Bob is, a claim of its own', J(bob));
    const dog = read('The dog, a terrier, barked.');
    ok(dog.kind === 'and' && /^the dog is a terrier, and the dog barked$/i.test(dog.said), 'and "the dog, a terrier,"', J(dog));
    const winding = read('The long and winding road leads to your door.');
    ok(winding.kind === 'pred' && winding.term === 'the long and winding road' && !winding.notes.length,
        '"the long and winding road" is one road: nothing asked of each, or of them together', J(winding));
    const dark = read('The long, dark and windy road is dangerous.');
    ok(dark.kind === 'pred' && dark.term === 'the long, dark and windy road' && !dark.notes.length, 'so is "the long, dark and windy road"', J(dark));
    const it = read(LONG + ', and it is dangerous.');
    ok(it.notes.some(n => n === 'ambiguous: “it” may be “the long, dark, windy road” or “the castle”'),
        'an "it" after it is offered the whole phrase (it had been "the long")', J(it));
    ok(step(['If the long and winding road is dangerous, then we turn back.', 'The long and winding road is dangerous.'], 'We turn back.').tag === '✓ modus ponens',
        'and a step on one follows');
}

console.log('\n-- 6. with a pronoun; the inference colors --');
{
    const both = read('The long road leads to the castle, and it is dangerous, and that road is closed.');
    ok(both.notes.some(n => /^ambiguous: “it” may be “the long road” or “the castle”/.test(n)),
        '"it" and "that road" may be one road: "it" is still asked about, not made the castle', J(both));
    // Colors 2: what goes on to the conclusion is green and underlined (ic-c).
    const painted = (premise, conclusion) => ev(`
        state.trees = [{ id: 'M', type: 'contention', texts: [${J(conclusion)}], collapsed: [], x: 0, y: 0, children: [
            { id: 'A', type: 'support', texts: [${J(premise)}], collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); inferenceColorsOn = true; inferenceColorsVersion = 2; render();
        applyInferenceColors(collectDeductiveSteps(state.trees));
        var on = Array.prototype.filter.call(document.querySelectorAll('#surface .node[data-node-id="A"] .rendered-text .ic-c'), function () { return true; })
            .map(function (e) { return e.textContent; }).join('|');
        inferenceColorsOn = false; render(); return on;`);
    const road = painted(LONG + ', and that road is dangerous.', 'The long, dark, windy road is dangerous.');
    const she = painted('The teacher is tired and she cried.', 'The teacher cried.');
    ok(road === 'that road is dangerous' && she === 'she cried',
        'the colors find the part read with its referent in the words the box has: "that road is dangerous", "she cried" (they had found none)', J([road, she]));
}

// r27.88 (the user, 2026-10-06): "If there are any other anaphors that we
// haven't taken care of, we should probably tackle those, too."
console.log('\n-- 7. "each other" --');
{
    ok(step(['Bob and Mary love each other.'], 'Bob loves Mary.').tag === '✓ conjunction elimination' &&
        step(['Bob and Mary love each other.'], 'Mary loves Bob.').tag === '✓ conjunction elimination',
        'between two, each does it to the other: "Bob loves Mary", and "Mary loves Bob"');
    ok(step(['Bob and Mary love each other.'], 'Bob loves other.').tag === '? not recognized',
        'and not "Bob loves other" (it had been read "both Bob and Mary love other", which certified it)');
    ok(step(["Bob and Mary are each other's friends."], "Mary is Bob's friend.").tag === '✓ conjunction elimination', '"each other\'s" too');
    const three = read('Bob, Mary and Ann love one another.');
    ok(three.kind === 'atom' && three.notes.some(n => /"each other", "one another" and "together"/.test(n)), 'among three, which pairs is not settled: not read', J(three));
    ok(read('Alice and Bob each ate the pizza.').said === 'both alice and Bob ate the pizza', 'a floating "each" is still "both"');
}

console.log('\n-- 8. "which", "it", "this" for what a clause says --');
{
    const which = read('Poe is black, which surprises Mary.');
    ok(which.said === 'poe is black, and the fact that Poe is black surprises Mary' &&
        step(['Poe is black, which surprises Mary.'], 'Poe surprises Mary.').tag === '? not recognized' &&
        step(['Poe is black, which surprises Mary.'], 'Poe is black.').tag === '✓ conjunction elimination',
        '"which" after "Poe is black" is what it says: not "Poe surprises Mary" (it had been)', J(which));
    ok(step(['Poe is black, and it surprises Mary.'], 'Poe surprises Mary.').tag === '? not recognized',
        'nor with "and it" (its note had said what "Poe is black" says, while it was read as Poe)');
    const car = read('Bob bought a car, which surprised Mary.');
    ok(car.notes.some(n => n === 'ambiguous: “it” may be “the car” or what “Bob bought a car” says'), 'after "a car", the car or what the clause says: asked', J(car));
    // (Since r27.139 a claim of its own: "Poe is a raven, and Poe is black".)
    const setOff = read('Poe, which is a raven, is black.');
    ok(setOff.kind === 'and' && /^poe is a raven, and Poe is black$/i.test(setOff.said) && !setOff.notes.some(n => /“which”/.test(n)),
        'a "which" set off inside the subject is not what a clause says: Poe is a raven', J(setOff));
    const thisOne = read('Poe is black, and this surprises Mary.');
    ok(thisOne.notes.some(n => n === 'unread: read with “this” as what “Poe is black” says, the one it can be in this box'), '"this" with a verb after it: what the clause says', J(thisOne));
    const alone = read('This shows that God exists.');
    ok(alone.term === 'this' && !alone.notes.length, 'with nothing before it, as written', J(alone));
    const second = read('Poe is black. That surprises Mary.');
    ok(second.notes.some(n => n === 'unread: read with “That” as what “Poe is black” says, the one it can be in this box'),
        'a full stop ends the clause before: "That" opening a second sentence is what the first says', J(second));
    ok(step(['If Poe is black, which surprises Mary, then Bob is tall.', 'Poe is black, and Poe surprises Mary.'], 'Bob is tall.').tag === '? not recognized',
        'a "which" set off inside an "if" is not said of Poe either: no modus ponens on "Poe surprises Mary"');
}

console.log('\n-- 9. a clause cut short --');
{
    const too = read('Bob left, and Mary did too.');
    ok(too.said === 'bob left, and Mary left' && too.notes.some(n => n === 'unread: read with “Mary did too” as “Mary left”, from the clause before it'),
        '"Mary did too" is "Mary left", and the box says so', J(too));
    ok(step(['Bob left, and Mary did too.'], 'Mary left.').tag === '✓ conjunction elimination' &&
        step(['Bob loves Ann, and so does Mary.'], 'Mary loves Ann.').tag === '✓ conjunction elimination' &&
        step(['Bob did not leave, and neither did Mary.'], 'Mary did not leave.').tag === '✓ conjunction elimination' &&
        step(['Bob can swim, and Mary can too.'], 'Mary can swim.').tag === '✓ conjunction elimination' &&
        step(['Bob has a car, and Mary does too.'], 'Mary has a car.').tag === '✓ conjunction elimination',
        '"did too", "so does", "neither did", "can too", "does too" after "has a car"');
    ok(step(['Poe is black, but Fido is not.'], 'Fido is not black.').tag === '✓ conjunction elimination' &&
        step(["Poe is black, but Fido isn't."], 'Fido is not black.').tag === '✓ conjunction elimination',
        '"Fido is not", "Fido isn\'t"');
    const mt = read('If Mary knows all the physical facts, then she knows what red looks like, and she does not.');
    ok(mt.notes.some(n => n === 'unread: read with “she does not” as “she does not know what red looks like”, from the clause before it'),
        'in one box, the shape of modus tollens: "she does not" is "she does not know what red looks like"', J(mt));
    ok(step(['Bob lies, but Mary does not.'], 'Mary does not lie.').tag === '✓ conjunction elimination', '"lies" is "lie" ("does not lie", not "ly")');
    const chain = read('Bob left, Mary did too, and Ann did too.');
    ok(chain.said === 'bob left, Mary left, and Ann left', 'one after another', J(chain));
    const cut = c => read(c).notes.some(n => /a clause cut short/.test(n));
    ok(cut('Mary does not.') && cut('Bob can swim, and Mary does too.') && cut('Bob is taller than Mary is.'),
        'as written, and said so: with nothing before it in the box, after a helping verb of another kind, in a comparison');
}

console.log('\n-- 10. "if so", "if not", "thinks so" --');
{
    ok(read('Poe is a raven, and if so, Poe is black.').said === 'poe is a raven, and if Poe is a raven, Poe is black', '"if so": if the clause before');
    ok(read('Poe is a raven; if not, Poe is a crow.').said === 'poe is a raven, and if it is not the case that Poe is a raven, Poe is a crow', '"if not": if not the clause before');
    ok(read('Poe may be a raven; if so, Poe is black.').said === 'poe may be a raven, and if Poe is a raven, Poe is black', 'after "may be": if it is');
    ok(read('Poe is a raven. If so, Poe is black.').said === 'poe is a raven, and if Poe is a raven, Poe is black', 'after a full stop too');
    ok(step(['Poe is black, and Mary thinks so.'], 'Mary thinks that Poe is black.').tag === '✓ conjunction elimination', '"Mary thinks so": that Poe is black');
    const too = read('Bob thinks that Poe is black, and Mary thinks so too.');
    ok(too.notes.some(n => n === 'unread: read with “thinks so too” as “thinks that Poe is black”, from the clause before it'), 'after "Bob thinks that ...", what Bob thinks', J(too));
}

console.log('\n-- 11. "the former", "said road", "one" --');
{
    ok(step(['Bob and Mary left, and the latter cried.'], 'Mary cried.').tag === '✓ conjunction elimination' &&
        read('Bob and Mary walked to the castle, and the former cried.').said === 'bob and Mary walked to the castle, and Bob cried',
        '"the latter" is Mary, "the former" Bob -- the pair, not the castle');
    ok(read('The former president resigned.').term === 'the former president', '"the former president": as written');
    ok(step(['The long road leads to the castle, and said road is dangerous.'], 'The long road is dangerous.').tag === '✓ conjunction elimination' &&
        step(['The long road leads to the castle, and the aforementioned road is dangerous.'], 'The long road is dangerous.').tag === '✓ conjunction elimination',
        '"said road", "the aforementioned road"');
    ok(read('Bob said that Mary left.').said === 'bob said that mary left', '"said" as a verb is untouched');
    ok(step(['Bob bought a red car, and Mary bought a blue one.'], 'Mary bought a blue car.').tag === '✓ conjunction elimination',
        '"a blue one" is "a blue car"');
    ok(read('Black ravens are rare, and white ones are rarer.').said === 'black ravens are rare, and white ravens are rarer', '"white ones" are "white ravens"');
    const two = read('Bob bought a red car and a bike, and Mary bought a blue one.');
    ok(two.notes.some(n => n === 'ambiguous: “one” may be “car” or “bike”'), 'a car or a bike: asked', J(two));
    ok(read('No one left.').kind === 'all', '"no one" is untouched');
    // "One" after "is" with no word before it (r27.97): a noun from a clause
    // before -- a quantifier's, or a predicate's.
    ok(read('All men are mortal, and Socrates is one.').said === 'all men are mortal, and Socrates is a man' &&
        step(['All men are mortal, and Socrates is one.'], 'Socrates is a man.').tag === '✓ conjunction elimination',
        '"all men are mortal, and Socrates is one": a man', J(read('All men are mortal, and Socrates is one.')));
    ok(read('Fido is a dog, and Rex is one too.').said === 'fido is a dog, and Rex is a dog too' &&
        read('Every raven is black, and Poe is one, too.').said === 'every raven is black, and Poe is a raven',
        '"one too": a predicate\'s noun, a quantifier\'s');
    ok(read('Poe is a black raven, and Edgar is a white one.').said === 'poe is a black raven, and Edgar is a white raven',
        '"a white one" after "is a black raven": a predicate\'s noun too');
    ok(read('Fido is a dog and a cat, and Rex is one.').notes.some(n => n === 'ambiguous: “one” may be “a dog” or “a cat”'),
        'two nouns joined: asked which');
    ok(read('The answer is one.').said === 'the answer is one' && read('Mary said that the answer is one.').said === 'mary said that the answer is one',
        'not the clause\'s own subject: "the answer is one" is a number');
}

console.log('\n-- 12. "himself" --');
{
    ok(step(['If Bob praises himself, then Bob is vain.', 'Bob praises Bob.'], 'Bob is vain.').tag === '✓ modus ponens',
        '"Bob praises Bob" is "Bob praises himself": modus ponens');
    ok(step(['Bob praises himself.'], 'Bob praises Bob.').tag === '✗ restates its box' &&
        step(['The teacher blames herself.'], 'The teacher blames the teacher.').tag === '✗ restates its box',
        'one claim, so a box that gives one as the other restates it');
    ok(step(['Ravens love themselves.'], 'Ravens love ravens.').tag === '? not recognized' &&
        step(["Bob loves Bob's dog."], 'Bob loves himself.').tag === '? not recognized',
        'not of many ("ravens love ravens"), nor a possessive ("Bob\'s dog")');
}

console.log('\n-- 13. the colors, for a clause cut short --');
{
    const painted = ev(`
        state.trees = [{ id: 'M', type: 'contention', texts: ['Mary left.'], collapsed: [], x: 0, y: 0, children: [
            { id: 'A', type: 'support', texts: ['Bob left, and Mary did too.'], collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); inferenceColorsOn = true; inferenceColorsVersion = 2; render();
        applyInferenceColors(collectDeductiveSteps(state.trees));
        var on = Array.prototype.map.call(document.querySelectorAll('#surface .node[data-node-id="A"] .rendered-text .ic-c'), function (e) { return e.textContent; }).join('|');
        inferenceColorsOn = false; render(); return on;`);
    ok(painted === 'Mary did too', 'the colors find "Mary did too", read as "Mary left"', J(painted));
}

console.log('\n-- 14. who does what a gerund says --');
{
    // r27.105: in "fool the investigator into identifying it", the
    // investigator identifies, so "it" is not the investigator -- it had been
    // read as "the investigator", the box's subject left out instead.
    const fool = read('If the computer is able to fool the investigator into identifying it as human, then the machine can think.');
    ok(/identifying the computer as human/.test(fool.said) && fool.notes.some(n => /“it” as “the computer”/.test(n)),
        '"fool the investigator into identifying it": "it" is the computer -- not the investigator, who identifies', J(fool));
    const hire = read('John talked the boss into hiring him.');
    ok(/hiring john\b/i.test(hire.said), '"talked the boss into hiring him": "him" is John', J(hire));
    const guard = read('The guard stopped the dog from eating it.');
    ok(!/eating the (?:dog|guard)/i.test(guard.said), '"stopped the dog from eating it": "it" is not the dog, nor the guard, a person', J(guard));
}

console.log('\n-- 15. a linked box\'s pronouns, as the box reads alone --');
{
    // r27.107 (the user, 2026-10-15: in "If [O1], then not [M1]." the "not"
    // is not red and the step not certified): read with the links' words,
    // "her" in M1's had been offered "Computers", a capital after a bracket
    // taken for a name.
    const linked = read("If (Computers can't be minds), then not (If the computer is able to fool the investigator into identifying it as human approximately as often as the woman was able to fool the investigator into identifying her as a man, then we should conclude that the machine can think).");
    // (Its "should conclude" asks of its own, hedge or ought, as it does
    // without pronouns -- r27.108: read again with its referents, it had
    // come back from memory without its question.)
    ok(/identifying the woman as a man/.test(linked.said) && !linked.notes.some(n => /may be “Computers”|“her” may be/.test(n)),
        'inside brackets a pronoun goes back to what they hold: "her" is "the woman", not "Computers" before them', J(linked));
    const out = read('If (Mary is tall), then she is happy.'), back = read('Bob left (and he cried).');
    ok(/then mary is happy/i.test(out.said) && /and bob cried/i.test(back.said),
        'a pronoun outside them still goes back into them; one inside them with nothing there to be, outside them', J([out, back]));
}

console.log('\n-- 16. the Experience Machine\'s pronouns --');
{
    // r27.108 (the user, 2026-10-15: 'It registers "it" as being ambiguous
    // between "that someone" (the "that" should be interpreted as a
    // conjunction rather than a demonstrative determiner)').
    const bad = read('There is nothing bad about learning that someone never really loved you aside from the bad feeling it produces.');
    ok(/the bad feeling learning that someone never really loved you produces/.test(bad.said) && !bad.notes.some(n => /^ambiguous/.test(n) || /counts times/.test(n)),
        '"learning that someone ...": "that" opens what is learned, no "that someone"; "it" is the learning, not "the bad feeling" it produces; "never" in the clause no note', J(bad));
    const machine = read('If real experiences outside the experience machine are more valuable than fake ones in machine, then we should be able to say what makes real experiences outside the experience machine more valuable than fake ones in it.');
    const pleasure = read('If being genuinely loved has more value than the pleasure being loved gives you in the experience machine, then we are able to say what makes real experiences outside the experience machine more valuable than fake ones in it.');
    ok([machine, pleasure].every(r => /fake experiences in the experience machine$/.test(r.said) && r.notes.some(n => /“it” as “the experience machine”/.test(n)) && !r.notes.some(n => /“it” may be/.test(n))),
        '"outside the experience machine ... fake ones in it": "it" is the experience machine -- not what a clause says, nor "the pleasure being"', J([machine, pleasure]));
    const sad = read('Bob is sad about learning that someone never loved him.');
    ok(sad.said.toLowerCase() === 'bob is sad about learning that someone never loved bob', '"sad about learning that someone never loved him": one claim about Bob, what he learned whole', J(sad));
    // "Fake ones" stands for experiences in one box of a step and stood for
    // nothing in the other, so the two did not match (r27.108).
    const ones = read('We are unable to say what makes real experiences outside the experience machine more valuable than fake ones in it.');
    const dogs = read('We saw big dogs and small ones.');
    ok(/more valuable than fake experiences in the experience machine/.test(ones.said) && /big dogs and small dogs/.test(dogs.said) && /“ones” as “experiences”/.test(pleasure.notes.join(' ')),
        '"ones" after an adjective stands for a plural after its own adjective before it, with no determiner ("real experiences ... fake ones", "big dogs and small ones") -- not a verb ("being loved gives you")', J([ones, dogs, pleasure]));
}

console.log('\n-- 17. a plural after its verb, with no determiner --');
{
    // r27.109 (the user, 2026-10-20, of "Bob makes cakes and sells them",
    // where "them" had been offered "bob makes": "Can you fix this?").
    const cakes = read('Bob makes cakes and sells them.'), baker = read('The baker makes cakes and sells them.'), dogs = read('Mary loves dogs and feeds them.');
    ok(/sells cakes$/.test(cakes.said) && /sells cakes$/.test(baker.said) && /feeds dogs$/.test(dogs.said) &&
        [cakes, baker, dogs].every(r => r.notes.some(n => /the one it can be in this box/.test(n)) && !r.notes.some(n => /may be/.test(n))),
        '"Bob makes cakes and sells them": "them" is "cakes", a plural after its verb -- not "bob makes", nor Bob, who sells', J([cakes, baker, dogs]));
    ok(step(['Bob makes cakes and sells them.'], 'Bob sells cakes.').tag === '✓ conjunction elimination', 'so "Bob sells cakes" follows: conjunction elimination');
    // (The user: 'is this ambiguous? I only see "Mary loves dogs and Mary
    // feeds dogs"' -- it had been one claim, "feeds" a word no list knows.)
    const cars = read('Mary loves dogs and sports cars.'), raw = read('Bob eats apples and pears raw.');
    ok(dogs.kind === 'and' && cars.kind !== 'and' && raw.kind !== 'and',
        '"Mary loves dogs and feeds them": two claims, "Mary feeds dogs" one, no list need know "feeds"; "loves dogs and sports cars", "eats apples and pears raw" one each', J([dogs, cars, raw]));
    const alone = read('Bob sells them.');
    ok(alone.notes.some(n => /“them” is not “Bob”/.test(n)) && !/bob sells bob/.test(alone.said), '"Bob sells them": "them" is not Bob, and nothing else is there ("bob sells" had been)', J(alone));
    const pets = read('Bob likes the cats and the dogs and feeds them.');
    ok(pets.notes.includes('ambiguous: “them” may be “the cats” or “the dogs”'),
        '"likes the cats and the dogs and feeds them": "the cats" or "the dogs" -- not Bob, who feeds; "the dogs" has no verb of its own, so it is no subject', J(pets));
    const ravens = read('Black ravens fly and they caw.'), programs = read('Computer programs are formal and they lack semantics.');
    ok(ravens.notes.some(n => /“they” as “black ravens”/.test(n)) && programs.notes.some(n => /“they” as “computer programs”/.test(n)),
        'a capital before its noun is no name: "they" is "black ravens", "computer programs" (it had been asked whether it was "Black", "Computer")', J([ravens, programs]));
    const lack = ev('return claimKey(parseClaim("Computer programs lack semantics.")).split(String.fromCharCode(0xE000)).join("");');
    ok(lack === 'P:computer programs|~lack semantics', '"computer programs lack semantics": "lack" is its verb ("programs" had been)', J(lack));
    const apposed = read('Bob, a baker, makes cakes and sells them.');
    ok(/sells cakes$/.test(apposed.said), '"Bob, a baker, makes cakes": "a baker, makes" is no phrase, its words adjectives', J(apposed));
    // As they were.
    const kept = ['Ravens eat worms and they fly.', 'Brown left and he cried.', 'Young sings and he dances.'].map(read);
    ok(/ravens fly$/i.test(kept[0].said) && /brown cried$/i.test(kept[1].said) && /young dances$/i.test(kept[2].said) && !kept.some(r => r.notes.some(n => /may be/.test(n))),
        'as before: "Ravens eat worms and they fly" is the ravens, the worms not asked about; "Brown left", "Young sings": names', J(kept));
    ok(read('Bob makes cakes and they sell well.').notes.includes('ambiguous: “they” may be “Bob” or “cakes”'), '"... and they sell well": Bob or the cakes, asked');
}

console.log('\n-- 18. "fake ones in it": in its own clause --');
{
    // r27.109 (the user, 2026-10-20: 'It says "it" is ambiguous between "the
    // world" and "the experience machine", which seems wrong'; 'if read more
    // accurately, "It" is ambiguous between "the world of the experience
    // machine" and "the experience machine"').
    const IF = 'If real experiences are more valuable than fake ones in the world of the experience machine, then we would be able to say what makes real experiences outside the experience machine more valuable than fake ones in it.';
    const own = read(IF);
    ok(/than fake experiences in the experience machine$/.test(own.said) && own.notes.some(n => /“it” as “the experience machine”/.test(n)) && !own.notes.some(n => /“it” may be/.test(n)),
        '"outside the experience machine ... fake ones in it": "it" is the experience machine, in its own clause -- not "the world", in the "if" before it', J(own));
    ok(step([IF, 'We are unable to say what makes real experiences outside the experience machine more valuable than fake ones in it.'],
        'Real experiences are not more valuable than fake ones in the world of the experience machine.').tag === '✓ modus tollens', 'so the step follows: modus tollens');
    // Not always (the user: "is it always the case that 'it' will always take
    // the container from its own clause?"): where the clause says the same
    // thing is outside it, it is asked (r27.110).
    const mouse = read('If the cat is in the box, then the mouse, which is outside the house, is in it too.');
    ok(mouse.notes.includes('ambiguous: “it” may be “the box” or “the house”'),
        '"the mouse, which is outside the house, is in it too": asked -- its own clause\'s container only where something else is placed there ("fake ones")', J(mouse));
    const world = read('Bob lives in the world of the experience machine, and Mary lives in it too.');
    ok(/mary lives in the world of the experience machine too$/i.test(world.said), '"in the world of the experience machine ... in it": the world of the experience machine, not "the world"', J(world));
}

console.log('\n-- 19. "it is cold" after a thing: the weather among the readings (r27.125) --');
{
    // The user chose the weather by default, with a note ("a"); shown that it
    // read "If Poe is a stove, then it is hot" as the weather, the question --
    // the weather among its readings, written with the "it" clause first,
    // where nothing before "it" is a thing. It had offered the street, or
    // "the fact that the street is wet", and never the weather.
    const asks = t => ev(`var r = parseClaimFull(${J(t)}), n = r.notes.filter(function (x) { return x.kind === 'ambiguous'; })[0];
        return n ? [n.message, n.readings] : null;`);
    const cases = [
        ['The street is wet and it is cold.', '“it” may be “the street” or the weather', ['The street is wet and the street is cold.', 'It is cold and the street is wet.']],
        ['If Poe is a stove, then it is hot.', '“it” may be “Poe” or the weather', ['If Poe is a stove, then Poe is hot.', 'It is hot if Poe is a stove.']],
        ['Bob opened the window and it was cold.', '“it” may be “the window” or the weather', ['Bob opened the window and the window was cold.', 'It was cold and Bob opened the window.']],
        ['If the street is wet and it is cold, then Bob stays in.', '“it” may be “the street” or the weather',
            ['If the street is wet and the street is cold, then Bob stays in.', 'If it is cold and the street is wet, then Bob stays in.']],
        ['If the street is wet and the sky is grey, then it is cold.', '“it” may be “the street” or “the sky”, or the weather',
            ['If the street is wet and the sky is grey, then the street is cold.', 'If the street is wet and the sky is grey, then the sky is cold.', 'It is cold if the street is wet and the sky is grey.']],
        ['The street is wet; it is cold.', '“it” may be “the street” or the weather', ['The street is wet; the street is cold.', 'It is cold; the street is wet.']],
        ['The meeting ran long and it is late.', '“it” may be “the meeting” or the time', ['The meeting ran long and the meeting is late.', 'It is late and the meeting ran long.']],
    ];
    const got = cases.map(([t]) => asks(t));
    ok(got.every((g, i) => !!g && g[0] === cases[i][1] && J(g[1]) === J(cases[i][2])),
        '"it" after a thing may be the weather (or the time): that reading moves its clause in front, in the box\'s own words -- and "the fact that the street is wet is cold" is no reading', J(got));
    const back = ['It is cold and the street is wet.', 'It is hot if Poe is a stove.', 'If it is cold and the street is wet, then Bob stays in.', 'Mary is sad and it is cold.'].map(t => read(t).notes);
    ok(back.every(n => !n.length), 'and read back, each says the weather, asking nothing; so does "it" with no thing before it', J(back));
    const house = read('In the old house, it is cold.').notes;
    ok(house.length && !house.some(n => /^ambiguous/.test(n)), '"In the old house, it is cold": the weather there -- not "it" with nothing to refer to', J(house));
    const mp = step(['If it is cold and the street is wet, then Bob stays in.', 'The street is wet and it is cold.'], 'Bob stays in.');
    ok(mp.tag === '? ambiguous' && mp.rows.length === 2 && /^It is cold and the street is wet\..*follows/.test(mp.rows[1]),
        'a step that needs the weather asks, the weather the reading that gives it', J(mp));
    const chosen = step(['If it is cold and the street is wet, then Bob stays in.', 'It is cold and the street is wet.'], 'Bob stays in.');
    ok(chosen.tag === '✓ modus ponens', 'and with it written in, follows', J(chosen));
    const as = [asks('The soup is hot and it is spicy.'), asks('Bob thinks that the street is wet and it is cold.')];
    ok(as[0] && as[0][0] === '“it” may be “the soup” or what “The soup is hot” says' && as[1] && !/weather/.test(as[1][0]),
        'not "it is spicy", no weather; nor where the clause cannot be moved in front ("Bob thinks that ..."): asked as before', J(as));
    const tip = ev(`state.trees = [{ id: 'M', type: 'contention', texts: ['Otto remembers the address.'], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ['If Otto reads his notebook, then he remembers the address.', 'Otto reads his notebook.'], collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); deductiveLive = true; render();
        var tag = document.querySelector('.derivation-tag[data-step="A"]'); openDeductiveCheck('A');
        var row = document.querySelector('#logic-modal-body .logic-step[data-step="A"]'); document.getElementById('logic-modal-backdrop').classList.remove('open');
        return [tag && tag.title, row && row.title];`);
    ok(tip.every(t => (t || '').indexOf('“If Otto reads his notebook, then he remembers the address.”: "his" and "he" are read as "Otto", the one name this claim gives. ' +
            '“Otto reads his notebook.”: "his" is read as "Otto", the one name this claim gives.') > 0) && /^Valid by modus ponens/.test(tip[0]),
        'a certified step says how its boxes were read, after "Valid by" -- its tag\'s tip and the list of steps (it had, only where a step did not follow)', J(tip));
    const tips = (ps, c) => ev(`state.trees = [{ id: 'M', type: 'contention', texts: [${J(c)}], collapsed: [], x: 0, y: 0, children: [
        { id: 'A', type: 'support', texts: ${J(ps)}, collapsed: [], children: [] } ] }];
        deductiveCache.clear(); ensureCollabFields(state); deductiveLive = true; render();
        var tag = document.querySelector('.derivation-tag[data-step="A"]'); return [tag && tag.textContent.trim(), tag && tag.title];`);
    const same = tips(['If it rains, then Bob is tall and so is Mary.', 'It rains.'], 'Bob is tall and so is Mary.');
    ok(same[0] === '✓ modus ponens' && same[1].indexOf('“If it rains, then Bob is tall and so is Mary.” and “Bob is tall and so is Mary.”: read with “so is Mary” as “Mary is tall”, from the clause before it.') > 0 &&
        same[1].split('so is Mary” as').length === 2,
        'boxes read the same way are named together, the reading once', J(same));
    const bound = [
        [['Everything is black if it is a raven.', 'Poe is a raven.'], 'Poe is black.', '"it" is read as what the quantifier speaks of: this says what "everything that is a raven is black" says'],
        [['If someone is a man, then he is mortal.', 'Socrates is a man.'], 'Socrates is mortal.', '"he" is read as the "someone" in the condition, so the box says what "everyone who is a man is mortal" says'],
        [['If any man is wise, then he is happy.', 'Socrates is a man.', 'Socrates is wise.'], 'Socrates is happy.', '"he" is read as what the condition speaks of, so the box says what "every man that is wise is happy" says'],
        [['Bob and Mary love each other.'], 'Bob loves Mary.', '"each other" is read as each of the two to the other'],
    ].map(([ps, c, note]) => { const t = tips(ps, c); return [/^✓/.test(t[0]), t[1].indexOf('“' + ps[0] + '”: ' + note + '.') > 0, t]; });
    ok(bound.every(b => b[0] && b[1]), 'so too a pronoun bound by a quantifier or a condition, and "each other"', J(bound.filter(b => !(b[0] && b[1]))));
    const kept = tips(['If Bob is happy while Mary is sad, then Ann is glad.', 'Bob is happy while Mary is sad.'], 'Ann is glad.');
    ok(kept[0] === '✓ modus ponens' && !/while|read/.test(kept[1]),
        'and only what the words left open: "while" read as one claim is no guess, and is not said', J(kept));
}

console.log('\n-- "they" of one person; "the student" of "a student" (r27.130) --');
{
    // The user: "highlight ... parse language into its syntactical components
    // correctly"; of the fixes proposed, "I agree with you on everything".
    // "If anyone cheats, they will be caught" had been "✗ no referent", and
    // "if someone cheats, they will be caught" read as one claim -- with "he"
    // both were read. "They" is how one person is spoken of here.
    const tag = (ps, c) => step(ps, c).tag;
    const they = [
        [['If anyone cheats, they will be caught.', 'Bob is a person.', 'Bob cheats.'], 'Bob will be caught.'],
        [['If someone cheats, they will be caught.', 'Bob is a person.', 'Bob cheats.'], 'Bob will be caught.'],
        [['If someone cheats, they lose.', 'Bob is a person.', 'Bob cheats.'], 'Bob loses.'],
        [['If someone is late, they are punished.', 'Bob is a person.', 'Bob is late.'], 'Bob is punished.'],
        [['If someone cheats, they do not win.', 'Bob is a person.', 'Bob cheats.'], 'Bob does not win.'],
        [['If someone cheats, they will not be trusted.', 'Bob is a person.', 'Bob cheats.'], 'Bob will not be trusted.'],
        [['If someone cheats, he does not win.', 'Bob is a person.', 'Bob cheats.'], 'Bob does not win.']].map(([ps, c]) => tag(ps, c));
    ok(they.every(t => t === '✓ universal modus ponens'),
        '"they" bound by "someone" or "anyone" in a condition, as "he" is, in the singular ("they lose": "loses"); denied, "no one who ..." ("he does not win" had been read as one claim too)', J(they));
    const said = ev(`var r = parseClaimFull('If someone cheats, they do not win.'); return { key: claimKey(r.form).replace(/\\uE000/g, ''), notes: r.notes.map(function (n) { return n.message; }) };`);
    ok(said.key === 'U:(=person&~cheat)|¬~win' && said.notes.length === 1 &&
        said.notes[0] === '"they" is read as the "someone" in the condition, so the box says what "no one who cheats wins" says', 'and says so', J(said));
    const the = [
        [['If a student cheats, that student will be caught.', 'Bob is a student.', 'Bob cheats.'], 'Bob will be caught.'],
        [['If a student cheats, that student does not pass.', 'Bob is a student.', 'Bob cheats.'], 'Bob does not pass.']].map(([ps, c]) => tag(ps, c));
    ok(J(the) === J(['✓ universal modus ponens', '✓ universal modus ponens']),
        '"that student", after "if a student ...", is that student, as "he" would be (it had been read as one claim)', J(the));
    const notes = ev(`return parseClaimFull('If a student cheats, that student will be caught.').notes.map(function (n) { return n.message; });`);
    ok(notes[0] === '"that student" is read as what the condition speaks of, so the box says what "every student that cheats will be caught" says', 'and says so, in its words', J(notes));
    // "The AI system" keeps its words, the same in each box, for the step
    // r27.119 made modus ponens: "the student" is not bound so.
    const kept = ev(`return ['If a student cheats, the student will be caught.', 'If a student cheats, the teacher will be angry.'].map(function (t) { return claimKey(parseClaim(t)).replace(/\\uE000/g, ''); });`);
    ok(J(kept) === J(['I(P:a student|~cheat>P:the student|~will be caught)', 'I(P:a student|~cheat>P:the teacher|~will be angry)']),
        '"the student" keeps its words (the r27.119 modus ponens of "the AI system"), and "the teacher" is not the student', J(kept));
}

console.log('\n-- the weather\'s "it" after "if", "unless", "when"; "it is Tuesday" (r27.132) --');
{
    // "The game is cancelled unless it is sunny" had offered "the game is
    // sunny" and "the fact that the game is cancelled is sunny" -- neither
    // meant -- and no weather: r27.125 wrote the weather's reading only
    // after "and", or for "if A, then it is cold".
    const asked = t => ev(`var n = parseClaimFull(${J(t)}).notes.filter(function (x) { return x.kind === 'ambiguous'; }).pop();
        return n ? n.message.replace(/\\uE000/g, '') + ' | ' + n.readings.map(claimLabel).join(' / ') : null;`);
    const got = ['The game is cancelled unless it is sunny.', 'The game is cancelled if it is cold.', 'The game is on when it is sunny.',
        'The street is wet and it is Tuesday.', 'The sheep is hungry and it is cold.'].map(asked);
    ok(J(got) === J(['“it” may be “the game” or the weather | The game is cancelled unless the game is sunny. / Unless it is sunny, the game is cancelled.',
        '“it” may be “the game” or the weather | The game is cancelled if the game is cold. / If it is cold, the game is cancelled.',
        '“it” may be “the game” or the weather | The game is on when the game is sunny. / When it is sunny, the game is on.',
        '“it” may be “the street” or the time | The street is wet and the street is Tuesday. / It is Tuesday and the street is wet.',
        '“it” may be “the sheep” or the weather | The sheep is hungry and the sheep is cold. / It is cold and the sheep is hungry.']),
        'the weather\'s reading puts its clause first, after "unless", "if" or "when" too; a day of the week is the time\'s; one sheep may be "it"', J(got));
    const back = ev(`return ['Unless it is sunny, the game is cancelled.', 'If it is sunny, the game is cancelled.'].map(function (t) { var r = parseClaimFull(t);
        return claimKey(r.form).replace(/\\uE000/g, '') + ' ' + r.notes.length; });`);
    ok(J(back) === J(['D[P:the game|=canceled;P:it|=sunny] 0', 'I(P:it|=sunny>P:the game|=canceled) 0']),
        'and read back, its "it" is the weather\'s: "unless it is sunny" had read "it" as the game', J(back));
    ok(asked('The game is cancelled if it is spicy.') === '“it” may be “the game” or what “The game is cancelled” says | The game is cancelled if the game is spicy. / The game is cancelled if the fact that the game is cancelled is spicy.',
        '"spicy" is no weather, as before');
}

ok(!errors.length, 'no JSDOM script errors', errors.slice(0, 3).join(' | '));
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
