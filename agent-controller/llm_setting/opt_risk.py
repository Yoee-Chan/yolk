from abc import ABC, abstractmethod


class RiskStrategy(ABC):
    """风险策略基类：负责在 Repository 执行前插入行为"""

    @abstractmethod
    def execute(self, action_callable):
        """action_callable 是一个无参函数，返回 CRUD 结果"""
        pass


class LowRiskStrategy(RiskStrategy):
    def execute(self, action_callable):
        # 低风险：直接执行
        return action_callable()


class MediumRiskStrategy(RiskStrategy):
    def execute(self, action_callable):
        # 中风险：未来可加一次确认
        return action_callable()


class HighRiskStrategy(RiskStrategy):
    def execute(self, action_callable):
        # 高风险：未来可加权限检查、审计等
        return action_callable()


class ExtremeRiskStrategy(RiskStrategy):
    def execute(self, action_callable):
        # 极高风险：未来可加沙箱隔离、二次确认等
        return action_callable()
