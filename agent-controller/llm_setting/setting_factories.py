from abc import ABC, abstractmethod
from typing import Type

from .setting_repositories import (
    SettingRepository,
    WorkspaceSettingRepository,
    MCPSettingRepository,
)
from .validators import (
    Validator,
    WorkspaceSettingValidator,
    MCPSettingValidator,
)
from .models import (
    WorkspaceSettingCreate,
    WorkspaceSettingUpdate,
    MCPSettingCreate,
    MCPSettingUpdate,
)
from .risk import (
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
    def __init__(self,paths) -> None:
        self._repo = WorkspaceSettingRepository(paths)
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
    def __init__(self,paths) -> None:
        self._repo = MCPSettingRepository(paths)
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
