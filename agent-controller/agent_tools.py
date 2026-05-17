import io
import sys
import json
from dataclasses import asdict, is_dataclass

from llm_setting.setting_handler import SettingHandler
from registrar.tools_request_registry import get_cmd


def _ensure_utf8_stdio() -> None:
    """子进程管道默认可能是系统 locale（如 GBK），统一为 UTF-8 避免前端乱码。"""
    for name in ("stdin", "stdout", "stderr"):
        stream = getattr(sys, name)
        if not hasattr(stream, "buffer"):
            continue
        if getattr(stream, "encoding", "").lower() == "utf-8":
            continue
        setattr(
            sys,
            name,
            io.TextIOWrapper(
                stream.buffer,
                encoding="utf-8",
                errors="replace",
                line_buffering=True,
            ),
        )


_ensure_utf8_stdio()


def safe_result(r):
    if isinstance(r, (dict, list, str, int, float, bool, type(None))):
        return r
    if is_dataclass(r):
        return asdict(r)
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
        if setting_type == "skill":
            if cmd != "search":
                raise ValueError(f"skill 不支持的命令：{cmd}")
            from skills.registry import get_skill_registry

            result = [
                {
                    "id": s.id,
                    "name": s.name,
                    "description": s.description,
                    "version": s.version,
                    "connector": s.connector,
                    "tool": s.tool,
                    "triggers": s.triggers,
                }
                for s in get_skill_registry().list()
            ]
            print(
                json.dumps(
                    {"type": "command_result", "cmd": setting_type, "result": result},
                    ensure_ascii=False,
                ),
                flush=True,
            )
            return

        handler = SettingHandler(setting_type)
        cmd_invoke = get_cmd(handler, param, setting_type)

        if cmd not in cmd_invoke:
            raise ValueError(f"不支持的命令：{cmd}")

        result = cmd_invoke[cmd]()

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
