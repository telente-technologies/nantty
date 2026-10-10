"""Regression tests for PYEVT-001 / PYSEC-011: fail-fast queue config and honest publishers."""

import pytest
from pydantic import ValidationError

from src.configs.settings_config import IntelligenceSettings
from src.modules.bot_detection.repositories.bot_score_queue_repository import NullBotScorePublisher
from src.modules.content_scoring.repositories.content_score_queue_repository import NullContentScorePublisher
from src.modules.content_scoring.repositories.sensitivity_advisory_publisher_repository import (
    NullSensitivityAdvisoryPublisher,
)
from src.modules.live_safety.repositories.live_safety_score_queue_repository import (
    NullLiveSafetyScorePublisher,
)
from src.modules.trust_advisory.repositories.trust_advisory_queue_repository import (
    NullTrustAdvisoryPublisher,
)


def _staging_settings(**overrides: object) -> IntelligenceSettings:
    base: dict[str, object] = {
        "environment": "staging",
        "shared_secret": "staging-shared-secret-that-is-long-enough-0",
        "model_signing_secret": "staging-model-signing-secret-long-enough-00",
        "redis_url": "redis://localhost:6379/0",
    }
    base.update(overrides)
    return IntelligenceSettings(**base)  # type: ignore[arg-type]


def test_staging_rejects_rabbitmq_without_url() -> None:
    with pytest.raises(ValidationError, match="RABBITMQ_URL"):
        _staging_settings(event_bus="rabbitmq", rabbitmq_url="")


def test_staging_rejects_sqs_without_domain_queue_url() -> None:
    with pytest.raises(ValidationError, match="DOMAIN_EVENTS_QUEUE_URL"):
        _staging_settings(event_bus="sqs", domain_events_queue_url="")


def test_development_stays_permissive_for_local_brokers() -> None:
    settings = IntelligenceSettings(environment="development", shared_secret="dev-secret-must-be-set-anyway")
    assert settings.event_bus == "rabbitmq"


def test_null_publishers_report_no_delivery() -> None:
    assert NullContentScorePublisher.delivers is False
    assert NullSensitivityAdvisoryPublisher.delivers is False
    assert NullBotScorePublisher.delivers is False
    assert NullTrustAdvisoryPublisher.delivers is False
    assert NullLiveSafetyScorePublisher.delivers is False


def test_multiple_workers_require_redis_outside_tests() -> None:
    with pytest.raises(ValidationError, match="SERVER_WORKERS"):
        IntelligenceSettings(environment="development", shared_secret="dev-secret-must-be-set-anyway", server_workers=2)


def test_single_worker_without_redis_is_allowed() -> None:
    settings = _staging_settings(
        redis_url="redis://localhost:6379/0", server_workers=1, rabbitmq_url="amqp://broker:5672/v"
    )
    assert settings.server_workers == 1
