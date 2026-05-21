import json
import logging
import os
import shutil
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Dict

from .json_repository import JSONSettingRepository
import time

from connectors.crypto import decrypt_secret, encrypt_secret
from connectors.jira.client import JiraClient, JiraClientError
from connectors.wechat.client import WeChatClient, WeChatClientError
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
    WeChatConnectorConfig,
    WeChatConnectorLogin,
    WeChatConnectorUpdate,
    WeChatConnectorStatus,
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
            return os.path.normpath(raw)
        return os.path.normpath(os.path.join(cfg.workSpace, raw))

    @staticmethod
    def _normalize_path(path: str) -> str:
        return os.path.normcase(os.path.normpath(path))

    def _is_under_workspace(self, root: str, target: str) -> bool:
        if not root or not target:
            return False
        root_n = self._normalize_path(root)
        target_n = self._normalize_path(target)
        try:
            return os.path.commonpath([root_n, target_n]) == root_n
        except ValueError:
            return False

    def _ensure_workspace_root(self, root: str) -> None:
        root = (root or "").strip()
        if not root:
            raise ValueError("工作域根路径未设置")
        os.makedirs(root, exist_ok=True)

    def _create_subdir(self, root: str, sub_path: str) -> None:
        if not self._is_under_workspace(root, sub_path):
            raise ValueError("子目录必须位于工作域根路径下")
        os.makedirs(sub_path, exist_ok=True)

    def _remove_subdir(self, root: str, sub_path: str) -> None:
        if not self._is_under_workspace(root, sub_path):
            raise ValueError("无法删除工作域外的目录")
        if os.path.isdir(sub_path):
            shutil.rmtree(sub_path)

    def add(self, data: WorkspaceSettingCreate) -> bool:
        super().load(WorkspaceConfig)
        cfg: WorkspaceConfig = super().get_store()
        if not cfg.workSpace:
            raise ValueError("请先设置工作域根路径")
        self._ensure_workspace_root(cfg.workSpace)
        full_path = self._resolve_sub_path(cfg, data)
        if any(
            self._normalize_path(sp.subPathName) == self._normalize_path(full_path)
            for sp in cfg.subPath
        ):
            raise ValueError("子目录已存在")
        self._create_subdir(cfg.workSpace, full_path)
        try:
            cfg.subPath.append(
                SubPathConfig(subPathName=full_path, permission=data.permission or "ro")
            )
            super().save()
            return True
        except Exception:
            if os.path.isdir(full_path):
                shutil.rmtree(full_path, ignore_errors=True)
            raise

    def update(self, param: dict, data: WorkspaceSettingUpdate) -> WorkspaceConfig:
        super().load(WorkspaceConfig)
        cfg: WorkspaceConfig = super().get_store()
        if data.workSpace is not None:
            cfg.workSpace = data.workSpace.strip()
            self._ensure_workspace_root(cfg.workSpace)
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
        if not target:
            raise ValueError("缺少要删除的子目录路径")
        target_n = self._normalize_path(target)
        matched = [
            sp
            for sp in cfg.subPath
            if self._normalize_path(sp.subPathName) == target_n
        ]
        if not matched:
            raise ValueError("子目录不存在")
        if cfg.workSpace:
            self._remove_subdir(cfg.workSpace, matched[0].subPathName)
        cfg.subPath = [
            sp for sp in cfg.subPath if self._normalize_path(sp.subPathName) != target_n
        ]
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


class WeChatConnectorRepository(
    JSONSettingRepository[WeChatConnectorConfig],
    SettingRepository[WeChatConnectorLogin, WeChatConnectorUpdate, WeChatConnectorConfig, dict],
):
    def __init__(self, json_path: str) -> None:
        super().__init__(json_path)
        self._ensure_loaded()

    def _ensure_loaded(self) -> None:
        self.load(WeChatConnectorConfig)

    def _client_from_login(self, login: WeChatConnectorLogin) -> WeChatClient:
        return WeChatClient(
            login.app_id.strip(),
            login.app_secret.strip(),
            api_base=(login.api_base_url or "https://api.weixin.qq.com").strip(),
        )

    def _ensure_fresh_token(self, cfg: WeChatConnectorConfig) -> WeChatClient:
        secret = decrypt_secret(cfg.app_secret_encrypted)
        if not cfg.app_id or not secret:
            raise ValueError("微信公众号未配置或 AppSecret 无效")
        client = WeChatClient(
            cfg.app_id,
            secret,
            api_base=cfg.api_base_url or "https://api.weixin.qq.com",
            access_token=decrypt_secret(cfg.access_token_encrypted),
            token_expires_at=cfg.token_expires_at,
        )
        if time.time() >= cfg.token_expires_at - 120:
            client.get_access_token(force_refresh=True)
            cfg.access_token_encrypted = encrypt_secret(client._access_token)
            cfg.token_expires_at = client.token_expires_at
            self.save()
        return client

    def client_from_store(self) -> WeChatClient | None:
        cfg: WeChatConnectorConfig = self.get_store()
        secret = decrypt_secret(cfg.app_secret_encrypted)
        if not cfg.app_id or not secret:
            return None
        try:
            return self._ensure_fresh_token(cfg)
        except (ValueError, WeChatClientError):
            return None

    def add(self, data: WeChatConnectorLogin) -> WeChatConnectorStatus:
        client = self._client_from_login(data)
        try:
            client.test_connection()
        except WeChatClientError as e:
            raise ValueError(str(e)) from e

        cfg = WeChatConnectorConfig(
            account_name=(data.account_name or "").strip(),
            app_id=data.app_id.strip(),
            app_secret_encrypted=encrypt_secret(data.app_secret.strip()),
            api_base_url=(data.api_base_url or "https://api.weixin.qq.com").strip().rstrip("/"),
            access_token_encrypted=encrypt_secret(client._access_token),
            token_expires_at=client.token_expires_at,
            default_author=(data.default_author or "").strip(),
        )
        self._store = cfg
        self.save()
        return self._to_status(cfg)

    def update(self, param: dict, data: WeChatConnectorUpdate) -> WeChatConnectorStatus:
        self._ensure_loaded()
        cfg: WeChatConnectorConfig = self.get_store()
        if data.account_name is not None:
            cfg.account_name = data.account_name.strip()
        if data.api_base_url is not None:
            cfg.api_base_url = data.api_base_url.strip().rstrip("/") or "https://api.weixin.qq.com"
        if data.default_author is not None:
            cfg.default_author = data.default_author.strip()
        if data.app_secret is not None and data.app_secret.strip():
            cfg.app_secret_encrypted = encrypt_secret(data.app_secret.strip())
            cfg.access_token_encrypted = ""
            cfg.token_expires_at = 0
        self.save()
        if cfg.app_id and cfg.app_secret_encrypted:
            try:
                self._ensure_fresh_token(cfg)
            except WeChatClientError as e:
                raise ValueError(str(e)) from e
        return self._to_status(cfg)

    def delete(self, param: dict | None = None) -> None:
        self._store = WeChatConnectorConfig()
        self.save()

    def get(self, param: dict | None = None) -> WeChatConnectorStatus:
        self._ensure_loaded()
        return self._to_status(self.get_store())

    def list(self) -> WeChatConnectorStatus:
        return self.get()

    def test_connection(self, param: dict | None = None) -> dict:
        if param and (param.get("app_id") or param.get("app_secret")):
            login = WeChatConnectorLogin(
                account_name=param.get("account_name", ""),
                app_id=param.get("app_id", ""),
                app_secret=param.get("app_secret", ""),
                api_base_url=param.get("api_base_url", "https://api.weixin.qq.com"),
            )
            client = self._client_from_login(login)
        else:
            client = self.client_from_store()
            if not client:
                raise ValueError("尚未配置微信公众号连接器，请先在设置中保存 AppID 与 AppSecret")
        try:
            result = client.test_connection()
        except WeChatClientError as e:
            raise ValueError(str(e)) from e
        return {
            "ok": True,
            "account_name": self.get_store().account_name,
            "ip_list": result.get("ip_list", []),
        }

    @staticmethod
    def _to_status(cfg: WeChatConnectorConfig) -> WeChatConnectorStatus:
        connected = bool(cfg.app_id and cfg.app_secret_encrypted)
        return WeChatConnectorStatus(
            account_name=cfg.account_name,
            app_id=cfg.app_id,
            connected=connected,
            api_base_url=cfg.api_base_url or "https://api.weixin.qq.com",
            default_author=cfg.default_author,
            has_app_secret=bool(cfg.app_secret_encrypted),
        )
