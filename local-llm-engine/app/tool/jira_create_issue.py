"""在 Jira Cloud 中创建 Issue（依赖 Jira 连接器 OAuth 登录）。"""

import sys
from pathlib import Path

from app.connectors.jira_config import get_jira_client, load_jira_runtime_config
from app.tool.base import BaseTool

_AC_ROOT = Path(__file__).resolve().parents[3] / "agent-controller"
if str(_AC_ROOT) not in sys.path:
    sys.path.insert(0, str(_AC_ROOT))

from connectors.crypto import decrypt_secret  # noqa: E402
from connectors.jira.client import JiraClientError  # noqa: E402


class JiraCreateIssue(BaseTool):
    name: str = "jira_create_issue"
    description: str = (
        "在已登录的 Jira Cloud 站点创建 Issue（任务/Bug/Story 等）。"
        "调用前须在普通聊天中向用户展示 project_key、summary、description、issue_type，"
        "由用户在聊天里确认后再调用；不得在确认时使用 ask_human 弹窗。"
        "用户须已在「设置 → Jira 连接器」点击登录完成授权。"
    )
    parameters: dict = {
        "type": "object",
        "properties": {
            "project_key": {
                "type": "string",
                "description": "Jira 项目键，如 PROJ。未填则使用连接器默认项目。",
            },
            "summary": {
                "type": "string",
                "description": "Issue 标题/摘要。",
            },
            "description": {
                "type": "string",
                "description": "Issue 详细描述（纯文本）。",
            },
            "issue_type": {
                "type": "string",
                "description": "Issue 类型名称，如 Task、Bug、Story。默认 Task。",
            },
        },
        "required": ["summary"],
    }

    async def execute(
        self,
        summary: str,
        project_key: str = "",
        description: str = "",
        issue_type: str = "Task",
    ) -> str:
        cfg = load_jira_runtime_config(decrypt_secret)
        if not cfg:
            return (
                "未找到有效的 Jira 连接器配置。请先在 Yolk「设置 → Jira 连接器」中点击「登录 Jira」完成授权。"
            )

        key = (project_key or cfg.default_project_key or "").strip().upper()
        if not key:
            return "缺少 project_key，且连接器未配置默认项目键，请指定项目或先在设置中填写默认项目。"

        if not (summary or "").strip():
            return "summary 不能为空。"

        client = get_jira_client()
        if not client:
            return "Jira 登录已失效，请在设置中重新登录。"

        try:
            result = client.create_issue(
                project_key=key,
                summary=summary.strip(),
                description=(description or "").strip(),
                issue_type=(issue_type or "Task").strip() or "Task",
            )
        except JiraClientError as e:
            return f"创建 Jira Issue 失败: {e}"

        issue_key = result.get("key", "")
        url = result.get("url") or ""
        return f"已在 Jira 创建 Issue {issue_key}。{('链接: ' + url) if url else ''}"
