from typing import Any

import uvicorn

from src.app import create_application
from src.configs.settings_config import load_intelligence_settings

APPLICATION_FACTORY_IMPORT_PATH = "src.app:create_application"


def run_intelligence_server() -> None:
    settings = load_intelligence_settings()
    shared_options: dict[str, Any] = {
        "host": settings.host,
        "port": settings.port,
        "loop": "uvloop",
        "http": "httptools",
        "access_log": False,
        "server_header": False,
        "proxy_headers": False,
        "timeout_keep_alive": 30,
        "log_config": None,
    }
    if settings.server_workers > 1:
        uvicorn.run(APPLICATION_FACTORY_IMPORT_PATH, factory=True, workers=settings.server_workers, **shared_options)
        return
    uvicorn.run(create_application(settings), **shared_options)


if __name__ == "__main__":
    run_intelligence_server()
