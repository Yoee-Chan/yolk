"""从 definitions/*.json 加载技能描述并注册。"""

import json
from pathlib import Path
from typing import Dict, List

from skills.manifest import SkillManifest

_DEFINITIONS_DIR = Path(__file__).resolve().parent / "definitions"


def _parse_manifest(raw: dict) -> SkillManifest:
    return SkillManifest(
        id=raw["id"],
        name=raw["name"],
        description=(raw.get("description") or "").strip(),
        version=raw.get("version", "1.0.0"),
        connector=raw.get("connector"),
        tool=raw.get("tool"),
        triggers=list(raw.get("triggers") or []),
    )


class SkillRegistry:
    def __init__(self, definitions_dir: Path | None = None) -> None:
        self._definitions_dir = definitions_dir or _DEFINITIONS_DIR
        self._skills: Dict[str, SkillManifest] = {}
        self.reload()

    def reload(self) -> None:
        self._skills.clear()
        if not self._definitions_dir.is_dir():
            return
        for path in sorted(self._definitions_dir.glob("*.json")):
            with open(path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            manifest = _parse_manifest(raw)
            self._skills[manifest.id] = manifest

    def list(self) -> List[SkillManifest]:
        return list(self._skills.values())

    def get(self, skill_id: str) -> SkillManifest | None:
        return self._skills.get(skill_id)

    def find_by_intent(self, text: str) -> List[SkillManifest]:
        return [s for s in self._skills.values() if s.matches_intent(text)]


_default_registry: SkillRegistry | None = None


def get_skill_registry() -> SkillRegistry:
    global _default_registry
    if _default_registry is None:
        _default_registry = SkillRegistry()
    return _default_registry
