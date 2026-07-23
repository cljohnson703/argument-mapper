'use strict';

// r25 regression: parent centering uses the visible outer edges of its
// immediate children. For an unequal-width co-premise child, the outgoing
// route must therefore leave the existing centre-to-centre fork bar at that
// same edge midpoint; otherwise a centered singleton route bends needlessly.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, 'argument-mapper-r25.html');
const EPS = 1e-6;
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

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

function extractFunction(source, name) {
    const pattern = new RegExp('^    function ' + name + '\\b', 'm');
    const match = pattern.exec(source);
    if (!match) throw new Error('missing function ' + name);
    const lines = source.slice(match.index).split('\n');
    for (let index = 1; index < lines.length; index++) {
        if (/^    }/.test(lines[index])) return lines.slice(0, index + 1).join('\n');
    }
    throw new Error('could not find end of function ' + name);
}

function bootApp(source) {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', () => {});
    return new JSDOM(source, {
        url: 'http://localhost:8000/' + path.basename(FILE),
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        virtualConsole,
        beforeParse(window) {
            if (!window.crypto) window.crypto = {};
            if (!window.crypto.randomUUID) window.crypto.randomUUID = () => nodeCrypto.randomUUID();
            window.ResizeObserver = window.ResizeObserver || class {
                observe() {}
                unobserve() {}
                disconnect() {}
            };
            window.matchMedia = window.matchMedia || (() => ({
                matches: false,
                media: '',
                addListener() {},
                removeListener() {},
                addEventListener() {},
                removeEventListener() {},
                dispatchEvent() { return false; },
            }));
            window.Element.prototype.scrollTo = window.Element.prototype.scrollTo || function () {};
            window.HTMLElement.prototype.scrollIntoView = function () {};
            let context;
            context = new Proxy({}, {
                get(_target, property) {
                    if (property === 'measureText') return () => ({ width: 0 });
                    return () => context;
                },
            });
            window.HTMLCanvasElement.prototype.getContext = () => context;
            window.alert = () => {};
            window.confirm = () => true;
        },
    });
}

function installDynamicGeometry(window, dimensions) {
    const document = window.document;
    const surface = document.getElementById('surface');
    Object.defineProperty(surface, 'getBoundingClientRect', {
        configurable: true,
        value: () => rect(0, 0, 100000, 100000),
    });

    Object.entries(dimensions).forEach(([nodeId, specification]) => {
        const group = document.getElementById('group-' + nodeId);
        if (!group) throw new Error('fixture node did not render: ' + nodeId);
        const boxes = Array.isArray(specification.boxes)
            ? specification.boxes
            : [specification];
        const elements = Array.from(group.querySelectorAll(':scope > .node'));
        if (elements.length !== boxes.length) {
            throw new Error(nodeId + ': rendered ' + elements.length +
                ' boxes, expected ' + boxes.length);
        }
        const baseGap = specification.gap === undefined ? 15 : specification.gap;
        const currentGap = () => {
            const inline = parseFloat(group.style.gap);
            return Number.isFinite(inline) ? inline : baseGap;
        };
        const offset = index => boxes.slice(0, index)
            .reduce((sum, box) => sum + box.w, 0) + currentGap() * index;
        const width = () => boxes.reduce((sum, box) => sum + box.w, 0) +
            currentGap() * Math.max(0, boxes.length - 1);
        const height = Math.max(...boxes.map(box => box.h));
        const left = () => parseFloat(group.style.left) || 0;
        const top = () => parseFloat(group.style.top) || 0;

        Object.defineProperty(group, 'getBoundingClientRect', {
            configurable: true,
            value: () => rect(left(), top(), width(), height),
        });
        elements.forEach((element, index) => {
            Object.defineProperty(element, 'getBoundingClientRect', {
                configurable: true,
                value: () => rect(left() + offset(index), top(), boxes[index].w, boxes[index].h),
            });
        });
    });
}

function endpoints(pathElement) {
    const d = pathElement.getAttribute('d') || '';
    const values = (d.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || []).map(Number);
    if (values.length < 4) throw new Error('cannot parse path: ' + d);
    return {
        d,
        start: { x: values[0], y: values[1] },
        end: { x: values[values.length - 2], y: values[values.length - 1] },
    };
}

function horizontalForkBar(document, nodeId) {
    const paths = Array.from(document.querySelectorAll(
        '#lines-svg path[data-fork="' + nodeId + '"]'));
    return paths.map(pathElement => endpoints(pathElement)).find(item =>
        Math.abs(item.start.y - item.end.y) <= EPS &&
        Math.abs(item.start.x - item.end.x) > EPS);
}

(async () => {
    let dom;
    try {
        const source = fs.readFileSync(FILE, 'utf8');
        console.log('routing-r25-edge-fork-source-test target: ' + path.basename(FILE));

        // Pure routing geometry uses the same definition as the DOM renderer.
        const sandbox = {};
        vm.createContext(sandbox);
        vm.runInContext(extractFunction(source, 'routeSourceLocalX') +
            '\nthis.routeSourceLocalX = routeSourceLocalX;', sandbox);
        const pureNode = { texts: ['', ''] };
        const pureGeom = {
            w: 165,
            anchorCx: 75,
            boxes: [
                { cx: 30, w: 60 },
                { cx: 120, w: 90 },
            ],
        };
        const pureSource = sandbox.routeSourceLocalX(pureNode, pureGeom);
        ok(Math.abs(pureSource - 82.5) <= EPS,
            'pure routing source is the midpoint of unequal outer edges',
            'source=' + pureSource + ', expected=82.5');
        ok(Math.abs(pureSource - pureGeom.anchorCx) > 1,
            'pure routing source is not the old outer-centre midpoint',
            'source=' + pureSource + ', old=' + pureGeom.anchorCx);

        dom = bootApp(source);
        const window = dom.window;
        const document = window.document;
        await waitFor(() => window.__argmap && window.__argmap.state,
            5000, '__argmap.state');

        const child = {
            id: 'unequal-child',
            type: 'support',
            texts: ['left', 'right'],
            collapsed: [],
            children: [],
        };
        const parent = {
            id: 'edge-parent',
            type: 'contention',
            texts: ['parent'],
            collapsed: [],
            children: [child],
            x: 1000,
            y: 100,
        };
        const dimensions = {
            'edge-parent': { w: 180, h: 60 },
            'unequal-child': {
                boxes: [{ w: 60, h: 60 }, { w: 90, h: 60 }],
                gap: 15,
            },
        };

        for (const mode of ['compact', 'spread']) {
            window.__argmap.state.trees.splice(0, window.__argmap.state.trees.length, parent);
            window.eval("selectedIds = []; zoomLevel = 1; showDepthLabels = false; layoutMode = '" +
                mode + "'; render();");
            installDynamicGeometry(window, dimensions);
            window.eval('layoutAll(); drawLines();');
            await wait(80);
            window.eval('layoutAll(); drawLines();');

            const parentBox = document.querySelector(
                '#group-edge-parent > .node[data-node-idx="0"]');
            const childBoxes = Array.from(document.querySelectorAll(
                '#group-unequal-child > .node'));
            const routeElement = document.querySelector(
                '#lines-svg path[data-parent="edge-parent"][data-child="unequal-child"]');
            if (!parentBox || childBoxes.length !== 2 || !routeElement) {
                throw new Error(mode + ': rendered fixture is incomplete');
            }
            const parentRect = parentBox.getBoundingClientRect();
            const firstRect = childBoxes[0].getBoundingClientRect();
            const lastRect = childBoxes[1].getBoundingClientRect();
            const expectedX = (firstRect.left + lastRect.right) / 2;
            const parentCenter = parentRect.left + parentRect.width / 2;
            const route = endpoints(routeElement);
            const bar = horizontalForkBar(document, child.id);
            if (!bar) throw new Error(mode + ': co-premise fork bar was not drawn');
            const firstCenter = firstRect.left + firstRect.width / 2;
            const lastCenter = lastRect.left + lastRect.width / 2;
            const prefix = mode[0].toUpperCase() + mode.slice(1);

            ok(Math.abs(parentCenter - expectedX) <= EPS,
                prefix + ' centers the parent on the child outer edges',
                'parent=' + parentCenter + ', edges=' + expectedX);
            ok(Math.abs(route.start.x - expectedX) <= EPS &&
                    Math.abs(route.end.x - parentCenter) <= EPS,
                prefix + ' route source and parent endpoint use the same edge midpoint',
                'start=' + route.start.x + ', end=' + route.end.x + ', expected=' + expectedX);
            ok(!/[Q]/i.test(route.d) && Math.abs(route.start.x - route.end.x) <= EPS,
                prefix + ' centered singleton connection is straight',
                'd=' + route.d);
            ok(Math.abs(bar.start.x - firstCenter) <= EPS &&
                    Math.abs(bar.end.x - lastCenter) <= EPS,
                prefix + ' fork bar still spans the premise-box centres',
                'bar=' + bar.d);
        }

        console.log('\n--- routing-r25-edge-fork-source-test: ' + passed +
            ' passed, ' + failed + ' failed ---');
        dom.window.close();
        process.exit(failed ? 1 : 0);
    } catch (error) {
        if (dom && dom.window) dom.window.close();
        console.error('\nHARNESS ERROR -- no behavioral result:');
        console.error(error && error.stack || error);
        process.exit(2);
    }
})();
