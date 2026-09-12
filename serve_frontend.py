from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    frontend_dir = Path(__file__).resolve().parent / "frontend"
    handler = partial(NoCacheHandler, directory=str(frontend_dir))
    server = ThreadingHTTPServer(("127.0.0.1", 5500), handler)
    print(f"Serving frontend from {frontend_dir} at http://127.0.0.1:5500")
    server.serve_forever()
