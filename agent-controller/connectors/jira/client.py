"""Jira Cloud REST API 客户端（OAuth 2.0 / API Token）。"""

from typing import Any, Dict, Optional
from urllib.parse import urljoin

import requests
from requests.auth import HTTPBasicAuth


class JiraClientError(Exception):
    pass


class JiraClient:
    def __init__(
        self,
        site_url: str = "",
        email: str = "",
        api_token: str = "",
        *,
        access_token: str = "",
        cloud_id: str = "",
        auth_type: str = "basic",
    ) -> None:
        self.auth_type = auth_type
        self.site_url = (site_url or "").strip().rstrip("/")
        self.email = email
        self.cloud_id = cloud_id

        self.session = requests.Session()
        self.session.headers.update(
            {"Accept": "application/json", "Content-Type": "application/json"}
        )

        if auth_type == "oauth":
            if not cloud_id or not access_token:
                raise JiraClientError("OAuth 模式需要 cloud_id 与 access_token")
            self.base_url = f"https://api.atlassian.com/ex/jira/{cloud_id}"
            self.session.headers["Authorization"] = f"Bearer {access_token}"
        else:
            base = self.site_url
            if not base.startswith("http"):
                base = f"https://{base}"
            self.base_url = base
            self.session.auth = HTTPBasicAuth(email, api_token)

    def _url(self, path: str) -> str:
        return urljoin(self.base_url + "/", path.lstrip("/"))

    def browse_url(self, issue_key: str) -> Optional[str]:
        if not issue_key:
            return None
        if self.auth_type == "oauth" and self.site_url:
            return f"{self.site_url.rstrip('/')}/browse/{issue_key}"
        return f"{self.base_url}/browse/{issue_key}"

    def test_connection(self) -> Dict[str, Any]:
        r = self.session.get(self._url("/rest/api/3/myself"), timeout=30)
        if r.status_code >= 400:
            raise JiraClientError(f"连接失败 ({r.status_code}): {r.text[:500]}")
        return r.json()

    def create_issue(
        self,
        project_key: str,
        summary: str,
        description: str = "",
        issue_type: str = "Task",
    ) -> Dict[str, Any]:
        payload = {
            "fields": {
                "project": {"key": project_key},
                "summary": summary,
                "issuetype": {"name": issue_type},
            }
        }
        if description:
            payload["fields"]["description"] = {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": description}],
                    }
                ],
            }
        r = self.session.post(
            self._url("/rest/api/3/issue"), json=payload, timeout=30
        )
        if r.status_code >= 400:
            raise JiraClientError(f"创建 Issue 失败 ({r.status_code}): {r.text[:800]}")
        data = r.json()
        key = data.get("key")
        return {
            "id": data.get("id"),
            "key": key,
            "url": self.browse_url(key) if key else None,
        }

    @classmethod
    def from_oauth(
        cls, access_token: str, cloud_id: str, site_url: str
    ) -> "JiraClient":
        return cls(
            site_url=site_url,
            access_token=access_token,
            cloud_id=cloud_id,
            auth_type="oauth",
        )
