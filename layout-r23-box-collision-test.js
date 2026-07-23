'use strict';

// Focused regression for compact collision packing around unequal-height
// co-premises. Run with:
//   node layout-r23-box-collision-test.js [argument-mapper-r23.html]

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, 'argument-mapper-r23.html');

let passed = 0;
let failed = 0;
function ok(condition, label, detail) {
    if (condition) {
        passed++;
        console.log('  \u2713 ' + label);
    } else {
        failed++;
        console.log('  \u2717 FAIL: ' + label + (detail ? ' -- ' + detail : ''));
    }
}

function extractFunction(source, name) {
    const lines = source.split('\n');
    const start = lines.findIndex(line => new RegExp(
        '^    (?:function ' + name + '\\b|const ' + name + ' = )').test(line));
    if (start < 0) throw new Error('Could not find ' + name);
    for (let index = start + 1; index < lines.length; index++) {
        if (/^    }/.test(lines[index])) return lines.slice(start, index + 1).join('\n');
    }
    throw new Error('Could not find the end of ' + name);
}

function numericConstant(source, name, fallback) {
    const match = source.match(new RegExp('const ' + name + ' = ([\\d.]+)'));
    return match ? Number(match[1]) : fallback;
}

function single(id, width, height, children) {
    return { id, texts: ['x'], children: children || [], _widths: [width], _heights: [height] };
}

function multi(id, widths, heights, children) {
    return { id, texts: widths.map(() => 'x'), children: children || [],
        _widths: widths.slice(), _heights: heights.slice() };
}

function geometryFor(root) {
    const result = {};
    (function walk(node) {
        let left = 0;
        const boxes = node._widths.map((width, index) => {
            const box = { cx: left + width / 2, w: width, h: node._heights[index] };
            left += width + 15;
            return box;
        });
        result[node.id] = {
            w: left - 15,
            h: Math.max(...node._heights),
            boxes
        };
        node.children.forEach(walk);
    })(root);
    return result;
}

try {
    const html = fs.readFileSync(FILE, 'utf8');
    const names = ['collapsedList', 'boxOf', 'vgapForDepth', 'resolveRowPositions',
        'routeSegmentDistance', 'routeSegmentTouchesRect', 'statementFanRouteSegments',
        'statementFanCornerRects', 'statementFanGeometry', 'routeRectsWithinClearance',
        'statementFanGeometriesConflict',
        'allocateStatementFanBands', 'shiftedStatementFanPlans',
        'minimumStatementFanChildShift', 'computeTreeLayout'];
    const fn = Object.fromEntries(names.map(name => [name, extractFunction(html, name)]));
    const sandbox = { console, Math, Object, Array, JSON, isFinite, Infinity };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(`
        var CENTER_X = 30000, CENTER_Y = 30000;
        var VGAP_BASE = ${numericConstant(html, 'VGAP_BASE', 50)};
        var CHANNEL_SPACING = ${numericConstant(html, 'CHANNEL_SPACING', 14)};
        var HGAP = ${numericConstant(html, 'HGAP', 15)};
        var STRAIGHT_THRESH = ${numericConstant(html, 'STRAIGHT_THRESH', 2)};
        var ROUTE_MIN_STUB = ${numericConstant(html, 'ROUTE_MIN_STUB', 10)};
        var ROUTE_CORNER_RADIUS = ${numericConstant(html, 'ROUTE_CORNER_RADIUS', 6)};
        var ROUTE_STROKE_CLEARANCE = ${numericConstant(html, 'ROUTE_STROKE_CLEARANCE', 2.05)};
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
        globalThis.runLayout = computeTreeLayout;
    `, sandbox, { filename: FILE + '#box-collision-test' });

    // The left sibling is a co-premise group with a tall LEFT statement and
    // a short RIGHT statement. The wide grandchild of the right sibling is
    // low enough to sit under that short statement. Its left edge is exactly
    // 15px beyond the tall box, so no horizontal branch expansion is legal.
    const grandchild = single('grandchild', 530, 60, []);
    const right = single('right', 100, 60, [grandchild]);
    const ragged = multi('ragged', [100, 200], [320, 60], []);
    const root = single('root', 100, 60, [ragged, right]);
    root.x = 1000;
    root.y = 100;

    const geom = geometryFor(root);
    const pos = sandbox.runLayout(root, geom, null, {});
    const raggedX = pos.ragged.x;
    const tallRight = raggedX + 100;
    const shortLeft = raggedX + 115;
    const shortRight = shortLeft + 200;
    const deepLeft = pos.grandchild.x;
    const rightLeft = pos.right.x;
    const actualGap = deepLeft - tallRight;
    const siblingGap = rightLeft - shortRight;
    const fictitiousSolidOverlap = shortRight + 15 - deepLeft;
    const verticalClearance = pos.grandchild.y - (pos.ragged.y + 60);

    console.log('layout-r23-box-collision-test target: ' + path.basename(FILE));
    ok(Math.abs(actualGap - 15) < 0.01,
        'BC1 keeps the minimum 15px gap from the vertically present tall box',
        'gap=' + actualGap.toFixed(2));
    ok(deepLeft < shortRight && verticalClearance > 0,
        'BC2 permits the grandchild to occupy empty space below the short co-premise',
        'horizontal overlap=' + (shortRight - deepLeft).toFixed(2) +
            ', vertical clearance=' + verticalClearance.toFixed(2));
    ok(Math.abs(siblingGap - 15) < 0.01,
        'BC3 leaves the same-row co-premise/sibling gap at its 15px minimum',
        'gap=' + siblingGap.toFixed(2));
    ok(fictitiousSolidOverlap > 200,
        'BC4 fixture exercises the former solid-group false collision',
        'false required shift=' + fictitiousSolidOverlap.toFixed(2));

    console.log('\n--- layout-r23-box-collision-test: ' + passed + ' passed, ' + failed + ' failed ---');
    process.exit(failed ? 1 : 0);
} catch (error) {
    console.error('\nHARNESS ERROR:');
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(2);
}
