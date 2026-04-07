from llm_setting.setting_handler import SettingHandler


def main():
    setting_handler = SettingHandler(setting_type="workspace")
    ws = setting_handler.search_by_id(data={
        "path": "C:\\Users\\yoeec\\Desktop\\workSpace",
        "sandbox": True
    })
    print(ws)


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


if __name__ == "__main__":
    main()
