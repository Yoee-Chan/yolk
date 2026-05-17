"""Atlassian OAuth 2.0 (3LO) — 授权 URL、换票、刷新。"""

import json
import os
import secrets
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import requests

_AUTH_URL = "https://auth.atlassian.com/authorize"
_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"

_DEFAULT_SCOPES = [
    "read:jira-work",
    "write:jira-work",
    "read:jira-user",
    "offline_access",
]

DEFAULT_REDIRECT_URI = "http://localhost:8765/callback"


class JiraOAuthError(Exception):
    pass


def _oauth_app_path() -> Path:
    env = os.environ.get("YOLK_JIRA_OAUTH_APP_JSON")
    if env:
        return Path(env)
    root = Path(__file__).resolve().parents[2]
    return root / "llm_config" / "jira_oauth.app.json"


def _state_path() -> Path:
    return _oauth_app_path().parent / ".jira_oauth_state.json"


def get_oauth_app_status() -> Dict[str, Any]:
    """供 UI 展示；不返回 client_secret 明文。"""
    path = _oauth_app_path()
    if not path.is_file():
        return {
            "configured": False,
            "client_id": "",
            "redirect_uri": DEFAULT_REDIRECT_URI,
            "has_client_secret": False,
        }
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    cid = (raw.get("client_id") or "").strip()
    secret = (raw.get("client_secret") or "").strip()
    redirect = (raw.get("redirect_uri") or DEFAULT_REDIRECT_URI).strip()
    configured = bool(cid and secret and redirect)
    return {
        "configured": configured,
        "client_id": cid,
        "redirect_uri": redirect,
        "has_client_secret": bool(secret),
    }


def save_oauth_app_config(
    client_id: str,
    client_secret: str = "",
    redirect_uri: str = "",
) -> Dict[str, Any]:
    path = _oauth_app_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    existing: Dict[str, Any] = {}
    if path.is_file():
        with open(path, "r", encoding="utf-8") as f:
            existing = json.load(f)
    cid = (client_id or "").strip()
    if not cid:
        raise JiraOAuthError("Client ID 不能为空")
    secret = (client_secret or "").strip() or (existing.get("client_secret") or "").strip()
    if not secret:
        raise JiraOAuthError("Client Secret 不能为空")
    redirect = (redirect_uri or existing.get("redirect_uri") or DEFAULT_REDIRECT_URI).strip()
    payload = {
        "client_id": cid,
        "client_secret": secret,
        "redirect_uri": redirect,
        "scopes": existing.get("scopes") or _DEFAULT_SCOPES,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    return get_oauth_app_status()


def load_oauth_app_config() -> Dict[str, Any]:
    path = _oauth_app_path()
    if not path.is_file():
        raise JiraOAuthError(
            "尚未配置 OAuth 应用。请在 Yolk「设置 → Jira 连接器」中填写 Client ID / Secret 并保存。"
        )
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    for key in ("client_id", "client_secret", "redirect_uri"):
        if not (raw.get(key) or "").strip():
            raise JiraOAuthError(f"OAuth 配置缺少 {key}")
    raw.setdefault("scopes", _DEFAULT_SCOPES)
    return raw


def save_oauth_state(state: str) -> None:
    path = _state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"state": state, "created_at": time.time()}, f)


def verify_oauth_state(state: str, max_age_sec: int = 600) -> None:
    path = _state_path()
    if not path.is_file():
        raise JiraOAuthError("OAuth 状态已失效，请重新点击登录")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if data.get("state") != state:
        raise JiraOAuthError("OAuth state 不匹配，请重新登录")
    if time.time() - float(data.get("created_at", 0)) > max_age_sec:
        raise JiraOAuthError("OAuth 登录超时，请重试")
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def build_authorize_url() -> Dict[str, str]:
    cfg = load_oauth_app_config()
    state = secrets.token_urlsafe(24)
    save_oauth_state(state)
    scopes = " ".join(cfg["scopes"])
    params = {
        "audience": "api.atlassian.com",
        "client_id": cfg["client_id"],
        "scope": scopes,
        "redirect_uri": cfg["redirect_uri"],
        "state": state,
        "response_type": "code",
        "prompt": "consent",
    }
    return {
        "authorize_url": f"{_AUTH_URL}?{urlencode(params)}",
        "state": state,
        "redirect_uri": cfg["redirect_uri"],
    }


def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    cfg = load_oauth_app_config()
    r = requests.post(
        _TOKEN_URL,
        json={
            "grant_type": "authorization_code",
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "code": code,
            "redirect_uri": cfg["redirect_uri"],
        },
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    if r.status_code >= 400:
        raise JiraOAuthError(f"换取 Token 失败 ({r.status_code}): {r.text[:500]}")
    return r.json()


def refresh_access_token(refresh_token: str) -> Dict[str, Any]:
    cfg = load_oauth_app_config()
    r = requests.post(
        _TOKEN_URL,
        json={
            "grant_type": "refresh_token",
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "refresh_token": refresh_token,
        },
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    if r.status_code >= 400:
        raise JiraOAuthError(f"刷新 Token 失败 ({r.status_code}): {r.text[:500]}")
    return r.json()


def fetch_accessible_resources(access_token: str) -> List[Dict[str, Any]]:
    r = requests.get(
        _RESOURCES_URL,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        timeout=30,
    )
    if r.status_code >= 400:
        raise JiraOAuthError(f"获取 Jira 站点失败 ({r.status_code}): {r.text[:500]}")
    return r.json()


def pick_jira_site(resources: List[Dict[str, Any]]) -> Dict[str, Any]:
    for item in resources:
        scopes = item.get("scopes") or []
        if any("jira" in s for s in scopes):
            return item
    if resources:
        return resources[0]
    raise JiraOAuthError("该 Atlassian 账户下没有可访问的 Jira 站点")
