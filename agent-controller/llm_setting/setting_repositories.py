import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Dict

from .json_repository import JSONSettingRepository
import time

from connectors.crypto import decrypt_secret, encrypt_secret
from connectors.jira.client import JiraClient, JiraClientError
from connectors.jira.oauth import (
    JiraOAuthError,
    build_authorize_url,
    exchange_code_for_tokens,
    fetch_accessible_resources,
    get_oauth_app_status,
    pick_jira_site,
    refresh_access_token,
    save_oauth_app_config,
    verify_oauth_state,
)
from .data_models import (
    WorkspaceSetting,
    WorkspaceSettingCreate,
    WorkspaceSettingUpdate,
    MCPSettingCreate,
    MCPSettingUpdate,
    MCPConfig,
    WorkspaceParam,
    WorkspaceConfig,
    SubPathConfig,
    JiraConnectorConfig,
    JiraConnectorLogin,
    JiraConnectorUpdate,
    JiraConnectorStatus,
    LLMProviderConfig,
    LLMProviderUpdate,
    RiskConfig,
    RiskConfigUpdate,
)
from .toml_io import read_llm_section, write_llm_section

TCreate = TypeVar("TCreate")
TUpdate = TypeVar("TUpdate")
TModel = TypeVar("TModel")
TParam = TypeVar("TParam")


class SettingRepository(ABC, Generic[TCreate, TUpdate, TModel, TParam]):
    @abstractmethod
    def add(self, data: TCreate) -> TModel:
        ...

    @abstractmethod
    def update(self, param: TParam, data: TUpdate) -> TModel:
        ...

    @abstractmethod
    def delete(self, param: TParam) -> None:
        ...

    @abstractmethod
    def get(self, param: TParam) -> TModel:
        ...

    @abstractmethod
    def list(self) -> list[TModel]:
        ...


# ===== 具体业务逻辑 =====

class WorkspaceSettingRepository(
    JSONSettingRepository[WorkspaceConfig],
    SettingRepository[WorkspaceSettingCreate, WorkspaceSettingUpdate, WorkspaceSetting, WorkspaceParam]
):
    def __init__(self, json_path) -> None:
        super().__init__(json_path)

    def _resolve_sub_path(self, cfg: WorkspaceConfig, data: WorkspaceSettingCreate) -> str:
        raw = (data.path or "").strip()
        if not raw:
            raise ValueError("子目录路径不能为空")
        if os.path.isabs(raw) or not cfg.workSpace:
            return raw
        return os.path.normpath(os.path.join(cfg.workSpace, raw))

    def add(self, data: WorkspaceSettingCreate) -> bool:
        try:
            super().load(WorkspaceConfig)
            cfg: WorkspaceConfig = super().get_store()
            full_path = self._resolve_sub_path(cfg, data)
            if any(sp.subPathName == full_path for sp in cfg.subPath):
                raise ValueError("子目录已存在")
            cfg.subPath.append(
                SubPathConfig(subPathName=full_path, permission=data.permission or "ro")
            )
            super().save()
            return True
        except Exception as e:
            logging.error(e)
            return False

    def update(self, param: dict, data: WorkspaceSettingUpdate) -> WorkspaceConfig:
        super().load(WorkspaceConfig)
        cfg: WorkspaceConfig = super().get_store()
        if data.workSpace is not None:
            cfg.workSpace = data.workSpace.strip()
        target = (param.get("path") or param.get("subPathName") or "").strip()
        if target:
            for sp in cfg.subPath:
                if sp.subPathName == target:
                    if data.permission is not None:
                        sp.permission = data.permission
                    if data.path is not None:
                        sp.subPathName = data.path.strip()
                    break
        super().save()
        return cfg

    def delete(self, param: dict) -> bool:
        super().load(WorkspaceConfig)
        cfg: WorkspaceConfig = super().get_store()
        target = (param.get("path") or param.get("subPathName") or "").strip()
        cfg.subPath = [sp for sp in cfg.subPath if sp.subPathName != target]
        super().save()
        return True

    def get(self, path: str) -> WorkspaceSetting:
        """列出指定路径下的子目录。"""
        dirs: list[str] = []
        if path and os.path.isdir(path):
            for name in os.listdir(path):
                full = os.path.join(path, name)
                if os.path.isdir(full):
                    dirs.append(full)
        return WorkspaceSetting(path=path, sub_path=dirs, sandbox=False)

    def list(self) -> WorkspaceConfig:
        super().load(WorkspaceConfig)
        return super().get_store()


class MCPSettingRepository(
    JSONSettingRepository[MCPConfig],
    SettingRepository[MCPSettingCreate, MCPSettingUpdate, MCPConfig, dict],
):
    def __init__(self, json_path: str, engine_json_path: str) -> None:
        super().__init__(json_path)
        self.engine_json_path = engine_json_path

    def _load_config(self) -> MCPConfig:
        super().load(MCPConfig)
        cfg: MCPConfig = super().get_store()
        if cfg.mcpServers is None:
            cfg.mcpServers = {}
        return cfg

    def _sync_engine(self) -> None:
        cfg = self._load_config()
        os.makedirs(os.path.dirname(self.engine_json_path), exist_ok=True)
        with open(self.engine_json_path, "w", encoding="utf-8") as f:
            json.dump({"mcpServers": cfg.mcpServers}, f, indent=2, ensure_ascii=False)

    def add(self, data: MCPSettingCreate) -> MCPConfig:
        cfg = self._load_config()
        name = data.name.strip()
        if not name:
            raise ValueError("MCP 服务器名称不能为空")
        cfg.mcpServers[name] = {"type": data.type, "url": data.url}
        super().save()
        self._sync_engine()
        return cfg

    def update(self, param: dict, data: MCPSettingUpdate) -> MCPConfig:
        cfg = self._load_config()
        name = (param.get("name") or "").strip()
        if not name or name not in cfg.mcpServers:
            raise ValueError("MCP 服务器不存在")
        entry = cfg.mcpServers[name]
        if data.type is not None:
            entry["type"] = data.type
        if data.url is not None:
            entry["url"] = data.url
        if data.name is not None and data.name != name:
            cfg.mcpServers[data.name.strip()] = entry
            del cfg.mcpServers[name]
        super().save()
        self._sync_engine()
        return cfg

    def delete(self, param: dict) -> bool:
        cfg = self._load_config()
        name = (param.get("name") or "").strip()
        cfg.mcpServers.pop(name, None)
        super().save()
        self._sync_engine()
        return True

    def get(self, param: dict | None = None) -> MCPConfig:
        return self._load_config()

    def list(self) -> MCPConfig:
        return self._load_config()


class LLMProviderRepository(
    JSONSettingRepository[LLMProviderConfig],
    SettingRepository[LLMProviderConfig, LLMProviderUpdate, LLMProviderConfig, dict],
):
    def __init__(self, json_path: str, engine_toml_path: str) -> None:
        super().__init__(json_path)
        self.engine_toml_path = engine_toml_path
        os.makedirs(os.path.dirname(json_path), exist_ok=True)

    def _load_merged(self) -> LLMProviderConfig:
        super().load(LLMProviderConfig)
        cfg: LLMProviderConfig = super().get_store()
        if os.path.exists(self.engine_toml_path):
            section = read_llm_section(self.engine_toml_path)
            if section:
                cfg.model = section.get("model", cfg.model) or cfg.model
                cfg.base_url = section.get("base_url", cfg.base_url) or cfg.base_url
                cfg.api_key = section.get("api_key", cfg.api_key) or cfg.api_key
                cfg.max_tokens = int(section.get("max_tokens", cfg.max_tokens))
                cfg.temperature = float(section.get("temperature", cfg.temperature))
                cfg.provider = section.get("api_type", cfg.provider) or cfg.provider
        return cfg

    def _sync_toml(self, cfg: LLMProviderConfig) -> None:
        write_llm_section(
            self.engine_toml_path,
            {
                "api_type": cfg.provider or "openai",
                "model": cfg.model,
                "base_url": cfg.base_url,
                "api_key": cfg.api_key,
                "max_tokens": cfg.max_tokens,
                "temperature": cfg.temperature,
            },
        )

    def add(self, data: LLMProviderConfig) -> LLMProviderConfig:
        self._store = data
        self.save()
        self._sync_toml(data)
        return data

    def update(self, param: dict, data: LLMProviderUpdate) -> LLMProviderConfig:
        cfg = self._load_merged()
        if data.provider is not None:
            cfg.provider = data.provider
        if data.model is not None:
            cfg.model = data.model
        if data.base_url is not None:
            cfg.base_url = data.base_url
        if data.api_key is not None and data.api_key != "":
            cfg.api_key = data.api_key
        if data.max_tokens is not None:
            cfg.max_tokens = data.max_tokens
        if data.temperature is not None:
            cfg.temperature = data.temperature
        self._store = cfg
        self.save()
        self._sync_toml(cfg)
        return cfg

    def delete(self, param: dict | None = None) -> bool:
        self._store = LLMProviderConfig()
        self.save()
        return True

    def get(self, param: dict | None = None) -> LLMProviderConfig:
        return self._load_merged()

    def list(self) -> LLMProviderConfig:
        return self._load_merged()


class RiskConfigRepository(
    JSONSettingRepository[RiskConfig],
    SettingRepository[RiskConfig, RiskConfigUpdate, RiskConfig, dict],
):
    def __init__(self, json_path: str) -> None:
        super().__init__(json_path)
        os.makedirs(os.path.dirname(json_path), exist_ok=True)

    def _ensure(self) -> RiskConfig:
        super().load(RiskConfig)
        return super().get_store()

    def add(self, data: RiskConfig) -> RiskConfig:
        self._store = data
        self.save()
        return data

    def update(self, param: dict, data: RiskConfigUpdate) -> RiskConfig:
        cfg = self._ensure()
        if data.risk_level is not None:
            cfg.risk_level = max(1, min(10, int(data.risk_level)))
        if data.confirm_strategy is not None:
            cfg.confirm_strategy = data.confirm_strategy
        self.save()
        return cfg

    def delete(self, param: dict | None = None) -> bool:
        self._store = RiskConfig()
        self.save()
        return True

    def get(self, param: dict | None = None) -> RiskConfig:
        return self._ensure()

    def list(self) -> RiskConfig:
        return self._ensure()


class JiraConnectorRepository(
    JSONSettingRepository[JiraConnectorConfig],
    SettingRepository[JiraConnectorLogin, JiraConnectorUpdate, JiraConnectorConfig, dict],
):
    def __init__(self, json_path: str) -> None:
        super().__init__(json_path)
        self._ensure_loaded()

    def _ensure_loaded(self) -> None:
        self.load(JiraConnectorConfig)

    def _client_from_login(self, login: JiraConnectorLogin) -> JiraClient:
        return JiraClient(login.site_url, login.email, login.api_token)

    def _ensure_fresh_oauth_token(self, cfg: JiraConnectorConfig) -> str:
        access = decrypt_secret(cfg.access_token_encrypted)
        if not access:
            raise ValueError("OAuth access_token 无效，请重新登录")
        if cfg.token_expires_at and time.time() < cfg.token_expires_at - 60:
            return access
        refresh = decrypt_secret(cfg.refresh_token_encrypted)
        if not refresh:
            return access
        try:
            tokens = refresh_access_token(refresh)
        except JiraOAuthError as e:
            raise ValueError(f"Token 已过期且刷新失败: {e}") from e
        cfg.access_token_encrypted = encrypt_secret(tokens["access_token"])
        if tokens.get("refresh_token"):
            cfg.refresh_token_encrypted = encrypt_secret(tokens["refresh_token"])
        cfg.token_expires_at = time.time() + float(tokens.get("expires_in", 3600))
        self.save()
        return tokens["access_token"]

    def _client_from_store(self) -> JiraClient | None:
        cfg: JiraConnectorConfig = self.get_store()
        if cfg.auth_type == "oauth":
            if not cfg.cloud_id:
                return None
            access = self._ensure_fresh_oauth_token(cfg)
            return JiraClient.from_oauth(access, cfg.cloud_id, cfg.site_url)
        token = decrypt_secret(cfg.api_token_encrypted)
        if not cfg.site_url or not cfg.email or not token:
            return None
        return JiraClient(cfg.site_url, cfg.email, token)

    def oauth_app_status(self, param: dict | None = None) -> dict:
        return get_oauth_app_status()

    def oauth_app_save(self, param: dict) -> dict:
        try:
            return save_oauth_app_config(
                client_id=param.get("client_id", ""),
                client_secret=param.get("client_secret", ""),
                redirect_uri=param.get("redirect_uri", ""),
            )
        except JiraOAuthError as e:
            raise ValueError(str(e)) from e

    def oauth_start(self, param: dict | None = None) -> dict:
        return build_authorize_url()

    def oauth_finish(self, param: dict) -> JiraConnectorStatus:
        code = (param.get("code") or "").strip()
        state = (param.get("state") or "").strip()
        if not code or not state:
            raise ValueError("缺少 OAuth code 或 state")
        verify_oauth_state(state)
        try:
            tokens = exchange_code_for_tokens(code)
            access = tokens["access_token"]
            resources = fetch_accessible_resources(access)
            site = pick_jira_site(resources)
            cloud_id = site["id"]
            site_url = (site.get("url") or "").strip().rstrip("/")
            client = JiraClient.from_oauth(access, cloud_id, site_url)
            myself = client.test_connection()
        except (JiraOAuthError, JiraClientError) as e:
            raise ValueError(str(e)) from e

        default_pk = (param.get("default_project_key") or "").strip().upper()
        cfg = JiraConnectorConfig(
            auth_type="oauth",
            site_url=site_url,
            email=myself.get("emailAddress") or "",
            cloud_id=cloud_id,
            access_token_encrypted=encrypt_secret(access),
            refresh_token_encrypted=encrypt_secret(tokens.get("refresh_token") or ""),
            token_expires_at=time.time() + float(tokens.get("expires_in", 3600)),
            default_project_key=default_pk,
            display_name=myself.get("displayName") or "",
        )
        self._store = cfg
        self.save()
        return self._to_status(cfg)

    def add(self, data: JiraConnectorLogin) -> JiraConnectorStatus:
        client = self._client_from_login(data)
        try:
            myself = client.test_connection()
        except JiraClientError as e:
            raise ValueError(str(e)) from e
        cfg = JiraConnectorConfig(
            site_url=data.site_url.strip().rstrip("/"),
            email=data.email.strip(),
            api_token_encrypted=encrypt_secret(data.api_token.strip()),
            default_project_key=(data.default_project_key or "").strip().upper(),
            display_name=myself.get("displayName") or myself.get("emailAddress", ""),
        )
        self._store = cfg
        self.save()
        return self._to_status(cfg)

    def update(self, param: dict, data: JiraConnectorUpdate) -> JiraConnectorStatus:
        self._ensure_loaded()
        cfg: JiraConnectorConfig = self.get_store()
        if data.default_project_key is not None:
            cfg.default_project_key = data.default_project_key.strip().upper()
        self.save()
        return self._to_status(cfg)

    def delete(self, param: dict | None = None) -> None:
        self._store = JiraConnectorConfig()
        self.save()

    def get(self, param: dict | None = None) -> JiraConnectorStatus:
        self._ensure_loaded()
        return self._to_status(self.get_store())

    def list(self) -> JiraConnectorStatus:
        return self.get()

    def test_connection(self, param: dict | None = None) -> dict:
        """测试连接；param 可带临时凭据，否则用已保存凭据。"""
        if param and param.get("api_token"):
            login = JiraConnectorLogin(
                site_url=param.get("site_url", ""),
                email=param.get("email", ""),
                api_token=param.get("api_token", ""),
            )
            client = self._client_from_login(login)
        else:
            client = self._client_from_store()
            if not client:
                raise ValueError("尚未登录 Jira，请先在设置中配置连接器")
        try:
            myself = client.test_connection()
        except JiraClientError as e:
            raise ValueError(str(e)) from e
        return {
            "ok": True,
            "displayName": myself.get("displayName"),
            "emailAddress": myself.get("emailAddress"),
        }

    def get_decrypted_credentials(self) -> tuple[str, str, str] | None:
        self._ensure_loaded()
        cfg: JiraConnectorConfig = self.get_store()
        token = decrypt_secret(cfg.api_token_encrypted)
        if not cfg.site_url or not cfg.email or not token:
            return None
        return cfg.site_url, cfg.email, token

    @staticmethod
    def _to_status(cfg: JiraConnectorConfig) -> JiraConnectorStatus:
        if cfg.auth_type == "oauth":
            connected = bool(cfg.cloud_id and cfg.access_token_encrypted)
        else:
            connected = bool(
                cfg.site_url and cfg.email and cfg.api_token_encrypted
            )
        return JiraConnectorStatus(
            site_url=cfg.site_url,
            email=cfg.email,
            connected=connected,
            auth_type=cfg.auth_type or ("oauth" if cfg.cloud_id else "api_token"),
            default_project_key=cfg.default_project_key,
            display_name=cfg.display_name,
        )
