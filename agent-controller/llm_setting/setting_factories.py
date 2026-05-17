from abc import ABC, abstractmethod
from typing import Type

from .config_paths import ConfigPaths
from .setting_repositories import (
    SettingRepository,
    WorkspaceSettingRepository,
    MCPSettingRepository,
    JiraConnectorRepository,
    LLMProviderRepository,
    RiskConfigRepository,
)
from .data_validators import (
    Validator,
    WorkspaceSettingValidator,
    MCPSettingValidator,
    JiraConnectorValidator,
    LLMProviderValidator,
    RiskConfigValidator,
)
from .data_models import (
    WorkspaceSettingCreate,
    WorkspaceSettingUpdate,
    MCPSettingCreate,
    MCPSettingUpdate,
    JiraConnectorLogin,
    JiraConnectorUpdate,
    LLMProviderConfig,
    LLMProviderUpdate,
    RiskConfig,
    RiskConfigUpdate,
)
from .opt_risk import (
    LowRiskStrategy,
    MediumRiskStrategy,
    HighRiskStrategy,
    ExtremeRiskStrategy,
    RiskStrategy,
)


class SettingFactory(ABC):
    @abstractmethod
    def get_repository(self) -> SettingRepository:
        ...

    @abstractmethod
    def get_validator(self) -> Validator:
        ...

    @abstractmethod
    def get_create_model(self) -> Type:
        ...

    @abstractmethod
    def get_update_model(self) -> Type:
        ...

    @abstractmethod
    def get_risk_strategy(self, action: str) -> RiskStrategy:
        """根据 action 返回风险策略"""
        ...


class WorkspaceSettingFactory(SettingFactory):
    def __init__(self,paths:ConfigPaths) -> None:
        self._repo = WorkspaceSettingRepository(paths.workspace_json)
        self._validator = WorkspaceSettingValidator()

    def get_repository(self):
        return self._repo

    def get_validator(self):
        return self._validator

    def get_create_model(self):
        return WorkspaceSettingCreate

    def get_update_model(self):
        return WorkspaceSettingUpdate

    def get_risk_strategy(self, action: str) -> RiskStrategy:
        # 需要从配置文件中读取
        if action == "delete":
            return HighRiskStrategy()
        if action == "add":
            return MediumRiskStrategy()
        return LowRiskStrategy()


class MCPSettingFactory(SettingFactory):
    def __init__(self, paths: ConfigPaths) -> None:
        self._repo = MCPSettingRepository(paths.mcp_json, paths.engine_mcp_json)
        self._validator = MCPSettingValidator()

    def get_repository(self):
        return self._repo

    def get_validator(self):
        return self._validator

    def get_create_model(self):
        return MCPSettingCreate

    def get_update_model(self):
        return MCPSettingUpdate

    def get_risk_strategy(self, action: str) -> RiskStrategy:
        if action == "add":
            return HighRiskStrategy()
        if action == "delete":
            return ExtremeRiskStrategy()
        return MediumRiskStrategy()


class JiraConnectorSettingFactory(SettingFactory):
    def __init__(self, paths: ConfigPaths) -> None:
        import os

        os.makedirs(os.path.dirname(paths.jira_connector_json), exist_ok=True)
        self._repo = JiraConnectorRepository(paths.jira_connector_json)
        self._validator = JiraConnectorValidator()

    def get_repository(self):
        return self._repo

    def get_validator(self):
        return self._validator

    def get_create_model(self):
        return JiraConnectorLogin

    def get_update_model(self):
        return JiraConnectorUpdate

    def get_risk_strategy(self, action: str) -> RiskStrategy:
        if action in ("add", "delete"):
            return HighRiskStrategy()
        return MediumRiskStrategy()


class LLMProviderSettingFactory(SettingFactory):
    def __init__(self, paths: ConfigPaths) -> None:
        import os

        os.makedirs(os.path.dirname(paths.llm_provider_json), exist_ok=True)
        self._repo = LLMProviderRepository(
            paths.llm_provider_json, paths.engine_config_toml
        )
        self._validator = LLMProviderValidator()

    def get_repository(self):
        return self._repo

    def get_validator(self):
        return self._validator

    def get_create_model(self):
        return LLMProviderConfig

    def get_update_model(self):
        return LLMProviderUpdate

    def get_risk_strategy(self, action: str) -> RiskStrategy:
        return HighRiskStrategy() if action in ("add", "delete") else MediumRiskStrategy()


class RiskSettingFactory(SettingFactory):
    def __init__(self, paths: ConfigPaths) -> None:
        import os

        os.makedirs(os.path.dirname(paths.risk_json), exist_ok=True)
        self._repo = RiskConfigRepository(paths.risk_json)
        self._validator = RiskConfigValidator()

    def get_repository(self):
        return self._repo

    def get_validator(self):
        return self._validator

    def get_create_model(self):
        return RiskConfig

    def get_update_model(self):
        return RiskConfigUpdate

    def get_risk_strategy(self, action: str) -> RiskStrategy:
        return LowRiskStrategy()
