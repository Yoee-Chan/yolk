"""获取已登录的 Jira 客户端（含 OAuth 自动刷新）。"""

import os
from pathlib import Path
from typing import Optional

from connectors.jira.client import JiraClient
from llm_setting.setting_repositories import JiraConnectorRepository


def _connector_json_path() -> str:
    env = os.environ.get("YOLK_JIRA_CONNECTOR_JSON")
    if env:
        return env
    root = Path(__file__).resolve().parents[2]
    return str(root / "llm_config" / "jira_connector.json")


def get_authenticated_jira_client() -> Optional[JiraClient]:
    repo = JiraConnectorRepository(_connector_json_path())
    return repo._client_from_store()
