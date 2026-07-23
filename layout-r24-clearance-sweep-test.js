// Red-first regression for the M1P2P1 height/clearance discontinuity.
//
// This extracts the shipped computeTreeLayout() and uses the user's complete
// topology with deterministic measured box geometry. It intentionally audits
// minimum visible clearance, not merely positive-area intersection.
//
// Usage: node layout-r24-clearance-sweep-test.js [argument-mapper-r24.html]

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, 'argument-mapper-r24.html');

let passed = 0;
let failed = 0;
const failures = [];

function ok(condition, label, detail) {
    if (condition) {
        passed++;
        console.log('  \u2713 ' + label);
    } else {
        failed++;
        const message = label + (detail ? ' -- ' + detail : '');
        failures.push(message);
        console.log('  \u2717 FAIL: ' + message);
    }
}

function extractFunction(source, name) {
    const lines = source.split(/\r?\n/);
    const pattern = new RegExp('^    (?:function ' + name + '\\b|const ' + name + ' = )');
    const starts = [];
    lines.forEach((line, index) => { if (pattern.test(line)) starts.push(index); });
    if (starts.length !== 1) {
        throw new Error('expected one top-level definition of ' + name + ', found ' + starts.length);
    }
    for (let index = starts[0] + 1; index < lines.length; index++) {
        if (/^    }/.test(lines[index])) return lines.slice(starts[0], index + 1).join('\n');
    }
    throw new Error('unterminated function ' + name);
}

function numericConstant(source, name, fallback) {
    const match = source.match(new RegExp('const ' + name + ' = ([\\d.]+)'));
    return match ? Number(match[1]) : fallback;
}

let html;
let api;
let HGAP;
let CHANNEL_SPACING;
let STRAIGHT_THRESH;
let ROUTE_MIN_STUB;
let ROUTE_CORNER_RADIUS;
let ROUTE_STROKE_CLEARANCE;
let EDGE_FORK_SOURCE = false;
try {
    html = fs.readFileSync(FILE, 'utf8');
    EDGE_FORK_SOURCE = /function routeSourceLocalX\b/.test(html);
    HGAP = numericConstant(html, 'HGAP', 15);
    CHANNEL_SPACING = numericConstant(html, 'CHANNEL_SPACING', 14);
    STRAIGHT_THRESH = numericConstant(html, 'STRAIGHT_THRESH', 2);
    ROUTE_MIN_STUB = numericConstant(html, 'ROUTE_MIN_STUB', 10);
    ROUTE_CORNER_RADIUS = numericConstant(html, 'ROUTE_CORNER_RADIUS', 6);
    ROUTE_STROKE_CLEARANCE = numericConstant(html, 'ROUTE_STROKE_CLEARANCE', 2.05);
    const names = [
        'collapsedList', 'boxOf', 'vgapForDepth', 'resolveRowPositions',
        'routeSegmentDistance', 'routeSegmentTouchesRect',
        'statementFanRouteSegments', 'statementFanCornerRects', 'statementFanGeometry',
        'routeRectsWithinClearance', 'statementFanGeometriesConflict',
        'allocateStatementFanBands',
        'shiftedStatementFanPlans', 'minimumStatementFanChildShift',
        'computeRoutingChannels', 'routingChannelSignature',
        'mergeRoutingChannelRequirements', 'settleRoutingChannels',
        'computeTreeLayout'
    ];
    const fn = Object.fromEntries(names.map(name => [name, extractFunction(html, name)]));
    // Test-only instrumentation: preserve the exact shipped algorithm while
    // exposing the safety solver's selected collision and branch shifts.
    // This is inert unless layoutRoot receives a debug callback.
    fn.computeTreeLayout = fn.computeTreeLayout.replace(
        'worst = { left: a.owner, right: b.owner, need };',
        'worst = { left: a.owner, right: b.owner, need, debugA: a, debugB: b };'
    ).replace(
        'if (!expandBranchesMonotonically(lca, lb, rb, amount)) return;',
        `if (typeof __layoutDebugHook === 'function') __layoutDebugHook({
                    guard, need: hit.need, left: hit.left.id, right: hit.right.id,
                    lca: lca.id, leftBranch: lb.id, rightBranch: rb.id,
                    leftShift: branchShift[lb.id] || 0,
                    rightShift: branchShift[rb.id] || 0,
                    a: hit.debugA ? { kind: hit.debugA.kind,
                        owner: hit.debugA.owner && hit.debugA.owner.id,
                        routeParent: hit.debugA.routeParent,
                        target: hit.debugA.target, x0: hit.debugA.x0,
                        x1: hit.debugA.x1, y0: hit.debugA.y0,
                        y1: hit.debugA.y1 } : null,
                    b: hit.debugB ? { kind: hit.debugB.kind,
                        owner: hit.debugB.owner && hit.debugB.owner.id,
                        routeParent: hit.debugB.routeParent,
                        target: hit.debugB.target, x0: hit.debugB.x0,
                        x1: hit.debugB.x1, y0: hit.debugB.y0,
                        y1: hit.debugB.y1 } : null
                });
                if (!expandBranchesMonotonically(lca, lb, rb, amount)) return;`
    );
    const sandbox = { console, Math, Object, Array, JSON, isFinite, Infinity };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(`
        var CENTER_X = 30000, CENTER_Y = 30000;
        var VGAP_BASE = ${numericConstant(html, 'VGAP_BASE', 50)};
        var CHANNEL_SPACING = ${CHANNEL_SPACING};
        var HGAP = ${HGAP};
        var STRAIGHT_THRESH = ${STRAIGHT_THRESH};
        var ROUTE_MIN_STUB = ${ROUTE_MIN_STUB};
        var ROUTE_CORNER_RADIUS = ${ROUTE_CORNER_RADIUS};
        var ROUTE_STROKE_CLEARANCE = ${ROUTE_STROKE_CLEARANCE};
        var NODE_ROUTE_CLEARANCE = HGAP + ROUTE_STROKE_CLEARANCE / 2;
        var layoutMode = 'compact';
        var spreadGaps = {};
        var state = { trees: [] };
        var __layoutDebugHook = null;
        function isBoxCollapsed(node, index) { return collapsedList(node).includes(index); }
        function isChildVisible(node, child) { return !isBoxCollapsed(node, boxOf(node, child)); }
        function visibleChildren(node) { return (node.children || []).filter(child => isChildVisible(node, child)); }
        ${names.map(name => fn[name]).join('\n')}
        globalThis.__clearanceApi = {
            computeTreeLayout,
            allocateStatementFanBands,
            setMode(mode) { layoutMode = mode; spreadGaps = {}; },
            setDebugHook(hook) { __layoutDebugHook = hook; },
            settleRoot(root, geom) {
                state.trees = [root];
                return settleRoutingChannels(geom, channels => ({
                    pos: computeTreeLayout(root, geom, null,
                        channels.perParent, channels.perParentMinGap),
                    depthGrid: null
                }));
            }
        };
    `, sandbox, { filename: FILE + '#clearance-sweep-extract' });
    api = sandbox.__clearanceApi;
} catch (error) {
    console.error('HARNESS ERROR:', error && error.stack ? error.stack : error);
    process.exit(2);
}

const INNER_GAP = 15;
// Match r24's conservative visible-stroke half-envelope exactly. It is
// 0.025px wider than the nominal 1px half-width to avoid rendered grazes.
const STROKE_PAD = ROUTE_STROKE_CLEARANCE / 2;
const EPS = 0.011;

function single(id, width, height, children) {
    return {
        id, texts: ['x'], collapsed: [], children: children || [],
        _widths: [width], _heights: [height], x: 30000, y: 30000
    };
}

function multi(id, widths, heights, children) {
    return {
        id, texts: widths.map(() => 'x'), collapsed: [], children: children || [],
        _widths: widths.slice(), _heights: heights.slice(), x: 30000, y: 30000
    };
}

// User topology:
// M1
//   M1P1a/b/c (one 3-box co-premise group; b is tall)
//     M1P1aP1 -> M1P1aP1P1a/b
//     M1P1cP1a/b/c/d/e
//   M1P2 -> variable-height M1P2P1
function fixture(m1p2p1Height) {
    const eCo = multi('M1P1aP1P1', [180, 180], [60, 60], []);
    const e = single('M1P1aP1', 180, 60, [eCo]);
    eCo.targetIndex = 0;

    const g = multi('M1P1cP1',
        [180, 180, 180, 180, 180], [60, 60, 60, 60, 60], []);
    g.targetIndex = 2;
    const abc = multi('M1P1', [180, 180, 180], [60, 200, 60], [e, g]);
    e.targetIndex = 0;

    const h = single('M1P2P1', 180, m1p2p1Height, []);
    const d = single('M1P2', 180, 60, [h]);
    h.targetIndex = 0;

    return single('M1', 180, 60, [abc, d]);
}

function geometryFor(root) {
    const geometry = {};
    (function walk(node) {
        let cursor = 0;
        const boxes = node._widths.map((width, index) => {
            const box = {
                cx: cursor + width / 2,
                w: width,
                h: node._heights[index],
                top: 0
            };
            cursor += width + INNER_GAP;
            return box;
        });
        geometry[node.id] = {
            w: cursor - INNER_GAP,
            h: Math.max(...node._heights),
            boxes,
            anchorCx: (boxes[0].cx + boxes[boxes.length - 1].cx) / 2
        };
        node.children.forEach(walk);
    })(root);
    return geometry;
}

function walkNodes(root, callback, parent) {
    callback(root, parent || null);
    root.children.forEach(child => walkNodes(child, callback, root));
}

function layoutAt(height, mode) {
    const root = fixture(height);
    return layoutRoot(root, mode);
}

function layoutRoot(root, mode, debugHook) {
    const geom = geometryFor(root);
    api.setMode(mode || 'compact');
    api.setDebugHook(debugHook || null);
    let settled;
    try {
        settled = api.settleRoot(root, geom);
    } finally {
        api.setDebugHook(null);
    }
    return {
        root, geom, pos: settled.pos, mode: mode || 'compact',
        channels: settled.channels, passes: settled.passes, exact: settled.exact
    };
}

function sourcePoint(child, result) {
    const p = result.pos[child.id];
    const g = result.geom[child.id];
    if (child.texts.length > 1) {
        if (EDGE_FORK_SOURCE && g.boxes.length) {
            const first = g.boxes[0], last = g.boxes[g.boxes.length - 1];
            return { x: p.x +
                (first.cx - first.w / 2 + last.cx + last.w / 2) / 2,
                y: p.y - 15 };
        }
        return { x: p.x + g.anchorCx, y: p.y - 15 };
    }
    return { x: p.x + g.boxes[0].cx, y: p.y };
}

function addNodeAndForkGeometry(result, drawing) {
    walkNodes(result.root, node => {
        const p = result.pos[node.id];
        const g = result.geom[node.id];
        g.boxes.forEach((box, boxIndex) => drawing.nodes.push({
            nodeId: node.id,
            boxIndex,
            x0: p.x + box.cx - box.w / 2,
            x1: p.x + box.cx + box.w / 2,
            y0: p.y + (box.top || 0),
            y1: p.y + (box.top || 0) + box.h
        }));
        if (node.texts.length > 1) {
            const centers = g.boxes.map(box => p.x + box.cx);
            const barY = p.y - 15;
            centers.forEach(x => drawing.primitives.push({
                kind: 'fork', owner: node.id,
                a: { x, y: barY }, b: { x, y: p.y }
            }));
            drawing.primitives.push({
                kind: 'fork', owner: node.id,
                a: { x: Math.min(...centers), y: barY },
                b: { x: Math.max(...centers), y: barY }
            });
        }
    });
}

function channelOffsets(count, bandHeight) {
    if (count <= 0) return [];
    if (count === 1) return [0];
    return Array.from({ length: count }, (_, index) =>
        index * bandHeight / (count - 1));
}

// Reconstruct the same statement-owned route skeleton from the real layout
// result. The height bug is exposed by the M1P1cP1 fork, but all outgoing
// routes are included so same-parent route-vs-sibling statics are audited.
function addRoutes(result, drawing) {
    const parentOf = {};
    walkNodes(result.root, (node, parent) => {
        if (parent) parentOf[node.id] = parent.id;
    });
    drawing.parentOf = parentOf;

    function routeParent(parent) {
        if (!parent.children.length) return;
        const pp = result.pos[parent.id];
        const pg = result.geom[parent.id];
        const fanMap = new Map();
        parent.children.forEach(child => {
            const target = Math.max(0, Math.min(child.targetIndex || 0, pg.boxes.length - 1));
            if (!fanMap.has(target)) fanMap.set(target, []);
            fanMap.get(target).push(child);
        });

        const plans = [];
        Array.from(fanMap.keys()).sort((a, b) => a - b).forEach(target => {
            const fan = fanMap.get(target);
            const box = pg.boxes[target];
            const targetLeft = pp.x + box.cx - box.w / 2;
            const targetY = pp.y + (box.top || 0) + box.h;
            // drawLines() treats sub-half-pixel source differences as ties;
            // Array#sort is stable, so preserve authored order in that case.
            fan.sort((a, b) => {
                const diff = sourcePoint(a, result).x - sourcePoint(b, result).x;
                return Math.abs(diff) < 0.5 ? 0 : diff;
            });
            const routes = fan.map((child, index) => {
                const source = sourcePoint(child, result);
                const targetX = targetLeft + box.w / (fan.length + 1) * (index + 1);
                return {
                    child, startX: source.x, startY: source.y,
                    targetX, targetY, dx: targetX - source.x
                };
            });
            const left = [], right = [];
            routes.forEach(route => {
                if (Math.abs(route.dx) < STRAIGHT_THRESH) route.straight = true;
                else if (route.dx > 0) left.push(route);
                else right.push(route);
            });
            left.sort((a, b) => a.startX - b.startX);
            right.sort((a, b) => b.startX - a.startX);
            const count = Math.max(left.length, right.length);
            const bandHeight = Math.max(0, (count - 1) * CHANNEL_SPACING);
            channelOffsets(left.length, bandHeight).forEach((offset, index) => {
                left[index].channelOffset = offset;
            });
            channelOffsets(right.length, bandHeight).forEach((offset, index) => {
                right[index].channelOffset = offset;
            });
            const plan = {
                key: target, routes, staticRects: [], staticSegments: [],
                parentObstacleRects: pg.boxes.map((other, index) => index === target ? null : ({
                    x0: pp.x + other.cx - other.w / 2,
                    x1: pp.x + other.cx + other.w / 2,
                    y0: pp.y + (other.top || 0),
                    y1: pp.y + (other.top || 0) + other.h
                })).filter(Boolean),
                locked: fan.length === 1 || count === 0,
                minTop: targetY, maxTop: targetY, preferredTop: targetY
            };
            fan.forEach(child => {
                const cp = result.pos[child.id];
                const cg = result.geom[child.id];
                cg.boxes.forEach(childBox => plan.staticRects.push({
                    x0: cp.x + childBox.cx - childBox.w / 2,
                    x1: cp.x + childBox.cx + childBox.w / 2,
                    y0: cp.y + (childBox.top || 0),
                    y1: cp.y + (childBox.top || 0) + childBox.h
                }));
                if (child.texts.length > 1) {
                    const centers = cg.boxes.map(childBox => cp.x + childBox.cx);
                    const barY = cp.y - 15;
                    centers.forEach(x => plan.staticSegments.push({
                        a: { x, y: barY }, b: { x, y: cp.y }
                    }));
                    plan.staticSegments.push({
                        a: { x: Math.min(...centers), y: barY },
                        b: { x: Math.max(...centers), y: barY }
                    });
                }
            });
            if (count) {
                const bends = left.concat(right);
                const minStartY = Math.min(...bends.map(route => route.startY));
                if (fan.length === 1) {
                    plan.preferredTop = targetY + (bends[0].startY - targetY) / 2;
                    plan.minTop = plan.maxTop = plan.preferredTop;
                } else {
                    plan.minTop = targetY + ROUTE_MIN_STUB;
                    plan.maxTop = Math.max(plan.minTop,
                        minStartY - ROUTE_MIN_STUB - bandHeight);
                    plan.preferredTop = Math.max(plan.minTop, Math.min(
                        targetY + (minStartY - targetY) / 2 - bandHeight / 2,
                        plan.maxTop));
                }
            }
            plans.push(plan);
        });

        const allocated = api.allocateStatementFanBands(plans);
        drawing.allocations.push({
            parentId: parent.id,
            allocated,
            plans: plans.map(plan => ({
                key: plan.key, locked: plan.locked, routes: plan.routes.length,
                minTop: plan.minTop, maxTop: plan.maxTop,
                preferredTop: plan.preferredTop, topY: plan.topY
            }))
        });
        plans.forEach(plan => plan.routes.forEach(route => {
            const base = {
                kind: 'route', childId: route.child.id,
                parentId: parent.id, targetBox: plan.key
            };
            if (route.straight) {
                drawing.primitives.push({ ...base,
                    a: { x: route.startX, y: route.startY },
                    b: { x: route.targetX, y: route.targetY } });
                return;
            }
            const channelY = plan.topY + route.channelOffset;
            const dir = route.dx > 0 ? 1 : -1;
            const radius = Math.min(ROUTE_CORNER_RADIUS, Math.abs(route.dx) / 2,
                Math.max((route.startY - channelY) / 2, 0.5),
                Math.max((channelY - route.targetY) / 2, 0.5));
            drawing.primitives.push(
                { ...base, a: { x: route.startX, y: route.startY },
                    b: { x: route.startX, y: channelY + radius } },
                { ...base, a: { x: route.startX + radius * dir, y: channelY },
                    b: { x: route.targetX - radius * dir, y: channelY } },
                { ...base, a: { x: route.targetX, y: channelY - radius },
                    b: { x: route.targetX, y: route.targetY } }
            );
        }));
        parent.children.forEach(routeParent);
    }
    routeParent(result.root);
}

function drawingFor(result) {
    const drawing = { nodes: [], primitives: [], parentOf: {}, allocations: [] };
    addNodeAndForkGeometry(result, drawing);
    addRoutes(result, drawing);
    return drawing;
}

function axisGap(a0, a1, b0, b1) {
    if (a1 <= b0) return b0 - a1;
    if (b1 <= a0) return a0 - b1;
    return 0;
}

function segmentBounds(segment, pad) {
    return {
        x0: Math.min(segment.a.x, segment.b.x) - pad,
        x1: Math.max(segment.a.x, segment.b.x) + pad,
        y0: Math.min(segment.a.y, segment.b.y) - pad,
        y1: Math.max(segment.a.y, segment.b.y) + pad
    };
}

function nodePairViolation(a, b) {
    const xGap = axisGap(a.x0, a.x1, b.x0, b.x1);
    const yGap = axisGap(a.y0, a.y1, b.y0, b.y1);
    return xGap < HGAP - EPS && yGap < HGAP - EPS
        ? { xGap, yGap } : null;
}

function routeIsClearanceIncident(primitive, node) {
    if (primitive.kind === 'fork') return primitive.owner === node.nodeId;
    if (primitive.childId === node.nodeId) return true;
    return primitive.parentId === node.nodeId && primitive.targetBox === node.boxIndex;
}

function audit(result) {
    const drawing = drawingFor(result);
    const nodeNode = [];
    const nodeRoute = [];
    let sameParentSiblingChecks = 0;

    for (let i = 0; i < drawing.nodes.length; i++) {
        for (let j = i + 1; j < drawing.nodes.length; j++) {
            const a = drawing.nodes[i], b = drawing.nodes[j];
            const violation = nodePairViolation(a, b);
            if (violation) nodeNode.push({ a, b, ...violation });
        }
    }

    drawing.primitives.forEach(primitive => {
        const routeBounds = segmentBounds(primitive, STROKE_PAD);
        drawing.nodes.forEach(node => {
            if (routeIsClearanceIncident(primitive, node)) return;
            if (primitive.kind === 'route' && drawing.parentOf[node.nodeId] === primitive.parentId &&
                node.nodeId !== primitive.childId) sameParentSiblingChecks++;
            const xGap = axisGap(node.x0, node.x1, routeBounds.x0, routeBounds.x1);
            const yGap = axisGap(node.y0, node.y1, routeBounds.y0, routeBounds.y1);
            if (xGap < HGAP - EPS && yGap < HGAP - EPS) {
                const nodeMid = (node.x0 + node.x1) / 2;
                const routeMid = (routeBounds.x0 + routeBounds.x1) / 2;
                nodeRoute.push({ node, primitive, xGap, yGap,
                    orientation: nodeMid <= routeMid ? 'node-route' : 'route-node' });
            }
        });
    });
    return { drawing, nodeNode, nodeRoute, sameParentSiblingChecks };
}

function concise(items, kind) {
    return items.slice(0, 5).map(item => {
        if (kind === 'node') {
            return item.a.nodeId + '-' + item.a.boxIndex + '/' +
                item.b.nodeId + '-' + item.b.boxIndex +
                ' gaps=' + item.xGap.toFixed(2) + ',' + item.yGap.toFixed(2);
        }
        const owner = item.primitive.kind === 'fork'
            ? 'fork:' + item.primitive.owner
            : 'route:' + item.primitive.childId + '>' + item.primitive.parentId;
        return item.orientation + ' ' + item.node.nodeId + '-' + item.node.boxIndex +
            '/' + owner + ' gaps=' + item.xGap.toFixed(2) + ',' + item.yGap.toFixed(2);
    }).join('; ');
}

function runSweep() {
const heights = [];
for (let height = 80; height <= 160; height += 1) heights.push(height);
[108.98, 109.00, 109.02, 124.98, 125.00, 125.02, 140.00, 140.02]
    .forEach(height => heights.push(height));
heights.sort((a, b) => a - b);

const compactAudits = heights.map(height => {
    const result = layoutAt(height, 'compact');
    return { height, result, audit: audit(result) };
});
const nodeFailures = compactAudits.filter(entry => entry.audit.nodeNode.length);
const routeFailures = compactAudits.filter(entry => entry.audit.nodeRoute.length);

ok(nodeFailures.length === 0,
    'CS1 compact sweep keeps every nonincident node pair at least HGAP apart on one axis',
    nodeFailures.length ? 'first h=' + nodeFailures[0].height + ': ' +
        concise(nodeFailures[0].audit.nodeNode, 'node') : '');
ok(routeFailures.length === 0,
    'CS2 compact sweep keeps every nonincident node/route/fork visible envelope at least HGAP apart',
    routeFailures.length ? 'first h=' + routeFailures[0].height + ': ' +
        concise(routeFailures[0].audit.nodeRoute, 'route') : '');
ok(compactAudits.every(entry => entry.audit.sameParentSiblingChecks > 0),
    'CS3 sweep actually audits same-parent outgoing routes against nonincident sibling statics');

function posAt(height) {
    return compactAudits.find(entry => Math.abs(entry.height - height) < 1e-8).result.pos;
}
const p10898 = posAt(108.98);
const p109 = posAt(109.00);
const p10902 = posAt(109.02);
const p125 = posAt(125.00);
const p12502 = posAt(125.02);

function weightedPhase(before, after) {
    const left = before.M1P1.x - after.M1P1.x;
    const right = after.M1P2.x - before.M1P2.x;
    return { left, right, weighted: left > 0.5 && right > 0.5 &&
        Math.abs(right - 5 * left) < 0.25 };
}
// r24 uses the renderer's exact 2.05px visible-stroke clearance (1.025px
// per side), so this boundary is 0.015px earlier than the old 1.01px
// pure-layout approximation: 108.98 is tolerated by EPS, 109.00 activates.
const forkPhase = weightedPhase(p10898, p109);
const nodePhase = weightedPhase(p125, p12502);
ok(forkPhase.weighted,
    'CS4 exact visible-stroke threshold activates route-node clearance with 5:1 movement',
    'ABC/D moves=' + forkPhase.left.toFixed(2) + '/' + forkPhase.right.toFixed(2));
ok(nodePhase.weighted,
    'CS5 125.00/125.02 activates the node-node clearance constraint with 5:1 movement',
    'ABC/D moves=' + nodePhase.left.toFixed(2) + '/' + nodePhase.right.toFixed(2));

// The two screenshots correspond to these middle states: h=120 approaches
// the fork; h=139 is almost touching the five-box node row.
for (const height of [120, 139]) {
    const entry = compactAudits.find(item => item.height === height);
    ok(entry.audit.nodeNode.length === 0 && entry.audit.nodeRoute.length === 0,
        'CS' + (height === 120 ? '6' : '7') + ' image-like h=' + height +
            ' satisfies node-node and node-route/fork minimum clearances',
        concise(entry.audit.nodeNode, 'node') + ' ' + concise(entry.audit.nodeRoute, 'route'));
}

// Spread owns disjoint 15px subtree lanes, so changing H's height must not
// create the compact threshold bug.
const spreadSamples = [80, 109.02, 120, 125.02, 139, 160].map(height => {
    const result = layoutAt(height, 'spread');
    return { height, audit: audit(result) };
});
ok(spreadSamples.every(entry => !entry.audit.nodeNode.length && !entry.audit.nodeRoute.length),
    'CS8 spread samples preserve the same minimum-clearance invariants',
    spreadSamples.filter(entry => entry.audit.nodeNode.length || entry.audit.nodeRoute.length)
        .map(entry => 'h=' + entry.height).join(', '));

if (failures.length) {
    console.log('\nExpected red-first failures:');
    failures.forEach(message => console.log('  - ' + message));
}
console.log('\n--- layout-r24-clearance-sweep-test: ' + passed +
    ' passed, ' + failed + ' failed ---');
process.exit(failed ? 1 : 0);
}

module.exports = {
    single, multi, geometryFor, walkNodes, layoutRoot, drawingFor, audit,
    concise, axisGap, segmentBounds,
    constants: { HGAP, INNER_GAP, STROKE_PAD, EPS, ROUTE_STROKE_CLEARANCE }
};

if (require.main === module) runSweep();
