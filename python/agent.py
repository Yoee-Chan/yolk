import sys
import json

if __name__ == "__main__":
    args = json.loads(sys.argv[1])
    msg = args.get("msg", "")
    print(f"Python 收到消息: {msg}")
