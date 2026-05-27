"""Apply risk.json settings (risk_level, confirm_strategy) before tool execution."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional

# Tools that never need a pre-execution confirmation gate.
_SKIP_CONFIRM_TOOLS = frozenset({"ask_human", "terminate"})

# Already require explicit user approval in chat before calling (see manus prompts).
_CHAT_CONFIRMED_TOOLS = frozenset(
    {
        "open_outlook_email",
        "jira_create_issue",
        "wechat_draft_article",
        "wechat_publish_article",
    }
)

_APPROVE_TOKENS = frozenset(
    {
        "确认",
        "继续",
        "同意",
        "是",
        "好",
        "可以",
        "yes",
        "y",
        "ok",
        "okay",
        "proceed",
        "confirm",
    }
)

_BASH_HIGH_RISK = re.compile(
    r"\b(rm|rmdir|del|delete|unlink|mv|move|chmod|chown|dd|mkfs|format|"
    r"shutdown|reboot|kill|pkill|killall|curl.*\|\s*bash|wget.*\|\s*bash|"
    r">\s*/|tee\s+.*/)\b",
    re.IGNORECASE,
)

_config_cache: Optional["RiskConfig"] = None


@dataclass
class RiskConfig:
    risk_level: int = 5
    confirm_strategy: str = "high"  # all | high | llm


def _risk_json_path() -> str:
    return os.environ.get("YOLK_RISK_JSON", "")


def load_risk_config(*, force_reload: bool = False) -> RiskConfig:
    global _config_cache
    if _config_cache is not None and not force_reload:
        return _config_cache

    cfg = RiskConfig()
    path = _risk_json_path()
    if path and os.path.isfile(path):
        try:
            with open(path, encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict):
                level = raw.get("risk_level", cfg.risk_level)
                strategy = raw.get("confirm_strategy", cfg.confirm_strategy)
                cfg.risk_level = max(1, min(10, int(level)))
                if strategy in ("all", "high", "llm"):
                    cfg.confirm_strategy = strategy
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            pass

    _config_cache = cfg
    return cfg


def _confirm_threshold(risk_level: int) -> int:
    """Higher risk_level (更精确) => lower threshold => more confirmations."""
    return max(1, min(10, 11 - int(risk_level)))


def score_tool_risk(tool_name: str, args: Dict[str, Any]) -> int:
    """Return estimated risk 1–10 for a tool invocation."""
    name = (tool_name or "").lower()
    if name in _SKIP_CONFIRM_TOOLS:
        return 1

    if name == "str_replace_editor":
        cmd = str(args.get("command") or "").lower()
        if cmd == "view":
            return 2
        if cmd in ("create", "str_replace", "insert", "undo_edit"):
            return 8
        return 6

    if name == "bash":
        command = str(args.get("command") or "")
        if not command.strip():
            return 2
        if _BASH_HIGH_RISK.search(command):
            return 9
        return 5

    if name == "python_execute":
        code = str(args.get("code") or "")
        if re.search(
            r"\b(os\.remove|shutil\.rmtree|unlink|open\s*\([^)]*['\"]w)",
            code,
            re.IGNORECASE,
        ):
            return 8
        return 6

    if name in ("wechat_publish_article",):
        return 9
    if name in _CHAT_CONFIRMED_TOOLS:
        return 3

    if name == "browser_use_tool" or "browser" in name:
        return 5

    lowered = json.dumps(args, ensure_ascii=False).lower()
    if any(
        k in lowered
        for k in ("delete", "remove", "unlink", "rm ", "write", "drop", "truncate")
    ):
        return 7
    if any(k in name for k in ("delete", "remove", "write", "edit", "patch")):
        return 7

    return 5


def requires_tool_confirmation(
    tool_name: str,
    args: Dict[str, Any],
    cfg: Optional[RiskConfig] = None,
) -> bool:
    cfg = cfg or load_risk_config()
    name = (tool_name or "").lower()
    if name in _SKIP_CONFIRM_TOOLS:
        return False
    if name in _CHAT_CONFIRMED_TOOLS:
        return False

    strategy = cfg.confirm_strategy
    if strategy == "llm":
        return False
    if strategy == "all":
        return True

    score = score_tool_risk(name, args)
    return score >= _confirm_threshold(cfg.risk_level)


def _is_user_approved(reply: str) -> bool:
    text = (reply or "").strip()
    if not text:
        return False
    lower = text.lower()
    if lower in _APPROVE_TOKENS:
        return True
    return any(token in text for token in ("确认", "继续", "同意"))


async def confirm_tool_execution(tool_name: str, args: Dict[str, Any]) -> bool:
    from app.human_input_bridge import prompt_user

    try:
        preview = json.dumps(args, ensure_ascii=False, indent=2)
    except TypeError:
        preview = str(args)
    if len(preview) > 2000:
        preview = preview[:2000] + "\n...(已截断)"

    prompt = (
        f"【操作确认】即将执行工具: {tool_name}\n"
        f"参数:\n{preview}\n\n"
        "请点击「确认执行」继续；点击「取消」将中止本次工具调用。"
    )
    reply = await prompt_user(prompt)
    return _is_user_approved(reply)


def build_system_prompt_addon(cfg: Optional[RiskConfig] = None) -> str:
    """Extra instructions when the LLM decides when to ask the human."""
    cfg = cfg or load_risk_config()
    if cfg.confirm_strategy != "llm":
        return ""

    return (
        "**Human confirmation (risk policy):** The user chose「LLM decides when to ask a human」. "
        "Before irreversible or high-impact actions (deleting or overwriting files, "
        "running destructive shell commands, publishing, sending email, creating external tickets, etc.), "
        "call `ask_human` with a concise summary and wait for approval. "
        f"Current sensitivity level is {cfg.risk_level}/10 (higher = ask more often). "
        "Low-risk read-only steps (e.g. viewing a file) do not require `ask_human` unless uncertain."
    )
