'use strict';

// Focused regressions for r23 Depth-grid routing capacity.  This suite uses
// the shipped channel estimator/fixed-point solver with synthetic geometry;
// no browser layout engine is involved.

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

function extractFunction(source, name) {
    const lines = source.split(/\r?\n/);
    const start = lines.findIndex(line => new RegExp('^    function ' + name + '\\b').test(line));
    if (start < 0) throw new Error('missing function ' + name);
    for (let i = start + 1; i < lines.length; i++) {
        if (lines[i] === '    }') return lines.slice(start, i + 1).join('\n');
    }
    throw new Error('unterminated function ' + name);
}

try {
    const html = fs.readFileSync(FILE, 'utf8');
    const names = [
        'boxOf',
        'vgapForDepth',
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
        'computeRoutingChannels',
        'routingChannelSignature',
        'mergeRoutingChannelRequirements',
        'settleRoutingChannels'
    ];
    const functions = names.map(name => extractFunction(html, name)).join('\n');
    const sandbox = {
        console,
        Math,
        Object,
        Array,
        JSON,
        Set,
        state: { trees: [] },
        STRAIGHT_THRESH: 2,
        ROUTE_MIN_STUB: 10,
        ROUTE_CORNER_RADIUS: 6,
        ROUTE_STROKE_CLEARANCE: 2.05,
        NODE_ROUTE_CLEARANCE: 15 + 2.05 / 2,
        CENTER_X: 30000,
        CENTER_Y: 30000,
        VGAP_BASE: 50,
        CHANNEL_SPACING: 14,
        HGAP: 15,
        layoutMode: 'compact',
        spreadGaps: {},
        isFinite,
        Infinity
    };
    sandbox.visibleChildren = node => node.children || [];
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(`${functions}\nthis.api = {
        computeRoutingChannels,
        routingChannelSignature,
        settleRoutingChannels,
        computeTreeLayout
    };`, sandbox, { filename: FILE + '#depth-channel-extract' });

    const api = sandbox.api;
    const leaf = (id, targetIndex) => ({ id, texts: ['x'], children: [], targetIndex });
    const oneBox = (width = 180) => ({
        w: width,
        h: 60,
        anchorCx: width / 2,
        boxes: [{ cx: width / 2, w: width, h: 60, top: 0 }]
    });
    const positions = (root, childCenters) => {
        const pos = { [root.id]: { x: 0, y: 0 } };
        root.children.forEach((child, index) => {
            pos[child.id] = { x: childCenters[index] - 10, y: 110 };
        });
        return pos;
    };
    const geometryFor = roots => {
        const geom = {};
        roots.forEach(root => {
            geom[root.id] = oneBox();
            root.children.forEach(child => {
                geom[child.id] = { w: 20, h: 60, anchorCx: 10,
                    boxes: [{ cx: 10, w: 20, h: 60, top: 0 }] };
            });
        });
        return geom;
    };

    // A busy Shift-positioned tree still reserves its own corridor, but it
    // cannot make the automatic trees' shared Depth row taller.
    const auto = { id: 'auto', texts: ['x'], children: [leaf('auto-child', 0)] };
    const free = { id: 'free', texts: ['x'], freePosition: true,
        children: Array.from({ length: 5 }, (_, i) => leaf('free-' + i, 0)) };
    sandbox.state.trees = [auto, free];
    const freeGeom = geometryFor([auto, free]);
    const freePos = {
        ...positions(auto, [90]),
        ...positions(free, [-100, -80, -60, -40, -20])
    };
    const split = api.computeRoutingChannels(freePos, freeGeom);
    ok(split.perParent.auto === 1,
        'automatic tree keeps its one-channel parent requirement');
    ok(split.perParent.free === 5,
        'free tree retains its own five-channel parent requirement');
    ok(split.globalByDepth[0] === 1,
        'free tree does not inflate the non-free shared Depth grid');

    // Controlled feedback: capacity 1 lays out three bends; capacity 3
    // changes X and measures two; capacity 2 is the exact fixed point.
    const root = { id: 'root', texts: ['x'],
        children: [leaf('c1', 0), leaf('c2', 0), leaf('c3', 0)] };
    sandbox.state.trees = [root];
    const geom = geometryFor([root]);
    const capacities = [];
    const settled = api.settleRoutingChannels(geom, channels => {
        const capacity = channels.perParent.root || 1;
        capacities.push(capacity);
        const centers = capacity === 1 ? [0, 10, 20] : [0, 10, 135];
        return { pos: positions(root, centers), depthGrid: { capacity } };
    });
    const finalMeasured = api.computeRoutingChannels(settled.pos, geom);
    ok(capacities.join(',') === '1,3,2',
        'feedback iterates deterministically past the stale provisional count');
    ok(settled.exact && settled.passes === 3 && settled.channels.perParent.root === 2,
        'feedback reaches the exact two-channel fixed point in three bounded passes');
    ok(api.routingChannelSignature(finalMeasured) ===
        api.routingChannelSignature(settled.channels),
        'returned positions and routing channels agree');

    // A deliberately oscillating 1<->2 mapping has no exact fixed point.
    // The solver must terminate with the conservative component-wise maximum.
    const cycleRoot = { id: 'cycle', texts: ['x'],
        children: [leaf('d1', 0), leaf('d2', 0)] };
    sandbox.state.trees = [cycleRoot];
    const cycleGeom = geometryFor([cycleRoot]);
    const cycle = api.settleRoutingChannels(cycleGeom, channels => {
        const capacity = channels.perParent.cycle || 1;
        const centers = capacity >= 2 ? [60, 120] : [-20, 0];
        return { pos: positions(cycleRoot, centers), depthGrid: null };
    });
    const cycleMeasured = api.computeRoutingChannels(cycle.pos, cycleGeom);
    ok(!cycle.exact && cycle.channels.perParent.cycle === 2 && cycle.passes <= 6,
        'non-fixed cycle terminates at a bounded conservative envelope');
    ok(cycle.channels.perParent.cycle >= cycleMeasured.perParent.cycle,
        'cycle fallback never under-reserves its rendered fan');

    // Exercise the same dense tree used by the broader layout/routing gates,
    // proving that the real compact solver (not just the controlled callback
    // above) returns positions whose measured capacity is final.
    const denseFixture = JSON.parse(fs.readFileSync(
        path.resolve(__dirname, 'layout-r23-seed-990699.fixture.json'), 'utf8'));
    const denseGeom = {};
    function fromDense(spec) {
        let cursor = 0;
        const boxes = spec.widths.map((width, index) => {
            const box = { cx: cursor + width / 2, w: width,
                h: spec.heights[index], top: 0 };
            cursor += width + (index + 1 < spec.widths.length ? 15 : 0);
            return box;
        });
        const result = {
            id: spec.id,
            texts: spec.widths.map(() => 'x'),
            children: (spec.children || []).map(fromDense)
        };
        if (spec.targetIndex !== undefined) result.targetIndex = spec.targetIndex;
        denseGeom[result.id] = {
            w: cursor,
            h: Math.max(...spec.heights),
            boxes,
            anchorCx: (boxes[0].cx + boxes[boxes.length - 1].cx) / 2
        };
        return result;
    }
    const denseRoot = fromDense(denseFixture.tree);
    denseRoot.x = 1000;
    denseRoot.y = 100;
    sandbox.state.trees = [denseRoot];
    const denseTrace = [];
    const dense = api.settleRoutingChannels(denseGeom, channels => {
        denseTrace.push(api.routingChannelSignature(channels));
        return { pos: api.computeTreeLayout(denseRoot, denseGeom, null, channels.perParent,
                channels.perParentMinGap),
            depthGrid: null };
    });
    const denseMeasured = api.computeRoutingChannels(dense.pos, denseGeom);
    ok(api.routingChannelSignature(denseMeasured) ===
        api.routingChannelSignature(dense.channels),
        'dense compact fixture finishes with non-stale channel requirements');
    if (process.env.R23_CHANNEL_DEBUG === '1') {
        console.log('  dense channel trace:', denseTrace.join(' -> '));
    }

    const layoutStart = html.indexOf('    function layoutAll()');
    const layoutEnd = html.indexOf('\n    function ', layoutStart + 1);
    const layoutSource = html.slice(layoutStart, layoutEnd < 0 ? undefined : layoutEnd);
    ok(/settleRoutingChannels\(geom, channels =>/.test(layoutSource),
        'layoutAll uses the fixed-point channel solver');
    ok(/channels\.globalMinDepthStep/.test(layoutSource) &&
        /channels\.perParentMinGap/.test(layoutSource),
        'layoutAll applies exact per-parent and shared-Depth clearance constraints');
} catch (error) {
    console.error(error && error.stack ? error.stack : error);
    failed++;
}

console.log(`\n--- layout-r23-depth-channel-test: ${passed} passed, ${failed} failed ---`);
process.exit(failed ? 1 : 0);
