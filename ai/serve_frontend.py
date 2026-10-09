from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path
import socket


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


# ★追加：今ネットにつながっているPCのIPアドレスを自動で調べる関数
# UDPソケットを「8.8.8.8に接続するふり」だけする(実際にはデータは送られない)と、
# OSが「その宛先に出ていくときに使うネットワークカード」を選んでくれる。
# そのカードのIPを getsockname() で読めば、Wi-Fi/テザリングのどちらでも
# 「今実際に使っている回線のIP」が取れる。WSLなどの仮想アダプターも避けられる。
# ネットにつながっていない時は例外が出るので、Noneを返して呼び出し側で案内を出す。
def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


if __name__ == "__main__":
    frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
    handler = partial(NoCacheHandler, directory=str(frontend_dir))

    # 0.0.0.0 は、同じWi-Fiにいるスマホなど他の端末からのアクセスも受け付ける設定
    server = ThreadingHTTPServer(("0.0.0.0", 5500), handler)

    # ★修正：「<PCのIPアドレス>」の固定文言をやめて、実際のIPを表示するようにした
    lan_ip = get_lan_ip()
    print(f"Serving frontend from {frontend_dir}")
    print("PC:     http://127.0.0.1:5500")
    if lan_ip:
        print("============================================")
        print("  スマホで開くURL (同じWi-Fi／テザリングに接続してね)")
        print(f"  http://{lan_ip}:5500/login.html")
        print("============================================")
    else:
        print("スマホ: ネットワークに接続されていないため、IPアドレスを取得できませんでした。")
    server.serve_forever()