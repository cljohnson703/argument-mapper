'use strict';
// Two-client collaboration regression for r25 selected-forest drag/drop.
//
// Geometry is deliberately deterministic: buildSelectedDragForest() supplies
// the real normalized forest, while classifyDrop()/ghostRectFor() are stubbed
// to choose an exact destination.  From that boundary onward the production
// batch mutation, history, version stamping, memory transport, merge, undo and
// redo paths all run unchanged.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || (__dirname + '/argument-mapper-r25.html'), 'utf8');

function makeWin(label) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e))));
  function stubs(win) {
    const { webcrypto } = require('crypto');
    if (!win.crypto || !win.crypto.randomUUID) {
      Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
    }
    win.matchMedia = win.matchMedia || (() => ({
      matches: false, media: '', addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
    }));
    win.ResizeObserver = win.ResizeObserver || function () {
      return { observe() {}, unobserve() {}, disconnect() {} };
    };
    const ctx = new Proxy({}, {
      get: (_target, prop) => prop === 'measureText' ? (() => ({ width: 0 })) : (() => ctx)
    });
    win.HTMLCanvasElement.prototype.getContext = () => ctx;
    win.indexedDB = win.indexedDB || {
      open() {
        const req = {};
        setTimeout(() => req.onerror && req.onerror({ target: { error: new Error('indexedDB unavailable in test') } }), 0);
        return req;
      },
      deleteDatabase() {
        const req = {};
        setTimeout(() => req.onsuccess && req.onsuccess({}), 0);
        return req;
      }
    };
    win.requestAnimationFrame = win.requestAnimationFrame || (cb => setTimeout(() => cb(Date.now()), 0));
    win.cancelAnimationFrame = win.cancelAnimationFrame || clearTimeout;
    win.scrollTo = () => {};
    win.alert = () => {};
    win.confirm = () => true;
    win.prompt = () => null;
    win.open = () => null;
  }
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    url: `https://localhost/${label}.html`, beforeParse: stubs
  });
  return { dom, errors, get win() { return dom.window; } };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const N = (id, children = [], text = id, extra = {}) => Object.assign({
  id, type: 'support', texts: [text], collapsed: [], children
}, extra);

function nodesOf(w) {
  const out = {};
  (function walk(nodes, parent) {
    (nodes || []).forEach(n => {
      out[n.id] = { node: n, parent };
      walk(n.children, n);
    });
  })(w.__argmap.state.trees, null);
  return out;
}
const node = (w, id) => (nodesOf(w)[id] || {}).node;
const parentId = (w, id) => {
  const hit = nodesOf(w)[id];
  return hit && hit.parent ? hit.parent.id : null;
};
const childIds = (w, id) => ((node(w, id) || {}).children || []).map(n => n.id);
const rootIds = w => w.__argmap.state.trees.map(n => n.id);
const refs = (w, id, idx = 0) => (((node(w, id) || {}).crossRefs || [])[idx] || []);
const comments = (w, id, idx = 0) => (((node(w, id) || {}).evalThreads || [])[idx] || []);
const commentByText = (w, id, idx, text) => comments(w, id, idx).find(c => c && !c.deleted && c.text === text);
function commentHosts(w, commentId) {
  const out = [];
  Object.values(nodesOf(w)).forEach(({ node: n }) => {
    (n.evalThreads || []).forEach((thread, idx) => {
      if ((thread || []).some(c => c && !c.deleted && c.id === commentId)) out.push(`${n.id}#${idx}`);
    });
  });
  return out;
}
const fp = w => w.eval('__argmap.syncFingerprint(__argmap.state)');

function defocus(w) {
  const active = w.document.activeElement;
  if (active && active.blur) active.blur();
  if (active && active.dispatchEvent) {
    active.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true }));
  }
}

async function ctx2() {
  const A = makeWin('r25-sync-a');
  const B = makeWin('r25-sync-b');
  await sleep(340);
  const GA = A.win.__argmap;
  const GB = B.win.__argmap;
  if (!GA || !GB) throw new Error('r25 did not expose __argmap');
  const store = { content: null, version: 0, subs: new Set() };
  await GA.initSync(GA.createMemoryTransport({ store }), { pollInterval: 1e9, pushDebounce: 1e9 });
  await GB.initSync(GB.createMemoryTransport({ store }), { pollInterval: 1e9, pushDebounce: 1e9 });
  A.win.applySignIn('Alice');
  B.win.applySignIn('Bob');

  const sync = async (rounds = 1) => {
    defocus(A.win); defocus(B.win);
    for (let i = 0; i < rounds; i++) {
      await GA.engine.pushNow();
      await GB.engine.syncNow();
      await GB.engine.pushNow();
      await GA.engine.syncNow();
    }
  };
  await sync(2);
  return { A, B, GA, GB, store, sync, root: GA.state.trees[0].id };
}

function close2(c) {
  try { c.A.win.close(); } catch (_) {}
  try { c.B.win.close(); } catch (_) {}
}

async function seed(c, children) {
  const payload = JSON.stringify(children);
  c.A.win.eval(`
    (function(){
      var root = findNodeContext(state.trees, ${JSON.stringify(c.root)}).node;
      root.children = ${payload};
      render();
      autosaveNow();
    })();
  `);
  await c.sync(2);
  if (fp(c.A.win) !== fp(c.B.win)) throw new Error('fixture failed to converge');
  clearHistory(c);
}

function clearHistory(c) {
  c.A.win.eval('undoStack = []; redoStack = []; _shadowSnapshot = JSON.stringify(state);');
  c.B.win.eval('undoStack = []; redoStack = []; _shadowSnapshot = JSON.stringify(state);');
}

// Arm the production forest planner and batch mutation code.  Only geometry
// classification is fixed so this jsdom regression is independent of layout.
function armBatch(w, selection, classification, anchors, options = {}) {
  w.__argmap.selectedIds = selection.slice();
  const startLeft = options.startLeft == null ? 100 : options.startLeft;
  const startTop = options.startTop == null ? 200 : options.startTop;
  const dropLeft = options.dropLeft == null ? 500 : options.dropLeft;
  const dropTop = options.dropTop == null ? 400 : options.dropTop;
  w.eval(`
    (function(){
      var forest = buildSelectedDragForest();
      var anchors = ${JSON.stringify(anchors)};
      forest.units.forEach(function(unit){
        var a = anchors[unit.sourceId];
        if (!a) throw new Error('missing deterministic anchor for ' + unit.sourceId);
        unit.anchorLeft = a.left;
        unit.anchorTop = a.top;
      });
      ghostRectFor = function(){ return {left:${dropLeft},top:${dropTop},w:100,h:40}; };
      probeRectFor = function(){ return {left:${dropLeft},top:${dropTop},w:60,h:40}; };
      withinDragSlop = function(){ return false; };
      screenDragDistance = function(){ return 9999; };
      classifyDrop = function(){ return ${JSON.stringify(classification)}; };
      dragCtx = {
        mode:'forest', id:forest.units[0].sourceId, idx:0, idxs:null,
        units:forest.units, selectedCandidates:forest.selectedCandidates,
        preservesSelectedConnection:forest.preservesSelectedConnection,
        candidateCount:forest.candidateCount,
        startSX:0, startSY:0, grabDX:0, grabDY:0, gw:100, gh:40,
        startGhostLeft:${startLeft}, startGhostTop:${startTop},
        draggedParentId:forest.commonParentId,
        canReorderRow:!!forest.commonParentId,
        targets:[], groupCenters:{}, lastHL:null, overlay:null
      };
      window.__r25SyncPlan = {
        candidates: forest.candidateCount,
        units: forest.units.map(function(u){ return u.sourceId; }),
        commonParentId: forest.commonParentId
      };
    })();
  `);
  return w.__r25SyncPlan;
}

function executeBatch(w, { shift = false, alt = false } = {}) {
  w.eval(`executeDrop({
    shiftKey:${shift}, altKey:${alt},
    clientX:500, clientY:400, screenX:500, screenY:400
  }); autosaveNow();`);
}

let pass = 0;
let fail = 0;
const failures = [];
function ok(condition, label) {
  if (condition) {
    pass++;
    console.log('  \u2713 ' + label);
  } else {
    fail++;
    failures.push(label);
    console.log('  \u2717 FAIL: ' + label);
  }
}
function converged(c, label) {
  ok(fp(c.A.win) === fp(c.B.win), label);
}
function noRuntimeErrors(c, label) {
  const errors = c.A.errors.concat(c.B.errors);
  ok(errors.length === 0, errors.length ? `${label}: ${errors[0]}` : label);
}

async function freeMoveCase() {
  const c = await ctx2();
  try {
    await seed(c, [N('A', [N('AK')], 'alpha'), N('B', [], 'beta')]);
    const plan = armBatch(c.A.win, ['B-0', 'A-0'], { type: 'detach' }, {
      A: { left: 100, top: 200 },
      B: { left: 340, top: 260 }
    });
    ok(plan.candidates === 2 && plan.units.join(',') === 'A,B', 'free: real forest plan is deterministic despite reverse selection order');
    const beforeHistory = c.A.win.eval('undoStack.length');
    executeBatch(c.A.win, { shift: true });
    ok(c.A.win.eval('undoStack.length') === beforeHistory + 1, 'free: two-root move records exactly one history step');
    await c.sync(2);

    for (const w of [c.A.win, c.B.win]) {
      ok(rootIds(w).includes('A') && rootIds(w).includes('B') && parentId(w, 'AK') === 'A', 'free: both selected identities and A subtree survive');
      ok(node(w, 'A').freePosition === true && node(w, 'A').x === 500 && node(w, 'A').y === 400, 'free: first root is pinned at the translated position');
      ok(node(w, 'B').freePosition === true && node(w, 'B').x === 740 && node(w, 'B').y === 460, 'free: second root preserves the exact pairwise offset');
      ok(!w.__argmap.state._deletions.A && !w.__argmap.state._deletions.B && !w.__argmap.state._deletions.AK, 'free: identity-preserving move creates no tombstones');
    }
    converged(c, 'free: push/pull fingerprints converge');

    c.A.win.undo();
    await c.sync(2);
    for (const w of [c.A.win, c.B.win]) {
      ok(parentId(w, 'A') === c.root && parentId(w, 'B') === c.root, 'free: one undo reattaches the complete batch on both clients');
      ok(!node(w, 'A').freePosition && !node(w, 'B').freePosition, 'free: undo removes free-root placement metadata on both clients');
    }
    converged(c, 'free: undo propagates and converges');

    c.A.win.redo();
    await c.sync(2);
    for (const w of [c.A.win, c.B.win]) {
      ok(parentId(w, 'A') === null && parentId(w, 'B') === null && node(w, 'A').x === 500 && node(w, 'B').x === 740, 'free: one redo restores the whole translated batch on both clients');
    }
    converged(c, 'free: redo propagates and converges');
    noRuntimeErrors(c, 'free: no jsdom runtime errors');
  } finally {
    close2(c);
  }
}

async function childReparentCase() {
  const c = await ctx2();
  try {
    await seed(c, [
      N('A', [], 'alpha', { crossRefs: [[{ targetId: 'B', targetIdx: 0 }]] }),
      N('B', [], 'beta'),
      N('T', [], 'target')
    ]);
    const plan = armBatch(c.A.win, ['A-0', 'B-0'], { type: 'child', T: { id: 'T', idx: 0 } }, {
      A: { left: 100, top: 200 },
      B: { left: 300, top: 200 }
    });
    ok(plan.units.join(',') === 'A,B' && plan.commonParentId === c.root, 'child: real forest plan retains stable sibling order and common parent');
    const beforeHistory = c.A.win.eval('undoStack.length');
    executeBatch(c.A.win);
    ok(c.A.win.eval('undoStack.length') === beforeHistory + 1, 'child: two-node reparent records exactly one history step');
    await c.sync(2);

    for (const w of [c.A.win, c.B.win]) {
      ok(parentId(w, 'A') === 'T' && parentId(w, 'B') === 'T' && childIds(w, 'T').join(',') === 'A,B', 'child: both identities reparent as one stable ordered batch');
      ok(refs(w, 'A').some(r => r.targetId === 'B' && r.targetIdx === 0), 'child: metadata reference between moved members survives');
      ok(!w.__argmap.state._deletions.A && !w.__argmap.state._deletions.B, 'child: ordinary reparent creates no source tombstones');
    }
    converged(c, 'child: push/pull fingerprints converge');

    c.A.win.undo();
    await c.sync(2);
    for (const w of [c.A.win, c.B.win]) {
      ok(parentId(w, 'A') === c.root && parentId(w, 'B') === c.root && childIds(w, 'T').length === 0, 'child: one undo restores both original parent links on both clients');
      ok(refs(w, 'A').some(r => r.targetId === 'B'), 'child: undo retains the inter-member reference');
    }
    converged(c, 'child: undo propagates and converges');

    c.A.win.redo();
    await c.sync(2);
    for (const w of [c.A.win, c.B.win]) {
      ok(parentId(w, 'A') === 'T' && parentId(w, 'B') === 'T', 'child: one redo re-applies both parent links on both clients');
      ok(refs(w, 'A').some(r => r.targetId === 'B'), 'child: redo still preserves the inter-member reference');
    }
    converged(c, 'child: redo propagates and converges');
    noRuntimeErrors(c, 'child: no jsdom runtime errors');
  } finally {
    close2(c);
  }
}

async function coPremiseCase() {
  const c = await ctx2();
  try {
    await seed(c, [
      N('A', [N('AK')], 'alpha'),
      N('B', [N('BK')], 'beta'),
      N('T', [], 'target')
    ]);

    c.B.win.addComment({ kind: 'box', id: 'A', idx: 0 }, 'bob note on alpha');
    c.B.win.autosaveNow();
    await c.sync(2);
    c.A.win.addComment({ kind: 'box', id: 'B', idx: 0 }, 'alice note on beta');
    c.A.win.autosaveNow();
    await c.sync(2);
    const alphaCommentId = commentByText(c.A.win, 'A', 0, 'bob note on alpha').id;
    const betaCommentId = commentByText(c.A.win, 'B', 0, 'alice note on beta').id;
    clearHistory(c);

    const plan = armBatch(c.A.win, ['B-0', 'A-0'], {
      type: 'copremise', T: { id: 'T', idx: 0 }, side: 'right'
    }, {
      A: { left: 100, top: 200 },
      B: { left: 300, top: 200 }
    });
    ok(plan.units.join(',') === 'A,B', 'co-premise: real forest plan deterministically orders the two sources');
    const beforeHistory = c.A.win.eval('undoStack.length');
    executeBatch(c.A.win);
    ok(c.A.win.eval('undoStack.length') === beforeHistory + 1, 'co-premise: two-source merge records exactly one history step');
    await c.sync(2);

    for (const w of [c.A.win, c.B.win]) {
      ok(node(w, 'T').texts.join('|') === 'target|alpha|beta' && !node(w, 'A') && !node(w, 'B'), 'co-premise: source statements merge in order and consumed source identities disappear');
      ok(parentId(w, 'AK') === 'T' && parentId(w, 'BK') === 'T', 'co-premise: both child subtree identities survive under the target');
      ok(!!w.__argmap.state._deletions.A && !!w.__argmap.state._deletions.B, 'co-premise: both consumed source identities receive tombstones');
      ok(!w.__argmap.state._deletions.AK && !w.__argmap.state._deletions.BK && !w.__argmap.state._deletions.T, 'co-premise: surviving children and target are not tombstoned');
      ok(comments(w, 'T', 1).some(x => x.id === alphaCommentId) && comments(w, 'T', 2).some(x => x.id === betaCommentId), 'co-premise: collaborator comments travel with their exact box identities');
      ok(!Object.values(w.__argmap.state._orphanComments || {}).some(x => x.id === alphaCommentId || x.id === betaCommentId), 'co-premise: moved comments are not orphaned');
    }
    converged(c, 'co-premise: push/pull fingerprints converge');

    c.A.win.undo();
    await c.sync(2);
    for (const w of [c.A.win, c.B.win]) {
      ok(!!node(w, 'A') && !!node(w, 'B') && node(w, 'T').texts.join('|') === 'target', 'co-premise: one undo resurrects both sources on both clients');
      ok(commentByText(w, 'A', 0, 'bob note on alpha').id === alphaCommentId && commentByText(w, 'B', 0, 'alice note on beta').id === betaCommentId, 'co-premise: undo restores each exact comment to its source box');
      ok(parentId(w, 'AK') === 'A' && parentId(w, 'BK') === 'B', 'co-premise: undo restores both subtree parent links');
      const target = node(w, 'T');
      const parallelFields = ['aligns', 'statuses', 'statusAuthors', 'implicits', 'evalNotes', 'crossRefs', 'evalThreads'];
      ok(parallelFields.every(field => !Array.isArray(target[field]) || target[field].length <= target.texts.length), 'co-premise: undo-sync bounds every target per-box array to the restored text count');
      ok(commentHosts(w, alphaCommentId).join(',') === 'A#0' && commentHosts(w, betaCommentId).join(',') === 'B#0', 'co-premise: undo-sync leaves each comment on exactly its restored source box');
    }
    converged(c, 'co-premise: undo propagates and converges');
    ok(c.A.win.eval('redoStack.length') === 1, 'co-premise: undo-sync preserves the one-step redo entry');

    c.A.win.redo();
    const immediateRedo = {
      a: !!node(c.A.win, 'A'), b: !!node(c.A.win, 'B'),
      target: node(c.A.win, 'T') && node(c.A.win, 'T').texts.join('|'),
      versionA: c.GA.state._nodeVersions.A,
      versionB: c.GA.state._nodeVersions.B,
      versionT: c.GA.state._nodeVersions.T,
      deletionA: c.GA.state._deletions.A,
      deletionB: c.GA.state._deletions.B
    };
    const immediateComplete = !immediateRedo.a && !immediateRedo.b && immediateRedo.target === 'target|alpha|beta';
    ok(immediateComplete, 'co-premise: redo is structurally complete before transport' + (immediateComplete ? '' : ` (${JSON.stringify(immediateRedo)})`));
    await c.sync(2);
    for (const w of [c.A.win, c.B.win]) {
      const redoShape = `A=${!!node(w, 'A')},B=${!!node(w, 'B')},T=${node(w, 'T') && node(w, 'T').texts.join('|')},vA=${JSON.stringify(w.__argmap.state._nodeVersions.A)},vB=${JSON.stringify(w.__argmap.state._nodeVersions.B)},vT=${JSON.stringify(w.__argmap.state._nodeVersions.T)},dA=${JSON.stringify(w.__argmap.state._deletions.A)},dB=${JSON.stringify(w.__argmap.state._deletions.B)}`;
      const redoComplete = !node(w, 'A') && !node(w, 'B') && node(w, 'T').texts.join('|') === 'target|alpha|beta';
      ok(redoComplete, 'co-premise: one redo re-applies the complete merge on both clients' + (redoComplete ? '' : ` (${redoShape})`));
      ok(comments(w, 'T', 1).some(x => x.id === alphaCommentId) && comments(w, 'T', 2).some(x => x.id === betaCommentId), 'co-premise: redo reattaches the same comment identities to the merged boxes');
      ok(!!w.__argmap.state._deletions.A && !!w.__argmap.state._deletions.B, 'co-premise: redo propagates both source tombstones');
    }
    converged(c, 'co-premise: redo propagates and converges');
    noRuntimeErrors(c, 'co-premise: no jsdom runtime errors');
  } finally {
    close2(c);
  }
}

// Diagnostic control: the same comment/history sequence through the legacy
// single-group executeDrop branch, proving whether a failure is batch-specific.
async function legacySingleCommentControl() {
  const c = await ctx2();
  try {
    await seed(c, [N('A', [], 'alpha'), N('T', [], 'target')]);
    c.B.win.addComment({ kind: 'box', id: 'A', idx: 0 }, 'legacy control note');
    c.B.win.autosaveNow();
    await c.sync(2);
    clearHistory(c);
    c.A.win.eval(`
      ghostRectFor = function(){ return {left:500,top:400,w:100,h:40}; };
      probeRectFor = function(){ return {left:500,top:400,w:60,h:40}; };
      withinDragSlop = function(){ return false; };
      screenDragDistance = function(){ return 9999; };
      classifyDrop = function(){ return {type:'copremise',T:{id:'T',idx:0},side:'right'}; };
      dragCtx = {mode:'group',id:'A',idx:0,idxs:null,startSX:0,startSY:0,
        grabDX:0,grabDY:0,gw:100,gh:40,draggedParentId:${JSON.stringify(c.root)},
        targets:[],groupCenters:{},lastHL:null,overlay:null};
      executeDrop({shiftKey:false,altKey:false,clientX:500,clientY:400,screenX:500,screenY:400});
      autosaveNow();
    `);
    await c.sync(2);
    c.A.win.undo();
    await c.sync(2);
    const depth = c.A.win.eval('redoStack.length');
    const staleThreads = comments(c.A.win, 'T', 1).map(x => x.text);
    ok(depth === 1, `legacy control: undo-sync preserves redo history (depth=${depth}, staleTargetThreads=${JSON.stringify(staleThreads)})`);
    c.A.win.redo();
    ok(!node(c.A.win, 'A') && node(c.A.win, 'T').texts.join('|') === 'target|alpha', 'legacy control: redo re-applies a single commented co-premise move');
  } finally {
    close2(c);
  }
}

(async () => {
  console.log('\n=== r25 selected-forest drag: two-client sync ===');
  await freeMoveCase();
  await childReparentCase();
  await coPremiseCase();
  await legacySingleCommentControl();
  console.log(`\n--- selected-forest sync: ${pass} passed, ${fail} failed ---`);
  failures.forEach(x => console.log('  - ' + x));
  process.exit(fail ? 1 : 0);
})().catch(err => {
  console.error('HARNESS ERROR', err && err.stack || err);
  process.exit(2);
});
