from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MINIMUM_SHARED_SECRET_LENGTH = 32


class IntelligenceSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="INTELLIGENCE_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "test", "staging", "production"] = "development"
    host: str = "127.0.0.1"
    port: int = Field(default=8090, ge=1, le=65535)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    shared_secret: SecretStr = SecretStr("")
    previous_shared_secret: SecretStr = SecretStr("")
    signature_max_clock_skew_seconds: int = Field(default=300, ge=30, le=900)
    nonce_retention_seconds: int = Field(default=900, ge=60, le=3600)

    redis_url: str = ""
    redis_socket_timeout_seconds: float = Field(default=0.05, gt=0, le=5)
    redis_key_prefix: str = "intel"

    event_storage_uri: str = "./data"
    s3_endpoint_url: str = ""
    s3_region: str = "us-east-1"
    s3_access_key_id: SecretStr = SecretStr("")
    s3_secret_access_key: SecretStr = SecretStr("")

    event_bus: Literal["rabbitmq", "sqs"] = Field(
        default="rabbitmq", validation_alias=AliasChoices("INTELLIGENCE_EVENT_BUS", "EVENT_BUS")
    )
    rabbitmq_url: SecretStr = Field(
        default=SecretStr(""), validation_alias=AliasChoices("INTELLIGENCE_RABBITMQ_URL", "RABBITMQ_URL")
    )
    rabbitmq_prefetch: int = Field(default=20, ge=1, le=1000)
    domain_events_queue: str = "intelligence-domain-events"
    trust_advisory_queue: str = "intelligence-trust-advisory"

    sqs_endpoint_url: str = ""
    sqs_region: str = "us-east-1"
    sqs_access_key_id: SecretStr = SecretStr("")
    sqs_secret_access_key: SecretStr = SecretStr("")
    domain_events_queue_url: str = ""
    trust_advisory_queue_url: str = ""

    model_registry_path: Path = Path("./model_registry")
    model_signing_secret: SecretStr = SecretStr("")
    model_reload_interval_seconds: float = Field(default=30.0, ge=1.0)

    max_request_body_bytes: int = Field(default=1_048_576, ge=1024)
    max_event_batch_body_bytes: int = Field(default=4_194_304, ge=1024)
    request_deadline_seconds: float = Field(default=0.25, gt=0, le=10)
    rate_limit_requests_per_second: float = Field(default=2000.0, gt=0)
    rate_limit_burst_size: int = Field(default=4000, ge=1)

    feature_log_flush_interval_seconds: float = Field(default=10.0, gt=0)
    feature_log_max_buffered_rows: int = Field(default=20_000, ge=100)
    event_deduplication_retention_seconds: int = Field(default=7 * 24 * 3600, ge=3600)

    @model_validator(mode="after")
    def reject_weak_configuration_outside_development(self) -> IntelligenceSettings:
        secret_length = len(self.shared_secret.get_secret_value())
        if self.environment in {"staging", "production"}:
            if secret_length < MINIMUM_SHARED_SECRET_LENGTH:
                raise ValueError("INTELLIGENCE_SHARED_SECRET must be at least 32 characters")
            if not self.redis_url:
                raise ValueError("INTELLIGENCE_REDIS_URL is required outside development")
            if len(self.model_signing_secret.get_secret_value()) < MINIMUM_SHARED_SECRET_LENGTH:
                raise ValueError("INTELLIGENCE_MODEL_SIGNING_SECRET must be at least 32 characters")
        elif secret_length == 0:
            raise ValueError("INTELLIGENCE_SHARED_SECRET must be set, even in development")
        return self

    @model_validator(mode="after")
    def require_nonce_retention_to_cover_signature_window(self) -> IntelligenceSettings:
        if self.nonce_retention_seconds < 2 * self.signature_max_clock_skew_seconds:
            raise ValueError("nonce retention must be at least twice the allowed clock skew")
        return self

    @property
    def uses_object_storage(self) -> bool:
        return self.event_storage_uri.startswith("s3://")


@lru_cache(maxsize=1)
def load_intelligence_settings() -> IntelligenceSettings:
    return IntelligenceSettings()
