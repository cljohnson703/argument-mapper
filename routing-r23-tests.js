'use strict';

// routing-r23-tests.js -- full-app regression gate for r23 SVG routing.
//
// This intentionally boots the shipped HTML and calls its real drawLines().
// jsdom does not perform layout, so each fixture supplies deterministic DOM
// rectangles after render() has built the app's genuine node/group elements.
//
// Usage:
//   node routing-r23-tests.js [path-to-html]
//
// Exit codes:
//   0 = all behavioral assertions passed
//   1 = one or more behavioral assertions failed
//   2 = harness/runtime error (the suite did not vouch for the app)

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, 'argument-mapper-r23.html');

console.log('suite target:', FILE);

let passed = 0;
let failed = 0;
const failures = [];

function ok(value, label, detail) {
    if (value) {
        passed++;
        console.log('  \u2713 ' + label);
    } else {
        failed++;
        const message = label + (detail ? ' -- ' + detail : '');
        failures.push(message);
        console.log('  \u2717 FAIL: ' + message);
    }
}

function near(actual, expected, epsilon, label) {
    ok(Math.abs(actual - expected) <= epsilon, label,
        'got ' + actual + ', expected ' + expected + ' +/- ' + epsilon);
}

function harnessFailure(error) {
    const message = error && error.stack ? error.stack : String(error);
    console.error('\nHARNESS ERROR -- no behavioral result:');
    console.error(message);
    console.error('\n--- routing-r23-tests: harness error ---');
    process.exit(2);
}

function finish() {
    if (failures.length) {
        console.log('\nFailures:');
        failures.forEach(message => console.log('  - ' + message));
    }
    console.log('\n--- routing-r23-tests: ' + passed + ' passed, ' + failed + ' failed ---');
    process.exit(failed ? 1 : 0);
}

function bootApp(htmlPath) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const virtualConsole = new VirtualConsole();
    const jsdomErrors = [];
    virtualConsole.on('jsdomError', error => jsdomErrors.push(error));

    const dom = new JSDOM(html, {
        url: 'http://localhost:8000/' + path.basename(htmlPath),
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        virtualConsole,
        beforeParse(window) {
            if (!window.crypto) window.crypto = {};
            if (!window.crypto.randomUUID) {
                window.crypto.randomUUID = () => nodeCrypto.randomUUID();
            }
            if (!window.ResizeObserver) {
                window.ResizeObserver = class {
                    observe() {}
                    unobserve() {}
                    disconnect() {}
                };
            }
            if (!window.matchMedia) {
                window.matchMedia = () => ({
                    matches: false,
                    media: '',
                    addListener() {},
                    removeListener() {},
                    addEventListener() {},
                    removeEventListener() {},
                    dispatchEvent() { return false; },
                });
            }
            if (!window.Element.prototype.scrollTo) {
                window.Element.prototype.scrollTo = function () {};
            }
            if (!window.HTMLElement.prototype.scrollIntoView) {
                window.HTMLElement.prototype.scrollIntoView = function () {};
            }
        },
    });
    dom.__jsdomErrors = jsdomErrors;
    return dom;
}

function waitFor(fn, timeoutMs, label) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
        (function poll() {
            let value;
            try { value = fn(); } catch (_) {}
            if (value) return resolve(value);
            if (Date.now() - started > timeoutMs) {
                return reject(new Error('timeout waiting for ' + label));
            }
            setTimeout(poll, 10);
        })();
    });
}

function box(left, top, width, height) {
    return {
        left,
        top,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        width,
        height,
        toJSON() { return this; },
    };
}

function union(rects) {
    const left = Math.min(...rects.map(rect => rect.left));
    const top = Math.min(...rects.map(rect => rect.top));
    const right = Math.max(...rects.map(rect => rect.right));
    const bottom = Math.max(...rects.map(rect => rect.bottom));
    return box(left, top, right - left, bottom - top);
}

function stubRect(element, rect) {
    if (!element) throw new Error('cannot assign geometry to a missing DOM element');
    Object.defineProperty(element, 'getBoundingClientRect', {
        value: () => rect,
        configurable: true,
    });
}

function leaf(id, targetIndex) {
    const result = {
        id,
        type: 'support',
        texts: [id],
        collapsed: [],
        children: [],
    };
    if (targetIndex !== undefined) result.targetIndex = targetIndex;
    return result;
}

function parent(id, textCount, children) {
    return {
        id,
        type: 'contention',
        texts: Array.from({ length: textCount }, (_, index) => id + '-' + index),
        collapsed: [],
        children: children.slice(),
    };
}

// Parse the explicit straight portions of the app's M/L/Q paths, including
// co-premise fork paths. Curved corner arcs are deliberately not flattened:
// the forbidden failures under test occur on the orthogonal straight runs.
function parsePath(pathElement) {
    const d = pathElement.getAttribute('d') || '';
    const tokens = d.match(/[MLQ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
    let index = 0;
    let cursor = null;
    let start = null;
    const segments = [];

    function number() {
        if (index >= tokens.length || /^[MLQ]$/i.test(tokens[index])) {
            throw new Error('invalid path data near token ' + index + ': ' + d);
        }
        return Number(tokens[index++]);
    }

    while (index < tokens.length) {
        const command = tokens[index++].toUpperCase();
        if (command === 'M') {
            cursor = { x: number(), y: number() };
            if (!start) start = { ...cursor };
        } else if (command === 'L') {
            if (!cursor) throw new Error('L before M: ' + d);
            const next = { x: number(), y: number() };
            segments.push({ a: { ...cursor }, b: { ...next } });
            cursor = next;
        } else if (command === 'Q') {
            if (!cursor) throw new Error('Q before M: ' + d);
            number();
            number();
            cursor = { x: number(), y: number() };
        } else {
            throw new Error('unsupported path command ' + command + ': ' + d);
        }
    }

    return {
        child: pathElement.getAttribute('data-child'),
        parent: pathElement.getAttribute('data-parent'),
        parentBox: pathElement.getAttribute('data-parent-box'),
        fork: pathElement.getAttribute('data-fork'),
        d,
        start,
        end: cursor,
        segments,
    };
}

const EPS = 1e-6;

function orientation(segment) {
    if (Math.abs(segment.a.y - segment.b.y) <= EPS) return 'h';
    if (Math.abs(segment.a.x - segment.b.x) <= EPS) return 'v';
    return 'd';
}

function interval(segment, axis) {
    const a = segment.a[axis];
    const b = segment.b[axis];
    return [Math.min(a, b), Math.max(a, b)];
}

function overlapLength(a, b, axis) {
    const ia = interval(a, axis);
    const ib = interval(b, axis);
    return Math.min(ia[1], ib[1]) - Math.max(ia[0], ib[0]);
}

function pathLabel(path) {
    return path.fork ? 'fork:' + path.fork : (path.child || 'unnamed-route');
}

function samePoint(a, b) {
    return !!a && !!b && Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS;
}

function allowedPointJunction(a, b, point) {
    // A co-premise fork is drawn as separate tick/bar SVG paths. Their
    // point junctions are structural, but sharing any positive line length
    // is still forbidden and is handled before this exemption.
    if (a.fork && b.fork && a.fork === b.fork) return 'same-fork junction';

    // The incoming child-to-parent route starts at the midpoint of a
    // co-premise child's fork bar. That route endpoint may lie in the bar's
    // interior (or on a centre tick for an odd box count).
    const route = a.fork ? b : a;
    const fork = a.fork ? a : b;
    if (fork.fork && route.child === fork.fork && samePoint(point, route.start)) {
        return 'route/fork shared endpoint';
    }
    return null;
}

// Audits route and fork paths together. Point contacts are violations too,
// except for the two explicit structural junctions above. This is stronger
// than checking only proper-interior crossings and prevents a foreign line
// from terminating on the middle of another line.
function auditRoutes(routes) {
    const overlaps = [];
    const crossings = [];
    const exemptions = [];

    for (let i = 0; i < routes.length; i++) {
        for (let j = i + 1; j < routes.length; j++) {
            for (const a of routes[i].segments) {
                for (const b of routes[j].segments) {
                    const oa = orientation(a);
                    const ob = orientation(b);

                    if (oa === 'h' && ob === 'h' &&
                        Math.abs(a.a.y - b.a.y) <= EPS && overlapLength(a, b, 'x') > EPS) {
                        overlaps.push(pathLabel(routes[i]) + '/' + pathLabel(routes[j]) +
                            ' horizontal at y=' + a.a.y);
                    } else if (oa === 'v' && ob === 'v' &&
                        Math.abs(a.a.x - b.a.x) <= EPS && overlapLength(a, b, 'y') > EPS) {
                        overlaps.push(pathLabel(routes[i]) + '/' + pathLabel(routes[j]) +
                            ' vertical at x=' + a.a.x);
                    }

                    let h = null;
                    let v = null;
                    if (oa === 'h' && ob === 'v') { h = a; v = b; }
                    if (oa === 'v' && ob === 'h') { h = b; v = a; }
                    if (h && v) {
                        const hx = interval(h, 'x');
                        const vy = interval(v, 'y');
                        const x = v.a.x;
                        const y = h.a.y;
                        if (x >= hx[0] - EPS && x <= hx[1] + EPS &&
                            y >= vy[0] - EPS && y <= vy[1] + EPS) {
                            const point = { x, y };
                            const exemption = allowedPointJunction(routes[i], routes[j], point);
                            if (exemption) {
                                exemptions.push(exemption + ': ' + pathLabel(routes[i]) + '/' +
                                    pathLabel(routes[j]) + ' at (' + x + ', ' + y + ')');
                            } else {
                                const proper = x > hx[0] + EPS && x < hx[1] - EPS &&
                                    y > vy[0] + EPS && y < vy[1] - EPS;
                                crossings.push(pathLabel(routes[i]) + '/' + pathLabel(routes[j]) +
                                    (proper ? ' proper intersection at (' : ' point intersection at (') +
                                    x + ', ' + y + ')');
                            }
                        }
                    }
                }
            }
        }
    }
    return { overlaps, crossings, exemptions };
}

// Liang-Barsky-style clipping against the OPEN interior of a node box.
// Merely touching a border is allowed; occupying any positive parameter
// interval inside a nonincident box is not.
function segmentEntersOpenRect(segment, rect) {
    let low = 0;
    let high = 1;
    const axes = [
        { p: segment.a.x, d: segment.b.x - segment.a.x, min: rect.left, max: rect.right },
        { p: segment.a.y, d: segment.b.y - segment.a.y, min: rect.top, max: rect.bottom },
    ];

    for (const axis of axes) {
        const min = axis.min + EPS;
        const max = axis.max - EPS;
        if (max <= min) return false;
        if (Math.abs(axis.d) <= EPS) {
            if (axis.p <= min || axis.p >= max) return false;
            continue;
        }
        const t0 = (min - axis.p) / axis.d;
        const t1 = (max - axis.p) / axis.d;
        low = Math.max(low, Math.min(t0, t1));
        high = Math.min(high, Math.max(t0, t1));
        if (high - low <= EPS) return false;
    }
    return high - low > EPS && high > EPS && low < 1 - EPS;
}

function pathIsIncidentToNode(path, nodeId, boxIndex) {
    // Connection paths may enter only the exact parent statement at which
    // they terminate.  Their child endpoint is on the box border or on the
    // fork above it, so a blanket child-group exemption would hide a route
    // entering a sibling co-premise. Fork ticks likewise touch only borders.
    if (path.fork) return false;
    return path.parent === nodeId && String(path.parentBox) === String(boxIndex);
}

function captureDrawing(window) {
    const document = window.document;
    const paths = Array.from(document.querySelectorAll(
        '#lines-svg path[data-parent][data-child], #lines-svg path[data-fork]')).map(parsePath);
    const nodeBoxes = Array.from(document.querySelectorAll('.node[data-node-id]')).map(element => ({
        nodeId: element.getAttribute('data-node-id'),
        boxIndex: element.getAttribute('data-node-idx'),
        rect: element.getBoundingClientRect(),
    }));
    return { paths, nodeBoxes };
}

function auditRenderedDrawing(window) {
    const drawing = captureDrawing(window);
    const lineAudit = auditRoutes(drawing.paths);
    const nodeHits = [];
    const seen = new Set();

    drawing.paths.forEach(path => {
        drawing.nodeBoxes.forEach(nodeBox => {
            if (pathIsIncidentToNode(path, nodeBox.nodeId, nodeBox.boxIndex)) return;
            if (!path.segments.some(segment => segmentEntersOpenRect(segment, nodeBox.rect))) return;
            const key = pathLabel(path) + ' through ' + nodeBox.nodeId + '-' + nodeBox.boxIndex;
            if (!seen.has(key)) {
                seen.add(key);
                nodeHits.push(key);
            }
        });
    });

    return { ...lineAudit, nodeHits, paths: drawing.paths };
}

function channelY(route) {
    if (!route || !Array.isArray(route.segments)) return NaN;
    const horizontals = route.segments.filter(segment => orientation(segment) === 'h' &&
        Math.abs(segment.a.x - segment.b.x) > EPS);
    if (!horizontals.length) return NaN;
    return horizontals.reduce((best, segment) =>
        Math.abs(segment.a.x - segment.b.x) > Math.abs(best.a.x - best.b.x) ? segment : best
    ).a.y;
}

function setFixtureGeometry(window, geometry) {
    const document = window.document;
    stubRect(document.getElementById('surface'), box(0, 0, 2000, 1200));

    Object.entries(geometry).forEach(([nodeId, rects]) => {
        const group = document.getElementById('group-' + nodeId);
        if (!group) throw new Error('fixture node did not render: ' + nodeId);
        const nodes = Array.from(group.querySelectorAll(':scope > .node'));
        if (nodes.length !== rects.length) {
            throw new Error(nodeId + ': rendered ' + nodes.length + ' boxes, fixture supplied ' + rects.length);
        }
        nodes.forEach((node, index) => stubRect(node, rects[index]));
        stubRect(group, union(rects));
    });
}

// Unlike setFixtureGeometry(), this version lets layoutAll() choose every
// position. Rectangles follow each group's current style.left/style.top while
// retaining the fuzz case's specified measured width and height.
function setDynamicLayoutGeometry(window, dimensions) {
    const document = window.document;
    stubRect(document.getElementById('surface'), box(0, 0, 100000, 100000));

    Object.entries(dimensions).forEach(([nodeId, size]) => {
        const group = document.getElementById('group-' + nodeId);
        if (!group) throw new Error('dynamic fixture node did not render: ' + nodeId);
        const nodes = Array.from(group.querySelectorAll(':scope > .node'));
        const boxSizes = Array.isArray(size.boxes) ? size.boxes : [size];
        if (nodes.length !== boxSizes.length) {
            throw new Error(nodeId + ': dynamic fixture supplied ' + boxSizes.length +
                ' boxes, rendered ' + nodes.length);
        }
        const gap = size.gap === undefined ? 8 : size.gap;
        const offsets = [];
        let groupWidth = 0;
        boxSizes.forEach((boxSize, index) => {
            offsets.push(groupWidth);
            groupWidth += boxSize.w + (index + 1 < boxSizes.length ? gap : 0);
        });
        const groupHeight = Math.max(...boxSizes.map(boxSize => boxSize.h));
        const currentRect = () => box(
            parseFloat(group.style.left) || 0,
            parseFloat(group.style.top) || 0,
            groupWidth,
            groupHeight
        );
        Object.defineProperty(group, 'getBoundingClientRect', {
            value: currentRect,
            configurable: true,
        });
        nodes.forEach((node, index) => {
            Object.defineProperty(node, 'getBoundingClientRect', {
                value: () => box(
                    (parseFloat(group.style.left) || 0) + offsets[index],
                    parseFloat(group.style.top) || 0,
                    boxSizes[index].w,
                    boxSizes[index].h
                ),
                configurable: true,
            });
        });
    });
}

function renderFixture(window, root, geometry) {
    const state = window.__argmap.state;
    state.trees.splice(0, state.trees.length, root);
    window.eval('selectedIds = []; zoomLevel = 1; render();');
    setFixtureGeometry(window, geometry);
    window.eval('drawLines();');

    return Array.from(window.document.querySelectorAll(
        '#lines-svg path[data-parent][data-child]')).map(parsePath);
}

function renderDynamicLayoutFixture(window, root, dimensions, mode) {
    const state = window.__argmap.state;
    state.trees.splice(0, state.trees.length, root);
    window.eval('selectedIds = []; zoomLevel = 1; layoutMode = ' +
        JSON.stringify(mode || 'compact') + '; showDepthLabels = false; render();');
    setDynamicLayoutGeometry(window, dimensions);
    window.eval('layoutAll(); drawLines();');

    return Array.from(window.document.querySelectorAll(
        '#lines-svg path[data-parent][data-child]')).map(parsePath);
}

function byChild(routes) {
    return Object.fromEntries(routes.map(route => [route.child, route]));
}

(async () => {
    let dom;
    try {
        if (!fs.existsSync(FILE)) throw new Error('target HTML does not exist: ' + FILE);
        dom = bootApp(FILE);
        const window = dom.window;
        await waitFor(() => window.__argmap && window.__argmap.state, 5000, '__argmap.state');

        // Prove the geometric auditor itself discriminates both forbidden
        // cases before trusting it to judge application output.
        const overlapProbe = auditRoutes([
            { child: 'a', segments: [{ a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }] },
            { child: 'b', segments: [{ a: { x: 5, y: 0 }, b: { x: 15, y: 0 } }] },
        ]);
        const crossingProbe = auditRoutes([
            { child: 'a', segments: [{ a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }] },
            { child: 'b', segments: [{ a: { x: 5, y: -5 }, b: { x: 5, y: 5 } }] },
        ]);
        const interiorProbe = segmentEntersOpenRect(
            { a: { x: 0, y: 5 }, b: { x: 20, y: 5 } },
            { left: 5, top: 0, right: 15, bottom: 10 }
        );
        const borderProbe = segmentEntersOpenRect(
            { a: { x: 0, y: 0 }, b: { x: 20, y: 0 } },
            { left: 5, top: 0, right: 15, bottom: 10 }
        );
        if (overlapProbe.overlaps.length !== 1 || crossingProbe.crossings.length !== 1 ||
            !interiorProbe || borderProbe) {
            throw new Error('route geometry auditor failed its self-check');
        }

        // R1. Co-premise statement boxes are DISTINCT routing parents. Each
        // has one child, so each connection must bend at its own exact
        // endpoint midpoint. Collision avoidance belongs to layout: it must
        // separate the statement-owned routes without pooling their channels.
        {
            const fanChildren = Array.from({ length: 4 }, (_, index) => leaf('xf-' + index, index));
            const root = parent('xf-root', 4, fanChildren);
            root.x = 1000;
            root.y = 100;
            const routes = renderDynamicLayoutFixture(window, root, {
                'xf-root': {
                    boxes: Array.from({ length: 4 }, () => ({ w: 120, h: 60 })),
                    gap: 8,
                },
                // Four legal 180px children cannot all stay directly under
                // 120px statements at the compact gap. Layout spreads their
                // one-child fans symmetrically: two bend right and two bend
                // left, exposing any erroneous cross-statement channel pool.
                'xf-0': { w: 180, h: 60 },
                'xf-1': { w: 180, h: 60 },
                'xf-2': { w: 180, h: 60 },
                'xf-3': { w: 180, h: 60 },
            });
            const audit = auditRenderedDrawing(window);
            const channels = routes.map(channelY);
            const midpointErrors = routes.map((route, index) => ({
                child: route.child,
                channel: channels[index],
                midpoint: (route.start.y + route.end.y) / 2,
            }));
            ok(routes.length === 4, 'R1a: actual layout/drawLines emitted all four statement-owned connections');
            ok(midpointErrors.length === 4 && midpointErrors.every(item =>
                Number.isFinite(item.channel) && Math.abs(item.channel - item.midpoint) <= EPS),
                'R1b: each one-child statement fan bends at its own exact midpoint',
                JSON.stringify(midpointErrors));
            ok(audit.overlaps.length === 0,
                'R1c: layout separates statement-owned routes with no collinear overlap',
                audit.overlaps.join('; '));
            ok(audit.crossings.length === 0,
                'R1d: route/fork drawing has no forbidden point or interior intersection',
                audit.crossings.join('; '));
            ok(audit.nodeHits.length === 0,
                'R1e: route/fork drawing does not enter a nonincident node interior',
                audit.nodeHits.join('; '));
        }

        // R2. A 3-vs-1 fan. The three-child side establishes the full band;
        // outermost and innermost occupy its extremes, and the lone opposite
        // child takes the maximum (topmost) bend height.
        {
            const l0 = leaf('asym-l0', 0);
            const l1 = leaf('asym-l1', 0);
            const l2 = leaf('asym-l2', 0);
            const r0 = leaf('asym-r0', 0);
            const root = parent('asym-root', 1, [l0, l1, l2, r0]);
            const routes = renderFixture(window, root, {
                'asym-root': [box(400, 100, 300, 60)],
                'asym-l0': [box(40, 360, 120, 60)],
                'asym-l1': [box(140, 360, 120, 60)],
                'asym-l2': [box(240, 360, 120, 60)],
                'asym-r0': [box(840, 360, 120, 60)],
            });
            const routesByChild = byChild(routes);
            const leftYs = ['asym-l0', 'asym-l1', 'asym-l2'].map(id => channelY(routesByChild[id]));
            const rightY = channelY(routesByChild['asym-r0']);
            const audit = auditRenderedDrawing(window);

            ok(routes.length === 4 && leftYs.every(Number.isFinite) && Number.isFinite(rightY),
                'R2a: actual drawLines emitted four bent 3-vs-1 routes');
            ok(leftYs[0] < leftYs[1] && leftYs[1] < leftYs[2],
                'R2b: outer-to-inner children span maximum-to-minimum bend heights',
                'left channels=' + JSON.stringify(leftYs));
            near(leftYs[1] - leftYs[0], leftYs[2] - leftYs[1], EPS,
                'R2c: majority-side bend heights are evenly distributed');
            near(rightY, leftYs[0], EPS,
                'R2d: lone opposite-side child takes the maximum bend height');
            ok(audit.overlaps.length === 0 && audit.crossings.length === 0 && audit.nodeHits.length === 0,
                'R2e: asymmetric fan has no shared segments, crossings, or nonincident node hits',
                audit.overlaps.concat(audit.crossings, audit.nodeHits).join('; '));
        }

        // R3. A single off-axis connection bends exactly at its endpoint
        // midpoint; it must not inherit a multi-line channel offset.
        {
            const child = leaf('single-child', 0);
            const root = parent('single-root', 1, [child]);
            const routes = renderFixture(window, root, {
                'single-root': [box(440, 100, 120, 60)],
                'single-child': [box(190, 340, 120, 60)],
            });
            const route = routes[0];
            ok(routes.length === 1 && route && /\bQ\b/.test(route.d),
                'R3a: one off-axis child uses the real bent SVG route');
            const expectedMidpoint = route ? (route.start.y + route.end.y) / 2 : NaN;
            near(channelY(route), expectedMidpoint, EPS,
                'R3b: a lone line bends at the exact endpoint midpoint');
        }

        // R4. Even a shallow off-axis connection must bend. The obsolete
        // router silently switched gaps under four pixels to a direct diagonal.
        {
            const child = leaf('shallow-child', 0);
            const root = parent('shallow-root', 1, [child]);
            const routes = renderFixture(window, root, {
                'shallow-root': [box(440, 100, 120, 60)],
                'shallow-child': [box(190, 163, 120, 60)],
            });
            const route = routes[0];
            ok(routes.length === 1 && route && /\bQ\b/.test(route.d),
                'R4a: shallow off-axis connection is bent, not a forced diagonal',
                route ? route.d : 'no route');
            const expectedMidpoint = route ? (route.start.y + route.end.y) / 2 : NaN;
            near(channelY(route), expectedMidpoint, EPS,
                'R4b: shallow lone bend still uses the exact midpoint');
        }

        // R5. Concrete compact cross-parent counterexample retained from the
        // routing fuzz audit. R has a tall, wide-fan P branch beside a short Q
        // branch; Q descends through tall B to another wide fan. Per-parent
        // routing that is locally valid can still cross a cousin parent's
        // route in the shared tree corridor.
        {
            const pChildren = Array.from({ length: 9 }, (_, index) => leaf('cross-p' + index, 0));
            const bChildren = Array.from({ length: 3 }, (_, index) => leaf('cross-b' + index, 0));
            const p = leaf('cross-P', 0);
            p.children = pChildren;
            const b = leaf('cross-B', 0);
            b.children = bChildren;
            const q = leaf('cross-Q', 0);
            q.children = [b];
            const root = parent('cross-R', 1, [p, q]);
            root.x = 1000;
            root.y = 100;

            const dimensions = {
                'cross-R': { w: 180, h: 58 },
                'cross-P': { w: 180, h: 300 },
                'cross-Q': { w: 180, h: 50 },
                'cross-B': { w: 180, h: 180 },
            };
            pChildren.forEach(child => { dimensions[child.id] = { w: 120, h: 58 }; });
            bChildren.forEach(child => { dimensions[child.id] = { w: 200, h: 58 }; });

            const routes = renderDynamicLayoutFixture(window, root, dimensions);
            const audit = auditRenderedDrawing(window);
            ok(routes.length === 15,
                'R5a: compact cross-parent fixture emitted all 15 tree connections',
                'routes=' + routes.length);
            ok(audit.overlaps.length === 0,
                'R5b: compact cross-parent fixture has no positive-length collinear overlap',
                audit.overlaps.join('; '));
            ok(audit.crossings.length === 0,
                'R5c: compact cross-parent fixture has no proper interior intersection',
                audit.crossings.join('; '));
            ok(audit.nodeHits.length === 0,
                'R5d: compact cross-parent routes do not enter nonincident node interiors',
                audit.nodeHits.join('; '));
        }

        // R6. An incoming route to a co-premise group starts on that group's
        // fork bar. The audit must inspect the fork yet exempt this shared
        // endpoint and the fork's own tick/bar junctions -- without broadly
        // exempting overlapping fork geometry or unrelated contacts.
        {
            const g0 = leaf('fork-g0', 0);
            const g1 = leaf('fork-g1', 1);
            const co = parent('fork-co', 2, [g0, g1]);
            co.targetIndex = 0;
            const root = parent('fork-root', 1, [co]);
            const routes = renderFixture(window, root, {
                'fork-root': [box(440, 100, 120, 60)],
                'fork-co': [box(350, 300, 120, 60), box(500, 300, 120, 60)],
                'fork-g0': [box(290, 500, 120, 60)],
                'fork-g1': [box(560, 500, 120, 60)],
            });
            const audit = auditRenderedDrawing(window);
            ok(routes.length === 3 && audit.paths.filter(path => path.fork === 'fork-co').length === 3,
                'R6a: actual drawing includes three routes and all three co-premise fork segments');
            ok(audit.exemptions.some(item => item.startsWith('same-fork junction')),
                'R6b: intentional same-fork tick/bar junctions are recognized');
            ok(audit.exemptions.some(item => item.startsWith('route/fork shared endpoint')),
                'R6c: incoming route/fork shared endpoint is recognized');
            ok(audit.overlaps.length === 0 && audit.crossings.length === 0 && audit.nodeHits.length === 0,
                'R6d: fork-aware audit reports no forbidden geometry in the valid fixture',
                audit.overlaps.concat(audit.crossings, audit.nodeHits).join('; '));
        }

        // R7. Re-run the exact dense normalized co-premise tree that exposed
        // the compact solver's former runaway, this time through the shipped
        // renderer.  Passing the layout-only check is insufficient if the
        // actual SVG paths later cross, overlap, or enter a cousin box.
        {
            const fixturePath = path.resolve(__dirname, 'layout-r23-seed-990699.fixture.json');
            const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
            const dimensions = {};
            let edgeCount = 0;
            function fromDense(spec) {
                const children = (spec.children || []).map(fromDense);
                edgeCount += children.length;
                const result = {
                    id: spec.id,
                    type: 'support',
                    texts: spec.widths.map((_, index) => spec.id + '-' + index),
                    collapsed: [],
                    children,
                };
                if (spec.targetIndex !== undefined) result.targetIndex = spec.targetIndex;
                dimensions[spec.id] = {
                    boxes: spec.widths.map((width, index) => ({
                        w: width,
                        h: spec.heights[index],
                    })),
                    gap: 15,
                };
                return result;
            }
            const root = fromDense(fixture.tree);
            root.x = 1000;
            root.y = 100;
            const routes = renderDynamicLayoutFixture(window, root, dimensions);
            const audit = auditRenderedDrawing(window);
            ok(routes.length === edgeCount,
                'R7a: dense compact fixture renders every connection',
                'routes=' + routes.length + ', expected=' + edgeCount);
            ok(audit.overlaps.length === 0 && audit.crossings.length === 0 && audit.nodeHits.length === 0,
                'R7b: dense compact SVG has no forbidden line/fork/node contact',
                audit.overlaps.concat(audit.crossings, audit.nodeHits).slice(0, 12).join('; '));
        }

        // R8. A short target statement beside a tall co-premise is not a
        // license for that target's route to enter the tall statement.  The
        // targetIndex-aware audit intentionally treats only data-parent-box
        // as incident; the other boxes in the parent group remain obstacles.
        for (const mode of ['compact', 'spread']) {
            const left = leaf('tall-' + mode + '-left', 0);
            const right = leaf('tall-' + mode + '-right', 0);
            const root = parent('tall-' + mode + '-root', 2, [left, right]);
            root.x = 1000; root.y = 100;
            const dimensions = {
                [root.id]: { boxes: [{ w: 120, h: 60 }, { w: 120, h: 300 }], gap: 15 },
                [left.id]: { w: 180, h: 60 },
                [right.id]: { w: 180, h: 60 },
            };
            const routes = renderDynamicLayoutFixture(window, root, dimensions, mode);
            const audit = auditRenderedDrawing(window);
            const bends = routes.map(channelY).filter(Number.isFinite);
            ok(audit.nodeHits.length === 0,
                'R8' + (mode === 'compact' ? 'a' : 'b') + ': ' + mode +
                    ' multi-line fan clears non-target tall parent statement',
                audit.nodeHits.join('; '));
            ok(routes.every(route => route.parentBox === '0') &&
                bends.some(y => y > 400),
                'R8' + (mode === 'compact' ? 'c' : 'd') + ': ' + mode +
                    ' records target box and moves nearest legal bend below tall statement',
                routes.map(route => route.d).join('; '));
        }

        // A locked singleton fan must retain the exact endpoint midpoint.
        // Here compact packing moves it beneath the foreign tall right box;
        // layout therefore enlarges only this parent's corridor.  The source
        // is a co-premise fork, exercising its additional 15px lift.
        {
            const left = leaf('locked-left', 0);
            const forkChild = parent('locked-fork-child', 2, []);
            forkChild.targetIndex = 1;
            const root = parent('locked-root', 3, [left, forkChild]);
            root.x = 1000; root.y = 100;
            const dimensions = {
                'locked-root': { boxes: [
                    { w: 120, h: 300 }, { w: 120, h: 60 }, { w: 120, h: 300 }
                ], gap: 15 },
                // The 500px left sibling forces the fork source beneath the
                // tall right statement; 300px never reached that obstacle and
                // was a false-positive regression fixture.
                'locked-left': { w: 500, h: 60 },
                'locked-fork-child': { boxes: [{ w: 140, h: 60 }, { w: 145, h: 60 }], gap: 15 },
            };
            const routes = renderDynamicLayoutFixture(window, root, dimensions, 'compact');
            const audit = auditRenderedDrawing(window);
            const route = routes.find(item => item.child === 'locked-fork-child');
            ok(route && route.parentBox === '1' && audit.nodeHits.length === 0,
                'R8e: targetIndex-aware locked route clears both foreign tall statements',
                audit.nodeHits.join('; '));
            near(channelY(route), route.end.y + (route.start.y - route.end.y) / 2, 0.01,
                'R8f: locked co-premise-child route remains at its exact endpoint midpoint');
        }

        {
            const left = leaf('locked-leaf-left', 0);
            const middle = leaf('locked-leaf-middle', 1);
            const root = parent('locked-leaf-root', 3, [left, middle]);
            root.x = 1000; root.y = 100;
            const routes = renderDynamicLayoutFixture(window, root, {
                'locked-leaf-root': { boxes: [
                    { w: 120, h: 300 }, { w: 120, h: 60 }, { w: 120, h: 300 }
                ], gap: 15 },
                'locked-leaf-left': { w: 300, h: 60 },
                'locked-leaf-middle': { w: 300, h: 60 },
            }, 'compact');
            const audit = auditRenderedDrawing(window);
            const route = routes.find(item => item.child === 'locked-leaf-middle');
            ok(route && route.parentBox === '1' && audit.nodeHits.length === 0,
                'R8g: targetIndex-aware locked leaf route clears foreign tall statement',
                audit.nodeHits.join('; '));
            near(channelY(route), route.end.y + (route.start.y - route.end.y) / 2, 0.01,
                'R8h: locked leaf route remains at its exact endpoint midpoint');
        }

        // A centre-line can be mathematically outside a statement while its
        // visible 2px stroke still enters it.  This fixture leaves the source
        // only 0.5px left of the foreign tall box, so the exact minimum row
        // must leave HGAP beyond the visible stroke's guarded half-width.
        {
            const left = leaf('stroke-left', 0);
            const middle = leaf('stroke-middle', 1);
            const root = parent('stroke-root', 3, [left, middle]);
            root.x = 1000; root.y = 100;
            const routes = renderDynamicLayoutFixture(window, root, {
                'stroke-root': { boxes: [
                    { w: 120, h: 300 }, { w: 120, h: 60 }, { w: 120, h: 300 }
                ], gap: 15 },
                'stroke-left': { w: 269, h: 60 },
                'stroke-middle': { w: 269, h: 60 },
            }, 'compact');
            const route = routes.find(item => item.child === 'stroke-middle');
            const foreign = window.document.querySelectorAll('#group-stroke-root > .node')[2]
                .getBoundingClientRect();
            const halfStrokeGuard = 1.025;
            const nodeRouteGuard = 15 + halfStrokeGuard;
            const expanded = {
                left: foreign.left - halfStrokeGuard,
                right: foreign.right + halfStrokeGuard,
                top: foreign.top - halfStrokeGuard,
                bottom: foreign.bottom + halfStrokeGuard,
            };
            const visibleStrokeHit = route && route.segments.some(segment =>
                segmentEntersOpenRect(segment, expanded));
            ok(route && foreign.left - route.start.x > 0 && foreign.left - route.start.x < 1 &&
                !visibleStrokeHit,
                'R8i: visible route stroke clears a foreign statement at a subpixel near-graze',
                route ? route.d : 'missing route');
            near(channelY(route), foreign.bottom + nodeRouteGuard, 0.02,
                'R8j: near-graze corridor uses the exact pixel minimum');
        }

        dom.window.close();
        finish();
    } catch (error) {
        if (dom && dom.window) dom.window.close();
        harnessFailure(error);
    }
})();
