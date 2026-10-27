'use strict';
// r27.75 (the user, 2026-10-05): "I was wondering if we could come up with a
// option to turn on a coloring scheme that changed the color of the text
// inside the nodes to reflect which parts of an inference they correspond
// to ... the idea is to help users tell which parts of a node are combining
// with other parts (especially when they contain the same phrase) to derive
// the conclusion above." Agreed over three mockups:
//
// (1) The button: a swatch after Deductive. In the side panel Evaluations,
//     Deductive and the swatch are a row without their key letters (still in
//     their tips), so the panel keeps its height. Since r27.81 (the user:
//     "let's not have color mode turn on deductive ... pressing color cycles
//     through them (off, on v1, on v2)"): the swatch and Shift+C go off ->
//     colors 1 -> colors 2 -> off, the third bar white for 1 and green for 2;
//     Deductive is neither turned on nor needed, and turning it on or off
//     leaves the colors as they are; off, the boxes are as they were.
//     Colors 2 is the second mockup's: what goes on to the conclusion green,
//     nothing dimmed.
// (2) What each part is: where premises meet, a color for each part that
//     meets (one claim, one color); what goes on to the conclusion, normal
//     text, with a red dashed underline when the conclusion denies it (MT's
//     "the alarm went off", "white" in "No ravens are white"); a part the step
//     does not use, and the words around the parts, dimmed; "All ravens"
//     whole, its quantifier with it; in a chain of ifs, the first "if" and the
//     last "then", normal; a step the check does not recognize, each part its
//     own color (one part said twice, one color).
// (3) Words that deny ("not", "did not", "No", "¬"): red and bold, keeping
//     the color of the part they are in (in the light theme its tint too).
// (4) The words are found as the check reads them: contractions, regional
//     spellings, a pronoun for its name, formatting, premise links.
// (5) The look: six colors for each theme (the light theme's with a pale tint
//     behind), the underline 1px, dashed, below the words; dimmed .45.
// (6) Painted once: a layout with nothing changed leaves the words alone; a
//     new render or an edit paints them again; a box open for editing is left
//     alone until it closes; Help says what they mean.
// (7) r27.82 (the user: "the parts that go into the conclusion (including the
//     connectives ...) should be a single color ... once there's a validity
//     ... Until the validity has been established, they can keep separate
//     colors"):
//     once a step is valid, what goes on is one stretch with its joining
//     words -- plain in colors 1, green in 2; not valid, each part its own
//     color; a claim read as two whose pieces have no words of their own is
//     one part. Then: "Let's just take the underlined portion of the
//     conclusion from Colors 3 and put it into Colors 2. Then remove Colors
//     3": colors 2's stretch is underlined, and there is no colors 3.
// (8) r27.83 (the user: "when a negation is in front of an atomic (in its
//     formal form) ... it doesn't become red"; "the formal forms of the
//     conditional don't change colors when they're used in the conclusion
//     ... Can we make sure their behavior is consistent with their English
//     forms?"): a denial in symbols is red in every spelling the reader takes;
//     a formula's arrow goes with what carries on, as "if" and "then" do; a
//     stretch spans the symbols between its parts; an underlined letter, or a
//     bold "it rains", reads as itself. And ("the highlight extends to the
//     negations"): a "~" before a letter is part of its claim, tint and all.
//     And ("Is it possible to color those as well?"): a formula in "$...$" is
//     colored as the math draws it.
// (9) Then the gaps the math's spacing left in the tint, at the user's
//     asking: between two symbols of one color the spacing is padding as
//     wide, and only there; colors off, the math as it was; each
//     colored symbol's tint as tall as the words'; colors 2's line under
//     math a strip of its own, reaching into its neighbors' (no seams).
// (10) Every premise of a certified step placed (r27.123): where no clause
//     of it is found, its pieces are -- an identity's names, a part of a
//     phrase, a verb's object, contraries, "F(a)" and "a = b" in symbols;
//     painted whole only where it is another wording of the conclusion.
// (11) r27.133: a kind with parts, where it meets nothing whole, in its
//     parts ("whoever" and "can vote", "every raven" and "sings"); "only",
//     "none but" and "if something is ..., then it is ..." found by their
//     words; words two clauses share ("Bob and Mary left") found for each,
//     a shared word taking the color of the part that goes on, else of the
//     one that meets, and words between that belong to neither left plain;
//     a kind the conclusion denies goes on denied ("every raven", with
//     "Poe is not a raven").
// (12) r27.141: a subject the reading says twice where the box says it once
//     ("Bob, who is rich, can pay": "Bob is rich, and Bob can pay") goes on
//     with the part that goes on, "Mark Twain" one stretch; a step that
//     drops words ("Bob ran quickly", so "Bob ran"; "Bob is glad that Mary
//     left", so "Bob is glad") lights the words kept and dims those
//     dropped.
// (13) r27.145: a name in capitals ("NASA") is found among the box's words,
//     as any word is; "A student cheats", with "the student" in the
//     conclusion, goes on as the student, "cheats" meeting the kind.
//
// Run:  node colors-r27-inference-test.js [argument-mapper-r27.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || (__dirname + '/argument-mapper-r27.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const J = JSON.stringify;

let pass = 0, fail = 0;
function ok(c, label, detail) {
    if (c) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

function makeWin(label) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e)).split('\n')[0]));
    function stubs(win) {
        const { webcrypto } = require('crypto');
        if (!win.crypto || !win.crypto.randomUUID) Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
        win.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
        win.ResizeObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
        const ctx = new Proxy({}, { get: (_t, p) => p === 'measureText' ? (() => ({ width: 40 })) : (() => ctx) });
        win.HTMLCanvasElement.prototype.getContext = () => ctx;
        win.indexedDB = { open() { const r = {}; setTimeout(() => r.onerror && r.onerror({ target: { error: new Error('x') } }), 0); return r; }, deleteDatabase() { const r = {}; setTimeout(() => r.onsuccess && r.onsuccess({}), 0); return r; } };
        win.requestAnimationFrame = cb => win.setTimeout(() => cb(Date.now()), 0);
        win.cancelAnimationFrame = win.clearTimeout;
        win.scrollTo = () => {}; win.confirm = () => true; win.prompt = () => null; win.open = () => null; win.alert = () => {};
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}

// A step: the conclusion's box M, the premises in box A (one box each).
const step = (premises, conclusion, type) => [{ id: 'M', type: 'contention', texts: [conclusion], collapsed: [], x: 30000, y: 30000, children: [
    { id: 'A', type: type || 'support', texts: premises, collapsed: [], children: [] }] }];

(async () => {
    console.log('=== r27.75 inference colors: each premise colored by its part in the step ===');
    const W = makeWin('colors');
    await sleep(300);
    const run = js => W.win.eval(js);
    const val = js => JSON.parse(run('JSON.stringify(' + js + ')'));
    const CSS = run(`Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\\n')`);
    run(`window.__load = function (trees) { state.trees = trees; ensureCollabFields(state); selectedIds = []; render(); };
        // A red word inside a part's span (r27.106) is listed as a piece of the
        // part with "ic-neg" added, as when it was a span beside the others.
        window.__parts = function (j) {
            const rd = document.querySelector('.node[data-node-id="A"][data-node-idx="' + j + '"] .rendered-text');
            const out = [];
            rd.querySelectorAll('span.ic').forEach(s => {
                if (s.parentElement.closest('span.ic')) return;
                const cls = s.className.replace(/^ic /, '');
                let run = null;
                s.childNodes.forEach(n => {
                    const c = n.nodeType === 1 && n.matches('span.ic-neg') ? cls + ' ic-neg' : cls;
                    if (run && run.c === c) run.t += n.textContent; else out.push(run = { c, t: n.textContent });
                });
            });
            return out.map(r => r.c + ': ' + r.t);
        };
        window.__step = function (trees) { __load(trees); if (!inferenceColorsOn) cycleInferenceColors(); else refreshDerivationTags();
            const st = collectDeductiveSteps(state.trees, null)[0];
            return { rule: st && st.rule ? st.rule.name : null, boxes: trees[0].children[0].texts.map((_, j) => __parts(j)) }; };`);
    const paint = (premises, conclusion, type) => val(`__step(${J(step(premises, conclusion, type))})`);
    // The parts of a box with a class, as "class: words" (spaces trimmed, runs of one class joined).
    const runs = (parts, re) => parts.filter(p => re.test(p.split(': ')[0])).map(p => p.slice(p.indexOf(': ') + 2).trim());

    console.log('\n-- (1) the button --');
    {
        const b = val(`(function () {
            const btn = document.getElementById('colors-btn'), row = btn && btn.parentElement;
            return { inRow: !!row && row.classList.contains('logic-row'), order: row ? Array.from(row.children).map(x => x.id) : [],
                bars: btn ? btn.querySelectorAll('i').length : 0, pressed: btn && btn.getAttribute('aria-pressed'), title: btn && btn.title,
                live: deductiveLive, on: inferenceColorsOn }; })()`);
        ok(b.inRow && J(b.order) === J(['eval-overview-btn', 'logic-btn', 'colors-btn']) && b.bars === 3,
            'a swatch of three bars right after Deductive, with Evaluations and Deductive in one row', J(b));
        ok(b.pressed === 'false' && !b.live && !b.on && /Shift\+C/.test(b.title) && !/Deductive/.test(b.title), 'off at first, its tip giving Shift+C', J(b));
        ok(/\.logic-row\s*\{\s*display:\s*contents;\s*\}/.test(CSS) && /body\.toolbar-left #group-view \.logic-row\s*\{[^}]*display:\s*flex;[^}]*flex:\s*0 0 100%/.test(CSS) &&
            /body\.toolbar-left \.logic-row \.hotkey\s*\{\s*display:\s*none;\s*\}/.test(CSS),
            'in the top toolbar the three sit in the group\'s row; in the side panel they are a row of their own without key letters');
        const t = val(`(function () {
            __load(${J(step(['If the alarm went off, then the dog barked', 'The alarm went off'], 'The dog barked'))});
            const rd = () => document.querySelector('.node[data-node-id="A"][data-node-idx="0"] .rendered-text');
            const plain = rd().innerHTML, btn = document.getElementById('colors-btn');
            const bar = () => getComputedStyle(btn.querySelectorAll('i')[2]).backgroundColor;
            const bar2 = () => getComputedStyle(btn.querySelectorAll('i')[1]).backgroundColor;
            const look = () => ({ colors: inferenceColorsOn, version: btn.dataset.version, v2: document.body.classList.contains('ic-v2'), v3: document.body.classList.contains('ic-v3'), live: deductiveLive,
                pressed: btn.getAttribute('aria-pressed'), active: btn.classList.contains('active'), label: btn.getAttribute('aria-label'), title: btn.title, bar: bar(), bar2: bar2(),
                spans: document.querySelectorAll('.rendered-text span.ic').length, tags: document.querySelectorAll('.derivation-tag').length, same: rd().innerHTML === plain });
            const off0 = look();
            btn.click(); const one = look();
            btn.click(); const two = look();
            btn.click(); const off = look();
            const key = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', code: 'KeyC', shiftKey: true, bubbles: true, cancelable: true }));
            key(); const k1 = look(); key(); const k2 = look(); key(); const k0 = look();
            btn.click();
            toggleDeductiveLive(); const withCheck = look();
            toggleDeductiveLive(); const checkOff = look();
            btn.click(); btn.click();
            return { off0, one, two, off, k1, k2, k0, withCheck, checkOff, last: look() }; })()`);
        ok(t.one.colors && t.one.version === '1' && !t.one.v2 && t.one.active && t.one.pressed === 'true' && t.one.label === 'Inference colors 1' &&
            /Colors 1: what goes on to the conclusion plain, the rest dimmed/.test(t.one.title) && t.one.bar === 'rgb(255, 255, 255)' && t.one.spans > 0,
            'a press: colors 1, the third bar white', J(t.one));
        ok(!t.one.live && t.one.tags === 0, 'and Deductive stays off: the premises are colored, no step is tagged', J(t.one));
        ok(t.two.colors && t.two.version === '2' && t.two.v2 && !t.two.v3 && t.two.active && t.two.label === 'Inference colors 2' &&
            /Colors 2: what goes on to the conclusion green and underlined, nothing dimmed. Click to turn the colors off/.test(t.two.title) && t.two.bar === 'rgb(111, 191, 139)' && t.two.spans > 0,
            'another: colors 2, the third bar green', J(t.two));
        ok(!t.off.colors && t.off.version === '0' && !t.off.v2 && !t.off.v3 && !t.off.active && t.off.pressed === 'false' && t.off.spans === 0 && t.off.same && t.off.bar === t.off0.bar,
            'a third: off (there is no colors 3), the boxes exactly as they were', J(t.off));
        ok(t.k1.version === '1' && t.k2.version === '2' && t.k0.version === '0' && !t.k0.colors, 'Shift+C goes round the same way',
            J([t.k1.version, t.k2.version, t.k0.version]));
        ok(t.withCheck.colors && t.withCheck.live && t.withCheck.tags > 0 && t.withCheck.spans > 0 && t.checkOff.colors && !t.checkOff.live && t.checkOff.spans > 0,
            'turning Deductive on and off leaves the colors on', J({ withCheck: t.withCheck, checkOff: t.checkOff }));
        ok(!t.last.colors && t.last.same, 'and they go off only from the swatch (or Shift+C)', J(t.last));
    }

    console.log('\n-- (2) what each part is --');
    {
        const mp = paint(['If the alarm went off, then the dog barked', 'The alarm went off'], 'The dog barked');
        ok(mp.rule === 'modus ponens' && J(mp.boxes[0]) === J(['ic-rest: If ', 'ic-k0: the alarm went off', 'ic-rest: , then ', 'ic-c: the dog barked']) &&
            J(mp.boxes[1]) === J(['ic-k0: The alarm went off']),
            'modus ponens: where the premises meet, one color; what goes on, normal; "If" and ", then" dimmed', J(mp));
        const mt = paint(['If the alarm went off, then the dog barked', "The dog didn't bark"], 'The alarm did not go off');
        // (r27.112, the user: "we should always make the contradictory part of
        // a red-underlined conclusion red": "went", which "did not go off"
        // denies.)
        ok(mt.rule === 'modus tollens' && J(mt.boxes[0]) === J(['ic-rest: If ', 'ic-c ic-cn: the alarm ', 'ic-c ic-cn ic-neg: went', 'ic-c ic-cn:  off', 'ic-rest: , then ', 'ic-k0: the dog barked']) &&
            J(mt.boxes[1]) === J(['ic-k0: The dog ', "ic-k0 ic-neg: didn't", 'ic-k0:  bark']),
            'modus tollens: "the alarm went off" goes on denied (underlined), "went" red, what the conclusion contradicts; "didn\'t" red within its part', J(mt));
        const ds = paint(['Either it is raining or it is snowing', 'It is not raining'], 'It is snowing');
        ok(ds.rule === 'disjunctive syllogism' && J(runs(ds.boxes[0], /ic-k0/)) === J(['it is raining']) && J(runs(ds.boxes[0], /^ic-c/)) === J(['it is snowing']) &&
            J(ds.boxes[1]) === J(['ic-k0: It ', 'ic-k0 ic-neg: is not', 'ic-k0:  raining']),
            'disjunctive syllogism: the disjunct denied meets its denial, one color; the other goes on', J(ds));
        const ump = paint(['All ravens are black', 'Poe is a raven'], 'Poe is black');
        ok(ump.rule === 'universal modus ponens' && J(ump.boxes[0]) === J(['ic-k0: All ravens', 'ic-rest:  ', 'ic-c: are black']) &&
            J(ump.boxes[1]) === J(['ic-c: Poe', 'ic-rest:  ', 'ic-k0: is a raven']),
            '"All ravens" colored whole, quantifier and all, meeting "is a raven"; "are black" and "Poe" go on -- each "is" with what it says (r27.118)', J(ump));
        const no = paint(['No ravens are white', 'Poe is a raven'], 'Poe is not white');
        ok(J(no.boxes[0]) === J(['ic-k0: No ravens', 'ic-rest:  ', 'ic-c ic-cn: are white']),
            '"No ravens are white": "No" denies nothing another premise says, so it is not red (r27.91); "white" underlined -- the conclusion denies it', J(no));
        const hs = paint(['If it rains, then the ground is wet', 'If the ground is wet, then the game is cancelled'], 'If it rains, then the game is cancelled');
        ok(hs.rule === 'hypothetical syllogism' &&
            J(hs.boxes[0]) === J(['ic-c: If it rains', 'ic-rest: , then ', 'ic-k0: the ground is wet']) &&
            J(hs.boxes[1]) === J(['ic-rest: If ', 'ic-k0: the ground is wet', 'ic-rest: , ', 'ic-c: then the game is cancelled']),
            'a chain of ifs: the first "if" and the last "then" stay normal, the "then" and "if" where the premises meet are dimmed', J(hs));
        const ce = paint(['The sky is blue and grass is green'], 'The sky is blue');
        ok(J(ce.boxes[0]) === J(['ic-c: The sky is blue', 'ic-rest:  and ', 'ic-u: grass is green']), 'a part the step does not use is dimmed', J(ce));
        const dil = paint(['Either it rains or it snows', 'If it rains, then the game is off', 'If it snows, then the game is off'], 'The game is off');
        ok(J(runs(dil.boxes[0], /ic-k0/)) === J(['it rains']) && J(runs(dil.boxes[0], /ic-k1/)) === J(['it snows']) &&
            J(runs(dil.boxes[1], /ic-k0/)) === J(['it rains']) && J(runs(dil.boxes[2], /ic-k1/)) === J(['it snows']) &&
            J(runs(dil.boxes[1], /^ic-c/)) === J(['the game is off']) && J(runs(dil.boxes[2], /^ic-c/)) === J(['the game is off']),
            'two meetings, two colors: "it rains" one, "it snows" the other', J(dil));
        const bars = paint(['All humans are mortal', 'All Greeks are humans'], 'All Greeks are mortal');
        ok(J(bars.boxes[0]) === J(['ic-k0: All humans', 'ic-rest:  ', 'ic-c: are mortal']) && J(bars.boxes[1]) === J(['ic-c: All Greeks', 'ic-rest:  ', 'ic-k0: are humans']),
            'a syllogism: the middle term one color in both premises', J(bars));
        const obj = paint(['If Poe is a crow, then Poe is not a raven', 'Poe is a crow'], 'Poe is a raven', 'objection');
        // r27.104 (the user: "Color negations red in green conclusions if they
        // reject the parent premise/contention"): its "not" denies the box it
        // attacks, so it is red.
        ok(obj.rule === 'modus ponens' && runs(obj.boxes[0], /^ic-c/).join(' ') === 'Poe is not a raven' && !obj.boxes[0].some(p => /ic-cn/.test(p)) &&
            J(runs(obj.boxes[0], /ic-neg/)) === J(['is not']),
            'an objection: what it concludes is the denial of its box, so "Poe is not a raven" goes on -- its "is not" red, as it denies the box (r27.104)', J(obj));
        const mtn = paint(["If the alarm didn't go off, then the dog was quiet", 'The dog was not quiet'], 'The alarm went off');
        ok(runs(mtn.boxes[0], /ic-cn/).join(' ') === "the alarm didn't go off", 'a denied part the conclusion affirms is underlined too', J(mtn));
        const ac = paint(['If it rains, then the ground is wet', 'The ground is wet'], 'It rains');
        ok(ac.rule === null && J(ac.boxes[0]) === J(['ic-rest: If ', 'ic-k1: it rains', 'ic-rest: , then ', 'ic-k0: the ground is wet']) && J(ac.boxes[1]) === J(['ic-k0: The ground is wet']),
            'a step not recognized: each part its own color, one part said twice one color, nothing normal', J(ac));
        const most = paint(['Most ravens are black', 'Poe is a raven'], 'Poe is black');
        ok(most.rule === null && J(most.boxes.map(b => b.map(p => p.split(': ')[0]))) === J([['ic-k0'], ['ic-k1']]), 'and premises that share nothing, a color each', J(most));
        // r27.111 (the user: '"learning that someone never really loved you"
        // is treated as an independent clause when it's not'): beside "there
        // is nothing bad about ...", a clause none of whose parts meets
        // anything is one color, its subject not apart.
        const one = paint(['If there is nothing bad about learning that someone never really loved you, then learning that someone never really loved you gives you a genuine reason to be disappointed',
            'There is nothing bad about learning that someone never really loved you'], 'Learning that someone never really loved you gives you a genuine reason to be disappointed', 'objection');
        ok(one.rule === null && J(runs(one.boxes[0], /^ic-k/)) === J(['there is nothing bad about learning that someone never really loved you',
            'learning that someone never really loved you gives you a genuine reason to be disappointed']),
            'not recognized, beside "there is nothing bad about ...": "learning that ... gives you a genuine reason ..." one color, its subject not apart', J(one));
    }

    console.log('\n-- (3) words that deny --');
    {
        const neither = paint(['It is not the case that both it rains and it snows', 'It rains'], 'It does not snow');
        ok(neither.boxes[0][0] === 'ic-rest: It is not the case that both ' && /"ic-c ic-cn: it ","ic-c ic-cn ic-neg: snows"/.test(J(neither.boxes[0])),
            '"It is not the case that" denies nothing another premise says ("It rains" is no "both"), so it is not red (r27.91); "it snows" goes on denied, "snows" red (r27.112)', J(neither));
        // r27.91 (the user, 2026-10-06): red "only ... when they're
        // contradicting a premise that lacks the negation".
        const searle = paint(['Computer programs are only formal', 'Syntax by itself is not sufficient for semantics',
            'If computer programs are only formal, and if syntax by itself is not sufficient for semantics, then computers lack semantics'], 'Computers lack semantics');
        ok(searle.rule === 'modus ponens, conditions together' && !searle.boxes.some(b => b.some(p => /ic-neg/.test(p.split(': ')[0]))),
            'a denial two premises share contradicts neither: "is not sufficient" is not red', J(searle.boxes));
        // r27.92 (the user, 2026-10-07): "highlight the negation or negative
        // word that's doing the contradicting ... rather than just every
        // instance of 'not'".
        const feather = paint(['If ravens are black, then some feather is black', 'No feather is black'], 'Ravens are not black');
        ok(feather.rule === 'modus tollens' && J(feather.boxes[1]) === J(['ic-k0 ic-neg: No', 'ic-k0:  feather is black']),
            'a negative quantifier that contradicts is red: "No" in "No feather is black", beside "some feather is black"', J(feather.boxes));
        const nested = paint(['If it rains, then Poe does not fly', 'It is not the case that Poe does not fly'], 'It does not rain');
        ok(nested.rule === 'modus tollens' && J(nested.boxes[1]) === J(['ic-k0 ic-neg: It is not the case that', 'ic-k0:  Poe does not fly']),
            'only the denial doing the contradicting: "It is not the case that", not the "does not" both premises say', J(nested.boxes));
        // r27.112 (the user: '"no" is the words that contradicts, not "never"
        // ("never" is in both)'; "We could always try using the internal
        // syntax tree to reveal it"): the denial the attacked box does not
        // say, the outermost by the syntax tree.
        const no = paint(['If it rains, then learning that someone never really loved you gives you no genuine reason to be disappointed', 'It rains'],
            'Learning that someone never really loved you gives you a genuine reason to be disappointed', 'objection');
        const rel = paint(['If it rains, then the dog that never barks is not old', 'It rains'], 'The dog that never barks is old', 'objection');
        ok(no.rule === 'modus ponens' && J(runs(no.boxes[0], /ic-neg/)) === J(['no']) && rel.rule === 'modus ponens' && J(runs(rel.boxes[0], /ic-neg/)) === J(['is not']),
            'red, the outermost by the syntax tree: "no", in the object of "gives", not "never", inside "that someone never really loved you"; "is not", not "never", inside "that never barks" (the first, which had been red)',
            J([no.boxes[0], rel.boxes[0]]));
        const someNot = paint(['All ravens are black', 'Some ravens are not black'], 'Poe is a raven');
        ok(someNot.boxes[1].some(p => p === 'ic-k0 ic-neg: are not') && !someNot.boxes[0].some(p => /ic-neg/.test(p)),
            '"Some ravens are not black" beside "All ravens are black": its "not" red', J(someNot.boxes));
        const umt = paint(['All ravens are black', 'Poe is not black'], 'Poe is not a raven');
        ok(umt.rule === 'universal modus tollens' && umt.boxes[1].some(p => /ic-neg/.test(p.split(': ')[0]) && /not/.test(p)),
            'one that denies what another premise says of all ravens is red: "Poe is not black" beside "All ravens are black"', J(umt.boxes));
        const sym = paint(['P → Q', '¬Q'], '¬P');
        ok(sym.rule === 'modus tollens' && J(sym.boxes[1]) === J(['ic-k0 ic-neg: ¬', 'ic-k0: Q']) && J(sym.boxes[0]) === J(['ic-c ic-cn: P', 'ic-rest:  → ', 'ic-k0: Q']),
            'in symbols too: "¬" red (and part of its claim "¬Q"), "P" underlined', J(sym));
        ok(/body \.rendered-text span\.ic\.ic-neg\s*\{\s*opacity:\s*1;\s*color:\s*#ff7b72;\s*font-weight:\s*600;\s*\}/.test(CSS) &&
            /body\.nodes-light \.rendered-text span\.ic\.ic-neg\s*\{\s*color:\s*#c62828;\s*\}/.test(CSS),
            'red and bold (#ff7b72 on dark boxes, #c62828 on light), never dimmed, and no background of their own: a part\'s tint stays behind them');
    }

    console.log('\n-- (4) finding the words --');
    {
        const pron = paint(['If Poe is a raven, then he is black', 'Poe is a raven'], 'Poe is black');
        ok(J(runs(pron.boxes[0], /^ic-c/)) === J(['he is black']), 'a pronoun the check reads as its name: "he is black" found', J(pron));
        const bold = paint(['If **the alarm** went off, then the *dog* barked', 'The alarm went off'], 'The dog barked');
        ok(runs(bold.boxes[0], /ic-k0/).join(' ') === 'the alarm went off' && runs(bold.boxes[0], /^ic-c/).join(' ') === 'the dog barked',
            'formatted words keep their part\'s color across the formatting', J(bold));
        const emph = paint(['If Poe does sing, then Poe is happy', 'Poe sings'], 'Poe is happy');
        ok(runs(emph.boxes[0], /ic-k0/).join(' ') === 'Poe does sing', '"does sing", read as "sings", found whole', J(emph));
        const link = val(`(function () {
            __load([{ id: 'M', type: 'contention', texts: ['The dog barked'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'A', type: 'support', texts: ['If [S2](#box:B), then the dog barked', 'The alarm went off'], collapsed: [], children: [] }] },
                { id: 'B', type: 'support', texts: ['The alarm went off'], collapsed: [], x: 100, y: 100, freePosition: true, children: [] }]);
            if (!inferenceColorsOn) cycleInferenceColors(); else refreshDerivationTags();
            const rd = document.querySelector('.node[data-node-id="A"][data-node-idx="0"] .rendered-text');
            const a = rd.querySelector('.box-link');
            return { wrap: a && a.parentElement.className, label: a && a.textContent, parts: __parts(0), rule: (collectDeductiveSteps(state.trees, null).find(s => s.childId === 'A') || {}).rule }; })()`);
        ok(link.wrap === 'ic ic-k0' && link.rule, 'a premise link, read as its box\'s words, takes their color', J(link));
        // r27.90 (the user, 2026-10-06): "if I put something in parentheses
        // at the end, it cuts off the right parenthesis (dims it)".
        const paren = paint(['Computer programs are only formal (syntactic).', 'If computer programs are only formal (syntactic), then computers lack semantics.'], 'Computers lack semantics.');
        const held = paint(['(Poe is black).', 'If Poe is black, then Mary is happy.'], 'Mary is happy.');
        ok(J(runs(paren.boxes[0], /ic-k0/)) === J(['Computer programs are only formal (syntactic)']) &&
            J(runs(paren.boxes[1], /ic-k0/)) === J(['computer programs are only formal (syntactic)']) &&
            J(runs(held.boxes[0], /ic-k0/)) === J(['(Poe is black)']) && runs(held.boxes[0], /ic-rest/).join('') === '.',
            'a bracket that closes one opened inside a part, or that holds all of it, takes its color; the full stop does not', J([paren, held]));
    }

    console.log('\n-- (5) the look --');
    {
        // r27.107 (the user, 2026-10-15: "In dark mode, only the text is
        // colored, so, they're more difficult to associate with the correct
        // colors"; "the tints are a little difficult to distinguish
        // between"): dark boxes have tints too, the light boxes' hues,
        // stronger.
        const dark = [['#5fd3e8', '0,170,205'], ['#f59bc4', '225,60,140'], ['#c3b1ff', '110,80,230'], ['#ffd479', '230,170,0'], ['#ffb38a', '240,120,60'], ['#8fd0ff', '40,130,230']];
        ok(dark.every(([c, t], k) => new RegExp('\\n    \\.rendered-text \\.ic-k' + k + '\\s*\\{\\s*color:\\s*' + c + ';\\s*background:\\s*rgba\\(' + t + ',\\.(?:2[5-9]|3\\d?)\\)').test(CSS)),
            'six colors on dark boxes, each with a tint of the light boxes\' hue behind it, stronger (r27.107)');
        const light = [['#006b80', '0,170,205'], ['#a8235f', '225,60,140'], ['#5536b8', '110,80,230'], ['#7a5200', '230,170,0'], ['#a6430f', '240,120,60'], ['#1f5fa0', '40,130,230']];
        ok(light.every(([c, t], k) => new RegExp('body\\.nodes-light \\.rendered-text \\.ic-k' + k + '\\s*\\{\\s*color:\\s*' + c + ';\\s*background:\\s*rgba\\(' + t + ',\\.\\d+\\)').test(CSS)),
            'and on light boxes darker ones, each with a pale tint of itself behind the words');
        const cn = (CSS.match(/\.rendered-text \.ic-cn\s*\{[^}]*\}/) || [''])[0];
        ok(/text-decoration-style:\s*dashed/.test(cn) && /text-decoration-thickness:\s*1px/.test(cn) && /text-underline-offset:\s*3px/.test(cn) && /#ff7b72/.test(cn) &&
            /body\.nodes-light \.rendered-text \.ic-cn\s*\{\s*text-decoration-color:\s*#c62828;\s*\}/.test(CSS),
            'the underline: red, dashed, 1px, 3px below the words', cn);
        ok(/\.rendered-text \.ic-rest, \.rendered-text \.ic-u\s*\{\s*opacity:\s*\.45;\s*\}/.test(CSS), 'the rest dimmed to .45');
        const lt = val(`(function () {
            document.body.classList.add('nodes-light');
            __step(${J(step(['If the alarm went off, then the dog barked', 'The alarm went off'], 'The dog barked'))});
            const s = Array.from(document.querySelectorAll('.node[data-node-id="A"] .rendered-text span.ic-k0'));
            const cs = s.map(x => getComputedStyle(x)); document.body.classList.remove('nodes-light');
            return cs.map(c => c.color + ' / ' + c.backgroundColor); })()`);
        ok(lt.length === 2 && lt.every(x => x === 'rgb(0, 107, 128) / rgba(0, 170, 205, 0.17)'), 'in the light theme a meeting part is dark teal on a pale teal tint', J(lt));
        // Colors 2: the same parts; what goes on green, nothing dimmed, denials still red.
        const v2 = val(`(function () {
            const look = () => {
                const cs = sel => { const x = document.querySelector('.node[data-node-id="A"] .rendered-text ' + sel); if (!x) return null; const c = getComputedStyle(x); return c.color + ' / ' + c.opacity + ' / ' + c.backgroundColor; };
                return { c: cs('span.ic-c:not(.ic-neg)'), cneg: cs('span.ic-c > span.ic-neg'), rest: cs('span.ic-rest:not(.ic-neg)'), k0: cs('span.ic-k0:not(.ic-neg)') };
            };
            if (inferenceColorsOn) { inferenceColorsOn = false; syncInferenceColorsButton(); }
            cycleInferenceColors(); cycleInferenceColors();
            __load(${J(step(['If Poe is a crow, then Poe is not a raven', 'Poe is a crow'], 'Poe is a raven', 'objection'))});
            const dark = look();
            document.body.classList.add('nodes-light'); refreshDerivationTags();
            const light = look();
            document.body.classList.remove('nodes-light');
            const parts = __parts(0);
            cycleInferenceColors(); cycleInferenceColors();   // off, then colors 1 again for what follows
            return { version: inferenceColorsVersion, dark, light, parts }; })()`);
        // r27.107 (the user: "hard to tell the blue and green highlights
        // apart in dark mode when using premise links"): a yellow green.
        ok(v2.dark.c === 'rgb(127, 207, 151) / 1 / rgba(120, 190, 40, 0.22)' && / \/ 1 \/ /.test(v2.dark.rest || '') && /^rgb\(95, 211, 232\) \/ 1 \/ rgba\(0, 170, 205, 0\.3\)$/.test(v2.dark.k0 || ''),
            'colors 2: what goes on to the conclusion green (#7fcf97) on a yellow-green tint, apart from teal; the words around it not dimmed, meetings in their colors on their tints (r27.107)', J(v2.dark));
        const red2 = val(`(function () {
            const cs = sel => { const x = document.querySelector('.node[data-node-id="A"] .rendered-text ' + sel); if (!x) return null; const c = getComputedStyle(x); return c.color + ' / ' + c.opacity + ' / ' + c.backgroundColor; };
            if (inferenceColorsOn) { inferenceColorsOn = false; syncInferenceColorsButton(); }
            cycleInferenceColors(); cycleInferenceColors();
            __load(${J(step(['The dog did not bark', 'If the dog barked, then the alarm went off'], 'The dog did not bark, and if the dog barked, then the alarm went off'))});
            const dark = cs('span.ic-c > span.ic-neg');
            document.body.classList.add('nodes-light'); refreshDerivationTags();
            const light = cs('span.ic-c > span.ic-neg');
            document.body.classList.remove('nodes-light');
            cycleInferenceColors(); cycleInferenceColors();   // off, then colors 1 again for what follows
            return { dark, light }; })()`);
        ok(/^rgb\(255, 123, 114\) \/ 1 \//.test(red2.dark || '') && /^rgb\(198, 40, 40\) \/ 1 \//.test(red2.light || ''),
            'a word that denies another premise, inside a green part, stays red ("The dog did not bark", beside "if the dog barked")', J(red2));
        ok(v2.light.c === 'rgb(23, 128, 58) / 1 / rgba(23, 128, 58, 0.12)', 'on light boxes the green is darker (#17803a), on a pale green tint', v2.light.c);
        ok(/body\.ic-v2 \.rendered-text \.ic-rest, body\.ic-v2 \.rendered-text \.ic-u\s*\{\s*opacity:\s*1;\s*\}/.test(CSS) && J(v2.parts) === J(paint(['If Poe is a crow, then Poe is not a raven', 'Poe is a crow'], 'Poe is a raven', 'objection').boxes[0]),
            'a part not used is not dimmed either; the parts are those of colors 1 (only the look changes)', J(v2.parts));
    }

    console.log('\n-- (6) painted once --');
    {
        const p = val(`(function () {
            __step(${J(step(['If the alarm went off, then the dog barked', 'The alarm went off'], 'The dog barked'))});
            const rd = document.querySelector('.node[data-node-id="A"][data-node-idx="0"] .rendered-text');
            const first = rd.querySelector('span.ic');
            let scheduled = 0; const keep = window.requestAnimationFrame; window.requestAnimationFrame = cb => { scheduled++; return keep(cb); };
            layoutScheduled = false;
            refreshDerivationTags(); layoutAll();
            const same = rd.querySelector('span.ic') === first, quiet = scheduled;
            layoutScheduled = false; scheduled = 0;
            render();
            const again = __parts(0), measured = scheduled;
            window.requestAnimationFrame = keep;
            const n = findNodeContext(state.trees, 'A').node; n.texts[1] = 'The alarm did go off'; render();
            const edited = __parts(1);
            return { same, quiet, again, measured, edited }; })()`);
        ok(p.same && p.quiet === 0, 'a layout with nothing changed leaves the painted words as they are (no new layout asked for)', J(p));
        ok(J(p.again) === J(['ic-rest: If ', 'ic-k0: the alarm went off', 'ic-rest: , then ', 'ic-c: the dog barked']) && p.measured > 0,
            'a new render paints them again, and asks for the boxes to be measured again (bold words are wider)', J(p));
        ok(J(p.edited) === J(['ic-k0: The alarm did go off']), 'and an edit is painted as it reads now', J(p.edited));
        const open = val(`(function () {
            __step(${J(step(['If the alarm went off, then the dog barked', 'The alarm went off'], 'The dog barked'))});
            const host = document.querySelector('.node[data-node-id="A"][data-node-idx="1"]'), rd = host.querySelector('.rendered-text');
            const first = rd.querySelector('span.ic');
            enterEditMode(host);
            findNodeContext(state.trees, 'A').node.texts[1] = 'The alarm went off loudly';   // as typing does
            refreshDerivationTags();
            const whileOpen = { hidden: rd.style.display === 'none', same: rd.querySelector('span.ic') === first, other: __parts(0).length > 0 };
            host.querySelector('.box-editor').blur();
            refreshDerivationTags();
            return { whileOpen, after: __parts(1) }; })()`);
        ok(open.whileOpen.hidden && open.whileOpen.same && open.whileOpen.other, 'a box open for editing is left alone under the editor as its words change (no repaint per keystroke)', J(open));
        ok(J(open.after) === J(['ic-k0: The alarm went off']), 'and is painted again once it closes', J(open.after));
        const help = run(`document.getElementById('help-modal-backdrop') ? document.getElementById('help-modal-backdrop').textContent : document.body.textContent`);
        ok(/colors button after Deductive \(Shift\+C\) colors each premise by its part in the step/.test(help) && /a part the conclusion denies, underlined in red dashes/.test(help) &&
            /Once a step is valid, what goes on to the conclusion is one stretch: plain in colors 1, which dims the rest; green and underlined in colors 2, which dims nothing\. Until then each part has its own color\. Each press moves on: off, 1, 2, off\./.test(help),
            'Help says what the colors mean, both versions and Shift+C');
    }

    console.log('\n-- (7) once a step is valid: one stretch, underlined in colors 2 --');
    {
        const comm = paint(['The sky is blue and grass is green'], 'Grass is green and the sky is blue');
        ok(comm.rule === 'commutation' && J(comm.boxes[0]) === J(['ic-c: The sky is blue and grass is green']),
            'what goes on to the conclusion is one stretch, its "and" with it', J(comm));
        const iff = paint(['If it rains, then the ground is wet', 'If the ground is wet, then it rains'], 'It rains if and only if the ground is wet');
        ok(iff.rule === 'biconditional introduction' && J(iff.boxes) === J([['ic-c: If it rains, then the ground is wet'], ['ic-c: If the ground is wet, then it rains']]),
            'two ifs that both go on: each one stretch, its "if" and "then" with it', J(iff));
        const mpor = paint(['If it rains and it is cold, then the roads freeze or the game is off', 'It rains and it is cold'], 'The roads freeze or the game is off');
        ok(mpor.rule === 'modus ponens' && J(mpor.boxes[0]) === J(['ic-rest: If ', 'ic-k0: it rains', 'ic-rest:  and ', 'ic-k1: it is cold', 'ic-rest: , then ', 'ic-c: the roads freeze or the game is off']),
            '"the roads freeze or the game is off" one stretch; the parts that meet keep their own colors, the "and" between them outside it', J(mpor));
        const dm = paint(['It is not the case that both it rains and it snows'], 'It does not rain or it does not snow');
        ok(J(dm.boxes[0]) === J(['ic-c: It is not the case that both ', 'ic-c ic-cn: it ', 'ic-c ic-cn ic-neg: rains', 'ic-c:  and ', 'ic-c ic-cn: it ', 'ic-c ic-cn ic-neg: snows']),
            'a denied stretch: its "it is not the case that" plain, denying no premise (r27.91); each part the conclusion denies still underlined, its contradicted word red (r27.112)', J(dm));
        const ac = paint(['If it rains, then the ground is wet', 'The ground is wet'], 'It rains');
        ok(ac.rule === null && !ac.boxes.some(b => b.some(p => /^ic-c(?![a-z-])/.test(p.split(': ')[0]))), 'not valid yet: no stretch, each part its own color', J(ac));
        const kind = paint(['All ravens that live in cities are black', 'Poe is a raven that lives in a city'], 'Poe is black');
        // (Its parts meeting nothing, the "all" is one color too -- r27.111.)
        ok(J(kind.boxes) === J([['ic-k0: All ravens that live in cities are black'], ['ic-k1: Poe is a raven that lives in a city']]),
            'a claim read as two whose pieces have no words of their own is one part, colored (it went uncolored); the "all", whose parts meet nothing, one part too', J(kind));
        const rule = sel => (CSS.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
        const under = rule('body.ic-v2 .rendered-text .ic-c'), underLight = rule('body.ic-v2.nodes-light .rendered-text .ic-c');
        ok(/color:\s*#7fcf97/.test(under) && /text-decoration-line:\s*underline/.test(under) && /text-decoration-style:\s*solid/.test(under) &&
            /text-decoration-color:\s*#7fcf97/.test(under) && /text-decoration-thickness:\s*1px/.test(under) && /text-underline-offset:\s*3px/.test(under),
            'colors 2: the stretch green and underlined in its green, 1px, 3px below the words (a red word in it keeps the green line)', under);
        ok(/color:\s*#17803a/.test(underLight) && /text-decoration-color:\s*#17803a/.test(underLight) && /rgba\(23,128,58,\.12\)/.test(underLight),
            'on light boxes the darker green, its tint and its line', underLight);
        ok(/text-decoration-style:\s*dashed/.test(rule('body.ic-v2 .rendered-text .ic-c.ic-cn')) && /#ff7b72/.test(rule('body.ic-v2 .rendered-text .ic-c.ic-cn')) &&
            /#c62828/.test(rule('body.ic-v2.nodes-light .rendered-text .ic-c.ic-cn')),
            'a part the conclusion denies keeps its red dashes in colors 2');
        ok(!/ic-v3|ic-q\d/.test(CSS), 'no colors 3 left behind');
        const one = val(`(function () {
            const style = sel => { const x = document.querySelector('.node[data-node-id="A"] .rendered-text ' + sel); if (!x) return null; const c = getComputedStyle(x); return c.color + ' / ' + c.opacity; };
            while (!(inferenceColorsOn && inferenceColorsVersion === 1)) cycleInferenceColors();
            __load(${J(step(['If it rains and it is cold, then the roads freeze or the game is off', 'It rains and it is cold'], 'The roads freeze or the game is off'))});
            refreshDerivationTags();
            return { c: style('span.ic-c'), rest: style('span.ic-rest') }; })()`);
        ok(/ \/ 1$/.test(one.c || '') && / \/ 0.45$/.test(one.rest || ''),
            'colors 1: the stretch is plain, its "or" not dimmed; the words outside it dimmed', J(one));
    }

    console.log('\n-- (8) formulas as their English --');
    {
        const neg = ['~', '!', '-', '¬', '∼'].map(n => paint(['P → Q', n + 'Q'], n + 'P'));
        ok(neg.every(t => t.rule === 'modus tollens' && /ic-neg/.test(t.boxes[1][0]) && t.boxes[1][1] === 'ic-k0: Q' && t.boxes[0][0] === 'ic-c ic-cn: P'),
            'a denial in symbols is red, in every spelling the reader takes ("~", "!", "-", "¬", "∼"), as "not" is', J(neg.map(t => t.boxes[1])));
        const dash = paint(['It is well-known that the alarm went off', 'If it is well-known that the alarm went off, then the dog barked'], 'The dog barked');
        ok(!dash.boxes.some(b => b.some(p => /ic-neg/.test(p.split(': ')[0]))), 'not a hyphen inside a word ("well-known")', J(dash.boxes));
        const hs = paint(['P → Q', 'Q → R'], 'P → R');
        ok(hs.rule === 'hypothetical syllogism' && J(hs.boxes) === J([['ic-c: P →', 'ic-rest:  ', 'ic-k0: Q'], ['ic-k0: Q', 'ic-rest:  ', 'ic-c: → R']]),
            'a chain of conditionals in symbols: each arrow goes with the part that carries on, as "If it rains" and "then the game is cancelled" do', J(hs.boxes));
        const iff = paint(['P → Q', 'Q → P'], 'P ↔ Q');
        ok(iff.rule === 'biconditional introduction' && J(iff.boxes) === J([['ic-c: P → Q'], ['ic-c: Q → P']]),
            'two conditionals that both go on: each one stretch, its arrow with it, as in English', J(iff.boxes));
        const mpor = paint(['(P & R) → (Q ∨ S)', 'P & R'], 'Q ∨ S');
        ok(mpor.rule === 'modus ponens' && mpor.boxes[0].includes('ic-c: Q ∨ S'), '"Q ∨ S" one stretch, as "the roads freeze or the game is off"', J(mpor.boxes[0]));
        const under = paint(['__P__ → Q', 'P'], 'Q');
        const tie = ['~Q', '¬ Q', '~(P & Q)'].map(t => paint(t === '~(P & Q)' ? ['~(P & Q)', 'P'] : ['P → Q', t], t === '~(P & Q)' ? '~Q' : '~P'));
        ok(J(tie[0].boxes[1]) === J(['ic-k0 ic-neg: ~', 'ic-k0: Q']) && J(tie[1].boxes[1]) === J(['ic-k0 ic-neg: ¬', 'ic-k0:  Q']) && tie[2].boxes[0][0] === 'ic-rest: ~(',
            'a denial in symbols is part of the claim it denies ("~Q", "¬ Q"): its color, still red; not one before a bracket, which here denies no premise (r27.91)', J(tie.map(t => t.boxes)));
        const tint = val(`(function () {
            document.body.classList.add('nodes-light');
            __step(${J(step(['P → Q', '~Q'], '~P'))});
            // The "~" red, inside its part's span, whose tint is behind it (r27.106).
            const x = document.querySelector('.node[data-node-id="A"][data-node-idx="1"] .rendered-text span.ic-neg');
            const c = x && getComputedStyle(x), o = x && getComputedStyle(x.parentElement.closest('span.ic') || x); document.body.classList.remove('nodes-light');
            return c ? c.color + ' / ' + o.backgroundColor : null; })()`);
        ok(tint === 'rgb(198, 40, 40) / rgba(0, 170, 205, 0.17)', 'on light boxes the tint of its part runs behind the "~" too, the "~" red', tint);
        ok(under.rule === 'modus ponens' && J(under.boxes[0]) === J(['ic-k0: P', 'ic-rest:  → ', 'ic-c: Q']), 'an underlined letter is the letter: the step is valid and colored', J(under));
        const bold = paint(['If **it rains**, then the ground is wet', 'It rains'], 'The ground is wet');
        ok(bold.rule === 'modus ponens' && runs(bold.boxes[0], /ic-k0/).join(' ') === 'it rains', 'a bold "it rains" is "it rains": the step is valid and colored', J(bold));
        // A formula in "$...$" as the math draws it (KaTeX's own markup, as
        // Chrome renders "$P \to Q$" and "$\neg Q$"; this test has no KaTeX):
        // its letters and symbols colored, the copy for screen readers not.
        const katexOf = (tex, glyphs) => '<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow>' +
            glyphs.map(g => g[0] === 'mrel' ? '<mo>' + g[1] + '</mo>' : '<mi>' + g[1] + '</mi>').join('') + '</mrow><annotation encoding="application/x-tex">' + tex +
            '</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.68em;"></span>' +
            glyphs.map(g => '<span class="' + g[0] + '">' + g[1] + '</span>' + (g[0] === 'mrel' ? '<span class="mspace" style="margin-right:0.28em;"></span>' : '')).join('') + '</span></span></span>';
        const math = val(`(function () {
            __load(${J(step(['$P \\to Q$', '$\\neg Q$'], '$\\neg P$'))});
            const rd = j => document.querySelector('.node[data-node-id="A"][data-node-idx="' + j + '"] .rendered-text');
            rd(0).innerHTML = ${J(katexOf('P \\to Q', [['mord mathnormal', 'P'], ['mrel', '→'], ['mord mathnormal', 'Q']]))};
            rd(1).innerHTML = ${J(katexOf('\\neg Q', [['mord', '¬'], ['mord mathnormal', 'Q']]))};
            if (!inferenceColorsOn) cycleInferenceColors(); else refreshDerivationTags();
            const glyphs = j => Array.from(rd(j).querySelectorAll('.katex-html span.ic')).map(s => s.className.replace(/^ic /, '') + ': ' + s.textContent);
            const st = collectDeductiveSteps(state.trees, null)[0];
            return { rule: st.rule && st.rule.name, p1: glyphs(0), p2: glyphs(1), hidden: rd(0).querySelectorAll('.katex-mathml span.ic').length + rd(1).querySelectorAll('.katex-mathml span.ic').length,
                kept: !!rd(0).querySelector('.katex-html .mord.mathnormal > span.ic') }; })()`);
        ok(math.rule === 'modus tollens' && J(math.p1) === J(['ic-c ic-cn: P', 'ic-rest: →', 'ic-k0: Q']) && J(math.p2) === J(['ic-k0 ic-neg: ¬', 'ic-k0: Q']),
            'a formula in "$...$": its letters and symbols colored as the same formula typed out ("¬" red, part of "¬Q")', J(math));
        ok(math.hidden === 0 && math.kept, 'inside the math\'s own spans; the copy for screen readers left alone', J(math));
    }

    console.log('\n-- (9) math colored as typed symbols are --');
    {
        // KaTeX's own markup for "$P \to Q$" and "$(P \land R) \to (Q \lor S)$",
        // as Chrome renders them: the spaces between symbols are margins.
        const katexHtml = html => '<span class="katex"><span class="katex-mathml"><math><semantics><mrow></mrow></semantics></math></span>' +
            '<span class="katex-html" aria-hidden="true">' + html + '</span></span>';
        const PQ = '<span class="base"><span class="strut" style="height:0.6833em;"></span><span class="mord mathnormal" style="margin-right:0.13889em;">P</span>' +
            '<span class="mspace" style="margin-right:0.2778em;"></span><span class="mrel">→</span><span class="mspace" style="margin-right:0.2778em;"></span></span>' +
            '<span class="base"><span class="strut" style="height:0.8778em;vertical-align:-0.1944em;"></span><span class="mord mathnormal">Q</span></span>';
        const QP = PQ.replace('>P<', '>@<').replace('>Q<', '>P<').replace('>@<', '>Q<').replace('style="margin-right:0.13889em;"', '');
        const BIG = '<span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mopen">(</span><span class="mord mathnormal" style="margin-right:0.13889em;">P</span>' +
            '<span class="mspace" style="margin-right:0.2222em;"></span><span class="mbin">∧</span><span class="mspace" style="margin-right:0.2222em;"></span></span>' +
            '<span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mord mathnormal" style="margin-right:0.00773em;">R</span><span class="mclose">)</span>' +
            '<span class="mspace" style="margin-right:0.2778em;"></span><span class="mrel">→</span><span class="mspace" style="margin-right:0.2778em;"></span></span>' +
            '<span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mopen">(</span><span class="mord mathnormal">Q</span>' +
            '<span class="mspace" style="margin-right:0.2222em;"></span><span class="mbin">∨</span><span class="mspace" style="margin-right:0.2222em;"></span></span>' +
            '<span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mord mathnormal" style="margin-right:0.05764em;">S</span><span class="mclose">)</span></span>';
        run(`window.__math = function (trees, htmls) {
            __load(trees);
            const rd = j => document.querySelector('.node[data-node-id="A"][data-node-idx="' + j + '"] .rendered-text');
            htmls.forEach((h, j) => { if (h != null) rd(j).innerHTML = h; });
            if (!inferenceColorsOn) cycleInferenceColors(); else refreshDerivationTags();
            const look = j => Array.from(rd(j).querySelectorAll('.katex-html span.ic')).map(s => s.textContent + ' ' + s.className.replace(/^ic /, '') +
                (s.style.paddingRight ? ' pr=' + s.style.paddingRight : '') + (s.hasAttribute('data-ic-fit') ? ' fit' : '') +
                (s.hasAttribute('data-ic-jl') ? ' jl' : '') + (s.hasAttribute('data-ic-jr') ? ' jr' : ''));
            const margins = j => Array.from(rd(j).querySelectorAll('.katex-html [style*="margin-right"]')).map(e => e.style.marginRight + (e.dataset.icMargin ? '<' + e.dataset.icMargin : ''));
            return { rule: (collectDeductiveSteps(state.trees, null)[0].rule || {}).name, a: look(0), b: look(1), ma: margins(0), mb: margins(1), rd };
        };`);
        const iff = val(`(function () { const r = __math(${J(step(['$P \\to Q$', '$Q \\to P$'], '$P \\leftrightarrow Q$'))}, ${J([katexHtml(PQ), katexHtml(QP)])}); delete r.rd; return r; })()`);
        ok(iff.rule === 'biconditional introduction' && J(iff.a) === J(['P ic-c pr=0.41669em fit jr', '→ ic-c pr=0.2778em fit jr', 'Q ic-c fit']),
            'between two symbols of one color the math\'s spacing becomes padding after the first, as wide (P\'s slant and the space after it)', J(iff.a));
        ok(J(iff.ma) === J(['0px<0.13889em', '0px<0.2778em', '0px<0.2778em']), 'the margins that spaced them are kept, to be put back', J(iff.ma));
        const mp = val(`(function () { const r = __math(${J(step(['$(P \\land R) \\to (Q \\lor S)$', '$P \\land R$'], '$Q \\lor S$'))}, ${J([katexHtml(BIG), null])}); delete r.rd; return r; })()`);
        ok(mp.rule === 'modus ponens' && J(mp.a.filter(x => /pr=/.test(x))) === J(['Q ic-c pr=0.2222em fit jr', '∨ ic-c pr=0.2222em fit jr']) &&
            J(mp.ma) === J(['0.13889em', '0.2222em', '0.2222em', '0.00773em', '0.2778em', '0.2778em', '0px<0.2222em', '0px<0.2222em', '0.05764em']),
            'only within one color: "Q ∨ S" runs on; "P", "∧", "R", the arrow and the brackets keep their spacing', J(mp));
        const back = val(`(function () {
            const r = __math(${J(step(['$P \\to Q$', '$Q \\to P$'], '$P \\leftrightarrow Q$'))}, ${J([katexHtml(PQ), katexHtml(QP)])});
            const painted = r.rd(0).innerHTML; refreshDerivationTags(); const again = r.rd(0).innerHTML === painted;
            while (inferenceColorsOn) cycleInferenceColors();
            const k = r.rd(0).querySelector('.katex-html');
            return { again, spans: k.querySelectorAll('span.ic').length, html: k.innerHTML }; })()`);
        ok(back.again, 'painted once: refreshing with nothing changed leaves the math as it is', J(back));
        ok(back.spans === 0 && back.html.replace(/:\s*/g, ':').replace(/;\s*"/g, ';"') === PQ.replace(/;"/g, ';"'),
            'colors off: the math as KaTeX drew it, its margins back', back.html);
        const fit = val(`(function () {
            const r = __math(${J(step(['$P \\to Q$', '$Q \\to P$'], '$P \\leftrightarrow Q$'))}, ${J([katexHtml(PQ), katexHtml(QP)])});
            const s = r.rd(0).querySelector('.katex-html span.ic');
            return { top: s.style.paddingTop, bottom: s.style.paddingBottom, base: s.style.getPropertyValue('--ic-base') }; })()`);
        ok(/^\d+(\.\d+)?px$/.test(fit.top) && /^\d+(\.\d+)?px$/.test(fit.bottom) && /^-?\d+(\.\d+)?px$/.test(fit.base),
            'each colored symbol\'s tint as tall as the box\'s words\' (padded to their height), and where its baseline is', J(fit));
        const mix = val(`(function () {
            const r = __math(${J(step(['P → $Q$', 'Q → $P$'], 'P ↔ Q'))}, ${J(['P → ' + katexHtml('<span class="base"><span class="strut" style="height:0.8778em;vertical-align:-0.1944em;"></span><span class="mord mathnormal">Q</span></span>'), null])});
            delete r.rd; return r; })()`);
        ok(mix.rule === 'biconditional introduction' && J(mix.a) === J(['Q ic-c fit jl']), 'typed words running on into math: its line reaches back into theirs', J(mix));
        const sub = val(`(function () {
            const d = document.createElement('div');
            d.innerHTML = '<span class="katex-html"><span class="base"><span class="mord"><span class="mord mathnormal" style="margin-right:0.13889em;"><span class="ic ic-c">P</span></span>' +
                '<span class="msupsub"><span class="vlist"><span style="margin-right:0.05em;"><span class="ic ic-c">1</span></span></span></span></span>' +
                '<span class="mspace" style="margin-right:0.2778em;"></span><span class="mrel"><span class="ic ic-c">→</span></span></span></span>';
            icMathGaps(d);
            return Array.from(d.querySelectorAll('[style*="margin-right"]')).map(e => e.style.marginRight); })()`);
        ok(J(sub) === J(['0.13889em', '0.05em', '0.2778em']), 'a sub- or superscript and what is next to it keep their spacing', J(sub));
        const css = CSS.replace(/\s+/g, ' ');
        ok(/span\.ic\.ic-c\[data-ic-fit\]:not\(\.ic-cn\) \{ text-decoration-line: none; position: relative; \}/.test(css) &&
            /span\.ic\.ic-c\[data-ic-fit\]:not\(\.ic-cn\)::after \{ content: ''; position: absolute; left: 0; right: 0; top: calc\(var\(--ic-base\) \+ 3px\); height: 1px; background: #7fcf97;/.test(css) &&
            /body\.ic-v2\.nodes-light \.rendered-text span\.ic\.ic-c\[data-ic-fit\]:not\(\.ic-cn\)::after \{ background: #17803a; \}/.test(css) &&
            /\[data-ic-jl\]:not\(\.ic-cn\)::after \{ left: -\.5px; \}/.test(css) && /\[data-ic-jr\]:not\(\.ic-cn\)::after \{ right: -\.5px; \}/.test(css),
            'colors 2\'s line under math: a 1px strip where the underline would be (3px below the baseline), in its green, reaching half a pixel into a neighbor it goes on into');
    }

    console.log('\n-- (r27.102, r27.104) premise links in parts; what an objection concludes --');
    {
        // The user, 2026-10-14: "In color mode, highlighting on linked
        // premises doesn't work as well as you'd expect"; then (r27.104):
        // "Keep blue lines underneath links ... lower green underlines to the
        // same position as red dash underlines so that regular underlines
        // and links can keep their underline positions without overlapping.
        // Keep links blue in all color modes."
        ok(/\.rendered-text span\.ic a\.node-link, \.rendered-text span\.ic u \{ text-underline-offset: auto; \}/.test(CSS) && !/a\.box-link \{ color: inherit/.test(CSS) &&
            /\.rendered-text \.node-link \{\s*color: var\(--color-selected\); text-decoration: underline;/.test(CSS),
            'a link in a part stays blue, underlined where links are; so do words underlined; the part\'s line runs below them, where the red dashes do');
        const obj = val(`(function () {
            __load([{ id: 'M', type: 'contention', texts: ['Physicalism is false.'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'A', type: 'objection', texts: ['Physics is complete.', 'If [O1](#box:A), then it is not the case that [M1](#box:M).'], collapsed: [], children: [] }] }]);
            if (!inferenceColorsOn) cycleInferenceColors(); else refreshDerivationTags();
            const st = collectDeductiveSteps(state.trees, null).find(s => s.childId === 'A');
            const rd = document.querySelector('.node[data-node-id="A"][data-node-idx="1"] .rendered-text');
            return { rule: st && st.rule ? st.rule.name : null, matched: !!st && !!st.conclusion && certifyStep(st.premises, [st.conclusion], true) !== null,
                links: Array.from(rd.querySelectorAll('a.box-link')).map(a => a.parentElement.className + ': ' + a.parentElement.textContent), parts: __parts(1) }; })()`);
        ok(obj.rule === 'modus ponens' && obj.matched, 'an objection\'s step is colored against the denial of its box that the check matched', J(obj));
        ok(runs(obj.parts, /^ic-c/).join(' ') === 'it is not the case that M1' && !obj.parts.some(p => /ic-u|ic-cn/.test(p)),
            'so "it is not the case that M1" goes on to it -- not dimmed as unused, not underlined as denied -- its link with it', J(obj));
        ok(J(runs(obj.parts, /ic-neg/)) === J(['it is not the case that']),
            '"it is not the case that", which denies the box it attacks, red (r27.104)', J(obj.parts));
        ok(J(obj.links) === J(['ic ic-k0: O1', 'ic ic-c: it is not the case that M1']),
            'a link and the words beside it of its color are one piece, the red words in it too: two tints that meet leave no line between them (r27.104, r27.106)', J(obj.links));
        const pre = paint(["If babies think, then pre-linguistic humans don't lack minds.", 'Babies think.'], 'Pre-linguistic humans lack minds.', 'objection');
        ok(pre.rule === 'modus ponens' && runs(pre.boxes[0], /^ic-c/).join(' ') === "pre-linguistic humans don't lack minds" && !pre.boxes[0].some(p => /ic-cn/.test(p)) &&
            J(runs(pre.boxes[0], /ic-neg/)) === J(["don't"]),
            'a part that says what the conclusion says goes on plain, however its denial is worded -- the denial red', J(pre));
        const mt = paint(['If zombies are possible, then physicalism is false.', 'Physicalism is not false.'], 'Zombies are not possible.');
        ok(mt.rule === 'modus tollens' && runs(mt.boxes[0], /ic-cn/).join(' ') === 'zombies are possible', 'one that the conclusion denies is still underlined as denied', J(mt));
        // No denial of its own: the word that opposes the box's (r27.104).
        const have = paint(['Pre-linguistic humans have minds.'], 'Pre-linguistic humans lack minds.', 'objection');
        const truth = paint(['If physics is complete, then physicalism is true.', 'Physics is complete.'], 'Physicalism is false.', 'objection');
        const sad = paint(['Mary is sad.'], 'Mary is happy.', 'objection');
        ok(J(runs(have.boxes[0], /ic-neg/)) === J(['have']) && J(runs(truth.boxes[0], /ic-neg/)) === J(['true']) && J(runs(sad.boxes[0], /ic-neg/)) === J(['sad']),
            'denying the box with a word, no denial: that word red -- "have" against "lack", "true" against "false", "sad" against "happy"', J([have, truth, sad]));
        const weak = paint(['If physics is complete, then it is not established that physicalism is false.', 'Physics is complete.'], 'Physicalism is false.', 'weak-objection');
        const support = paint(['If zombies are possible, then it is not the case that physicalism is true.', 'Zombies are possible.'], 'It is not the case that physicalism is true.');
        ok(!weak.boxes[0].some(p => /ic-neg/.test(p)) && !support.boxes[0].some(p => /ic-neg/.test(p)),
            'not a weak objection\'s, which does not deny the box; nor a support\'s', J([weak, support]));
        const sameWords = ['If physics is complete, then physicalism is true.', 'Physics is complete.'];
        const strong = paint(sameWords, 'Physicalism is false.', 'objection'), weakSame = paint(sameWords, 'Physicalism is false.', 'weak-objection');
        ok(strong.boxes[0].some(p => /ic-neg/.test(p)) && weakSame.rule && !weakSame.boxes[0].some(p => /ic-neg/.test(p)),
            'the same boxes as a weak objection, after as an objection: told apart', J([strong, weakSame]));
    }

    console.log('\n-- (r27.105) a denial of the box attacked, however worded; a claim without one against a box with one --');
    {
        // The user, 2026-10-14: "I think "not" in "not S1" should be red";
        // "We should probably give the same treatment to all the negation
        // locutions ("it's not the case that", "is not the case", "is
        // false", "is false that", etc.)"; and "What do you suggest when we
        // have a negated parent and a non-negated child?"
        const attack = second => val(`(function () {
            __load([{ id: 'M', type: 'contention', texts: ['The machine can think.'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'S', type: 'support', texts: ['If the computer fools the investigator, then the machine can think.'], collapsed: [], children: [
                    { id: 'A', type: 'objection', texts: ["Computers can't be minds.", ${J(second)}], collapsed: [], children: [] }] }] }]);
            if (!inferenceColorsOn) cycleInferenceColors(); else refreshDerivationTags();
            const st = collectDeductiveSteps(state.trees, null).find(s => s.childId === 'A');
            return { rule: st && st.rule ? st.rule.name : null, parts: __parts(1) }; })()`);
        const wordings = { 'not': 'not [S1](#box:S)', "it's not the case that": "it's not the case that [S1](#box:S)",
            'it is false that': 'it is false that [S1](#box:S)', "it isn't true that": "it isn't true that [S1](#box:S)",
            'is false': '[S1](#box:S) is false', 'is not the case': '[S1](#box:S) is not the case',
            'is untrue': '[S1](#box:S) is untrue', "isn't true": "[S1](#box:S) isn't true" };
        const linked = Object.keys(wordings).map(k => {
            const r = attack("If computers can't be minds, then " + wordings[k] + '.');
            return { k, rule: r.rule, red: runs(r.parts, /ic-neg/), green: runs(r.parts, /^ic-c/).join(' ') };
        });
        ok(linked.every(g => g.rule === 'modus ponens' && J(g.red) === J([g.k]) && g.green.includes('S1') && g.green.includes(g.k)),
            'the box denied whole, the denial before its link or after it: the denial red, the link green with it ("not" in "not S1" had stayed green)', J(linked));
        // Found by the box's own words, where it is read with a pronoun for
        // its referent ("identifying it", read as "identifying the computer").
        const said = val(`(function () {
            __load([{ id: 'M', type: 'contention', texts: ['The machine can think.'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'S', type: 'support', texts: ['If the computer is able to fool the investigator into identifying it as human, then the machine can think.'], collapsed: [], children: [
                    { id: 'A', type: 'objection', texts: ["Computers can't be minds.", "If computers can't be minds, then not [S1](#box:S)."], collapsed: [], children: [] }] }] }]);
            if (!inferenceColorsOn) cycleInferenceColors(); else refreshDerivationTags();
            const st = collectDeductiveSteps(state.trees, null).find(s => s.childId === 'A');
            return { stretches: icPlan(st)[1].stretches.map(x => x.words), parts: __parts(1) }; })()`);
        ok(said.stretches.length === 1 && /identifying it as human/.test(said.stretches[0]) && J(runs(said.parts, /ic-neg/)) === J(['not']),
            'the stretch is found by the box\'s own words -- "identifying it", which is read as "identifying the computer"', J(said));
        const written = [["it's not the case that God exists", "it's not the case that"], ["'God exists' is false", 'is false'],
            ['the proposition that God exists is false', 'is false'], ['it is untrue that God exists', 'it is untrue that']]
            .map(([t, want]) => { const r = paint(['If physics is complete, then ' + t + '.', 'Physics is complete.'], 'God exists.', 'objection');
                return { t, want, rule: r.rule, red: runs(r.boxes[0], /ic-neg/) }; });
        ok(written.every(x => x.rule === 'modus ponens' && J(x.red) === J([x.want])), 'written out, each wording is one denial, red whole: "it\'s not the case that", not its "not" alone', J(written));
        const mt = paint(['If zombies are possible, then physicalism is false.', 'Physicalism is not false.'], 'Zombies are not possible.');
        ok(mt.rule === 'modus tollens' && J(runs(mt.boxes[1], /ic-neg/)) === J(['is not']) && J(runs(mt.boxes[0], /ic-neg/)) === J(['are']),
            '"is not false" is two denials, "is false" one: the outer one red, "is not"; and "are" in "zombies are possible", which "zombies are not possible" denies (r27.112)', J(mt));
        // r27.112 (the user: "I think we should always make the contradictory
        // part of a red-underlined conclusion red (as in the modus tollens
        // picture attached)"; "So there, 'is' would be red").
        const pleasure = paint(["If pleasure is the only good, then no one could rationally choose not to plug into the experience machine.",
            'Someone could rationally choose not to plug into the experience machine.'], 'Pleasure is not the only good.');
        const rain = paint(['If it does not rain, then the ground is dry.', 'The ground is not dry.'], 'It rains.');
        ok(pleasure.rule === 'modus tollens' && J(runs(pleasure.boxes[0], /ic-neg/)) === J(['is', 'no']) && runs(pleasure.boxes[0], /ic-cn/).join(' ') === 'pleasure is the only good' &&
            rain.rule === 'modus tollens' && J(runs(rain.boxes[0], /ic-cn ic-neg/)) === J(['does not']),
            'a part that goes on denied: what the conclusion contradicts is red -- "is" in "pleasure is the only good", against "pleasure is not the only good"; "does not" in "it does not rain", against "it rains"',
            J([pleasure.boxes[0], rain.boxes[0]]));
        const plain = [['God exists', 'God does not exist.', 'exists'], ['some ravens are white', 'No ravens are white.', 'some'],
            ['there is a God', 'There is no God.', 'is'], ['Socrates is mortal', 'Socrates is not mortal.', 'is'],
            ['computers can think', "Computers can't think.", 'can'], ['all ravens are black', 'Not all ravens are black.', 'all']]
            .map(([t, box, want]) => { const r = paint(['If physics is complete, then ' + t + '.', 'Physics is complete.'], box, 'objection');
                return { t, want, rule: r.rule, red: runs(r.boxes[0], /ic-neg/) }; });
        ok(plain.every(x => x.rule === 'modus ponens' && J(x.red) === J([x.want])),
            'a claim with no denial against a box with one: the word stressed in saying it back is red -- its verb, the first word of what it says, or its quantifier', J(plain));
        const both = paint(['If physics is complete, then it rains and it snows.', 'Physics is complete.'], 'It is not the case that both it rains and it snows.', 'objection');
        const lack = paint(['If babies think, then pre-linguistic humans lack minds.', 'Babies think.'], "Pre-linguistic humans don't lack minds.", 'objection');
        ok(both.rule === 'modus ponens' && !both.boxes[0].some(p => /ic-neg/.test(p)) && lack.rule === 'modus ponens' && J(runs(lack.boxes[0], /ic-neg/)) === J(['lack']),
            'nothing in a compound ("it rains and it snows" against its denial); "lack" against "don\'t lack", which has no word against it', J([both, lack]));
    }

    console.log('\n-- (r27.106) a part one piece with its red words; a later condition\'s "if"; quotation marks --');
    {
        // The user, 2026-10-14: "Still getting this gap" -- the green line
        // broken at the space between a red "not" and the link "S1" -- and, of
        // the "if" of "if it rains, then the game is off" left uncolored:
        // "Fix both."
        const piece = val(`(function () {
            __load([{ id: 'M', type: 'contention', texts: ['The machine can think.'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'S', type: 'support', texts: ['If the computer fools the investigator, then the machine can think.'], collapsed: [], children: [
                    { id: 'A', type: 'objection', texts: ["Computers can't be minds.", "If computers can't be minds, then not [S1](#box:S)."], collapsed: [], children: [] }] }] }]);
            if (!inferenceColorsOn) cycleInferenceColors(); else refreshDerivationTags();
            const rd = document.querySelector('.node[data-node-id="A"][data-node-idx="1"] .rendered-text');
            const red = rd.querySelector('span.ic-neg'), part = red && red.parentElement;
            return { red: red && red.className + ': ' + red.textContent, part: part && part.className + ': ' + part.textContent, link: !!part && !!part.querySelector('a.box-link') }; })()`);
        ok(piece.red === 'ic ic-neg: not' && piece.part === 'ic ic-c: not S1' && piece.link,
            'a red word is a span inside its part\'s: "not S1" is one piece, its line and tint unbroken at the space between the red "not" and the link', J(piece));
        const dim = val(`(function () {
            const rd = document.createElement('div'); rd.className = 'rendered-text'; rd.textContent = 'The dog did not bark.';
            document.body.appendChild(rd);
            icPaint(rd, { parts: [{ words: 'the dog did not bark', cls: 'ic-u', contra: 1 }], keep: {}, spans: [] });
            const out = Array.from(rd.querySelectorAll('span.ic')).map(s => s.className + (s.parentElement.closest('span.ic') ? ' (inside)' : '') + ': ' + s.textContent);
            rd.remove(); return out; })()`);
        ok(J(dim) === J(['ic ic-u: The dog ', 'ic ic-u ic-neg: did not', 'ic ic-u:  bark', 'ic ic-rest: .']),
            'in a dimmed part a red word stays a span of its own, so that it is never dimmed', J(dim));
        const late = paint(['If physics is complete, then if it rains, then the game is off.', 'Physics is complete.'], 'It is false that if it rains, then the game is off.', 'objection');
        const lateNoThen = paint(['If physics is complete, then if it rains, the game is off.', 'Physics is complete.'], 'It is false that if it rains, the game is off.', 'objection');
        ok(late.rule === 'modus ponens' && runs(late.boxes[0], /^ic-c/).join(' ') === 'if it rains, then the game is off' &&
            lateNoThen.rule === 'modus ponens' && runs(lateNoThen.boxes[0], /^ic-c/).join(' ') === 'if it rains, the game is off',
            'a later condition that goes on alone keeps its "if"; the "then" before it, the first condition\'s, does not go on', J([late, lateNoThen]));
        const quoted = ["'God exists' is false", '‘God exists’ is false'].map(t => paint(['If physics is complete, then ' + t + '.', 'Physics is complete.'], 'God exists.', 'objection'));
        ok(quoted.every((q, i) => q.rule === 'modus ponens' && runs(q.boxes[0], /^ic-c/).join(' ') === (i ? '‘God exists’ is false' : "'God exists' is false")),
            'a single quotation mark, straight or curly, goes on with the words it opens, as the one that closes them does', J(quoted));
        const really = paint(['If physics is complete, then God really exists.', 'Physics is complete.'], 'God does not exist.', 'objection');
        ok(really.rule === 'modus ponens' && runs(really.boxes[0], /^ic-c/).join(' ') === 'God really exists' && J(runs(really.boxes[0], /ic-neg/)) === J(['exists']),
            '"God really exists" against "God does not exist": certified, "really" in the green, "exists" red', J(really));
        const fails = paint(['If Poe is a raven, then Poe flies.', 'Poe fails to fly.'], 'Poe is not a raven.');
        ok(fails.rule === 'modus tollens' && J(runs(fails.boxes[1], /ic-neg/)) === J(['fails to']),
            '"Poe fails to fly", read as "Poe does not fly", denies "Poe flies": "fails to" red', J(fails));
    }

    console.log('\n-- (r27.107) a premise linked into another box of its own step --');
    {
        // The user, 2026-10-15: with the antecedent the link O1, "the 'not'
        // in O2 doesn't turn red, and the conclusion doesn't validate".
        const o2 = val(`(function () {
            __load([{ id: 'M', type: 'contention', texts: ['If the computer is able to fool the investigator into identifying it as human approximately as often as the woman was able to fool the investigator into identifying her as a man, then we should conclude that the machine can think.'], collapsed: [], x: 30000, y: 30000, children: [
                { id: 'A', type: 'objection', texts: ["Computers can't be minds.", 'If [O1](#box:A), then not [M1](#box:M).'], collapsed: [], children: [] }] }]);
            if (!inferenceColorsOn) cycleInferenceColors(); else refreshDerivationTags();
            const st = collectDeductiveSteps(state.trees, null).find(s => s.childId === 'A');
            return { tag: st ? deductiveStepTagText(st) : null, parts: __parts(1) }; })()`);
        ok(o2.tag === '✓ modus ponens' && J(runs(o2.parts, /ic-neg/)) === J(['not']) && runs(o2.parts, /^ic-c/).join(' ') === 'not M1',
            '"If O1, then not M1", O1 the box beside it: certified, "not M1" green, "not" red', J(o2));
    }

    console.log('\n-- (r27.123) every premise of a certified step placed, in pieces where it must be --');
    {
        // The user: "is the proposition highlighter working for all types of
        // propositions? I want to make sure that both are rigorous." A premise
        // none of whose clauses the painter could place had been painted whole,
        // as if all of it went on: an identity, a part of a phrase, contraries,
        // a verb's object. Whole is right only where the premise is another
        // wording of the conclusion.
        const EQUIVALENT = new Set(['double-negation elimination', 'quantifier negation', 'Quantifier Commutation', 'change of bound variable', 'commutation',
            'association', 'idempotence', 'conversion', 'contraposition', 'De Morgan’s laws', 'transposition', 'material implication', 'material equivalence',
            'exportation', 'Negated Conditional', 'Negated Biconditional', 'distribution', 'Boolean absorption', '⊥ laws', 'rules of passage']);
        const CATALOG = [
            [['Poe is black.', 'Poe is a raven.'], 'Poe is black and Poe is a raven.'], [['Poe is black and Poe is a raven.'], 'Poe is black.'],
            [['Poe is a black raven.'], 'Poe is black.'], [['Poe is a black raven.'], 'Poe is a raven.'], [['Poe is black and old.'], 'Poe is old.'],
            [['Poe is black.'], 'Poe is black or Poe is white.'], [['Poe is black or Poe is white.', 'Poe is not black.'], 'Poe is white.'],
            [['It is not the case that both Poe is black and Poe is white.', 'Poe is black.'], 'Poe is not white.'],
            [['Poe is not both black and white.', 'Poe is black.'], 'Poe is not white.'],
            [['Poe is black or Poe is white.', 'Poe is not black or Poe is old.'], 'Poe is white or Poe is old.'],
            [['Poe is black.', 'Poe is not black.'], 'The moon is cheese.'],
            [['If it rains, then the street is wet.', 'It rains.'], 'The street is wet.'],
            [['If it rains and it is cold, then it snows.', 'It rains.', 'It is cold.'], 'It snows.'],
            [['If it rains, then the street is wet.', 'The street is not wet.'], 'It does not rain.'],
            [['If it rains, then the street is wet.', 'If the street is wet, then the game is off.'], 'If it rains, then the game is off.'],
            [['It rains or it snows.', 'If it rains, then the game is off.', 'If it snows, then the game is off.'], 'The game is off.'],
            [['It rains if and only if the street is wet.', 'It rains.'], 'The street is wet.'],
            [['If it rains, then the street is wet.', 'If the street is wet, then it rains.'], 'It rains if and only if the street is wet.'],
            [['If it rains, then the street is wet.', 'If it rains, then the street is not wet.'], 'It does not rain.'],
            [['Socrates is a man.'], 'Something is a man.'], [['Poe is a black raven.'], 'There is a black raven.'], [['Everything is physical.'], 'Poe is physical.'],
            [['All men are mortal.', 'Socrates is a man.'], 'Socrates is mortal.'], [['All men are mortal.', 'Zeus is not mortal.'], 'Zeus is not a man.'],
            [['All ravens are birds.', 'All birds are animals.'], 'All ravens are animals.'], [['Some ravens are black.', 'All black things are dark.'], 'Some ravens are dark.'],
            [['No ravens are fish.', 'Some birds are ravens.'], 'Some birds are not fish.'], [['Everything is physical.'], 'Something is physical.'],
            [['Mark Twain is Samuel Clemens.'], 'Samuel Clemens is Mark Twain.'],
            [['Mark Twain is Samuel Clemens.', 'Samuel Clemens is the author of Huck Finn.'], 'Mark Twain is the author of Huck Finn.'],
            [['Mark Twain is Samuel Clemens.', 'Mark Twain wrote Huckleberry Finn.'], 'Samuel Clemens wrote Huckleberry Finn.'],
            [['Bob is tall.'], 'Bob is not short.'], [['Bob is alive.'], 'Bob is not dead.'],
            [['Bob hit a poodle.', 'Every poodle is a dog.'], 'Bob hit a dog.'], [['Poe loves every raven.', 'Fido is a raven.'], 'Poe loves Fido.'],
            [['Poe loves Fido and Fido is a raven.'], 'Poe loves a raven.'], [['Poe loves everything.'], 'Poe loves Fido.'],
            [['Poe loves every raven.', 'Poe does not love Fido.'], 'Fido is not a raven.'],
            [['P → Q', 'P'], 'Q'], [['P → Q', '¬Q'], '¬P'], [['P ∧ Q'], 'Q'], [['P'], 'P ∨ Q'], [['P ∨ Q', '¬P'], 'Q'],
            [['∀x (F(x) → G(x))', 'F(a)'], 'G(a)'], [['a = b', 'F(a)'], 'F(b)'], [['a = b'], 'b = a'], [['a = b', 'b = c'], 'a = c']];
        const unplaced = CATALOG.map(([p, c]) => [p, c, val(`(function () { __load(${J(step(p, c))}); const st = collectDeductiveSteps(state.trees, null)[0];
            const plan = st && st.rule ? icPlan(st) : null; return { rule: st && st.rule ? st.rule.name : null, whole: plan ? plan.map(x => !!x.whole) : null }; })()`)])
            .filter(([, , r]) => !r.rule || (r.whole.some(Boolean) && !EQUIVALENT.has(r.rule)));
        ok(!unplaced.length, 'each premise of every certified step placed (' + CATALOG.length + ' steps, a rule or two each), but where it is another wording of the conclusion', J(unplaced));
        const notNot = val(`(function () { __load(${J(step(['Poe is not not black.'], 'Poe is black.'))}); const st = collectDeductiveSteps(state.trees, null)[0];
            return st && st.rule ? { rule: st.rule.name, whole: icPlan(st).map(x => x.whole) } : null; })()`);
        ok(notNot && notNot.rule === 'double-negation elimination' && J(notNot.whole) === J([true]),
            '... and the plan says where a premise is painted whole: "not not black", another wording of "black"', J(notNot));
        const twain = paint(['Mark Twain is Samuel Clemens.', 'Mark Twain wrote Huckleberry Finn.'], 'Samuel Clemens wrote Huckleberry Finn.');
        ok(twain.rule === 'identity substitution' && J(runs(twain.boxes[0], /^ic-k/)) === J(['Mark Twain']) && J(runs(twain.boxes[0], /^ic-c/)) === J(['Samuel Clemens']) &&
            J(runs(twain.boxes[1], /^ic-k/)) === J(['Mark Twain']) && J(runs(twain.boxes[1], /^ic-c/)) === J(['wrote Huckleberry Finn']),
            'an identity: the name the premises share meets, the other name and what is said of the first go on', J(twain));
        const raven = paint(['Poe is a black raven.'], 'Poe is black.');
        ok(raven.rule === 'conjunction elimination' && J(runs(raven.boxes[0], /^ic-c/)) === J(['Poe', 'black']) && J(runs(raven.boxes[0], /^ic-u/)) === J(['raven']),
            'a part of a phrase: "Poe" and "black" go on, "raven" dimmed', J(raven));
        const intro = paint(['Poe is a black raven.'], 'There is a black raven.');
        ok(intro.rule === 'existential introduction' && J(runs(intro.boxes[0], /^ic-u/)) === J(['Poe']) && J(runs(intro.boxes[0], /^ic-c/)) === J(['is a black raven']),
            'something is so: what is said goes on, the name it was said of dimmed', J(intro));
        const ump = paint(['Poe loves every raven.', 'Fido is a raven.'], 'Poe loves Fido.');
        ok(ump.rule === 'universal modus ponens' && J(runs(ump.boxes[0], /^ic-k/)) === J(['every raven']) && J(runs(ump.boxes[0], /^ic-c/)) === J(['Poe loves']) &&
            J(runs(ump.boxes[1], /^ic-k/)) === J(['is a raven']) && J(runs(ump.boxes[1], /^ic-c/)) === J(['Fido']),
            'a verb\'s object: "every raven" meets "is a raven", "Poe loves" and "Fido" go on', J(ump));
        const umt = paint(['Poe loves every raven.', 'Poe does not love Fido.'], 'Fido is not a raven.');
        ok(umt.rule === 'universal modus tollens' && umt.boxes[0].includes('ic-c ic-cn: every raven') && J(runs(umt.boxes[1], /ic-neg/)) === J(['does not']) &&
            J(runs(umt.boxes[1], /^ic-c/)) === J(['Fido']),
            '... and back: "every raven" goes on denied, "does not" red against "loves"', J(umt));
        const sym = paint(['a = b', 'b = c'], 'a = c');
        ok(sym.rule === 'identity transitivity' && J(runs(sym.boxes[0], /^ic-c/)) === J(['a']) && J(runs(sym.boxes[0], /^ic-k/)) === J(['b']) &&
            J(runs(sym.boxes[1], /^ic-k/)) === J(['b']) && J(runs(sym.boxes[1], /^ic-c/)) === J(['c']),
            'in symbols too: "a = b", "b = c" -- they had no words to color', J(sym));
        const both = paint(['Poe is not both black and white.', 'Poe is black.'], 'Poe is not white.');
        ok(both.rule === 'conjunctive syllogism' && J(runs(both.boxes[0], /^ic-k/)) === J(['black']) && runs(both.boxes[0], /^ic-c/).includes('white') &&
            J(runs(both.boxes[1], /^ic-k/)) === J(['is black']),
            '"not both black and white": "black" meets the premise that says it, "white" goes on', J(both));
    }

    console.log('\n-- (r27.133) a kind in its parts; "only"; words two clauses share; a kind going on denied --');
    {
        // The class of the part of a box whose words are `w`.
        const k = (b, w) => (b.find(p => p.slice(p.indexOf(': ') + 2).trim() === w) || '').split(': ')[0];
        // A kind with parts, where it meets nothing whole: "whoever" (a
        // person) and "can vote", "every raven" and "sings" -- they had been
        // dimmed.
        const who = paint(['Whoever can vote is a citizen.', 'Bob is a person.', 'Bob can vote.'], 'Bob is a citizen.');
        ok(who.rule === 'universal modus ponens' && /^ic-k\d$/.test(k(who.boxes[0], 'Whoever')) && /^ic-k\d$/.test(k(who.boxes[0], 'can vote')) &&
            k(who.boxes[0], 'Whoever') !== k(who.boxes[0], 'can vote') && k(who.boxes[0], 'Whoever') === k(who.boxes[1], 'is a person') &&
            k(who.boxes[0], 'can vote') === k(who.boxes[2], 'can vote') && J(runs(who.boxes[0], /^ic-c/)) === J(['is a citizen']),
            '"Whoever can vote": "whoever" meets "is a person", "can vote" meets "can vote", each in its own color', J(who));
        const sings = paint(['Every raven that sings is black.', 'Poe is a raven.', 'Poe sings.'], 'Poe is black.');
        ok(J(runs(sings.boxes[0], /^ic-k/)) === J(['Every raven', 'sings']) && k(sings.boxes[0], 'Every raven') === k(sings.boxes[1], 'is a raven') &&
            k(sings.boxes[0], 'sings') === k(sings.boxes[2], 'sings') && runs(sings.boxes[0], /^ic-rest/).includes('that'),
            '"Every raven that sings": "every raven" and "sings" meet the premises that say them, "that" between them', J(sings));
        const whole = paint(['Every raven that sings is black.', 'Poe is a raven that sings.'], 'Poe is black.');
        ok(J(runs(whole.boxes[0], /^ic-k0/)) === J(['Every raven that sings']) && J(runs(whole.boxes[1], /^ic-k0/)) === J(['is a raven that sings']) &&
            J(runs(whole.boxes[1], /^ic-c/)) === J(['Poe']),
            '... and whole where a premise says it whole: "is a raven that sings" (it had been dimmed)', J(whole));
        // Said in another order than its reading's.
        const only = paint(['Only citizens can vote.', 'Bob can vote.'], 'Bob is a citizen.');
        const none = paint(['None but citizens can vote.', 'Bob can vote.'], 'Bob is a citizen.');
        ok(only.rule === 'universal modus ponens' && J(only.boxes[0]) === J(['ic-rest: Only ', 'ic-c: citizens', 'ic-rest:  ', 'ic-k0: can vote', 'ic-rest: .']) &&
            J(runs(none.boxes[0], /^ic-c/)) === J(['citizens']) && J(runs(none.boxes[0], /^ic-k0/)) === J(['can vote']),
            '"Only citizens can vote", "None but citizens can vote": "can vote" meets, "citizens" goes on (they had gone uncolored)', J([only, none]));
        const raven = paint(['If something is a raven, then it is black.', 'Poe is a raven.'], 'Poe is black.');
        ok(J(runs(raven.boxes[0], /^ic-k0/)) === J(['is a raven']) && J(runs(raven.boxes[0], /^ic-c/)) === J(['is black']),
            '"If something is a raven, then it is black": "is a raven" meets, "is black" goes on (it had gone uncolored)', J(raven));
        // Words two clauses share: "Bob left" had taken all of "Bob and Mary
        // left", and "Mary left" had gone unfound.
        const mary = paint(['Bob and Mary left.'], 'Mary left.'), bob = paint(['Bob and Mary left.'], 'Bob left.');
        ok(J(runs(mary.boxes[0], /^ic-u/)) === J(['Bob']) && J(runs(mary.boxes[0], /^ic-c/)) === J(['Mary left']) &&
            J(runs(bob.boxes[0], /^ic-c/)) === J(['Bob', 'left']) && J(runs(bob.boxes[0], /^ic-u/)) === J(['Mary']) && runs(bob.boxes[0], /^ic-rest/).includes('and'),
            '"Bob and Mary left": for "Mary left", "Mary left" goes on and "Bob" is dimmed; for "Bob left", "Bob" and "left" go on, "Mary" dimmed, "and" between', J([mary, bob]));
        const danced = paint(['Bob sang and danced.'], 'Bob danced.');
        ok(J(runs(danced.boxes[0], /^ic-c/)) === J(['Bob', 'danced']) && J(runs(danced.boxes[0], /^ic-u/)) === J(['sang']),
            '"Bob sang and danced": "Bob" and "danced" go on, "sang" dimmed', J(danced));
        const list = paint(['Bob is tall, rich and happy.'], 'Bob is rich.'), cy = paint(['Bob, Al and Cy left.'], 'Al left.');
        ok(J(runs(list.boxes[0], /^ic-c/)) === J(['Bob is', 'rich']) && J(runs(list.boxes[0], /^ic-u/)) === J(['tall', 'happy']) &&
            J(runs(cy.boxes[0], /^ic-c/)) === J(['Al', 'left']) && J(runs(cy.boxes[0], /^ic-u/)) === J(['Bob', 'Cy']),
            'a list: "Bob is ... rich" goes on, "tall" and "happy" dimmed; "Bob, Al and Cy left": "Bob" found once the others are, past them', J([list, cy]));
        const or = paint(['Either Bob or Al is guilty.', 'Bob is not guilty.'], 'Al is guilty.');
        ok(J(runs(or.boxes[0], /^ic-k0/)) === J(['Bob']) && J(runs(or.boxes[0], /^ic-c/)) === J(['Al is guilty']),
            '"Either Bob or Al is guilty": "Bob" meets "Bob is not guilty", "Al is guilty" goes on -- a word two parts share in the color of the one that goes on', J(or));
        const both = paint(['Bob and Al did not both leave.', 'Bob left.'], 'Al did not leave.');
        ok(J(runs(both.boxes[0], /^ic-k0/)) === J(['Bob']) && runs(both.boxes[0], /^ic-rest/).includes('not both') && runs(both.boxes[0], /ic-cn/)[0] === 'Al',
            '"Bob and Al did not both leave": "Bob" meets "Bob left", "Al ... leave" goes on denied, and "not both", between the words of both, belongs to neither', J(both));
        // A kind the conclusion denies goes on denied, as modus tollens's "if" part does.
        const umt = paint(['Every raven is black.', 'Poe is not black.'], 'Poe is not a raven.');
        const onlyMT = paint(['Only citizens can vote.', 'Bob is not a citizen.'], 'Bob cannot vote.');
        ok(umt.rule === 'universal modus tollens' && umt.boxes[0][0] === 'ic-c ic-cn: Every raven' && J(runs(onlyMT.boxes[0], /ic-cn/)) === J(['can vote']),
            '"Every raven" in "Every raven is black", with "Poe is not a raven", goes on denied (it went on plain); "can vote" in "Only citizens can vote", with "Bob cannot vote"', J([umt, onlyMT]));
    }

    console.log('\n-- (r27.141) a subject said once, read twice; words dropped --');
    {
        // "Bob" had been dimmed with "who is rich", as if it were none of "Bob can pay".
        const rich = paint(['Bob, who is rich, can pay.'], 'Bob can pay.'), doctor = paint(['Bob, a doctor, can pay.'], 'Bob can pay.');
        const twain = paint(['Mark Twain, a writer, was funny.'], 'Mark Twain was funny.');
        ok(rich.rule === 'conjunction elimination' && J(rich.boxes[0]) === J(['ic-c: Bob', 'ic-u: , who is rich', 'ic-rest: , ', 'ic-c: can pay', 'ic-rest: .']) &&
            J(runs(doctor.boxes[0], /^ic-c/)) === J(['Bob', 'can pay']) && J(runs(doctor.boxes[0], /^ic-u/)) === J([', a doctor']) &&
            J(runs(twain.boxes[0], /^ic-c/)) === J(['Mark Twain', 'was funny']),
            '"Bob, who is rich, can pay", with "Bob can pay": "Bob" goes on with "can pay", "who is rich" dimmed (it had dimmed "Bob" too); "Bob, a doctor,"; "Mark Twain" one stretch',
            J([rich, doctor, twain]));
        // A step that drops words: "ran quickly" had been dimmed whole.
        const ran = paint(['Bob ran quickly.'], 'Bob ran.'), tall = paint(['Bob is very tall.'], 'Bob is tall.'), store = paint(['Bob quickly ran to the store.'], 'Bob ran to the store.');
        const glad = paint(['Bob is glad that Mary left.'], 'Bob is glad.');
        ok(ran.rule === 'dropping a modifier' && J(runs(ran.boxes[0], /^ic-c/)) === J(['Bob ran']) && J(runs(ran.boxes[0], /^ic-u/)) === J(['quickly']) &&
            J(runs(tall.boxes[0], /^ic-c/)) === J(['Bob is', 'tall']) && J(runs(tall.boxes[0], /^ic-u/)) === J(['very']) &&
            J(runs(store.boxes[0], /^ic-c/)) === J(['Bob', 'ran to the store']) && J(runs(store.boxes[0], /^ic-u/)) === J(['quickly']),
            'a modifier dropped: "Bob ran" goes on, "quickly" dimmed (it had dimmed "ran quickly"); "very" in "very tall"; "quickly" before the verb', J([ran, tall, store]));
        ok(glad.rule === 'dropping a \u2018that\u2019 clause' && J(runs(glad.boxes[0], /^ic-c/)) === J(['Bob is glad']) && J(runs(glad.boxes[0], /^ic-u/)) === J(['that Mary left']),
            'a "that" clause dropped: "Bob is glad" goes on, "that Mary left" dimmed', J(glad));
    }

    console.log('\n-- (r27.145) a name in capitals; "a student", the conclusion\'s "the student" --');
    {
        const nasa = paint(['Every agency is funded.', 'NASA is an agency.'], 'NASA is funded.');
        ok(J(runs(nasa.boxes[1], /^ic-c/)) === J(['NASA']) && J(runs(nasa.boxes[1], /^ic-k0/)) === J(['is an agency']),
            '"NASA" goes on as "Poe" would (the reader\'s mark for each capital had split it into letters, and it went uncolored)', J(nasa));
        const stu = paint(['Every student that cheats will be caught.', 'A student cheats.'], 'The student will be caught.');
        ok(stu.rule === 'universal modus ponens' && J(runs(stu.boxes[1], /^ic-c/)) === J(['A student']) && J(runs(stu.boxes[1], /^ic-k0/)) === J(['cheats']) &&
            J(runs(stu.boxes[0], /^ic-k0/)) === J(['Every student that cheats']),
            '"A student" goes on as "the student", and "cheats" meets "every student that cheats"', J(stu));
    }

    console.log('\n-- (r27.149) a pronoun its quantifier binds; "everyone who cheats", "a person who cheats" --');
    {
        const smart = paint(['Every student believes that they are smart.', 'Bob is a student.'], 'Bob believes that he is smart.');
        const mother = paint(['Every student loves their mother.', 'Bob is a student.'], 'Bob loves his mother.');
        ok(smart.rule === 'universal modus ponens' && J(runs(smart.boxes[0], /^ic-c/)) === J(['believes that they are smart']) && J(runs(smart.boxes[0], /^ic-k0/)) === J(['Every student']) &&
            J(runs(mother.boxes[0], /^ic-c/)) === J(['loves their mother']),
            '"believes that they are smart" goes on as "believes that he is smart", "every student" meets "is a student"; "loves their mother" too', J([smart, mother]));
        const cheat = paint(['Everyone who cheats will lose.', 'Bob is a person who cheats.'], 'Bob will lose.');
        ok(J(runs(cheat.boxes[0], /^ic-k0/)) === J(['Everyone who cheats']) && J(runs(cheat.boxes[1], /^ic-k0/)) === J(['is a person who cheats']),
            '"everyone who cheats" meets "is a person who cheats" (the two had been dimmed: the kind was spelled two ways)', J(cheat));
    }

    console.log('\n-- (r27.152) "something is a dog and a pet" is "some dog is a pet" --');
    {
        const mp = paint(['If some dog is a pet, Bob is wrong.', 'Something is a dog and a pet.'], 'Bob is wrong.');
        ok(mp.rule === 'modus ponens' && J(runs(mp.boxes[0], /^ic-k0/)) === J(['some dog is a pet']) && J(runs(mp.boxes[1], /^ic-k0/)) === J(['Something is a dog and a pet']),
            'one claim in two wordings: "some dog is a pet" meets "Something is a dog and a pet" (the step had not been certified)', J(mp));
    }

    console.log('\n-- (r27.153) active and passive; the indirect object --');
    {
        const voice = paint(['If the book was written by Bob, Al is wrong.'], 'If Bob wrote the book, Al is wrong.');
        const to = paint(['Bob gave Mary a book.'], 'Bob gave a book to Mary.');
        ok(voice.rule === 'active and passive' && runs(voice.boxes[0], /^ic-c/).join('') === 'If the book was written by Bob, Al is wrong' && !voice.boxes[0].some(p => /ic-cn/.test(p)) &&
            to.rule === 'indirect object' && runs(to.boxes[0], /^ic-c/).join('') === 'Bob gave Mary a book' && !to.boxes[0].some(p => /ic-cn/.test(p)),
            'the clause said in the other voice goes on, not denied (it had been dimmed); likewise the indirect object moved', J([voice, to]));
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    W.dom.window.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
