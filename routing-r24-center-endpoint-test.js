'use strict';

// Focused r24 regression: a singleton child targeting one statement of a
// co-premise group must terminate at that statement's horizontal centre.
// This boots the shipped app and invokes its real render() and drawLines().
//
// Usage: node routing-r24-center-endpoint-test.js [path-to-html]

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, 'argument-mapper-r24.html');

function rect(left, top, width, height) {
    return {
        left, top, width, height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON() { return this; },
    };
}

function union(rects) {
    const left = Math.min(...rects.map(item => item.left));
    const top = Math.min(...rects.map(item => item.top));
    const right = Math.max(...rects.map(item => item.right));
    const bottom = Math.max(...rects.map(item => item.bottom));
    return rect(left, top, right - left, bottom - top);
}

function stubRect(element, value) {
    if (!element) throw new Error('cannot assign geometry to a missing element');
    Object.defineProperty(element, 'getBoundingClientRect', {
        configurable: true,
        value: () => value,
    });
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

function bootApp(htmlPath) {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', () => {});
    return new JSDOM(fs.readFileSync(htmlPath, 'utf8'), {
        url: 'http://localhost:8000/' + path.basename(htmlPath),
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        virtualConsole,
        beforeParse(window) {
            if (!window.crypto) window.crypto = {};
            if (!window.crypto.randomUUID) window.crypto.randomUUID = () => nodeCrypto.randomUUID();
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
            if (!window.Element.prototype.scrollTo) window.Element.prototype.scrollTo = function () {};
            if (!window.HTMLElement.prototype.scrollIntoView) {
                window.HTMLElement.prototype.scrollIntoView = function () {};
            }
        },
    });
}

function setNodeGeometry(document, nodeId, boxes) {
    const group = document.getElementById('group-' + nodeId);
    if (!group) throw new Error('fixture node did not render: ' + nodeId);
    const nodes = Array.from(group.querySelectorAll(':scope > .node'));
    if (nodes.length !== boxes.length) {
        throw new Error(nodeId + ': rendered ' + nodes.length + ' boxes, expected ' + boxes.length);
    }
    nodes.forEach((node, index) => stubRect(node, boxes[index]));
    stubRect(group, union(boxes));
}

function pathEndpoint(pathElement) {
    const values = (pathElement.getAttribute('d') || '')
        .match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi);
    if (!values || values.length < 2) throw new Error('could not parse route path');
    return {
        x: Number(values[values.length - 2]),
        y: Number(values[values.length - 1]),
    };
}

// Let the real layout pass choose group positions while jsdom supplies the
// measured box sizes. Spread may enlarge a co-premise group's inline gap, so
// each rectangle getter reads the current style.gap rather than freezing it.
function setDynamicLayoutGeometry(window, dimensions) {
    const document = window.document;
    stubRect(document.getElementById('surface'), rect(0, 0, 100000, 100000));

    Object.entries(dimensions).forEach(([nodeId, size]) => {
        const group = document.getElementById('group-' + nodeId);
        if (!group) throw new Error('dynamic fixture node did not render: ' + nodeId);
        const nodes = Array.from(group.querySelectorAll(':scope > .node'));
        const boxSizes = Array.isArray(size.boxes) ? size.boxes : [size];
        if (nodes.length !== boxSizes.length) {
            throw new Error(nodeId + ': supplied ' + boxSizes.length +
                ' boxes, rendered ' + nodes.length);
        }
        const baseGap = size.gap === undefined ? 15 : size.gap;
        const currentGap = () => {
            const value = parseFloat(group.style.gap);
            return Number.isFinite(value) ? value : baseGap;
        };
        const boxOffset = index => boxSizes.slice(0, index)
            .reduce((sum, item) => sum + item.w, 0) + currentGap() * index;
        const groupWidth = () => boxSizes.reduce((sum, item) => sum + item.w, 0) +
            currentGap() * Math.max(0, boxSizes.length - 1);
        const groupHeight = Math.max(...boxSizes.map(item => item.h));

        Object.defineProperty(group, 'getBoundingClientRect', {
            configurable: true,
            value: () => rect(
                parseFloat(group.style.left) || 0,
                parseFloat(group.style.top) || 0,
                groupWidth(),
                groupHeight
            ),
        });
        nodes.forEach((node, index) => {
            Object.defineProperty(node, 'getBoundingClientRect', {
                configurable: true,
                value: () => rect(
                    (parseFloat(group.style.left) || 0) + boxOffset(index),
                    parseFloat(group.style.top) || 0,
                    boxSizes[index].w,
                    boxSizes[index].h
                ),
            });
        });
    });
}

const EPS = 1e-6;

// Parse the actual visible path. Rounded Q corners are flattened into short
// chords so the audit also sees their interiors rather than checking only
// the orthogonal skeleton.
function parseRoutePath(pathElement) {
    const d = pathElement.getAttribute('d') || '';
    const tokens = d.match(/[MLQ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
    let index = 0;
    let cursor = null;
    let start = null;
    const segments = [];
    const number = () => Number(tokens[index++]);
    while (index < tokens.length) {
        const command = tokens[index++].toUpperCase();
        if (command === 'M') {
            cursor = { x: number(), y: number() };
            if (!start) start = { ...cursor };
        } else if (command === 'L') {
            const next = { x: number(), y: number() };
            segments.push({ a: { ...cursor }, b: { ...next } });
            cursor = next;
        } else if (command === 'Q') {
            const control = { x: number(), y: number() };
            const end = { x: number(), y: number() };
            const begin = { ...cursor };
            let previous = begin;
            for (let step = 1; step <= 16; step++) {
                const t = step / 16;
                const oneMinusT = 1 - t;
                const next = {
                    x: oneMinusT * oneMinusT * begin.x +
                        2 * oneMinusT * t * control.x + t * t * end.x,
                    y: oneMinusT * oneMinusT * begin.y +
                        2 * oneMinusT * t * control.y + t * t * end.y,
                };
                segments.push({ a: previous, b: next });
                previous = next;
            }
            cursor = end;
        } else {
            throw new Error('unsupported path command in: ' + d);
        }
    }
    return {
        child: pathElement.getAttribute('data-child'),
        parent: pathElement.getAttribute('data-parent'),
        parentBox: pathElement.getAttribute('data-parent-box'),
        fork: pathElement.getAttribute('data-fork'),
        start,
        end: cursor,
        segments,
    };
}

function orientation(segment) {
    if (Math.abs(segment.a.y - segment.b.y) <= EPS) return 'h';
    if (Math.abs(segment.a.x - segment.b.x) <= EPS) return 'v';
    return 'd';
}

function interval(segment, axis) {
    return [Math.min(segment.a[axis], segment.b[axis]),
        Math.max(segment.a[axis], segment.b[axis])];
}

function overlapLength(a, b, axis) {
    const first = interval(a, axis);
    const second = interval(b, axis);
    return Math.min(first[1], second[1]) - Math.max(first[0], second[0]);
}

function samePoint(a, b) {
    return !!a && !!b && Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS;
}

function pathLabel(route) {
    return route.fork ? 'fork:' + route.fork : route.child;
}

function allowedPointJunction(a, b, point) {
    if (a.fork && b.fork && a.fork === b.fork) return true;
    const route = a.fork ? b : a;
    const fork = a.fork ? a : b;
    return !!(fork.fork && route.child === fork.fork && samePoint(point, route.start));
}

function segmentIntersection(a, b) {
    const rx = a.b.x - a.a.x;
    const ry = a.b.y - a.a.y;
    const sx = b.b.x - b.a.x;
    const sy = b.b.y - b.a.y;
    const denominator = rx * sy - ry * sx;
    if (Math.abs(denominator) <= EPS) return null;
    const qpx = b.a.x - a.a.x;
    const qpy = b.a.y - a.a.y;
    const t = (qpx * sy - qpy * sx) / denominator;
    const u = (qpx * ry - qpy * rx) / denominator;
    if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
    return { x: a.a.x + t * rx, y: a.a.y + t * ry };
}

function segmentEntersOpenRect(segment, box) {
    let low = 0;
    let high = 1;
    const axes = [
        { p: segment.a.x, d: segment.b.x - segment.a.x, min: box.left, max: box.right },
        { p: segment.a.y, d: segment.b.y - segment.a.y, min: box.top, max: box.bottom },
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

function auditVisibleDrawing(window) {
    const document = window.document;
    const routes = Array.from(document.querySelectorAll(
        '#lines-svg path[data-parent][data-child], #lines-svg path[data-fork]'))
        .map(parseRoutePath);
    const overlaps = [];
    const crossings = [];

    for (let i = 0; i < routes.length; i++) {
        for (let j = i + 1; j < routes.length; j++) {
            for (const a of routes[i].segments) {
                for (const b of routes[j].segments) {
                    const oa = orientation(a);
                    const ob = orientation(b);
                    if (oa === 'h' && ob === 'h' &&
                        Math.abs(a.a.y - b.a.y) <= EPS && overlapLength(a, b, 'x') > EPS) {
                        overlaps.push(pathLabel(routes[i]) + '/' + pathLabel(routes[j]) +
                            ' horizontal overlap');
                    } else if (oa === 'v' && ob === 'v' &&
                        Math.abs(a.a.x - b.a.x) <= EPS && overlapLength(a, b, 'y') > EPS) {
                        overlaps.push(pathLabel(routes[i]) + '/' + pathLabel(routes[j]) +
                            ' vertical overlap');
                    }

                    const point = segmentIntersection(a, b);
                    if (point && !allowedPointJunction(routes[i], routes[j], point)) {
                        crossings.push(pathLabel(routes[i]) + '/' + pathLabel(routes[j]) +
                            ' at (' + point.x + ',' + point.y + ')');
                    }
                }
            }
        }
    }

    const nodeBoxes = Array.from(document.querySelectorAll('.node[data-node-id]')).map(element => ({
        nodeId: element.getAttribute('data-node-id'),
        boxIndex: Number(element.getAttribute('data-node-idx')),
        box: element.getBoundingClientRect(),
    }));
    const nodeHits = [];
    routes.forEach(route => {
        nodeBoxes.forEach(nodeBox => {
            // A route is incident only to its selected parent statement; a
            // sibling statement in the same co-premise group is still foreign.
            const incident = route.fork
                ? route.fork === nodeBox.nodeId
                : route.child === nodeBox.nodeId ||
                    (route.parent === nodeBox.nodeId && Number(route.parentBox) === nodeBox.boxIndex);
            if (incident) return;
            if (route.segments.some(segment => segmentEntersOpenRect(segment, nodeBox.box))) {
                nodeHits.push(pathLabel(route) + ' through ' + nodeBox.nodeId + '-' + nodeBox.boxIndex);
            }
        });
    });
    return { routes, overlaps, crossings, nodeHits };
}

function suppliedTopologyFixture() {
    const leaf = (id, targetIndex) => ({
        id,
        type: 'support',
        texts: [id],
        collapsed: [],
        children: [],
        targetIndex,
    });
    const e1 = leaf('m1-p1a-p1-p1', 0);
    const e2 = leaf('m1-p1a-p1-p2', 0);
    const e = leaf('m1-p1a-p1', 0);
    e.children = [e1, e2];
    const g = {
        id: 'm1-p1c-p1',
        type: 'support',
        texts: Array.from({ length: 6 }, (_, index) => 'M1P1cP1' + String.fromCharCode(97 + index)),
        collapsed: [],
        children: [],
        targetIndex: 2,
    };
    const abc = {
        id: 'm1-p1',
        type: 'support',
        texts: ['M1P1a', 'M1P1b', 'M1P1c'],
        collapsed: [],
        children: [e, g],
        targetIndex: 0,
    };
    const h = leaf('m1-p2-p1', 0);
    const d = leaf('m1-p2', 0);
    d.children = [h];
    const root = {
        id: 'm1-topology',
        type: 'contention',
        texts: ['M1'],
        collapsed: [],
        children: [abc, d],
        x: 1000,
        y: 100,
    };
    const dimensions = {
        'm1-topology': { w: 180, h: 60 },
        'm1-p1': { boxes: [{ w: 180, h: 60 }, { w: 180, h: 200 }, { w: 180, h: 60 }], gap: 15 },
        'm1-p1a-p1': { w: 180, h: 60 },
        'm1-p1a-p1-p1': { w: 240, h: 60 },
        'm1-p1a-p1-p2': { w: 240, h: 60 },
        'm1-p1c-p1': {
            boxes: Array.from({ length: 6 }, () => ({ w: 60, h: 60 })),
            gap: 15,
        },
        'm1-p2': { w: 180, h: 60 },
        'm1-p2-p1': { w: 180, h: 180 },
    };
    return { root, dimensions };
}

function renderSuppliedTopology(window, mode) {
    const fixture = suppliedTopologyFixture();
    const state = window.__argmap.state;
    state.trees.splice(0, state.trees.length, fixture.root);
    window.eval("selectedIds = []; zoomLevel = 1; showDepthLabels = false; layoutMode = '" +
        mode + "'; render();");
    setDynamicLayoutGeometry(window, fixture.dimensions);
    window.eval('layoutAll(); drawLines();');
    return fixture;
}

(async () => {
    let dom;
    try {
        if (!fs.existsSync(FILE)) throw new Error('target HTML does not exist: ' + FILE);
        console.log('test target:', FILE);
        dom = bootApp(FILE);
        const window = dom.window;
        const document = window.document;
        await waitFor(() => window.__argmap && window.__argmap.state, 5000, '__argmap.state');

        // Complex-label topology:
        //   M1 -> M1P1a/M1P1b/M1P1c -> M1P1aP1
        const child = {
            id: 'm1-p1a-p1',
            type: 'support',
            texts: ['M1P1aP1'],
            collapsed: [],
            children: [],
            targetIndex: 0,
        };
        const coPremiseParent = {
            id: 'm1-p1',
            type: 'support',
            texts: ['M1P1a', 'M1P1b', 'M1P1c'],
            collapsed: [],
            children: [child],
            targetIndex: 0,
        };
        const main = {
            id: 'm1',
            type: 'contention',
            texts: ['M1'],
            collapsed: [],
            children: [coPremiseParent],
            x: 700,
            y: 100,
        };

        window.__argmap.state.trees.splice(0, window.__argmap.state.trees.length, main);
        window.eval('selectedIds = []; zoomLevel = 1; render();');

        stubRect(document.getElementById('surface'), rect(0, 0, 1600, 1000));
        const mainBox = rect(700, 100, 160, 60);
        const targetBoxes = [
            rect(500, 300, 160, 60),
            rect(675, 300, 160, 60),
            rect(850, 300, 160, 60),
        ];
        const childBox = rect(220, 520, 140, 60);
        setNodeGeometry(document, 'm1', [mainBox]);
        setNodeGeometry(document, 'm1-p1', targetBoxes);
        setNodeGeometry(document, 'm1-p1a-p1', [childBox]);

        window.eval('drawLines();');
        const route = document.querySelector(
            '#lines-svg path[data-parent="m1-p1"][data-child="m1-p1a-p1"]');
        if (!route) throw new Error('M1P1aP1 -> M1P1 route was not drawn');

        const endpoint = pathEndpoint(route);
        const expected = {
            x: targetBoxes[0].left + targetBoxes[0].width / 2,
            y: targetBoxes[0].bottom,
        };
        const sourceCenterX = childBox.left + childBox.width / 2;
        const epsilon = 1e-6;
        const checks = [
            {
                pass: child.targetIndex === 0,
                message: 'fixture child targets co-premise box 0',
                detail: 'targetIndex=' + child.targetIndex,
            },
            {
                pass: sourceCenterX < targetBoxes[0].left,
                message: 'fixture source is visibly left of its target',
                detail: 'sourceCenterX=' + sourceCenterX + ', targetLeft=' + targetBoxes[0].left,
            },
            {
                pass: Math.abs(endpoint.x - expected.x) <= epsilon,
                message: 'route ends at box-0 horizontal center',
                detail: 'endpoint.x=' + endpoint.x + ', expected=' + expected.x,
            },
            {
                pass: Math.abs(endpoint.y - expected.y) <= epsilon,
                message: 'route ends at box-0 bottom edge',
                detail: 'endpoint.y=' + endpoint.y + ', expected=' + expected.y,
            },
        ];

        // Exercise the supplied mockup topology through both real layout
        // modes. This is the adversarial part of the regression: centering
        // the singleton endpoint is accepted only if the emitted SVG remains
        // collision-free around the other co-premise fans and forks.
        for (const mode of ['compact', 'spread']) {
            renderSuppliedTopology(window, mode);
            const modeRouteElement = document.querySelector(
                '#lines-svg path[data-parent="m1-p1"][data-child="m1-p1a-p1"]');
            if (!modeRouteElement) throw new Error(mode + ': M1P1aP1 route was not drawn');
            const modeRoute = parseRoutePath(modeRouteElement);
            const targetElement = document.querySelector('#group-m1-p1 > .node[data-node-idx="0"]');
            if (!targetElement) throw new Error(mode + ': target box 0 was not rendered');
            const targetRect = targetElement.getBoundingClientRect();
            const targetCenter = targetRect.left + targetRect.width / 2;
            const audit = auditVisibleDrawing(window);
            const detail = audit.overlaps.concat(audit.crossings, audit.nodeHits).slice(0, 8).join('; ');

            checks.push(
                {
                    pass: Math.abs(modeRoute.end.x - targetCenter) <= epsilon &&
                        Math.abs(modeRoute.end.y - targetRect.bottom) <= epsilon,
                    message: mode[0].toUpperCase() + mode.slice(1) +
                        ' centers M1P1aP1 on box 0',
                    detail: 'endpoint=(' + modeRoute.end.x + ',' + modeRoute.end.y +
                        '), expected=(' + targetCenter + ',' + targetRect.bottom + ')',
                },
                {
                    pass: audit.routes.filter(item => item.child).length === 7,
                    message: mode[0].toUpperCase() + mode.slice(1) +
                        ' emits every supplied-topology connection',
                    detail: 'routes=' + audit.routes.filter(item => item.child).length + ', expected=7',
                },
                {
                    pass: audit.overlaps.length === 0,
                    message: mode[0].toUpperCase() + mode.slice(1) +
                        ' centered routing has no positive-length line overlap',
                    detail,
                },
                {
                    pass: audit.crossings.length === 0,
                    message: mode[0].toUpperCase() + mode.slice(1) +
                        ' centered routing has no forbidden line crossing/contact',
                    detail,
                },
                {
                    pass: audit.nodeHits.length === 0,
                    message: mode[0].toUpperCase() + mode.slice(1) +
                        ' centered routing does not enter a foreign statement',
                    detail,
                }
            );
        }

        let failures = 0;
        checks.forEach(check => {
            console.log('  ' + (check.pass ? '\u2713 ' : '\u2717 FAIL: ') + check.message +
                (check.pass ? '' : ' -- ' + check.detail));
            if (!check.pass) failures++;
        });
        console.log('\n--- routing-r24-center-endpoint-test: ' +
            (checks.length - failures) + ' passed, ' + failures + ' failed ---');
        dom.window.close();
        process.exit(failures ? 1 : 0);
    } catch (error) {
        if (dom && dom.window) dom.window.close();
        console.error('\nHARNESS ERROR -- no behavioral result:');
        console.error(error && error.stack ? error.stack : String(error));
        process.exit(2);
    }
})();
