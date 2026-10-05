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
//     their tips), so the panel keeps its height. Turning the colors on turns
//     Deductive on; turning Deductive off turns them off, and the boxes are
//     as they were.
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
        window.__step = function (trees) { __load(trees); if (!inferenceColorsOn) toggleInferenceColors(); else refreshDerivationTags();
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
        ok(b.pressed === 'false' && !b.live && !b.on && /turns on Deductive/.test(b.title), 'off at first, its tip saying it turns Deductive on', J(b));
        ok(/\.logic-row\s*\{\s*display:\s*contents;\s*\}/.test(CSS) && /body\.toolbar-left #group-view \.logic-row\s*\{[^}]*display:\s*flex;[^}]*flex:\s*0 0 100%/.test(CSS) &&
            /body\.toolbar-left \.logic-row \.hotkey\s*\{\s*display:\s*none;\s*\}/.test(CSS),
            'in the top toolbar the three sit in the group\'s row; in the side panel they are a row of their own without key letters');
        const t = val(`(function () {
            __load(${J(step(['If the alarm went off, then the dog barked', 'The alarm went off'], 'The dog barked'))});
            const plain = document.querySelector('.node[data-node-id="A"][data-node-idx="0"] .rendered-text').innerHTML;
            document.getElementById('colors-btn').click();
            const on = { colors: inferenceColorsOn, live: deductiveLive, pressed: document.getElementById('colors-btn').getAttribute('aria-pressed'),
                deductive: document.getElementById('logic-btn').classList.contains('active'), spans: document.querySelectorAll('.rendered-text span.ic').length,
                tags: document.querySelectorAll('.derivation-tag').length };
            document.getElementById('logic-btn').click();
            const off = { colors: inferenceColorsOn, live: deductiveLive, pressed: document.getElementById('colors-btn').getAttribute('aria-pressed'),
                spans: document.querySelectorAll('.rendered-text span.ic').length, same: document.querySelector('.node[data-node-id="A"][data-node-idx="0"] .rendered-text').innerHTML === plain };
            document.getElementById('colors-btn').click(); document.getElementById('colors-btn').click();
            const offAlone = { colors: inferenceColorsOn, live: deductiveLive, spans: document.querySelectorAll('.rendered-text span.ic').length,
                same: document.querySelector('.node[data-node-id="A"][data-node-idx="0"] .rendered-text').innerHTML === plain };
            toggleDeductiveLive();
            return { on, off, offAlone }; })()`);
        ok(t.on.colors && t.on.live && t.on.pressed === 'true' && t.on.deductive && t.on.spans > 0 && t.on.tags > 0, 'on, it turns Deductive on: the steps are tagged and their premises colored', J(t.on));
        ok(!t.off.colors && !t.off.live && t.off.pressed === 'false' && t.off.spans === 0 && t.off.same, 'Deductive off turns the colors off, and the boxes are exactly as they were', J(t.off));
        ok(!t.offAlone.colors && t.offAlone.live && t.offAlone.spans === 0 && t.offAlone.same, 'the swatch alone turns them off and leaves Deductive on', J(t.offAlone));
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
        ok(J(no.boxes[0]) === J(['ic-k0 ic-neg: No', 'ic-k0:  ravens', 'ic-rest:  are ', 'ic-c ic-cn: white']),
            '"No ravens are white": "No" red in its colored part, and "white" underlined -- the conclusion denies it', J(no));
        const hs = paint(['If it rains, then the ground is wet', 'If the ground is wet, then the game is cancelled'], 'If it rains, then the game is cancelled');
        ok(hs.rule === 'hypothetical syllogism' &&
            J(hs.boxes[0]) === J(['ic-c: If', 'ic-rest:  ', 'ic-c: it rains', 'ic-rest: , then ', 'ic-k0: the ground is wet']) &&
            J(hs.boxes[1]) === J(['ic-rest: If ', 'ic-k0: the ground is wet', 'ic-rest: , ', 'ic-c: then', 'ic-rest:  ', 'ic-c: the game is cancelled']),
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
        ok(obj.rule === 'modus ponens' && J(runs(obj.boxes[0], /^ic-c/)) === J(['Poe', 'is not', 'a raven']) && !obj.boxes[0].some(p => /ic-cn/.test(p)),
            'an objection: what it concludes is the denial of its box, so "Poe is not a raven" goes on plain', J(obj));
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
        ok(neither.boxes[0][0] === 'ic-rest ic-neg: It is not the case that' && /ic-c ic-cn: it snows/.test(J(neither.boxes[0])),
            '"It is not the case that" red (never dimmed) where it stands; "it snows" goes on denied', J(neither));
        const sym = paint(['P → Q', '¬Q'], '¬P');
        ok(sym.rule === 'modus tollens' && J(sym.boxes[1]) === J(['ic-rest ic-neg: ¬', 'ic-k0: Q']) && J(sym.boxes[0]) === J(['ic-c ic-cn: P', 'ic-rest:  → ', 'ic-k0: Q']),
            'in symbols too: "¬" red, "P" underlined', J(sym));
        ok(/\.rendered-text \.ic\.ic-neg\s*\{\s*opacity:\s*1;\s*color:\s*#ff7b72;\s*font-weight:\s*600;\s*\}/.test(CSS) &&
            /body\.nodes-light \.rendered-text \.ic\.ic-neg\s*\{\s*color:\s*#c62828;\s*\}/.test(CSS),
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
            if (!inferenceColorsOn) toggleInferenceColors(); else refreshDerivationTags();
            const rd = document.querySelector('.node[data-node-id="A"][data-node-idx="0"] .rendered-text');
            const a = rd.querySelector('.box-link');
            return { wrap: a && a.parentElement.className, label: a && a.textContent, parts: __parts(0), rule: (collectDeductiveSteps(state.trees, null).find(s => s.childId === 'A') || {}).rule }; })()`);
        ok(link.wrap === 'ic ic-k0' && link.rule, 'a premise link, read as its box\'s words, takes their color', J(link));
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
        ok(/colors button after Deductive colors each premise by its part in the step/.test(help) && /underlined in red dashes when the conclusion denies it/.test(help),
            'Help says what the colors mean');
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    W.dom.window.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
