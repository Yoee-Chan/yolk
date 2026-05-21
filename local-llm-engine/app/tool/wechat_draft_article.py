"""将图文消息保存到微信公众号草稿箱。"""

import sys
from pathlib import Path

from app.connectors.wechat_config import get_wechat_client, load_wechat_runtime_config
from app.tool.base import BaseTool

_AC_ROOT = Path(__file__).resolve().parents[3] / "agent-controller"
if str(_AC_ROOT) not in sys.path:
    sys.path.insert(0, str(_AC_ROOT))

from connectors.crypto import decrypt_secret  # noqa: E402
from connectors.wechat.client import WeChatClientError  # noqa: E402


class WeChatDraftArticle(BaseTool):
    name: str = "wechat_draft_article"
    description: str = (
        "将图文文章保存到微信公众号草稿箱（不发布）。"
        "调用前须在普通聊天中向用户展示：标题、作者、摘要、正文预览、封面图路径，"
        "由用户在聊天里确认后再调用；不得在确认时使用 ask_human 弹窗。"
        "用户须已在「设置 → 微信公众号连接器」中保存 AppID 与 AppSecret。"
        "返回 media_id，供后续 wechat_publish_article 发布使用。"
    )
    parameters: dict = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "文章标题。"},
            "content": {
                "type": "string",
                "description": "正文，支持简单 Markdown 或 HTML。",
            },
            "thumb_image_path": {
                "type": "string",
                "description": "封面图本地绝对路径（必填）。",
            },
            "author": {"type": "string", "description": "作者名，可选。"},
            "digest": {"type": "string", "description": "摘要，可选。"},
            "content_is_html": {
                "type": "boolean",
                "description": "正文是否已是 HTML，默认 false（按 Markdown 处理）。",
            },
        },
        "required": ["title", "content", "thumb_image_path"],
    }

    async def execute(
        self,
        title: str,
        content: str,
        thumb_image_path: str,
        author: str = "",
        digest: str = "",
        content_is_html: bool = False,
    ) -> str:
        cfg = load_wechat_runtime_config(decrypt_secret)
        if not cfg:
            return (
                "未找到有效的微信公众号连接器配置。请先在 Yolk「设置 → 连接器 → 微信公众号」"
                "中填写 AppID、AppSecret 并保存。"
            )

        client = get_wechat_client()
        if not client:
            return "微信公众号配置无效或 token 已失效，请在设置中重新测试连接并保存。"

        if not (title or "").strip():
            return "title 不能为空。"
        if not (content or "").strip():
            return "content 不能为空。"
        if not (thumb_image_path or "").strip():
            return "thumb_image_path 不能为空，请提供封面图本地路径。"

        author_name = (author or cfg.default_author or "").strip()

        try:
            thumb_id = client.upload_image(thumb_image_path.strip())
            media_id = client.add_draft(
                title=title.strip(),
                content=content,
                thumb_media_id=thumb_id,
                author=author_name,
                digest=(digest or "").strip(),
                content_is_html=bool(content_is_html),
            )
        except WeChatClientError as e:
            return f"创建微信公众号草稿失败: {e}"

        account = cfg.account_name or cfg.app_id
        return (
            f"已保存到微信公众号「{account}」草稿箱。"
            f" media_id: {media_id}。"
            f" 用户确认发布后，请调用 wechat_publish_article 并传入该 media_id。"
        )
