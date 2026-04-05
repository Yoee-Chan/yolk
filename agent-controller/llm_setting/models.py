from dataclasses import dataclass
from typing import Optional


# ===== Workspace =====

@dataclass
class WorkspaceSetting:
    id: str
    path: str
    sandbox: bool


@dataclass
class WorkspaceSettingCreate:
    path: str
    sandbox: bool = True


@dataclass
class WorkspaceSettingUpdate:
    path: Optional[str] = None
    sandbox: Optional[bool] = None


@dataclass
class SubWorkspaceSearch:
    sub_paths: list


# ===== MCP =====
@dataclass
class MCPSetting:
    id: str
    server_url: str
    token: str


@dataclass
class MCPSettingCreate:
    server_url: str
    token: str


@dataclass
class MCPSettingUpdate:
    server_url: Optional[str] = None
    token: Optional[str] = None
