'use strict';

// Full-app jsdom regression for asymmetric Spread statement lanes.
// Unlike the arithmetic-only suite, this exercises render() + layoutAll(),
// including the per-box CSS margins that realize computed adjacent gap vectors.
//
// Usage: node layout-r24-spread-dom-test.js [path-to-html]

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, 'argument-mapper-r24.html');
const HGAP = 15;
const EPS = 0.02;

let passed = 0;
let failed = 0;

function ok(value, label, detail) {
    if (value) {
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

function number(value, fallback) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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

function directBoxes(group) {
    return Array.from(group.children).filter(child => child.classList && child.classList.contains('node'));
}

// jsdom has no layout engine. This small deterministic flex-row model reads
// the app's real group left/top styles, its real per-box margin-left styles,
// and fixture box dimensions. A mismatch between computed and applied Spread
// gaps is therefore visible in getBoundingClientRect(), just as in a browser.
function installGeometry(window, geometryById) {
    function specFor(nodeElement) {
        const id = nodeElement.getAttribute('data-node-id');
        const index = Number(nodeElement.getAttribute('data-node-idx') || 0);
        const groupSpec = geometryById.get(id);
        const boxSpec = groupSpec && groupSpec[index];
        return boxSpec || { width: 180, height: 60 };
    }

    function groupBox(group) {
        const boxes = directBoxes(group);
        const left = number(group.style.left, 0);
        const top = number(group.style.top, 0);
        let width = 0;
        let height = 0;
        boxes.forEach((box, index) => {
            const spec = specFor(box);
            width += number(box.style.marginLeft, 0) + spec.width;
            if (index + 1 < boxes.length) width += HGAP;
            height = Math.max(height, spec.height);
        });
        return rect(left, top, width, height);
    }

    function statementBox(nodeElement) {
        const group = nodeElement.parentElement;
        const boxes = directBoxes(group);
        const groupRect = groupBox(group);
        let left = groupRect.left;
        for (const box of boxes) {
            left += number(box.style.marginLeft, 0);
            const spec = specFor(box);
            if (box === nodeElement) return rect(left, groupRect.top, spec.width, spec.height);
            left += spec.width + HGAP;
        }
        return rect(left, groupRect.top, 0, 0);
    }

    Object.defineProperty(window.Element.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: function () {
            if (this.id === 'surface') return rect(0, 0, 100000, 100000);
            if (this.classList && this.classList.contains('node-group')) return groupBox(this);
            if (this.classList && this.classList.contains('node')) return statementBox(this);
            return rect(0, 0, 0, 0);
        },
    });
}

function bootApp(htmlPath, geometryById) {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', () => {});
    return new JSDOM(fs.readFileSync(htmlPath, 'utf8'), {
        url: 'http://localhost:8000/' + path.basename(htmlPath) + '#new',
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
            installGeometry(window, geometryById);
        },
    });
}

function groupElement(document, node) {
    const element = document.getElementById('group-' + node.id);
    if (!element) throw new Error('missing rendered group ' + node.id);
    return element;
}

function statementRects(document, node) {
    return directBoxes(groupElement(document, node)).map(element => element.getBoundingClientRect());
}

function configureGeometry(geometryById, root, special) {
    geometryById.clear();
    (function walk(node) {
        let widths = Array(node.texts.length).fill(145);
        let heights = Array(node.texts.length).fill(40);
        if (node.type === 'contention') {
            widths = [150];
            heights = [45];
        }
        if (node === special.abc) heights = [40, 110, 40];
        geometryById.set(node.id, widths.map((width, index) => ({ width, height: heights[index] })));
        node.children.forEach(walk);
    })(root);
}

function subtreeBounds(document, node) {
    let left = Infinity;
    let right = -Infinity;
    (function walk(current) {
        statementRects(document, current).forEach(box => {
            left = Math.min(left, box.left);
            right = Math.max(right, box.right);
        });
        current.children.forEach(walk);
    })(node);
    return { left, right };
}

function targetIndex(parent, child) {
    const index = child.targetIndex === undefined ? 0 : child.targetIndex;
    return Math.max(0, Math.min(index, parent.texts.length - 1));
}

function laneViolations(document, root) {
    const violations = [];
    (function walk(node) {
        const boxes = statementRects(document, node);
        const lanes = boxes.map((box, index) => ({ left: box.left, right: box.right, index }));
        node.children.forEach(child => {
            const index = targetIndex(node, child);
            const bounds = subtreeBounds(document, child);
            lanes[index].left = Math.min(lanes[index].left, bounds.left);
            lanes[index].right = Math.max(lanes[index].right, bounds.right);
        });
        for (let index = 1; index < lanes.length; index++) {
            const clearance = lanes[index].left - lanes[index - 1].right;
            if (clearance < HGAP - EPS) {
                violations.push(node.id + ':' + (index - 1) + '>' + index + '=' + clearance.toFixed(3));
            }
        }
        node.children.forEach(walk);
    })(root);
    return violations;
}

function snapshot(document) {
    const result = {};
    Array.from(document.querySelectorAll('.node-group')).forEach(group => {
        result[group.id] = {
            left: number(group.style.left, 0),
            top: number(group.style.top, 0),
            boxes: directBoxes(group).map(box => {
                const r = box.getBoundingClientRect();
                return {
                    center: (r.left + r.right) / 2,
                    left: r.left,
                    right: r.right,
                    marginLeft: number(box.style.marginLeft, 0),
                };
            }),
        };
    });
    return result;
}

function snapshotDifference(a, b) {
    let maximum = 0;
    const keys = Object.keys(a).sort();
    if (keys.join('|') !== Object.keys(b).sort().join('|')) return Infinity;
    keys.forEach(key => {
        maximum = Math.max(maximum, Math.abs(a[key].left - b[key].left), Math.abs(a[key].top - b[key].top));
        if (a[key].boxes.length !== b[key].boxes.length) maximum = Infinity;
        a[key].boxes.forEach((box, index) => {
            const other = b[key].boxes[index];
            if (!other) return;
            maximum = Math.max(maximum,
                Math.abs(box.center - other.center),
                Math.abs(box.left - other.left),
                Math.abs(box.right - other.right),
                Math.abs(box.marginLeft - other.marginLeft));
        });
    });
    return maximum;
}

function expectedCenterError(document, node, gaps) {
    const group = groupElement(document, node);
    const boxes = statementRects(document, node);
    const left = number(group.style.left, 0);
    let cursor = left;
    let maximum = 0;
    boxes.forEach((box, index) => {
        const expected = cursor + box.width / 2;
        maximum = Math.max(maximum, Math.abs((box.left + box.right) / 2 - expected));
        cursor += box.width + (index + 1 < boxes.length ? gaps[index] : 0);
    });
    return maximum;
}

(async () => {
    let dom;
    try {
        if (!fs.existsSync(FILE)) throw new Error('target HTML does not exist: ' + FILE);
        console.log('layout-r24-spread-dom-test target: ' + path.basename(FILE));
        const geometryById = new Map();
        dom = bootApp(FILE, geometryById);
        const window = dom.window;
        const document = window.document;
        await waitFor(() => window.__argmap && window.__argmap.state, 5000, '__argmap.state');

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
        window.__spreadFixtureText = suppliedText;
        const parsed = window.eval('parseTextToState(window.__spreadFixtureText)');
        const main = parsed.trees[0];
        const abc = main.children.find(child => child.texts.length === 3);
        const abcChildren = abc ? abc.children : [];
        const aPremise = abcChildren.find(child => targetIndex(abc, child) === 0);
        const cPremises = abcChildren.find(child => targetIndex(abc, child) === 2);

        ok(!!abc && abcChildren.length === 2 && !!aPremise && aPremise.texts.length === 1 &&
                !!cPremises && cPremises.texts.length === 5,
            'the exact supplied import renders the intended A/C target topology',
            'children=' + abcChildren.length + ', counts=' + abcChildren.map(n => n.texts.length).join('/'));

        configureGeometry(geometryById, main, { abc });
        window.__argmap.state.trees.splice(0, window.__argmap.state.trees.length, main);
        window.eval("layoutMode = 'spread'; document.body.classList.add('layout-spread'); render();");

        const gapVector = window.eval('spreadGaps[window.__argmap.state.trees[0].children[0].id].slice()');
        const abcBoxRects = statementRects(document, abc);
        const renderedGapAB = abcBoxRects[1].left - abcBoxRects[0].right;
        const renderedGapBC = abcBoxRects[2].left - abcBoxRects[1].right;
        const centerError = expectedCenterError(document, abc, gapVector);
        ok(gapVector.length === 2 && Math.abs(renderedGapAB - gapVector[0]) < EPS &&
                Math.abs(renderedGapBC - gapVector[1]) < EPS && centerError < EPS,
            'DOM box centers and adjacent gaps match the computed asymmetric Spread vector',
            'vector=' + gapVector.join('/') + ', rendered=' + renderedGapAB + '/' + renderedGapBC +
                ', center error=' + centerError);
        ok(Math.abs(renderedGapAB - renderedGapBC) > 0.5,
            'the rendered A-B and B-C gaps are genuinely asymmetric',
            'A-B=' + renderedGapAB + ', B-C=' + renderedGapBC);

        const violations = laneViolations(document, main);
        ok(violations.length === 0,
            'rendered target lanes clear every nonancestor statement shadow by HGAP',
            violations.join(', '));

        const initial = snapshot(document);
        for (let iteration = 0; iteration < 6; iteration++) window.eval('layoutAll()');
        const repeated = snapshot(document);
        const repeatDrift = snapshotDifference(initial, repeated);
        ok(repeatDrift < EPS,
            'repeated layoutAll passes do not drift asymmetric Spread geometry',
            'maximum drift=' + repeatDrift);

        window.eval('toggleLayoutMode(); toggleLayoutMode();');
        const toggled = snapshot(document);
        const toggleDrift = snapshotDifference(initial, toggled);
        ok(toggleDrift < EPS,
            'Compact-to-Spread round trip restores identical positions and box centers',
            'maximum drift=' + toggleDrift);

        await new Promise(resolve => setTimeout(resolve, 120));
        const settled = snapshot(document);
        const settledDrift = snapshotDifference(initial, settled);
        ok(settledDrift < EPS,
            'scheduled settle passes after the mode round trip remain drift-free',
            'maximum drift=' + settledDrift);

        // Detach the exact imported ABC subtree as a Shift/free root. Its own
        // group is the asymmetric one, so this is stronger than pinning a
        // single-box main contention above an asymmetric descendant.
        const freeABC = JSON.parse(JSON.stringify(abc));
        freeABC.x = 1234.5;
        freeABC.y = 456.25;
        freeABC.freePosition = true;
        delete freeABC.targetIndex;
        configureGeometry(geometryById, freeABC, { abc: freeABC });
        window.__argmap.state.trees.splice(0, window.__argmap.state.trees.length, freeABC);
        window.eval("layoutMode = 'spread'; document.body.classList.add('layout-spread'); render();");

        const freeGroup = groupElement(document, freeABC);
        const freeInitial = snapshot(document);
        const freeLeft = number(freeGroup.style.left, NaN);
        const freeRectLeft = freeGroup.getBoundingClientRect().left;
        ok(Math.abs(freeLeft - freeABC.x) < EPS && Math.abs(freeRectLeft - freeABC.x) < EPS,
            'free asymmetric root keeps its stored left edge exactly',
            'style/rect/stored=' + freeLeft + '/' + freeRectLeft + '/' + freeABC.x);

        for (let iteration = 0; iteration < 4; iteration++) window.eval('layoutAll()');
        window.eval('toggleLayoutMode(); toggleLayoutMode();');
        await new Promise(resolve => setTimeout(resolve, 120));
        const freeFinal = snapshot(document);
        const freeDrift = snapshotDifference(freeInitial, freeFinal);
        const finalLeft = number(groupElement(document, freeABC).style.left, NaN);
        ok(freeDrift < EPS && Math.abs(finalLeft - freeABC.x) < EPS,
            'free-root pin and descendant geometry survive repeats and Compact/Spread toggles',
            'maximum drift=' + freeDrift + ', final left=' + finalLeft);

        console.log('\n--- layout-r24-spread-dom-test: ' + passed + ' passed, ' + failed + ' failed ---');
        dom.window.close();
        process.exit(failed ? 1 : 0);
    } catch (error) {
        if (dom && dom.window) dom.window.close();
        console.error('\nHARNESS ERROR -- no behavioral result:');
        console.error(error && error.stack ? error.stack : String(error));
        process.exit(2);
    }
})();
