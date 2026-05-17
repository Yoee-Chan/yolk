import os
from pathlib import Path


class ConfigPaths:
    def __init__(self, base_dir: Path):
        self.base_dir = os.path.expanduser(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    @property
    def workspace_json(self):
        return os.path.join(self.base_dir, "llm_config", "workspace.json")

    @property
    def mcp_json(self):
        return os.path.join(self.base_dir, "mcp.json")

    @property
    def engine_mcp_json(self):
        return os.path.normpath(
            os.path.join(self.base_dir, "..", "local-llm-engine", "config", "mcp.json")
        )

    @property
    def engine_config_toml(self):
        return os.path.normpath(
            os.path.join(self.base_dir, "..", "local-llm-engine", "config", "config.toml")
        )

    @property
    def llm_provider_json(self):
        return os.path.join(self.base_dir, "llm_config", "llm_provider.json")

    @property
    def risk_json(self):
        return os.path.join(self.base_dir, "llm_config", "risk.json")

    @property
    def jira_connector_json(self):
        return os.path.join(self.base_dir, "llm_config", "jira_connector.json")
