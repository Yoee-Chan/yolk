import logging
import os
import sys

import structlog


ENV_MODE = os.getenv("ENV_MODE", "LOCAL")

renderer = [structlog.processors.JSONRenderer()]
if ENV_MODE.lower() == "local".lower():
    renderer = [structlog.dev.ConsoleRenderer()]

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.dict_tracebacks,
        structlog.processors.CallsiteParameterAdder(
            {
                structlog.processors.CallsiteParameter.FILENAME,
                structlog.processors.CallsiteParameter.FUNC_NAME,
                structlog.processors.CallsiteParameter.LINENO,
            }
        ),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.contextvars.merge_contextvars,
        *renderer,
    ],
    cache_logger_on_first_use=True,
    # 与 agent_stream 等子进程约定：stdout 仅作机器可读协议，日志走 stderr
    logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
)

logger: structlog.stdlib.BoundLogger = structlog.get_logger(level=logging.DEBUG)
