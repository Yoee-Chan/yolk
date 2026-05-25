# -*- coding: utf-8 -*-
from pathlib import Path

CHAT = Path(__file__).resolve().parents[1] / "renderer" / "src" / "components" / "Chat.tsx"

# UI strings as Unicode escapes (encoding-safe)
UI = {
    "comment_thoughts": (
        "/** \\u4e0e local-llm-engine `toolcall.think` \\u4e2d "
        "`logger.info(f\\\"\\u2728 {self.name}'s thoughts: ...\\\")` \\u5bf9\\u9f50 */"
    ),
    "diag_plan": "\\u6a21\\u578b\\u8ba1\\u5212",
    "diag_conn": "\\u8fde\\u63a5\\u4fe1\\u606f",
    "err_prefix": "\\u9519\\u8bef",
    "need_input_default": "\\u8bf7\\u8f93\\u5165\\u5185\\u5bb9",
    "no_protocol": (
        "\\u672c\\u6b21\\u8fd0\\u884c\\u6ca1\\u6709\\u5728\\u8f93\\u51fa\\u91cc\\u6536\\u5230"
        "\\u6a21\\u578b\\u7ed3\\u679c\\uff08\\u53ea\\u6709\\u65e5\\u5fd7\\u65f6\\u4f1a\\u88ab\\u5ffd"
        "\\u7565\\uff09\\u3002\\u8bf7\\u786e\\u8ba4 LLM \\u914d\\u7f6e\\u4e0e\\u7f51\\u7edc\\uff0c"
        "\\u6216\\u67e5\\u770b\\u5f00\\u53d1\\u8005\\u5de5\\u5177\\u91cc\\u4e3b\\u8fdb\\u7a0b\\u7684 stderr\\u3002"
    ),
    "exit_code_prefix": "\\u8fdb\\u7a0b\\u9000\\u51fa\\u7801",
    "plan_title": "\\u8bf7\\u786e\\u8ba4\\u6267\\u884c\\u8ba1\\u5212",
    "plan_hint": (
        "\\u786e\\u8ba4\\u540e\\u5c06\\u542f\\u52a8\\u667a\\u80fd\\u4f53\\u5e76\\u6309\\u8ba1\\u5212"
        "\\u8c03\\u7528\\u5de5\\u5177\\uff1b\\u53d6\\u6d88\\u5219\\u4e0d\\u4f1a\\u6267\\u884c\\u4efb\\u4f55\\u64cd\\u4f5c\\u3002"
    ),
    "cancel": "\\u53d6\\u6d88",
    "plan_ok": "\\u786e\\u8ba4\\u6267\\u884c",
    "human_title": "\\u667a\\u80fd\\u4f53\\u8bf7\\u6c42\\u8f93\\u5165",
    "human_ph": (
        "\\u5728\\u6b64\\u8f93\\u5165\\u56de\\u590d\\u2026\\uff08Enter \\u63d0\\u4ea4\\uff0cShift+Enter "
        "\\u6362\\u884c\\uff0cEsc \\u53d6\\u6d88\\uff09"
    ),
    "human_skip": "\\u8df3\\u8fc7\\uff08\\u53d1\\u9001\\u7a7a\\u5185\\u5bb9\\uff09",
    "submit": "\\u63d0\\u4ea4",
    "empty_hint": (
        "\\u8bf7\\u5148\\u5728\\u5de6\\u4fa7\\u70b9\\u51fb\\u300c\\u521b\\u5efa\\u65b0\\u4efb\\u52a1\\u300d"
        "\\uff0c\\u6216\\u9009\\u62e9\\u4e00\\u6761\\u5386\\u53f2\\u4efb\\u52a1\\u540e\\u518d\\u5f00\\u59cb\\u5bf9\\u8bdd\\u3002"
    ),
    "user_role": "\\u4f60",
    "ph_task": "\\u8bf7\\u5148\\u521b\\u5efa\\u6216\\u9009\\u62e9\\u4efb\\u52a1\\u2026",
    "ph_normal": "\\u8f93\\u5165\\u4f60\\u7684\\u95ee\\u9898...",
    "send_busy": "\\u53d1\\u9001\\uff08\\u5c06\\u4e2d\\u65ad\\u5f53\\u524d\\u4efb\\u52a1\\uff09",
    "send": "\\u53d1\\u9001",
}

def u(key: str) -> str:
    return UI[key].encode().decode("unicode_escape")


text = CHAT.read_text(encoding="utf-8")

# Fix broken comment
import re

text = re.sub(
    r"/\*\*.*?\*/\s*\nfunction parseThoughtsFromLogLine",
    u("comment_thoughts") + "\nfunction parseThoughtsFromLogLine",
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    r"<summary>[^<]*</summary>",
    f"<summary>{u('diag_plan')}</summary>",
    text,
    count=1,
)
text = re.sub(
    r'className="chat-diag-conn-title">[^<]*</div>',
    f'className="chat-diag-conn-title">{u("diag_conn")}</div>',
    text,
    count=1,
)
text = re.sub(
    r"const errText = `\[[^\]]*\] \$\{msg\.text\}`;",
    f"const errText = `[{u('err_prefix')}] ${{msg.text}}`;",
    text,
    count=1,
)
text = re.sub(
    r"typeof msg\.text === 'string' \? msg\.text : '[^']*';",
    f"typeof msg.text === 'string' ? msg.text : '{u('need_input_default')}';",
    text,
    count=1,
)
text = re.sub(
    r"if \(!sawProtocolPayload\.current\) \{\s*appendAssistant\(\s*'[^']*'\s*\);",
    f"if (!sawProtocolPayload.current) {{\n                    appendAssistant(\n                        '{u('no_protocol')}'\n                    );",
    text,
    count=1,
    flags=re.DOTALL,
)
text = re.sub(
    r"appendAssistant\(`\[[^\]]*\] \$\{code\}\]`\);",
    f"appendAssistant(`[{u('exit_code_prefix')}] ${{code}}`);",
    text,
    count=1,
)

# Plan confirm block
text = re.sub(
    r'(<div id="chat-plan-title" className="chat-human-title">\s*)[^<\n]+',
    rf"\1{u('plan_title')}",
    text,
    count=1,
)
text = re.sub(
    r'(<p className="chat-plan-hint">\s*)[^<\n]+',
    rf"\1{u('plan_hint')}",
    text,
    count=1,
)

# Plan buttons: first cancel, then confirm
plan_block = re.search(
    r"pendingPlanConfirm \? \([\s\S]*?\) : pendingHumanInput",
    text,
)
if plan_block:
    block = plan_block.group(0)
    block = re.sub(
        r"(onClick=\{cancelPlanConfirm\}[\s\S]*?>)\s*[^<\n]+(\s*</button>)",
        rf"\1\n                                {u('cancel')}\2",
        block,
        count=1,
    )
    block = re.sub(
        r"(onClick=\{submitPlanConfirm\}[\s\S]*?>)\s*[^<\n]+(\s*</button>)",
        rf"\1\n                                {u('plan_ok')}\2",
        block,
        count=1,
    )
    text = text[: plan_block.start()] + block + text[plan_block.end() :]

# Human input block
text = re.sub(
    r'(<div id="chat-human-title" className="chat-human-title">\s*)[^<\n]+',
    rf"\1{u('human_title')}",
    text,
    count=1,
)
text = re.sub(
    r'placeholder="[^"]*"\s*\n\s*/>\s*\n\s*<div className="chat-human-actions">',
    f'placeholder="{u("human_ph")}"\n                        />\n                        <div className="chat-human-actions">',
    text,
    count=1,
)

human_block = re.search(
    r"pendingHumanInput \? \([\s\S]*?\) : null\}",
    text,
)
if human_block:
    block = human_block.group(0)
    block = re.sub(
        r"(onClick=\{cancelHumanInput\}[\s\S]*?>)\s*[^<\n]+(\s*</button>)",
        rf"\1\n                                {u('human_skip')}\2",
        block,
        count=1,
    )
    block = re.sub(
        r"(onClick=\{submitHumanInput\}[\s\S]*?>)\s*[^<\n]+(\s*</button>)",
        rf"\1\n                                {u('submit')}\2",
        block,
        count=1,
    )
    text = text[: human_block.start()] + block + text[human_block.end() :]

text = re.sub(
    r'(<div className="chat-empty-hint">\s*)[^<\n]+',
    rf"\1{u('empty_hint')}",
    text,
    count=1,
)
text = re.sub(
    r"\{m\.role === 'user' \? '[^']*' : 'AI'\}",
    f"{{m.role === 'user' ? '{u('user_role')}' : 'AI'}}",
    text,
    count=1,
)
text = re.sub(
    r"needsTaskSelection\s*\n\s*\? '[^']*'\s*\n\s*: '[^']*'",
    f"needsTaskSelection\n                                ? '{u('ph_task')}'\n                                : '{u('ph_normal')}'",
    text,
    count=1,
)
text = re.sub(
    r"(onClick=\{cancelRun\}[\s\S]*?>)\s*[^<\n]+(\s*</button>)",
    rf"\1\n                                {u('cancel')}\2",
    text,
    count=1,
)
text = re.sub(
    r"\{busy \? '[^']*' : '[^']*'\}",
    f"{{busy ? '{u('send_busy')}' : '{u('send')}'}}",
    text,
    count=1,
)

# Fix syntax typo from partial replace
text = text.replace("appendAssistant(`[错误 ${code}]``);", f"appendAssistant(`[{u('exit_code_prefix')}] ${{code}}`);")
text = text.replace("appendAssistant(`[é”™è¯¯ ${code}]``);", f"appendAssistant(`[{u('exit_code_prefix')}] ${{code}}`);")

# User role label (not CSS class)
text = re.sub(
    r"\{m\.role === 'user' \? '[^']*' : 'AI'\}",
    f"{{m.role === 'user' ? '{u('user_role')}' : 'AI'}}",
    text,
    count=1,
)

CHAT.write_text(text, encoding="utf-8")
print("fixed", CHAT)
