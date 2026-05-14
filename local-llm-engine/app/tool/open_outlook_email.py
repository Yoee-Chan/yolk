"""使用 Outlook 桌面版打开新邮件撰写窗口（不自动发送）。"""

import asyncio
import os
import shutil
import subprocess
import sys
import urllib.parse
from typing import Optional

from app.tool.base import BaseTool

_OUTLOOK_CANDIDATES = (
    r"C:\Program Files\Microsoft Office\root\Office16\OUTLOOK.EXE",
    r"C:\Program Files (x86)\Microsoft Office\root\Office16\OUTLOOK.EXE",
    r"C:\Program Files\Microsoft Office\Office16\OUTLOOK.EXE",
    r"C:\Program Files (x86)\Microsoft Office\Office16\OUTLOOK.EXE",
)


def _find_outlook_exe() -> Optional[str]:
    which = shutil.which("OUTLOOK.EXE") or shutil.which("outlook")
    if which and os.path.isfile(which):
        return which
    for p in _OUTLOOK_CANDIDATES:
        if os.path.isfile(p):
            return p
    return None


def _build_mailto(to: str, subject: str, body: str) -> str:
    to = (to or "").strip()
    q = urllib.parse.urlencode(
        {"subject": subject or "", "body": body or ""},
        quote_via=urllib.parse.quote,
    )
    if to:
        return f"mailto:{to}?{q}"
    return f"mailto:?{q}"


def _open_mailto_windows(mailto: str) -> None:
    os.startfile(mailto)


def _launch_blank_outlook(outlook_exe: str) -> None:
    subprocess.Popen(
        [outlook_exe, "/c", "ipm.note"],
        close_fds=True,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


class OpenOutlookEmail(BaseTool):
    """打开 Outlook 撰写界面，供用户自行发送。"""

    name: str = "open_outlook_email"
    description: str = (
        "在 Windows 上使用 Microsoft Outlook 打开「新邮件」撰写窗口；不会自动发送，仅打开界面由用户确认后发送。"
        "适合「帮我打开邮件写一下」「用 Outlook 发邮件」等需求：无收件人/主题/正文时直接启动 Outlook 空白新邮件；"
        "若提供收件人、主题或正文，则通过 mailto 预填（需将 Outlook 设为 Windows 默认电子邮件应用）。"
    )
    parameters: dict = {
        "type": "object",
        "properties": {
            "to": {
                "type": "string",
                "description": "收件人邮箱；多个地址用英文逗号分隔。可不填。",
            },
            "subject": {
                "type": "string",
                "description": "邮件主题。可不填。",
            },
            "body": {
                "type": "string",
                "description": "邮件正文（纯文本）。可不填。",
            },
        },
        "required": [],
    }

    async def execute(
        self,
        to: str = "",
        subject: str = "",
        body: str = "",
    ) -> str:
        if sys.platform != "win32":
            return (
                "open_outlook_email 仅支持在 Windows 上使用 Outlook 桌面版。"
                "当前系统不是 Windows，未执行任何操作。"
            )

        to = to or ""
        subject = subject or ""
        body = body or ""
        has_prefill = bool(to.strip() or subject.strip() or body.strip())
        exe = _find_outlook_exe()

        def run() -> None:
            if not has_prefill and exe:
                _launch_blank_outlook(exe)
            else:
                _open_mailto_windows(_build_mailto(to, subject, body))

        try:
            await asyncio.to_thread(run)
        except OSError as e:
            return f"无法打开邮件客户端: {e}"

        if not has_prefill and exe:
            return "已在 Outlook 中打开新的空白撰写窗口；请在 Outlook 中编辑并手动发送。"
        if has_prefill:
            return (
                "已通过 mailto 打开撰写窗口并预填内容。"
                "若打开的不是 Outlook，请在 Windows「设置 → 应用 → 默认应用」中将 Outlook 设为「电子邮件」默认程序。"
            )
        return (
            "未在常见安装路径找到 OUTLOOK.EXE，已用系统默认邮件程序打开撰写窗口。"
            "建议安装 Outlook 或将 Outlook 设为默认邮件应用以便固定使用 Outlook。"
        )
