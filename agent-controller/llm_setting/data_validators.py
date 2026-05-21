from abc import ABC, abstractmethod

from .data_models import (
    WorkspaceSettingCreate,
    WorkspaceSettingUpdate,
    MCPSettingCreate,
    MCPSettingUpdate,
    JiraConnectorLogin,
    JiraConnectorUpdate,
    WeChatConnectorLogin,
    WeChatConnectorUpdate,
    LLMProviderConfig,
    LLMProviderUpdate,
    RiskConfig,
    RiskConfigUpdate,
)


class Validator(ABC):
    @abstractmethod
    def validate_create(self, data):
        ...

    @abstractmethod
    def validate_update(self, data):
        ...


# ===== Workspace =====

class WorkspaceSettingValidator(Validator):
    def validate_create(self, data: WorkspaceSettingCreate):
        if not data.path:
            raise ValueError("workspace.path 不能为空")

    def validate_update(self, data: WorkspaceSettingUpdate):
        # 这里可以加更多规则
        pass


# ===== MCP =====

class MCPSettingValidator(Validator):
    def validate_create(self, data: MCPSettingCreate):
        if not (data.name or "").strip():
            raise ValueError("mcp.name 不能为空")
        if not (data.type or "").strip():
            raise ValueError("mcp.type 不能为空")
        if not (data.url or "").strip():
            raise ValueError("mcp.url 不能为空")

    def validate_update(self, data: MCPSettingUpdate):
        pass


class LLMProviderValidator(Validator):
    def validate_create(self, data: LLMProviderConfig):
        if not (data.model or "").strip():
            raise ValueError("llm.model 不能为空")
        if not (data.base_url or "").strip():
            raise ValueError("llm.base_url 不能为空")

    def validate_update(self, data: LLMProviderUpdate):
        pass


class RiskConfigValidator(Validator):
    def validate_create(self, data: RiskConfig):
        if data.risk_level < 1 or data.risk_level > 10:
            raise ValueError("risk_level 必须在 1-10 之间")
        if data.confirm_strategy not in ("all", "high", "llm"):
            raise ValueError("confirm_strategy 无效")

    def validate_update(self, data: RiskConfigUpdate):
        if data.risk_level is not None and (data.risk_level < 1 or data.risk_level > 10):
            raise ValueError("risk_level 必须在 1-10 之间")
        if data.confirm_strategy is not None and data.confirm_strategy not in (
            "all",
            "high",
            "llm",
        ):
            raise ValueError("confirm_strategy 无效")


# ===== Jira Connector =====

class JiraConnectorValidator(Validator):
    def validate_create(self, data: JiraConnectorLogin):
        if not (data.site_url or "").strip():
            raise ValueError("jira.site_url 不能为空")
        if not (data.email or "").strip():
            raise ValueError("jira.email 不能为空")
        if not (data.api_token or "").strip():
            raise ValueError("jira.api_token 不能为空")

    def validate_update(self, data: JiraConnectorUpdate):
        pass


# ===== WeChat Connector =====

class WeChatConnectorValidator(Validator):
    def validate_create(self, data: WeChatConnectorLogin):
        if not (data.app_id or "").strip():
            raise ValueError("wechat.app_id 不能为空")
        if not (data.app_secret or "").strip():
            raise ValueError("wechat.app_secret 不能为空")

    def validate_update(self, data: WeChatConnectorUpdate):
        if data.api_base_url is not None and not (data.api_base_url or "").strip():
            raise ValueError("wechat.api_base_url 不能为空")
