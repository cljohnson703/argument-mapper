'use strict';
// r27 Line spacing between fans, and rendering tolerance.
//
// The reported bug: in Narrow, a two-premise objection's lines went missing
// after switching Breadth, and before that some looked as if they touched.
// Both came from one corridor. Lines of different fans only had to clear each
// other by 2.05px between center-lines -- for 2px strokes, a visible gap of
// 0.05px -- and layout reserved that corridor to within a thousandth of a
// pixel, so the browser's own rounding could tip drawLines' re-check over the
// edge; it then fails closed and draws none of that parent's lines.
// Now lines of different fans keep ROUTE_LINE_CLEARANCE (14px, the spacing of
// one fan's own channels), and drawLines forgives ROUTE_RENDER_SLACK of
// measurement noise -- never a real shortfall.
//
// Covers:
//   (1) the constants, and drawLines passing the slack to both allocations;
//   (2) a corridor too short for 14px fails; the least shift that fits gives
//       lines at least 14px apart;
//   (3) just under that fit (0.05px, browser rounding), strict allocation
//       fails but the renderer's succeeds, still at least 14 - slack apart;
//   (4) a real shortfall (1px) is not forgiven;
//   (5) two single-line fans whose midpoint bends sit too close move off
//       their midpoints as little as possible, instead of being dropped;
//       clear ones keep their midpoints.
//
// Run:  node routing-r27-line-gap-test.js [argument-mapper-r27.html]
const fs = require('fs');
const vm = require('vm');
const FILE = process.argv[2] || (__dirname + '/argument-mapper-r27.html');
const html = fs.readFileSync(FILE, 'utf8');

let passed = 0, failed = 0;
function ok(cond, label, detail) {
    if (cond) { passed++; console.log('  ✓ ' + label); }
    else { failed++; console.log('  ✗ FAIL: ' + label + (detail ? ' -- ' + detail : '')); }
}
function extractFunction(source, name) {
    const lines = source.split(/\r?\n/);
    const pattern = new RegExp('^    function ' + name + '\\b');
    const starts = [];
    lines.forEach((line, index) => { if (pattern.test(line)) starts.push(index); });
    if (starts.length !== 1) throw new Error('expected one definition of ' + name + ', found ' + starts.length);
    for (let index = starts[0] + 1; index < lines.length; index++) {
        if (/^    }/.test(lines[index])) return lines.slice(starts[0], index + 1).join('\n');
    }
    throw new Error('unterminated ' + name);
}
function constant(name) {
    const m = html.match(new RegExp('const ' + name + ' = ([\\d.]+)'));
    return m ? Number(m[1]) : NaN;
}

const C = {
    HGAP: constant('HGAP'), CHANNEL_SPACING: constant('CHANNEL_SPACING'), STRAIGHT_THRESH: constant('STRAIGHT_THRESH'),
    ROUTE_MIN_STUB: constant('ROUTE_MIN_STUB'), ROUTE_CORNER_RADIUS: constant('ROUTE_CORNER_RADIUS'),
    ROUTE_STROKE_CLEARANCE: constant('ROUTE_STROKE_CLEARANCE'), ROUTE_LINE_CLEARANCE: constant('ROUTE_LINE_CLEARANCE'),
    ROUTE_RENDER_SLACK: constant('ROUTE_RENDER_SLACK')
};

console.log('=== r27 line spacing between fans, and rendering tolerance ===');

/* ---------------- 1. constants and wiring ---------------- */
console.log('\n-- constants --');
ok(C.ROUTE_LINE_CLEARANCE === 14 && C.ROUTE_LINE_CLEARANCE === C.CHANNEL_SPACING,
    'lines of different fans keep 14px between center-lines, the spacing of one fan\'s own channels', JSON.stringify(C));
ok(C.ROUTE_RENDER_SLACK > 0 && C.ROUTE_RENDER_SLACK <= 0.5, 'rendering forgives only a fraction of a pixel', String(C.ROUTE_RENDER_SLACK));
{
    const draw = extractFunction(html, 'drawLines');
    ok(/allocateStatementFanBands\(plans, undefined, ROUTE_RENDER_SLACK\)/.test(draw) &&
       /allocateStatementFanBands\(plans, 512, ROUTE_RENDER_SLACK\)/.test(draw),
        'drawLines passes that slack to both of its allocation attempts');
    const layout = extractFunction(html, 'computeTreeLayout');
    ok(/allocateStatementFanBands\(plans\);/.test(layout) && !/ROUTE_RENDER_SLACK/.test(layout),
        'layout keeps the strict check, so it reserves full room');
}

/* ---------------- sandbox ---------------- */
const names = ['routeSegmentDistance', 'routeSegmentTouchesRect', 'statementFanRouteSegments', 'statementFanCornerRects',
    'statementFanGeometry', 'routeRectsWithinClearance', 'statementFanGeometriesConflict', 'allocateStatementFanBands',
    'shiftedStatementFanPlans', 'minimumStatementFanChildShift'];
const sandbox = { Math, Object, Array, JSON, Map, Set, Number, isFinite, Infinity };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`
    ${Object.entries(C).map(([k, v]) => `var ${k} = ${v};`).join('\n')}
    var NODE_ROUTE_CLEARANCE = HGAP + ROUTE_STROKE_CLEARANCE / 2;
    ${names.map(name => extractFunction(html, name)).join('\n')}
    globalThis.api = { ${names.join(', ')} };
`, sandbox);
const api = sandbox.api;

// The reported shape, in surface pixels: parent premise a (0..208, 77 tall)
// answers three children; the taller premise b (223..431, 116 tall) answers one
// child placed to their right. T is the top of the children's row.
function plansAt(T) {
    const kids = [
        { fan: 0, boxes: [[-860, -652, 58], [-637, -429, 97]] },
        { fan: 0, boxes: [[-60, 148, 214], [163, 371, 136]] },
        { fan: 0, boxes: [[386, 594, 58]] },
        { fan: 1, boxes: [[646, 854, 136], [869, 1077, 136]] }
    ];
    const parent = [{ x0: 0, x1: 208, y0: 0, y1: 77 }, { x0: 223, x1: 431, y0: 0, y1: 116 }];
    return [0, 1].map(key => {
        const box = parent[key];
        const fan = kids.filter(k => k.fan === key);
        const routes = fan.map((kid, k) => {
            const forked = kid.boxes.length > 1;
            const startX = forked ? (kid.boxes[0][0] + kid.boxes[kid.boxes.length - 1][1]) / 2 : (kid.boxes[0][0] + kid.boxes[0][1]) / 2;
            const targetX = box.x0 + (box.x1 - box.x0) / (fan.length + 1) * (k + 1);
            return { startX, startY: forked ? T - 15 : T, targetX, targetY: box.y1, dx: targetX - startX };
        });
        const left = routes.filter(r => r.dx > C.STRAIGHT_THRESH).sort((a, b) => a.startX - b.startX);
        const right = routes.filter(r => r.dx < -C.STRAIGHT_THRESH).sort((a, b) => b.startX - a.startX);
        const count = Math.max(left.length, right.length);
        const band = Math.max(0, (count - 1) * C.CHANNEL_SPACING);
        [left, right].forEach(group => group.forEach((r, i) => { r.channelOffset = group.length > 1 ? i * band / (group.length - 1) : 0; }));
        const plan = {
            key, routes, staticRects: [], staticSegments: [],
            parentObstacleRects: parent.filter((_, i) => i !== key),
            locked: fan.length === 1, minTop: box.y1, maxTop: box.y1, preferredTop: box.y1
        };
        fan.forEach(kid => {
            kid.boxes.forEach(([x0, x1, h]) => plan.staticRects.push({ x0, x1, y0: T, y1: T + h }));
            if (kid.boxes.length > 1) {
                const centers = kid.boxes.map(([x0, x1]) => (x0 + x1) / 2);
                centers.forEach(x => plan.staticSegments.push({ a: { x, y: T - 15 }, b: { x, y: T } }));
                plan.staticSegments.push({ a: { x: Math.min(...centers), y: T - 15 }, b: { x: Math.max(...centers), y: T - 15 } });
            }
        });
        const minStart = Math.min(...routes.map(r => r.startY));
        if (plan.locked) {
            plan.minTop = plan.maxTop = plan.preferredTop = box.y1 + (routes[0].startY - box.y1) / 2;
        } else {
            plan.minTop = box.y1 + C.ROUTE_MIN_STUB;
            plan.maxTop = Math.max(plan.minTop, minStart - C.ROUTE_MIN_STUB - band);
            plan.preferredTop = Math.max(plan.minTop, Math.min(box.y1 + (minStart - box.y1) / 2 - band / 2, plan.maxTop));
        }
        return plan;
    });
}
// Nearest approach between the two fans' drawn lines, at their allocated bands.
function fanGap(plans) {
    const a = api.statementFanRouteSegments(plans[0], plans[0].topY), b = api.statementFanRouteSegments(plans[1], plans[1].topY);
    let best = Infinity;
    a.forEach(s => b.forEach(t => { best = Math.min(best, api.routeSegmentDistance(s, t)); }));
    return best;
}

/* ---------------- 2. 14px, exactly enforced ---------------- */
console.log('\n-- 14px between fans --');
const T0 = 180;
ok(api.allocateStatementFanBands(plansAt(T0), 512) === false, 'a corridor too short for 14px between the fans cannot be routed');
const shift = api.minimumStatementFanChildShift(plansAt(T0));
const fit = T0 + shift;
{
    const plans = plansAt(fit);
    const routed = api.allocateStatementFanBands(plans);
    const gap = routed ? fanGap(plans) : null;
    ok(isFinite(shift) && shift > 20 && routed && gap >= 14,
        'the least corridor that fits routes both fans at least 14px apart', `shift=${shift && shift.toFixed(3)} gap=${gap && gap.toFixed(3)}`);
}

/* ---------------- 3. browser rounding is forgiven ---------------- */
console.log('\n-- rounding --');
{
    const strict = api.allocateStatementFanBands(plansAt(fit - 0.05), 512);
    const plans = plansAt(fit - 0.05);
    const rendered = api.allocateStatementFanBands(plans, 512, C.ROUTE_RENDER_SLACK);
    const gap = rendered ? fanGap(plans) : null;
    ok(strict === false, '0.05px under the fit, as rounding can leave it, the strict check fails (this used to drop the lines)');
    ok(rendered === true && gap >= 14 - C.ROUTE_RENDER_SLACK,
        'drawLines\' check still routes it, with the lines within the slack of 14px', `gap=${gap && gap.toFixed(3)}`);
}

/* ---------------- 4. a real shortfall is not forgiven ---------------- */
console.log('\n-- real shortfall --');
ok(api.allocateStatementFanBands(plansAt(fit - 1), 512, C.ROUTE_RENDER_SLACK) === false,
    'a whole pixel short, rendering still refuses to draw overlapping lines');

/* ---------------- 5. single lines bend off their midpoints only when they must ---------------- */
console.log('\n-- single-line fans --');
// Two premises side by side, each answered by one child further right. A
// single line bends at the exact midpoint of its corridor, so with premise b
// 20px shorter the two bends sit 10px apart -- and stay 10px apart however
// tall the corridor grows. Such a pair may leave its midpoints, as little as
// possible; a pair already clear of each other keeps them.
function singlesAt(bBottom) {
    const T = 300;
    const parent = [{ x0: 0, x1: 208, y0: 0, y1: 100 }, { x0: 223, x1: 431, y0: 0, y1: bBottom }];
    const kids = [[500, 708], [740, 948]];
    return [0, 1].map(key => {
        const box = parent[key], kid = kids[key];
        const startX = (kid[0] + kid[1]) / 2, targetX = (box.x0 + box.x1) / 2;
        const mid = box.y1 + (T - box.y1) / 2;
        return {
            key, locked: true, minTop: mid, maxTop: mid, preferredTop: mid,
            routes: [{ startX, startY: T, targetX, targetY: box.y1, dx: targetX - startX, channelOffset: 0 }],
            staticRects: [{ x0: kid[0], x1: kid[1], y0: T, y1: T + 60 }], staticSegments: [],
            parentObstacleRects: parent.filter((_, i) => i !== key)
        };
    });
}
{
    const plans = singlesAt(80);
    const lockedClash = api.statementFanGeometriesConflict(api.statementFanGeometry(plans[0], plans[0].preferredTop, false),
        api.statementFanGeometry(plans[1], plans[1].preferredTop, false));
    const routed = api.allocateStatementFanBands(plans);
    const gap = routed ? fanGap(plans) : null;
    const moved = routed ? Math.abs(plans[0].topY - plans[0].preferredTop) + Math.abs(plans[1].topY - plans[1].preferredTop) : null;
    ok(lockedClash && routed && gap >= 14 && moved <= 4.5,
        'bends 10px apart at their midpoints: they move about 4px in all, to route 14px apart instead of being dropped',
        `clash=${lockedClash} gap=${gap && gap.toFixed(2)} moved=${moved && moved.toFixed(2)}`);
    const clear = singlesAt(60);
    ok(api.allocateStatementFanBands(clear) && clear.every(p => p.topY === p.preferredTop),
        'bends already 20px apart stay exactly at their midpoints');
}

console.log(`\n--- routing-r27-line-gap-test: ${passed} passed, ${failed} failed ---`);
process.exit(failed ? 1 : 0);
