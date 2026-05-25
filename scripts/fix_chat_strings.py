# -*- coding: utf-8 -*-
"""Restore Chinese UI strings in Chat.tsx from git HEAD."""
import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CHAT = REPO / "renderer" / "src" / "components" / "Chat.tsx"

head = subprocess.check_output(
    ["git", "-C", str(REPO), "show", "HEAD:renderer/src/components/Chat.tsx"]
).decode("utf-8")

# Extract string literals from HEAD (already correct UTF-8 in git)
def extract(pattern: str, src: str, default: str = "") -> str:
    m = re.search(pattern, src, re.DOTALL)
    return m.group(1) if m else default

S = {
    "diag_plan_summary": extract(r"<summary>([^<]+)</summary>", head),
    "diag_conn_title": extract(r'chat-diag-conn-title">([^<]+)</div>', head),
    "err_prefix": extract(r"const errText = `(\[[^\]]+\])", head) or "[错误]",
    "need_input_default": extract(
        r"typeof msg\.text === 'string' \? msg\.text : '([^']+)'", head
    )
    or "请输入内容",
    "no_protocol": extract(
        r"if \(!sawProtocolPayload\.current\) \{\s*appendAssistant\(\s*'([^']+)'",
        head,
    ),
    "exit_code": extract(r"appendAssistant\(`(\[[^\]]+)", head) + " ${code}]`",
    "plan_title": extract(r'id="chat-plan-title"[^>]*>\s*([^<\n]+)', head),
    "plan_hint": extract(r'className="chat-plan-hint">\s*([^<\n]+)', head),
    "plan_cancel": extract(
        r"cancelPlanConfirm[\s\S]*?>\s*([^<\n]+)\s*</button>", head
    ),
    "plan_ok": extract(r"submitPlanConfirm[\s\S]*?>\s*([^<\n]+)\s*</button>", head),
    "human_title": extract(r'id="chat-human-title"[^>]*>\s*([^<\n]+)', head),
    "human_placeholder": extract(r'placeholder="([^"]+)"', head),
    "human_skip": extract(
        r"cancelHumanInput[\s\S]*?>\s*([^<\n]+)\s*</button>", head
    ),
    "human_submit": extract(
        r"submitHumanInput[\s\S]*?>\s*([^<\n]+)\s*</button>", head
    ),
    "user_role": extract(r"m\.role === 'user' \? '([^']+)'", head) or "你",
    "input_ph": extract(r'placeholder="([^"]+)"\s*\n\s*value=\{input\}', head)
    or "输入你的问题...",
    "run_cancel": extract(r"cancelRun[\s\S]*?>\s*([^<\n]+)\s*</button>", head),
    "send_busy": extract(r"\{busy \? '([^']+)' : '([^']+)'\}", head),
}

# New strings from patch_chat_full.py (not in HEAD)
S["empty_hint"] = "请先在左侧点击「创建新任务」，或选择一条历史任务后再开始对话。"
S["input_ph_task"] = "请先创建或选择任务…"
S["input_ph_normal"] = "输入你的问题..."

text = CHAT.read_text(encoding="utf-8")

replacements = [
    ('<summary>????</summary>', f'<summary>{S["diag_plan_summary"]}</summary>'),
    (
        '<div className="chat-diag-conn-title">????</div>',
        f'<div className="chat-diag-conn-title">{S["diag_conn_title"]}</div>',
    ),
    ("const errText = `[??] ${msg.text}`;", f'const errText = `{S["err_prefix"]} ${{msg.text}}`;'),
    (
        "typeof msg.text === 'string' ? msg.text : '??????';",
        f"typeof msg.text === 'string' ? msg.text : '{S['need_input_default']}';",
    ),
    (
        "'??????????????????????????????? LLM ??????????????????? stderr?'",
        f"'{S['no_protocol']}'",
    ),
    (
        "appendAssistant(`[????? ${code}]`);",
        f"appendAssistant(`{S['exit_code']}`);",
    ),
    (
        '<div id="chat-plan-title" className="chat-human-title">\n                            ???????\n                        </div>',
        f'<div id="chat-plan-title" className="chat-human-title">\n                            {S["plan_title"]}\n                        </div>',
    ),
    (
        '<p className="chat-plan-hint">\n                            ??????????????????????????????\n                        </p>',
        f'<p className="chat-plan-hint">\n                            {S["plan_hint"]}\n                        </p>',
    ),
    (
        'onClick={cancelPlanConfirm}\n                            >\n                                ??\n                            </button>',
        'onClick={cancelPlanConfirm}\n                            >\n                                '
        + S["plan_cancel"]
        + "\n                            </button>",
    ),
    (
        'onClick={submitPlanConfirm}\n                            >\n                                ????\n                            </button>',
        'onClick={submitPlanConfirm}\n                            >\n                                '
        + S["plan_ok"]
        + "\n                            </button>",
    ),
    (
        '<div id="chat-human-title" className="chat-human-title">\n                            ???????\n                        </div>',
        f'<div id="chat-human-title" className="chat-human-title">\n                            {S["human_title"]}\n                        </div>',
    ),
    (
        'placeholder="????????Enter ???Shift+Enter ???Esc ???"',
        f'placeholder="{S["human_placeholder"]}"',
    ),
    (
        'onClick={cancelHumanInput}\n                            >\n                                ?????????\n                            </button>',
        'onClick={cancelHumanInput}\n                            >\n                                '
        + S["human_skip"]
        + "\n                            </button>",
    ),
    (
        'onClick={submitHumanInput}\n                            >\n                                ??\n                            </button>',
        'onClick={submitHumanInput}\n                            >\n                                '
        + S["human_submit"]
        + "\n                            </button>",
    ),
    (
        '<div className="chat-empty-hint">\n                        ???????????????????????????????\n                    </div>',
        f'<div className="chat-empty-hint">\n                        {S["empty_hint"]}\n                    </div>',
    ),
    ("{m.role === 'user' ? '?' : 'AI'}", f"{{m.role === 'user' ? '{S['user_role']}' : 'AI'}}"),
    (
        "needsTaskSelection\n                                ? '??????????'\n                                : '??????...'",
        f"needsTaskSelection\n                                ? '{S['input_ph_task']}'\n                                : '{S['input_ph_normal']}'",
    ),
    (
        'onClick={cancelRun}\n                            >\n                                ??\n                            </button>',
        'onClick={cancelRun}\n                            >\n                                '
        + S["run_cancel"]
        + "\n                            </button>",
    ),
    (
        "{busy ? '???????????' : '??'}",
        f"{{busy ? '{S['send_busy'][0]}' : '{S['send_busy'][1]}'}}",
    ),
]

for old, new in replacements:
    if old not in text:
        print("MISSING:", old[:60])
    else:
        text = text.replace(old, new, 1)

# Fix corrupted comment lines
text = text.replace(
    "/** ? local-llm-engine `toolcall.think` ? `logger.info(f\"? {self.name}'s thoughts: ...\")` ?? */",
    "/** 与 local-llm-engine `toolcall.think` 中 `logger.info(f\"✨ {self.name}'s thoughts: ...\")` 对齐 */",
)

CHAT.write_text(text, encoding="utf-8")
print("done")
