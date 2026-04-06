import json
import os
from dataclasses import asdict
from typing import Dict, Type, TypeVar, Generic

TModel = TypeVar("TModel")


class JSONSettingRepository(Generic[TModel]):
    """
    通用 JSON 持久化基类：
    - 管理 _store 内存字典
    - 提供 load() / save() 方法
    - 子类只需要实现 CRUD 业务逻辑
    """

    def __init__(self, json_path: str):
        self.json_path = json_path
        self._store: Dict[str, TModel] = {}

    # -------------------------
    # 加载 JSON → 内存
    # -------------------------
    def load(self, model_cls: Type[TModel]) -> None:
        if not os.path.exists(self.json_path):
            self._store = {}
            return

        with open(self.json_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        # 反序列化成模型对象
        self._store = {
            key: model_cls(**value)
            for key, value in raw.items()
        }

    # -------------------------
    # 保存 内存 → JSON
    # -------------------------
    def save(self) -> None:
        raw = {
            key: asdict(value)
            for key, value in self._store.items()
        }

        with open(self.json_path, "w", encoding="utf-8") as f:
            json.dump(raw, f, indent=2, ensure_ascii=False)
