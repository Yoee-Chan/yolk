"""将微信公众号草稿提交发布（发表到公众号）。"""

import sys
from pathlib import Path

from app.connectors.wechat_config import get_wechat_client, load_wechat_runtime_config
from app.tool.base import BaseTool

_AC_ROOT = Path(__file__).resolve().parents[3] / "agent-controller"
if str(_AC_ROOT) not in sys.path:
    sys.path.insert(0, str(_AC_ROOT))

from connectors.crypto import decrypt_secret  # noqa: E402
from connectors.wechat.client import WeChatClientError  # noqa: E402


class WeChatPublishArticle(BaseTool):
    name: str = "wechat_publish_article"
    description: str = (
        "将已存在的微信公众号草稿提交发布（freepublish）。"
        "仅在用户于普通聊天中明确确认发布（如：确认发布 / 可以发布 / 发布）后调用；"
        "不要使用 ask_human 弹窗做确认。"
        "media_id 通常来自先前 wechat_draft_article 的返回。"
    )
    parameters: dict = {
        "type": "object",
        "properties": {
            "media_id": {
                "type": "string",
                "description": "草稿 media_id（由 wechat_draft_article 返回）。",
            },
        },
        "required": ["media_id"],
    }

    async def execute(self, media_id: str) -> str:
        cfg = load_wechat_runtime_config(decrypt_secret)
        if not cfg:
            return (
                "未找到有效的微信公众号连接器配置。请先在 Yolk「设置 → 连接器 → 微信公众号」"
                "中填写并保存凭据。"
            )

        client = get_wechat_client()
        if not client:
            return "微信公众号配置无效或 token 已失效，请在设置中重新测试连接。"

        mid = (media_id or "").strip()
        if not mid:
            return "media_id 不能为空。"

        try:
            result = client.submit_publish(mid)
        except WeChatClientError as e:
            return f"发布微信公众号文章失败: {e}"

        account = cfg.account_name or cfg.app_id
        publish_id = result.get("publish_id") or ""
        extra = f" publish_id: {publish_id}" if publish_id else ""
        return (
            f"已向微信公众号「{account}」提交发布。"
            f" media_id: {mid}.{extra}"
            f" 可在微信公众平台查看发布状态。"
        )
