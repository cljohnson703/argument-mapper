'use strict';

// layout-r23-tests.js — red-first gate for the requester’s r23 layout rules.
//
// This suite extracts and executes the shipped computeTreeLayout implementation.
// jsdom reports zero geometry, so deterministic synthetic geometry is supplied.
// The target defaults to argument-mapper-r23.html; pass another HTML path as
// argv[2] for a negative control, e.g.:
//
//   node layout-r23-tests.js argument-mapper.html
//
// Exit codes deliberately distinguish outcomes:
//   0 = all assertions passed
//   1 = one or more behavioral assertions failed
//   2 = harness/extraction/runtime error (the suite did not vouch for the app)

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, 'argument-mapper-r23.html');

let passed = 0;
let failed = 0;

function ok(value, label) {
    if (value) {
        passed++;
        console.log('  \u2713 ' + label);
    } else {
        failed++;
        console.log('  \u2717 FAIL: ' + label);
    }
}

function finish() {
    console.log('\n--- layout-r23-tests: ' + passed + ' passed, ' + failed + ' failed ---');
    process.exit(failed ? 1 : 0);
}

function harnessFailure(error) {
    const message = error && error.stack ? error.stack : String(error);
    console.error('\nHARNESS ERROR — no behavioral result:');
    console.error(message);
    console.error('\n--- layout-r23-tests: 0 behavioral result (harness error) ---');
    process.exit(2);
}

function extractFunctions(source, names) {
    const lines = source.split('\n');
    const result = {};
    names.forEach(name => {
        const pattern = new RegExp('^    (?:function ' + name + '\\b|const ' + name + ' = )');
        const starts = [];
        lines.forEach((line, index) => { if (pattern.test(line)) starts.push(index); });
        if (starts.length !== 1) {
            throw new Error('extract: expected exactly one definition of "' + name + '", found ' + starts.length);
        }
        const start = starts[0];
        let end = -1;
        for (let index = start + 1; index < lines.length; index++) {
            if (/^    }/.test(lines[index])) { end = index; break; }
        }
        if (end < 0) throw new Error('extract: no closing brace for "' + name + '"');
        result[name] = lines.slice(start, end + 1).join('\n');
    });
    return result;
}

let html;
let L;
try {
    html = fs.readFileSync(FILE, 'utf8');
    const fn = extractFunctions(html, [
        'collapsedList',
        'boxOf',
        'vgapForDepth',
        'resolveRowPositions',
        'routeSegmentDistance',
        'routeSegmentTouchesRect',
        'statementFanRouteSegments',
        'statementFanCornerRects',
        'statementFanGeometry',
        'routeRectsWithinClearance',
        'statementFanGeometriesConflict',
        'allocateStatementFanBands',
        'shiftedStatementFanPlans',
        'minimumStatementFanChildShift',
        'computeTreeLayout',
    ]);
    const numericConstant = (name, fallback) => {
        const match = html.match(new RegExp('const ' + name + ' = ([\\d.]+)'));
        return match ? Number(match[1]) : fallback;
    };
    const sandbox = { console, Math, Object, Array, JSON, isFinite, Infinity };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(`
        var CENTER_X = 30000, CENTER_Y = 30000;
        var VGAP_BASE = ${numericConstant('VGAP_BASE', 50)};
        var CHANNEL_SPACING = ${numericConstant('CHANNEL_SPACING', 14)};
        var HGAP = ${numericConstant('HGAP', 15)};
        var STRAIGHT_THRESH = ${numericConstant('STRAIGHT_THRESH', 2)};
        var ROUTE_MIN_STUB = ${numericConstant('ROUTE_MIN_STUB', 10)};
        var ROUTE_CORNER_RADIUS = ${numericConstant('ROUTE_CORNER_RADIUS', 6)};
        var ROUTE_STROKE_CLEARANCE = ${numericConstant('ROUTE_STROKE_CLEARANCE', 2.05)};
        var NODE_ROUTE_CLEARANCE = HGAP + ROUTE_STROKE_CLEARANCE / 2;
        var layoutMode = 'compact';
        var spreadGaps = {};
        function isBoxCollapsed(node, index) { return collapsedList(node).includes(index); }
        function isChildVisible(node, child) { return !isBoxCollapsed(node, boxOf(node, child)); }
        function visibleChildren(node) { return (node.children || []).filter(child => isChildVisible(node, child)); }
        ${fn.collapsedList}
        ${fn.boxOf}
        ${fn.vgapForDepth}
        ${fn.resolveRowPositions}
        ${fn.routeSegmentDistance}
        ${fn.routeSegmentTouchesRect}
        ${fn.statementFanRouteSegments}
        ${fn.statementFanCornerRects}
        ${fn.statementFanGeometry}
        ${fn.routeRectsWithinClearance}
        ${fn.statementFanGeometriesConflict}
        ${fn.allocateStatementFanBands}
        ${fn.shiftedStatementFanPlans}
        ${fn.minimumStatementFanChildShift}
        ${fn.computeTreeLayout}
        globalThis.__layoutApi = {
            computeTreeLayout,
            boxOf,
            setMode(mode) { layoutMode = mode; },
            resetSpreadGaps() { spreadGaps = {}; },
            getSpreadGaps() { return { ...spreadGaps }; },
        };
    `, sandbox, { filename: FILE + '#layout-r23-extract' });
    L = sandbox.__layoutApi;
    if (!L || typeof L.computeTreeLayout !== 'function') {
        throw new Error('extract: computeTreeLayout API was not created');
    }
} catch (error) {
    harnessFailure(error);
}

const BASE_H = 60;
const INNER_GAP = 15;
const EXPECTED_HGAP = 15;
const EXPECTED_VGAP = 50;

function node(id, width, children, height) {
    return {
        id,
        texts: ['x'],
        children: children || [],
        _boxW: [width],
        _boxH: [height || BASE_H],
    };
}

function multi(id, widths, heights, childSpecs) {
    const specs = childSpecs || [];
    const n = {
        id,
        texts: widths.map(() => 'x'),
        children: specs.map(spec => spec.node),
        _boxW: widths.slice(),
        _boxH: heights.slice(),
    };
    specs.forEach(spec => {
        if (spec.targetIndex !== undefined) spec.node.targetIndex = spec.targetIndex;
    });
    return n;
}

function visibleChildrenJS(n) {
    const collapsed = Array.isArray(n.collapsed)
        ? n.collapsed
        : (n.collapsed === true ? n.texts.map((_, index) => index) : []);
    return (n.children || []).filter(child => !collapsed.includes(L.boxOf(n, child)));
}

function buildGeometry(root) {
    const geometry = {};
    (function walk(n) {
        const widths = n._boxW || [180];
        const heights = n._boxH || [n._h || BASE_H];
        const boxes = [];
        let left = 0;
        widths.forEach((width, index) => {
            boxes.push({
                cx: left + width / 2,
                w: width,
                h: heights[index] !== undefined ? heights[index] : BASE_H,
            });
            left += width + INNER_GAP;
        });
        const groupHeight = n._h || Math.max(BASE_H, ...heights);
        geometry[n.id] = {
            w: left - (widths.length ? INNER_GAP : 0),
            h: groupHeight,
            boxes,
        };
        (n.children || []).forEach(walk);
    })(root);
    return geometry;
}

function layout(root, mode, depthGrid, maxFanPerDepth) {
    const geom = buildGeometry(root);
    L.setMode(mode);
    L.resetSpreadGaps();
    const pos = L.computeTreeLayout(root, geom, depthGrid || null, maxFanPerDepth || {});
    return { root, geom, pos, mode, spreadGaps: L.getSpreadGaps() };
}

function renderedGaps(id, result) {
    const count = Math.max(0, result.geom[id].boxes.length - 1);
    const spec = result.mode === 'spread' ? result.spreadGaps[id] : undefined;
    if (Array.isArray(spec)) {
        return Array.from({ length: count }, (_, i) => spec[i] === undefined ? INNER_GAP : spec[i]);
    }
    return Array(count).fill(spec === undefined ? INNER_GAP : spec);
}

function renderedBoxLocals(id, result) {
    const boxes = result.geom[id].boxes;
    const gaps = renderedGaps(id, result);
    let left = 0;
    return boxes.map((box, index) => {
        const entry = { cx: left + box.w / 2, w: box.w, h: box.h };
        left += box.w + (gaps[index] || 0);
        return entry;
    });
}

function renderedWidth(id, result) {
    const boxes = renderedBoxLocals(id, result);
    return boxes.length ? boxes[boxes.length - 1].cx + boxes[boxes.length - 1].w / 2 : result.geom[id].w;
}

function centerX(id, result) {
    return result.pos[id].x + renderedWidth(id, result) / 2;
}

function boxCenterX(nodeId, boxIndex, result) {
    const boxes = renderedBoxLocals(nodeId, result);
    const index = Math.max(0, Math.min(boxIndex, boxes.length - 1));
    return result.pos[nodeId].x + boxes[index].cx;
}

function groupAnchorX(nodeId, result) {
    const boxes = renderedBoxLocals(nodeId, result);
    if (!boxes.length) return centerX(nodeId, result);
    return result.pos[nodeId].x + (boxes[0].cx + boxes[boxes.length - 1].cx) / 2;
}

function groupLeftEdgeX(nodeId, result) {
    const boxes = renderedBoxLocals(nodeId, result);
    return result.pos[nodeId].x + boxes[0].cx - boxes[0].w / 2;
}

function groupRightEdgeX(nodeId, result) {
    const boxes = renderedBoxLocals(nodeId, result);
    const box = boxes[boxes.length - 1];
    return result.pos[nodeId].x + box.cx + box.w / 2;
}

function outerChildEdgeMid(parent, result) {
    const children = visibleChildrenJS(parent);
    if (!children.length) return centerX(parent.id, result);
    const left = Math.min(...children.map(child => groupLeftEdgeX(child.id, result)));
    const right = Math.max(...children.map(child => groupRightEdgeX(child.id, result)));
    return (left + right) / 2;
}

function parentCenterError(parent, result) {
    const children = visibleChildrenJS(parent);
    if (!children.length) return 0;
    const fans = new Map();
    children.forEach(child => {
        const target = L.boxOf(parent, child);
        if (!fans.has(target)) fans.set(target, []);
        fans.get(target).push(child);
    });
    let worst = 0;
    fans.forEach((fan, target) => {
        const left = Math.min(...fan.map(child => groupLeftEdgeX(child.id, result)));
        const right = Math.max(...fan.map(child => groupRightEdgeX(child.id, result)));
        worst = Math.max(worst,
            Math.abs(boxCenterX(parent.id, target, result) - (left + right) / 2));
    });
    return worst;
}

function nodeRects(root, result) {
    const rects = [];
    (function walk(n) {
        const p = result.pos[n.id];
        const g = result.geom[n.id];
        if (p && g) rects.push({ id: n.id, x0: p.x, y0: p.y, x1: p.x + renderedWidth(n.id, result), y1: p.y + g.h });
        visibleChildrenJS(n).forEach(walk);
    })(root);
    return rects;
}

function overlapPairs(root, result) {
    const rects = nodeRects(root, result);
    const hits = [];
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            const overlapX = Math.min(rects[i].x1, rects[j].x1) - Math.max(rects[i].x0, rects[j].x0);
            const overlapY = Math.min(rects[i].y1, rects[j].y1) - Math.max(rects[i].y0, rects[j].y0);
            if (overlapX > 0.5 && overlapY > 0.5) hits.push(rects[i].id + '/' + rects[j].id);
        }
    }
    return hits;
}

function subtreeBounds(subtree, result) {
    let left = Infinity;
    let right = -Infinity;
    (function walk(n) {
        const p = result.pos[n.id];
        const g = result.geom[n.id];
        left = Math.min(left, p.x);
        right = Math.max(right, p.x + renderedWidth(n.id, result));
        visibleChildrenJS(n).forEach(walk);
    })(subtree);
    return { left, right };
}

function edges(root, result) {
    const list = [];
    (function walk(parent) {
        const pp = result.pos[parent.id];
        const pg = result.geom[parent.id];
        visibleChildrenJS(parent).forEach(child => {
            const cp = result.pos[child.id];
            const cg = result.geom[child.id];
            const boxIndex = Math.max(0, Math.min(L.boxOf(parent, child), pg.boxes.length - 1));
            list.push({
                parent: parent.id,
                child: child.id,
                ax: boxCenterX(parent.id, boxIndex, result),
                ay: pp.y + pg.h,
                bx: groupAnchorX(child.id, result),
                by: cp.y,
            });
            walk(child);
        });
    })(root);
    return list;
}

function orientation(ax, ay, bx, by, cx, cy) {
    return (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
}

function properCrossings(root, result) {
    const list = edges(root, result);
    const hits = [];
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            const a = list[i];
            const b = list[j];
            if (a.parent === b.parent) continue;
            const d1 = orientation(a.ax, a.ay, a.bx, a.by, b.ax, b.ay);
            const d2 = orientation(a.ax, a.ay, a.bx, a.by, b.bx, b.by);
            const d3 = orientation(b.ax, b.ay, b.bx, b.by, a.ax, a.ay);
            const d4 = orientation(b.ax, b.ay, b.bx, b.by, a.bx, a.by);
            if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) {
                hits.push(a.parent + '>' + a.child + '/' + b.parent + '>' + b.child);
            }
        }
    }
    return hits;
}

function maxParentChildGap(root, result) {
    let maximum = -Infinity;
    (function walk(parent) {
        visibleChildrenJS(parent).forEach(child => {
            const gap = result.pos[child.id].y - (result.pos[parent.id].y + result.geom[parent.id].h);
            maximum = Math.max(maximum, gap);
            walk(child);
        });
    })(root);
    return maximum;
}

function mulberry32(seed) {
    return function random() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

let generatedId = 0;
function randomTree(random, depth) {
    const id = 'g' + generatedId++;
    const width = 90 + Math.floor(random() * 280);
    const height = 45 + Math.floor(random() * 260);
    const children = [];
    if (depth > 0 && random() > 0.18) {
        const fan = 1 + Math.floor(random() * 3);
        for (let index = 0; index < fan; index++) children.push(randomTree(random, depth - 1));
    }
    return node(id, width, children, height);
}

function normalizedMultiTree(random, depth, id) {
    const boxCount = 1 + Math.floor(random() * 4);
    const widths = Array.from({ length: boxCount }, () => 50 + Math.floor(random() * 350));
    const heights = Array.from({ length: boxCount }, () => 35 + Math.floor(random() * 400));
    const childSpecs = [];
    if (depth > 0 && random() > 0.2) {
        const childCount = 1 + Math.floor(random() * 4);
        const targets = Array.from({ length: childCount }, () => Math.floor(random() * boxCount)).sort((a, b) => a - b);
        targets.forEach((targetIndex, index) => {
            childSpecs.push({
                node: normalizedMultiTree(random, depth - 1, id + '_' + index),
                targetIndex,
            });
        });
    }
    return multi(id, widths, heights, childSpecs);
}

function run() {
    console.log('layout-r23-tests target: ' + path.basename(FILE));

    // R23-1: spread reserves a disjoint horizontal lane for every immediate
    // sibling subtree. Ragged silhouettes may not nest into each other.
    {
        // The left branch is narrow while the right sibling exists, then fans
        // out only after the right leaf has ended. A contour/rect nester can
        // put the right leaf inside the left branch's full x-extent; a genuine
        // spread lane cannot.
        const deep = node('deep', 120, [
            node('d1', 120, [
                node('d2', 120, [
                    node('d3', 120, [node('d30', 400), node('d31', 400)]),
                ]),
            ]),
        ]);
        const wide = node('wide', 600);
        const root = node('laneRoot', 180, [deep, wide]);
        const result = layout(root, 'spread');
        const a = subtreeBounds(deep, result);
        const b = subtreeBounds(wide, result);
        const gap = b.left - a.right;
        ok(gap >= EXPECTED_HGAP - 0.5,
            'R23-1 spread sibling subtrees occupy disjoint lanes (gap ' + gap.toFixed(1) + 'px)');
    }

    // R25 update: Spread's centering definition is the midpoint of the outer
    // EDGES of the outermost immediate children, including asymmetric trees.
    {
        const branch = multi('spreadP', [80, 160, 100], [60, 95, 70], [
            { node: node('sp0', 110, [node('sp00', 300)]), targetIndex: 0 },
            { node: node('sp1', 310), targetIndex: 1 },
            { node: node('sp2', 150, [node('sp20', 90), node('sp21', 260)]), targetIndex: 2 },
        ]);
        const root = node('spreadRoot', 175, [branch]);
        const result = layout(root, 'spread');
        const errors = [parentCenterError(root, result), parentCenterError(branch, result)];
        ok(Math.max(...errors) < 0.5,
            'R25-1 spread parents center on their outermost immediate child edges (worst ' + Math.max(...errors).toFixed(2) + 'px)');
    }

    // R23-3: compact may not push a child down merely to make the tree narrower.
    // This is the r22 width-first counterexample: r22 drops B hundreds of pixels.
    {
        const root = node('dropRoot', 200, [
            node('dropA', 220, [node('dropA0', 400, [], 400)], 60),
            node('dropB', 260, [node('dropB0', 200)], 300),
        ]);
        const result = layout(root, 'compact');
        const maxGap = maxParentChildGap(root, result);
        ok(Math.abs(maxGap - EXPECTED_VGAP) < 0.5,
            'R23-3 compact does not vertically drop a branch to save width (max gap ' + maxGap.toFixed(1) + 'px)');
    }

    // R23-2b: in spread, targetIndex is semantic parentage. Children under
    // different co-premise boxes must center on those individual boxes when
    // their full lanes already fit; treating the whole group as one parent is
    // incorrect even though the group-level midpoint can look centered.
    {
        const e = node('spreadTargetE', 80);
        const g = node('spreadTargetG', 80);
        const abc = multi('spreadTargetABC', [180, 180, 180], [60, 60, 60], [
            { node: e, targetIndex: 0 },
            { node: g, targetIndex: 2 },
        ]);
        const result = layout(abc, 'spread');
        const eErr = Math.abs(centerX(e.id, result) - boxCenterX(abc.id, 0, result));
        const gErr = Math.abs(centerX(g.id, result) - boxCenterX(abc.id, 2, result));
        ok(Math.max(eErr, gErr) < 0.5,
            'R23-2b spread centers each target fan beneath its own co-premise box (worst ' + Math.max(eErr, gErr).toFixed(2) + 'px)');
    }

    // When those full lanes do not fit, spread may expand the co-premise gap;
    // unlike compact, this is how it preserves both target centering and lane
    // separation. The rendered box centers must use that expanded CSS gap.
    {
        const e = node('spreadWideE', 435);
        const g = node('spreadWideG', 435);
        const abc = multi('spreadWideABC', [180, 180, 180], [60, 60, 60], [
            { node: e, targetIndex: 0 },
            { node: g, targetIndex: 2 },
        ]);
        const result = layout(abc, 'spread');
        const gaps = renderedGaps(abc.id, result);
        const gap = Math.max(...gaps, INNER_GAP);
        const aCenter = boxCenterX(abc.id, 0, result);
        const cCenter = boxCenterX(abc.id, 2, result);
        const laneGap = result.pos[g.id].x - (result.pos[e.id].x + result.geom[e.id].w);
        const anchorError = Math.max(Math.abs(centerX(e.id, result) - aCenter), Math.abs(centerX(g.id, result) - cCenter));
        ok(gap > INNER_GAP && laneGap >= EXPECTED_HGAP - 0.5 && anchorError < 0.75,
            'R23-2d spread expands co-premise gap only as needed for centered full lanes (gap/lane/err ' + gap.toFixed(1) + '/' + laneGap.toFixed(1) + '/' + anchorError.toFixed(2) + 'px)');
    }

    // A Shift-positioned subtree pins the stored left edge of its root group.
    // If Spread widens that co-premise root, its descendants must follow the
    // newly rendered statement centers; layoutAll's hard pin may not undo it.
    {
        const e = node('spreadFreeE', 435);
        const g = node('spreadFreeG', 435);
        const abc = multi('spreadFreeABC', [180, 180, 180], [60, 60, 60], [
            { node: e, targetIndex: 0 },
            { node: g, targetIndex: 2 },
        ]);
        abc.x = 1000; abc.y = 900; abc.freePosition = true;
        const result = layout(abc, 'spread');
        const targetError = Math.max(
            Math.abs(centerX(e.id, result) - boxCenterX(abc.id, 0, result)),
            Math.abs(centerX(g.id, result) - boxCenterX(abc.id, 2, result))
        );
        ok(Math.abs(result.pos[abc.id].x - abc.x) < 0.5 && targetError < 0.5,
            'R23-2e free Spread root keeps its stored left edge and aligned target fans (err ' + targetError.toFixed(2) + 'px)');
    }

    // R23-2c: a parent centers over the outermost immediate CHILD BOXES. A
    // three-box co-premise group plus a separate premise is not equivalent to
    // two equal-weight child-group centers.
    {
        const abc = multi('spreadOuterABC', [100, 100, 100], [60, 60, 60], []);
        const d = node('spreadOuterD', 100);
        const root = node('spreadOuterRoot', 180, [abc, d]);
        const result = layout(root, 'spread');
        const error = Math.abs(centerX(root.id, result) - outerChildEdgeMid(root, result));
        ok(error < 0.5,
            'R23-2c spread parent centers between outer immediate child boxes (err ' + error.toFixed(2) + 'px)');
    }

    // R23-4: the tallest box in a co-premise group controls the group bottom,
    // and all immediate children begin below that bottom plus the corridor.
    {
        const c0 = node('tallC0', 150);
        const c1 = node('tallC1', 170);
        const parent = multi('tallP', [150, 180, 140], [60, 245, 90], [
            { node: c0, targetIndex: 0 },
            { node: c1, targetIndex: 2 },
        ]);
        const result = layout(parent, 'compact');
        const expectedTop = result.pos[parent.id].y + 245 + EXPECTED_VGAP;
        const errors = [c0, c1].map(child => Math.abs(result.pos[child.id].y - expectedTop));
        ok(Math.max(...errors) < 0.5,
            'R23-4 tallest co-premise height sets the immediate-child row (worst ' + Math.max(...errors).toFixed(2) + 'px)');
    }

    // R25 update: absent a cousin conflict, Compact uses the same edge-based
    // immediate-child centering rule.
    {
        const parent = node('plainP', 190, [node('plain0', 110), node('plain1', 300), node('plain2', 150)]);
        const root = node('plainRoot', 180, [parent]);
        const result = layout(root, 'compact');
        const error = parentCenterError(parent, result);
        ok(error < 0.5,
            'R23-5 unconflicted compact parent centers on its immediate children (err ' + error.toFixed(2) + 'px)');
    }

    // R23-5b: connector capacity is local outside Depth mode. A four-channel
    // fan needs three extra 14px channel steps; its quiet cousin must retain
    // the 50px minimum instead of inheriting that busier parent's corridor.
    {
        const pKids = [node('fanP0', 80), node('fanP1', 80), node('fanP2', 80), node('fanP3', 80)];
        const qKid = node('fanQ0', 80);
        const p = node('fanP', 180, pKids);
        const q = node('fanQ', 180, [qKid]);
        const root = node('fanRoot', 180, [p, q]);
        const result = layout(root, 'compact', null, { fanRoot: 1, fanP: 4, fanQ: 1 });
        const pGap = result.pos.fanP0.y - (result.pos.fanP.y + result.geom.fanP.h);
        const qGap = result.pos.fanQ0.y - (result.pos.fanQ.y + result.geom.fanQ.h);
        ok(Math.abs(pGap - 92) < 0.5 && Math.abs(qGap - EXPECTED_VGAP) < 0.5,
            'R23-5b non-Depth corridors use each parent\'s own bend count (busy/quiet ' + pGap.toFixed(1) + '/' + qGap.toFixed(1) + 'px)');
    }

    // R25-1c: the same outer-child-edge centering definition applies to an
    // unconflicted compact parent.
    {
        const abc = multi('compactOuterABC', [100, 100, 100], [60, 60, 60], []);
        const d = node('compactOuterD', 100);
        const root = node('compactOuterRoot', 180, [abc, d]);
        const result = layout(root, 'compact');
        const error = Math.abs(centerX(root.id, result) - outerChildEdgeMid(root, result));
        ok(error < 0.5,
            'R23-5c compact parent centers between outer immediate child boxes (err ' + error.toFixed(2) + 'px)');
    }

    // Imported/state child order need not match target-box order. A child of
    // C may precede a child of A in the array; semantic targetIndex order must
    // still govern left/right placement and collision resolution.
    {
        const right = node('reverseRight', 100);
        const left = node('reverseLeft', 100);
        const abc = multi('reverseABC', [180, 180, 180], [60, 60, 60], [
            { node: right, targetIndex: 2 },
            { node: left, targetIndex: 0 },
        ]);
        const result = layout(abc, 'compact');
        const leftError = Math.abs(centerX(left.id, result) - boxCenterX(abc.id, 0, result));
        const rightError = Math.abs(centerX(right.id, result) - boxCenterX(abc.id, 2, result));
        ok(result.pos[left.id].x < result.pos[right.id].x && Math.max(leftError, rightError) < 0.5,
            'R23-5d compact uses targetIndex spatial order even when state order is reversed (err ' + Math.max(leftError, rightError).toFixed(2) + 'px)');
    }

    // R23-6: A/B/C are three locked co-premise boxes in ONE node-group.
    // E targets A and the six-box G targets C. Their equal-width groups would
    // overlap if both stayed centered, so only the child fans negotiate. The
    // one-box E must move six times as far as G; A/B/C themselves never spread.
    {
        const e = multi('E', [435], [60], []);
        const g = multi('G', [60, 60, 60, 60, 60, 60], [60, 60, 60, 60, 60, 60], []);
        const abc = multi('ABC', [180, 180, 180], [60, 60, 60], [
            { node: e, targetIndex: 0 },
            { node: g, targetIndex: 2 },
        ]);
        const result = layout(abc, 'compact');
        const aCenter = boxCenterX('ABC', 0, result);
        const cCenter = boxCenterX('ABC', 2, result);
        const eError = aCenter - centerX('E', result);
        const gError = centerX('G', result) - cCenter;
        const cousinGap = result.pos.G.x - (result.pos.E.x + result.geom.E.w);
        const lockedPremiseGap = result.geom.ABC.boxes[1].cx - result.geom.ABC.boxes[0].cx
            - result.geom.ABC.boxes[0].w / 2 - result.geom.ABC.boxes[1].w / 2;
        const proportional = eError > 0.5 && gError > 0.5 && Math.abs(eError - 6 * gError) < 0.75;
        const isolated = Math.abs(lockedPremiseGap - INNER_GAP) < 0.5 && cousinGap >= EXPECTED_HGAP - 0.5;
        ok(isolated && proportional,
            'R23-6 same-group 1-vs-6 cousins move 6:1 beneath locked A/B/C (E/G ' + eError.toFixed(2) + '/' + gError.toFixed(2) + 'px)');
    }

    // R23-6a: if one statement fan contains two ordinary siblings, it is the
    // whole tightly packed fan that moves.  Its weight must therefore include
    // both boxes; using only the colliding sibling moves the fixed A/B/C group.
    {
        const e = node('fanWeightE', 100);
        const f = node('fanWeightF', 435);
        const g = multi('fanWeightG', [60, 60, 60, 60, 60, 60],
            [60, 60, 60, 60, 60, 60], []);
        const abc = multi('fanWeightABC', [180, 180, 180], [60, 60, 60], [
            { node: e, targetIndex: 0 },
            { node: f, targetIndex: 0 },
            { node: g, targetIndex: 2 },
        ]);
        const result = layout(abc, 'compact');
        const a = boxCenterX(abc.id, 0, result);
        const c = boxCenterX(abc.id, 2, result);
        const leftFanMid = (groupLeftEdgeX(e.id, result) + groupRightEdgeX(f.id, result)) / 2;
        const leftMove = a - leftFanMid;
        const rightMove = centerX(g.id, result) - c;
        const siblingGap = result.pos[f.id].x - (result.pos[e.id].x + result.geom[e.id].w);
        const fixedParent = Math.abs(result.pos[abc.id].x - abc.x) < 0.5;
        const consistent = leftMove > 0.5 && rightMove > 0.5
            && Math.abs(leftMove - 3 * rightMove) < 0.75;
        ok(fixedParent && consistent && Math.abs(siblingGap - INNER_GAP) < 0.5,
            'R23-6a rigid 2-vs-6 fans use consistent weights and keep A/B/C fixed (moves ' +
            leftMove.toFixed(2) + '/' + rightMove.toFixed(2) + 'px, parent ' +
            (result.pos[abc.id].x - abc.x).toFixed(2) + 'px)');
    }

    // R23-6b: ABC is one co-premise child-group; D is a separate sibling.
    // A tall H under D now reaches the six-box G under C. Because these parent
    // groups are separate, compact translates the whole ABC and D branches,
    // keeps G/H centered under C/D, and recenters the top node between the
    // outermost immediate child BOX edges. Six-box ABC moves one-sixth as far.
    {
        function image3Fixture(hHeight) {
            const g = multi('imageG', [60, 60, 60, 60, 60, 60], [60, 60, 60, 60, 60, 60], []);
            const abc = multi('imageABC', [180, 180, 180], [60, 200, 60], [
                { node: g, targetIndex: 2 },
            ]);
            const h = multi('imageH', [435], [hHeight], []);
            const d = node('imageD', 180, [h], 60);
            return node('imageRoot', 180, [abc, d]);
        }
        const shortResult = layout(image3Fixture(100), 'compact');
        const tallRoot = image3Fixture(180);
        const tallResult = layout(tallRoot, 'compact');
        const abcShift = centerX('imageABC', tallResult) - centerX('imageABC', shortResult);
        const dShift = centerX('imageD', tallResult) - centerX('imageD', shortResult);
        const rootShift = centerX('imageRoot', tallResult) - centerX('imageRoot', shortResult);
        const gAnchorError = Math.abs(centerX('imageG', tallResult) - boxCenterX('imageABC', 2, tallResult));
        const hAnchorError = Math.abs(centerX('imageH', tallResult) - centerX('imageD', tallResult));
        const rootCenterError = Math.abs(centerX('imageRoot', tallResult) - outerChildEdgeMid(tallRoot, tallResult));
        const proportional = abcShift < -0.5 && dShift > 0.5 && Math.abs(dShift + 6 * abcShift) < 0.75;
        ok(proportional && rootShift > 0.5 && gAnchorError < 0.5 && hAnchorError < 0.5 && rootCenterError < 0.5,
            'R23-6b cross-group conflict moves whole branches 1:6 and recenters root (ABC/D/root ' + abcShift.toFixed(2) + '/' + dShift.toFixed(2) + '/' + rootShift.toFixed(2) + 'px)');
    }

    // R23-7: a supplied depth grid remains authoritative across trees. The grid
    // here is derived from the tallest node at each generation.
    {
        const a = node('depthRA', 180, [node('depthA1', 160, [node('depthA2', 140)], 60)], 70);
        const b = node('depthRB', 200, [node('depthB1', 220, [node('depthB2', 150)], 300)], 50);
        const grid = { 0: 30000, 1: 30120, 2: 30470 }; // 70+50, then max(60,300)+50
        const ra = layout(a, 'compact', grid);
        const rb = layout(b, 'compact', grid);
        const aligned = ra.pos.depthRA.y === rb.pos.depthRB.y
            && ra.pos.depthA1.y === rb.pos.depthB1.y
            && ra.pos.depthA2.y === rb.pos.depthB2.y;
        const tallestSetsNext = ra.pos.depthA2.y - ra.pos.depthA1.y === 350;
        ok(aligned && tallestSetsNext,
            'R23-7 depth grid aligns trees/generations and advances by tallest row (aligned ' + aligned + ', delta ' + (ra.pos.depthA2.y - ra.pos.depthA1.y).toFixed(1) + 'px)');
    }

    // R23-8/9: deterministic safety fuzz. Single-premise nodes isolate the
    // layout topology from target-box ordering and check both modes equally.
    {
        let overlaps = 0;
        let crossings = 0;
        let firstOverlap = null;
        let firstCrossing = null;
        for (let seed = 1; seed <= 24; seed++) {
            generatedId = 0;
            const root = randomTree(mulberry32(120000 + seed), 4);
            const mode = seed % 2 ? 'compact' : 'spread';
            const result = layout(root, mode);
            const o = overlapPairs(root, result).length;
            const c = properCrossings(root, result).length;
            overlaps += o;
            crossings += c;
            if (o && firstOverlap === null) firstOverlap = mode + ' seed ' + (120000 + seed);
            if (c && firstCrossing === null) firstCrossing = mode + ' seed ' + (120000 + seed);
        }
        ok(overlaps === 0,
            'R23-8 compact/spread safety guard: zero node overlaps over 24 varied-height seeds (found ' + overlaps + (firstOverlap ? ', first ' + firstOverlap : '') + ')');
        ok(crossings === 0,
            'R23-9 compact/spread safety guard: zero proper edge crossings over 24 varied-height seeds (found ' + crossings + (firstCrossing ? ', first ' + firstCrossing : '') + ')');
    }

    // R23-10: dense normalized multi-premise regression. The weighted phase
    // once oscillated until branches were tens of thousands of pixels from
    // the anchor, then exhausted the guard with one overlap still present.
    {
        const fixturePath = path.resolve(__dirname, 'layout-r23-seed-990699.fixture.json');
        const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
        function fromFixture(entry) {
            return multi(entry.id, entry.widths, entry.heights,
                (entry.children || []).map(child => ({ node: fromFixture(child), targetIndex: child.targetIndex || 0 })));
        }
        const root = fromFixture(fixture.tree);
        const result = layout(root, 'compact');
        const overlaps = overlapPairs(root, result);
        const anchors = Object.keys(result.pos).map(id => Math.abs(centerX(id, result) - 30000));
        const worstOffset = Math.max(0, ...anchors);
        ok(overlaps.length === 0 && worstOffset < 20000,
            'R23-10 dense multi-premise compact solver converges without overlap/runaway (overlaps/offset ' + overlaps.length + '/' + worstOffset.toFixed(1) + 'px)');
    }

    finish();
}

try {
    run();
} catch (error) {
    harnessFailure(error);
}
