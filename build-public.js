#!/usr/bin/env node
'use strict';
/**
 * Build the PUBLIC (deployable) copy of the Argument Mapper from the PRIVATE
 * source of truth.
 *
 *   node build-public.js                       (r26 -> argument-mapper-public.html)
 *   node build-public.js in.html out.html
 *   node build-public.js --no-mangle-toplevel  (comments+locals only; keeps
 *                                               readable function names)
 *
 * WHY: the private file's value is not really its syntax — it is the comments,
 * which record why the merge engine works, which bugs were hit, and why the
 * obvious fixes were wrong. The public build removes all of that, minifies,
 * and renames functions/variables, so a reader can run the app but cannot
 * cheaply lift a subsystem out of it.
 *
 * HONEST LIMIT: this is a speed bump, not protection. Anything a browser can
 * run can be recovered by someone determined. It stops casual copy-paste of
 * "the good parts"; it does not stop wholesale copying (for that, the banner's
 * copyright line is the thing with actual legal weight).
 *
 * WORKFLOW: edit the PRIVATE file only. Then:
 *   node build-public.js
 *   node smoke-public-test.js argument-mapper-public.html
 *   copy argument-mapper-public.html collab-site\index.html
 *   npx firebase-tools deploy --only hosting
 *
 * SAFETY: names that must survive are derived AUTOMATICALLY (see
 * collectReservedNames) rather than hand-listed, because the app references
 * functions from three places a minifier cannot see:
 *   1. inline handlers in the static HTML   (onclick="addChild('support')")
 *   2. inline handlers built inside JS strings (the context menu's innerHTML)
 *   3. window.* assignments called from generated markup
 * Object PROPERTY names are never mangled by terser's defaults, which is what
 * keeps the persisted map schema (trees, texts, _nodeVersions, ...) and the
 * Firebase paths intact — critical, since those names live in saved files and
 * in the shared database and must match across app versions.
 */
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const FLAGS = ['--no-mangle-toplevel', '--rename-vocabulary'];
const args = process.argv.slice(2).filter(a => !FLAGS.includes(a));
const MANGLE_TOPLEVEL = !process.argv.includes('--no-mangle-toplevel');
// Renaming CSS classes/ids/custom-properties to opaque tokens is OFF by
// default. It works and is guarded, but it is NOT what a normal production
// build does: ordinary minification is invisible (every site ships it), while
// heavy obfuscation is conspicuous on a free tool. It is also the fragile
// part — names the app assembles at runtime (`arrow-${type}`) must be detected
// and exempted, and a miss breaks styling silently. Opt in with
// --rename-vocabulary if you ever want it.
const RENAME_VOCAB = process.argv.includes('--rename-vocabulary');
const SRC = path.resolve(args[0] || path.join(__dirname, 'argument-mapper-r27.html'));
const OUT = path.resolve(args[1] || path.join(__dirname, 'argument-mapper-public.html'));

// Kept verbatim in the output. Under AGPL-3.0 §13 anyone who runs a modified
// version over a network must offer its source to users — including us — so
// the banner carries the source link rather than merely a rights notice.
const SOURCE_URL = 'https://github.com/cljohnson703/argument-mapper';
const BANNER = `/*!
 * Argument Mapper — Copyright (c) ${new Date().getFullYear()} C. L. Johnson.
 *
 * Licensed under the GNU Affero General Public License, version 3 (AGPL-3.0).
 * You may use, study, share and modify this program freely. If you run a
 * modified version and let others use it over a network, you MUST also offer
 * them its complete corresponding source under the same licence.
 *
 * Complete corresponding source: ${SOURCE_URL}
 * This file is a compiled artifact and is NOT the preferred form for
 * modification.
 *
 * "Argument Mapper" and the project's name and branding are NOT licensed and
 * remain the author's. Attribution to the original author must be preserved
 * (AGPL-3.0 §7(b)).
 *
 * NO WARRANTY: this program is provided "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * express or implied, including but not limited to the warranties of
 * merchantability, fitness for a particular purpose and non-infringement. In
 * no event shall the author be liable for any claim, damages or other
 * liability arising from, out of or in connection with the software or its
 * use. See the AGPL-3.0 for the full terms.
 */`;

function fail(msg) { console.error('BUILD FAILED: ' + msg); process.exit(1); }

// --- 1. Locate the application's inline <script> ---------------------------
// The head also carries external KaTeX <script src> tags; those are left
// alone. The app is the largest inline block.
function findAppScript(html) {
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let m, best = null;
    while ((m = re.exec(html)) !== null) {
        if (/\bsrc\s*=/i.test(m[1])) continue;            // external: skip
        const body = m[2];
        if (!best || body.length > best.body.length) {
            best = { start: m.index, end: re.lastIndex, attrs: m[1], body: body,
                     openTagEnd: m.index + m[0].indexOf('>') + 1 };
        }
    }
    return best;
}

// --- 2. Names that must NOT be renamed ------------------------------------
// Scans the WHOLE file (markup and JS string literals alike) for inline event
// handlers and javascript: URLs, then harvests every identifier that is called
// or referenced inside them. A missed name here is a button that silently
// stops working, so this deliberately over-collects.
function collectReservedNames(html) {
    const reserved = new Set();
    const handlerAttr = /\bon[a-z]+\s*=\s*(["'])([\s\S]*?)\1/gi;
    let m;
    while ((m = handlerAttr.exec(html)) !== null) harvest(m[2]);
    const jsUrl = /javascript:([^"'`]+)/gi;
    while ((m = jsUrl.exec(html)) !== null) harvest(m[1]);
    // window.NAME = ... (called from generated markup as a window property)
    const winProp = /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g;
    while ((m = winProp.exec(html)) !== null) reserved.add(m[1]);

    function harvest(code) {
        const ident = /[A-Za-z_$][\w$]*/g;
        let i;
        while ((i = ident.exec(code)) !== null) reserved.add(i[0]);
    }
    // Globals the app is entitled to expect from the platform, plus the
    // debug/support hook the deployed app keeps for diagnosing user reports.
    ['window', 'document', 'console', 'localStorage', 'sessionStorage',
     'indexedDB', 'navigator', 'location', 'history', 'crypto', 'JSON', 'Math',
     'Date', 'Promise', 'Set', 'Map', 'Object', 'Array', 'String', 'Number',
     'Boolean', 'RegExp', 'Error', 'event', 'this', 'true', 'false', 'null',
     'undefined', 'function', 'return', 'var', 'let', 'const', 'if', 'else',
     'new', 'typeof', 'katex', '__argmap', '__argmapFirebaseModules'
    ].forEach(n => reserved.add(n));
    return reserved;
}

// --- 3. CSS / HTML comment stripping --------------------------------------
// Conservative: CSS `content:` strings in this app contain no comment
// markers, so the block-comment pattern cannot eat live declarations. The
// smoke test re-checks that the stylesheet still parses and applies.
// --- KaTeX, embedded so the downloaded file is TRULY self-contained -------
// The source loads KaTeX from a CDN, which means math silently fails to
// render offline. The public build inlines it instead: the script, the
// stylesheet, and the fonts as base64 data: URIs, so the file has ZERO
// external requests and works with no network at all.
//   * only .woff2 fonts are embedded — every browser this app already
//     requires supports woff2, and the .woff/.ttf fallbacks would triple the
//     payload for no one;
//   * contrib/auto-render.js is dropped entirely: the app only ever calls
//     katex.renderToString(), never renderMathInElement().
const KATEX_DIR = path.join(__dirname, 'node_modules', 'katex', 'dist');
function inlineKatex(headHtml) {
    if (!fs.existsSync(path.join(KATEX_DIR, 'katex.min.js'))) {
        fail('KaTeX is not installed, so the build cannot be made offline-capable.\n'
           + '        Run:  npm install --save-dev katex@0.16.11');
    }
    let css = fs.readFileSync(path.join(KATEX_DIR, 'katex.min.css'), 'utf8');
    let fonts = 0;
    css = css.replace(/url\(fonts\/([\w-]+)\.woff2\)/g, (m, name) => {
        const f = path.join(KATEX_DIR, 'fonts', name + '.woff2');
        if (!fs.existsSync(f)) return m;
        fonts++;
        return 'url(data:font/woff2;base64,' + fs.readFileSync(f).toString('base64') + ')';
    });
    // Drop the legacy woff/ttf sources now that woff2 is embedded.
    css = css.replace(/,\s*url\(fonts\/[\w-]+\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)/g, '');
    const js = fs.readFileSync(path.join(KATEX_DIR, 'katex.min.js'), 'utf8');
    const out = headHtml
        .replace(/<link\b[^>]*katex[^>]*>\s*/gi, '')
        .replace(/<script\b[^>]*katex[^>]*>\s*<\/script>\s*/gi, '');
    const inject = '<style>' + css + '</style><script>' + js + '</script>';
    console.log(`KaTeX       : embedded (${fonts} woff2 fonts inlined; auto-render dropped, unused)`);
    return out.replace(/<\/head>/i, inject + '</head>');
}

function stripCssComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ''); }
function stripHtmlComments(html) { return html.replace(/<!--(?!\[if)[\s\S]*?-->/g, ''); }

// Collapse the stylesheet onto one line. Deliberately CONSERVATIVE:
//   * quoted strings (content: "…") are protected, so their spacing survives;
//   * whitespace is only tightened around { } ; and , — NOT around : + > ~ .
//     `:` matters because `a :hover` (descendant) and `a:hover` (pseudo) are
//     different selectors, and `+`/`-` must keep their spaces inside calc(),
//     which this stylesheet uses (calc(100% + 6px)).
function minifyCss(css) {
    const strings = [];
    let s = css.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, m => {
        strings.push(m); return ' S' + (strings.length - 1) + ' ';
    });
    s = s.replace(/\s+/g, ' ')
         .replace(/\s*([{};,])\s*/g, '$1')
         .replace(/;}/g, '}')
         .trim();
    return s.replace(/ S(\d+) /g, (m, i) => strings[+i]);
}

// Collapse markup indentation. This is RENDERING-NEUTRAL: HTML already
// collapses a run of whitespace to a single space, so turning "newline +
// indentation" into exactly one space cannot change layout. <pre> and
// <textarea> (where whitespace IS significant) are protected.
function collapseHtml(html) {
    const keep = [];
    let s = html.replace(/<(pre|textarea)\b[\s\S]*?<\/\1>/gi, m => {
        keep.push(m); return ' H' + (keep.length - 1) + ' ';
    });
    s = s.replace(/\s*\n\s*/g, ' ');
    return s.replace(/ H(\d+) /g, (m, i) => keep[+i]);
}

// --- 4. Presentation-vocabulary renaming ----------------------------------
// Renames the CSS/DOM "vocabulary" — custom properties, element ids, and
// HYPHENATED class names — to opaque tokens, so the built file reads like
// gibberish rather than a self-documenting UI.
//
// SAFETY — why this can't corrupt the app's logic:
//   * Custom properties are the `--x` namespace; that prefix never appears in
//     free text or JS identifiers, so exact-token replacement is collision-
//     free.
//   * Hyphenated class names (`node-group`, `present-mode`) can NEVER be a JS
//     property access — hyphens are illegal in identifiers — so they only ever
//     occur in selector/attribute/classList contexts. We still replace them
//     ONLY in those contexts (a leading `.`, a quoted token, or inside a
//     class="" value), never in arbitrary text, so even a hyphenated word that
//     happened to appear in prose is untouched.
//   * ids are replaced only inside `#id` selectors, `id="..."` attributes, and
//     getElementById('...') calls — never free text.
// Single-word class names (`who`, `note`, `dot`, `open`) are deliberately left
// alone: they collide with JS property names and prose, so renaming them can't
// be done safely by textual transform. They reveal little on their own.
// Object PROPERTY names (the saved-map schema, Firebase paths) are untouched —
// mangling them would break saved files and the shared database.
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
// Operates on the three regions SEPARATELY. Markup/CSS and JS have different
// quoting rules, and running a JS-string matcher across HTML (which is full of
// attribute quotes) mis-pairs quotes and silently skips real strings.
function renameVocabulary(parts) {
    let head = parts.head, js = parts.js, tail = parts.tail;
    const all = () => head + '\n' + js + '\n' + tail;
    const uniqIn = (text, re, group) => {
        const set = new Set(); let m;
        const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
        while ((m = r.exec(text)) !== null) set.add(m[group]);
        return [...set];
    };
    const uniq = (re, group) => uniqIn(all(), re, group);
    const bylen = arr => arr.sort((a, b) => b.length - a.length);   // longest first: avoid prefix overlap
    let nClass = 0, nId = 0, nVar = 0;

    // --- names ASSEMBLED AT RUNTIME must never be renamed ------------------
    // The app looks things up with constructed strings:
    //     document.getElementById(`arrow-${type}`)      // SVG arrowheads
    //     'type-' + node.type                            // node colour classes
    //     getElementById('group-' + node.id)             // node wrappers
    // Renaming the STATIC definition (id="arrow-support", .type-objection)
    // while the lookup still builds the original name at runtime silently
    // breaks the feature — arrowheads vanish, type colours stop applying —
    // and no leftover-name check can catch it, because only the FRAGMENT
    // ("arrow-", "type-") appears in the source, never the whole name.
    // So: any name beginning with a dynamically-built prefix is left intact,
    // which keeps definition and lookup consistent. Correctness over
    // obfuscation.
    // The fragment is whatever identifier-ish token TRAILS the literal text,
    // which is not necessarily at the start of the string: the node colour
    // class is built as `node type-${node.type}` — the useful prefix is
    // "type-", sitting after "node ". So take the text preceding each `${`
    // (or each string that is concatenated) and keep its trailing token.
    const dynPrefixes = new Set(), dynSuffixes = new Set();
    const addTrailing = text => {
        const m = /([A-Za-z][\w-]*-)$/.exec(text);
        if (m) dynPrefixes.add(m[1]);
    };
    let dm;
    const tlRe = /\$\{/g;                                   // template-literal holes
    while ((dm = tlRe.exec(js)) !== null) addTrailing(js.slice(Math.max(0, dm.index - 80), dm.index));
    const catRe = /(["'])((?:[^"'\\\n]|\\.)*)\1\s*\+/g;     // '…prefix-' + expr
    while ((dm = catRe.exec(js)) !== null) addTrailing(dm[2]);
    const sufRe = /\+\s*(["'])(-[\w-]+)\1/g;                // expr + '-suffix'
    while ((dm = sufRe.exec(js)) !== null) dynSuffixes.add(dm[2]);
    const dynSkipped = [];
    const isDynamic = n => {
        for (const p of dynPrefixes) if (n.length > p.length && n.startsWith(p)) return true;
        for (const s of dynSuffixes) if (n.length > s.length && n.endsWith(s)) return true;
        return false;
    };

    // --- custom properties: the `--` namespace never collides ---
    const props = bylen(uniq(/--([a-z][a-z0-9-]*)/, 0));
    props.forEach(name => {
        const tok = '--v' + (nVar++).toString(36);
        const re = new RegExp('(?<![\\w-])' + escRe(name) + '(?![\\w-])', 'g');
        head = head.replace(re, tok); js = js.replace(re, tok); tail = tail.replace(re, tok);
    });

    // --- ids: collect the authoritative set from getElementById + id="" ---
    const idSet = new Set();
    uniq(/getElementById\((["'])([A-Za-z][\w-]*)\1/, 2).forEach(id => idSet.add(id));
    uniq(/\bid=(["'])([A-Za-z][\w-]*)\1/, 2).forEach(id => idSet.add(id));
    // An id string turns up in far more shapes than `id=` and getElementById:
    // `el.id === "x"`, `el.id !== "x"`, arrays of ids, aria-labelledby="x",
    // for="x". Renaming EVERY quoted occurrence of the token covers them all,
    // which is safe because these names are distinctive — with two exclusions:
    //   * HTML tag names: an id may share a name with a tag, and the same
    //     quoted string is then also createElement("canvas") — renaming that
    //     would be catastrophic. Such ids are left alone ENTIRELY so the
    //     stylesheet and the markup stay consistent with each other.
    //   * dynamic id PREFIXES (ids ending in "-", e.g. getElementById("group-"
    //     + node.id)): the full id is assembled at runtime, so renaming the
    //     literal would break every lookup.
    const ID_SKIP = new Set(['canvas', 'body', 'html', 'head', 'main', 'header', 'footer',
        'nav', 'section', 'article', 'aside', 'form', 'input', 'button', 'label', 'select',
        'option', 'textarea', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'ul', 'ol', 'li',
        'a', 'p', 'div', 'span', 'img', 'video', 'audio', 'svg', 'marquee', 'style', 'script',
        'title', 'code', 'pre', 'text', 'group']);
    const idSkipped = [];
    const idMap = {};
    bylen([...idSet]).forEach(id => {
        if (ID_SKIP.has(id) || /-$/.test(id)) { idSkipped.push(id); return; }
        if (isDynamic(id)) { dynSkipped.push(id); return; }
        idMap[id] = 'i' + (nId++).toString(36);
    });
    bylen(Object.keys(idMap)).forEach(id => {
        const t = idMap[id], e = escRe(id);
        const hashRe = new RegExp('#' + e + '(?![\\w-])', 'g');                 // CSS + selector strings
        const quotedRe = new RegExp('(["\'])' + e + '\\1', 'g');                // attributes + every quoted use
        head = head.replace(hashRe, '#' + t).replace(quotedRe, '$1' + t + '$1');
        tail = tail.replace(hashRe, '#' + t).replace(quotedRe, '$1' + t + '$1');
        js = js.replace(hashRe, '#' + t).replace(quotedRe, '$1' + t + '$1');
    });

    // --- hyphenated classes -------------------------------------------------
    // COLLECT ONLY FROM THE STYLESHEET and from class attributes. Scanning the
    // whole file for `.name` is WRONG: minified arithmetic like
    // `e.offsetWidth-e.clientWidth` reads exactly like a hyphenated selector
    // (`.offsetWidth-e`), and renaming that phantom corrupts real code.
    const styleCss = [];
    head.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m, css) => { styleCss.push(css); return m; });
    const cssText = styleCss.join('\n');
    const clsSet = new Set();
    const HYPH = /^[A-Za-z][\w-]*-[\w-]+$/;
    let cm;
    const cssCls = /\.([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)/g;
    while ((cm = cssCls.exec(cssText)) !== null) clsSet.add(cm[1]);
    const collectAttrs = text => {
        let x;
        const a = /\bclass=(["'])([^"'`]*)\1/g;
        while ((x = a.exec(text)) !== null) x[2].split(/\s+/).forEach(t => { if (HYPH.test(t)) clsSet.add(t); });
        const b = /className\s*=\s*(["'])([^"'`]*)\1/g;
        while ((x = b.exec(text)) !== null) x[2].split(/\s+/).forEach(t => { if (HYPH.test(t)) clsSet.add(t); });
    };
    collectAttrs(head); collectAttrs(tail); collectAttrs(js);
    const clsMap = {};
    bylen([...clsSet]).forEach(c => {
        if (isDynamic(c)) { dynSkipped.push(c); return; }
        clsMap[c] = 'c' + (nClass++).toString(36);
    });

    // Alternations (longest-first) so one pass handles every name.
    // NOTE: no attempt is made to tokenize the JS. Minified code contains
    // regex literals such as /["\\]/g whose quote characters desynchronise any
    // regex-based string scanner, so "only inside string literals" cannot be
    // implemented reliably without a real parser. Instead we rely on the two
    // shapes a class name can take — `.name` (selector) and `"name"` (quoted
    // token) — which are safe here precisely BECAUSE the name set now comes
    // only from the stylesheet: every entry is a genuine hyphenated class, and
    // a hyphen cannot appear in a JS identifier or property.
    const clsNames = bylen(Object.keys(clsMap));
    const alt = clsNames.map(escRe).join('|');
    const clsAlt = clsNames.length ? new RegExp('\\.(' + alt + ')(?![\\w-])', 'g') : null;
    const clsQuoted = clsNames.length ? new RegExp('(["\'])(' + alt + ')\\1', 'g') : null;
    const rewriteVal = v => v.split(/(\s+)/).map(p => clsMap[p] || p).join('');
    const rewriteRegion = text => {
        let t = text;
        if (clsAlt) t = t.replace(clsAlt, (_, n) => '.' + clsMap[n]);           // .class selectors (CSS + selector strings)
        if (clsQuoted) t = t.replace(clsQuoted, (_, q, n) => q + clsMap[n] + q); // classList args, fragments
        return t
            .replace(/\bclass=(["'])([^"'`]*)\1/g, (m, q, v) => 'class=' + q + rewriteVal(v) + q)
            .replace(/className\s*=\s*(["'])([^"'`]*)\1/g, (m, q, v) => 'className=' + q + rewriteVal(v) + q);
    };
    head = rewriteRegion(head);
    tail = rewriteRegion(tail);
    js = rewriteRegion(js);

    // --- completeness check ------------------------------------------------
    // A rename that updates the stylesheet but misses a selector string in the
    // JS fails SILENTLY (an element never receives its style, or an id
    // comparison becomes permanently false). So after renaming, any surviving
    // occurrence of an old name as a quoted string or selector is treated as
    // an incomplete rename and ABORTS the build. Genuine free-text collisions
    // are whitelisted by name.
    const freeTextOk = new Set(['note', 'code', 'open', 'active', 'reply', 'more', 'who', 'dot', 'nm']);
    const stale = [];
    const final = all();
    Object.keys(idMap).forEach(n => {
        if (freeTextOk.has(n)) return;   // deliberately-skipped ids are not in idMap at all
        const e = escRe(n), hits = [];
        if (new RegExp('(["\'])' + e + '\\1').test(final)) hits.push('quoted string');
        if (new RegExp('#' + e + '(?![\\w-])').test(final)) hits.push('#selector');
        if (hits.length) stale.push(`id "${n}" (${hits.join(', ')})`);
    });
    Object.keys(clsMap).forEach(n => {
        if (freeTextOk.has(n)) return;
        const e = escRe(n), hits = [];
        if (new RegExp('(["\'])' + e + '\\1').test(final)) hits.push('quoted string');
        if (new RegExp('\\.' + e + '(?![\\w-])').test(final)) hits.push('.selector');
        if (hits.length) stale.push(`class "${n}" (${hits.join(', ')})`);
    });
    props.forEach(n => { if (final.indexOf(n) !== -1) stale.push(`var "${n}"`); });

    return { head, js, tail, counts: { classes: nClass, ids: nId, vars: nVar },
             stale, idSkipped, dynSkipped, dynPrefixes: [...dynPrefixes, ...dynSuffixes] };
}

(async () => {
    if (!fs.existsSync(SRC)) fail('source not found: ' + SRC);
    if (path.resolve(SRC) === path.resolve(OUT)) fail('refusing to overwrite the private source with the build');
    const html = fs.readFileSync(SRC, 'utf8');

    const app = findAppScript(html);
    if (!app || app.body.length < 10000) fail('could not locate the application <script> block');

    const reserved = collectReservedNames(html);
    console.log(`Source      : ${path.basename(SRC)} (${(html.length / 1024).toFixed(0)} KB)`);
    console.log(`App script  : ${(app.body.length / 1024).toFixed(0)} KB`);
    console.log(`Reserved    : ${reserved.size} names must keep their identity (handlers, window.*, platform)`);
    console.log(`Mangle top  : ${MANGLE_TOPLEVEL ? 'yes — function names become dummies' : 'no (--no-mangle-toplevel)'}`);

    const result = await minify(app.body, {
        ecma: 2020,
        compress: {
            passes: 2,
            // console output is the support channel (__argmap.diagnose(), the
            // build marker, collaboration warnings) — keep it.
            drop_console: false,
            drop_debugger: true,
        },
        mangle: {
            toplevel: MANGLE_TOPLEVEL,
            reserved: Array.from(reserved),
            // properties are NEVER mangled: the map schema and Firebase paths
            // are persisted data and must stay byte-compatible across builds.
            properties: false,
        },
        format: { comments: false, beautify: false },
        sourceMap: false,
    }).catch(e => fail('terser: ' + (e && e.message)));

    if (!result || typeof result.code !== 'string' || !result.code.length) fail('terser produced no output');

    // Reassemble: markup before the script, the built script, markup after.
    let head = html.slice(0, app.openTagEnd);
    let tail = html.slice(app.end - '</script>'.length);

    // Comments out, stylesheet minified, markup indentation collapsed.
    head = stripHtmlComments(head).replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi,
        (whole, attrs, css) => `<style${attrs}>${minifyCss(stripCssComments(css))}</style>`);
    tail = stripHtmlComments(tail);
    head = collapseHtml(head);
    tail = collapseHtml(tail);
    head = inlineKatex(head);   // after minification: KaTeX ships pre-minified

    let out, vocab = null;
    if (RENAME_VOCAB) {
        vocab = renameVocabulary({ head, js: result.code, tail });
        out = vocab.head + '\n' + BANNER + '\n' + vocab.js + '\n' + vocab.tail;
        console.log(`Vocabulary  : ${vocab.counts.vars} css vars, ${vocab.counts.ids} ids, ${vocab.counts.classes} hyphenated classes renamed`);
        if (vocab.idSkipped.length) {
            console.log(`              (kept, tag-name/prefix collision: ${vocab.idSkipped.join(', ')})`);
        }
        if (vocab.dynSkipped.length) {
            console.log(`              (kept, built at runtime from ${vocab.dynPrefixes.map(p => `"${p}"`).join(', ')}: `
                + `${vocab.dynSkipped.slice(0, 12).join(', ')}${vocab.dynSkipped.length > 12 ? ` +${vocab.dynSkipped.length - 12} more` : ''})`);
        }
        // An incomplete rename breaks the app silently — refuse to emit it.
        if (vocab.stale.length) {
            fail('vocabulary rename was INCOMPLETE — these old names survive and would\n'
                + '        break styling or id checks at runtime:\n          - '
                + vocab.stale.slice(0, 25).join('\n          - ')
                + (vocab.stale.length > 25 ? `\n          (+${vocab.stale.length - 25} more)` : ''));
        }
    } else {
        out = head + '\n' + BANNER + '\n' + result.code + '\n' + tail;
        console.log('Vocabulary  : left intact (standard build; --rename-vocabulary to obfuscate it)');
    }

    fs.writeFileSync(OUT, out, 'utf8');

    const before = html.length, after = out.length;
    console.log(`Output      : ${path.basename(OUT)} (${(after / 1024).toFixed(0)} KB, ${(100 - after / before * 100).toFixed(1)}% smaller)`);
    // A build that still contains the private commentary has silently failed
    // at its one job; catch that here rather than after deploying.
    const leakMarkers = [
        'HONEST LIMIT', 'round 14', 'field report', 'defect 3',
        'the exact reported bug', 'KEEP IN SYNC',
    ];
    const leaked = leakMarkers.filter(s => out.includes(s));
    if (leaked.length) fail('private commentary survived the build: ' + leaked.join(', '));
    console.log('Comments    : stripped (JS, CSS, HTML)');
    console.log('\nNext: node smoke-public-test.js ' + path.basename(OUT));
})();
