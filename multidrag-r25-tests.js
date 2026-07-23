'use strict';
// Focused r25 selected-forest drag tests. Geometry classification is stubbed
// here so each test exercises the real batch mutation, history, selection and
// identity paths deterministically. The existing drop-matrix remains the
// separate compatibility gate for every legacy single-unit branch.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(process.argv[2] || (__dirname + '/argument-mapper-r25.html'), 'utf8');
const allRuntimeErrors = [];

function makeWin() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    const msg = String(e && (e.detail || e.message || e));
    errors.push(msg); allRuntimeErrors.push(msg);
  });
  function stubs(win) {
    const { webcrypto } = require('crypto');
    if (!win.crypto || !win.crypto.randomUUID) Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
    win.matchMedia = win.matchMedia || (() => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }));
    win.ResizeObserver = win.ResizeObserver || function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
    const ctx = new Proxy({}, { get: (_t, p) => p === 'measureText' ? (() => ({ width: 0 })) : (() => ctx) });
    win.HTMLCanvasElement.prototype.getContext = () => ctx;
    win.indexedDB = win.indexedDB || { open() { const r = {}; setTimeout(() => r.onerror && r.onerror({ target: { error: new Error('x') } }), 0); return r; } };
    win.requestAnimationFrame = win.requestAnimationFrame || (cb => setTimeout(() => cb(Date.now()), 0));
    win.cancelAnimationFrame = win.cancelAnimationFrame || clearTimeout;
    win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true; win.open = () => null;
  }
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://localhost/r25.html', beforeParse: stubs });
  return { dom, errors, get win() { return dom.window; } };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const N = (id, children = [], text = id) => ({ id, type: 'support', texts: [text], collapsed: [], children });
const R = children => ({ id: 'R', type: 'contention', texts: ['Root'], collapsed: [], children });

function allNodes(w) {
  const out = {};
  (function walk(ns, parent) { (ns || []).forEach(n => { out[n.id] = { n, parent }; walk(n.children, n); }); })(w.__argmap.state.trees, null);
  return out;
}
const node = (w, id) => (allNodes(w)[id] || {}).n;
const parentId = (w, id) => { const x = allNodes(w)[id]; return x && x.parent ? x.parent.id : null; };
const childIds = (w, id) => (node(w, id).children || []).map(n => n.id);

async function fixture(trees, selection) {
  const h = makeWin();
  await sleep(260);
  const w = h.win;
  w.__argmap.state.trees.splice(0, w.__argmap.state.trees.length, ...trees);
  w.__argmap.selectedIds = selection.slice();
  w.eval('undoStack = []; redoStack = []; _shadowSnapshot = JSON.stringify(state); render();');
  await sleep(90);
  return h;
}

function unitJS(u) {
  return `{
    sourceId:${JSON.stringify(u.sourceId)}, kind:${JSON.stringify(u.kind || 'whole')},
    idxs:${JSON.stringify(u.idxs || [0])}, movingIds:new Set(${JSON.stringify(u.movingIds || [u.sourceId])}),
    anchorLeft:${u.anchorLeft || 0}, anchorTop:${u.anchorTop || 0},
    sourceParentId:${JSON.stringify(u.sourceParentId == null ? null : u.sourceParentId)},
    sourceTargetIndex:${u.sourceTargetIndex || 0}, wasFree:${!!u.wasFree},
    requiredIds:new Set(${JSON.stringify(u.requiredIds || [u.sourceId])})
  }`;
}

function arm(w, units, cls, opts = {}) {
  const unitsCode = units.map(unitJS).join(',');
  w.eval(`
    ghostRectFor = function(){ return {left:${opts.dropLeft == null ? 500 : opts.dropLeft},top:${opts.dropTop == null ? 400 : opts.dropTop},w:100,h:40}; };
    probeRectFor = function(){ return {left:500,top:400,w:50,h:40}; };
    withinDragSlop = function(){ return false; };
    screenDragDistance = function(){ return 9999; };
    classifyDrop = function(){ return ${JSON.stringify(cls)}; };
    dragCtx = {
      mode:'forest', id:${JSON.stringify(units[0].sourceId)}, idx:0,
      units:[${unitsCode}], preservesSelectedConnection:${!!opts.preservesSelectedConnection},
      selectedCandidates:${JSON.stringify(opts.selectedCandidates || units.map(u => ({ sourceId: u.sourceId, kind: u.kind || 'whole', idxs: u.idxs || [0] })))},
      candidateCount:${opts.candidateCount || units.length}, startSX:0,startSY:0,
      grabDX:0,grabDY:0,gw:100,gh:40,startGhostLeft:${opts.startGhostLeft == null ? 100 : opts.startGhostLeft},startGhostTop:${opts.startGhostTop == null ? 100 : opts.startGhostTop},
      draggedParentId:${JSON.stringify(opts.commonParentId == null ? null : opts.commonParentId)}, canReorderRow:${!!opts.commonParentId},
      targets:[],groupCenters:{},lastHL:null,overlay:null
    };
  `);
}

function drop(w, { shift = false, alt = false } = {}) {
  w.eval(`executeDrop({shiftKey:${shift},altKey:${alt},clientX:500,clientY:400,screenX:500,screenY:400})`);
}

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label) {
  if (cond) { pass++; console.log('  \u2713 ' + label); }
  else { fail++; failures.push(label); console.log('  \u2717 FAIL: ' + label); }
}
function close(h) { try { h.win.close(); } catch (_) {} }

(async () => {
  console.log('\n=== r25 selected-forest drag ===');

  // Topological normalization is deterministic and retains selected internal edges.
  {
    const h = await fixture([R([N('A', [N('K')]), N('B')])], ['K-0', 'B-0', 'A-0']);
    const w = h.win;
    const f1 = w.eval(`(()=>{const f=buildSelectedDragForest();return {c:f.candidateCount,n:f.units.map(u=>u.sourceId),p:f.preservesSelectedConnection,k:f.units.find(u=>u.sourceId==='A').movingIds.has('K')}})()`);
    ok(f1.c === 3 && f1.n.join(',') === 'A,B', 'ancestor + descendant normalize to one connected unit plus the disconnected root');
    ok(f1.p && f1.k, 'normalization records and preserves the selected A-K connection');
    w.__argmap.selectedIds = ['B-0', 'A-0', 'K-0'];
    const f2 = w.eval(`buildSelectedDragForest().units.map(u=>u.sourceId).join(',')`);
    ok(f2 === 'A,B', 'normalization is independent of selection order');
    w.__argmap.selectedIds = ['A-0'];
    ok(w.eval(`!dragGrabIsSelected(findNodeContext(state.trees,'K').node,0,'group')`), 'an unselected descendant keeps legacy single-unit drag activation');
    close(h);
  }

  // Real pointer activation: singleton nodes use drag mode `group` even though
  // their selection representation is "id-0". Crossing the threshold on one
  // of two selected singleton nodes must therefore choose the forest path.
  {
    const h = await fixture([R([N('A'), N('B')])], ['A-0', 'B-0']);
    const w = h.win;
    w.eval(`
      window.__forestActivation = null;
      startSelectedForestDrag = function(_e,_n,_i,_g,_m,_x,forest) {
        window.__forestActivation = {count:forest.candidateCount, units:forest.units.map(u=>u.sourceId)};
      };
    `);
    const box = w.document.querySelector('.node[data-node-id="A"]');
    box.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 20, clientY: 20, screenX: 20, screenY: 20 }));
    w.document.dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX: 40, clientY: 20, screenX: 40, screenY: 20 }));
    const activation = w.__forestActivation;
    ok(activation && activation.count === 2 && activation.units.join(',') === 'A,B', 'actual singleton pointer drag activates the two-node selected forest');
    w.document.dispatchEvent(new w.MouseEvent('pointercancel', { bubbles: true }));
    close(h);
  }

  // Two disconnected selected roots use one exact translation. Selective Alt
  // keeps selected A-K but leaves every unselected side branch behind.
  {
    const h = await fixture([R([N('A', [N('K', [N('Z')]), N('U')]), N('B', [N('L')])])], ['A-0', 'K-0', 'B-0']);
    const w = h.win;
    const beforeUndo = w.eval('undoStack.length');
    w.eval(`
      lastRenderedSurfaceGeometry.groups.set('Z',{left:170,top:380,right:270,bottom:420});
      lastRenderedSurfaceGeometry.groups.set('U',{left:40,top:310,right:140,bottom:350});
      lastRenderedSurfaceGeometry.groups.set('L',{left:360,top:370,right:460,bottom:410});
      Object.entries({Z:[170,380],U:[40,310],L:[360,370]}).forEach(([id,p]) => {
        const el=document.getElementById('group-'+id); el.style.left=p[0]+'px'; el.style.top=p[1]+'px';
      });
    `);
    arm(w, [
      { sourceId: 'A', movingIds: ['A', 'K', 'Z', 'U'], requiredIds: ['A', 'K'], anchorLeft: 100, anchorTop: 200, sourceParentId: 'R' },
      { sourceId: 'B', movingIds: ['B', 'L'], anchorLeft: 340, anchorTop: 260, sourceParentId: 'R' }
    ], { type: 'detach' }, {
      startGhostLeft: 100, startGhostTop: 200, preservesSelectedConnection: true, candidateCount: 3,
      selectedCandidates: [
        { sourceId: 'A', kind: 'whole', idxs: [0] },
        { sourceId: 'K', kind: 'whole', idxs: [0] },
        { sourceId: 'B', kind: 'whole', idxs: [0] }
      ]
    });
    drop(w, { shift: true, alt: true });
    ok(parentId(w, 'A') === null && parentId(w, 'B') === null && node(w, 'A').freePosition && node(w, 'B').freePosition, 'Shift/free detaches and pins every disconnected selected component');
    ok(node(w, 'B').x - node(w, 'A').x === 240 && node(w, 'B').y - node(w, 'A').y === 60, 'free batch preserves exact pairwise root offsets');
    ok(parentId(w, 'K') === 'A' && parentId(w, 'Z') === null && parentId(w, 'U') === null && parentId(w, 'L') === null, 'selective Alt preserves selected A-K while orphaning all unselected side branches');
    ok(node(w, 'Z').x === 170 && node(w, 'U').x === 40 && node(w, 'L').x === 360, 'Alt orphans retain their cached last-rendered positions');
    ok(w.__argmap.selectedIds.includes('K-0'), 'selected descendant stays selected after its ancestor-root batch moves');
    ok(w.eval('undoStack.length') === beforeUndo + 1, 'free batch creates exactly one undo entry');
    w.undo();
    ok(parentId(w, 'A') === 'R' && parentId(w, 'B') === 'R' && parentId(w, 'K') === 'A' && parentId(w, 'Z') === 'K' && parentId(w, 'U') === 'A' && parentId(w, 'L') === 'B', 'one undo restores the whole selective-Alt batch');
    close(h);
  }

  // A collapsed ancestor can hide nodes that remain selected. The transient
  // last-rendered cache keeps them in the forest and preserves their offset.
  {
    const h = await fixture([R([N('A'), N('B')])], ['A-0', 'B-0']);
    const w = h.win;
    w.eval(`state.trees[0].collapsed=[0]; render();`);
    await sleep(70);
    w.eval(`
      lastRenderedSurfaceGeometry.groups.set('A',{left:100,top:200,right:200,bottom:240});
      lastRenderedSurfaceGeometry.groups.set('B',{left:340,top:260,right:440,bottom:300});
    `);
    const plan = w.eval(`(()=>{const f=buildSelectedDragForest();return {count:f.candidateCount,ids:f.units.map(u=>u.sourceId),dx:f.units[1].anchorLeft-f.units[0].anchorLeft}})()`);
    ok(!w.document.getElementById('group-A') && plan.count === 2 && plan.ids.join(',') === 'A,B', 'collapsed-but-selected nodes remain multi-drag candidates via cached geometry');
    ok(plan.dx === 240, 'hidden candidates retain their last-rendered horizontal offset');
    arm(w, [
      { sourceId: 'A', anchorLeft: 100, anchorTop: 200, sourceParentId: 'R' },
      { sourceId: 'B', anchorLeft: 340, anchorTop: 260, sourceParentId: 'R' }
    ], { type: 'detach' }, { startGhostLeft: 100, startGhostTop: 200 });
    w.eval(`
      const f=buildSelectedDragForest();
      dragCtx.units=f.units; dragCtx.selectedCandidates=f.selectedCandidates;
      dragCtx.candidateCount=f.candidateCount; dragCtx.startGhostLeft=100; dragCtx.startGhostTop=200;
    `);
    drop(w, { shift: true });
    ok(parentId(w, 'A') === null && parentId(w, 'B') === null && node(w, 'B').x - node(w, 'A').x === 240, 'free-drop moves the complete hidden selection with one exact translation');
    w.undo();
    ok(parentId(w, 'A') === 'R' && parentId(w, 'B') === 'R' && node(w, 'R').collapsed[0] === 0, 'undo restores the collapsed connected tree after hidden multi-drag');
    close(h);
  }

  // Partial co-premise selections from different groups are independent forest
  // roots; each carries only the child subtrees belonging to its selected boxes.
  {
    const c0 = Object.assign(N('C0'), { targetIndex: 0 });
    const c1 = Object.assign(N('C1'), { targetIndex: 1 });
    const c2 = Object.assign(N('C2'), { targetIndex: 2 });
    const hc = Object.assign(N('HC'), { targetIndex: 1 });
    const g = { id: 'G', type: 'support', texts: ['g0', 'g1', 'g2'], collapsed: [], children: [c0, c1, c2] };
    const hgroup = { id: 'H', type: 'support', texts: ['h0', 'h1'], collapsed: [], children: [hc] };
    const h = await fixture([R([g, hgroup])], ['G-0', 'G-2', 'H-1']);
    const w = h.win;
    arm(w, [
      { sourceId: 'G', kind: 'premises', idxs: [0, 2], movingIds: ['C0', 'C2'], anchorLeft: 100, anchorTop: 200, sourceParentId: 'R' },
      { sourceId: 'H', kind: 'premises', idxs: [1], movingIds: ['HC'], anchorLeft: 400, anchorTop: 200, sourceParentId: 'R' }
    ], { type: 'detach' }, { startGhostLeft: 100, startGhostTop: 200 });
    drop(w, { shift: true });
    const gx = w.__argmap.state.trees.find(t => t.texts && t.texts.join('|') === 'g0|g2');
    const hx = w.__argmap.state.trees.find(t => t.texts && t.texts.join('|') === 'h1');
    ok(node(w, 'G').texts.join('|') === 'g1' && node(w, 'H').texts.join('|') === 'h0', 'partial batch leaves every unselected co-premise in its original group');
    ok(gx && hx && parentId(w, 'C0') === gx.id && parentId(w, 'C2') === gx.id && parentId(w, 'HC') === hx.id, 'partial batch carries only the selected premises\' attached child subtrees');
    ok(gx && hx && gx.freePosition && hx.freePosition && hx.x - gx.x === 300, 'partial free roots preserve the selected groups\' original offset');
    ok(!w.__argmap.state._deletions.G && !w.__argmap.state._deletions.H, 'partial extraction creates no source-node tombstones');
    close(h);
  }

  // Batch child drop mirrors multi-paste-as-children while preserving identities.
  {
    const h = await fixture([R([N('A'), N('B'), N('T')])], ['A-0', 'B-0']);
    const w = h.win;
    arm(w, [
      { sourceId: 'A', anchorLeft: 100, sourceParentId: 'R' },
      { sourceId: 'B', anchorLeft: 300, sourceParentId: 'R' }
    ], { type: 'child', T: { id: 'T', idx: 0 } });
    drop(w);
    ok(parentId(w, 'A') === 'T' && parentId(w, 'B') === 'T', 'batch child drop attaches every selected root to the target');
    ok(childIds(w, 'T').join(',') === 'A,B', 'batch child drop retains stable selected-root order');
    ok(!w.__argmap.state._deletions.A && !w.__argmap.state._deletions.B, 'ordinary batch reparenting creates no deletion tombstones');
    close(h);
  }

  // Co-premise merging consumes only the two source group identities; children survive.
  {
    const h = await fixture([R([N('A', [N('AK')], 'alpha'), N('B', [N('BK')], 'beta'), N('T', [], 'target')])], ['A-0', 'B-0']);
    const w = h.win;
    arm(w, [
      { sourceId: 'A', movingIds: ['A', 'AK'], anchorLeft: 100, sourceParentId: 'R' },
      { sourceId: 'B', movingIds: ['B', 'BK'], anchorLeft: 300, sourceParentId: 'R' }
    ], { type: 'copremise', T: { id: 'T', idx: 0 }, side: 'right' });
    drop(w);
    ok(node(w, 'T').texts.join('|') === 'target|alpha|beta', 'batch co-premise drop merges every selected statement in order');
    ok(!node(w, 'A') && !node(w, 'B') && parentId(w, 'AK') === 'T' && parentId(w, 'BK') === 'T', 'co-premise source identities vanish but their child subtrees survive');
    ok(!!w.__argmap.state._deletions.A && !!w.__argmap.state._deletions.B && !w.__argmap.state._deletions.AK && !w.__argmap.state._deletions.BK, 'only identities consumed by co-premise merge are tombstoned');
    close(h);
  }

  // Legal sibling batches reorder as a stable block and no-op drops stay history-free.
  {
    const h = await fixture([R([N('A'), N('B'), N('C'), N('D')])], ['B-0', 'C-0']);
    const w = h.win;
    arm(w, [
      { sourceId: 'B', anchorLeft: 200, sourceParentId: 'R' },
      { sourceId: 'C', anchorLeft: 300, sourceParentId: 'R' }
    ], { type: 'reorder-row', T: { id: 'A', idx: 0 }, side: 'left' }, { commonParentId: 'R' });
    drop(w);
    ok(childIds(w, 'R').join(',') === 'B,C,A,D', 'same-row selected siblings reorder as one stable block');
    w.undo();
    const before = w.eval('undoStack.length');
    arm(w, [
      { sourceId: 'B', anchorLeft: 200, sourceParentId: 'R' },
      { sourceId: 'C', anchorLeft: 300, sourceParentId: 'R' }
    ], { type: 'reorder-row', T: { id: 'D', idx: 0 }, side: 'left' }, { commonParentId: 'R' });
    drop(w);
    ok(childIds(w, 'R').join(',') === 'A,B,C,D' && w.eval('undoStack.length') === before, 'no-op block reorder creates no phantom history');
    close(h);
  }

  // Mixed-parent lateral selection uses insert-sibling semantics at the target.
  {
    const h = await fixture([R([N('P', [N('A'), N('T')]), N('Q', [N('B')])])], ['A-0', 'B-0']);
    const w = h.win;
    arm(w, [
      { sourceId: 'A', anchorLeft: 100, sourceParentId: 'P' },
      { sourceId: 'B', anchorLeft: 300, sourceParentId: 'Q' }
    ], { type: 'insert-sibling', T: { id: 'T', idx: 0 }, side: 'right' });
    drop(w);
    ok(parentId(w, 'A') === 'P' && parentId(w, 'B') === 'P', 'mixed-parent batch inserts every root beside the target');
    ok(childIds(w, 'P').join(',') === 'T,A,B', 'insert-sibling preserves batch order after the target');
    close(h);
  }

  // Live partial extraction splits sparse metadata and remaps incoming plus
  // detached outgoing/self references on both retained and extracted sides.
  {
    const c = Object.assign(N('C'), { targetIndex: 1, crossRefs: [[{ targetId: 'G', targetIdx: 2 }]] });
    const g = {
      id: 'G', type: 'support', texts: ['g0', 'g1', 'g2'], raw: { 0: true, 1: true, 2: true },
      boxW: { 0: 110, 1: 220, 2: 330 }, collapsed: [], children: [c],
      crossRefs: [
        [{ targetId: 'G', targetIdx: 1 }],
        [{ targetId: 'G', targetIdx: 2 }, { targetId: 'G', targetIdx: 1 }],
        [{ targetId: 'G', targetIdx: 0 }]
      ]
    };
    const x = Object.assign(N('X'), { crossRefs: [[{ targetId: 'G', targetIdx: 1 }, { targetId: 'G', targetIdx: 2 }]] });
    const h = await fixture([R([g, x])], []);
    const w = h.win;
    w.eval(`
      pushHistory();
      const g=findNodeContext(state.trees,'G').node;
      const ex=extractPremises(g,new Set([1]));
      state.trees.push(ex); window.__partialExId=ex.id; render();
    `);
    const ex = node(w, w.__partialExId), liveG = node(w, 'G');
    ok(JSON.stringify(liveG.boxW) === JSON.stringify({ 0: 110, 1: 330 }) && JSON.stringify(ex.boxW) === JSON.stringify({ 0: 220 }), 'partial extraction splits and reindexes boxW on both sides');
    ok(JSON.stringify(liveG.raw) === JSON.stringify({ 0: true, 1: true }) && JSON.stringify(ex.raw) === JSON.stringify({ 0: true }), 'partial extraction splits and reindexes raw-mode metadata on both sides');
    ok(liveG.crossRefs[0][0].targetId === ex.id && liveG.crossRefs[0][0].targetIdx === 0 && liveG.crossRefs[1][0].targetId === 'G' && liveG.crossRefs[1][0].targetIdx === 0, 'retained-side outgoing self references follow extracted and renumbered boxes');
    ok(ex.crossRefs[0][0].targetId === 'G' && ex.crossRefs[0][0].targetIdx === 1 && ex.crossRefs[0][1].targetId === ex.id && ex.crossRefs[0][1].targetIdx === 0, 'extracted-side outgoing and self references are remapped after detachment');
    ok(node(w, 'C').crossRefs[0][0].targetId === 'G' && node(w, 'C').crossRefs[0][0].targetIdx === 1 && node(w, 'X').crossRefs[0][0].targetId === ex.id && node(w, 'X').crossRefs[0][1].targetIdx === 1, 'child and external incoming references follow their original premise identities');
    w.undo();
    ok(node(w, 'G').texts.length === 3 && JSON.stringify(node(w, 'G').boxW) === JSON.stringify({ 0: 110, 1: 220, 2: 330 }) && !node(w, w.__partialExId), 'one undo restores partial extraction metadata and identities');
    close(h);
  }

  // The one-box extraction path has the same sparse-map and detached-ref rules.
  {
    const c = Object.assign(N('PC'), { targetIndex: 1, crossRefs: [[{ targetId: 'PG', targetIdx: 2 }]] });
    const pg = {
      id: 'PG', type: 'support', texts: ['p0', 'p1', 'p2'], raw: { 1: true, 2: true },
      boxW: { 0: 101, 1: 202, 2: 303 }, collapsed: [], children: [c],
      crossRefs: [[], [{ targetId: 'PG', targetIdx: 2 }, { targetId: 'PG', targetIdx: 1 }], []]
    };
    const px = Object.assign(N('PX'), { crossRefs: [[{ targetId: 'PG', targetIdx: 1 }]] });
    const h = await fixture([R([pg, px])], []);
    const w = h.win;
    w.eval(`
      pushHistory(); const piece=removeNodePiece('PG',1);
      state.trees.push(piece); window.__pieceId=piece.id; render();
    `);
    const piece = node(w, w.__pieceId), remain = node(w, 'PG');
    ok(JSON.stringify(remain.boxW) === JSON.stringify({ 0: 101, 1: 303 }) && piece.boxW[0] === 202 && JSON.stringify(remain.raw) === JSON.stringify({ 1: true }) && piece.raw[0] === true, 'single-piece extraction transfers raw and width metadata with the box');
    ok(piece.crossRefs[0][0].targetId === 'PG' && piece.crossRefs[0][0].targetIdx === 1 && piece.crossRefs[0][1].targetId === piece.id && node(w, 'PC').crossRefs[0][0].targetIdx === 1, 'single-piece extracted subtree remaps outgoing and self references');
    ok(node(w, 'PX').crossRefs[0][0].targetId === piece.id && node(w, 'PX').crossRefs[0][0].targetIdx === 0, 'single-piece incoming references retarget to the new identity');
    w.undo();
    ok(node(w, 'PG').texts.length === 3 && parentId(w, 'PC') === 'PG' && !node(w, w.__pieceId), 'undo restores the one-box extraction transaction');
    close(h);
  }

  // Partial copy operates on a clone only. References in the clipboard keep
  // identifying original live boxes because paste re-IDs structural nodes but
  // intentionally does not rewrite cross-reference targets.
  {
    const cc = Object.assign(N('CC'), { targetIndex: 1, crossRefs: [[{ targetId: 'CG', targetIdx: 0 }]] });
    const cg = {
      id: 'CG', type: 'support', texts: ['c0', 'c1', 'c2'], raw: { 1: true }, boxW: { 1: 222 }, collapsed: [], children: [cc],
      crossRefs: [[], [{ targetId: 'CG', targetIdx: 1 }, { targetId: 'CG', targetIdx: 2 }], []]
    };
    const cx = Object.assign(N('CX'), { crossRefs: [[{ targetId: 'CG', targetIdx: 1 }]] });
    const h = await fixture([R([cg, cx])], ['CG-1']);
    const w = h.win;
    const copyResult = w.eval(`(()=>{
      const before=JSON.stringify(state.trees); copyNode(); const item=clipboard[0];
      return {before,after:JSON.stringify(state.trees),id:item.id,raw:item.raw,boxW:item.boxW,refs:item.crossRefs[0],childRef:item.children[0].crossRefs[0][0]};
    })()`);
    ok(copyResult.before === copyResult.after && node(w, 'CX').crossRefs[0][0].targetId === 'CG' && node(w, 'CX').crossRefs[0][0].targetIdx === 1, 'partial copy does not mutate live nodes or incoming references');
    ok(copyResult.raw[0] === true && copyResult.boxW[0] === 222, 'partial copy carries the selected box sparse metadata');
    ok(copyResult.refs.every(r => r.targetId === 'CG') && copyResult.refs.map(r => r.targetIdx).join(',') === '1,2' && copyResult.childRef.targetId === 'CG' && copyResult.childRef.targetIdx === 0, 'clipboard outgoing refs continue to point at original live IDs and indices');
    ok(copyResult.refs.every(r => r.targetId !== copyResult.id), 'partial copy creates no clipboard-only cross-reference target');
    close(h);
  }

  // Sparse raw markers also follow ordinary premise reorder and co-premise join.
  {
    const mg = { id: 'MG', type: 'support', texts: ['m0', 'm1', 'm2'], raw: { 0: true, 2: true }, collapsed: [], children: [] };
    const jt = { id: 'JT', type: 'support', texts: ['t0', 't1'], raw: { 1: true }, collapsed: [], children: [] };
    const h = await fixture([R([mg, jt])], []);
    const w = h.win;
    w.eval(`
      pushHistory();
      moveTextWithin(findNodeContext(state.trees,'MG').node,0,3);
      joinAsCoPremise(findNodeContext(state.trees,'JT').node,1,{id:'EX',type:'support',texts:['e0','e1'],raw:{0:true},collapsed:[],children:[]});
      render();
    `);
    ok(node(w, 'MG').texts.join(',') === 'm1,m2,m0' && JSON.stringify(node(w, 'MG').raw) === JSON.stringify({ 1: true, 2: true }), 'raw markers follow their premises during in-group reorder');
    ok(node(w, 'JT').texts.join(',') === 't0,e0,e1,t1' && JSON.stringify(node(w, 'JT').raw) === JSON.stringify({ 1: true, 3: true }), 'raw markers transfer and shift correctly during co-premise join');
    w.undo();
    ok(node(w, 'MG').texts.join(',') === 'm0,m1,m2' && node(w, 'JT').texts.join(',') === 't0,t1', 'one undo restores raw reorder and join changes');
    close(h);
  }

  ok(allRuntimeErrors.length === 0, 'no uncaught jsdom runtime errors across selected-forest fixtures');
  console.log(`\n--- selected-forest drag: ${pass} passed, ${fail} failed ---`);
  if (failures.length) failures.forEach(x => console.log('  - ' + x));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
