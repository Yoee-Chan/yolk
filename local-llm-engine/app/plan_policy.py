"""When to show the execution-plan confirmation modal before starting the agent."""

from __future__ import annotations

import re

_SECTION_TITLES = (
    "执行计划",
    "所需权限与数据访问",
    "将使用的程序或应用",
    "是否需要确认执行",
)

# Obvious greetings / small talk — skip planner + plan modal.
_CHAT_ONLY_RE = re.compile(
    r"^(?:你好|您好|嗨|hi|hello|hey|谢谢|感谢|thanks|thank you|"
    r"再见|拜拜|bye|好的|嗯|哦|ok|okay|在吗|你是谁|你能做什么)"
    r"[\s!?！？。~～，,。.]*$",
    re.IGNORECASE,
)


def user_task_is_chat_only(user_task: str) -> bool:
    text = (user_task or "").strip()
    if not text or len(text) > 48:
        return False
    return bool(_CHAT_ONLY_RE.match(text))


def _extract_section(plan_text: str, title: str) -> str:
    pattern = rf"##\s*{re.escape(title)}\s*\n(.*?)(?=\n##\s|\Z)"
    m = re.search(pattern, plan_text or "", re.DOTALL | re.IGNORECASE)
    return (m.group(1).strip() if m else "")


def _section_is_none(content: str) -> bool:
    if not content:
        return True
    lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
    if not lines:
        return True
    head = lines[0]
    if re.match(r"^(无|暂无|不需要|无需|none|n/a)\b", head, re.IGNORECASE):
        return True
    if head in ("无", "暂无", "不需要", "无需"):
        return True
    return False


def plan_needs_user_confirm(plan_text: str) -> bool:
    """
    True when the plan indicates workspace/tool permissions or concrete executable steps.
    """
    text = (plan_text or "").strip()
    if not text:
        return False

    flag = _extract_section(text, "是否需要确认执行")
    if flag:
        head = flag.splitlines()[0].strip().lower()
        if re.match(r"^(是|yes|true|需要)\b", head):
            return True
        if re.match(r"^(否|no|false|不需要|无需)\b", head):
            return False

    perm = _extract_section(text, "所需权限与数据访问")
    apps = _extract_section(text, "将使用的程序或应用")
    plan = _extract_section(text, "执行计划")

    if not _section_is_none(perm):
        return True
    if not _section_is_none(apps):
        return True
    if not _section_is_none(plan):
        return True
    return False
