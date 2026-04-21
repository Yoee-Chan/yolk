import json
import os
from dataclasses import asdict, fields, is_dataclass
from typing import Dict, Type, TypeVar, Generic

TModel = TypeVar("TModel")


class JSONSettingRepository(Generic[TModel]):
    """
    通用 JSON 持久化基类：
    - 管理 _store 内存对象
    - 提供 load() / save() 方法
    """

    def get_store(self) -> TModel:
        return self._store

    def __init__(self, json_path: str):
        self.json_path = json_path
        self._store: TModel | None = None

    # -------------------------
    # 加载 JSON → dataclass
    # -------------------------
    def load(self, model_cls: Type[TModel]) -> None:
        if not os.path.exists(self.json_path):
            self._store = model_cls()  # 返回空对象
            return

        with open(self.json_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        kwargs = {}
        for field in fields(model_cls):
            value = raw.get(field.name)

            # 处理 List[dataclass]
            if hasattr(field.type, "__origin__") and field.type.__origin__ is list:
                inner_type = field.type.__args__[0]
                if is_dataclass(inner_type):
                    kwargs[field.name] = [
                        inner_type(**item) for item in (value or [])
                    ]
                else:
                    kwargs[field.name] = value or []

            # 处理嵌套 dataclass
            elif is_dataclass(field.type) and isinstance(value, dict):
                kwargs[field.name] = field.type(**value)

            else:
                kwargs[field.name] = value

        self._store = model_cls(**kwargs)

    # -------------------------
    # 保存 dataclass → JSON
    # -------------------------
    def save(self) -> None:
        raw = asdict(self._store)
        with open(self.json_path, "w", encoding="utf-8") as f:
            json.dump(raw, f, indent=2, ensure_ascii=False)
