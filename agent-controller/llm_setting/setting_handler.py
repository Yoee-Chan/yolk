import logging
from typing import Any
from registrar.setting_registry import SETTING_REGISTRY


class SettingHandler():
    def __init__(self, setting_type):
        self.setting_type = setting_type
        if setting_type not in SETTING_REGISTRY:
            raise ValueError(f"未知的 setting_type: {setting_type}")
        factory = SETTING_REGISTRY[setting_type]
        self.repo = factory.get_repository()
        self.validator = factory.get_validator()
        self.factory = factory

    def add(self, data: dict[str, Any]) -> bool:
        CreateModel = self.factory.get_create_model()
        create_obj = CreateModel(**data)
        self.validator.validate_create(create_obj)
        return self.repo.add(create_obj)

    def update(self, data: dict[str, Any]) -> Any:
        try:
            UpdateModel = self.factory.get_update_model()
            update_obj = UpdateModel(**data)
            self.validator.validate_update(update_obj)
            if hasattr(self.repo, "update"):
                return self.repo.update(data, update_obj)
            return False
        except Exception as e:
            logging.error(f"Get an error when update---{self.setting_type}--{e}")
            return False

    def delete(self, data: dict[str, Any]) -> Any:
        return self.repo.delete(data)

    def search(self) -> list:
        try:
            return self.repo.list()
        except Exception as e:
            # logging.error(f"Get an error when search---{self.setting_type}--{e}")
            return []

    def search_by_id(self, data: dict[str, Any]) -> Any:
        try:
            path = data.get("path") or data.get("id")
            if not path:
                raise ValueError("缺少 path 参数")
            return self.repo.get(path)
        except Exception as e:
            logging.error(f"Get an error when search_by_id---{self.setting_type}--{e}")
            return None

    def test_connection(self, data: dict[str, Any]) -> Any:
        if hasattr(self.repo, "test_connection"):
            return self.repo.test_connection(data)
        raise ValueError(f"{self.setting_type} 不支持 test 命令")

    def oauth_start(self, data: dict[str, Any]) -> Any:
        if hasattr(self.repo, "oauth_start"):
            return self.repo.oauth_start(data)
        raise ValueError(f"{self.setting_type} 不支持 oauth_start 命令")

    def oauth_finish(self, data: dict[str, Any]) -> Any:
        if hasattr(self.repo, "oauth_finish"):
            return self.repo.oauth_finish(data)
        raise ValueError(f"{self.setting_type} 不支持 oauth_finish 命令")

    def oauth_app_status(self, data: dict[str, Any]) -> Any:
        if hasattr(self.repo, "oauth_app_status"):
            return self.repo.oauth_app_status(data)
        raise ValueError(f"{self.setting_type} 不支持 oauth_app_status 命令")

    def oauth_app_save(self, data: dict[str, Any]) -> Any:
        if hasattr(self.repo, "oauth_app_save"):
            return self.repo.oauth_app_save(data)
        raise ValueError(f"{self.setting_type} 不支持 oauth_app_save 命令")

