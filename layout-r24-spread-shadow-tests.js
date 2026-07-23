'use strict';

// Focused red-first regression for the supplied mockup fixture.
//
// This suite deliberately tests two independent contracts:
//   1. Text labels preserve the target co-premise in their identity, so the
//      A-targeted one-box premise and C-targeted five-box co-premise group do
//      not merge during import.
//   2. Spread treats each statement box as the root of its own horizontal
//      lane.  A lane contains the statement plus the complete subtrees of all
//      children targeting it; adjacent statement lanes must clear by HGAP.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, 'argument-mapper-r24.html');

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

function extractFunction(source, name) {
    const lines = source.split('\n');
    const pattern = new RegExp('^    function ' + name + '\\b');
    const starts = [];
    lines.forEach((line, index) => { if (pattern.test(line)) starts.push(index); });
    if (starts.length !== 1) {
        throw new Error('expected exactly one definition of ' + name + ', found ' + starts.length);
    }
    const start = starts[0];
    for (let index = start + 1; index < lines.length; index++) {
        if (/^    }/.test(lines[index])) return lines.slice(start, index + 1).join('\n');
    }
    throw new Error('could not find end of ' + name);
}

function numericConstant(source, name, fallback) {
    const match = source.match(new RegExp('const ' + name + ' = ([\\d.]+)'));
    return match ? Number(match[1]) : fallback;
}

function makeApis(source) {
    const parseFn = extractFunction(source, 'parseTextToState');
    const layoutFn = extractFunction(source, 'computeTreeLayout');
    const HGAP = numericConstant(source, 'HGAP', 15);
    const sandbox = {
        console,
        Math,
        Object,
        Array,
        JSON,
        Map,
        Set,
        isFinite,
        Infinity,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(`
        var CENTER_X = 30000, CENTER_Y = 30000;
        var VGAP_BASE = ${numericConstant(source, 'VGAP_BASE', 50)};
        var CHANNEL_SPACING = ${numericConstant(source, 'CHANNEL_SPACING', 14)};
        var HGAP = ${HGAP};
        var layoutMode = 'spread';
        var spreadGaps = {};
        var spreadGapVectors = {};
        var spreadOffsets = {};
        var _nextTestId = 0;
        function generateId() { return 'import-' + (++_nextTestId); }
        function boxOf(parent, child) {
            const count = Math.max(1, (parent.texts || []).length);
            const value = child.targetIndex === undefined ? 0 : child.targetIndex;
            return Math.max(0, Math.min(value, count - 1));
        }
        function visibleChildren(node) { return node.children || []; }
        ${parseFn}
        ${layoutFn}
        globalThis.__r24SpreadApi = { parseTextToState, computeTreeLayout, boxOf };
    `, sandbox, { filename: FILE + '#spread-shadow-extract' });
    return { api: sandbox.__r24SpreadApi, HGAP };
}

function node(id, width, height, children) {
    return {
        id,
        texts: [''],
        children: children || [],
        _widths: [width],
        _heights: [height],
    };
}

function multi(id, widths, heights, childSpecs) {
    const specs = childSpecs || [];
    const result = {
        id,
        texts: widths.map(() => ''),
        children: specs.map(spec => spec.node),
        _widths: widths.slice(),
        _heights: heights.slice(),
    };
    specs.forEach(spec => {
        if (spec.targetIndex !== undefined) spec.node.targetIndex = spec.targetIndex;
    });
    return result;
}

function geometryFor(root, minimumGap) {
    const geom = {};
    (function walk(n) {
        const widths = n._widths;
        const heights = n._heights;
        const boxes = [];
        let cursor = 0;
        widths.forEach((width, index) => {
            boxes.push({
                cx: cursor + width / 2,
                w: width,
                h: heights[index],
                top: 0,
            });
            cursor += width + (index + 1 < widths.length ? minimumGap : 0);
        });
        geom[n.id] = {
            w: cursor,
            h: Math.max(...heights),
            boxes,
            anchorCx: (boxes[0].cx + boxes[boxes.length - 1].cx) / 2,
        };
        n.children.forEach(walk);
    })(root);
    return geom;
}

function run() {
    let source;
    let api;
    let HGAP;
    try {
        source = fs.readFileSync(FILE, 'utf8');
        ({ api, HGAP } = makeApis(source));
    } catch (error) {
        console.error('HARNESS ERROR: ' + (error.stack || error));
        process.exit(2);
    }

    console.log('layout-r24-spread-shadow-tests target: ' + path.basename(FILE));

    const suppliedText = [
        'M1: Main Contention',
        '  M1P1a: ',
        '  M1P1b: \\n\\n\\n\\n\\n\\n',
        '  M1P1c: ',
        '    M1P1aP1: ',
        '      M1P1aP1P1a: ',
        '      M1P1aP1P1b: ',
        '    M1P1cP1a: ',
        '    M1P1cP1b: ',
        '    M1P1cP1c: ',
        '    M1P1cP1d: ',
        '    M1P1cP1e: ',
        '  M1P2: ',
        '    M1P2P1:',
    ].join('\n');

    const imported = api.parseTextToState(suppliedText);
    const main = imported.trees[0];
    const abc = main && main.children.find(child => child.texts.length === 3);
    const abcChildren = abc ? abc.children : [];
    const byTarget = new Map(abcChildren.map(child => [child.targetIndex || 0, child]));
    const importedA = byTarget.get(0);
    const importedC = byTarget.get(2);

    ok(abcChildren.length === 2,
        'import keeps the A-targeted and C-targeted premise groups distinct',
        'children=' + abcChildren.length + ', text-counts=' + abcChildren.map(n => n.texts.length).join('/'));
    ok(!!importedA && importedA.texts.length === 1 && !!importedC && importedC.texts.length === 5,
        'import preserves the intended 1-box/5-box grouping and targetIndex 0/2',
        'A=' + (importedA ? importedA.texts.length : 'missing') +
            ', C=' + (importedC ? importedC.texts.length : 'missing'));
    ok(!!importedA && importedA.children.length === 1 && importedA.children[0].texts.length === 2,
        'the two-box grandchild remains attached to the A-targeted premise');

    // Deterministic geometry matching the topology visible in the screenshots.
    const aGrandchild = multi('A-grandchild', [145, 145], [40, 40], []);
    const aPremise = node('A-premise', 145, 40, [aGrandchild]);
    const cPremises = multi('C-premises',
        [145, 145, 145, 145, 145], [40, 40, 40, 40, 40], []);
    const abcGroup = multi('ABC', [145, 145, 145], [40, 110, 40], [
        { node: aPremise, targetIndex: 0 },
        { node: cPremises, targetIndex: 2 },
    ]);
    const dChild = node('D-child', 145, 40, []);
    const dPremise = node('D-premise', 145, 40, [dChild]);
    const layoutRoot = node('M1', 150, 45, [abcGroup, dPremise]);
    layoutRoot.x = 30000;
    layoutRoot.y = 30000;

    const geom = geometryFor(layoutRoot, HGAP);
    const pos = api.computeTreeLayout(layoutRoot, geom, null, {}, {});
    const EPS = 0.01;

    function statementRect(n, index) {
        const box = geom[n.id].boxes[index];
        return {
            left: pos[n.id].x + box.cx - box.w / 2,
            right: pos[n.id].x + box.cx + box.w / 2,
        };
    }

    function subtreeBounds(n) {
        let left = Infinity;
        let right = -Infinity;
        (function walk(current) {
            const g = geom[current.id];
            g.boxes.forEach(box => {
                left = Math.min(left, pos[current.id].x + box.cx - box.w / 2);
                right = Math.max(right, pos[current.id].x + box.cx + box.w / 2);
            });
            current.children.forEach(walk);
        })(n);
        return { left, right };
    }

    function statementLanes(n) {
        const lanes = geom[n.id].boxes.map((_, index) => ({
            ...statementRect(n, index),
            index,
        }));
        n.children.forEach(child => {
            const index = api.boxOf(n, child);
            const bounds = subtreeBounds(child);
            lanes[index].left = Math.min(lanes[index].left, bounds.left);
            lanes[index].right = Math.max(lanes[index].right, bounds.right);
        });
        return lanes;
    }

    const violations = [];
    (function audit(n) {
        const lanes = statementLanes(n);
        for (let index = 1; index < lanes.length; index++) {
            const clearance = lanes[index].left - lanes[index - 1].right;
            if (clearance < HGAP - EPS) {
                violations.push(n.id + ':' + (index - 1) + '>' + index + '=' + clearance.toFixed(2));
            }
        }
        n.children.forEach(audit);
    })(layoutRoot);

    ok(violations.length === 0,
        'Spread keeps every target lane out of every nonancestor statement shadow',
        violations.length ? violations.join(', ') : 'all adjacent lane clearances >= ' + HGAP + 'px');

    const abcBoxes = [0, 1, 2].map(index => statementRect(abcGroup, index));
    const gapAB = abcBoxes[1].left - abcBoxes[0].right;
    const gapBC = abcBoxes[2].left - abcBoxes[1].right;
    ok(Math.abs(gapAB - gapBC) > 0.5,
        'Spread permits unequal adjacent A-B/B-C gaps when their statement lanes require it',
        'A-B=' + gapAB.toFixed(2) + 'px, B-C=' + gapBC.toFixed(2) + 'px');

    const aLane = statementLanes(abcGroup)[0];
    const bLane = statementLanes(abcGroup)[1];
    const cLane = statementLanes(abcGroup)[2];
    ok(Math.abs((bLane.left - aLane.right) - HGAP) < 0.5 &&
            Math.abs((cLane.left - bLane.right) - HGAP) < 0.5,
        'Spread uses the minimum clearance between adjacent statement lanes',
        'A/B=' + (bLane.left - aLane.right).toFixed(2) +
            'px, B/C=' + (cLane.left - bLane.right).toFixed(2) + 'px');

    console.log('\n--- layout-r24-spread-shadow-tests: ' + passed + ' passed, ' + failed + ' failed ---');
    process.exit(failed ? 1 : 0);
}

run();
