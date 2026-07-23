// Focused regression for the seed-88 Compact safety-projection cycle.
//
// The old solver tried to cure a same-parent, cross-target rounded-corner
// route conflict by moving child branches horizontally. Recentring moved the
// route target in the opposite direction, lengthened the horizontal run, and
// exhausted the 5,000-iteration guard with a foreign-node overlap.

'use strict';

const { performance } = require('perf_hooks');
const harness = require('./layout-r24-clearance-sweep-test.js');
const { lineContacts } = require('./layout-r24-clearance-fuzz-test.js');

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

function one(id, width, height, targetIndex, children) {
    const node = harness.single(id, width, height, children || []);
    if (targetIndex !== undefined) node.targetIndex = targetIndex;
    return node;
}

function many(id, widths, heights, targetIndex, children) {
    const node = harness.multi(id, widths, heights, children || []);
    if (targetIndex !== undefined) node.targetIndex = targetIndex;
    return node;
}

const n4 = many('s88_n4', [260, 80, 70, 140, 380.25],
    [120, 160, 70, 70, 210], 0);
const n3 = one('s88_n3', 170.25, 170, 1, [n4]);
const n1 = many('s88_n1', [340.25, 90, 410], [70, 70, 70.02], 1, [
    one('s88_n2', 320, 390.02, 2),
    n3,
    one('s88_n7', 390, 40, 0),
    one('s88_n8', 200, 250, 1)
]);
const n12 = many('s88_n12', [60, 190], [420, 40], 0, [
    one('s88_n20', 370, 100, 1)
]);
const root = many('s88_n0', [420, 390], [50, 110], undefined, [n1, n12]);

const started = performance.now();
const result = harness.layoutRoot(root, 'compact');
const elapsed = performance.now() - started;
const audit = harness.audit(result);
const contacts = lineContacts(audit.drawing);
const maxOffset = Object.values(result.pos).reduce((max, position) => Math.max(max,
    Math.abs(position.x - root.x), Math.abs(position.y - root.y)), 0);

ok(result.exact === true,
    'CC1 routing-channel settling reaches an exact fixed point',
    'passes=' + result.passes);
ok(audit.nodeNode.length === 0,
    'CC2 no connected nodes violate HGAP clearance',
    harness.concise(audit.nodeNode, 'node'));
ok(audit.nodeRoute.length === 0,
    'CC3 routes and forks preserve HGAP from foreign nodes',
    harness.concise(audit.nodeRoute, 'route'));
ok(contacts.length === 0,
    'CC4 routes and forks have no forbidden center-line contact',
    contacts.slice(0, 3).map(contact => contact.type).join(','));
ok(maxOffset < 10000,
    'CC5 solver does not run away while resolving the cycle',
    'maxOffset=' + maxOffset.toFixed(1) + 'px');
ok(elapsed < 5000,
    'CC6 nine-node cycle fixture completes within a generous bound',
    'elapsed=' + elapsed.toFixed(1) + 'ms');

console.log('\nRuntime=' + elapsed.toFixed(1) + 'ms, settlePasses=' + result.passes +
    ', maxOffset=' + maxOffset.toFixed(1) + 'px');
console.log('--- layout-r24-compact-cycle-test: ' + passed + ' passed, ' + failed + ' failed ---');
process.exit(failed ? 1 : 0);
