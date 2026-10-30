"""Container-only integration harness; never included in the production image."""
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import socketserver
import sys
import threading

sys.path.insert(0, "/opt/nantty")
import proxy


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200 if Path("/fixtures/ready").exists() else 503)
        self.end_headers()
        self.wfile.write(b"ready")

    def log_message(self, *_):
        pass


class Echo(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.sendall(self.request.recv(1024))


class Secrets:
    def get_secret_value(self, **_):
        value = Path("/fixtures/bundle.json").read_text()
        return {"VersionId": hashlib.sha256(value.encode()).hexdigest(), "SecretString": value}


if __name__ == "__main__":
    configuration = json.loads(os.environ["TLS_CONFIG"])
    for server in [ThreadingHTTPServer(("127.0.0.1", configuration["app_port"]), Handler),
                   socketserver.ThreadingTCPServer(("127.0.0.1", 9103), Echo)]:
        threading.Thread(target=server.serve_forever, daemon=True).start()
    proxy.boto3.client = lambda _: Secrets()
    proxy.serve(configuration)
