"""读取微信公众号连接器配置并构建客户端。"""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class WeChatRuntimeConfig:
    account_name: str
    app_id: str
    api_base_url: str
    default_author: str = ""


def _config_path() -> Path:
    env = os.environ.get("YOLK_WECHAT_CONNECTOR_JSON")
    if env:
        return Path(env)
    root = Path(__file__).resolve().parents[3]
    return root / "agent-controller" / "llm_config" / "wechat_connector.json"


def load_wechat_runtime_config(decrypt_fn) -> Optional[WeChatRuntimeConfig]:
    path = _config_path()
    if not path.is_file():
        return None
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    app_id = (raw.get("app_id") or "").strip()
    secret = decrypt_fn(raw.get("app_secret_encrypted", ""))
    if not app_id or not secret:
        return None
    return WeChatRuntimeConfig(
        account_name=(raw.get("account_name") or "").strip(),
        app_id=app_id,
        api_base_url=(raw.get("api_base_url") or "https://api.weixin.qq.com").strip().rstrip("/"),
        default_author=(raw.get("default_author") or "").strip(),
    )


def get_wechat_client():
    """返回带 token 缓存的 WeChatClient；未配置则 None。"""
    import sys

    ac_root = Path(__file__).resolve().parents[3] / "agent-controller"
    if str(ac_root) not in sys.path:
        sys.path.insert(0, str(ac_root))
    from connectors.wechat.session import get_authenticated_wechat_client

    return get_authenticated_wechat_client()
