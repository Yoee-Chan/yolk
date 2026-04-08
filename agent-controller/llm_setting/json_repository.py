import json
import os
from dataclasses import asdict
from typing import Dict, Type, TypeVar, Generic
from dataclasses import fields, is_dataclass

TModel = TypeVar("TModel")


class JSONSettingRepository(Generic[TModel]):
    """
    通用 JSON 持久化基类：
    - 管理 _store 内存字典
    - 提供 load() / save() 方法
    """

    def get_store(self):
        return self._store

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

        # 只支持单对象配置，而不是多 key 的 dict
        # raw 是 WorkspaceConfig 对应的 dict
        kwargs = {}

        for field in fields(model_cls):
            value = raw.get(field.name)

            # 处理 List[SubPathConfig]
            if hasattr(field.type, "__origin__") and field.type.__origin__ is list:
                inner_type = field.type.__args__[0]

                if is_dataclass(inner_type):
                    # 列表里是 dataclass
                    kwargs[field.name] = [
                        inner_type(**item) for item in (value or [])
                    ]
                else:
                    # 列表里是普通类型
                    kwargs[field.name] = value or []

            # 处理嵌套 dataclass
            elif is_dataclass(field.type) and isinstance(value, dict):
                kwargs[field.name] = field.type()

            # 普通字段
            else:
                kwargs[field.name] = value

        # 生成最终模型
        self._store = model_cls(**kwargs)

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
