'use strict';

// Focused pure-layout regression for r25's edge-based parent centering.
// The outer child groups deliberately have unequal widths.  Centering their
// outer premise-box centres would put the parent 37.5px off the midpoint of
// their visible span; both Compact and Spread must instead use the outer
// edges while retaining the minimum inter-group gap.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, 'argument-mapper-r25.html');

let passed = 0;
let failed = 0;

function ok(value, label, detail) {
    if (value) {
        passed++;
        console.log('  \u2713 ' + label + (detail ? ' (' + detail + ')' : ''));
    } else {
        failed++;
        console.log('  \u2717 FAIL: ' + label + (detail ? ' (' + detail + ')' : ''));
    }
}

function extractFunctions(source, names) {
    const lines = source.split('\n');
    const result = {};
    names.forEach(name => {
        const pattern = new RegExp('^    function ' + name + '\\b');
        const starts = [];
        lines.forEach((line, index) => { if (pattern.test(line)) starts.push(index); });
        if (starts.length !== 1) {
            throw new Error('expected exactly one definition of ' + name + ', found ' + starts.length);
        }
        const start = starts[0];
        for (let index = start + 1; index < lines.length; index++) {
            if (/^    }/.test(lines[index])) {
                result[name] = lines.slice(start, index + 1).join('\n');
                return;
            }
        }
        throw new Error('could not find end of ' + name);
    });
    return result;
}

function numericConstant(source, name, fallback) {
    const match = source.match(new RegExp('const ' + name + ' = ([\\d.]+)'));
    return match ? Number(match[1]) : fallback;
}

function makeApi(source) {
    const names = [
        'collapsedList',
        'boxOf',
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
    ];
    const fn = extractFunctions(source, names);
    const sandbox = { console, Math, Object, Array, JSON, Map, Set, isFinite, Infinity };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(`
        var CENTER_X = 30000, CENTER_Y = 30000;
        var VGAP_BASE = ${numericConstant(source, 'VGAP_BASE', 50)};
        var CHANNEL_SPACING = ${numericConstant(source, 'CHANNEL_SPACING', 14)};
        var HGAP = ${numericConstant(source, 'HGAP', 15)};
        var STRAIGHT_THRESH = ${numericConstant(source, 'STRAIGHT_THRESH', 2)};
        var ROUTE_MIN_STUB = ${numericConstant(source, 'ROUTE_MIN_STUB', 10)};
        var ROUTE_CORNER_RADIUS = ${numericConstant(source, 'ROUTE_CORNER_RADIUS', 6)};
        var ROUTE_STROKE_CLEARANCE = ${numericConstant(source, 'ROUTE_STROKE_CLEARANCE', 2.05)};
        var NODE_ROUTE_CLEARANCE = HGAP + ROUTE_STROKE_CLEARANCE / 2;
        var layoutMode = 'compact';
        var spreadGaps = {};
        function isBoxCollapsed(node, index) { return collapsedList(node).includes(index); }
        function isChildVisible(node, child) { return !isBoxCollapsed(node, boxOf(node, child)); }
        function visibleChildren(node) { return (node.children || []).filter(child => isChildVisible(node, child)); }
        ${names.map(name => fn[name]).join('\n')}
        globalThis.__edgeCenterApi = {
            computeTreeLayout,
            setMode(mode) { layoutMode = mode; },
            resetSpread() { spreadGaps = {}; },
        };
    `, sandbox, { filename: FILE + '#edge-centering-extract' });
    return {
        api: sandbox.__edgeCenterApi,
        HGAP: numericConstant(source, 'HGAP', 15),
    };
}

function group(id, widths) {
    return {
        id,
        texts: widths.map(() => ''),
        children: [],
        _widths: widths.slice(),
    };
}

function fixture() {
    const left = group('left-child', [60, 90]);
    const right = group('right-child', [70, 210]);
    const root = group('parent', [120]);
    root.children = [left, right];
    root.x = 30000;
    root.y = 30000;
    return { root, left, right };
}

function geometryFor(root, gap) {
    const geom = {};
    (function walk(node) {
        let cursor = 0;
        const boxes = node._widths.map((width, index) => {
            const box = { cx: cursor + width / 2, w: width, h: 50, top: 0 };
            cursor += width + (index + 1 < node._widths.length ? gap : 0);
            return box;
        });
        geom[node.id] = {
            w: cursor,
            h: 50,
            boxes,
            anchorCx: (boxes[0].cx + boxes[boxes.length - 1].cx) / 2,
        };
        node.children.forEach(walk);
    })(root);
    return geom;
}

function run() {
    let source;
    let api;
    let HGAP;
    try {
        source = fs.readFileSync(FILE, 'utf8');
        ({ api, HGAP } = makeApi(source));
    } catch (error) {
        console.error('HARNESS ERROR: ' + (error.stack || error));
        process.exit(2);
    }

    console.log('layout-r25-edge-centering-test target: ' + path.basename(FILE));
    const EPS = 0.01;

    for (const mode of ['compact', 'spread']) {
        const { root, left, right } = fixture();
        const geom = geometryFor(root, HGAP);
        api.setMode(mode);
        api.resetSpread();
        const pos = api.computeTreeLayout(root, geom, null, {}, {});

        const rootBox = geom[root.id].boxes[0];
        const leftBoxes = geom[left.id].boxes;
        const rightBoxes = geom[right.id].boxes;
        const rootCenter = pos[root.id].x + rootBox.cx;
        const outerLeft = pos[left.id].x + leftBoxes[0].cx - leftBoxes[0].w / 2;
        const outerRight = pos[right.id].x + rightBoxes[rightBoxes.length - 1].cx +
            rightBoxes[rightBoxes.length - 1].w / 2;
        const edgeMidpoint = (outerLeft + outerRight) / 2;
        const oldCenterMidpoint = (
            pos[left.id].x + leftBoxes[0].cx +
            pos[right.id].x + rightBoxes[rightBoxes.length - 1].cx
        ) / 2;
        const leftRightEdge = pos[left.id].x + leftBoxes[leftBoxes.length - 1].cx +
            leftBoxes[leftBoxes.length - 1].w / 2;
        const rightLeftEdge = pos[right.id].x + rightBoxes[0].cx - rightBoxes[0].w / 2;

        ok(Math.abs(rootCenter - edgeMidpoint) <= EPS,
            mode + ' centers the parent on the outer child edges',
            'delta=' + (rootCenter - edgeMidpoint).toFixed(3) + 'px');
        ok(Math.abs(rootCenter - oldCenterMidpoint) > 1,
            mode + ' does not regress to outer-child-center centering',
            'center-rule delta=' + (rootCenter - oldCenterMidpoint).toFixed(3) + 'px');
        ok(Math.abs((rightLeftEdge - leftRightEdge) - HGAP) <= EPS,
            mode + ' preserves the minimum child-group gap',
            'gap=' + (rightLeftEdge - leftRightEdge).toFixed(3) + 'px');
    }

    console.log('\n--- layout-r25-edge-centering-test: ' + passed +
        ' passed, ' + failed + ' failed ---');
    process.exit(failed ? 1 : 0);
}

run();
