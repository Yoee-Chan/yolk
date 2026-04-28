import logging
import os
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Dict
import uuid

from .json_repository import JSONSettingRepository
from .data_models import (
    WorkspaceSetting,
    WorkspaceSettingCreate,
    WorkspaceSettingUpdate,
    MCPSetting,
    MCPSettingCreate,
    MCPSettingUpdate, WorkspaceParam, MCPParam, WorkspaceConfig, SubPathConfig,
)

TCreate = TypeVar("TCreate")
TUpdate = TypeVar("TUpdate")
TModel = TypeVar("TModel")
TParam = TypeVar("TParam")


class SettingRepository(ABC, Generic[TCreate, TUpdate, TModel, TParam]):
    @abstractmethod
    def add(self, data: TCreate) -> TModel:
        ...

    @abstractmethod
    def update(self, param: TParam, data: TUpdate) -> TModel:
        ...

    @abstractmethod
    def delete(self, param: TParam) -> None:
        ...

    @abstractmethod
    def get(self, param: TParam) -> TModel:
        ...

    @abstractmethod
    def list(self) -> list[TModel]:
        ...


# ===== 具体业务逻辑 =====

class WorkspaceSettingRepository(
    JSONSettingRepository[MCPSetting],
    SettingRepository[WorkspaceSettingCreate, WorkspaceSettingUpdate, WorkspaceSetting, WorkspaceParam]
):
    def __init__(self, json_path) -> None:
        super().__init__(json_path)
        self._store: Dict[str, WorkspaceSetting] = {}

    def add(self, data: WorkspaceSettingCreate) -> bool:
        try:
            super().load(WorkspaceConfig)
            result: WorkspaceConfig = super().get_store()
            temp = SubPathConfig(
                subPathName=data.path,
                permission=data.permission
            )
            result.subPath.append(temp)
            super().save()
        except Exception as e:
            logging.error(e)
            return False
        return True

    def update(self, path: WorkspaceParam, data: WorkspaceSettingUpdate) -> WorkspaceSetting:
        setting = self._store[path.path]
        if data.path is not None:
            setting.path = data.path.path
        if data.sandbox is not None:
            setting.sandbox = data.sandbox
        return setting

    def delete(self, path: WorkspaceParam) -> None:
        self._store.pop(path.path, None)

    def get(self, path: str) -> WorkspaceSetting:
        """
        search sub folder via path
        """
        dirs: list[str] = []
        for name in os.listdir(path):
            full = os.path.join(path, name)
            if os.path.isdir(full):
                dirs.append(full)
        search_subPath = WorkspaceSetting(path=path, sub_path=dirs, sandbox=False)
        return search_subPath

    def list(self) -> WorkspaceConfig:
        super().load(WorkspaceConfig)
        result = super().get_store()
        return result

    def _check_exists_workspace(self):
        ...


class MCPSettingRepository(
    JSONSettingRepository[MCPSetting],
    SettingRepository[MCPSettingCreate, MCPSettingUpdate, MCPSetting, MCPParam]
):
    def __init__(self, json_path) -> None:
        super().__init__(json_path)
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
