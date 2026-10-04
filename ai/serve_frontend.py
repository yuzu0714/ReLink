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
    frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
    handler = partial(NoCacheHandler, directory=str(frontend_dir))

    # ★修正: "127.0.0.1" → "0.0.0.0" に変更
    # 127.0.0.1 は「このPC自身からのアクセスのみ」を受け付ける設定だった。
    # 0.0.0.0 にすると、同じWi-Fiにいるスマホなど、他の端末からもアクセスできるようになる。
    server = ThreadingHTTPServer(("0.0.0.0", 5500), handler)

    # ★修正: 表示メッセージも変更（スマホで開くURLの案内を追加）
    print(f"Serving frontend from {frontend_dir}")
    print("PC:     http://127.0.0.1:5500")
    print("スマホ: http://<PCのIPアドレス>:5500/login.html  (同じWi-Fi接続が必要)")
    server.serve_forever()