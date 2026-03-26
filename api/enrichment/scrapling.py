from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler

from workers.enrichment.main import parse_request
from workers.enrichment.models import WorkerOutput
from workers.enrichment.scrapling_client import crawl_company_website


class handler(BaseHTTPRequestHandler):
    def _read_body(self) -> str:
        content_length = int(self.headers.get("content-length", "0") or "0")
        if content_length <= 0:
            return "{}"
        return self.rfile.read(content_length).decode("utf-8")

    def _write_json(self, status_code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        self._write_json(
            200,
            {
                "ok": True,
                "provider": "scrapling",
                "transport": "http",
            },
        )

    def do_POST(self) -> None:
        try:
            request = parse_request(self._read_body())
            result = crawl_company_website(request)
            self._write_json(200, result.to_dict())
        except Exception as error:  # noqa: BLE001
            failure = WorkerOutput(errors=[str(error)])
            self._write_json(500, failure.to_dict())
