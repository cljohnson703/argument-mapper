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
        window.__parts = function (j) {
            const rd = document.querySelector('.node[data-node-id="A"][data-node-idx="' + j + '"] .rendered-text');
            return Array.prototype.map.call(rd.querySelectorAll('span.ic'), s => s.className.replace(/^ic /, '') + ': ' + s.textContent);
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
        ok(mt.rule === 'modus tollens' && J(mt.boxes[0]) === J(['ic-rest: If ', 'ic-c ic-cn: the alarm went off', 'ic-rest: , then ', 'ic-k0: the dog barked']) &&
            J(mt.boxes[1]) === J(['ic-k0: The dog ', "ic-k0 ic-neg: didn't", 'ic-k0:  bark']),
            'modus tollens: "the alarm went off" goes on denied (underlined); "didn\'t" red within its part', J(mt));
        const ds = paint(['Either it is raining or it is snowing', 'It is not raining'], 'It is snowing');
        ok(ds.rule === 'disjunctive syllogism' && J(runs(ds.boxes[0], /ic-k0/)) === J(['it is raining']) && J(runs(ds.boxes[0], /^ic-c/)) === J(['it is snowing']) &&
            J(ds.boxes[1]) === J(['ic-k0: It ', 'ic-k0 ic-neg: is not', 'ic-k0:  raining']),
            'disjunctive syllogism: the disjunct denied meets its denial, one color; the other goes on', J(ds));
        const ump = paint(['All ravens are black', 'Poe is a raven'], 'Poe is black');
        ok(ump.rule === 'universal modus ponens' && J(ump.boxes[0]) === J(['ic-k0: All ravens', 'ic-rest:  are ', 'ic-c: black']) &&
            J(ump.boxes[1]) === J(['ic-c: Poe', 'ic-rest:  is ', 'ic-k0: a raven']),
            '"All ravens" colored whole, quantifier and all, meeting "a raven"; "black" and "Poe" go on', J(ump));
        const no = paint(['No ravens are white', 'Poe is a raven'], 'Poe is not white');
        ok(J(no.boxes[0]) === J(['ic-k0: No ravens', 'ic-rest:  are ', 'ic-c ic-cn: white']),
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
        ok(J(bars.boxes[0]) === J(['ic-k0: All humans', 'ic-rest:  are ', 'ic-c: mortal']) && J(bars.boxes[1]) === J(['ic-c: All Greeks', 'ic-rest:  are ', 'ic-k0: humans']),
            'a syllogism: the middle term one color in both premises', J(bars));
        const obj = paint(['If Poe is a crow, then Poe is not a raven', 'Poe is a crow'], 'Poe is a raven', 'objection');
        ok(obj.rule === 'modus ponens' && J(runs(obj.boxes[0], /^ic-c/)) === J(['Poe is not a raven']) && !obj.boxes[0].some(p => /ic-cn|ic-neg/.test(p)),
            'an objection: what it concludes is the denial of its box, so "Poe is not a raven" goes on plain -- its "not" denying no premise, not red (r27.91)', J(obj));
        const mtn = paint(["If the alarm didn't go off, then the dog was quiet", 'The dog was not quiet'], 'The alarm went off');
        ok(runs(mtn.boxes[0], /ic-cn/).join(' ') === "the alarm didn't go off", 'a denied part the conclusion affirms is underlined too', J(mtn));
        const ac = paint(['If it rains, then the ground is wet', 'The ground is wet'], 'It rains');
        ok(ac.rule === null && J(ac.boxes[0]) === J(['ic-rest: If ', 'ic-k1: it rains', 'ic-rest: , then ', 'ic-k0: the ground is wet']) && J(ac.boxes[1]) === J(['ic-k0: The ground is wet']),
            'a step not recognized: each part its own color, one part said twice one color, nothing normal', J(ac));
        const most = paint(['Most ravens are black', 'Poe is a raven'], 'Poe is black');
        ok(most.rule === null && J(most.boxes.map(b => b.map(p => p.split(': ')[0]))) === J([['ic-k0'], ['ic-k1']]), 'and premises that share nothing, a color each', J(most));
    }

    console.log('\n-- (3) words that deny --');
    {
        const neither = paint(['It is not the case that both it rains and it snows', 'It rains'], 'It does not snow');
        ok(neither.boxes[0][0] === 'ic-rest: It is not the case that both ' && /ic-c ic-cn: it snows/.test(J(neither.boxes[0])),
            '"It is not the case that" denies nothing another premise says ("It rains" is no "both"), so it is not red (r27.91); "it snows" goes on denied', J(neither));
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
        const dark = ['#5fd3e8', '#f59bc4', '#c3b1ff', '#ffd479', '#ffb38a', '#8fd0ff'];
        ok(dark.every((c, k) => new RegExp('\\.rendered-text \\.ic-k' + k + '\\s*\\{\\s*color:\\s*' + c + ';\\s*\\}').test(CSS)), 'six colors on dark boxes');
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
                return { c: cs('span.ic-c:not(.ic-neg)'), cneg: cs('span.ic-c.ic-neg'), rest: cs('span.ic-rest:not(.ic-neg)'), k0: cs('span.ic-k0:not(.ic-neg)') };
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
        ok(v2.dark.c === 'rgb(111, 191, 139) / 1 / rgba(0, 0, 0, 0)' && / \/ 1 \/ /.test(v2.dark.rest || '') && /^rgb\(95, 211, 232\) \/ 1 \//.test(v2.dark.k0 || ''),
            'colors 2: what goes on to the conclusion green (#6fbf8b), the words around it not dimmed, meetings in their colors', J(v2.dark));
        const red2 = val(`(function () {
            const cs = sel => { const x = document.querySelector('.node[data-node-id="A"] .rendered-text ' + sel); if (!x) return null; const c = getComputedStyle(x); return c.color + ' / ' + c.opacity + ' / ' + c.backgroundColor; };
            if (inferenceColorsOn) { inferenceColorsOn = false; syncInferenceColorsButton(); }
            cycleInferenceColors(); cycleInferenceColors();
            __load(${J(step(['The dog did not bark', 'If the dog barked, then the alarm went off'], 'The dog did not bark, and if the dog barked, then the alarm went off'))});
            const dark = cs('span.ic-c.ic-neg');
            document.body.classList.add('nodes-light'); refreshDerivationTags();
            const light = cs('span.ic-c.ic-neg');
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
        ok(J(dm.boxes[0]) === J(['ic-c: It is not the case that both ', 'ic-c ic-cn: it rains', 'ic-c:  and ', 'ic-c ic-cn: it snows']),
            'a denied stretch: its "it is not the case that" plain, denying no premise (r27.91); each part the conclusion denies still underlined', J(dm));
        const ac = paint(['If it rains, then the ground is wet', 'The ground is wet'], 'It rains');
        ok(ac.rule === null && !ac.boxes.some(b => b.some(p => /^ic-c(?![a-z-])/.test(p.split(': ')[0]))), 'not valid yet: no stretch, each part its own color', J(ac));
        const kind = paint(['All ravens that live in cities are black', 'Poe is a raven that lives in a city'], 'Poe is black');
        ok(J(kind.boxes[1]) === J(['ic-k2: Poe is a raven that lives in a city']),
            'a claim read as two whose pieces have no words of their own is one part, colored (it went uncolored)', J(kind));
        const rule = sel => (CSS.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
        const under = rule('body.ic-v2 .rendered-text .ic-c'), underLight = rule('body.ic-v2.nodes-light .rendered-text .ic-c');
        ok(/color:\s*#6fbf8b/.test(under) && /text-decoration-line:\s*underline/.test(under) && /text-decoration-style:\s*solid/.test(under) &&
            /text-decoration-color:\s*#6fbf8b/.test(under) && /text-decoration-thickness:\s*1px/.test(under) && /text-underline-offset:\s*3px/.test(under),
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
            const x = document.querySelector('.node[data-node-id="A"][data-node-idx="1"] .rendered-text span.ic-neg');
            const c = x && getComputedStyle(x); document.body.classList.remove('nodes-light');
            return c ? c.color + ' / ' + c.backgroundColor : null; })()`);
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
            /span\.ic\.ic-c\[data-ic-fit\]:not\(\.ic-cn\)::after \{ content: ''; position: absolute; left: 0; right: 0; top: calc\(var\(--ic-base\) \+ 3px\); height: 1px; background: #6fbf8b;/.test(css) &&
            /body\.ic-v2\.nodes-light \.rendered-text span\.ic\.ic-c\[data-ic-fit\]:not\(\.ic-cn\)::after \{ background: #17803a; \}/.test(css) &&
            /\[data-ic-jl\]:not\(\.ic-cn\)::after \{ left: -\.5px; \}/.test(css) && /\[data-ic-jr\]:not\(\.ic-cn\)::after \{ right: -\.5px; \}/.test(css),
            'colors 2\'s line under math: a 1px strip where the underline would be (3px below the baseline), in its green, reaching half a pixel into a neighbor it goes on into');
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    W.dom.window.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
