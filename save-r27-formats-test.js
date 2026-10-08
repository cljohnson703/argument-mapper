'use strict';
// r27.65 (the user, 2026-09-30): "I'd like to have 'Save As...' allow PNG,
// SVG, JPG, JPEG, and whatever other forms you think are worth adding to be
// save options. Then we can get rid of 'Export SVG' and 'Export PNG'." And
// "Save now" goes, Save to File refreshing the browser's copy itself.
//
// (1) Save As offers the map (JSON) and a picture, a PDF or a text outline of
//     it; the file's ending decides what is written; only a JSON file stays
//     linked. Save to File's first save offers the map alone.
// (2) Without a save dialog (Firefox, Safari), Save As asks which format in
//     a small menu, then downloads that.
// (3) Save to File refreshes the browser's copy, with Autosave off too.
// (4) The PDF's parts: its header, its objects where the cross-reference
//     says, its page and its picture -- and, r27.66 (the user: "Is it
//     possible to make the text selectable in the PDF?"), its words over the
//     picture as invisible text, each character read back as itself. (The
//     pictures themselves are drawn in a real browser: jsdom draws none.)
// (5) Export SVG, Export PNG, Export Text and "Save now" are gone.
// (6) r27.95 (the user, 2026-10-08: "on mobile, when choosing 'Save As', is
//     it possible to allow selecting the type of file? It seems to default to
//     JSON"): on a phone or tablet the save screen has no list of file types
//     (Android's names a file and a folder only), so Save As asks the format
//     first, in the menu, and then opens the save screen for that one.
//
// Run:  node save-r27-formats-test.js [argument-mapper-r27.html]
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

function makeWin(label, opts) {
    opts = opts || {};
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
        win.scrollTo = () => {}; win.confirm = () => true; win.prompt = () => null; win.open = () => null;
        win.__alerts = []; win.alert = m => win.__alerts.push(String(m));
        win.URL.createObjectURL = win.URL.createObjectURL || (() => 'blob:fake');
        win.URL.revokeObjectURL = win.URL.revokeObjectURL || (() => {});
        if (!win.TextEncoder) win.TextEncoder = TextEncoder;
        if (opts.beforeParse) opts.beforeParse(win);
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}
// A save dialog that hands back a file with the given name, and records what
// it was offered and what was written.
function pickerWin(label) {
    return makeWin(label, {
        beforeParse(win) {
            win.__offered = []; win.__wrote = []; win.__nextName = 'Map.json';
            win.showSaveFilePicker = function (opts) {
                win.__offered.push(opts);
                const name = win.__nextName;
                return Promise.resolve({
                    name,
                    createWritable: () => Promise.resolve({
                        write: b => { win.__wrote.push(b); return Promise.resolve(); },
                        close: () => Promise.resolve()
                    })
                });
            };
        }
    });
}
// The same on a phone or tablet: its main pointer a finger.
function touchPickerWin(label) {
    const W = makeWin(label, {
        beforeParse(win) {
            win.matchMedia = q => ({ matches: /pointer:\s*coarse/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
            win.__offered = []; win.__wrote = []; win.__nextName = 'Map.json'; win.__refuse = false;
            win.showSaveFilePicker = function (opts) {
                win.__offered.push(opts);
                if (win.__refuse) return Promise.reject(Object.assign(new Error('not allowed'), { name: 'SecurityError' }));
                const name = win.__nextName;
                return Promise.resolve({
                    name,
                    createWritable: () => Promise.resolve({
                        write: b => { win.__wrote.push(b); return Promise.resolve(); },
                        close: () => Promise.resolve()
                    })
                });
            };
        }
    });
    return W;
}
const MAP = [{ id: 'm', type: 'contention', texts: ['Zombies are possible.'], collapsed: [], children: [
    { id: 's', type: 'support', texts: ['If zombies are conceivable, then zombies are possible.', 'Zombies are conceivable.'], collapsed: [], children: [] }] }];

(async () => {
    console.log('=== r27.65-r27.66 Save As: the map, a picture, a PDF with its words selectable, or a text outline ===');

    console.log('\n-- (1) the save dialog --');
    {
        const W = pickerWin('picker');
        await sleep(300);
        const load = `__argmap.state.trees = ${J(MAP)}; __argmap.state.name = 'Zombie Map'; render();`;
        W.win.eval(load);
        // What is written for a name, and whether the map is linked after.
        const saveAs = async name => {
            W.win.eval(`window.__nextName = ${J(name)}; window.__wrote = []; window.__done = null; window.__before = lastSaveTime;
                saveMapAs().then(r => { window.__done = r; });`);
            await sleep(150);
            return JSON.parse(await W.win.eval(`(async function () {
                var b = window.__wrote[0], text = b ? await b.text() : null;
                return JSON.stringify({ result: window.__done, type: b ? b.type : null, start: text ? text.slice(0, 30) : null,
                    linked: linkedFileName(), saved: lastSaveTime !== window.__before, alerts: window.__alerts.slice() });
            })()`));
        };
        const svg = await saveAs('Zombie Map.svg');
        const offered = JSON.parse(W.win.eval(`JSON.stringify(window.__offered[0])`));
        ok(offered.suggestedName === 'Zombie Map.json' && J(offered.types.map(t => t.description)) ===
            J(['Argument map (JSON)', 'PNG image', 'JPEG image', 'SVG image', 'PDF document', 'Text outline']) &&
            J(offered.types[2].accept) === J({ 'image/jpeg': ['.jpg', '.jpeg'] }),
            'Save As offers the map first, then PNG, JPEG (.jpg or .jpeg), SVG, PDF and a text outline', J(offered));
        ok(svg.result && svg.result.saved && svg.result.format === 'svg' && svg.type === 'image/svg+xml' && /^<svg /.test(svg.start) && svg.linked === null && !svg.saved,
            'a file named .svg gets the picture, and the map is not linked to it', J(svg));
        const txt = await saveAs('Zombie Map.txt');
        ok(txt.result.format === 'txt' && txt.type === 'text/plain' && /^M1: Zombies are possible/.test(txt.start) && txt.linked === null,
            'a .txt file gets the text outline Import Text reads back', J(txt));
        // (jsdom draws no pictures: an empty map has none to draw anywhere.)
        W.win.eval(`__argmap.state.trees = []; render();`);
        const png = await saveAs('Zombie Map.png');
        W.win.eval(load);
        ok(png.result && png.result.saved === false && png.alerts.some(a => /Nothing to save as PNG image/.test(a)) && png.linked === null,
            'with nothing to draw, a picture is no save, and says so', J(png));
        const json = await saveAs('Zombie Map.json');
        ok(json.result.format === 'json' && json.type === 'application/json' && /"name": "Zombie Map"/.test(json.start) && json.linked === 'Zombie Map.json' && json.saved,
            'a .json file gets the map, and the map is linked to it', J(json));
        const again = await saveAs('Zombie Map.svg');
        ok(again.linked === 'Zombie Map.json', 'saving a picture afterwards leaves the link to the map\'s own file', J(again));
        W.win.eval(`unlinkFile(); window.__offered = []; window.__nextName = 'First.json'; saveMap();`);
        await sleep(150);
        const first = JSON.parse(W.win.eval(`JSON.stringify(window.__offered[0])`));
        ok(first && J(first.types.map(t => t.description)) === J(['Argument map (JSON)']),
            'Save to File\'s first save offers the map alone', J(first));
        ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
        W.dom.window.close();
    }

    console.log('\n-- (2) no save dialog: a menu of formats --');
    {
        const W = makeWin('nopicker');
        await sleep(300);
        const r = JSON.parse(await W.win.eval(`(async function () {
            __argmap.state.trees = ${J(MAP)}; __argmap.state.name = 'Zombie Map'; render();
            var got = []; downloadBlob = function (blob, name) { got.push({ name: name, type: blob.type }); return Promise.resolve(true); };
            var result = null; saveMapAs().then(function (x) { result = x; });
            var m = document.getElementById('context-menu'), open = m.classList.contains('open');
            var items = [].slice.call(m.querySelectorAll('[data-save-format]')).map(function (b) { return b.textContent; });
            m.querySelector('[data-save-format="svg"]').click();
            await new Promise(function (res) { setTimeout(res, 50); });
            var one = { open: open, items: items, got: got.slice(), result: result, closed: !m.classList.contains('open') };
            got.length = 0; result = null;
            saveMapAs().then(function (x) { result = x; });
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await new Promise(function (res) { setTimeout(res, 20); });
            one.escape = { result: result, got: got.length, closed: !m.classList.contains('open') };
            result = null; saveMap(); await new Promise(function (res) { setTimeout(res, 20); });
            one.ctrlS = { got: got.slice(), menu: m.classList.contains('open') };
            return JSON.stringify(one);
        })()`));
        ok(r.open && r.items.length === 6 && /^Argument map \(JSON\)\.json$/.test(r.items[0]) && /^SVG image\.svg$/.test(r.items[3]),
            'without a save dialog, Save As opens a menu of the six formats', J(r));
        ok(r.got.length === 1 && r.got[0].name === 'Zombie Map.svg' && r.got[0].type === 'image/svg+xml' && r.result && r.result.format === 'svg' && r.closed,
            'choosing one downloads it, named for the map', J(r));
        ok(r.escape.result && r.escape.result.saved === false && r.escape.got === 0 && r.escape.closed, 'Escape closes the menu and saves nothing', J(r.escape));
        ok(r.ctrlS.got.length === 1 && r.ctrlS.got[0].name === 'Zombie Map.json' && !r.ctrlS.menu,
            'Save to File (Ctrl+S) downloads the map at once, no menu', J(r.ctrlS));
        ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
        W.dom.window.close();
    }

    console.log('\n-- (6) a phone or tablet: the format first, then the save screen for it --');
    {
        const W = touchPickerWin('touch');
        await sleep(300);
        const r = JSON.parse(await W.win.eval(`(async function () {
            __argmap.state.trees = ${J(MAP)}; __argmap.state.name = 'Zombie Map'; render();
            var m = document.getElementById('context-menu'), wait = function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };
            var pick = function (id) { var b = m.querySelector('[data-save-format="' + id + '"]'); if (b) b.click(); };
            var out = {};
            // Save As: the menu, and no save screen yet.
            var result = null; saveMapAs().then(function (x) { result = x; });
            out.menu = { open: m.classList.contains('open'), items: [].slice.call(m.querySelectorAll('[data-save-format]')).length, offered: window.__offered.length };
            // A picture: the save screen for it alone, named for it; its own
            // format written, though the screen hands back a name with no ending.
            window.__nextName = 'Zombie Map';
            pick('svg');
            await wait(100);
            var b = window.__wrote[0];
            out.svg = { offered: window.__offered[0], type: b ? b.type : null, start: b ? (await b.text()).slice(0, 5) : null, result: result, linked: linkedFileName(), closed: !m.classList.contains('open') };
            // The map: linked to its file, as on a computer.
            window.__offered = []; window.__wrote = []; window.__nextName = 'Zombie Map.json'; result = null;
            saveMapAs().then(function (x) { result = x; });
            pick('json');
            await wait(100);
            out.json = { offered: window.__offered[0], type: window.__wrote[0] ? window.__wrote[0].type : null, result: result, linked: linkedFileName() };
            // Save to File's first save: the map alone, no menu.
            unlinkFile(); window.__offered = []; window.__nextName = 'First.json';
            saveMap(); await wait(100);
            out.first = { menu: m.classList.contains('open'), offered: window.__offered[0] };
            // A save screen the page may not use: the format chosen, downloaded.
            var got = []; downloadBlob = function (blob, name) { got.push({ name: name, type: blob.type }); return Promise.resolve(true); };
            window.__offered = []; window.__refuse = true; result = null;
            saveMapAs().then(function (x) { result = x; });
            pick('txt');
            await wait(100);
            out.refused = { got: got, result: result };
            return JSON.stringify(out);
        })()`));
        ok(r.menu.open && r.menu.items === 6 && r.menu.offered === 0, 'Save As opens the menu of the six formats first, before any save screen', J(r.menu));
        ok(r.svg.offered && r.svg.offered.suggestedName === 'Zombie Map.svg' && J(r.svg.offered.types) === J([{ description: 'SVG image', accept: { 'image/svg+xml': ['.svg'] } }]) &&
            r.svg.type === 'image/svg+xml' && r.svg.start === '<svg ' && r.svg.result && r.svg.result.format === 'svg' && r.svg.linked === null && r.svg.closed,
            'choosing SVG opens the save screen for SVG alone, named .svg, and writes the picture -- though the screen drops the ending', J(r.svg));
        ok(r.json.offered && J(r.json.offered.types.map(t => t.description)) === J(['Argument map (JSON)']) && r.json.type === 'application/json' &&
            r.json.result && r.json.result.format === 'json' && r.json.linked === 'Zombie Map.json',
            'choosing the map saves the map, linked to its file', J(r.json));
        ok(!r.first.menu && r.first.offered && J(r.first.offered.types.map(t => t.description)) === J(['Argument map (JSON)']),
            'Save to File\'s first save still offers the map alone, with no menu', J(r.first));
        ok(r.refused.got.length === 1 && r.refused.got[0].name === 'Zombie Map.txt' && r.refused.got[0].type === 'text/plain' && r.refused.result && r.refused.result.format === 'txt',
            'where the save screen is refused, the format chosen is downloaded', J(r.refused));
        ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
        W.dom.window.close();
    }

    console.log('\n-- (3) Save to File refreshes the browser\'s copy --');
    {
        const W = pickerWin('browsercopy');
        await sleep(300);
        const r = JSON.parse(await W.win.eval(`(async function () {
            __argmap.state.trees = ${J(MAP)}; __argmap.state.name = 'Zombie Map'; render();
            setAutosaveEnabled(false);
            var stored = []; var was = mapStore; mapStore = function (id, name, data) { stored.push(name); return was(id, name, data); };
            window.__nextName = 'Zombie Map.json';
            await saveMap();
            var afterFirst = stored.length;
            __argmap.state.trees[0].texts[0] = 'Zombies are metaphysically possible.';
            await saveMap();
            mapStore = was;
            return JSON.stringify({ afterFirst: afterFirst, afterSecond: stored.length, autosave: autosaveEnabled(), linked: linkedFileName(),
                noButton: !document.getElementById('save-now-btn') });
        })()`));
        ok(r.autosave === false && r.afterFirst >= 1 && r.afterSecond > r.afterFirst && r.linked === 'Zombie Map.json',
            'with Autosave off, each Save to File also refreshes the browser\'s copy (Recent Maps)', J(r));
        ok(r.noButton, 'there is no "Save now" button', J(r));
        ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
        W.dom.window.close();
    }

    console.log('\n-- (4) the PDF --');
    {
        const W = makeWin('pdf');
        await sleep(300);
        const r = JSON.parse(await W.win.eval(String.raw`(async function () {
            var jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
            var runs = [{ x: 40, y: 60, size: 14, width: 120, text: 'Zombies are possible \u2192 \u2200x' }];
            var blob = pdfWithJpeg(jpeg, 20, 10, 640, 320, runs), u8 = new Uint8Array(await blob.arrayBuffer()), text = '';
            for (var i = 0; i < u8.length; i++) text += String.fromCharCode(u8[i]);
            var sx = +/startxref\n(\d+)/.exec(text)[1], rows = text.slice(sx).split('\n');
            var offs = rows.slice(3, 12).map(function (l) { return +l.slice(0, 10); });
            var at = text.indexOf('stream\n', text.indexOf('/DCTDecode')) + 7;
            var content = /5 0 obj\n<< \/Length (\d+) >>\nstream\n/.exec(text), draw = content ? text.substr(content.index + content[0].length, +content[1]) : '';
            return JSON.stringify({ type: blob.type, head: text.slice(0, 8), tail: text.slice(-6), xref: text.slice(sx, sx + 4), size: /\/Size (\d+)/.exec(text)[1],
                rowsOk: rows.slice(2, 12).every(function (l) { return (l + '\n').length === 20; }),
                objs: offs.every(function (o, k) { return text.slice(o, o + String(k + 1).length + 6) === (k + 1) + ' 0 obj'; }),
                media: /MediaBox \[([^\]]+)\]/.exec(text)[1], image: /\/Width (\d+) \/Height (\d+)/.exec(text).slice(1).join('x'),
                jpeg: Array.prototype.slice.call(u8.slice(at, at + 10)).join(',') === Array.prototype.slice.call(jpeg).join(','),
                draw: draw, font: /8 0 obj\n<< \/Type \/Font \/Subtype \/Type0 \/BaseFont \/Helvetica \/Encoding \/Identity-H \/DescendantFonts \[9 0 R\] \/ToUnicode 7 0 R >>/.test(text),
                cmap: /7 0 obj\n<< \/Length \d+ >>\nstream\n\/CIDInit/.test(text) && /begincodespacerange\n<0000> <FFFF>\nendcodespacerange/.test(text) && /<2200> <22FF> <2200>/.test(text) });
        })()`));
        // r27.66: each letter as wide as the one drawn, so a selection's
        // highlight falls on the letters it covers -- a font for each font
        // the picture uses. "Wii" drawn 14 pixels wide at 10 pixels: W 0.9 em,
        // i 0.25 em, stretched not at all; the note's font its own.
        const w = JSON.parse(await W.win.eval(String.raw`(async function () {
            var jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
            var runs = [{ x: 40, y: 100, size: 10, width: 14, text: 'Wii', family: 'Segoe UI', spacing: 0, advances: [900, 250, 250] },
                        { x: 40, y: 120, size: 10, width: 16, text: 'Wi', family: 'Comic Sans MS', spacing: 1, advances: [1000, 400] }];
            var blob = pdfWithJpeg(jpeg, 20, 10, 640, 320, runs), u8 = new Uint8Array(await blob.arrayBuffer()), text = '';
            for (var i = 0; i < u8.length; i++) text += String.fromCharCode(u8[i]);
            var sx = +/startxref\n(\d+)/.exec(text)[1], offs = text.slice(sx).split('\n').slice(3, 14).map(function (l) { return +l.slice(0, 10); });
            return JSON.stringify({ size: /\/Size (\d+)/.exec(text)[1], objs: offs.every(function (o, k) { return text.slice(o, o + String(k + 1).length + 6) === (k + 1) + ' 0 obj'; }),
                fonts: /\/Font << \/F1 8 0 R \/F2 10 0 R >>/.test(text),
                w1: /9 0 obj\n<< \/Type \/Font \/Subtype \/CIDFontType2 [^\n]*\/DW 500 \/W \[87 \[900\] 105 \[250\]\] \/CIDToGIDMap \/Identity >>/.test(text),
                w2: /11 0 obj\n<< \/Type \/Font \/Subtype \/CIDFontType2 [^\n]*\/DW 500 \/W \[87 \[1000\] 105 \[400\]\] \/CIDToGIDMap \/Identity >>/.test(text),
                draw1: text.indexOf('/F1 7.5 Tf 0 Tc 100 Tz 1 0 0 1 30 165 Tm <005700690069> Tj') > 0,
                draw2: text.indexOf('/F2 7.5 Tf 0.75 Tc 100 Tz 1 0 0 1 30 150 Tm <00570069> Tj') > 0 });
        })()`));
        ok(w.size === '12' && w.objs && w.fonts && w.w1 && w.w2 && w.draw1 && w.draw2,
            'each letter as wide as the one drawn (W 0.9 em, i 0.25 em), one invisible font for each font the picture uses, the letter spacing kept (r27.66)', J(w));
        ok(r.type === 'application/pdf' && r.head === '%PDF-1.4' && r.tail === '%%EOF\n' && r.xref === 'xref' && r.size === '10' && r.rowsOk && r.objs,
            'a PDF 1.4 file whose cross-reference points at each of its nine objects (one font)', J(r));
        ok(r.media === '0 0 480 240' && r.image === '20x10' && r.jpeg,
            'its page the map\'s size at 96 pixels to the inch, the JPEG\'s bytes its picture', J(r));
        // The user, 2026-09-30: "Is it possible to make the text selectable in the PDF?"
        const expect = Array.from('Zombies are possible \u2192 \u2200x').map(c => ('000' + c.charCodeAt(0).toString(16).toUpperCase()).slice(-4)).join('');
        ok(r.draw.indexOf('q 480 0 0 240 0 0 cm /Im0 Do Q\nBT 3 Tr\n') === 0 && r.draw.indexOf(' Tz 1 0 0 1 30 195 Tm <' + expect + '> Tj') > 0 &&
            r.draw.indexOf('/F1 10.5 Tf ') > 0 && r.font && r.cmap,
            'over the picture its words, as invisible text (3 Tr) at each line\'s place, one code a character read back as itself -- so they can be selected, searched and copied', J({ draw: r.draw, font: r.font, cmap: r.cmap }));
        ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
        W.dom.window.close();
    }

    console.log('\n-- (5) the buttons that went --');
    {
        ok(!/>Export SVG</.test(HTML) && !/>Export PNG</.test(HTML) && !/>Export Text</.test(HTML) && !/function exportSVG\(|function exportPNG\(|function exportText\(/.test(HTML),
            'Export SVG, Export PNG and Export Text are gone (Save As does them)');
        ok(/<span class="toolbar-group-label">Import \/ Options<\/span>/.test(HTML) && />\s*Import Text\s*</.test(HTML) && !/Import Text\.\.\./.test(HTML),
            'their group is Import / Options, and Import Text stays (since r27.81 without dots)');
        ok(/id="save-as-btn"[^>]*title="Save a copy: the map, a picture, a PDF or a text outline \(Ctrl\+Shift\+S\)"/.test(HTML),
            'the Save As button says what it saves');
        ok(/<strong>Save As<\/strong> saves a copy as the map, a picture \(PNG, JPEG, SVG\), a PDF or a text outline/.test(HTML),
            'Help says so too (r27.68: in plain words)');
    }

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
