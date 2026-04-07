from dataclasses import dataclass, field
from typing import Optional
from typing import List


# ===== Workspace =====

@dataclass
class WorkspaceSetting:
    path: str
    sub_path: list[str]
    sandbox: bool


@dataclass
class WorkspaceParam:
    path: str
    sandbox: bool = True


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


@dataclass
class SubPathConfig:
    subPathName: str
    permission: str


@dataclass
class WorkspaceConfig:
    workSpace: str
    subPath: List[SubPathConfig] = field(default_factory=list)


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
class MCPParam:
    server_url: str
    token: str


@dataclass
class MCPSettingUpdate:
    server_url: Optional[str] = None
    token: Optional[str] = None
