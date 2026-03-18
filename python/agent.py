import sys
import os
import json
import asyncio

#yolk/python/agent.py → yolk/
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(BASE_DIR)

#local-llm-engine/app
LLM_ENGINE_DIR = os.path.join(BASE_DIR, "local-llm-engine")
sys.path.append(LLM_ENGINE_DIR)

from app.logger import logger
from python.model.ai_model import AIModel


async def model(msg: str):
    ai = AIModel()
    try:
        agent = await ai.create_agent()
        prompt='你是一个纯文本助手，不要调用任何工具，不要执行任何文件操作，只输出文本.{hello，这是一个测试}'
        result = await agent.run(prompt)

        print(json.dumps({"result": result}, ensure_ascii=False), flush=True)

    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)

    finally:
        await ai.close()


if __name__ == "__main__":
    # 读取前端传来的 JSON 参数
    if len(sys.argv) > 1:
        args = json.loads(sys.argv[1])
        msg = args.get("msg", "")
    else:
        msg = "默认消息"
    # print(json.dumps({"partial": "第一段"}, ensure_ascii=False), flush=True)
    # print(json.dumps({"partial": "第二段"}, ensure_ascii=False), flush=True)
    # print(json.dumps({"result": "最终结果"}, ensure_ascii=False), flush=True)
    asyncio.run(model(msg))
