import json
import logging
from datetime import UTC, datetime
from typing import Any

STANDARD_LOG_RECORD_ATTRIBUTES = frozenset(
    logging.LogRecord("", 0, "", 0, "", None, None).__dict__.keys() | {"message", "asctime", "taskName"}
)


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for attribute_name, attribute_value in record.__dict__.items():
            if attribute_name not in STANDARD_LOG_RECORD_ATTRIBUTES:
                log_entry[attribute_name] = attribute_value
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception_type"] = record.exc_info[0].__name__
            log_entry["stack_trace"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, default=str, separators=(",", ":"))


def configure_structured_logging(log_level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter())
    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(log_level)
    for noisy_logger_name in ("uvicorn.access",):
        logging.getLogger(noisy_logger_name).disabled = True
    logging.getLogger("uvicorn.error").handlers = [handler]
