"""Serve the same stateless simulation on Vercel and during local development."""

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from base_simulation import simulate


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/base-simulation":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 24_000:
                raise ValueError("Invalid simulation request size.")
            result = simulate(json.loads(self.rfile.read(length)))
        except (ValueError, RecursionError) as error:
            self.respond(400, {"error": str(error)})
            return
        self.respond(200, result)

    def respond(self, status, data):
        body = json.dumps(data, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    with ThreadingHTTPServer(("127.0.0.1", 3101), handler) as server:
        server.serve_forever()
