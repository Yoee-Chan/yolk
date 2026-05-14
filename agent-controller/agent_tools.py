import sys
import json
from dataclasses import asdict

from llm_setting.setting_handler import SettingHandler
from registrar.tools_request_registry import get_cmd


def safe_result(r):
    if isinstance(r, (dict, list, str, int, float, bool, type(None))):
        return r
    else:
        return json.dumps(asdict(r), ensure_ascii=False, indent=2)


def main():
    raw = sys.stdin.read().strip()
    try:
        msg = json.loads(raw)  # 解析前端传过来的 JSON
    except json.JSONDecodeError as e:
        print(json.dumps({
            "type": "command_error",
            "error": f"JSON decode failed: {e}"
        }), flush=True)
        return

    # 拿到前端传过来的字段
    setting_type = msg.get("SettingType")
    cmd = msg.get("cmd")
    param = msg.get("Param", {})

    # 根据不同的 SettingType 和 cmd 做处理
    try:
        handler = SettingHandler(setting_type)
        cmd_invoke = get_cmd(handler, param)

        if cmd not in cmd_invoke:
            raise ValueError(f"不支持的命令：{cmd}")

        result = cmd_invoke.get(cmd)

        # safe_result(result)

        # json.dumps(asdict(result), ensure_ascii=False, indent=2)
        print(json.dumps({
            "type": "command_result",
            "cmd": setting_type,
            "result": safe_result(result)
        }), flush=True)

    except Exception as e:
        print(json.dumps({
            "type": "command_error",
            "cmd": setting_type,
            "error": str(e)
        }), flush=True)


if __name__ == "__main__":
    main()
