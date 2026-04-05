from abc import ABC, abstractmethod

from .models import (
    WorkspaceSettingCreate,
    WorkspaceSettingUpdate,
    MCPSettingCreate,
    MCPSettingUpdate,
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
        if not data.server_url:
            raise ValueError("mcp.server_url 不能为空")
        if not data.token:
            raise ValueError("mcp.token 不能为空")

    def validate_update(self, data: MCPSettingUpdate):
        # 这里可以加更多规则
        pass
