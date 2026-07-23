# Build & Deploy — private source → public build

There are now **two copies** of the app, on purpose:

| File | Role | Who sees it |
|---|---|---|
| `argument-mapper-r27.html` | **PRIVATE source of truth** — full comments, readable names. Edit ONLY this. | You |
| `argument-mapper-public.html` | **PUBLIC build** — comments stripped, code minified, function/variable names mangled, and the CSS/DOM vocabulary renamed to opaque tokens. Generated, never hand-edited. | Everyone (this is what gets deployed) |

(`argument-mapper-r26.html` is kept as the previous release; each round copies
forward rather than overwriting, so there is always a known-good fallback.)

`build-public.js` turns the first into the second — a **standard production
build**, nothing exotic:

1. strips every comment (JS, CSS, HTML) — the comments are the real IP, and
   they also carry development narrative you may not want published;
2. minifies the JS and mangles function/variable names (`renderRichText` → `e`);
3. minifies the stylesheet and collapses markup indentation (the whole file
   lands on ~8 lines);
4. adds the copyright banner.

**Why not heavier obfuscation?** Minification is invisible — every production
site ships it, so nobody looks twice. Aggressive obfuscation (string-array
encoding, control-flow flattening) is conspicuous: it's what commercial or
DRM'd code looks like, and on a free tool it invites the question "what's being
hidden here?" It also costs real runtime on a layout-heavy app, and it cannot
protect against the thing that actually matters — someone copying the whole
file wholesale, which needs no reading at all. Licensing and public provenance
are the real defences there; see the note at the end.

An optional `--rename-vocabulary` pass exists (renames CSS custom properties,
ids and hyphenated classes to opaque tokens). It is **off by default** and
should stay that way unless you have a specific reason: it is the fragile part
of the pipeline, because any name the app assembles at runtime — `arrow-${type}`
for the SVG arrowheads, `` `node type-${node.type}` `` for the colour classes —
must be detected and exempted, and a miss breaks styling **silently**. It is
guarded (the build aborts on an incomplete rename, and the smoke test asserts
type classes and arrowhead markers still resolve), but off is the safer default.

**What deliberately stays readable, and why:**

* **The saved-map schema** (`trees`, `texts`, `evalThreads`, `_nodeVersions`).
  These names are written into every saved `.json` file and *are* the Firebase
  database schema. Renaming them would make the app unable to read users' saved
  maps or the shared rooms, and would split collaborators across versions.
* **Short single-word class names** (`node`, `note`, `who`, `dot`). They collide
  with JS property names and ordinary prose, so no textual transform can rename
  them safely. They reveal little on their own.
* **Ids that share a name with an HTML tag** (`canvas`) and **names assembled
  at runtime**. This last category is the important one and cost a real bug:
  the app looks things up with constructed strings —
  `` getElementById(`arrow-${type}`) `` for the SVG arrowheads and
  `` `node type-${node.type}` `` for the node colour classes. Renaming the
  *static* definition (`id="arrow-support"`, `.type-objection`) while the
  lookup still builds the original name at runtime made every arrowhead vanish
  and every node draw in the support colour. The build now detects these
  prefixes (`arrow-`, `type-`, `status-`, `group-`, `drop-…`) and leaves the
  whole family intact so definition and lookup stay consistent. It prints them
  on every run. **If you ever add a new runtime-built name, the build will
  protect it automatically — but check the "built at runtime" line to confirm.**
* **`window.__argmap`**, the support/diagnostic hook. It names mangled
  internals but reveals no logic, and it powers `__argmap.diagnose()` plus the
  build's own smoke test.

**Honest limit:** this is a speed bump, not protection. Any code a browser runs
can be recovered by someone determined — you can always poke a copy until it
gives up its behavior. What this buys is cost: the algorithms and the UI
vocabulary are no longer readable at a glance. The copyright banner is the part
with actual legal weight against wholesale copying.

## The update loop

Whenever you change the app:

```
# 1. edit the PRIVATE file only:  argument-mapper-r27.html

# 2. build the public copy
node build-public.js

# 3. prove the build still works (both must pass)
node xss-r26-render-test.js argument-mapper-r27.html
node smoke-public-test.js argument-mapper-public.html

# 4. deploy the PUBLIC copy
copy argument-mapper-public.html collab-site\index.html
npx firebase-tools deploy --only hosting
```

The build **refuses to emit output** if the vocabulary rename was incomplete —
i.e. if any old class/id/variable name still survives where it would break
styling or an id check. That turns the one failure mode that would otherwise
ship silently (a class renamed in the stylesheet but not in the JS that adds
it) into a loud build error.

Answer **Yes** to the "Overwrite collab-site\index.html" prompt (it's just the
Windows copy command replacing the staging file). Add `,database` to the deploy
(`--only hosting,database`) only when you changed the security rules.

## Full test before a release

Run every suite against the PRIVATE file, then the smoke test against the
BUILD:

```
for %f in (layout-r23-tests layout-r23-box-collision-test layout-r23-depth-channel-test routing-r23-tests routing-r23-cross-target-test layout-r24-spread-shadow-tests layout-r24-spread-dom-test layout-r24-clearance-sweep-test layout-r24-clearance-fuzz-test layout-r24-compact-cycle-test routing-r24-center-endpoint-test layout-r25-edge-centering-test routing-r25-edge-fork-source-test multidrag-r25-tests multidrag-r25-sync-test shortcut-r25-free-node-test stringmode-r26-label-test xss-r26-render-test collab-r26-firebase-test) do @node %f.js argument-mapper-r27.html
node smoke-public-test.js argument-mapper-public.html
```

**One check no test can do for you:** jsdom does not apply CSS, so it cannot
detect a broken stylesheet rename. After a build, open
`argument-mapper-public.html` in a real browser and confirm the app is styled
(dark background, bordered nodes), the Collaborate dialog opens, and `P`
(present mode) still greys out interaction. Those three exercise a custom
property, a renamed id, and a JS-added renamed class respectively.

(The behavioral suites run against the PRIVATE file, because they reach app
internals by their real names — which the build deliberately renames. The
public build is validated by (a) the smoke test through the public surface and
(b) being a mechanical, semantics-preserving transform of the tested source.)

## How the build stays safe

`build-public.js` uses Terser with two guardrails that matter:

- **Reserved names.** It scans the whole file for inline `onclick=`/`on*=`
  handlers, `javascript:` URLs, and `window.NAME =` assignments, and forbids
  renaming any identifier used there. This is automatic — you never hand-list
  names — because the app calls functions from places a minifier can't see
  (static HTML handlers, handlers built inside JS strings for the context
  menu, and `window.*` globals invoked from generated markup). If you add a new
  toolbar button or context-menu item, its handler is protected automatically.
- **Property names are never mangled.** The saved-map schema (`trees`, `texts`,
  `_nodeVersions`, …) and the Firebase paths (`rooms/$id/document`, …) are
  persisted data that must stay byte-compatible across app versions and live in
  users' files and the shared database. Terser's default (mangle locals and
  top-level function/var names, but not object properties) is exactly right;
  the build keeps it.

The build also self-checks: it refuses to write output if any known private
comment marker survived, and the smoke test independently re-checks that the
commentary is gone and that every inline handler still resolves.

## Keeping KaTeX current

KaTeX is **embedded** in the build, and deliberately **pinned** — the app makes
no network requests at runtime, so it cannot (and must not) check for updates
itself. Doing so would break the "solo use sends nothing anywhere" guarantee
and would let a third party change the app's behaviour after you shipped it.

Update on your own schedule instead, with the test suite as the gate:

```
npm outdated katex          # is there a newer one?
npm install --save-dev katex@latest
node build-public.js
npm test                    # all suites must pass
```

Then open the built file and confirm maths still renders — type `$\frac{a}{b}$`
into a node. Pay particular attention after a MINOR bump (0.16 → 0.17): the
`trust` option that `renderRichText` relies on to block `\href{javascript:…}`
is a KaTeX API, and `xss-r26-render-test.js` is what proves it still works.
If anything regresses, `npm install --save-dev katex@<previous>` and rebuild.

## Options

- `node build-public.js in.html out.html` — custom paths.
- `node build-public.js --no-mangle-toplevel` — strip comments and minify, but
  keep readable function names (useful if you ever need to debug the built
  file against a user report).
