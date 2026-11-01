"""按邮件主题检索邮件，并把附件保存到本地目录。

优先走本机 Outlook 桌面版（PowerShell + COM，无需 pywin32）；
若本机没有经典 Outlook（只装了新版 Outlook / 家庭版 Office 时常见 COM 未注册），
则回退到 IMAP 直连邮箱，账号信息读 `agent-controller/llm_config/mail_account.json`。
"""

import asyncio
import email
import imaplib
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import date, timedelta
from email.header import decode_header
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.tool.base import BaseTool

_AC_ROOT = Path(__file__).resolve().parents[3] / "agent-controller"
_WORKSPACE_JSON = _AC_ROOT / "llm_config" / "workspace.json"
_MAIL_ACCOUNT_JSON = _AC_ROOT / "llm_config" / "mail_account.json"

# 脚本保持纯 ASCII，中文一律通过环境变量传入，避免 PowerShell 读文件时的编码坑。
_PS_SCRIPT = r"""
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$subject   = $env:YOLK_OL_SUBJECT
$saveDir   = $env:YOLK_OL_SAVE_DIR
$daysBack  = [int]$env:YOLK_OL_DAYS
$maxItems  = [int]$env:YOLK_OL_MAX_ITEMS
$includeSub = $env:YOLK_OL_SUBFOLDERS -eq '1'

if ([string]::IsNullOrWhiteSpace($subject)) { throw 'subject keyword is empty' }
if ([string]::IsNullOrWhiteSpace($saveDir)) { throw 'save dir is empty' }
New-Item -ItemType Directory -Force -Path $saveDir | Out-Null

$ol = New-Object -ComObject Outlook.Application
$ns = $ol.GetNamespace('MAPI')
$inbox = $ns.GetDefaultFolder(6)

$folders = @($inbox)
if ($includeSub) {
    foreach ($f in $inbox.Folders) { $folders += $f }
}

$since = (Get-Date).AddDays(-1 * $daysBack)
$matched = 0
$scanned = 0
$saved = New-Object System.Collections.ArrayList

foreach ($folder in $folders) {
    try { $items = $folder.Items } catch { continue }
    try { $items.Sort('[ReceivedTime]', $true) } catch { }
    foreach ($item in $items) {
        $scanned++
        if ($scanned -gt $maxItems) { break }
        try {
            if ($item.Class -ne 43) { continue }
            $rt = $item.ReceivedTime
        } catch { continue }
        if ($rt -lt $since) { break }
        $subj = [string]$item.Subject
        if ($subj -notlike "*$subject*") { continue }
        $matched++
        try { $atts = $item.Attachments } catch { continue }
        foreach ($att in $atts) {
            $target = Join-Path $saveDir ([string]$att.FileName)
            try {
                $att.SaveAsFile($target)
                [void]$saved.Add([pscustomobject]@{
                    fileName   = [string]$att.FileName
                    path       = $target
                    subject    = $subj
                    receivedAt = $rt.ToString('yyyy-MM-ddTHH:mm:ss')
                    source     = 'outlook'
                })
            } catch { }
        }
    }
}

[pscustomobject]@{
    matchedMails = $matched
    scannedItems = $scanned
    saveDir      = $saveDir
    saved        = @($saved)
} | ConvertTo-Json -Depth 6 -Compress
"""


def _read_json(path: Path) -> Dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _default_save_dir() -> str:
    """优先用工作区里名字含 merge excel 的子目录，其次工作区根，最后回退用户文档。"""
    data = _read_json(_WORKSPACE_JSON)
    root = str(data.get("workSpace") or "").strip()
    for item in data.get("subPath") or []:
        name = str(item.get("subPathName") or "")
        if "merge excel" in name.lower():
            return name
    if root:
        return root
    return str(Path.home() / "Documents" / "workspace")


def _decode_mime_header(raw: Optional[str]) -> str:
    if not raw:
        return ""
    parts = []
    for chunk, charset in decode_header(raw):
        if isinstance(chunk, bytes):
            try:
                parts.append(chunk.decode(charset or "utf-8", errors="replace"))
            except (LookupError, TypeError):
                parts.append(chunk.decode("utf-8", errors="replace"))
        else:
            parts.append(chunk)
    return "".join(parts).strip()


def _safe_filename(name: str, fallback: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]', "_", (name or "").strip())
    return cleaned or fallback


# --------------------------------------------------------------------------- #
# 后端一：本机 Outlook 桌面版（COM）
# --------------------------------------------------------------------------- #


def _run_powershell(env_extra: Dict[str, str], timeout: int) -> subprocess.CompletedProcess:
    script_file = Path(tempfile.gettempdir()) / "yolk_outlook_attachment.ps1"
    script_file.write_text(_PS_SCRIPT, encoding="utf-8")
    env = {**os.environ, **env_extra, "PYTHONIOENCODING": "utf-8"}
    return subprocess.run(
        [
            "powershell.exe",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script_file),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        timeout=timeout,
    )


# --------------------------------------------------------------------------- #
# 后端二：IMAP 直连邮箱
# --------------------------------------------------------------------------- #


def _imap_config() -> Optional[Dict[str, Any]]:
    cfg = _read_json(_MAIL_ACCOUNT_JSON)
    host = str(cfg.get("imap_host") or "").strip()
    username = str(cfg.get("username") or "").strip()
    password = str(cfg.get("password") or "").strip()
    if not host or not username or not password:
        return None
    return cfg


def _imap_save_attachments(
    cfg: Dict[str, Any],
    keyword: str,
    save_dir: str,
    days_back: int,
    max_items: int,
) -> Dict[str, Any]:
    host = str(cfg["imap_host"]).strip()
    port = int(cfg.get("imap_port") or 993)
    use_ssl = bool(cfg.get("use_ssl", True))
    mailbox = str(cfg.get("mailbox") or "INBOX").strip()
    username = str(cfg["username"]).strip()
    password = str(cfg["password"])
    sender_filter = str(cfg.get("sender_contains") or "").strip().lower()

    os.makedirs(save_dir, exist_ok=True)
    client: imaplib.IMAP4 = (
        imaplib.IMAP4_SSL(host, port) if use_ssl else imaplib.IMAP4(host, port)
    )
    saved: List[Dict[str, Any]] = []
    matched = 0
    scanned = 0
    try:
        client.login(username, password)
        client.select(mailbox, readonly=True)
        since = (date.today() - timedelta(days=max(1, days_back))).strftime("%d-%b-%Y")
        status, data = client.search(None, f'(SINCE {since})')
        if status != "OK":
            raise RuntimeError(f"IMAP 检索失败：{status}")
        ids = (data[0] or b"").split()
        # 只看最近的邮件，避免大邮箱全量拉取
        ids = ids[-max(1, max_items) :]
        for msg_id in reversed(ids):
            scanned += 1
            status, header_data = client.fetch(
                msg_id, "(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM)])"
            )
            if status != "OK" or not header_data:
                continue
            header_bytes = b""
            for chunk in header_data:
                if isinstance(chunk, tuple):
                    header_bytes += chunk[1]
            header_msg = email.message_from_bytes(header_bytes)
            subject = _decode_mime_header(header_msg.get("Subject"))
            sender = _decode_mime_header(header_msg.get("From")).lower()
            if keyword not in subject:
                continue
            if sender_filter and sender_filter not in sender:
                continue
            matched += 1
            status, full_data = client.fetch(msg_id, "(BODY.PEEK[])")
            if status != "OK" or not full_data:
                continue
            raw = b""
            for chunk in full_data:
                if isinstance(chunk, tuple):
                    raw += chunk[1]
            message = email.message_from_bytes(raw)
            for index, part in enumerate(message.walk()):
                if part.get_content_maintype() == "multipart":
                    continue
                disposition = (part.get("Content-Disposition") or "").lower()
                filename = _decode_mime_header(part.get_filename())
                if not filename:
                    if "attachment" not in disposition:
                        continue
                    filename = f"attachment-{index}"
                payload = part.get_payload(decode=True)
                if payload is None:
                    continue
                target = Path(save_dir) / _safe_filename(filename, f"attachment-{index}")
                target.write_bytes(payload)
                saved.append(
                    {
                        "fileName": target.name,
                        "path": str(target),
                        "subject": subject,
                        "receivedAt": "",
                        "source": "imap",
                    }
                )
    finally:
        try:
            client.logout()
        except Exception:
            pass

    return {"matchedMails": matched, "scannedItems": scanned, "saveDir": save_dir, "saved": saved}


# --------------------------------------------------------------------------- #
# 工具
# --------------------------------------------------------------------------- #


class SaveOutlookAttachment(BaseTool):
    """按邮件主题检索邮件，并把匹配邮件的附件保存到本地目录。"""

    name: str = "save_outlook_attachment"
    description: str = (
        "在 Windows 上按「邮件主题关键词」检索邮箱，把匹配邮件的附件保存到本地目录，返回已保存文件的完整路径。"
        "优先使用本机 Outlook 桌面版（COM）；若本机没有经典 Outlook，则自动回退到 IMAP 账号配置。"
        "适用于「把某份报表邮件的附件下载下来」这类需求。只读取邮件，不会发送、删除或改动已读状态。"
        "若两种方式都不可用，会返回可读的原因与解决办法。"
    )
    parameters: dict = {
        "type": "object",
        "properties": {
            "subject_keyword": {
                "type": "string",
                "description": "邮件主题关键词，支持部分匹配。例：HSBC的交易报表",
            },
            "save_dir": {
                "type": "string",
                "description": "附件保存目录的绝对路径；不填则用工作区中的 merge excel 目录。",
            },
            "days_back": {
                "type": "integer",
                "description": "只检索最近多少天收到的邮件，默认 7。",
            },
            "include_subfolders": {
                "type": "boolean",
                "description": "是否同时检索收件箱的一级子文件夹（仅 Outlook 后端生效），默认 false。",
            },
            "max_items": {
                "type": "integer",
                "description": "最多扫描多少封邮件，默认 500，避免超大邮箱卡住。",
            },
        },
        "required": ["subject_keyword"],
    }

    async def execute(
        self,
        subject_keyword: str = "",
        save_dir: Optional[str] = None,
        days_back: int = 7,
        include_subfolders: bool = False,
        max_items: int = 500,
    ) -> str:
        if sys.platform != "win32":
            return "save_outlook_attachment 仅支持 Windows，当前系统未执行任何操作。"

        keyword = (subject_keyword or "").strip()
        if not keyword:
            return "缺少邮件主题关键词（subject_keyword），未执行任何操作。"

        days = max(1, int(days_back or 7))
        limit = max(1, int(max_items or 500))
        target_dir = (save_dir or "").strip() or _default_save_dir()

        # 始终先试 Outlook COM：这是判断「能不能用」的唯一权威方式，
        # 不靠安装路径/注册表猜测，避免误判导致跳过 Outlook。
        outlook_detail = ""
        try:
            proc = await asyncio.to_thread(
                _run_powershell,
                {
                    "YOLK_OL_SUBJECT": keyword,
                    "YOLK_OL_SAVE_DIR": target_dir,
                    "YOLK_OL_DAYS": str(days),
                    "YOLK_OL_MAX_ITEMS": str(limit),
                    "YOLK_OL_SUBFOLDERS": "1" if include_subfolders else "0",
                },
                120,
            )
            stdout = (proc.stdout or "").strip()
            stderr = (proc.stderr or "").strip()
            if proc.returncode == 0 and stdout:
                return self._format_result(json.loads(stdout), keyword, target_dir, days)
            outlook_detail = stderr or "Outlook COM 调用失败"
        except subprocess.TimeoutExpired:
            return "检索 Outlook 超时（120 秒），可能邮箱过大或 Outlook 正在同步，请稍后重试。"
        except json.JSONDecodeError:
            return "Outlook 返回内容无法解析，请稍后重试。"
        except OSError as e:
            outlook_detail = f"无法调用 PowerShell：{e}"

        cfg = _imap_config()
        if cfg:
            try:
                payload = await asyncio.to_thread(
                    _imap_save_attachments, cfg, keyword, target_dir, days, limit
                )
            except imaplib.IMAP4.error as e:
                return (
                    f"Outlook 不可用（{outlook_detail}），IMAP 登录或检索也失败：{e}。"
                    f"请检查 agent-controller/llm_config/mail_account.json 里的 "
                    f"imap_host / username / password（多数邮箱需要「应用专用密码」）。"
                )
            except OSError as e:
                return f"Outlook 不可用（{outlook_detail}），连接 IMAP 服务器也失败：{e}"
            return self._format_result(payload, keyword, target_dir, days)

        hint = (
            "无法读取邮箱附件：本机 Outlook COM 不可用，也没有配置 IMAP 账号。\n"
            "任选一种方式即可让流水线跑通：\n"
            "1) 确认已安装并登录经典版 Outlook 桌面客户端（新版 Outlook 不支持 COM）；或\n"
            f"2) 填写 {_MAIL_ACCOUNT_JSON} 中的 imap_host / imap_port / username / password"
            "（建议使用邮箱的「应用专用密码」），保存后重新执行。"
        )
        if outlook_detail:
            hint = f"{hint}\nOutlook 失败原因：{outlook_detail}"
        return hint

    @staticmethod
    def _format_result(
        payload: Dict[str, Any], keyword: str, target_dir: str, days: int
    ) -> str:
        saved = payload.get("saved") or []
        if isinstance(saved, dict):
            saved = [saved]
        files = [item for item in saved if isinstance(item, dict)]
        matched = int(payload.get("matchedMails") or 0)
        if not files:
            return (
                f"未在最近 {days} 天找到主题包含「{keyword}」且带附件的邮件"
                f"（匹配邮件 {matched} 封，已扫描 {payload.get('scannedItems')} 项）。"
                f"保存目录：{target_dir}"
            )
        lines = [
            f"已匹配 {matched} 封主题包含「{keyword}」的邮件，"
            f"共保存 {len(files)} 个附件到 {target_dir}："
        ]
        for item in files:
            lines.append(f"- {item.get('path')}")
        return "\n".join(lines)
