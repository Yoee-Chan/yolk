import os
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Dict
import uuid
from .models import (
    WorkspaceSetting,
    WorkspaceSettingCreate,
    WorkspaceSettingUpdate,
    MCPSetting,
    MCPSettingCreate,
    MCPSettingUpdate,
)

TCreate = TypeVar("TCreate")
TUpdate = TypeVar("TUpdate")
TModel = TypeVar("TModel")


class SettingRepository(ABC, Generic[TCreate, TUpdate, TModel]):
    @abstractmethod
    def add(self, data: TCreate) -> TModel:
        ...

    @abstractmethod
    def update(self, id_: str, data: TUpdate) -> TModel:
        ...

    @abstractmethod
    def delete(self, id_: str) -> None:
        ...

    @abstractmethod
    def get(self, id_: str) -> TModel:
        ...

    @abstractmethod
    def list(self) -> list[TModel]:
        ...


# ===== 具体业务逻辑 =====

class WorkspaceSettingRepository(
    SettingRepository[WorkspaceSettingCreate, WorkspaceSettingUpdate, WorkspaceSetting]
):
    def __init__(self) -> None:
        self._store: Dict[str, WorkspaceSetting] = {}

    def add(self, data: WorkspaceSettingCreate) -> WorkspaceSetting:
        new_id = str(uuid.uuid4())
        setting = WorkspaceSetting(
            id=new_id,
            path=data.path,
            sandbox=data.sandbox,
        )
        self._store[new_id] = setting
        return setting

    def update(self, id_: str, data: WorkspaceSettingUpdate) -> WorkspaceSetting:
        setting = self._store[id_]
        if data.path is not None:
            setting.path = data.path
        if data.sandbox is not None:
            setting.sandbox = data.sandbox
        return setting

    def delete(self, id_: str) -> None:
        self._store.pop(id_, None)

    def get(self, id_: str) -> list[WorkspaceSetting]:
        """
        search sub folder via path
        """
        dirs: list[WorkspaceSetting] = []
        for name in os.listdir(id_):
            full = os.path.join(id_, name)
            if os.path.isdir(full):
                ws = WorkspaceSetting(path=full, id=id_, sandbox=False)
                dirs.append(ws)
        return dirs

    def list(self) -> list[WorkspaceSetting]:
        return list(self._store.values())


class MCPSettingRepository(
    SettingRepository[MCPSettingCreate, MCPSettingUpdate, MCPSetting]
):
    def __init__(self) -> None:
        self._store: Dict[str, MCPSetting] = {}

    def add(self, data: MCPSettingCreate) -> MCPSetting:
        new_id = str(uuid.uuid4())
        setting = MCPSetting(
            id=new_id,
            server_url=data.server_url,
            token=data.token,
        )
        self._store[new_id] = setting
        return setting

    def update(self, id_: str, data: MCPSettingUpdate) -> MCPSetting:
        setting = self._store[id_]
        if data.server_url is not None:
            setting.server_url = data.server_url
        if data.token is not None:
            setting.token = data.token
        return setting

    def delete(self, id_: str) -> None:
        self._store.pop(id_, None)

    def get(self, id_: str) -> MCPSetting:
        return self._store[id_]

    def list(self) -> list[MCPSetting]:
        return list(self._store.values())
