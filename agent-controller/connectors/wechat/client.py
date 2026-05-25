"""微信公众号服务端 API 客户端（支持自定义 api_base 以便代理转发）。"""

import html
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests


DEFAULT_API_BASE = "https://api.weixin.qq.com"

# 微信公众号 draft/add 字段长度（官方文档，按字符计）
MAX_TITLE_CHARS = 32
MAX_AUTHOR_CHARS = 16
MAX_DIGEST_CHARS = 128


class WeChatClientError(Exception):
    pass


def _truncate_chars(text: str, max_chars: int) -> str:
    """按字符截断（微信 draft/add 字段限制以「字」计）。"""
    if max_chars <= 0:
        return ""
    return (text or "")[:max_chars]


_UNICODE_ESCAPE_RE = re.compile(r"\\u([0-9a-fA-F]{4})")


def decode_literal_unicode_escapes(text: str) -> str:
    """将 LLM 偶发传入的字面量 \\uXXXX 转为真实 Unicode 字符。"""
    raw = text or ""
    if "\\u" not in raw:
        return raw

    def _repl(match: re.Match[str]) -> str:
        return chr(int(match.group(1), 16))

    return _UNICODE_ESCAPE_RE.sub(_repl, raw)


def sanitize_wechat_text(text: str) -> str:
    """提交前规范化文本：解码字面量转义并去除首尾空白。"""
    return decode_literal_unicode_escapes((text or "").strip())


def normalize_wechat_html(content: str, *, content_is_html: bool = False) -> str:
    """将正文规范为微信公众号草稿可接受的 HTML。"""
    raw = (content or "").strip()
    if not raw:
        return "<p></p>"
    if content_is_html or re.search(r"<[a-z][\s\S]*>", raw, re.I):
        # 去掉外层 section/div/article，避免微信渲染后体积膨胀
        inner = re.sub(
            r"^\s*<(?:section|div|article)[^>]*>([\s\S]*)</(?:section|div|article)>\s*$",
            r"\1",
            raw,
            count=1,
            flags=re.I,
        ).strip()
        return inner or raw
    return markdown_to_wechat_html(raw)


def markdown_to_wechat_html(text: str) -> str:
    """将简单 Markdown 转为微信公众号图文可用的 HTML（MVP）。"""
    raw = (text or "").strip()
    if not raw:
        return "<p></p>"
    if re.search(r"<[a-z][\s\S]*>", raw, re.I):
        return raw

    lines = raw.split("\n")
    blocks: List[str] = []
    para: List[str] = []

    def flush_para() -> None:
        if not para:
            return
        body = "<br/>".join(html.escape(line) for line in para)
        blocks.append(f"<p>{body}</p>")
        para.clear()

    for line in lines:
        s = line.rstrip()
        if not s.strip():
            flush_para()
            continue
        if s.startswith("### "):
            flush_para()
            blocks.append(f"<h3>{html.escape(s[4:].strip())}</h3>")
        elif s.startswith("## "):
            flush_para()
            blocks.append(f"<h2>{html.escape(s[3:].strip())}</h2>")
        elif s.startswith("# "):
            flush_para()
            blocks.append(f"<h1>{html.escape(s[2:].strip())}</h1>")
        else:
            para.append(s)
    flush_para()
    return "\n".join(blocks) if blocks else "<p></p>"


class WeChatClient:
    def __init__(
        self,
        app_id: str,
        app_secret: str,
        *,
        api_base: str = DEFAULT_API_BASE,
        access_token: str = "",
        token_expires_at: float = 0,
    ) -> None:
        self.app_id = (app_id or "").strip()
        self.app_secret = (app_secret or "").strip()
        base = (api_base or DEFAULT_API_BASE).strip().rstrip("/")
        self.api_base = base or DEFAULT_API_BASE
        self._access_token = (access_token or "").strip()
        self._token_expires_at = float(token_expires_at or 0)
        self.session = requests.Session()

    def _post_json(self, url: str, payload: Dict[str, Any], *, timeout: int = 60) -> requests.Response:
        """POST JSON。微信 API 要求 UTF-8 原文，不能用 \\uXXXX 转义（ensure_ascii=False）。"""
        return self.session.post(
            url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json; charset=utf-8"},
            timeout=timeout,
        )

    def _url(self, path: str, query: Optional[Dict[str, str]] = None) -> str:
        url = urljoin(self.api_base + "/", path.lstrip("/"))
        if query:
            from urllib.parse import urlencode

            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}{urlencode(query)}"
        return url

    def _check_wechat_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(data, dict):
            raise WeChatClientError(f"无效响应: {data!r}")
        errcode = data.get("errcode", 0)
        if errcode and int(errcode) != 0:
            errmsg = data.get("errmsg", "")
            hint = ""
            if int(errcode) == 40164:
                hint = "（请将出口 IP 加入微信公众平台 API IP 白名单，或使用代理 api_base）"
            elif int(errcode) == 45004:
                hint = (
                    "（摘要 digest 不得超过 128 字；未填写时由微信自动抓取正文前 54 字。"
                    "请勿在工具层自动生成过长摘要。）"
                )
            raise WeChatClientError(f"微信 API 错误 {errcode}: {errmsg}{hint}")
        return data

    def get_access_token(self, force_refresh: bool = False) -> str:
        if (
            not force_refresh
            and self._access_token
            and time.time() < self._token_expires_at - 120
        ):
            return self._access_token

        if not self.app_id or not self.app_secret:
            raise WeChatClientError("缺少 AppID 或 AppSecret")

        r = self.session.get(
            self._url(
                "/cgi-bin/token",
                {
                    "grant_type": "client_credential",
                    "appid": self.app_id,
                    "secret": self.app_secret,
                },
            ),
            timeout=30,
        )
        if r.status_code >= 400:
            raise WeChatClientError(f"获取 token 失败 ({r.status_code}): {r.text[:500]}")
        data = self._check_wechat_response(r.json())
        token = data.get("access_token", "")
        if not token:
            raise WeChatClientError("未返回 access_token")
        expires_in = float(data.get("expires_in", 7200))
        self._access_token = token
        self._token_expires_at = time.time() + expires_in
        return token

    @property
    def token_expires_at(self) -> float:
        return self._token_expires_at

    def test_connection(self) -> Dict[str, Any]:
        token = self.get_access_token(force_refresh=True)
        r = self.session.get(
            self._url("/cgi-bin/getcallbackip", {"access_token": token}),
            timeout=30,
        )
        if r.status_code >= 400:
            raise WeChatClientError(f"测试连接失败 ({r.status_code}): {r.text[:500]}")
        data = self._check_wechat_response(r.json())
        return {"ok": True, "ip_list": data.get("ip_list", [])}

    def upload_image(self, image_path: str) -> str:
        path = Path(image_path).expanduser()
        if not path.is_file():
            raise WeChatClientError(f"封面图片不存在: {image_path}")

        suffix = path.suffix.lower()
        mime_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        mime = mime_map.get(suffix, "image/jpeg")

        token = self.get_access_token()
        url = self._url("/cgi-bin/material/add_material", {"access_token": token, "type": "image"})
        with open(path, "rb") as f:
            r = self.session.post(
                url,
                files={"media": (path.name, f, mime)},
                timeout=60,
            )
        if r.status_code >= 400:
            raise WeChatClientError(f"上传图片失败 ({r.status_code}): {r.text[:500]}")
        data = self._check_wechat_response(r.json())
        media_id = data.get("media_id")
        if not media_id:
            raise WeChatClientError("上传图片未返回 media_id")
        return str(media_id)

    def add_draft(
        self,
        *,
        title: str,
        content: str,
        thumb_media_id: str,
        author: str = "",
        digest: str = "",
        content_is_html: bool = False,
    ) -> str:
        body_html = normalize_wechat_html(
            sanitize_wechat_text(content), content_is_html=content_is_html
        )
        digest_text = _truncate_chars(sanitize_wechat_text(digest), MAX_DIGEST_CHARS)

        token = self.get_access_token()
        article: Dict[str, Any] = {
            "article_type": "news",
            "title": _truncate_chars(sanitize_wechat_text(title), MAX_TITLE_CHARS),
            "author": _truncate_chars(sanitize_wechat_text(author), MAX_AUTHOR_CHARS),
            "content": body_html,
            "content_source_url": "",
            "thumb_media_id": thumb_media_id,
            "need_open_comment": 0,
            "only_fans_can_comment": 0,
        }
        # 未填写 digest 时不传该字段，由微信自动抓取正文前 54 字
        if digest_text:
            article["digest"] = digest_text

        payload = {"articles": [article]}
        r = self._post_json(
            self._url("/cgi-bin/draft/add", {"access_token": token}),
            payload,
        )
        if r.status_code >= 400:
            raise WeChatClientError(f"创建草稿失败 ({r.status_code}): {r.text[:800]}")
        data = self._check_wechat_response(r.json())
        media_id = data.get("media_id")
        if not media_id:
            raise WeChatClientError("创建草稿未返回 media_id")
        return str(media_id)

    def submit_publish(self, media_id: str) -> Dict[str, Any]:
        mid = (media_id or "").strip()
        if not mid:
            raise WeChatClientError("media_id 不能为空")

        token = self.get_access_token()
        r = self._post_json(
            self._url("/cgi-bin/freepublish/submit", {"access_token": token}),
            {"media_id": mid},
        )
        if r.status_code >= 400:
            raise WeChatClientError(f"提交发布失败 ({r.status_code}): {r.text[:800]}")
        data = self._check_wechat_response(r.json())
        return {
            "publish_id": data.get("publish_id", ""),
            "media_id": mid,
        }
