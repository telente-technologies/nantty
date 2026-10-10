from botocore.config import Config

AWS_CLIENT_CONFIG = Config(
    connect_timeout=5,
    read_timeout=20,
    retries={"max_attempts": 2, "mode": "standard"},
)
