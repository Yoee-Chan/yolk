"""技能清单：通过 YAML 描述定义可发现、可编排的系统技能。"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class SkillManifest:
    id: str
    name: str
    description: str
    version: str = "1.0.0"
    connector: Optional[str] = None
    tool: Optional[str] = None
    triggers: List[str] = field(default_factory=list)

    def matches_intent(self, text: str) -> bool:
        lowered = (text or "").lower()
        for t in self.triggers:
            if t.lower() in lowered:
                return True
        return False
