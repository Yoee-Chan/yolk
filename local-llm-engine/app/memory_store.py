import json
from abc import ABC, abstractmethod
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Optional

from app.config import PROJECT_ROOT
from app.logger import logger
from app.schema import Memory


class MemoryStore(ABC):
    """Persistence boundary for agent memory."""

    @abstractmethod
    def load(self) -> Memory:
        """Load memory from the backing store."""

    @abstractmethod
    def save(self, memory: Memory) -> None:
        """Save memory to the backing store."""


class JsonMemoryStore(MemoryStore):
    """JSON-file implementation of MemoryStore."""

    def __init__(self, path: Optional[Path | str] = None) -> None:
        self.path = Path(path) if path else PROJECT_ROOT / "data" / "memory" / "memory.json"

    def load(self) -> Memory:
        if not self.path.exists():
            return Memory()

        try:
            with self.path.open("r", encoding="utf-8") as file:
                data: Any = json.load(file)
            return Memory.model_validate(data)
        except Exception as exc:
            logger.warning(f"Failed to load memory from {self.path}: {exc}")
            return Memory()

    def save(self, memory: Memory) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = memory.model_dump(mode="json")

        try:
            with NamedTemporaryFile(
                "w",
                encoding="utf-8",
                dir=self.path.parent,
                delete=False,
                suffix=".tmp",
            ) as temp_file:
                json.dump(data, temp_file, ensure_ascii=False, indent=2)
                temp_path = Path(temp_file.name)
            temp_path.replace(self.path)
        except Exception as exc:
            logger.warning(f"Failed to save memory to {self.path}: {exc}")
            if "temp_path" in locals() and temp_path.exists():
                temp_path.unlink(missing_ok=True)
