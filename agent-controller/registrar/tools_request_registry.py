from typing import Any, Callable, Dict

from llm_setting.setting_handler import SettingHandler


def get_cmd(handler: SettingHandler, param: Any, setting_type: str) -> Dict[str, Callable[[], Any]]:
    cmds: Dict[str, Callable[[], Any]] = {
        "add": lambda: handler.add(param),
        "update": lambda: handler.update(param),
        "delete": lambda: handler.delete(param),
        "search": lambda: handler.search(),
        "search_by_id": lambda: handler.search_by_id(param),
    }
    if setting_type == "jira_connector":
        cmds["test"] = lambda: handler.test_connection(param)
        cmds["oauth_app_status"] = lambda: handler.oauth_app_status(param)
        cmds["oauth_app_save"] = lambda: handler.oauth_app_save(param)
        cmds["oauth_start"] = lambda: handler.oauth_start(param)
        cmds["oauth_finish"] = lambda: handler.oauth_finish(param)
    if setting_type == "wechat_connector":
        cmds["test"] = lambda: handler.test_connection(param)
    return cmds
