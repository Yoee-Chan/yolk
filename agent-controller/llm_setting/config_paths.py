import os


class ConfigPaths:
    def __init__(self, base_dir: str):
        self.base_dir = os.path.expanduser(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    @property
    def workspace_json(self):
        return os.path.join(self.base_dir, "workspace.json")

    @property
    def mcp_json(self):
        return os.path.join(self.base_dir, "mcp.json")
