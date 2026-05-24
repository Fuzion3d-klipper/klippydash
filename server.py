#!/usr/bin/env python3
"""
KlipperDash - servidor local con proxy para Moonraker
"""
import http.server, socketserver, webbrowser, threading, os
import urllib.request, urllib.error, json
from urllib.parse import urlparse, urlunparse

PORT = 8765
DIR  = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith('/proxy/'):
            self.handle_proxy('GET', None)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/proxy/'):
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length else None
            self.handle_proxy('POST', body)
        else:
            super().do_POST()

    def handle_proxy(self, method, body):
        # /proxy/192.168.100.126:7125/printer/info
        #  → http://192.168.100.126:7125/printer/info
        rest = self.path[len('/proxy/'):]
        target = 'http://' + rest
        try:
            req = urllib.request.Request(target, data=body, method=method)
            req.add_header('Content-Type', 'application/json')
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', resp.headers.get('Content-Type','application/json'))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            err = json.dumps({'error': str(e)}).encode()
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(err)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def open_browser():
    import time; time.sleep(0.8)
    webbrowser.open(f'http://localhost:{PORT}')

threading.Thread(target=open_browser, daemon=True).start()
print(f"KlipperDash → http://localhost:{PORT}")
print("Cerrá esta ventana para apagar.\n")
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.allow_reuse_address = True
    httpd.serve_forever()
