from llm_setting.setting_handler import SettingHandler


def get_cmd(handler: SettingHandler, param):
    return {
        "add": handler.add(param),
        "update": handler.update(param),
        "delete": handler.delete(param),
        "search": handler.search(),
        "search_by_id": handler.search_by_id(param)
    }
