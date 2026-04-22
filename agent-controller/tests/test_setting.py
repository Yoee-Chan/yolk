import json
from dataclasses import asdict
from pathlib import Path

from llm_setting.config_paths import ConfigPaths
from llm_setting.json_repository import JSONSettingRepository
from llm_setting.data_models import WorkspaceConfig
from llm_setting.setting_handler import SettingHandler
from registrar.tools_request_registry import get_cmd


def test_main():
    setting_handler = SettingHandler(setting_type="workspace")
    ws = setting_handler.search_by_id(data={
        "id": "C:\\Users\\yoeec\\Desktop\\workSpace",
        "sandbox": True
    })
    print(ws)


def test_json_repository():
    CURRENT_FILE = Path(__file__).resolve()
    ROOT_DIR = CURRENT_FILE.parents[1]
    LLM_CONFIG_DIR = ROOT_DIR
    WORKSPACES_FILE = LLM_CONFIG_DIR
    paths = ConfigPaths(WORKSPACES_FILE)
    json_path = paths.workspace_json
    print(json_path)
    result = WorkspaceConfig
    jon = JSONSettingRepository(json_path)
    jon.load(result)
    print(jon.get_store())


def test_search_work_space():
    args = {}
    cmd = "search"
    setting_handler = SettingHandler("workspace")
    cmd_invoke = get_cmd(setting_handler, args)
    if cmd not in cmd_invoke:
        raise ValueError(f"不支持的命令：{cmd}")
    result = cmd_invoke.get(cmd)
    json_str = json.dumps(asdict(result), ensure_ascii=False, indent=2)
    print(json_str)
    # result = setting_handler.search()


def test_add_workspace():
    args = {"path": "C:/Users/yoeec/Desktop/workSpace/create-test"}
    cmd = "add"
    work_space1 = SettingHandler("workspace")
    cmd_invoke = get_cmd(work_space1, args)
    if cmd not in cmd_invoke:
        raise ValueError(f"不支持的命令：{cmd}")
    result = cmd_invoke.get(cmd)

# print("=== 添加 Workspace Setting ===")
# ws = handle_setting_request(
#     setting_type="workspace",
#     action="add",
#     data={
#         "path": "/Users/chan/workspace1",
#         "sandbox": True
#     }
# )
# print(ws)
#
# print("\n=== 添加 MCP Setting ===")
# mcp = handle_setting_request(
#     setting_type="mcp",
#     action="add",
#     data={
#         "server_url": "http://localhost:8000/sse",
#         "token": "abc123"
#     }
# )
# print(mcp)
#
# print("\n=== 列出所有 Workspace Setting ===")
# ws_list = handle_setting_request(
#     setting_type="workspace",
#     action="list",
#     data={}
# )
# print(ws_list)
#
# print("\n=== 更新 Workspace Setting ===")
# updated = handle_setting_request(
#     setting_type="workspace",
#     action="update",
#     data={
#         "id": ws.id,
#         "update": {
#             "sandbox": False
#         }
#     }
# )
# print(updated)
#
# print("\n=== 删除 MCP Setting ===")
# handle_setting_request(
#     setting_type="mcp",
#     action="delete",
#     data={"id": mcp.id}
# )
# print("MCP deleted")
#
# print("\n=== 列出所有 MCP Setting ===")
# print(handle_setting_request("mcp", "list", {}))
