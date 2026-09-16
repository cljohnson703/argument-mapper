'use strict';
// r27 Open File links the map to its file, so Ctrl+S saves straight back.
//
// Save to File (Ctrl+S) writes straight to the map's linked file -- but only
// Save As ever linked one. Open File read the file through a plain file
// input, which gives a page no way back to the file, so after opening a map
// Ctrl+S asked where to save it, as if it had never had a file. Worse, the
// open left any EARLIER link in place, so Ctrl+S could write the newly opened
// map over the previous map's file. Now:
//   - where the browser allows it (Chrome, Edge: showOpenFilePicker), Open
//     File links the map to the file it came from, asking the browser's
//     permission to write to it as part of opening, so Ctrl+S and Autosave
//     write silently afterwards. Elsewhere the input reads a copy, unlinked.
//   - a save the browser refuses saves NOTHING: no Save As dialog behind the
//     canceled prompt, and no copy dropped in Downloads.
//   - undo starts afresh on open, so undoing cannot bring back the previous
//     map for the next save to write into this file;
//   - the remembered link names its map, and is never restored onto another.
//
// Covers:
//   (1) the Open File button and its fallback input;
//   (2) opening through the picker: the map, the link, the indicator, undo;
//   (3) saving back: silent writes, Ctrl+S, Autosave; and a refused save;
//   (4) a canceled picker, a file that is not a map, a blocked picker, no picker;
//   (5) opening through the input unlinks;
//   (6) the remembered link belongs to one map.
//
// Run:  node file-r27-open-link-test.js [argument-mapper-r27.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || (__dirname + '/argument-mapper-r27.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(c, label, detail) {
    if (c) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

const N = (id, type, text, children) => ({ id, type, texts: [text], collapsed: [], children: children || [] });
const OPENED = { name: 'Opened Map', _mapId: 'map-opened', trees: [Object.assign(N('om', 'contention', 'A claim from the file', [N('os', 'support', 'Its support')]), { x: 30000, y: 30000 })] };
const SECOND = { name: 'Second Map', _mapId: 'map-second', trees: [Object.assign(N('sm', 'contention', 'Another claim'), { x: 30000, y: 30000 })] };
const BEFORE = [Object.assign(N('bm', 'contention', 'The map on screen before'), { x: 30000, y: 30000 })];

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
        win.scrollTo = () => {}; win.confirm = () => true; win.prompt = () => null; win.open = () => null;
        win.URL.createObjectURL = win.URL.createObjectURL || (() => 'blob:fake');
        win.URL.revokeObjectURL = win.URL.revokeObjectURL || (() => {});
        win.__alerts = []; win.alert = (m) => win.__alerts.push(String(m));
        win.__writes = []; win.__requested = 0; win.__openPicker = 0; win.__savePicker = 0;
        win.__fileText = JSON.stringify(OPENED);
        win.__handle = function (name) {
            return {
                name: name, kind: 'file',
                getFile: () => Promise.resolve({ text: () => Promise.resolve(win.__fileText) }),
                queryPermission: () => Promise.resolve(win.__perm || 'prompt'),
                requestPermission: () => { win.__requested++; return Promise.resolve(win.__grant === false ? 'denied' : 'granted'); },
                createWritable: () => Promise.resolve({ write: (b) => { win.__writes.push(b); return Promise.resolve(); }, close: () => Promise.resolve() })
            };
        };
        win.showOpenFilePicker = function () {
            win.__openPicker++;
            return win.__openError ? Promise.reject(win.__openError) : Promise.resolve([win.__handle('Opened Map.json')]);
        };
        win.showSaveFilePicker = function () { win.__savePicker++; return Promise.resolve(win.__handle('Saved.json')); };
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}
const J = JSON.stringify;
const run = async (W, body) => JSON.parse(await W.win.eval(`(async function () { ${body} })().then(function (v) { return JSON.stringify(v); }, function (e) { return JSON.stringify({ __error: String(e && e.message || e) }); })`));

(async () => {
    console.log('=== r27 Open File keeps the map linked to its file ===');
    const W = makeWin('openlink');
    await sleep(360);
    W.win.eval(`
        window.__idb = [];
        idbPut = function (k, v) { window.__idb.push({ k: k, v: v }); return Promise.resolve(true); };
        window.__blobText = function (b) { return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.readAsText(b); }); };
        window.__ind = function () { return document.getElementById('save-indicator').textContent; };
    `);

    /* ---------------- 1. markup ---------------- */
    console.log('\n-- the Open File button --');
    {
        const m = W.win.eval(`JSON.stringify((function () {
            var b = document.getElementById('open-file-btn'), i = document.getElementById('open-file-input');
            var label = Array.prototype.slice.call(document.querySelectorAll('.file-upload-label')).some(function (l) { return /Open File/.test(l.textContent); });
            return { btn: !!b && b.tagName, onclick: b && b.getAttribute('onclick'), text: b && b.textContent.replace(/\\s+/g, ' ').trim(),
                     input: !!i && i.type, accept: i && i.accept, onchange: i && i.getAttribute('onchange'), label: label };
        })())`);
        const o = JSON.parse(m);
        ok(o.btn === 'BUTTON' && o.onclick === 'openMapFile()' && /^Open File/.test(o.text || '') && !o.label,
            'Open File is a button that opens the picker', m);
        ok(o.input === 'file' && o.accept === '.json' && o.onchange === 'loadMap(event)', 'with the plain file input kept, hidden, as the fallback', m);
    }

    /* ---------------- 2. opening through the picker ---------------- */
    console.log('\n-- opening through the picker --');
    {
        const r = await run(W, `
            state.trees = ${J(BEFORE)}; state.name = 'Before'; selectedIds = []; render();
            pushHistory(); pushHistory(); pushHistory();
            await openMapFile();
            var rec = window.__idb[window.__idb.length - 1];
            return { name: state.name, mapId: state._mapId, first: state.trees[0].texts[0], linked: linkedFileName(), perm: _filePermission,
                     undo: undoStack.length, redo: redoStack.length, ind: __ind(), pickers: [window.__openPicker, window.__savePicker], requested: window.__requested, title: document.title,
                     field: document.getElementById('map-name').value, idb: rec ? { key: rec.k, handle: rec.v && rec.v.handle && rec.v.handle.name, mapId: rec.v && rec.v.mapId } : null };`);
        ok(r.name === 'Opened Map' && r.first === 'A claim from the file' && r.field === 'Opened Map' && /^Opened Map/.test(r.title || ''),
            'the picker opens the file as the map', J(r));
        ok(r.linked === 'Opened Map.json' && r.perm === 'granted' && r.requested === 1 && J(r.pickers) === J([1, 0]),
            'and the map is LINKED to that file, with permission to write to it asked for as part of opening', J(r));
        ok(/Linked to Opened Map\.json/.test(r.ind || '') && !/asks to save/.test(r.ind || '') && !/browser only/.test(r.ind || ''),
            'the indicator names the file, with nothing left to ask', r.ind);
        ok(r.undo === 1 && r.redo === 0, 'undo starts afresh: nothing to undo back into the previous map', J([r.undo, r.redo]));
        ok(r.idb && r.idb.key === 'linkedFile' && r.idb.handle === 'Opened Map.json' && r.idb.mapId === 'map-opened',
            'the remembered link names the map it belongs to', J(r.idb));
    }

    /* ---------------- 3. saving back ---------------- */
    console.log('\n-- saving back to the file --');
    {
        const s1 = await run(W, `
            await saveMap();
            var text = await __blobText(window.__writes[0]);
            return { requested: window.__requested, writes: window.__writes.length, pickers: window.__savePicker, perm: _filePermission,
                     named: /"name": "Opened Map"/.test(text), claim: /A claim from the file/.test(text), ind: __ind() };`);
        ok(s1.requested === 1 && s1.writes === 1 && s1.pickers === 0 && s1.perm === 'granted',
            'Save to File writes straight to the opened file: nothing more to ask, and no Save As dialog', J(s1));
        ok(s1.named && s1.claim, 'what it writes is the opened map', J(s1));
        ok(/Saved to Opened Map\.json/.test(s1.ind || '') && !/asks to save/.test(s1.ind || ''), 'the indicator says it was saved there', s1.ind);

        const s2 = await run(W, `
            await saveMap();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true, cancelable: true }));
            await new Promise(function (r) { setTimeout(r, 60); });
            return { requested: window.__requested, writes: window.__writes.length, pickers: window.__savePicker };`);
        ok(s2.requested === 1 && s2.writes === 3 && s2.pickers === 0, 'later saves, and Ctrl+S, write silently to the same file', J(s2));

        const before = W.win.eval('window.__writes.length');
        W.win.eval(`state.trees[0].texts[0] = 'Edited after opening'; autosaveNow(true);`);
        await sleep(3000);
        const after = W.win.eval('window.__writes.length');
        ok(after > before, 'and Autosave keeps the opened file current too', before + ' -> ' + after);
    }

    /* ---------------- 3b. a refused save saves nothing ---------------- */
    console.log('\n-- a refused save saves nothing --');
    {
        const d = await run(W, `
            // Opened again with the browser declining permission: the link
            // stands, and the first save asks (and is declined).
            window.__grant = false; window.__perm = 'prompt'; window.__requested = 0;
            await openMapFile();
            var afterOpen = { linked: linkedFileName(), perm: _filePermission, requested: window.__requested, ind: __ind() };
            var writes = window.__writes.length, pickers = window.__savePicker;
            // Count downloads: a refused save must not drop a copy anywhere.
            var clicks = 0, origCreate = document.createElement.bind(document);
            document.createElement = function (tag) { var el = origCreate(tag); if (tag === 'a') el.click = function () { clicks++; }; return el; };
            var res = await saveMap();
            document.createElement = origCreate;
            await new Promise(function (r) { setTimeout(r, 30); });   // the toast fades in on the next frame
            var toast = document.getElementById('onetime-hint');
            return { afterOpen: afterOpen, res: res, asked: window.__requested, writes: window.__writes.length - writes,
                     pickers: window.__savePicker - pickers, downloads: clicks, toast: toast ? toast.textContent : '', shown: !!toast && toast.classList.contains('show') };`);
        ok(d.afterOpen && d.afterOpen.linked === 'Opened Map.json' && d.afterOpen.perm === 'prompt' && d.afterOpen.requested === 1 &&
           /Ctrl\+S asks to save to it/.test(d.afterOpen.ind || ''),
            'permission declined while opening: the file stays linked, and the indicator says the next save will ask', J(d.afterOpen));
        ok(d.asked === 2 && d.writes === 0 && d.res && d.res.saved === false,
            'Ctrl+S then asks again -- and a declined save writes nothing', J(d));
        ok(d.pickers === 0 && d.downloads === 0,
            'no Save As dialog opens behind it, and no copy is downloaded: canceling means nothing is saved', J(d));
        ok(/Not saved/.test(d.toast || '') && /Save As/.test(d.toast || '') && d.shown === true,
            'the map says so, and what to do about it', J(d.toast));

        const again = await run(W, `
            var toast = document.getElementById('onetime-hint');
            if (toast) { toast.classList.remove('show'); }
            var res = await saveMap();
            await new Promise(function (r) { setTimeout(r, 30); });
            var t = document.getElementById('onetime-hint');
            return { saved: res.saved, toast: t ? t.textContent : '', shown: !!t && t.classList.contains('show') };`);
        ok(again.saved === false && /Not saved/.test(again.toast || '') && again.shown === true,
            'and it says so every time, not once ever', J(again));

        const err = await run(W, `
            window.__grant = true; window.__perm = 'granted';
            var real = _fileHandle.createWritable;
            _fileHandle.createWritable = function () { return Promise.reject(new Error('gone')); };
            var clicks = 0, origCreate = document.createElement.bind(document);
            document.createElement = function (tag) { var el = origCreate(tag); if (tag === 'a') el.click = function () { clicks++; }; return el; };
            window.__alerts.length = 0;
            var res = await saveMap();
            document.createElement = origCreate;
            _fileHandle.createWritable = real;
            return { saved: res.saved, alerts: window.__alerts.slice(), downloads: clicks, pickers: window.__savePicker };`);
        ok(err.saved === false && err.alerts.length === 1 && /moved, renamed or deleted/.test(err.alerts[0]) && /Save As/.test(err.alerts[0]),
            'a file that has moved or gone says so, and points at Save As', J(err));
        ok(err.downloads === 0, 'without downloading a stray copy either', J(err));
    }

    /* ---------------- 4. cancel, bad file, blocked, none ---------------- */
    console.log('\n-- a canceled picker, a file that is not a map, no picker --');
    {
        const c = await run(W, `
            var name = state.name, linked = linkedFileName();
            window.__alerts.length = 0;
            window.__openError = { name: 'AbortError' };
            await openMapFile();
            var canceled = { same: state.name === name && linkedFileName() === linked, alerts: window.__alerts.length };
            window.__openError = null; window.__fileText = 'this is not a map';
            await openMapFile();
            var bad = { same: state.name === name && linkedFileName() === linked, alerts: window.__alerts.slice() };
            window.__inputClicks = 0;
            document.getElementById('open-file-input').click = function () { window.__inputClicks++; };
            window.__openError = { name: 'SecurityError' };
            await openMapFile();
            var blocked = { clicks: window.__inputClicks, same: state.name === name };
            window.__openError = null;
            var picker = window.showOpenFilePicker; delete window.showOpenFilePicker;
            await openMapFile();
            var none = { clicks: window.__inputClicks };
            window.showOpenFilePicker = picker;
            return { canceled: canceled, bad: bad, blocked: blocked, none: none };`);
        ok(c.canceled && c.canceled.same && c.canceled.alerts === 0, 'canceling the picker changes nothing and says nothing', J(c.canceled));
        ok(c.bad && c.bad.same && J(c.bad.alerts) === J(['Failed to parse JSON file.']), 'a file that is not a map is refused with a message, and the link is kept', J(c.bad));
        ok(c.blocked && c.blocked.clicks === 1 && c.blocked.same, 'a picker the page may not use falls back to the file input', J(c.blocked));
        ok(c.none && c.none.clicks === 2, 'and with no picker at all (Firefox, Safari) Open File is the file input', J(c.none));
    }

    /* ---------------- 5. opening through the input ---------------- */
    console.log('\n-- opening through the file input --');
    {
        const i = await run(W, `
            var linkedBefore = linkedFileName();
            pushHistory(); pushHistory();
            var file = new File([${J(J(SECOND))}], 'second.json', { type: 'application/json' });
            loadMap({ target: { files: [file], value: 'second.json' } });
            await new Promise(function (r) { setTimeout(r, 200); });
            return { before: linkedBefore, name: state.name, linked: linkedFileName(), undo: undoStack.length, ind: __ind() };`);
        ok(i.before === 'Opened Map.json' && i.name === 'Second Map', 'a map read through the input opens', J(i));
        ok(i.linked === null && !/Opened Map\.json/.test(i.ind || ''),
            'and is linked to no file: the next save can never write it over the previous map\'s file', J(i));
        ok(i.undo === 1, 'undo starts afresh here too', J(i.undo));
    }

    /* ---------------- 6. the remembered link ---------------- */
    console.log('\n-- the remembered link belongs to one map --');
    {
        const l = await run(W, `
            var out = {};
            state._mapId = 'map-mine';
            var restoreWith = async function (rec) { unlinkFile(); idbGet = function () { return Promise.resolve(rec); }; await restoreLinkedFile(); return linkedFileName(); };
            out.other = await restoreWith({ handle: __handle('Other.json'), mapId: 'map-someone-else' });
            out.mine = await restoreWith({ handle: __handle('Mine.json'), mapId: 'map-mine' });
            out.older = await restoreWith(__handle('Older.json'));
            out.nothing = await restoreWith(null);
            return out;`);
        ok(l.other === null, "a link remembered for a different map is not restored onto this one", J(l));
        ok(l.mine === 'Mine.json' && l.older === 'Older.json' && l.nothing === null,
            'its own map\'s link is, and so is a link remembered before links named their map', J(l));
    }

    ok(W.errors.length === 0, 'no JSDOM script errors', W.errors.join(' | '));
    console.log(`\n${pass} passed, ${fail} failed`);
    W.dom.window.close();
    process.exit(fail ? 1 : 0);
})();
