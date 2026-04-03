import logging
import os
import sys
import json


def list_subdir(path):
    dirs = []
    for name in os.listdir(path):
        full = os.path.join(path, name)
        if os.path.isdir(full):
            dirs.append(full)
    return dirs


if __name__ == "__main__":
    raw = sys.stdin.readline()
    msg = json.loads(raw)

    cmd = msg.get("cmd")
    args = msg.get("args", {})
    logging.info("************************")
    if cmd == "list_files":
        try:
            result = list_subdir(args["path"])
            print(json.dumps({
                "type": "command_result",
                "cmd": cmd,
                "result": result
            }), flush=True)
        except Exception as e:
            print(json.dumps({
                "type": "command_error",
                "cmd": cmd,
                "error": str(e)
            }), flush=True)

    sys.exit(0)
