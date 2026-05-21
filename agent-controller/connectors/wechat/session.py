"""从本地配置获取已认证的微信公众号客户端。"""

import os
from pathlib import Path

from llm_setting.config_paths import ConfigPaths
from llm_setting.setting_repositories import WeChatConnectorRepository


def _connector_json_path() -> str:
    env = os.environ.get("YOLK_WECHAT_CONNECTOR_JSON")
    if env:
        return env
    root = Path(__file__).resolve().parents[2]
    return ConfigPaths(str(root)).wechat_connector_json


def get_authenticated_wechat_client():
    repo = WeChatConnectorRepository(_connector_json_path())
    return repo.client_from_store()
