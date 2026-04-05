import sys
import os
import json
import asyncio

import os
import sys

from model.ai_model import AIModel


def get_base_dir():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


BASE_DIR = get_base_dir()
LLM_ENGINE_DIR = os.path.join(BASE_DIR, "local-llm-engine")

sys.path.append(BASE_DIR)
sys.path.append(LLM_ENGINE_DIR)


async def model(msg: str):
    ai = AIModel()
    try:
        agent = await ai.create_agent()
        prompt = '你是一个纯文本助手，不要调用任何工具，不要执行任何文件操作，只输出文本.{hello，这是一个测试}'
        result = await agent.run(prompt)

        print(json.dumps({"result": result}, ensure_ascii=False), flush=True)

    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)

    finally:
        await ai.close()


# if __name__ == "__main__":
#     # 读取前端传来的 JSON 参数
#     if len(sys.argv) > 1:
#         args = json.loads(sys.argv[1])
#         msg = args.get("msg", "")
#     else:
#         msg = "默认消息"
# print(json.dumps({"partial": "第一段"}, ensure_ascii=False), flush=True)
# print(json.dumps({"partial": "第二段"}, ensure_ascii=False), flush=True)
# print(json.dumps({"result": "最终结果"}, ensure_ascii=False), flush=True)
# asyncio.run(model(msg))
# import asyncio, sys, json

# agent_stream.py
import sys
import json
import asyncio

pending_inputs = {}


async def wait_for_input(req_id):
    loop = asyncio.get_event_loop()
    fut = loop.create_future()
    pending_inputs[req_id] = fut
    return await fut


def handle_stdin():
    for line in sys.stdin:
        msg = json.loads(line)
        req_id = msg["id"]
        if req_id in pending_inputs:
            pending_inputs[req_id].set_result(msg["data"])


async def init_application(event):
    pass


async def main():
    for i in range(10):
        print(json.dumps({"type": "stream", "text": f"第 {i} 条消息"}))
        sys.stdout.flush()
        await asyncio.sleep(1)
    await model("你好")
    # 请求前端输入
    req_id = "req_1"
    print(json.dumps({
        "type": "need_input",
        "id": req_id,
        "text": "请输入你的名字"
    }))
    sys.stdout.flush()

    # 暂停等待前端输入
    name = await wait_for_input(req_id)

    # 继续流式输出
    print(json.dumps({"type": "stream", "text": f"你好，{name}！继续执行..."}))
    sys.stdout.flush()


# 启动 stdin 监听
loop = asyncio.get_event_loop()
loop.run_in_executor(None, handle_stdin)
loop.run_until_complete(main())
