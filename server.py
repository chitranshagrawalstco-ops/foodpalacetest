from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 5173


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = self.path.split("?", 1)[0]
        if route == "/":
            target = ROOT / "index.html"
        elif route == "/menu":
            target = ROOT / "menu.html"
        elif route == "/cart":
            target = ROOT / "cart.html"
        elif route == "/track":
            target = ROOT / "tracking.html"
        elif route == "/admin":
            target = ROOT / "admin.html"
        elif route == "/dashboard":
            target = ROOT / "admin-dashboard.html"
        else:
            target = ROOT / route.lstrip("/")

        if not target.exists() or not target.is_file():
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        ctype = "text/plain"
        suffix = target.suffix.lower()
        if suffix == ".html":
            ctype = "text/html"
        elif suffix == ".css":
            ctype = "text/css"
        elif suffix == ".js":
            ctype = "text/javascript"

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.end_headers()
        self.wfile.write(target.read_bytes())


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Server running at http://localhost:{PORT}", flush=True)
    server.serve_forever()
