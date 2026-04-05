from abc import ABC, abstractmethod


class Setting(ABC):

    @abstractmethod
    def add(self) -> bool:
        pass

    @abstractmethod
    def remove(self) -> bool:
        pass

    @abstractmethod
    def search(self) -> list:
        pass

    @abstractmethod
    def update(self) -> int:
        pass
