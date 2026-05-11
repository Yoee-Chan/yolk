import os
import sys
import json
import asyncio
import logging
import threading
from typing import Optional
import warnings
from requests import RequestsDependencyWarning
import io

# 强制 stdin/stdout 使用 UTF-8
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8")
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# 屏蔽常见警告
warnings.filterwarnings("ignore", category=RequestsDependencyWarning)
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

# 路径设置
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LLM_ENGINE_DIR = os.path.join(BASE_DIR, "local-llm-engine")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_JSON = os.path.join(SCRIPT_DIR, "llm_config", "workspace.json")
sys.path.insert(0, LLM_ENGINE_DIR)

# 在导入 Manus / browser_use 之前，把标准库日志打到 stderr，避免污染 stdout 协议行
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s [%(name)s] %(message)s",
    stream=sys.stderr,
    force=True,
)

from app.agent.manus import Manus
from app.human_input_bridge import deliver_input


def _chat_step_should_stream(step_result: str) -> bool:
    """Skip tool-observation blobs; stream natural-language turns to the UI."""
    s = (step_result or "").strip()
    if not s or s == "Thinking complete - no action needed":
        return False
    if s.startswith("Observed output of cmd"):
        return False
    return True


def read_run_request() -> tuple[str, list]:
    """读取首行 JSON：event=run, msg=当前用户句, history=可选多轮 [{role, content}, ...]。"""
    line = sys.stdin.readline()
    if not line:
        return "", []
    try:
        payload = json.loads(line)
    except json.JSONDecodeError:
        return "", []
    if payload.get("event") != "run":
        return "", []
    user_task = (payload.get("msg") or "").strip()
    history = payload.get("history") or []
    if not isinstance(history, list):
        history = []
    return user_task, history


def _format_chat_history(history: list) -> str:
    if not history:
        return ""
    lines: list[str] = []
    for item in history[-40:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if content is None or not str(content).strip():
            continue
        if role == "user":
            lines.append(f"User: {content}")
        elif role == "assistant":
            lines.append(f"Assistant: {content}")
    if not lines:
        return ""
    return (
        "Prior messages in this chat session (most recent last). "
        "Continue naturally; the user's latest message is after this block.\n\n"
        + "\n\n".join(lines)
        + "\n\n---\n"
    )


def handle_stdin():
    """监听前端后续输入（need_input / AskHuman）"""
    for line in sys.stdin:
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        req_id = msg.get("id")
        if req_id and deliver_input(req_id, msg.get("data")):
            continue


async def init_application(prompt: str):
    """调用大模型"""
    agent = await Manus.create()
    streamed_any = False

    def on_step(step_result: str):
        nonlocal streamed_any
        if not _chat_step_should_stream(step_result):
            return
        streamed_any = True
        print(
            json.dumps(
                {"type": "stream", "text": step_result + "\n\n"},
                ensure_ascii=False,
            )
        )
        sys.stdout.flush()

    try:
        result = await agent.run(prompt, on_step=on_step)
        if streamed_any:
            print(json.dumps({"type": "done"}, ensure_ascii=False))
        else:
            print(json.dumps({"type": "result", "text": result}, ensure_ascii=False))
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({"type": "error", "text": str(e)}, ensure_ascii=False))
        sys.stdout.flush()
    finally:
        await agent.cleanup()


async def main(user_task: str, history: Optional[list] = None):
    if history is None:
        history = []
    if not user_task:
        print(
            json.dumps(
                {"type": "error", "text": "Empty user message"},
                ensure_ascii=False,
            )
        )
        sys.stdout.flush()
        return

    try:
        with open(WORKSPACE_JSON, "r", encoding="utf-8") as f:
            workspace_data = f.read()
    except OSError as e:
        print(
            json.dumps(
                {"type": "error", "text": f"Cannot read workspace.json: {e}"},
                ensure_ascii=False,
            )
        )
        sys.stdout.flush()
        return

    workspace_json_repr = json.dumps(WORKSPACE_JSON, ensure_ascii=False)
    history_block = _format_chat_history(history)
    base = f"""
    You must restrict all operations to the workspace defined in the JSON file at:
    {workspace_json_repr}

    This JSON file contains all workspace information, including root directory, subfolders, and permissions.
    Do not attempt to scan, list, or access any other directories or files outside of this workspace.
    Do not infer or assume additional paths. Only rely on the JSON content provided.
    Rules:
    1. All operations (listing, creating, editing, searching) must be limited to the paths defined in workspace.json.
    2. If a request involves a file or folder, check against workspace.json before responding.
    3. If the requested path is not in workspace.json, respond with "Access denied: outside workspace".
    4. Do not attempt to access system files, project source code, or any directories not explicitly listed in workspace.json.
    5. Treat workspace.json as the single source of truth for workspace structure and permissions.
    Your role:
    - Use workspace.json to understand available directories and permissions.
    - Perform reasoning and generate responses only within the defined workspace.
    - Never attempt to scan or describe unrelated files in the current project.
    Workspace data:
    {workspace_data}

"""
    prompt = base + history_block + "\nCurrent user message:\n" + user_task
    await init_application(prompt)


if __name__ == "__main__":
    user_task, history = read_run_request()
    threading.Thread(target=handle_stdin, daemon=True, name="stdin-bridge").start()
    asyncio.get_event_loop().run_until_complete(main(user_task, history))
