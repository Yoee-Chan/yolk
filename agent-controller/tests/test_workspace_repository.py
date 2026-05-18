import json
import tempfile
from pathlib import Path

import pytest

from llm_setting.data_models import WorkspaceConfig, WorkspaceSettingCreate
from llm_setting.setting_repositories import WorkspaceSettingRepository


@pytest.fixture
def workspace_repo(tmp_path: Path):
    json_path = tmp_path / "workspace.json"
    json_path.write_text(
        json.dumps({"workSpace": str(tmp_path / "root"), "subPath": []}),
        encoding="utf-8",
    )
    return WorkspaceSettingRepository(str(json_path)), tmp_path / "root"


def test_add_creates_subdirectory_on_disk(workspace_repo):
    repo, root = workspace_repo
    sub_name = "images"
    sub_path = root / sub_name

    assert repo.add(WorkspaceSettingCreate(path=sub_name, permission="rw"))
    assert sub_path.is_dir()

    cfg = repo.list()
    assert len(cfg.subPath) == 1
    assert Path(cfg.subPath[0].subPathName) == sub_path.resolve()


def test_delete_removes_subdirectory_from_disk(workspace_repo):
    repo, root = workspace_repo
    sub_name = "images"
    sub_path = root / sub_name
    repo.add(WorkspaceSettingCreate(path=sub_name, permission="rw"))
    assert sub_path.is_dir()

    full_path = str(sub_path.resolve())
    assert repo.delete({"path": full_path})
    assert not sub_path.exists()
    assert repo.list().subPath == []


def test_add_rejects_path_outside_workspace(workspace_repo):
    repo, _root = workspace_repo
    with pytest.raises(ValueError, match="工作域"):
        repo.add(WorkspaceSettingCreate(path="C:\\outside", permission="rw"))
