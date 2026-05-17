"""读取 Jira 连接器配置并构建客户端。"""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from connectors.jira.client import JiraClient


@dataclass
class JiraRuntimeConfig:
    auth_type: str
    site_url: str
    email: str
    cloud_id: str
    access_token: str
    api_token: str
    default_project_key: str = ""


def _config_path() -> Path:
    env = os.environ.get("YOLK_JIRA_CONNECTOR_JSON")
    if env:
        return Path(env)
    root = Path(__file__).resolve().parents[3]
    return root / "agent-controller" / "llm_config" / "jira_connector.json"


def load_jira_runtime_config(decrypt_fn) -> Optional[JiraRuntimeConfig]:
    path = _config_path()
    if not path.is_file():
        return None
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    auth_type = raw.get("auth_type") or (
        "oauth" if raw.get("cloud_id") else "api_token"
    )
    default_pk = (raw.get("default_project_key") or "").strip().upper()
    site = (raw.get("site_url") or "").strip()

    if auth_type == "oauth":
        access = decrypt_fn(raw.get("access_token_encrypted", ""))
        if not access or not raw.get("cloud_id"):
            return None
        return JiraRuntimeConfig(
            auth_type="oauth",
            site_url=site,
            email=(raw.get("email") or "").strip(),
            cloud_id=raw.get("cloud_id", ""),
            access_token=access,
            api_token="",
            default_project_key=default_pk,
        )

    token = decrypt_fn(raw.get("api_token_encrypted", ""))
    email = (raw.get("email") or "").strip()
    if not site or not email or not token:
        return None
    return JiraRuntimeConfig(
        auth_type="api_token",
        site_url=site,
        email=email,
        cloud_id="",
        access_token="",
        api_token=token,
        default_project_key=default_pk,
    )


def get_jira_client():
    """返回带自动刷新 OAuth 的 JiraClient；未登录则 None。"""
    import sys

    ac_root = Path(__file__).resolve().parents[3] / "agent-controller"
    if str(ac_root) not in sys.path:
        sys.path.insert(0, str(ac_root))
    from connectors.jira.session import get_authenticated_jira_client

    return get_authenticated_jira_client()
