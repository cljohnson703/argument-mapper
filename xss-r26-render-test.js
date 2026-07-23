'use strict';
// r26 XSS / injection regression for the collaborative rendering paths.
//
// Threat model: an editor authors text (node boxes, comments) that syncs to
// every collaborator and is rendered in their browser via innerHTML. The
// question is always: can author A execute script in viewer B's browser?
//
// Covers: raw-HTML escaping, markdown-link scheme validation, attribute
// quote-escaping, @mention escaping, presence display-name escaping, and the
// KaTeX trust policy (the one real hole found in the audit: trust:true let
// \href{javascript:...} through; the fix is a protocol allowlist).
//
// KaTeX itself is a CDN script jsdom never loads, so we STUB window.katex to
// capture the options renderRichText passes and exercise the trust predicate
// directly — that tests the fix without a browser.
//
// Run:  node xss-r26-render-test.js [argument-mapper-r26.html]
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || (__dirname + '/argument-mapper-r26.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(c, label, detail) {
    if (c) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

// Capture every options object handed to katex.renderToString.
const katexCalls = [];
function makeWin(label) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e))));
    function stubs(win) {
        const { webcrypto } = require('crypto');
        if (!win.crypto || !win.crypto.randomUUID) Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
        win.matchMedia = win.matchMedia || (() => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }));
        win.ResizeObserver = win.ResizeObserver || function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
        const ctx = new Proxy({}, { get: (_t, p) => p === 'measureText' ? (() => ({ width: 0 })) : (() => ctx) });
        win.HTMLCanvasElement.prototype.getContext = () => ctx;
        win.indexedDB = win.indexedDB || { open() { const r = {}; setTimeout(() => r.onerror && r.onerror({ target: { error: new Error('x') } }), 0); return r; }, deleteDatabase() { const r = {}; setTimeout(() => r.onsuccess && r.onsuccess({}), 0); return r; } };
        win.requestAnimationFrame = win.requestAnimationFrame || (cb => win.setTimeout(() => cb(Date.now()), 0));
        win.cancelAnimationFrame = win.cancelAnimationFrame || win.clearTimeout;
        win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true; win.prompt = () => null; win.open = () => null;
        // Fake KaTeX: record options, and SIMULATE trusted rendering so we can
        // prove the trust predicate is what gates a javascript: href. Mirrors
        // KaTeX's contract: \href is rendered as an anchor only if trust()
        // returns true for that context.
        win.katex = {
            renderToString: function (tex, opts) {
                katexCalls.push({ tex, opts });
                const hrefRe = /\\href\{([^}]*)\}\{([^}]*)\}/;
                const m = hrefRe.exec(tex);
                if (m) {
                    const url = m[1], text = m[2];
                    const proto = /^\s*([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
                    const protocol = proto ? proto[1].toLowerCase() : '_relative';
                    const trusted = typeof opts.trust === 'function'
                        ? opts.trust({ command: '\\href', url, protocol })
                        : !!opts.trust;
                    if (trusted) return '<a href="' + url + '">' + text + '</a>';
                    return '<span class="katex">' + text + '</span>';   // KaTeX drops the link when untrusted
                }
                return '<span class="katex">math</span>';
            }
        };
    }
    const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: `https://localhost/${label}.html`, beforeParse: stubs });
    return { dom, errors, get win() { return dom.window; } };
}

// Render arbitrary author text the way a node box does, then inspect the
// resulting LIVE DOM — not the HTML string — so escaped text like
// "&lt;img onerror=…&gt;" (which contains the substring "onerror=" but is
// inert) is correctly judged safe. What matters is real elements/attributes.
function renderToDom(W, text, raw) {
    return W.win.eval(`
        (function () {
            __argmap.state.trees = [{ id:'v', type:'contention', texts:[${JSON.stringify(text)}], ${raw ? 'raw:{0:true},' : ''} collapsed:[], children:[] }];
            __argmap.selectedIds = ['v-0'];
            cycleLabels(); cycleLabels(); cycleLabels();
            var host = document.querySelector('.node[data-node-id="v"]');
            var rd = host && host.querySelector('.rendered-text');
            return rd ? rd.innerHTML : '(no render)';
        })();
    `);
}
// Live-DOM safety analysis of the same render.
function analyze(W, text, raw) {
    return W.win.eval(`
        (function () {
            __argmap.state.trees = [{ id:'v', type:'contention', texts:[${JSON.stringify(text)}], ${raw ? 'raw:{0:true},' : ''} collapsed:[], children:[] }];
            __argmap.selectedIds = ['v-0'];
            cycleLabels(); cycleLabels(); cycleLabels();
            var host = document.querySelector('.node[data-node-id="v"]');
            var rd = host && host.querySelector('.rendered-text');
            if (!rd) return { render: false };
            var danger = rd.querySelectorAll('img,script,svg,iframe,object,embed,base,form,link,style').length;
            var evt = 0, jsUrl = 0, anchors = 0;
            rd.querySelectorAll('*').forEach(function (el) {
                if (el.tagName === 'A') anchors++;
                for (var i = 0; i < el.attributes.length; i++) {
                    var a = el.attributes[i];
                    if (/^on/i.test(a.name)) evt++;
                    if ((a.name === 'href' || a.name === 'src') && /^\\s*(javascript|data|vbscript):/i.test(a.value)) jsUrl++;
                }
            });
            return { render: true, danger: danger, evt: evt, jsUrl: jsUrl, anchors: anchors, html: rd.innerHTML };
        })();
    `);
}

(async () => {
    const W = makeWin('xss');
    await sleep(360);
    console.log('=== r26 XSS / injection regression ===');

    // --- 1. Raw HTML in node text is escaped, never live -----------------
    // "Live" = a real dangerous element or an on* / javascript: attribute in
    // the rendered DOM. Escaped text that merely CONTAINS "onerror=" is fine.
    for (const payload of [
        '<img src=x onerror=alert(1)>',
        '<script>alert(1)</script>',
        '<svg onload=alert(1)>',
        '<iframe src=javascript:alert(1)>',
        '<a href="x" onmouseover="alert(1)">y</a>',
        '<img src=x onerror=alert(1)>'.toUpperCase(),
        '<<script>script>alert(1)<</script>/script>',   // nested/mangled tags
    ]) {
        const a = analyze(W, payload);
        ok(a.render && a.danger === 0 && a.evt === 0 && a.jsUrl === 0,
            'escape: hostile HTML "' + payload.slice(0, 26) + '…" renders with no live node/handler',
            JSON.stringify({ danger: a.danger, evt: a.evt, jsUrl: a.jsUrl }));
    }

    // --- 2. Markdown links can only produce safe schemes -----------------
    {
        // The URL grammar requires http(s)://, www., or a domain, and href
        // always gets https:// prepended — so javascript: cannot form an
        // anchor. The raw text may still be shown literally; that is inert.
        const a = analyze(W, '[click](javascript:alert(1))');
        ok(a.jsUrl === 0 && a.anchors === 0, 'links: [x](javascript:…) makes NO anchor and NO javascript: href',
            JSON.stringify({ jsUrl: a.jsUrl, anchors: a.anchors }));
        const a2 = analyze(W, '[click](data:text/html,<script>alert(1)</script>)');
        ok(a2.jsUrl === 0 && a2.danger === 0, 'links: a data: URL link is inert', JSON.stringify({ jsUrl: a2.jsUrl, danger: a2.danger }));
        const good = analyze(W, 'see [docs](https://example.com/x) here');
        ok(good.anchors === 1 && good.jsUrl === 0 && /href="https:\/\/example\.com\/x"/.test(good.html),
            'links: a genuine https link still renders as one safe anchor', good.html.slice(0, 100));
    }

    // --- 3. Attribute breakout via a crafted link is escaped -------------
    {
        // A quote in the URL/text must not break out of href="…". This was a
        // real bug once; attrEsc closes it.
        const dom = renderToDom(W, '[t](https://a"onclick="alert(1))');
        ok(dom.indexOf('onclick=') === -1 || dom.indexOf('&quot;') >= 0,
            'attributes: a quote in a link URL is escaped, not a live handler', dom.slice(0, 120));
        ok(dom.indexOf('"onclick="alert') === -1, 'attributes: no unescaped onclick attribute appears');
    }

    // --- 4. KaTeX trust policy blocks javascript:, allows https ----------
    {
        katexCalls.length = 0;
        const dom = renderToDom(W, '\\href{javascript:alert(document.cookie)}{click me}');
        const call = katexCalls[katexCalls.length - 1];
        ok(!!call, 'katex: renderRichText routed the \\href through KaTeX');
        ok(typeof call.opts.trust === 'function', 'katex: trust is a FUNCTION, not true', typeof call.opts.trust);
        ok(call.opts.trust({ command: '\\href', url: 'javascript:x', protocol: 'javascript' }) === false,
            'katex: trust() rejects a javascript: href');
        ok(call.opts.trust({ command: '\\href', url: 'data:text/html,x', protocol: 'data' }) === false,
            'katex: trust() rejects a data: href');
        ok(call.opts.trust({ command: '\\includegraphics', url: 'https://x', protocol: 'https' }) === false,
            'katex: trust() rejects other trusted commands (\\includegraphics)');
        ok(call.opts.trust({ command: '\\href', url: 'https://example.com', protocol: 'https' }) === true,
            'katex: trust() allows an https href');
        ok(call.opts.trust({ command: '\\href', url: 'mailto:a@b.c', protocol: 'mailto' }) === true,
            'katex: trust() allows a mailto href');
        ok(dom.indexOf('javascript:') === -1, 'katex: the javascript: href is absent from the rendered DOM', dom.slice(0, 120));
    }

    // --- 5. @mentions and raw-mode text stay escaped ---------------------
    {
        const dom = renderToDom(W, '@<img src=x onerror=alert(1)>', false);
        ok(dom.indexOf('<img') === -1, 'mentions: hostile text after @ is escaped');
        const rawDom = renderToDom(W, '<b>not bold</b><img src=x onerror=alert(1)>', true);
        ok(rawDom.indexOf('<img') === -1 && rawDom.indexOf('<b>') === -1,
            'raw mode: raw-committed text is fully escaped too', rawDom.slice(0, 80));
    }

    // --- 6. Presence display names are escaped (peer-controlled) ---------
    {
        const chip = W.win.eval(`
            (function () {
                var p = { cid: 'c1', label: '<img src=x onerror=alert(1)>', anon: false, me: false };
                return presenceChipHtml(p, { c1: 'hsl(200 68% 45%)' });
            })();
        `);
        ok(chip.indexOf('<img') === -1 && chip.indexOf('&lt;img') >= 0,
            'presence: a hostile display name is escaped in the roster chip', chip.slice(0, 90));
    }

    // --- 7. Comment text uses the same safe renderer --------------------
    {
        const safe = W.win.eval(`
            (function () {
                var out = renderRichText('<img src=x onerror=alert(1)> and \\\\href{javascript:alert(1)}{x}');
                return { hasImg: out.indexOf('<img') >= 0, hasJs: out.indexOf('javascript:') >= 0 };
            })();
        `);
        ok(safe.hasImg === false, 'comments: renderRichText escapes raw HTML');
        ok(safe.hasJs === false, 'comments: renderRichText yields no javascript: URL');
    }

    ok(W.errors.length === 0, 'no jsdom runtime errors', W.errors.slice(0, 2).join(' | '));
    console.log(`\n--- xss-r26-render: ${pass} passed, ${fail} failed ---`);
    try { W.win.close(); } catch (e) {}
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e && e.stack || e); process.exit(2); });
