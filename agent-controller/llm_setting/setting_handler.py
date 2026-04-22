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
        try:
            CreateModel = self.factory.get_create_model()
            create_obj = CreateModel(**data)
            self.validator.validate_create(create_obj)

            self.repo.add(create_obj)
            return True
        except Exception as e:
            logging.error(f"Get an error when add---{self.setting_type}--{e}")
            return False

    def update(self, data: dict[str, Any]) -> bool:
        ...
        # try:
        #     UpdateModel = self.factory.get_update_model()
        #     update_obj = UpdateModel(**data["update"])
        #     self.validator.validate_update(update_obj)
        #     return self.repo.update(data["id"], update_obj)
        # except Exception as e:
        #     logging.error(f"Get an error when update---{self.setting_type}--{e}")
        #     return False

    def delete(self, data: dict[str, Any]) -> bool:
        ...
        # try:
        #     self.repo.delete(data["id"])
        #     return True
        # except Exception as e:
        #     logging.error(f"Get an error when delete---{self.setting_type}--{e}")
        #     return False

    def search(self) -> list:
        try:
            return self.repo.list()
        except Exception as e:
            # logging.error(f"Get an error when search---{self.setting_type}--{e}")
            return []

    def search_by_id(self, data: dict[str, Any]) -> list:
        ...
        # try:
        #
        #     return self.repo.get(data["path"])
        # except Exception as e:
        #     logging.error(f"Get an error when search---{self.setting_type}--{e}")
        #     logging.error(e)
        #     return []
