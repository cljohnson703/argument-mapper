// Focused regression for r23 cross-target statement-fan band allocation.
// Usage: node routing-r23-cross-target-test.js [path-to-html]

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, 'argument-mapper-r23.html');
const EPS = 1e-6;

function box(left, top, width, height) {
    return { left, top, right: left + width, bottom: top + height,
        x: left, y: top, width, height, toJSON() { return this; } };
}
function union(rects) {
    const left = Math.min(...rects.map(rect => rect.left));
    const top = Math.min(...rects.map(rect => rect.top));
    const right = Math.max(...rects.map(rect => rect.right));
    const bottom = Math.max(...rects.map(rect => rect.bottom));
    return box(left, top, right - left, bottom - top);
}
function stubRect(element, rect) {
    Object.defineProperty(element, 'getBoundingClientRect', {
        value: () => rect, configurable: true
    });
}
function waitFor(fn, timeoutMs) {
    const start = Date.now();
    return new Promise((resolve, reject) => (function poll() {
        let value;
        try { value = fn(); } catch (_) {}
        if (value) return resolve(value);
        if (Date.now() - start > timeoutMs) return reject(new Error('app boot timeout'));
        setTimeout(poll, 10);
    })());
}
function leaf(id, targetIndex) {
    return { id, type: 'support', texts: [id], collapsed: [], children: [], targetIndex };
}

function parsePath(element) {
    const d = element.getAttribute('d') || '';
    const tokens = d.match(/[MLQ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
    let i = 0, cursor = null;
    const segments = [];
    const number = () => Number(tokens[i++]);
    while (i < tokens.length) {
        const command = tokens[i++].toUpperCase();
        if (command === 'M') cursor = { x: number(), y: number() };
        else if (command === 'L') {
            const next = { x: number(), y: number() };
            segments.push({ a: { ...cursor }, b: { ...next } });
            cursor = next;
        } else if (command === 'Q') {
            number(); number();
            cursor = { x: number(), y: number() };
        }
    }
    return { child: element.getAttribute('data-child'), d, segments };
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
function forbiddenContact(a, b) {
    for (const sa of a.segments) for (const sb of b.segments) {
        const oa = orientation(sa), ob = orientation(sb);
        if (oa === 'h' && ob === 'h' && Math.abs(sa.a.y - sb.a.y) <= EPS) {
            const ia = interval(sa, 'x'), ib = interval(sb, 'x');
            if (Math.min(ia[1], ib[1]) >= Math.max(ia[0], ib[0]) - EPS) return true;
        }
        if (oa === 'v' && ob === 'v' && Math.abs(sa.a.x - sb.a.x) <= EPS) {
            const ia = interval(sa, 'y'), ib = interval(sb, 'y');
            if (Math.min(ia[1], ib[1]) >= Math.max(ia[0], ib[0]) - EPS) return true;
        }
        let h, v;
        if (oa === 'h' && ob === 'v') { h = sa; v = sb; }
        if (oa === 'v' && ob === 'h') { h = sb; v = sa; }
        if (h && v) {
            const hx = interval(h, 'x'), vy = interval(v, 'y');
            if (v.a.x >= hx[0] - EPS && v.a.x <= hx[1] + EPS &&
                h.a.y >= vy[0] - EPS && h.a.y <= vy[1] + EPS) return true;
        }
    }
    return false;
}
function channelY(route) {
    const horizontal = route.segments.filter(segment => orientation(segment) === 'h')
        .sort((a, b) => Math.abs(b.b.x - b.a.x) - Math.abs(a.b.x - a.a.x))[0];
    return horizontal ? horizontal.a.y : NaN;
}

(async () => {
    let dom;
    try {
        const virtualConsole = new VirtualConsole();
        dom = new JSDOM(fs.readFileSync(FILE, 'utf8'), {
            url: 'http://localhost:8000/' + path.basename(FILE),
            runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole,
            beforeParse(window) {
                if (!window.crypto) window.crypto = {};
                if (!window.crypto.randomUUID) window.crypto.randomUUID = () => crypto.randomUUID();
                window.ResizeObserver = window.ResizeObserver || class {
                    observe() {} unobserve() {} disconnect() {}
                };
                window.matchMedia = window.matchMedia || (() => ({ matches: false,
                    addListener() {}, removeListener() {}, addEventListener() {},
                    removeEventListener() {}, dispatchEvent() { return false; } }));
                window.Element.prototype.scrollTo = window.Element.prototype.scrollTo || function () {};
                window.HTMLElement.prototype.scrollIntoView =
                    window.HTMLElement.prototype.scrollIntoView || function () {};
            }
        });
        const window = dom.window;
        await waitFor(() => window.__argmap && window.__argmap.state, 5000);

        const singleton = leaf('singleton', 0);
        const multiLeft = leaf('multi-left', 1);
        const multiRight = leaf('multi-right', 1);
        const root = {
            id: 'root', type: 'contention', texts: ['root-0', 'root-1'],
            collapsed: [], children: [singleton, multiLeft, multiRight]
        };
        window.__argmap.state.trees.splice(0, window.__argmap.state.trees.length, root);
        window.eval("selectedIds = []; zoomLevel = 1; layoutMode = 'compact'; render();");
        stubRect(window.document.getElementById('surface'), box(0, 0, 1200, 800));
        const geometry = {
            root: [box(400, 100, 120, 60), box(535, 100, 120, 60)],
            singleton: [box(-10, 400, 120, 60)],
            'multi-left': [box(240, 400, 120, 60)],
            'multi-right': [box(840, 400, 120, 60)]
        };
        Object.entries(geometry).forEach(([id, rects]) => {
            const group = window.document.getElementById('group-' + id);
            const nodes = Array.from(group.querySelectorAll(':scope > .node'));
            nodes.forEach((node, index) => stubRect(node, rects[index]));
            stubRect(group, union(rects));
        });
        window.eval('drawLines();');
        const routes = Array.from(window.document.querySelectorAll(
            '#lines-svg path[data-parent][data-child]')).map(parsePath);
        const byChild = Object.fromEntries(routes.map(route => [route.child, route]));
        const singletonY = channelY(byChild.singleton);
        const leftY = channelY(byChild['multi-left']);
        const rightY = channelY(byChild['multi-right']);
        const contacts = [
            forbiddenContact(byChild.singleton, byChild['multi-left']),
            forbiddenContact(byChild.singleton, byChild['multi-right'])
        ].filter(Boolean).length;

        const failures = [];
        if (routes.length !== 3) failures.push('expected 3 routes, got ' + routes.length);
        if (Math.abs(singletonY - 280) > EPS) {
            failures.push('singleton midpoint moved: y=' + singletonY + ', expected 280');
        }
        if (Math.abs(leftY - rightY) > EPS) {
            failures.push('multi-fan channel grid split: ' + leftY + ' vs ' + rightY);
        }
        if (Math.abs(leftY - 280) <= 2) {
            failures.push('multi-fan stayed on conflicting base y=' + leftY);
        }
        if (leftY < 170 - EPS || leftY > 390 + EPS) {
            failures.push('multi-fan left legal corridor: y=' + leftY);
        }
        if (contacts) failures.push('cross-target route contact remains');

        if (failures.length) {
            console.error('FAIL routing-r23-cross-target-test');
            failures.forEach(failure => console.error('  - ' + failure));
            process.exitCode = 1;
        } else {
            console.log('PASS routing-r23-cross-target-test: singleton y=' + singletonY +
                ', moved multi-fan y=' + leftY);
        }
    } catch (error) {
        console.error(error && error.stack ? error.stack : String(error));
        process.exitCode = 2;
    } finally {
        if (dom) dom.window.close();
    }
})();
