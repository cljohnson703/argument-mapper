#!/usr/bin/env node
'use strict';
/**
 * Runs every regression suite against the current source, then the smoke test
 * against the built file.
 *
 *   npm test                      (or: node run-all-tests.js)
 *   node run-all-tests.js some-other-build.html
 *
 * Each suite takes the HTML file as argv[2]; several of them were written for
 * earlier releases and still name those as their default, so this runner
 * always passes the target explicitly. Exit code is non-zero if anything fails.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SOURCE = process.argv[2] || 'argument-mapper-r27.html';
const BUILD = path.join('docs', 'index.html');

const SUITES = [
    'layout-r23-tests.js',
    'layout-r23-box-collision-test.js',
    'layout-r23-depth-channel-test.js',
    'routing-r23-tests.js',
    'routing-r23-cross-target-test.js',
    'layout-r24-spread-shadow-tests.js',
    'layout-r24-spread-dom-test.js',
    'layout-r24-clearance-sweep-test.js',
    'layout-r24-clearance-fuzz-test.js',
    'layout-r24-compact-cycle-test.js',
    'routing-r24-center-endpoint-test.js',
    'layout-r25-edge-centering-test.js',
    'routing-r25-edge-fork-source-test.js',
    'multidrag-r25-tests.js',
    'multidrag-r25-sync-test.js',
    'shortcut-r25-free-node-test.js',
    'stringmode-r26-label-test.js',
    'xss-r26-render-test.js',
    'export-r27-tests.js',
    'collab-r26-firebase-test.js',
];

if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`);
    process.exit(2);
}

let failed = [];
console.log(`Running ${SUITES.length} suites against ${SOURCE}\n`);
for (const suite of SUITES) {
    if (!fs.existsSync(path.join(__dirname, suite))) { console.log(`  - ${suite} (missing, skipped)`); continue; }
    process.stdout.write(`  ${suite.padEnd(38)}`);
    try {
        execFileSync(process.execPath, [suite, SOURCE], { stdio: 'pipe' });
        console.log('ok');
    } catch (e) {
        console.log('FAIL');
        failed.push(suite);
    }
}

// The smoke test targets the BUILT file, which may not exist yet.
if (fs.existsSync(path.join(__dirname, BUILD))) {
    process.stdout.write(`  ${'smoke-public-test.js'.padEnd(38)}`);
    try {
        execFileSync(process.execPath, ['smoke-public-test.js', BUILD], { stdio: 'pipe' });
        console.log('ok');
    } catch (e) { console.log('FAIL'); failed.push('smoke-public-test.js'); }
} else {
    console.log(`\n  (${BUILD} not built yet — run \`node build-public.js\` to include the smoke test)`);
}

console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : `\nAll suites passed.`);
process.exit(failed.length ? 1 : 0);
