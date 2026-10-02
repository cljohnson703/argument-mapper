'use strict';
// r27.69 (the user, 2026-10-01): "In light mode, when you open the
// cross-reference badge, the references are hard to read (contrast fix?).
// Also, the headers for all the buttons on the left panel and the headers on
// the right panel (e.g., Add Notes, View, Notes, Sort, etc.) are too light in
// light mode. The number and percent symbol on the zoom in light mode are
// also a little too light and should be made the same color as the headers.
// Also, when the left panel is switched to the top and horizontal, is there a
// way to make it so that there's enough space for the evaluation window to
// come in without pushing the File buttons to the bottom row of the panel?
// Maybe by reducing the width of some of the File buttons in horizontal mode
// by removing the 'JSON' portion of the Open button?"
//
// (1) The light theme's headers -- the toolbar's (Add Nodes, Change Type,
//     View, File), the Evaluations panel's (Notes, Sort), the Logic panel's
//     groups, the menus' and dialogs' -- and the zoom percentage share one
//     color, --label-text, about 6.5:1 on the panels (it was #999, 2.5:1).
// (2) In the light theme a button's text is dark unless a rule of its own
//     colors it. The references popover's references, its + and ×, and its
//     menu were white on white; the search bar's buttons, Recent Maps'
//     Remove, Collaborate's Copy address and Open were white on light gray.
// (3) Open says "Open…" (no "JSON"), and in the top toolbar File drops its
//     shortcuts (its tips keep them) rather than take a row of its own -- as
//     when the Evaluations panel opens beside it. (Measured in Chrome at
//     1920 px: File stays beside Change Type with the panel open.)
//
// Then (the user): "The hover tips in light mode should be consistent with
// the light mode theme. And yes, let's make all of the things you mentioned
// in the 3 bullets points darker." (r27.70)
//
// (4) Hover tips: the browser draws its own in the system's colors, so the
//     app draws them, in the theme's -- after a moment's rest, below the
//     pointer; gone on leaving, a press or a key. While one is pending or
//     up, the control's title is set aside so the browser's does not show
//     as well, and it comes back after (a new title the app gave it meanwhile
//     wins). A touch shows none (press and hold does, as before).
// (5) Darker in the light theme: "Saved in browser only …", note times, the
//     Logic panel's "Basis: the axioms", its notes, counts and arrows, Recent
//     Maps' times and note, the note popover's ✕ and "No notes yet.", the
//     Depth labels, the reading chooser's own-words line, and its "the step
//     follows by …" in a deeper green. In the dark theme the ⠿ grip is
//     lighter (it was #555 on a #2a2f30 box, 1.8:1).
//
// Run:  node theme-r27-light-test.js [argument-mapper-r27.html]
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

// WCAG contrast of two #rrggbb colors.
function contrast(a, b) {
    const lum = hex => {
        const c = hex.replace('#', '');
        const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
        const [r, g, bl] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
            .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

(async () => {
    console.log('=== r27.69-r27.70 light theme: readable headers, words, references and buttons; tips in the theme; File keeps its row ===');
    const W = makeWin('light');
    await sleep(300);
    const CSS = W.win.eval(`Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\\n')`);

    console.log('\n-- (1) one header color --');
    {
        const light = (CSS.match(/body\.bg-light\s*\{[^}]*\}/) || [''])[0];
        const value = (light.match(/--label-text:\s*(#[0-9a-f]{3,6})/i) || [])[1];
        ok(value === '#555', 'the light theme defines --label-text, the headers\' color', value);
        const headers = ['.toolbar-group-label', '#zoom-display', '#eval-overview-sort-row label', '#eval-overview-notes-label',
            '.logic-ext-label', '#context-menu .ctx-label', '.collab-section-title', '.eval-popover-title'];
        const missing = headers.filter(sel => !new RegExp('body\\.bg-light ' + esc(sel) + '\\s*\\{\\s*color:\\s*var\\(--label-text\\);\\s*\\}').test(CSS));
        ok(missing.length === 0, 'the toolbar\'s headers, the zoom percentage, Notes and Sort, the Logic panel\'s groups, the menus\' and dialogs\' headers all take it', J(missing));
        const stale = headers.filter(sel => new RegExp('body\\.bg-light ' + esc(sel) + '\\s*\\{\\s*color:\\s*#(999|888|777)').test(CSS));
        ok(stale.length === 0, 'none keeps its old pale gray', J(stale));
        const panels = { toolbar: '#f0f0f0', 'Evaluations panel': '#ffffff', menus: '#f5f5f5' };
        const low = Object.entries(panels).filter(([, bg]) => contrast(value || '#999', bg) < 4.5).map(([k, bg]) => k + ' ' + contrast(value || '#999', bg).toFixed(2));
        ok(low.length === 0, 'it reads at 4.5:1 or better on every light panel (' + Object.entries(panels).map(([k, bg]) => k + ' ' + contrast(value || '#999', bg).toFixed(1)).join(', ') + ')', J(low));
        ok(contrast('#999', '#f0f0f0') < 3, 'the old #999 was under 3:1 on the toolbar');
    }

    console.log('\n-- (2) buttons in the light theme --');
    {
        const base = CSS.indexOf('button, .file-upload-label {');
        const rule = CSS.search(/:where\(body\.bg-light\) button\s*\{\s*color:\s*#333;\s*\}/);
        ok(base >= 0 && rule > base, 'a button\'s text is dark (#333) in the light theme, below every other button rule (:where, after the base rule)', J({ base, rule }));
        ok(/:where\(body\.bg-light\) button:hover\s*\{\s*background:\s*#ccc;/.test(CSS), 'and its hover is light (#ccc), not the dark theme\'s #505050');
        ok(contrast('#333', '#dddddd') >= 4.5 && contrast('#333', '#cccccc') >= 4.5, 'dark text reads on the light button and on its hover');
        ok(/\.reference-arguments-popover button:not\(\.crossref-popover-remove\)\s*\{\s*color:\s*inherit;\s*\}/.test(CSS),
            'the references popover\'s buttons take the popover\'s text color; its red ✕ keeps its red');
        ok(/body\.bg-light #recent-modal-close\s*\{\s*color:\s*#666;/.test(CSS) && /body\.bg-light #collab-modal-close\s*\{\s*color:\s*#666;/.test(CSS) &&
           /body\.bg-light \.collab-hint\s*\{\s*color:\s*#666;/.test(CSS) && /body\.bg-light #search-bar \.search-info\s*\{\s*color:\s*#666;/.test(CSS),
            'the Recent Maps and Collaborate ✕, Collaborate\'s notes and the search count are darker too (#666, not #aaa or #999)');
        // The popover itself: its references are buttons, the ✕ is not one of them.
        const pop = JSON.parse(W.win.eval(`(function () {
            state.trees = [
                { id: 'a', type: 'contention', texts: ['Poe is black.'], collapsed: [], x: 30000, y: 30000, children: [
                    { id: 'b', type: 'support', texts: ['Poe is a raven.'], collapsed: [], children: [], crossRefs: [[{ targetId: 'c', targetIdx: 0 }]] }] },
                { id: 'c', type: 'contention', texts: ['Poe was hatched from a raven egg.'], collapsed: [], x: 31000, y: 30000, children: [] }];
            ensureCollabFields(state); render();
            document.body.classList.add('bg-light', 'nodes-light');
            openReferenceArguments('b', 0);
            var p = document.querySelector('.reference-arguments-popover');
            var out = { premises: [].map.call(p.querySelectorAll('button.reference-premise'), function (b) { return b.textContent; }),
                        remove: [].map.call(p.querySelectorAll('button.crossref-popover-remove'), function (b) { return b.classList.contains('reference-premise'); }),
                        heading: [].map.call(p.querySelectorAll('.reference-argument-heading button'), function (b) { return b.textContent; }) };
            p.remove(); document.body.classList.remove('bg-light', 'nodes-light');
            return JSON.stringify(out);
        })()`));
        ok(J(pop.premises) === J(['↗ Poe was hatched from a raven egg.']) && J(pop.remove) === J([false]) && J(pop.heading) === J(['+', '×']),
            'the popover\'s reference, + and × are the buttons that take its color; the ✕ is apart', J(pop));
    }

    console.log('\n-- (3) File keeps its row in the top toolbar --');
    {
        const open = JSON.parse(W.win.eval(`(function () { var b = document.getElementById('open-file-btn');
            return JSON.stringify({ text: b.textContent.trim(), hotkeys: b.querySelectorAll('.hotkey').length, title: b.title }); })()`));
        ok(open.text === 'Open…' && open.hotkeys === 0 && open.title === 'Open a saved map', 'Open says "Open…", without "JSON"', J(open));
        ok(/#toolbar\.file-compact #group-file \.hotkey\s*\{\s*display:\s*none;\s*\}/.test(CSS), 'a compact File hides its shortcuts');
        const tips = JSON.parse(W.win.eval(`JSON.stringify([].map.call(document.querySelectorAll('#group-file .hotkey'), function (h) { return h.parentElement.title; }))`));
        ok(tips.length === 3 && tips.every(t => /\((Ctrl\+S|Ctrl\+Shift\+S|\/)\)$/.test(t)), 'each shortcut it hides is in its button\'s tip', J(tips));
        // Mock the layout: Change Type ends at 900 of a 1600 toolbar, so about
        // 670 px are left beside it. File's width depends on whether it is
        // compact; where it lands depends on what is before it.
        const pack = JSON.parse(W.win.eval(`(function () {
            var toolbar = document.getElementById('toolbar'), change = document.getElementById('group-change-type'),
                view = document.getElementById('group-view'), file = document.getElementById('group-file');
            var wasLeft = document.body.classList.contains('toolbar-left');
            var size = {};
            toolbar.getBoundingClientRect = function () { return { right: 1600 }; };
            change.getBoundingClientRect = function () { return { right: 900, top: 50, bottom: 90 }; };
            view.getBoundingClientRect = function () { return { width: size.view, top: 100, bottom: 140 }; };
            file.getBoundingClientRect = function () {
                var w = toolbar.classList.contains('file-compact') ? size.compact : size.full;
                var top = file.previousElementSibling === change ? 50 : w <= size.besideView ? 100 : 150;
                return { width: w, top: top, bottom: top + 40 };
            };
            var read = function (s) {
                size = s; arrangeToolbarGroups();
                return [].filter.call(toolbar.children, function (e) { return e.classList.contains('toolbar-group'); })
                    .map(function (e) { return e.id.replace('group-', ''); }).join(',') + (toolbar.classList.contains('file-compact') ? ' compact' : '');
            };
            try {
                document.body.classList.remove('toolbar-left');
                var out = {
                    fits: read({ view: 1000, full: 600, compact: 500, besideView: 0 }),
                    compactFits: read({ view: 1000, full: 800, compact: 600, besideView: 0 }),
                    neither: read({ view: 1000, full: 800, compact: 700, besideView: 0 }),
                    besideView: read({ view: 1000, full: 800, compact: 700, besideView: 700 }),
                    fullBesideView: read({ view: 1000, full: 800, compact: 700, besideView: 800 })
                };
                document.body.classList.add('toolbar-left');
                out.sidebar = read({ view: 1000, full: 800, compact: 600, besideView: 0 });
                return JSON.stringify(out);
            } finally {
                [toolbar, change, view, file].forEach(function (el) { delete el.getBoundingClientRect; });
                document.body.classList.toggle('toolbar-left', wasLeft); arrangeToolbarGroups();
            }
        })()`));
        ok(pack.fits === 'add-nodes,change-type,file,view', 'File keeps its shortcuts where it fits beside Change Type', pack.fits);
        ok(pack.compactFits === 'add-nodes,change-type,file,view compact', 'it drops them where that keeps it beside Change Type (the Evaluations panel open at 1920 px)', pack.compactFits);
        ok(pack.besideView === 'add-nodes,change-type,view,file compact', 'or keeps it on View\'s row (a wide screen)', pack.besideView);
        ok(pack.neither === 'add-nodes,change-type,view,file', 'where neither helps it keeps them, on its own row', pack.neither);
        ok(pack.fullBesideView === 'add-nodes,change-type,view,file', 'and it keeps them where it fits after View as it is', pack.fullBesideView);
        ok(pack.sidebar === 'add-nodes,change-type,view,file', 'the side toolbar is not compacted (its File hides shortcuts anyway)', pack.sidebar);
    }

    console.log('\n-- (4) hover tips in the theme\'s colors --');
    {
        ok(/body\.bg-light \.eval-tooltip\s*\{\s*background:\s*#f5f5f5;\s*color:\s*#222;\s*border-color:\s*#bbb;\s*box-shadow:\s*0 2px 8px rgba\(0,0,0,0\.15\);\s*\}/.test(CSS) &&
           /\.eval-tooltip\s*\{[^}]*background:\s*#1a1a1a;\s*color:\s*#ddd;/.test(CSS),
            'the tooltip style is light in the light theme (the light popups\' colors and shadow) and dark in the dark');
        ok(/\.hover-tip\s*\{\s*max-width:\s*320px;\s*z-index:\s*10050;\s*\}/.test(CSS) && /z-index:\s*9002;/.test(CSS),
            'a hover tip is wide enough for a step\'s explanation and above every popover');
        W.win.eval(`window.__btn = [].find.call(document.querySelectorAll('#group-add-nodes button'), function (b) { return /Add Objection/.test(b.textContent); });
            window.__text = __btn.getAttribute('title');
            window.__over = function (el, type) { el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: type || 'mouse', clientX: 100, clientY: 120 })); };
            window.__state = function () { var t = document.querySelectorAll('.hover-tip'); return JSON.stringify({ tips: [].map.call(t, function (x) { return x.textContent; }),
                cls: t[0] ? t[0].className : null, top: t[0] ? t[0].style.top : null, title: __btn.getAttribute('title'), aside: __btn.getAttribute('data-hover-title') }); };`);
        const text = W.win.eval('__text');
        W.win.eval(`__over(__btn)`);
        const early = JSON.parse(W.win.eval('__state()'));
        await sleep(700);
        const shown = JSON.parse(W.win.eval('__state()'));
        ok(text === 'Add an objection to the selected box (Shift+Enter)' && early.tips.length === 0 && early.title === null && early.aside === text,
            'hovered, a control\'s title is set aside at once (no browser tooltip), and no tip shows yet', J(early));
        ok(J(shown.tips) === J([text]) && shown.cls === 'eval-tooltip hover-tip' && shown.top === '140px',
            'after a moment the app\'s tip shows its words, 20 px below the pointer', J(shown));
        W.win.eval(`__over(document.body)`);
        const left = JSON.parse(W.win.eval('__state()'));
        ok(left.tips.length === 0 && left.title === text && left.aside === null, 'leaving it puts the tip away and the title back', J(left));
        W.win.eval(`__over(__btn, 'touch')`);
        await sleep(700);
        const touch = JSON.parse(W.win.eval('__state()'));
        ok(touch.tips.length === 0 && touch.title === text, 'a touch shows no hover tip and leaves the title be', J(touch));
        W.win.eval(`__over(__btn)`);
        await sleep(700);
        W.win.eval(`document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))`);
        const pressed = JSON.parse(W.win.eval('__state()'));
        W.win.eval(`__over(document.body)`);
        const after = JSON.parse(W.win.eval('__state()'));
        ok(pressed.tips.length === 0 && pressed.title === null && after.title === text,
            'a press puts the tip away, the title staying aside until the pointer leaves', J({ pressed, after }));
        W.win.eval(`__over(__btn)`);
        await sleep(700);
        W.win.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'x' }))`);
        const key = JSON.parse(W.win.eval('__state()'));
        ok(key.tips.length === 0 && key.title === text && key.aside === null, 'a key puts it away and the title back at once (a shortcut may read it)', J(key));
        W.win.eval(`__over(__btn); __btn.title = 'New words'; __btn.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: 101, clientY: 121 }));`);
        const renamed = JSON.parse(W.win.eval('__state()'));
        await sleep(700);
        const renamedTip = JSON.parse(W.win.eval('__state()'));
        W.win.eval(`__over(document.body)`);
        const renamedAfter = JSON.parse(W.win.eval('__state()'));
        ok(renamed.title === null && J(renamedTip.tips) === J(['New words']) && renamedAfter.title === 'New words',
            'a title the app changes meanwhile is set aside too, shown, and kept after', J({ renamed, renamedTip, renamedAfter }));
        W.win.eval(`__btn.title = __text; var s = document.createElement('span'); s.id = '__empty'; s.setAttribute('title', ''); document.body.appendChild(s); __over(s);`);
        await sleep(700);
        const empty = JSON.parse(W.win.eval(`JSON.stringify({ tips: document.querySelectorAll('.hover-tip').length, title: document.getElementById('__empty').getAttribute('title') })`));
        W.win.eval(`__over(document.body); document.getElementById('__empty').remove();`);
        ok(empty.tips === 0 && empty.title === '', 'an empty title shows nothing, as in the browser', J(empty));
        W.win.eval(`var g = document.createElement('button'); g.id = '__gone'; g.title = 'Soon redrawn'; document.body.appendChild(g); __over(g);`);
        await sleep(700);
        const before = W.win.eval(`document.querySelectorAll('.hover-tip').length`);
        W.win.eval(`document.getElementById('__gone').remove(); document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: 102, clientY: 122 }));`);
        const gone = W.win.eval(`document.querySelectorAll('.hover-tip').length`);
        ok(before === 1 && gone === 0, 'a control redrawn under the pointer takes its tip with it on the next move', J({ before, gone }));
    }

    console.log('\n-- (5) darker small words; a lighter grip on dark boxes --');
    {
        const dark = ['#save-indicator', '.depth-label', '.logic-basis-head', '.logic-basis-note', '.logic-count', '.logic-chev',
            '.eval-comment-time', '.eval-popover-thread:empty::before', '.recent-when, body.bg-light #recent-modal-foot', '#reading-chooser .rc-own'];
        const missing = dark.filter(sel => !new RegExp('body\\.bg-light ' + esc(sel) + '\\s*\\{[^}]*color:\\s*var\\(--label-text\\)').test(CSS));
        ok(missing.length === 0, '"Saved in browser only …", note times, "Basis: the axioms" and the Logic panel\'s notes, counts and arrows, Recent Maps\' times and note, "No notes yet.", the Depth labels and the own-words line take the headers\' color', J(missing));
        ok(/body\.bg-light \.eval-popover-close\s*\{\s*color:\s*#666;\s*\}/.test(CSS), 'the note popover\'s ✕ is #666, as the other ✕s');
        ok(/body\.bg-light #reading-chooser \.rc-follows\s*\{\s*color:\s*#007a00;\s*\}/.test(CSS) && contrast('#007a00', '#f5f5f5') >= 4.5 && contrast('#00a800', '#f5f5f5') < 3,
            'the reading chooser\'s "the step follows by …" is a deeper green: ' + contrast('#007a00', '#f5f5f5').toFixed(1) + ':1 on its panel, where the tags\' green is ' + contrast('#00a800', '#f5f5f5').toFixed(1) + ':1');
        const grip = (CSS.match(/\n\s*\.drag-handle\s*\{[^}]*\}/) || [''])[0];
        ok(/color:\s*#999;/.test(grip) && /:where\(body\.nodes-light\) \.drag-handle\s*\{\s*color:\s*#555;\s*\}/.test(CSS),
            'the grip is #999 on the dark theme\'s boxes, #555 on the light theme\'s as before', grip.trim().slice(0, 120));
        ok(/\.type-note \.drag-handle\s*\{\s*color:\s*#999;\s*\}/.test(CSS) && /:where\(body\.nodes-light\) \.type-note \.drag-handle\s*\{\s*color:\s*#888;\s*\}/.test(CSS),
            'and on notes #999 in the dark theme, #888 in the light as before');
        ok(contrast('#999', '#2a2f30') >= 4.5 && contrast('#999', '#4a4118') >= 3 && contrast('#555', '#2a2f30') < 2,
            'readable on a dark box (' + contrast('#999', '#2a2f30').toFixed(1) + ':1) and a dark note (' + contrast('#999', '#4a4118').toFixed(1) + ':1), where it was ' + contrast('#555', '#2a2f30').toFixed(1) + ':1');
        const alone = CSS.indexOf('.drag-handle.drag-handle-alone {'), noteRules = [CSS.indexOf('.type-note .drag-handle { color: #999; }'), CSS.indexOf(':where(body.nodes-light) .type-note .drag-handle')];
        ok(alone > 0 && noteRules.every(i => i > 0 && i < alone), 'a held grip still turns blue: its rule comes after the notes\' (the same weight) and outweighs the rest', J({ alone, noteRules }));
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    W.dom.window.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
