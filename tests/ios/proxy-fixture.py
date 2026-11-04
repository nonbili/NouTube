"""Loopback-only fixture; all credentials are synthetic. Ctrl-C stops both proxies."""
import base64
import json
import select
import socket
import socketserver
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

USER, PASSWORD = b'nou-test', b'p@ss:/ test'
rejected = {'http': 0, 'socks': 0}
rejection_lock = threading.Lock()


def record_rejection(kind):
    with rejection_lock:
        rejected[kind] += 1


class Stats(BaseHTTPRequestHandler):
    def do_GET(self):
        with rejection_lock:
            body = json.dumps(rejected).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def take(sock, count):
    result = b''
    while len(result) < count:
        chunk = sock.recv(count - len(result))
        if not chunk:
            raise EOFError()
        result += chunk
    return result


def headers(sock):
    result = b''
    while not result.endswith(b'\r\n\r\n'):
        if len(result) >= 16384:
            raise ValueError('Headers too long')
        result += take(sock, 1)
    return result


class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        sock = self.request
        sock.settimeout(15)
        try:
            if self.server.kind == 'http':
                request = headers(sock)
                auth = b'Proxy-Authorization: Basic ' + base64.b64encode(USER + b':' + PASSWORD)
                if auth not in request:
                    record_rejection('http')
                    sock.sendall(b'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="fixture"\r\nConnection: close\r\n\r\n')
                    print('http rejected', flush=True)
                    return
                host, port = request.split(b' ')[1].decode().rsplit(':', 1)
                host, port = host.strip('[]'), int(port)
                connected = b'HTTP/1.1 200 Connection Established\r\n\r\n'
            else:
                assert take(sock, 1) == b'\x05'
                assert 2 in take(sock, take(sock, 1)[0])
                sock.sendall(b'\x05\x02')
                assert take(sock, 1) == b'\x01'
                user, password = take(sock, take(sock, 1)[0]), take(sock, take(sock, 1)[0])
                valid = user == USER and password == PASSWORD
                sock.sendall(bytes([1, 0 if valid else 1]))
                if not valid:
                    record_rejection('socks')
                    print('socks rejected', flush=True)
                    return
                request = take(sock, 4)
                assert request[:3] == b'\x05\x01\x00'
                if request[3] == 3:
                    host = take(sock, take(sock, 1)[0]).decode()
                elif request[3] == 1:
                    host = socket.inet_ntop(socket.AF_INET, take(sock, 4))
                else:
                    assert request[3] == 4
                    host = socket.inet_ntop(socket.AF_INET6, take(sock, 16))
                port = int.from_bytes(take(sock, 2), 'big')
                connected = b'\x05\x00\x00\x01\x7f\x00\x00\x01\x00\x50'
            print(json.dumps({'type': self.server.kind, 'host': host, 'port': port}), flush=True)
            if host == 'proxy-verification.invalid' or host.endswith('.proxy-verification.invalid'):
                sock.sendall(connected)
                headers(sock)
                sock.sendall(b'HTTP/1.1 200 OK\r\nContent-Length: 11\r\nCache-Control: no-store\r\nConnection: close\r\n\r\nproxy works')
                return
            with socket.create_connection((host, port), 15) as remote:
                sock.sendall(connected)
                sock.settimeout(None)
                while True:
                    readable, _, _ = select.select([sock, remote], [], [], 60)
                    if not readable:
                        return
                    for source in readable:
                        data = source.recv(65536)
                        if not data:
                            return
                        (remote if source is sock else sock).sendall(data)
        except (OSError, EOFError, ValueError, AssertionError) as error:
            print(type(error).__name__, flush=True)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    stats = ThreadingHTTPServer(('127.0.0.1', 19844), Stats)
    threading.Thread(target=stats.serve_forever, daemon=True).start()
    for kind, port in [('http', 19841), ('socks', 19842)]:
        server = Server(('127.0.0.1', port), Handler)
        server.kind = kind
        threading.Thread(target=server.serve_forever, daemon=True).start()
    print('ready', flush=True)
    threading.Event().wait()
