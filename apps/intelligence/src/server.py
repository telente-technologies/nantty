import uvicorn

from src.app import create_application
from src.configs.settings_config import load_intelligence_settings


def run_intelligence_server() -> None:
    settings = load_intelligence_settings()
    uvicorn.run(
        create_application(settings),
        host=settings.host,
        port=settings.port,
        loop="uvloop",
        http="httptools",
        access_log=False,
        server_header=False,
        proxy_headers=False,
        timeout_keep_alive=30,
        log_config=None,
    )


if __name__ == "__main__":
    run_intelligence_server()
