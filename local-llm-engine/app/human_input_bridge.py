"""Yolk/Electron: emit need_input on stdout, resume when stdin delivers JSON with matching id."""

from __future__ import annotations

import asyncio
import json
import sys
import uuid
from typing import Dict, Optional

_futures: Dict[str, asyncio.Future] = {}

# 与前端 Chat 约定：计划确认弹窗仅发送这两种 data
PLAN_DECISION_CONFIRM = "__PLAN_CONFIRM__"
PLAN_DECISION_CANCEL = "__PLAN_CANCEL__"


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


async def wait_plan_confirm(plan_text: str) -> bool:
    """
    在 stdout 发出 need_plan_confirm，等待 stdin 一行 JSON：
    {"id": "<同上>", "data": "__PLAN_CONFIRM__"} 或 __PLAN_CANCEL__。
    返回 True 表示用户确认执行，False 表示取消（不执行任何后续步骤）。
    """
    loop = asyncio.get_running_loop()
    req_id = str(uuid.uuid4())
    fut = loop.create_future()
    _futures[req_id] = fut
    line = json.dumps(
        {"type": "need_plan_confirm", "id": req_id, "text": plan_text},
        ensure_ascii=False,
    )
    print(line, flush=True)
    try:
        data = str(await fut).strip()
        return data == PLAN_DECISION_CONFIRM
    finally:
        _futures.pop(req_id, None)
