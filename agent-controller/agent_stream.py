import os
import sys
import json
import asyncio
import logging
import queue
import threading
from typing import Optional, Tuple
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

# 路径设置（PyInstaller 单文件：资源在 sys._MEIPASS；开发模式仍用源码目录下的 llm_config）
if getattr(sys, "frozen", False):
    SCRIPT_DIR = sys._MEIPASS
    BASE_DIR = os.path.dirname(sys.executable)
else:
    _here = os.path.dirname(os.path.abspath(__file__))
    SCRIPT_DIR = _here
    BASE_DIR = os.path.abspath(os.path.join(_here, ".."))

LLM_ENGINE_DIR = os.path.join(BASE_DIR, "local-llm-engine")
WORKSPACE_JSON = os.path.join(SCRIPT_DIR, "llm_config", "workspace.json")
os.environ.setdefault(
    "YOLK_JIRA_CONNECTOR_JSON",
    os.path.join(SCRIPT_DIR, "llm_config", "jira_connector.json"),
)
os.environ.setdefault(
    "YOLK_WECHAT_CONNECTOR_JSON",
    os.path.join(SCRIPT_DIR, "llm_config", "wechat_connector.json"),
)
if not getattr(sys, "frozen", False):
    sys.path.insert(0, LLM_ENGINE_DIR)

# 在导入 Manus / browser_use 之前，把标准库日志打到 stderr，避免污染 stdout 协议行
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s [%(name)s] %(message)s",
    stream=sys.stderr,
    force=True,
)

# PyPI 包名为 daytona_sdk，引擎内仍使用 `import daytona`
try:
    import daytona_sdk

    sys.modules.setdefault("daytona", daytona_sdk)
except ImportError:
    pass

from app.agent.manus import Manus
from app.human_input_bridge import deliver_input, wait_plan_confirm
from app.llm import LLM
from app.schema import Message


def _chat_step_should_stream(step_result: str) -> bool:
    """Skip tool-observation blobs; stream natural-language turns to the UI."""
    s = (step_result or "").strip()
    if not s or s == "Thinking complete - no action needed":
        return False
    if s.startswith("Observed output of cmd"):
        return False
    return True


# 只能有一个线程读 sys.stdin；原先主线程 readline 与后台 for stdin 抢同一管道，会导致 run 行丢失、界面永远卡住。
_RUN_QUEUE = queue.Queue()


def _stdin_router() -> None:
    """单线程读 stdin：人类输入（need_input / need_plan_confirm）、其余 event=run 放入队列。"""
    for line in sys.stdin:
        raw = line.strip()
        if not raw:
            continue
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if not isinstance(msg, dict):
            continue
        # 前端回复 need_input / ask_human
        if msg.get("id") is not None:
            if deliver_input(str(msg["id"]), msg.get("data")):
                continue
        if msg.get("event") == "run":
            _RUN_QUEUE.put(msg)
    _RUN_QUEUE.put(None)


def read_run_request() -> Optional[Tuple[str, list]]:
    """从路由队列取一条 run 事件。stdin 关闭时返回 None。"""
    payload = _RUN_QUEUE.get()
    if payload is None:
        return None
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


_PLANNER_SYSTEM = """你是任务规划师，只做「规划与说明」，不要执行任何工具、不要写代码、不要假装已完成操作。
请根据用户的当前请求与会话摘要，用简体中文输出 Markdown，且必须包含以下小节（若无内容则写「无」）：
## 执行计划
（分步骤、可检查；若需求不清，列出合理假设并标注「待确认」）
## 所需权限与数据访问
（例如：读/写工作区内哪些路径、是否需要网络、浏览器、终端、外部应用等）
## 将使用的程序或应用
（例如：Python、浏览器自动化、Outlook、MCP 工具名等；没有则写「无」）

约束：不得编造用户未要求的操作；保持与工作区规则一致。除上述结构外不要输出多余客套话。"""


async def _generate_execution_plan(
    workspace_data: str,
    workspace_json_repr: str,
    history_block: str,
    user_task: str,
) -> str:
    user_blob = f"""工作区配置文件路径（只读引用）: {workspace_json_repr}

工作区 JSON 内容摘要（遵守其中路径与权限）:
{workspace_data}

{history_block}

用户当前任务:
{user_task}
"""
    llm = LLM()
    return await llm.ask(
        [Message.user_message(user_blob.strip())],
        system_msgs=[Message.system_message(_PLANNER_SYSTEM)],
        stream=False,
        temperature=0.3,
    )


async def init_application(prompt: str):
    """调用大模型"""
    agent = await Manus.create()
    # 给前端一条可见进度（stdout 协议），避免只看到 Daytona/MCP 日志却以为未请求模型
    print(
        json.dumps(
            {
                "type": "stream",
                "text": "[系统] Agent 已就绪，正在请求语言模型…\n",
            },
            ensure_ascii=False,
        )
    )
    sys.stdout.flush()

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
    print(
        json.dumps(
            {
                "type": "stream",
                "text": "[系统] 正在生成执行计划、所需权限与将使用的应用（尚未执行任何操作）…\n",
            },
            ensure_ascii=False,
        )
    )
    sys.stdout.flush()

    try:
        plan_text = await _generate_execution_plan(
            workspace_data, workspace_json_repr, history_block, user_task
        )
    except Exception as e:
        logging.exception("生成执行计划失败")
        print(
            json.dumps(
                {"type": "error", "text": f"生成执行计划失败: {e}"},
                ensure_ascii=False,
            )
        )
        sys.stdout.flush()
        return

    plan_text = (plan_text or "").strip()
    if not plan_text:
        print(
            json.dumps(
                {"type": "error", "text": "模型未返回有效执行计划"},
                ensure_ascii=False,
            )
        )
        sys.stdout.flush()
        return

    approved = await wait_plan_confirm(plan_text)
    if not approved:
        print(
            json.dumps(
                {
                    "type": "stream",
                    "text": "[系统] 你已取消执行，未启动智能体，也未调用任何工具。\n",
                },
                ensure_ascii=False,
            )
        )
        sys.stdout.flush()
        print(json.dumps({"type": "done"}, ensure_ascii=False))
        sys.stdout.flush()
        return

    print(
        json.dumps(
            {
                "type": "stream",
                "text": "[系统] 已确认计划，正在启动 Agent 按步骤执行…\n",
            },
            ensure_ascii=False,
        )
    )
    sys.stdout.flush()

    approved_block = f"""
---
【用户已确认的执行计划】以下计划经用户确认后执行。请严格按计划推进；不得超出已确认范围擅自扩大任务。若执行中必须偏离计划，须先通过 ask_human 向用户说明原因并征求意见。

{plan_text}
---
"""
    prompt = (
        base
        + history_block
        + approved_block
        + "\nCurrent user message:\n"
        + user_task
    )
    await init_application(prompt)


if __name__ == "__main__":
    threading.Thread(
        target=_stdin_router, daemon=True, name="stdin-router"
    ).start()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        while True:
            req = read_run_request()
            if req is None:
                break
            user_task, history = req
            loop.run_until_complete(main(user_task, history))
    finally:
        loop.close()
