"""将 loguru 日志批量上传到 yolk-cloud，按登录用户写入 DB。"""

from __future__ import annotations

import atexit
import os
import queue
import threading
from datetime import timezone
from typing import Any

import requests

_API_URL_ENV = "YOLK_API_URL"
_TOKEN_ENV = "YOLK_AUTH_TOKEN"
_SESSION_ENV = "YOLK_LOG_SESSION_ID"
_DEFAULT_API_URL = "http://localhost:8080"


class _CloudLogBatcher:
    def __init__(self, batch_size: int = 25, flush_interval_sec: float = 2.0) -> None:
        self._batch_size = batch_size
        self._flush_interval = flush_interval_sec
        self._queue: queue.Queue[dict[str, Any]] = queue.Queue()
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._worker = threading.Thread(
            target=self._run, daemon=True, name="yolk-cloud-log-flush"
        )
        self._worker.start()
        atexit.register(self.close)

    def write(self, message) -> None:
        record = message.record
        logged_at = (
            record["time"]
            .astimezone(timezone.utc)
            .strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]
            + "Z"
        )
        self._queue.put(
            {
                "level": record["level"].name,
                "message": str(record["message"]),
                "loggerName": record["name"] or "",
                "functionName": record["function"] or "",
                "lineNo": int(record["line"] or 0),
                "loggedAt": logged_at,
            }
        )
        if self._queue.qsize() >= self._batch_size:
            self.flush()

    def flush(self) -> None:
        with self._lock:
            self._send_batch()

    def close(self) -> None:
        self._stop.set()
        with self._lock:
            self._send_batch(drain_all=True)
        self._worker.join(timeout=3.0)

    def _run(self) -> None:
        while not self._stop.wait(self._flush_interval):
            self.flush()

    def _send_batch(self, drain_all: bool = False) -> None:
        token = (os.environ.get(_TOKEN_ENV) or "").strip()
        if not token:
            while True:
                try:
                    self._queue.get_nowait()
                except queue.Empty:
                    break
            return

        entries: list[dict[str, Any]] = []
        limit = 200 if drain_all else self._batch_size
        while len(entries) < limit:
            try:
                entries.append(self._queue.get_nowait())
            except queue.Empty:
                break

        if not entries:
            return

        api_url = (os.environ.get(_API_URL_ENV) or _DEFAULT_API_URL).rstrip("/")
        session_id = (os.environ.get(_SESSION_ENV) or "").strip() or None
        payload: dict[str, Any] = {"sessionId": session_id, "entries": entries}

        try:
            requests.post(
                f"{api_url}/api/logs/batch",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
        except Exception:
            pass


_batcher: _CloudLogBatcher | None = None


def cloud_log_sink(message) -> None:
    global _batcher
    if _batcher is None:
        _batcher = _CloudLogBatcher()
    _batcher.write(message)


def flush_cloud_logs() -> None:
    if _batcher is not None:
        _batcher.flush()
