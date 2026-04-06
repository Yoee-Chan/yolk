import logging
import os


class WorkSpace():
    def __init__(self, path):
        self.path = path

    def add(self, file_name) -> bool:
        try:
            os.makedirs(os.path.join(self.path, file_name), exist_ok=True)
            return True
        except FileExistsError:
            logging.error("creat subFolder {} error ".format(file_name))
            return False

    def remove(self) -> bool:
        pass

    def search(self) -> list:
        """
        :rtype: list
        """
        dirs = []
        for name in os.listdir(self.path):
            full = os.path.join(self.path, name)
            if os.path.isdir(full):
                dirs.append(full)
        return dirs

    def update(self) -> int:
        pass
