#!/usr/bin/env python3
"""
One-command demo server for the Argument Mapper's collaboration testing.

It does two jobs at once:
  1. Serves the files in this folder (so http://localhost:8000/argument-mapper.html works),
     replacing `python3 -m http.server`.
  2. Hosts ONE shared document at /sync (GET /sync/doc, GET /sync/version,
     PUT /sync/doc with compare-and-swap, DELETE /sync/doc to reset), so that
     ANY mix of browsers, incognito windows, or other devices on your network
     can collaborate on the same map while each keeps its OWN identity.
     (The localStorage demo cannot do this: the storage isolation that gives a
     second window its own identity also cuts off its only channel.)

Usage:
    python3 serve.py            (or on Windows:  py serve.py)
    then open  http://localhost:8000/argument-mapper.html
    in each browser, press F12 and run:  __argmap.startServerDemo()

The shared document is write-through persisted to demo-doc.json next to this
file, so restarting the server does not lose the demo map. To start fresh,
run  __argmap.resetServerDemo()  in one browser (it clears the server doc and
that browser's local copies), then reload the other browsers.
"""
import json
import os
import threading
import argparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
STORE_FILE = os.path.join(HERE, 'demo-doc.json')
LOCK = threading.Lock()


def load_store():
    try:
        with open(STORE_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, dict) and 'version' in data:
            return {'version': int(data.get('version') or 0), 'content': data.get('content')}
    except Exception:
        pass
    return {'version': 0, 'content': None}


STORE = load_store()


def save_store():
    try:
        with open(STORE_FILE, 'w', encoding='utf-8') as f:
            json.dump(STORE, f)
    except Exception:
        pass  # persistence is best-effort; the in-memory doc still works


class Handler(SimpleHTTPRequestHandler):
    # Serve files relative to this script's folder regardless of cwd.
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def _cors(self):
        # Same-origin use never needs these; they exist so an app hosted
        # elsewhere (e.g. GitHub Pages) can still point at a local server via
        # __argmap.startServerDemo('http://localhost:8000/sync').
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _json(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/sync/version':
            with LOCK:
                return self._json(200, {'version': STORE['version']})
        if self.path == '/sync/doc':
            with LOCK:
                return self._json(200, {'version': STORE['version'], 'content': STORE['content']})
        return super().do_GET()

    def do_PUT(self):
        if self.path != '/sync/doc':
            return self._json(404, {'error': 'not found'})
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8'))
        except Exception:
            return self._json(400, {'error': 'bad json'})
        expected = body.get('expectedVersion')
        try:
            expected = 0 if expected in (None, '', 0, '0') else int(expected)
        except (TypeError, ValueError):
            return self._json(400, {'error': 'bad expectedVersion'})
        with LOCK:
            # Compare-and-swap: a stale writer is rejected and must pull,
            # re-merge, and retry -- the engine's CAS loop handles this, and
            # it is the same shape Google Drive's 412 precondition will have.
            if expected != STORE['version']:
                return self._json(409, {'error': 'conflict', 'current': STORE['version']})
            STORE['version'] += 1
            STORE['content'] = body.get('content')
            save_store()
            return self._json(200, {'version': STORE['version']})

    def do_DELETE(self):
        if self.path != '/sync/doc':
            return self._json(404, {'error': 'not found'})
        with LOCK:
            STORE['version'] = 0
            STORE['content'] = None
            save_store()
            return self._json(200, {'version': 0})

    def log_message(self, fmt, *args):
        # Quiet the per-request noise (the /sync poll fires every ~3s per
        # browser); errors still surface via stderr tracebacks.
        pass


def main():
    ap = argparse.ArgumentParser(description='Argument Mapper demo sync server')
    ap.add_argument('--port', type=int, default=8000)
    args = ap.parse_args()
    try:
        srv = ThreadingHTTPServer(('0.0.0.0', args.port), Handler)
    except OSError as e:
        print('ERROR: could not bind port %d (%s).' % (args.port, e))
        print('Most likely another server is already running on this port --')
        print('for example an old "python3 -m http.server %d". Stop it (Ctrl+C' % args.port)
        print('in its terminal) and run this again, or use:  python3 serve.py --port 8001')
        raise SystemExit(1)
    print('Argument Mapper demo server running.')
    print('  App:   http://localhost:%d/argument-mapper.html' % args.port)
    print('  Sync:  http://localhost:%d/sync  (doc version: %d)' % (args.port, STORE['version']))
    print('In each browser console (F12), run:  __argmap.startServerDemo()')
    print('Press Ctrl+C to stop.')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')


if __name__ == '__main__':
    main()
