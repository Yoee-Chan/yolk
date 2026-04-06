from .config_paths import ConfigPaths
from .factories import (
    SettingFactory,
    WorkspaceSettingFactory,
    MCPSettingFactory,
)

paths = ConfigPaths("~/.agent_os/config")

SETTING_REGISTRY: dict[str, SettingFactory] = {
    "workspace": WorkspaceSettingFactory(paths),
    "mcp": MCPSettingFactory(paths),
}
