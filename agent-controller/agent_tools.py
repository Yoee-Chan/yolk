import logging
import os
import sys
import json

from llm_setting.setting_handler import SettingHandler
from registrar.tools_request_registry import get_cmd


def list_subdir(path):
    dirs = []
    for name in os.listdir(path):
        full = os.path.join(path, name)
        if os.path.isdir(full):
            dirs.append(full)
    return dirs


if __name__ == "__main__":
    """
    {
    cmd:"add/update/delete/search/search_by_id"
    SettingType:"workspace/mcp"
    Param:[]
    }
    """
    raw = sys.stdin.readline()
    msg = json.loads(raw)
    cmd = msg["cmd"]
    setting_type = msg.get("SettingType")
    args = msg.get("Param", {})
    try:
        handler = SettingHandler(setting_type)
        cmd_invoke = get_cmd(handler, args)
        if cmd not in cmd_invoke:
            raise ValueError(f"不支持的命令：{cmd}")
        result = cmd_invoke.get(cmd)
        print(json.dumps({
            "type": "command_result",
            "cmd": setting_type,
            "result": result
        }), flush=True)
    except Exception as e:
        print(json.dumps({
            "type": "command_error",
            "cmd": setting_type,
            "error": str(e)
        }), flush=True)

sys.exit(0)
