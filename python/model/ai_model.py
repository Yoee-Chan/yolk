from app.agent.manus import Manus


class AIModel:
    def __init__(self):
        self.model = Manus()

    async def create_agent(self):
        return await self.model.create()

    async def close(self):
        await self.model.cleanup()
