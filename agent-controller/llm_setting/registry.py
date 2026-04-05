from .factories import (
    SettingFactory,
    WorkspaceSettingFactory,
    MCPSettingFactory,
)

SETTING_REGISTRY: dict[str, SettingFactory] = {
    "workspace": WorkspaceSettingFactory(),
    "mcp": MCPSettingFactory(),
}
