from llm_setting.config_paths import ConfigPaths
from pathlib import Path
from llm_setting.setting_factories import (
    SettingFactory,
    WorkspaceSettingFactory,
    MCPSettingFactory,
    JiraConnectorSettingFactory,
    LLMProviderSettingFactory,
    RiskSettingFactory,
)


def get_path():
    # 获取项目下的配置文件
    CURRENT_FILE = Path(__file__).resolve()
    ROOT_DIR = CURRENT_FILE.parents[1]
    LLM_CONFIG_DIR = ROOT_DIR
    WORKSPACES_FILE = LLM_CONFIG_DIR
    return ConfigPaths(WORKSPACES_FILE)


SETTING_REGISTRY: dict[str, SettingFactory] = {
    "workspace": WorkspaceSettingFactory(get_path()),
    "mcp": MCPSettingFactory(get_path()),
    "jira_connector": JiraConnectorSettingFactory(get_path()),
    "llm_provider": LLMProviderSettingFactory(get_path()),
    "risk": RiskSettingFactory(get_path()),
}
