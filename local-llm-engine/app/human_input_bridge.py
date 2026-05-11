"""Yolk/Electron: emit need_input on stdout, resume when stdin delivers JSON with matching id."""

from __future__ import annotations

import asyncio
import json
import sys
import uuid
from typing import Dict, Optional

_futures: Dict[str, asyncio.Future] = {}


def deliver_input(req_id: str, data: Optional[str]) -> bool:
    """
    Called from the stdin reader thread when a line like
    {"id": "<req_id>", "data": "..."} is received. Thread-safe.
    """
    fut = _futures.pop(req_id, None)
    if fut is None or fut.done():
        return False
    loop = fut.get_loop()
    text = "" if data is None else str(data)

    def _complete() -> None:
        if not fut.done():
            fut.set_result(text)

    loop.call_soon_threadsafe(_complete)
    return True


async def prompt_user(text: str) -> str:
    """Print need_input protocol line, then await the user's reply from Electron."""
    loop = asyncio.get_running_loop()
    req_id = str(uuid.uuid4())
    fut = loop.create_future()
    _futures[req_id] = fut
    line = json.dumps(
        {"type": "need_input", "id": req_id, "text": text},
        ensure_ascii=False,
    )
    print(line, flush=True)
    try:
        return str(await fut).strip()
    finally:
        _futures.pop(req_id, None)
