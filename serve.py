#!/usr/bin/env python3
"""Tiny static dev server with HTTP byte-range support.

Python's `http.server` answers every video Range request with a full 200. Chrome
can often play through that, but Safari/iOS (and some TV/embedded browsers) need
206 Partial Content before they will start or loop a local MP4. This server is
drop-in for `python3 -m http.server 8199`, adds ranges and disables dev caching.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import re
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8199


class RangeFile:
    def __init__(self, fh, length):
        self.fh = fh
        self.left = length

    def read(self, n=-1):
        if self.left <= 0:
            return b''
        if n is None or n < 0 or n > self.left:
            n = self.left
        data = self.fh.read(n)
        self.left -= len(data)
        return data

    def close(self):
        self.fh.close()


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()

        size = os.path.getsize(path)
        match = re.match(r'bytes=(\d*)-(\d*)$', self.headers.get('Range', '').strip())
        if not match:
            return super().send_head()

        start = int(match.group(1)) if match.group(1) else 0
        end = int(match.group(2)) if match.group(2) else size - 1
        end = min(end, size - 1)
        if start > end or start >= size:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return None

        fh = open(path, 'rb')
        fh.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Last-Modified', self.date_time_string(os.path.getmtime(path)))
        self.end_headers()
        return RangeFile(fh, end - start + 1)


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f'Playroom dev server on http://localhost:{PORT} (range requests enabled)', flush=True)
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
