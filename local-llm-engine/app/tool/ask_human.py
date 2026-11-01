import os

from app.human_input_bridge import prompt_user
from app.tool import BaseTool


class AskHuman(BaseTool):
    """Add a tool to ask human for help."""

    name: str = "ask_human"
    description: str = "Use this tool to ask human for help."
    parameters: str = {
        "type": "object",
        "properties": {
            "inquire": {
                "type": "string",
                "description": "The question you want to ask human.",
            }
        },
        "required": ["inquire"],
    }

    async def execute(self, inquire: str) -> str:
        if os.environ.get("YOLK_PIPELINE_MODE") == "1":
            # 流水线自动执行没有人在旁边回复，阻塞等待会让整条流水线卡死。
            return (
                "流水线模式：用户已通过「立即执行」授权全部步骤，不会有人工回复。"
                "请不要再次询问用户，直接按最合理的方案继续；"
                "若确实无法继续，请输出 `[阶段失败] <阶段名>：<失败原因>` 并停止。"
            )
        return await prompt_user(f"Bot: {inquire}\n\nYou:")
