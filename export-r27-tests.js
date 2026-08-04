'use strict';
// r27 export regressions.
//
// (1) SVG/PNG export lost every connector LINE while still showing the
//     arrowheads. Cause: the live paths colour themselves with CSS custom
//     properties — stroke="var(--color-support)" — which resolve against the
//     page's :root. A standalone .svg file has no :root, so the stroke was
//     invalid and painted nothing; the <marker> defs carry literal hex fills
//     and render regardless of the path's stroke, which is why the arrowheads
//     survived and the lines did not. The export now resolves var() to a real
//     colour on the way out.
//
// (2) Saving went straight to the browser's Downloads folder. Saves now offer
//     a real "Save As" dialog where the browser supports it
//     (window.showSaveFilePicker), falling back to a download elsewhere, and
//     a cancelled dialog must not claim the file was saved.
//
// Run:  node export-r27-tests.js [argument-mapper-r27.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || (__dirname + '/argument-mapper-r27.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
        win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true; win.prompt = () => null; win.open = () => null;
        win.URL.createObjectURL = win.URL.createObjectURL || (() => 'blob:fake');
        win.URL.revokeObjectURL = win.URL.revokeObjectURL || (() => {});
        if (opts.beforeParse) opts.beforeParse(win);
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}

const MAP = [{
    id: 'm', type: 'contention', texts: ['Main claim'], collapsed: [], children: [
        { id: 's1', type: 'support', texts: ['Support one'], collapsed: [], children: [] },
        { id: 'o1', type: 'objection', texts: ['Objection one'], collapsed: [], children: [] },
        { id: 'r1', type: 'rebuttal', texts: ['Rebuttal one'], collapsed: [], children: [] }
    ]
}];

(async () => {
    console.log('=== r27 export: connector colours + Save As ===');
    const W = makeWin('exp');
    await sleep(360);

    // --- 1. The export must contain NO unresolved CSS variables ----------
    const res = W.win.eval(`
        (function () {
            __argmap.state.trees = ${JSON.stringify(MAP)};
            __argmap.selectedIds = ['m-0'];
            cycleLabels(); cycleLabels(); cycleLabels();
            var svg = buildExportSVG();
            if (!svg) return JSON.stringify({ error: 'buildExportSVG returned null' });
            var paths = (svg.match(/<path[^>]*>/g) || []);
            var strokes = paths.map(function (p) { var m = p.match(/stroke="([^"]*)"/); return m ? m[1] : '(none)'; });
            return JSON.stringify({
                svgLen: svg.length,
                pathCount: paths.length,
                strokes: strokes,
                anyVarLeft: /var\\(/.test(svg),
                hasDefs: /<defs/.test(svg),
                markerCount: (svg.match(/<marker /g) || []).length
            });
        })();
    `);
    const r = JSON.parse(res);
    ok(!r.error, 'export: buildExportSVG produced output', r.error);
    ok(r.pathCount >= 3, 'export: connector paths are present', 'paths=' + r.pathCount);
    ok(r.anyVarLeft === false, 'export: NO unresolved var() survives anywhere in the SVG',
        'strokes=' + JSON.stringify(r.strokes));
    ok(r.strokes.length > 0 && r.strokes.every(s => s !== '(none)' && !/^var\(/.test(s)),
        'export: every connector has a literal stroke colour', JSON.stringify(r.strokes));
    ok(r.hasDefs && r.markerCount >= 4, 'export: arrowhead markers still included',
        'markers=' + r.markerCount);

    // --- 2. Fallback value is honoured when a property is undefined ------
    const fb = W.win.eval(`
        (function () {
            var rs = getComputedStyle(document.documentElement);
            var s = 'a="var(--definitely-not-defined, #abcdef)" b="var(--also-missing)"';
            return s.replace(/var\\(\\s*(--[A-Za-z0-9-]+)\\s*(?:,\\s*([^)]*))?\\)/g, function (w, n, f) {
                var v = rs.getPropertyValue(n).trim();
                return v || (f ? f.trim() : '#888888');
            });
        })();
    `);
    ok(fb.indexOf('#abcdef') >= 0, 'export: a var() fallback colour is used when the property is unset', fb);
    ok(fb.indexOf('var(') === -1, 'export: an unset property with no fallback still resolves to a colour', fb);

    // --- 3. Save As: uses the picker when the browser has one ------------
    {
        const S = makeWin('saveas', {
            beforeParse(win) {
                win.__picked = [];
                win.showSaveFilePicker = function (opts) {
                    win.__picked.push(opts);
                    return Promise.resolve({
                        createWritable: () => Promise.resolve({
                            write: (b) => { win.__wrote = b; return Promise.resolve(); },
                            close: () => Promise.resolve()
                        })
                    });
                };
            }
        });
        await sleep(360);
        const out = await S.win.eval(`
            (function () {
                __argmap.state.trees = ${JSON.stringify(MAP)};
                __argmap.state.name = 'My Great Map!';
                return saveBlobAs(new Blob(['x'], { type: 'application/json' }),
                    exportBaseName() + '.json', 'Argument map (JSON)', 'application/json', '.json')
                    .then(function (res) {
                        return JSON.stringify({
                            res: res,
                            calls: window.__picked.length,
                            suggested: window.__picked[0] && window.__picked[0].suggestedName,
                            wrote: !!window.__wrote
                        });
                    });
            })();
        `);
        const o = JSON.parse(out);
        ok(o.calls === 1, 'save as: the picker is used when available', 'calls=' + o.calls);
        ok(o.res.saved === true && o.res.picked === true, 'save as: reports a real user-chosen save', JSON.stringify(o.res));
        ok(o.wrote === true, 'save as: the file contents are actually written');
        ok(o.suggested === 'My Great Map.json',
            'save as: suggested filename comes from the map name, sanitised', String(o.suggested));
        S.win.close();
    }

    // --- 4. Save As: a cancelled dialog must NOT claim success -----------
    {
        const C = makeWin('cancel', {
            beforeParse(win) {
                win.showSaveFilePicker = function () {
                    const e = new Error('user aborted'); e.name = 'AbortError';
                    return Promise.reject(e);
                };
            }
        });
        await sleep(360);
        const out = await C.win.eval(`
            (function () {
                var before = lastSaveTime;
                return saveBlobAs(new Blob(['x']), 'X.json', 'j', 'application/json', '.json')
                    .then(function (res) { return JSON.stringify({ res: res, sameTime: before === lastSaveTime }); });
            })();
        `);
        const o = JSON.parse(out);
        ok(o.res.saved === false, 'save as: cancelling reports saved:false', JSON.stringify(o.res));

        // And through saveMap(), "Last Saved" must not move on a cancel.
        const t = await C.win.eval(`
            (function () {
                lastSaveTime = null;
                saveMap();
                return new Promise(function (r) { setTimeout(function () { r(String(lastSaveTime)); }, 60); });
            })();
        `);
        ok(t === 'null', 'save as: a cancelled save does not update "Last Saved"', t);
        C.win.close();
    }

    // --- 5. No picker (Firefox/Safari): falls back to a download ---------
    {
        const F = makeWin('fallback', { beforeParse(win) { delete win.showSaveFilePicker; } });
        await sleep(360);
        const out = await F.win.eval(`
            (function () {
                var clicked = 0;
                var origCreate = document.createElement.bind(document);
                document.createElement = function (tag) {
                    var el = origCreate(tag);
                    if (String(tag).toLowerCase() === 'a') { el.click = function () { clicked++; }; }
                    return el;
                };
                return saveBlobAs(new Blob(['x']), 'Y.json', 'j', 'application/json', '.json')
                    .then(function (res) {
                        document.createElement = origCreate;
                        return JSON.stringify({ res: res, clicked: clicked });
                    });
            })();
        `);
        const o = JSON.parse(out);
        ok(o.res.saved === true && o.res.picked === false,
            'no picker: falls back to a download and says so', JSON.stringify(o.res));
        ok(o.clicked === 1, 'no picker: exactly one download was triggered', 'clicks=' + o.clicked);
        F.win.close();
    }

    // --- 6. Linked file: pick once, then write with no dialog ------------
    {
        const L = makeWin('linked', {
            beforeParse(win) {
                win.__writes = []; win.__pickerCalls = 0;
                win.__makeHandle = function (name) {
                    return {
                        name: name,
                        queryPermission: () => Promise.resolve(win.__perm || 'granted'),
                        requestPermission: () => { win.__requested = (win.__requested || 0) + 1; return Promise.resolve(win.__grantOnRequest === false ? 'denied' : 'granted'); },
                        createWritable: () => Promise.resolve({
                            write: (b) => { win.__writes.push(b); return Promise.resolve(); },
                            close: () => Promise.resolve()
                        })
                    };
                };
                win.showSaveFilePicker = function () {
                    win.__pickerCalls++;
                    return Promise.resolve(win.__makeHandle('Linked Map.json'));
                };
            }
        });
        await sleep(360);

        const r1 = JSON.parse(await L.win.eval(`
            (function () {
                __argmap.state.trees = ${JSON.stringify(MAP)};
                __argmap.state.name = 'Linked Map';
                return saveMap().then(function () {
                    return JSON.stringify({ picker: window.__pickerCalls, writes: window.__writes.length, name: linkedFileName() });
                });
            })();
        `));
        ok(r1.picker === 1 && r1.writes === 1, 'linked file: the first save asks where to put it', JSON.stringify(r1));
        ok(r1.name === 'Linked Map.json', 'linked file: the map is now linked to that file', String(r1.name));

        // Second save must NOT re-prompt.
        const r2 = JSON.parse(await L.win.eval(`
            saveMap().then(function () {
                return JSON.stringify({ picker: window.__pickerCalls, writes: window.__writes.length });
            });
        `));
        ok(r2.picker === 1, 'linked file: later saves do NOT open a dialog again', 'picker=' + r2.picker);
        ok(r2.writes === 2, 'linked file: the file is written again', 'writes=' + r2.writes);

        // The indicator must name the file rather than claim "browser only".
        const ind = L.win.eval(`document.getElementById('save-indicator').textContent`);
        ok(/Linked Map\.json/.test(ind), 'linked file: the indicator names the file', ind);
        ok(!/browser only/i.test(ind), 'linked file: the indicator no longer says browser-only', ind);

        // Autosave keeps the linked file current (debounced ~2.5s).
        const before = L.win.eval('window.__writes.length');
        L.win.eval(`__argmap.state.trees[0].texts[0] = 'Edited for autosave'; autosaveNow(true);`);
        await sleep(3000);
        const after = L.win.eval('window.__writes.length');
        ok(after > before, 'linked file: Autosave writes through to the file too', before + ' -> ' + after);

        // "Save As…" re-prompts and relinks.
        const r3 = JSON.parse(await L.win.eval(`
            saveMapAs().then(function () { return JSON.stringify({ picker: window.__pickerCalls }); });
        `));
        ok(r3.picker === 2, 'linked file: Save As… asks again', 'picker=' + r3.picker);
        L.win.close();
    }

    // --- 7. After a reload the link is remembered but needs a gesture ----
    {
        const P = makeWin('perm', {
            beforeParse(win) {
                win.__requested = 0; win.__writes = [];
                win.showSaveFilePicker = function () { return Promise.resolve({ name: 'x.json' }); };
            }
        });
        await sleep(360);
        const out = JSON.parse(await P.win.eval(`
            (function () {
                // Simulate a handle restored from IndexedDB whose permission
                // has lapsed to 'prompt' (what a browser restart produces).
                var h = {
                    name: 'Restored.json',
                    queryPermission: function(){ return Promise.resolve('prompt'); },
                    requestPermission: function(){ window.__requested++; return Promise.resolve('granted'); },
                    createWritable: function(){ return Promise.resolve({
                        write: function(b){ window.__writes.push(b); return Promise.resolve(); },
                        close: function(){ return Promise.resolve(); } }); }
                };
                setLinkedFile(h, 'prompt');
                // A TIMER-driven autosave must never raise a permission prompt.
                return writeLinkedFile(false).then(function (a) {
                    // An explicit user save may, and then writes.
                    return writeLinkedFile(true).then(function (b) {
                        return JSON.stringify({ auto: a, manual: b, requested: window.__requested, writes: window.__writes.length });
                    });
                });
            })();
        `));
        ok(out.auto.written === false && out.auto.reason === 'needs-permission',
            'reconnect: a background autosave never prompts for permission', JSON.stringify(out.auto));
        ok(out.requested === 1 && out.manual.written === true,
            'reconnect: an explicit save re-requests permission, then writes', JSON.stringify(out.manual));
        P.win.close();
    }

    // --- 8. Guard against silently discarding unsaved local work ---------
    {
        const G = makeWin('guard', { beforeParse(win) { delete win.showSaveFilePicker; } });
        await sleep(360);
        const out = JSON.parse(G.win.eval(`
            (function () {
                var asked = [];
                window.confirm = function (m) { asked.push(m); return false; };   // user backs out
                // Fresh boot placeholder: nothing stamped yet => nothing to lose.
                var pristine = hasUnsavedLocalWork();
                // Make a real edit so the map has content only in the browser.
                __argmap.state.trees = ${JSON.stringify(MAP)};
                diffAndStamp(__argmap.state);
                var dirty = hasUnsavedLocalWork();
                var before = JSON.stringify(__argmap.state.trees).length;
                newMap();                       // should be blocked by the confirm
                var after = JSON.stringify(__argmap.state.trees).length;
                return JSON.stringify({ pristine: pristine, dirty: dirty, asked: asked.length,
                                        warned: asked.some(function(m){ return /never been saved to a file/.test(m); }),
                                        unchanged: before === after });
            })();
        `));
        ok(out.pristine === false, 'guard: an untouched boot map is not treated as unsaved work');
        ok(out.dirty === true, 'guard: an edited, never-saved map IS flagged');
        ok(out.warned === true, 'guard: New Map warns that the map has never reached a file', JSON.stringify(out));
        ok(out.unchanged === true, 'guard: cancelling leaves the map intact');
        G.win.close();
    }

    ok(W.errors.length === 0, 'no jsdom runtime errors', W.errors.slice(0, 2).join(' | '));
    console.log(`\n--- export-r27: ${pass} passed, ${fail} failed ---`);
    try { W.win.close(); } catch (e) {}
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e && e.stack || e); process.exit(2); });
