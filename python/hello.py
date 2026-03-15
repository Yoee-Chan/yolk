import sys
import json

def main():
    # 从 Node 接收一行 JSON
    line = sys.stdin.readline().strip()
    if not line:
        result = {"msg": "No input from Node"}
    else:
        try:
            req = json.loads(line)
            name = req.get("name", "Unknown")
            result = {"msg": f"Hello {name}, from Python!"}
        except Exception as e:
            result = {"msg": f"Error parsing input: {e}"}

    # 输出 JSON 给 Node
    print(json.dumps(result))
    sys.stdout.flush()

if __name__ == "__main__":
    main()
