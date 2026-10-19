from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MINIMUM_SHARED_SECRET_LENGTH = 32
PLACEHOLDER_SECRET_MARKERS = ("local-only", "change-me", "change_me", "changeme", "example", "placeholder")


def looks_like_placeholder_secret(secret: str) -> bool:
    lowered = secret.lower()
    return any(marker in lowered for marker in PLACEHOLDER_SECRET_MARKERS)


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
    trusted_proxy_ips: str = ""
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    shared_secret: SecretStr = SecretStr("")
    previous_shared_secret: SecretStr = SecretStr("")
    id_hash_secret: SecretStr = SecretStr("")
    signature_max_clock_skew_seconds: int = Field(default=300, ge=30, le=900)
    nonce_retention_seconds: int = Field(default=900, ge=60, le=3600)

    redis_url: str = ""
    redis_socket_timeout_seconds: float = Field(default=0.5, gt=0, le=5)
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
    trust_content_scores_queue: str = "intelligence-trust-content-scores"
    trust_bot_scores_queue: str = "intelligence-trust-bot-scores"
    media_bucket: str = ""
    server_workers: int = Field(default=1, ge=1, le=32)
    trust_live_safety_queue: str = "intelligence-trust-live-safety"
    live_safety_frames_queue: str = "jobs-live-frames"
    live_safety_audio_queue: str = "jobs-live-audio"
    live_safety_prefetch: int = Field(default=10, ge=1, le=200)
    live_safety_rekognition: Literal["auto", "enabled", "disabled"] = "auto"
    live_safety_rekognition_min_confidence: float = Field(default=50.0, ge=0.0, le=100.0)
    live_safety_aws_region: str = "us-east-1"
    live_safety_transcribe_enabled: bool = False
    live_safety_transcribe_output_bucket: str = ""
    live_safety_transcribe_language_code: str = "en-US"
    live_safety_csam_hash_matching_enabled: bool = False
    child_safety_hash_provider: Literal["disabled", "synthetic", "http"] = "disabled"
    child_safety_hash_provider_name: str = ""
    child_safety_hash_provider_endpoint: str = ""
    child_safety_hash_provider_api_key: SecretStr = SecretStr("")
    child_safety_hash_provider_timeout_seconds: float = Field(default=3.0, gt=0, le=30)
    child_safety_synthetic_hashes: str = ""
    child_safety_explicit_confidence: float = Field(default=0.90, ge=0.5, le=1.0)
    child_safety_minor_age_ceiling: int = Field(default=18, ge=13, le=21)
    media_scan_deadline_seconds: float = Field(default=4.5, gt=0, le=30)
    media_internal_url: str = ""
    media_internal_token: SecretStr = SecretStr("")
    media_internal_timeout_seconds: float = Field(default=10.0, gt=0, le=120)

    sqs_endpoint_url: str = ""
    sqs_region: str = "us-east-1"
    sqs_access_key_id: SecretStr = SecretStr("")
    sqs_secret_access_key: SecretStr = SecretStr("")
    domain_events_queue_url: str = ""
    domain_events_dlq_queue_url: str = ""
    sqs_max_delivery_attempts: int = Field(default=5, ge=1, le=20)
    trust_advisory_queue_url: str = ""
    trust_bot_scores_queue_url: str = ""

    model_registry_path: Path = Path("./model_registry")
    model_signing_secret: SecretStr = SecretStr("")
    model_reload_interval_seconds: float = Field(default=30.0, ge=1.0)

    max_request_body_bytes: int = Field(default=1_048_576, ge=1024)
    max_event_batch_body_bytes: int = Field(default=4_194_304, ge=1024)
    request_deadline_seconds: float = Field(default=0.25, gt=0, le=10)
    event_ingestion_deadline_seconds: float = Field(default=10.0, gt=0, le=60)
    rate_limit_requests_per_second: float = Field(default=2000.0, gt=0)
    rate_limit_burst_size: int = Field(default=4000, ge=1)

    feature_log_flush_interval_seconds: float = Field(default=10.0, gt=0)
    feature_log_max_buffered_rows: int = Field(default=20_000, ge=100)
    event_deduplication_retention_seconds: int = Field(default=7 * 24 * 3600, ge=3600)
    dataset_retention_days: int = Field(default=90, ge=1, le=3650)
    dataset_retention_interval_seconds: float = Field(default=24 * 3600.0, ge=60.0)
    dataset_erasure_interval_seconds: float = Field(default=3600.0, ge=60.0)

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
            id_hash_length = len(self.id_hash_secret.get_secret_value())
            if 0 < id_hash_length < MINIMUM_SHARED_SECRET_LENGTH:
                raise ValueError("INTELLIGENCE_ID_HASH_SECRET must be empty or at least 32 characters")
            for name, secret in (
                ("INTELLIGENCE_SHARED_SECRET", self.shared_secret),
                ("INTELLIGENCE_PREVIOUS_SHARED_SECRET", self.previous_shared_secret),
                ("INTELLIGENCE_MODEL_SIGNING_SECRET", self.model_signing_secret),
                ("INTELLIGENCE_ID_HASH_SECRET", self.id_hash_secret),
            ):
                if looks_like_placeholder_secret(secret.get_secret_value()):
                    raise ValueError(f"{name} is a placeholder value and cannot be used outside development")
        elif secret_length == 0:
            raise ValueError("INTELLIGENCE_SHARED_SECRET must be set, even in development")
        return self

    @model_validator(mode="after")
    def require_nonce_retention_to_cover_signature_window(self) -> IntelligenceSettings:
        if self.nonce_retention_seconds < 2 * self.signature_max_clock_skew_seconds:
            raise ValueError("nonce retention must be at least twice the allowed clock skew")
        return self

    @model_validator(mode="after")
    def reject_unusable_event_bus_configuration(self) -> IntelligenceSettings:
        if self.environment not in {"staging", "production"}:
            return self
        if self.event_bus == "rabbitmq":
            if not self.rabbitmq_url.get_secret_value():
                raise ValueError("INTELLIGENCE_RABBITMQ_URL is required when EVENT_BUS=rabbitmq")
            return self
        if not self.domain_events_queue_url:
            raise ValueError("INTELLIGENCE_DOMAIN_EVENTS_QUEUE_URL is required when EVENT_BUS=sqs")
        raise ValueError(
            "EVENT_BUS=sqs has no content-score, sensitivity or live-safety publisher; use rabbitmq outside development"
        )

    @model_validator(mode="after")
    def reject_undistributed_replay_protection(self) -> IntelligenceSettings:
        if self.environment != "test" and not self.redis_url and self.server_workers > 1:
            raise ValueError("INTELLIGENCE_SERVER_WORKERS must be 1 without INTELLIGENCE_REDIS_URL")
        return self

    @model_validator(mode="after")
    def reject_unpaired_media_internal_settings(self) -> IntelligenceSettings:
        if self.environment not in {"staging", "production"}:
            return self
        if bool(self.media_internal_url) != bool(self.media_internal_token.get_secret_value()):
            raise ValueError(
                "INTELLIGENCE_MEDIA_INTERNAL_URL and INTELLIGENCE_MEDIA_INTERNAL_TOKEN must be set together"
            )
        return self

    @model_validator(mode="after")
    def reject_misconfigured_child_safety_hash_matching(self) -> IntelligenceSettings:
        if self.live_safety_csam_hash_matching_enabled and self.child_safety_hash_provider == "disabled":
            raise ValueError("CSAM hash matching is enabled but INTELLIGENCE_CHILD_SAFETY_HASH_PROVIDER is disabled")
        deployed = self.environment in {"staging", "production"}
        if self.child_safety_hash_provider == "synthetic" and deployed:
            raise ValueError("the synthetic child safety hash list is a test double and cannot run when deployed")
        if self.child_safety_hash_provider == "http" and (
            not self.child_safety_hash_provider_name
            or len(self.child_safety_hash_provider_api_key.get_secret_value()) < 16
            or not self.child_safety_hash_provider_endpoint.startswith("https://" if deployed else "http")
        ):
            raise ValueError(
                "child safety hash matching is enabled but its provider name, endpoint or api key is missing"
            )
        return self

    @property
    def uses_object_storage(self) -> bool:
        return self.event_storage_uri.startswith("s3://")


@lru_cache(maxsize=1)
def load_intelligence_settings() -> IntelligenceSettings:
    return IntelligenceSettings()
