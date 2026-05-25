"""微信公众号客户端单元测试。"""

import json
from unittest.mock import MagicMock

from connectors.wechat.client import (
    MAX_DIGEST_CHARS,
    WeChatClient,
    decode_literal_unicode_escapes,
    normalize_wechat_html,
)


def test_normalize_wechat_html_strips_section_wrapper():
    raw = "<section><p>hello</p></section>"
    assert normalize_wechat_html(raw, content_is_html=True) == "<p>hello</p>"


def test_add_draft_omits_digest_when_empty():
    client = WeChatClient("app", "secret")
    client.get_access_token = MagicMock(return_value="token")  # type: ignore[method-assign]

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"media_id": "MID123"}
    client.session.post = MagicMock(return_value=mock_resp)

    client.add_draft(
        title="标题",
        content="正文内容",
        thumb_media_id="thumb123",
        digest="",
    )

    body = client.session.post.call_args.kwargs["data"].decode("utf-8")
    payload = json.loads(body)
    article = payload["articles"][0]
    assert "digest" not in article
    assert article["article_type"] == "news"
    assert article["title"] == "标题"


def test_add_draft_truncates_long_digest():
    client = WeChatClient("app", "secret")
    client.get_access_token = MagicMock(return_value="token")  # type: ignore[method-assign]

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"media_id": "MID123"}
    client.session.post = MagicMock(return_value=mock_resp)

    long_digest = "摘" * (MAX_DIGEST_CHARS + 10)
    client.add_draft(
        title="标题",
        content="正文",
        thumb_media_id="thumb123",
        digest=long_digest,
    )

    body = client.session.post.call_args.kwargs["data"].decode("utf-8")
    payload = json.loads(body)
    assert len(payload["articles"][0]["digest"]) == MAX_DIGEST_CHARS


def test_add_draft_does_not_auto_fill_digest_from_content():
    """回归：此前从正文自动生成 digest 会触发 45004。"""
    client = WeChatClient("app", "secret")
    client.get_access_token = MagicMock(return_value="token")  # type: ignore[method-assign]

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"media_id": "MID123"}
    client.session.post = MagicMock(return_value=mock_resp)

    long_body = "中" * 80
    client.add_draft(
        title="标题",
        content=long_body,
        thumb_media_id="thumb123",
    )

    body = client.session.post.call_args.kwargs["data"].decode("utf-8")
    payload = json.loads(body)
    assert "digest" not in payload["articles"][0]


def test_post_json_uses_utf8_not_unicode_escapes():
    """微信 API 会把 JSON 里的 \\uXXXX 原样展示，必须 ensure_ascii=False。"""
    client = WeChatClient("app", "secret")
    client.get_access_token = MagicMock(return_value="token")  # type: ignore[method-assign]

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"media_id": "MID123"}
    client.session.post = MagicMock(return_value=mock_resp)

    client.add_draft(
        title="AI Agent：你的智能数字员工",
        content="你好世界",
        thumb_media_id="thumb123",
    )

    body = client.session.post.call_args.kwargs["data"].decode("utf-8")
    assert "你的智能数字员工" in body
    assert "\\u4f60" not in body
    assert client.session.post.call_args.kwargs["headers"]["Content-Type"] == (
        "application/json; charset=utf-8"
    )


def test_decode_literal_unicode_escapes():
    assert decode_literal_unicode_escapes(r"\u4f60\u597d") == "你好"
    assert decode_literal_unicode_escapes("AI Agent") == "AI Agent"
