"""微信公众号服务端 API 客户端（支持自定义 api_base 以便代理转发）。"""

import html
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests


DEFAULT_API_BASE = "https://api.weixin.qq.com"


class WeChatClientError(Exception):
    pass


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

        token = self.get_access_token()
        url = self._url("/cgi-bin/material/add_material", {"access_token": token, "type": "image"})
        with open(path, "rb") as f:
            r = self.session.post(
                url,
                files={"media": (path.name, f, "image/jpeg")},
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
        body_html = content if content_is_html else markdown_to_wechat_html(content)
        digest_text = (digest or "").strip() or re.sub(r"<[^>]+>", "", body_html)[:120]

        token = self.get_access_token()
        payload = {
            "articles": [
                {
                    "title": (title or "").strip()[:64],
                    "author": (author or "").strip()[:16],
                    "digest": digest_text[:120],
                    "content": body_html,
                    "content_source_url": "",
                    "thumb_media_id": thumb_media_id,
                    "need_open_comment": 0,
                    "only_fans_can_comment": 0,
                }
            ]
        }
        r = self.session.post(
            self._url("/cgi-bin/draft/add", {"access_token": token}),
            json=payload,
            timeout=60,
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
        r = self.session.post(
            self._url("/cgi-bin/freepublish/submit", {"access_token": token}),
            json={"media_id": mid},
            timeout=60,
        )
        if r.status_code >= 400:
            raise WeChatClientError(f"提交发布失败 ({r.status_code}): {r.text[:800]}")
        data = self._check_wechat_response(r.json())
        return {
            "publish_id": data.get("publish_id", ""),
            "media_id": mid,
        }
