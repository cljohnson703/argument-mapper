// Deterministic adversarial Compact-layout fuzzing for r24.
//
// Audits 120 varied width/height/topology seeds for:
//   * HGAP node-node clearance;
//   * HGAP node-route/fork visible-envelope clearance;
//   * forbidden route/fork overlaps and intersections;
//   * non-finite or runaway layout output.
//
// Usage: node layout-r24-clearance-fuzz-test.js [argument-mapper-r24.html]

'use strict';

const { performance } = require('perf_hooks');
const harness = require('./layout-r24-clearance-sweep-test.js');

const SEED_START = Math.max(0, Number(process.env.ARGMAP_FUZZ_START || 0));
const SEED_COUNT = Math.max(1, Number(process.env.ARGMAP_FUZZ_COUNT || 120));
// Greedy minimization can be intentionally expensive for a runaway fixture;
// keep normal 120-seed regression runs bounded and opt in when investigating.
const MINIMIZE_FAILURES = process.env.ARGMAP_FUZZ_MINIMIZE === '1';
const PRINT_FIXTURES = process.env.ARGMAP_FUZZ_FIXTURES !== '0';
const ROOT_SEED = 0x24c1ea7;
const LINE_EPS = 1e-6;
const RUNAWAY_LIMIT = 100000;

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

function mulberry32(seed) {
    return function random() {
        let t = seed += 0x6d2b79f5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function int(random, min, max) {
    return min + Math.floor(random() * (max - min + 1));
}

function generatedTree(seed) {
    const random = mulberry32((ROOT_SEED ^ Math.imul(seed + 1, 0x9e3779b1)) >>> 0);
    let nextId = 0;
    let remaining = 26;

    function dimensions(textCount) {
        const widths = [];
        const heights = [];
        for (let i = 0; i < textCount; i++) {
            // Include narrow, ordinary, and very wide premises. Fractional
            // sizes exercise the layout EPS boundaries as well as integers.
            const width = int(random, 6, 42) * 10 + (random() < 0.2 ? 0.25 : 0);
            const tall = random() < 0.28;
            const height = tall ? int(random, 14, 44) * 10 : int(random, 4, 12) * 10;
            widths.push(width);
            heights.push(height + (random() < 0.2 ? 0.02 : 0));
        }
        return { widths, heights };
    }

    function makeNode(depth, forceChildren, targetCount) {
        remaining--;
        const id = 's' + seed + '_n' + nextId++;
        const textCount = depth === 0
            ? int(random, 1, 3)
            : (random() < 0.38 ? int(random, 2, 5) : 1);
        const size = dimensions(textCount);
        const node = {
            id,
            texts: size.widths.map(() => 'x'),
            collapsed: [],
            children: [],
            _widths: size.widths,
            _heights: size.heights,
            x: 30000,
            y: 30000
        };
        if (targetCount !== undefined) node.targetIndex = int(random, 0, targetCount - 1);

        if (depth < 3 && remaining > 0) {
            let childCount = 0;
            if (forceChildren) childCount = int(random, 2, 4);
            else if (random() < (depth === 1 ? 0.78 : 0.48)) childCount = int(random, 1, 4);
            childCount = Math.min(childCount, remaining);
            for (let i = 0; i < childCount; i++) {
                node.children.push(makeNode(depth + 1, false, textCount));
            }
        }
        return node;
    }

    const root = makeNode(0, true, undefined);
    // Roughly half the seeds get a guaranteed tall right-hand descendant
    // opposite a wide multi-premise cousin, reproducing the user's stress
    // class without making every topology identical.
    if (seed % 2 === 0 && root.children.length >= 2) {
        const left = root.children[0];
        const right = root.children[root.children.length - 1];
        if (left.texts.length === 1) {
            left.texts = ['x', 'x', 'x'];
            left._widths = [180, 180, 180];
            left._heights = [60, int(random, 16, 36) * 10, 60];
            left.children.forEach(child => {
                child.targetIndex = Math.min(child.targetIndex || 0, 2);
            });
        }
        if (!left.children.length && remaining > 0) left.children.push(makeNode(2, true, left.texts.length));
        if (!right.children.length && remaining > 0) right.children.push(makeNode(2, false, right.texts.length));
        if (right.children[0]) {
            right.children[0]._heights = right.children[0]._heights.map(() =>
                int(random, 8, 34) * 10 + (random() < 0.35 ? 0.02 : 0));
        }
    }
    return root;
}

function orientation(segment) {
    if (Math.abs(segment.a.y - segment.b.y) <= LINE_EPS) return 'h';
    if (Math.abs(segment.a.x - segment.b.x) <= LINE_EPS) return 'v';
    return 'd';
}

function interval(segment, axis) {
    return [Math.min(segment.a[axis], segment.b[axis]),
        Math.max(segment.a[axis], segment.b[axis])];
}

function samePoint(a, b) {
    return Math.abs(a.x - b.x) <= LINE_EPS && Math.abs(a.y - b.y) <= LINE_EPS;
}

function routeKey(segment) {
    return segment.kind === 'route' ? segment.childId : null;
}

function diagonalContact(a, b) {
    const p = a.a;
    const q = b.a;
    const r = { x: a.b.x - a.a.x, y: a.b.y - a.a.y };
    const s = { x: b.b.x - b.a.x, y: b.b.y - b.a.y };
    const qp = { x: q.x - p.x, y: q.y - p.y };
    const cross = (u, v) => u.x * v.y - u.y * v.x;
    const denominator = cross(r, s);
    if (Math.abs(denominator) > LINE_EPS) {
        const t = cross(qp, s) / denominator;
        const u = cross(qp, r) / denominator;
        if (t < -LINE_EPS || t > 1 + LINE_EPS ||
            u < -LINE_EPS || u > 1 + LINE_EPS) return null;
        return { type: 'intersection', point: {
            x: p.x + t * r.x,
            y: p.y + t * r.y
        } };
    }
    if (Math.abs(cross(qp, r)) > LINE_EPS) return null;

    const axis = Math.abs(r.x) >= Math.abs(r.y) ? 'x' : 'y';
    const ia = interval(a, axis), ib = interval(b, axis);
    const lo = Math.max(ia[0], ib[0]);
    const hi = Math.min(ia[1], ib[1]);
    if (hi < lo - LINE_EPS) return null;
    const value = (lo + hi) / 2;
    const delta = a.b[axis] - a.a[axis];
    const t = Math.abs(delta) > LINE_EPS ? (value - a.a[axis]) / delta : 0;
    return {
        type: hi - lo > LINE_EPS ? 'diagonal-overlap' : 'point',
        point: { x: a.a.x + t * r.x, y: a.a.y + t * r.y }
    };
}

function lineContacts(drawing) {
    const contacts = [];
    const primitives = drawing.primitives;
    const sources = {};
    // addRoutes emits each child route from source to target, with its first
    // primitive first. Read that exact endpoint instead of inferring it from
    // the fork-bar midpoint: r25 may attach the outgoing stem elsewhere on an
    // asymmetric bar, and a constrained bend may sit below the fork.
    primitives.filter(item => item.kind === 'route').forEach(item => {
        if (!sources[item.childId]) sources[item.childId] = { ...item.a };
    });

    function allowedPoint(a, b, point) {
        const route = a.kind === 'route' ? a : (b.kind === 'route' ? b : null);
        const fork = a.kind === 'fork' ? a : (b.kind === 'fork' ? b : null);
        return !!(route && fork && route.childId === fork.owner &&
            sources[route.childId] && samePoint(point, sources[route.childId]));
    }

    for (let i = 0; i < primitives.length; i++) {
        for (let j = i + 1; j < primitives.length; j++) {
            const a = primitives[i], b = primitives[j];
            if (a.kind === 'route' && b.kind === 'route' && routeKey(a) === routeKey(b)) continue;
            if (a.kind === 'fork' && b.kind === 'fork' && a.owner === b.owner) continue;
            const oa = orientation(a), ob = orientation(b);

            if (oa === 'h' && ob === 'h' && Math.abs(a.a.y - b.a.y) <= LINE_EPS) {
                const ia = interval(a, 'x'), ib = interval(b, 'x');
                const overlap = Math.min(ia[1], ib[1]) - Math.max(ia[0], ib[0]);
                if (overlap > LINE_EPS) {
                    contacts.push({ type: 'horizontal-overlap', a, b,
                        point: { x: Math.max(ia[0], ib[0]), y: a.a.y } });
                } else if (overlap >= -LINE_EPS) {
                    const point = { x: (Math.max(ia[0], ib[0]) + Math.min(ia[1], ib[1])) / 2,
                        y: a.a.y };
                    if (!allowedPoint(a, b, point)) contacts.push({ type: 'point', a, b, point });
                }
                continue;
            }
            if (oa === 'v' && ob === 'v' && Math.abs(a.a.x - b.a.x) <= LINE_EPS) {
                const ia = interval(a, 'y'), ib = interval(b, 'y');
                const overlap = Math.min(ia[1], ib[1]) - Math.max(ia[0], ib[0]);
                if (overlap > LINE_EPS) {
                    contacts.push({ type: 'vertical-overlap', a, b,
                        point: { x: a.a.x, y: Math.max(ia[0], ib[0]) } });
                } else if (overlap >= -LINE_EPS) {
                    const point = { x: a.a.x,
                        y: (Math.max(ia[0], ib[0]) + Math.min(ia[1], ib[1])) / 2 };
                    if (!allowedPoint(a, b, point)) contacts.push({ type: 'point', a, b, point });
                }
                continue;
            }

            let horizontal = null, vertical = null;
            if (oa === 'h' && ob === 'v') { horizontal = a; vertical = b; }
            if (oa === 'v' && ob === 'h') { horizontal = b; vertical = a; }
            if (horizontal && vertical) {
                const hx = interval(horizontal, 'x'), vy = interval(vertical, 'y');
                const point = { x: vertical.a.x, y: horizontal.a.y };
                if (point.x >= hx[0] - LINE_EPS && point.x <= hx[1] + LINE_EPS &&
                    point.y >= vy[0] - LINE_EPS && point.y <= vy[1] + LINE_EPS &&
                    !allowedPoint(a, b, point)) {
                    contacts.push({ type: 'intersection', a, b, point });
                }
            }
            // STRAIGHT_THRESH can produce a nearly vertical diagonal. Use
            // its exact centre-line intersection: a bounding-box proxy turns
            // the legitimate route/fork source join into a false crossing.
            if ((oa === 'd' || ob === 'd') && !horizontal && !vertical) {
                const contact = diagonalContact(a, b);
                if (contact && !allowedPoint(a, b, contact.point)) {
                    contacts.push({ ...contact, a, b });
                }
            }
        }
    }
    return contacts;
}

function inspect(root) {
    const started = performance.now();
    let result;
    let safetyIterations = 0;
    try {
        result = harness.layoutRoot(root, 'compact', () => { safetyIterations++; });
    } catch (error) {
        return { kind: 'exception', error, elapsed: performance.now() - started,
            safetyIterations };
    }
    const elapsed = performance.now() - started;
    const positions = Object.values(result.pos);
    const finite = positions.every(position => Number.isFinite(position.x) && Number.isFinite(position.y));
    const maxOffset = positions.reduce((max, position) => Math.max(max,
        Math.abs(position.x - root.x), Math.abs(position.y - root.y)), 0);
    if (!finite || maxOffset > RUNAWAY_LIMIT) {
        return { kind: 'runaway', result, elapsed, maxOffset };
    }
    const clearance = harness.audit(result);
    if (clearance.nodeNode.length) {
        return { kind: 'node-node', result, clearance, elapsed, maxOffset };
    }
    if (clearance.nodeRoute.length) {
        return { kind: 'node-route', result, clearance, elapsed, maxOffset };
    }
    const lines = lineContacts(clearance.drawing);
    if (lines.length) {
        return { kind: 'line-line', result, clearance, lines, elapsed, maxOffset };
    }
    return { kind: null, result, clearance, lines, elapsed, maxOffset, safetyIterations };
}

function clone(root) {
    return JSON.parse(JSON.stringify(root));
}

function childPaths(root) {
    const paths = [];
    (function walk(node, path) {
        node.children.forEach((child, index) => {
            const childPath = path.concat(index);
            paths.push(childPath);
            walk(child, childPath);
        });
    })(root, []);
    return paths.sort((a, b) => b.length - a.length);
}

function parentAt(root, path) {
    let node = root;
    for (let i = 0; i < path.length - 1; i++) node = node.children[path[i]];
    return node;
}

function minimize(root, kind) {
    let current = clone(root);
    let changed = true;
    while (changed) {
        changed = false;
        for (const path of childPaths(current)) {
            const candidate = clone(current);
            const parent = parentAt(candidate, path);
            parent.children.splice(path[path.length - 1], 1);
            const checked = inspect(candidate);
            if (checked.kind === kind) {
                current = candidate;
                changed = true;
                break;
            }
        }
    }
    return current;
}

function fixtureSummary(root) {
    function compact(node) {
        const result = {
            id: node.id,
            widths: node._widths,
            heights: node._heights
        };
        if (node.targetIndex !== undefined) result.targetIndex = node.targetIndex;
        if (node.children.length) result.children = node.children.map(compact);
        return result;
    }
    return JSON.stringify(compact(root));
}

function nodeCount(root) {
    let count = 0;
    harness.walkNodes(root, () => { count++; });
    return count;
}

function runFuzz() {
const counts = { exception: 0, runaway: 0, 'node-node': 0, 'node-route': 0, 'line-line': 0 };
const first = {};
const failureSeeds = { exception: [], runaway: [], 'node-node': [], 'node-route': [], 'line-line': [] };
const runtimes = [];
let worstOffset = 0;
let worstOffsetEntry = null;
let slowestEntry = null;
let siblingChecks = 0;
let nonExactSettles = 0;
let maxSettlePasses = 0;
let maxPassesEntry = null;
const suiteStarted = performance.now();

for (let seed = SEED_START; seed < SEED_START + SEED_COUNT; seed++) {
    const root = generatedTree(seed);
    const checked = inspect(root);
    runtimes.push(checked.elapsed);
    if (!slowestEntry || checked.elapsed > slowestEntry.checked.elapsed) {
        slowestEntry = { seed, root, checked };
    }
    if (!worstOffsetEntry || (checked.maxOffset || 0) >
        (worstOffsetEntry.checked.maxOffset || 0)) {
        worstOffsetEntry = { seed, root, checked };
    }
    worstOffset = Math.max(worstOffset, checked.maxOffset || 0);
    if (checked.clearance) siblingChecks += checked.clearance.sameParentSiblingChecks;
    if (checked.result) {
        if (!checked.result.exact) nonExactSettles++;
        if ((checked.result.passes || 0) > maxSettlePasses) {
            maxSettlePasses = checked.result.passes || 0;
            maxPassesEntry = { seed, root, checked };
        }
    }
    if (checked.kind) {
        counts[checked.kind]++;
        failureSeeds[checked.kind].push(seed);
        if (!first[checked.kind]) first[checked.kind] = { seed, root, checked };
    }
}
const suiteElapsed = performance.now() - suiteStarted;
runtimes.sort((a, b) => a - b);
const p95 = runtimes[Math.floor(runtimes.length * 0.95)];
const maxRuntime = runtimes[runtimes.length - 1];

ok(counts.exception === 0,
    'CF1 all ' + SEED_COUNT + ' deterministic Compact layouts complete without exception',
    counts.exception + ' exceptions');
ok(counts.runaway === 0,
    'CF2 all layouts converge to finite positions below the runaway bound',
    counts.runaway + ' runaway; worst offset=' + worstOffset.toFixed(1));
ok(counts['node-node'] === 0,
    'CF3 all seeds preserve HGAP node-node clearance',
    counts['node-node'] + ' failing seeds');
ok(counts['node-route'] === 0,
    'CF4 all seeds preserve HGAP node-route/fork visible-envelope clearance',
    counts['node-route'] + ' failing seeds');
ok(counts['line-line'] === 0,
    'CF5 all seeds avoid forbidden route/fork overlaps and contacts',
    counts['line-line'] + ' failing seeds');
ok(siblingChecks > 0,
    'CF6 randomized audit exercises same-parent outgoing routes against sibling statics',
    'checks=' + siblingChecks);

Object.keys(first).forEach(kind => {
    const entry = first[kind];
    const minimal = MINIMIZE_FAILURES ? minimize(entry.root, kind) : entry.root;
    const minimalCheck = inspect(minimal);
    console.log('\nFirst ' + kind + ' counterexample: seed=' + entry.seed +
        ', original runtime=' + entry.checked.elapsed.toFixed(2) + 'ms');
    if (kind === 'node-node') {
        console.log('  ' + harness.concise(minimalCheck.clearance.nodeNode, 'node'));
    } else if (kind === 'node-route') {
        console.log('  ' + harness.concise(minimalCheck.clearance.nodeRoute, 'route'));
    } else if (kind === 'line-line') {
        console.log('  ' + minimalCheck.lines.slice(0, 3).map(item => item.type +
            '@' + item.point.x.toFixed(2) + ',' + item.point.y.toFixed(2)).join('; '));
    } else if (kind === 'runaway') {
        console.log('  max offset=' + minimalCheck.maxOffset);
    } else if (kind === 'exception') {
        console.log('  ' + String(minimalCheck.error && minimalCheck.error.message));
    }
    console.log('  minimized=' + fixtureSummary(minimal));
});

console.log('\nRuntime: total=' + suiteElapsed.toFixed(1) + 'ms, p95=' + p95.toFixed(2) +
    'ms/seed, max=' + maxRuntime.toFixed(2) + 'ms/seed, worstOffset=' +
    worstOffset.toFixed(1) + 'px');
console.log('Seed range=' + SEED_START + '..' +
    (SEED_START + SEED_COUNT - 1) + (MINIMIZE_FAILURES ? '' : ' (minimization disabled)'));
if (slowestEntry) {
    console.log('Slowest seed=' + slowestEntry.seed + ', runtime=' +
        slowestEntry.checked.elapsed.toFixed(2) + 'ms, nodes=' +
        nodeCount(slowestEntry.root) + ', safetyIterations=' +
        (slowestEntry.checked.safetyIterations || 0));
    if (PRINT_FIXTURES) console.log('  fixture=' + fixtureSummary(slowestEntry.root));
}
if (worstOffsetEntry) {
    console.log('Widest seed=' + worstOffsetEntry.seed + ', offset=' +
        (worstOffsetEntry.checked.maxOffset || 0).toFixed(1) + 'px, nodes=' +
        nodeCount(worstOffsetEntry.root));
    if (PRINT_FIXTURES && (!slowestEntry || slowestEntry.seed !== worstOffsetEntry.seed)) {
        console.log('  fixture=' + fixtureSummary(worstOffsetEntry.root));
    }
}
console.log('Routing settle: nonExact=' + nonExactSettles + ', maxPasses=' +
    maxSettlePasses + (maxPassesEntry ? ' (seed=' + maxPassesEntry.seed + ')' : ''));
Object.keys(failureSeeds).forEach(kind => {
    if (failureSeeds[kind].length) {
        console.log(kind + ' seeds=' + failureSeeds[kind].join(','));
    }
});
console.log('--- layout-r24-clearance-fuzz-test: ' + passed + ' passed, ' + failed + ' failed ---');
return { passed, failed, counts, first, failureSeeds, suiteElapsed, p95, maxRuntime,
    worstOffset, slowestEntry, worstOffsetEntry };
}

module.exports = {
    generatedTree, inspect, minimize, fixtureSummary, lineContacts,
    nodeCount, clone, childPaths, parentAt, runFuzz
};

if (require.main === module) {
    const outcome = runFuzz();
    process.exit(outcome.failed ? 1 : 0);
}
