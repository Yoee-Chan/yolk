from .config_paths import ConfigPaths
from pathlib import Path
from .setting_factories import (
    SettingFactory,
    WorkspaceSettingFactory,
    MCPSettingFactory,
)

# 获取项目下的配置文件
CURRENT_FILE = Path(__file__).resolve()
ROOT_DIR = CURRENT_FILE.parents[1]
LLM_CONFIG_DIR = ROOT_DIR
WORKSPACES_FILE = LLM_CONFIG_DIR
paths = ConfigPaths(WORKSPACES_FILE)

SETTING_REGISTRY: dict[str, SettingFactory] = {
    "workspace": WorkspaceSettingFactory(paths),
    "mcp": MCPSettingFactory(paths),
}
