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
    permission: str = 'ro'
    sandbox: bool = True


@dataclass
class WorkspaceSettingUpdate:
    path: Optional[str] = None
    permission: Optional[str] = None
    workSpace: Optional[str] = None
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
class MCPServerEntry:
    type: str
    url: str = ""


@dataclass
class MCPConfig:
    mcpServers: dict = field(default_factory=dict)


@dataclass
class MCPSettingCreate:
    name: str
    type: str
    url: str


@dataclass
class MCPSettingUpdate:
    name: Optional[str] = None
    type: Optional[str] = None
    url: Optional[str] = None


# ===== LLM Provider =====
@dataclass
class LLMProviderConfig:
    provider: str = "openai"
    model: str = ""
    base_url: str = ""
    api_key: str = ""
    max_tokens: int = 8192
    temperature: float = 0.7


@dataclass
class LLMProviderUpdate:
    provider: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None


# ===== Risk =====
@dataclass
class RiskConfig:
    risk_level: int = 5
    confirm_strategy: str = "high"


@dataclass
class RiskConfigUpdate:
    risk_level: Optional[int] = None
    confirm_strategy: Optional[str] = None


# ===== Jira Connector =====

@dataclass
class JiraConnectorConfig:
    """持久化配置（令牌字段均为加密密文）。"""

    auth_type: str = ""  # oauth | api_token
    site_url: str = ""
    email: str = ""
    cloud_id: str = ""
    api_token_encrypted: str = ""
    access_token_encrypted: str = ""
    refresh_token_encrypted: str = ""
    token_expires_at: float = 0
    default_project_key: str = ""
    display_name: str = ""


@dataclass
class JiraConnectorLogin:
    site_url: str
    email: str
    api_token: str
    default_project_key: str = ""


@dataclass
class JiraConnectorStatus:
    site_url: str
    email: str
    connected: bool
    auth_type: str = ""
    default_project_key: str = ""
    display_name: str = ""


@dataclass
class JiraConnectorUpdate:
    default_project_key: Optional[str] = None
