import os
from pathlib import Path


class ConfigPaths:
    def __init__(self, base_dir: Path):
        self.base_dir = os.path.expanduser(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    @property
    def workspace_json(self):
        return os.path.join(self.base_dir, "llm_config\workspace.json")

    @property
    def mcp_json(self):
        return os.path.join(self.base_dir, "mcp.json")
