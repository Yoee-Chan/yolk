import os
from llm_setting.json_repository import JSONSettingRepository
from dataclasses import dataclass, field
from typing import List
from pathlib import Path, WindowsPath

from llm_setting.models import WorkspaceConfig


class ConfigPaths:
    def __init__(self, base_dir: Path):
        self.base_dir = os.path.expanduser(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    @property
    def workspace_json(self):

        return os.path.join(self.base_dir,"llm_config\workspace.json")

    @property
    def mcp_json(self):
        return os.path.join(self.base_dir, "mcp.json")


if __name__ == '__main__':

    CURRENT_FILE = Path(__file__).resolve()
    ROOT_DIR = CURRENT_FILE.parents[1]
    LLM_CONFIG_DIR = ROOT_DIR
    WORKSPACES_FILE = LLM_CONFIG_DIR
    paths = ConfigPaths(WORKSPACES_FILE)
    json_path=paths.workspace_json
    print(json_path)
    result = WorkspaceConfig
    jon = JSONSettingRepository(json_path)
    jon.load(result)
    print(jon.get())



