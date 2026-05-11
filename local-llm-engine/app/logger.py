import sys
from datetime import datetime

from loguru import logger as _logger

from app.config import PROJECT_ROOT


_print_level = "INFO"


def define_log_level(print_level="INFO", logfile_level="DEBUG", name: str = None):
    """Adjust the log level to above level"""
    global _print_level
    _print_level = print_level

    current_date = datetime.now()
    formatted_date = current_date.strftime("%Y%m%d%H%M%S")
    log_name = (
        f"{name}_{formatted_date}" if name else formatted_date
    )  # name a log with prefix name

    _logger.remove()
    # 同步到 stderr，便于 Yolk 前端「连接信息 / 模型计划」解析（与 stdout 协议行分离）
    _logger.add(
        sys.stderr,
        level=print_level,
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}\n",
    )
    _logger.add(PROJECT_ROOT / f"logs/{log_name}.log", level=logfile_level)
    return _logger


logger = define_log_level()


if __name__ == "__main__":
    logger.info("Starting application")
    logger.debug("Debug message")
    logger.warning("Warning message")
    logger.error("Error message")
    logger.critical("Critical message")

    try:
        raise ValueError("Test error")
    except Exception as e:
        logger.exception(f"An error occurred: {e}")
