import argparse
import asyncio
import inspect
import json
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast
from unittest.mock import patch

import pytest
from aio_pika import Message
from aio_pika.abc import AbstractIncomingMessage

from src.configs.settings_config import IntelligenceSettings
from src.container import ApplicationContainer, build_application_container
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.integrations.dataset_storage_integration import build_local_dataset_storage_location
from src.integrations.media_fingerprint_integration import (
    MEDIA_FINGERPRINT_CONCURRENCY_LIMIT,
    media_fingerprint_semaphore,
)
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError, FeatureWriteOperation
from src.jobs import compact_datasets_job
from src.jobs.compact_datasets_job import delete_orphaned_inprogress_files, delete_partitions_older_than
from src.jobs.pipeline_cli_job import resolve_storage_and_registry
from src.loaders import lifespan_loader
from src.modules.ad_click_prediction.dtos.ad_click_prediction_dto import AdClickPredictionRequest
from src.modules.ads.dtos.ad_selection_dto import AdSelectionRequest
from src.modules.chat_spam.dtos.chat_spam_dto import ChatSpamRequest
from src.modules.chat_spam.services.chat_spam_scoring_service import ChatSpamScoringService
from src.modules.content_scoring.dtos.content_score_dto import ContentScoreMessage
from src.modules.domain_events.repositories.sqs_domain_event_queue_repository import (
    SqsDomainEventQueuePoller,
    backoff_delay_seconds,
)
from src.modules.domain_events.services.personal_data_purge_service import PersonalDataPurgeService
from src.modules.model_registry.repositories import model_registry_repository as registry_module
from src.modules.model_registry.repositories.model_registry_repository import (
    ModelArtifactRejectedError,
    ModelRegistry,
)
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder
from src.modules.moderation.dtos.content_moderation_dto import ContentModerationRequest
from src.modules.moderation.services.content_moderation_service import ContentModerationService
from src.modules.moderation.services.moderation_model_interface_service import ModerationModelHolder
from src.modules.recommendations.dtos.recommendation_dto import ProductRecommendationRequest
from src.modules.risk.dtos.risk_scoring_dto import RiskScoringRequest
from src.modules.risk.dtos.value_transfer_risk_dto import CoinTransferRiskSignals
from src.modules.risk.services.value_flow_feature_service import ValueFlowSignals
from src.modules.risk.services.value_transfer_risk_rules_service import evaluate_coin_transfer_risk_rules
from src.modules.trending.dtos.headline_dto import HeadlineRequest
from src.modules.trending.queries.build_headlines.build_headlines_handler import BuildHeadlinesHandler
from src.modules.trending.queries.build_headlines.build_headlines_query import BuildHeadlinesQuery
from src.repositories.online_feature_keyspace_repository import (
    ACCOUNT_DELETED_FIELD,
    PERSONALIZATION_OPT_OUT_FIELD,
    format_utc_day_bucket,
)
from src.utils import amqp_message_settlement_util
from src.utils.amqp_message_settlement_util import retry_or_dead_letter
from tests.conftest import build_event, build_viewer
from tests.modules.ad_click_prediction.test_ad_click_prediction import prediction_payload
from tests.modules.ads.test_ad_auction_and_pricing import build_ad_candidate
from tests.modules.domain_events.test_domain_event_consumer import domain_event
from tests.modules.feed.test_feed_ranking import build_feed_candidates, rank_feed
from tests.modules.model_registry.test_model_registry import SIGNING_SECRET, register_bundle


class RecordingSqsClient:
    def __init__(self, bodies: list[str], receive_counts: list[int] | None = None) -> None:
        self.messages = [
            {
                "Body": body,
                "ReceiptHandle": f"handle_{index}",
                "MessageId": f"message_{index}",
                "Attributes": {"ApproximateReceiveCount": str((receive_counts or [1] * len(bodies))[index])},
            }
            for index, body in enumerate(bodies)
        ]
        self.deleted: list[str] = []
        self.sent: list[dict[str, Any]] = []

    def receive_message(self, **_kwargs: Any) -> dict[str, Any]:
        return {"Messages": self.messages}

    def delete_message(self, **kwargs: Any) -> dict[str, Any]:
        self.deleted.append(str(kwargs["ReceiptHandle"]))
        return {}

    def send_message(self, **kwargs: Any) -> dict[str, Any]:
        self.sent.append(dict(kwargs))
        return {}


def build_poller(
    client: RecordingSqsClient, container: ApplicationContainer, dlq: str = "http://dlq"
) -> SqsDomainEventQueuePoller:
    return SqsDomainEventQueuePoller(client, "http://queue", container.domain_event_consumer_service, 0, dlq, 3)


async def test_sqs_rejected_message_is_forwarded_to_dlq(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    client = RecordingSqsClient(["garbage"])
    poller = build_poller(client, application_container)
    assert await poller.poll_once() == 1
    assert client.deleted == ["handle_0"]
    assert [entry["QueueUrl"] for entry in client.sent] == ["http://dlq"]
    assert str(client.sent[0]["MessageBody"]) == "garbage"


async def test_sqs_failing_message_reaches_dlq_after_max_attempts(
    application_container: ApplicationContainer,
    feature_backend: InMemoryFeatureBackend,
    reference_now: datetime,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def explode(_operations: list[FeatureWriteOperation]) -> None:
        raise RuntimeError("backend down")

    monkeypatch.setattr(feature_backend, "apply_write_operations", explode)
    monkeypatch.setattr(
        "src.modules.domain_events.repositories.sqs_domain_event_queue_repository.backoff_delay_seconds",
        lambda _attempt: 0.0,
    )
    body = domain_event("evt_dlq_1", "post.created", "author_dlq", reference_now, {"postId": "p_dlq"})
    client = RecordingSqsClient([body])
    poller = build_poller(client, application_container)
    assert await poller.poll_once() == 0
    assert client.deleted == []
    assert await poller.poll_once() == 0
    assert client.deleted == []
    assert await poller.poll_once() == 1
    assert client.deleted == ["handle_0"]
    assert len(client.sent) == 1


async def test_sqs_receive_count_attribute_counts_toward_dlq_limit(
    application_container: ApplicationContainer,
    feature_backend: InMemoryFeatureBackend,
    reference_now: datetime,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def explode(_operations: list[FeatureWriteOperation]) -> None:
        raise RuntimeError("backend down")

    monkeypatch.setattr(feature_backend, "apply_write_operations", explode)
    monkeypatch.setattr(
        "src.modules.domain_events.repositories.sqs_domain_event_queue_repository.backoff_delay_seconds",
        lambda _attempt: 0.0,
    )
    body = domain_event("evt_dlq_2", "post.created", "author_dlq", reference_now, {"postId": "p_dlq"})
    client = RecordingSqsClient([body], [5])
    poller = build_poller(client, application_container)
    assert await poller.poll_once() == 1
    assert client.deleted == ["handle_0"]


class RaisingContentScorePublisher:
    delivers = True

    async def publish_content_score(self, _message: ContentScoreMessage) -> None:
        raise ConnectionError("broker unavailable")


async def test_side_effect_publish_failure_does_not_poison_domain_pipeline(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    service = application_container.content_scoring_service
    service.publisher = RaisingContentScorePublisher()
    body = domain_event(
        "evt_side_effect_1",
        "post.created",
        "author_side",
        reference_now,
        {"postId": "post_side", "text": "hello world"},
    )
    outcome = await application_container.domain_event_consumer_service.process_message_body(body)
    assert outcome.status == "processed"


class FakeIncomingMessage:
    def __init__(self, body: str, attempt: int = 0) -> None:
        self.body = body.encode()
        self.headers: dict[str, Any] = {"x-zudomart-attempt": attempt} if attempt else {}
        self.message_id = "msg-regression"
        self.type = "post.created"
        self.content_type = "application/json"
        self.settlements: list[tuple[str, bool]] = []

    async def ack(self, multiple: bool = False) -> None:
        self.settlements.append(("ack", multiple))

    async def reject(self, requeue: bool = False) -> None:
        self.settlements.append(("reject", requeue))

    async def nack(self, multiple: bool = False, requeue: bool = True) -> None:
        self.settlements.append(("nack", requeue and not multiple))


class AlwaysFailingRetryPublisher:
    async def __call__(self, _message: Message, _routing_key: str) -> object:
        raise ConnectionError("retry exchange unavailable")


async def test_amqp_retry_publish_failures_are_capped_to_dlx(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(amqp_message_settlement_util, "REQUEUE_BACKOFF_SECONDS", 0.0)
    amqp_message_settlement_util.requeue_without_publish_counts.clear()
    message = FakeIncomingMessage("body")
    error = RuntimeError("processing failed")
    outcomes = [
        await retry_or_dead_letter(
            cast(AbstractIncomingMessage, message), "queue", error, AlwaysFailingRetryPublisher()
        )
        for _ in range(5)
    ]
    assert outcomes == ["requeued", "requeued", "requeued", "requeued", "dead_lettered"]
    assert message.settlements == [("nack", True)] * 4 + [("reject", False)]
    amqp_message_settlement_util.requeue_without_publish_counts.clear()


async def test_activation_verifies_artifact_and_empty_secret_fails_closed(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, SIGNING_SECRET)
    version = register_bundle(registry, 0.2)
    (tmp_path / "ad_click" / version / "artifact.pkl").write_bytes(b"tampered")
    with pytest.raises(ModelArtifactRejectedError):
        registry.activate_model_version("ad_click", version)
    assert registry.read_active_version("ad_click") is None
    clean_version = register_bundle(registry, 0.3, second=5)
    unsigned = ModelRegistry(tmp_path, "", "production")
    with pytest.raises(ModelArtifactRejectedError, match="artifact_signature_missing"):
        unsigned.load_model_version("ad_click", clean_version)


async def test_unsigned_artifact_loads_in_development_and_test_only(tmp_path: Path) -> None:
    unsigned = ModelRegistry(tmp_path, "")
    version = register_bundle(unsigned, 0.2)
    assert ModelRegistry(tmp_path, "", "development").load_model_version("ad_click", version).version == version
    assert ModelRegistry(tmp_path, "", "test").load_model_version("ad_click", version).version == version


async def test_holder_reverts_to_last_good_after_consecutive_rejections(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, SIGNING_SECRET)
    holder = ActiveModelHolder(registry)
    good_version = register_bundle(registry, 0.2, second=1)
    registry.activate_model_version("ad_click", good_version)
    assert await holder.reload_changed_models() == ["ad_click"]
    bad_version = register_bundle(registry, 0.9, second=2)
    registry.activate_model_version("ad_click", bad_version)
    (tmp_path / "ad_click" / bad_version / "artifact.pkl").write_bytes(b"corrupt")
    assert await holder.reload_changed_models() == []
    assert await holder.reload_changed_models() == []
    assert await holder.reload_changed_models() == []
    assert registry.read_active_version("ad_click") == good_version
    assert holder.get_active_version("ad_click") == good_version


def test_pipeline_cli_resolves_registry_through_settings(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, intelligence_settings: IntelligenceSettings
) -> None:
    monkeypatch.setattr("src.jobs.pipeline_cli_job.load_intelligence_settings", lambda: intelligence_settings)
    storage = str(tmp_path / "cli-data")
    registry = str(tmp_path / "cli-registry")
    arguments = argparse.Namespace(storage=storage, registry=registry)
    location, model_registry = resolve_storage_and_registry(arguments)
    assert location.root_path == str(Path(storage).resolve())
    assert model_registry.registry_root == Path(registry)
    assert model_registry.signing_secret == intelligence_settings.model_signing_secret.get_secret_value()
    assert model_registry.environment == intelligence_settings.environment


async def test_purge_writes_tombstone_before_deletes(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    backend = application_container.feature_backend
    keyspace = application_container.feature_store.keyspace
    recorded: list[str] = []

    original_apply = backend.apply_write_operations
    original_delete = backend.delete_keys

    async def recording_apply(operations: Sequence[FeatureWriteOperation]) -> None:
        recorded.append(f"write:{sorted({type(operation).__name__ for operation in operations})}")
        await original_apply(operations)

    async def recording_delete(keys: Sequence[str]) -> None:
        recorded.append(f"delete:{len(keys)}")
        await original_delete(keys)

    backend.apply_write_operations = recording_apply  # type: ignore[method-assign]
    backend.delete_keys = recording_delete  # type: ignore[method-assign]
    try:
        await application_container.domain_event_consumer_service.purge_service.purge_account("tombstone_user")
    finally:
        del backend.apply_write_operations
        del backend.delete_keys
    assert len(recorded) > 0
    assert recorded[0].startswith("write:")
    consent = await backend.read_hash_fields([keyspace.consent_key("tombstone_user")])
    assert consent[0].get(ACCOUNT_DELETED_FIELD) == 1.0


async def test_purge_covers_full_ad_frequency_window(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    purge_service = application_container.domain_event_consumer_service.purge_service
    backend = application_container.feature_backend
    keyspace = application_container.feature_store.keyspace
    deleted: list[str] = []
    original_delete = backend.delete_keys

    async def recording_delete(keys: Sequence[str]) -> None:
        deleted.extend(keys)
        await original_delete(keys)

    backend.delete_keys = recording_delete  # type: ignore[method-assign]
    try:
        await purge_service.purge_personalization_features("window_user")
    finally:
        del backend.delete_keys
    frequency_keys = [key for key in deleted if ":adfreq:" in key]
    assert len(frequency_keys) >= 4
    consent = await backend.read_hash_fields([keyspace.consent_key("window_user")])
    assert consent[0].get(PERSONALIZATION_OPT_OUT_FIELD) == 1.0


def write_partition(location: Any, dataset: str, partition: str, name: str, content: bytes = b"x") -> str:
    path = f"{location.join(dataset)}/{partition}/{name}"
    location.filesystem.create_dir(f"{location.join(dataset)}/{partition}")
    with location.filesystem.open_output_stream(path) as stream:
        stream.write(content)
    return path


def test_retention_deletes_old_partitions_and_orphans(tmp_path: Path) -> None:
    location = build_local_dataset_storage_location(str(tmp_path / "datasets"))
    old_partition = "event_date=2000-01-01"
    write_partition(location, "raw_events", f"event_type=post.viewed/{old_partition}", "part-old.parquet")
    recent = datetime.now(UTC).date().isoformat()
    write_partition(location, "raw_events", f"event_type=post.viewed/event_date={recent}", "part-new.parquet")
    stale_dir = f"{location.join('feature_logs')}/event_date=2000-01-02"
    location.filesystem.create_dir(stale_dir)
    with location.filesystem.open_output_stream(f"{stale_dir}/.inprogress-part-abc.parquet") as stream:
        stream.write(b"orphan")
    removed = delete_partitions_older_than(location, 30, timedelta(days=1))
    assert removed["raw_events"] == 1
    assert removed["feature_logs"] == 1
    orphans = delete_orphaned_inprogress_files(location, timedelta(days=1))
    assert orphans == 0


def test_retention_keeps_recent_partitions(tmp_path: Path) -> None:
    location = build_local_dataset_storage_location(str(tmp_path / "datasets"))
    recent = datetime.now(UTC).date().isoformat()
    write_partition(location, "raw_events", f"event_type=post.viewed/event_date={recent}", "part-new.parquet")
    removed = delete_partitions_older_than(location, 30, timedelta(days=1))
    assert removed["raw_events"] == 0


async def test_missing_models_mark_responses_degraded(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    feed = await rank_feed(
        application_container,
        {
            "viewer": build_viewer(),
            "candidates": build_feed_candidates(reference_now, 5),
            "now": reference_now.isoformat(),
        },
    )
    assert feed.metadata.degraded is True
    assert feed.metadata.model_version is None
    order_request = RiskScoringRequest.model_validate(
        {
            "subjectType": "order",
            "subjectId": "order_1",
            "actorId": "actor_1",
            "exchangeRates": [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}],
            "order": {
                "amount": {"amountMinor": 1000, "currency": "NGN"},
                "accountAgeHours": 100,
                "buyerPreviousOrderCount": 2,
            },
            "now": reference_now.isoformat(),
        }
    )
    risk = await application_container.risk_scoring_service.score_risk(order_request)
    assert risk.metadata.degraded is True
    ad_request = AdSelectionRequest.model_validate(
        {
            "placement": "feed",
            "viewer": build_viewer(),
            "organicItems": [],
            "candidates": [build_ad_candidate("ad_1", "adv_1", "cpc", 5000).model_dump(by_alias=True, mode="json")],
            "exchangeRates": [{"currency": "USD", "usdPerMajorUnit": "1.0"}],
            "now": reference_now.isoformat(),
        }
    )
    ads = await application_container.ad_selection_service.select_ads(ad_request)
    assert ads.metadata.degraded is True
    ctr_request = AdClickPredictionRequest.model_validate({**prediction_payload(), "now": reference_now.isoformat()})
    ctr = await application_container.ad_click_prediction_service.predict_ad_click_rate(ctr_request)
    assert ctr.metadata.degraded is True
    product_request = ProductRecommendationRequest.model_validate(
        {
            "surface": "mart_home",
            "viewer": build_viewer(),
            "candidates": [],
            "limit": 5,
            "now": reference_now.isoformat(),
        }
    )
    products = await application_container.product_recommendation_service.recommend_products(product_request)
    assert products.metadata.degraded is True


async def test_chat_spam_unavailable_store_floors_to_throttle(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    service = application_container.chat_spam_scoring_service
    service.feature_store = None
    request = ChatSpamRequest.model_validate(
        {
            "senderId": "quiet_sender",
            "behaviour": {"accountAgeHours": 900, "messagesLastHour": 1},
            "useStoredBehaviour": True,
            "now": reference_now.isoformat(),
        }
    )
    response = await service.score_chat_spam(request)
    assert response.metadata.degraded is True
    assert response.recommended_action == "throttle"
    assert response.level == "medium"
    service.feature_store = application_container.feature_store


async def test_chat_spam_backend_outage_floors_to_throttle(
    intelligence_settings: IntelligenceSettings, reference_now: datetime
) -> None:
    class OutageBackend(InMemoryFeatureBackend):
        async def read_hash_fields(self, _keys: Sequence[str]) -> list[dict[str, float]]:
            raise FeatureBackendUnavailableError("redis down")

    container = build_application_container(intelligence_settings, OutageBackend())
    service: ChatSpamScoringService = container.chat_spam_scoring_service
    request = ChatSpamRequest.model_validate(
        {
            "senderId": "sender_outage",
            "behaviour": {"accountAgeHours": 900, "messagesLastHour": 1},
            "useStoredBehaviour": True,
            "now": reference_now.isoformat(),
        }
    )
    response = await service.score_chat_spam(request)
    assert response.metadata.degraded is True
    assert response.recommended_action == "throttle"
    assert response.level == "medium"


def test_value_flow_unavailable_reason_is_nonzero() -> None:
    signals = CoinTransferRiskSignals.model_validate(
        {
            "recipientId": "recipient_1",
            "coinAmount": 10,
            "senderAccountAgeHours": 500,
            "recipientAccountAgeHours": 500,
        }
    )
    reasons = evaluate_coin_transfer_risk_rules(signals, ValueFlowSignals())
    codes = {reason.code: reason.weight for reason in reasons}
    assert codes.get("value_flow_unavailable", 0.0) > 0.0


async def test_text_moderation_degraded_allow_becomes_review(reference_now: datetime) -> None:
    holder = ModerationModelHolder()
    service = ContentModerationService(holder)

    class BrokenModel:
        version = "broken-v1"

        def classify(self, _text: str, _content_type: object) -> dict[str, float]:
            raise RuntimeError("model down")

    holder.register_model(cast(Any, BrokenModel()))
    response = await service.classify_content(
        ContentModerationRequest(content_id="c1", content_type="comment", text="hello there", now=reference_now)
    )
    assert response.metadata.degraded is True
    assert response.suggested_action == "review"


async def test_cpu_cores_run_off_the_event_loop(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    real_to_thread = asyncio.to_thread
    calls: list[str] = []

    async def recording_to_thread(func: Any, *args: Any, **kwargs: Any) -> Any:
        calls.append(getattr(func, "__name__", type(func).__name__))
        return await real_to_thread(func, *args, **kwargs)

    with patch("asyncio.to_thread", recording_to_thread):
        await rank_feed(
            application_container,
            {
                "viewer": build_viewer(),
                "candidates": build_feed_candidates(reference_now, 5),
                "now": reference_now.isoformat(),
            },
        )
        handler = BuildHeadlinesHandler()
        await handler.execute(
            BuildHeadlinesQuery(
                request=HeadlineRequest.model_validate(
                    {
                        "posts": [
                            {
                                "postId": f"p{index}",
                                "authorId": f"a{index}",
                                "text": "fashion week highlights and runway reviews",
                                "createdAt": reference_now.isoformat(),
                                "hashtags": ["fashion"],
                            }
                            for index in range(3)
                        ],
                        "limit": 5,
                        "minimumPostsPerStory": 2,
                        "minimumDistinctAuthors": 2,
                    }
                )
            )
        )
        await application_container.event_ingestion_service.ingest_event_batch(
            [
                build_event(
                    "evt_thread_1",
                    "post_liked",
                    "viewer_thread",
                    reference_now,
                    {"postId": "p1", "authorId": "author_1", "topics": ["fashion"]},
                    country="NG",
                )
            ],
            reference_now,
        )
    assert "score_feed_candidates_in_two_stages" in calls
    assert "build_headlines_from_posts" in calls
    assert "validate_raw_events" in calls


def test_media_fingerprint_path_is_bounded() -> None:
    assert MEDIA_FINGERPRINT_CONCURRENCY_LIMIT == 8
    assert isinstance(media_fingerprint_semaphore, asyncio.Semaphore)


async def test_sqs_backoff_is_jittered_and_bounded() -> None:
    samples = [backoff_delay_seconds(1) for _ in range(50)]
    assert min(samples) >= 1.0
    assert max(samples) <= 3.0
    assert len(set(samples)) > 1
    assert backoff_delay_seconds(100) <= 30.0


def test_compact_retention_helpers_are_wired_in_lifespan() -> None:
    source = inspect.getsource(lifespan_loader)
    assert "run_periodic_retention_loop" in source
    assert "dataset_retention_days" in source


def test_dlq_setting_exists_on_intelligence_settings(intelligence_settings: IntelligenceSettings) -> None:
    assert intelligence_settings.domain_events_dlq_queue_url == ""
    assert intelligence_settings.sqs_max_delivery_attempts >= 1


def test_single_read_pickle_load_uses_buffer() -> None:
    source = inspect.getsource(registry_module)
    assert "io.BytesIO" in source
    assert "verify_artifact_buffer_integrity" in source


async def test_rejected_side_effect_still_ingests_event(
    application_container: ApplicationContainer,
    feature_backend: InMemoryFeatureBackend,
    reference_now: datetime,
) -> None:
    service = application_container.content_scoring_service
    service.publisher = RaisingContentScorePublisher()
    body = domain_event(
        "evt_side_effect_2",
        "post.created",
        "author_side_2",
        reference_now,
        {"postId": "post_side_2", "text": "hello world"},
    )
    outcome = await application_container.domain_event_consumer_service.process_message_body(body)
    assert outcome.status == "processed"
    keyspace = application_container.feature_store.keyspace
    counters = await feature_backend.read_hash_fields(
        [keyspace.behaviour_counter_key("author_side_2", format_utc_day_bucket(reference_now))]
    )
    assert counters[0].get("posts_created") == 1.0


def test_settlement_module_caps_requeues() -> None:
    source = inspect.getsource(amqp_message_settlement_util)
    assert "MAXIMUM_REQUEUE_WITHOUT_PUBLISH" in source
    assert "REQUEUE_BACKOFF_SECONDS" in source


def test_purge_module_writes_tombstone_first() -> None:
    source = inspect.getsource(PersonalDataPurgeService.purge_account)
    first_write = source.index("ACCOUNT_DELETED_FIELD, 1.0")
    first_delete = source.index("delete_keys")
    assert first_write < first_delete


def test_compact_module_parses_partition_dates_once() -> None:
    assert compact_datasets_job.partition_date_of("x/event_date=2026-01-02") is not None
    assert compact_datasets_job.partition_date_of("x/wat") is None


async def test_poll_once_counts_toward_acknowledged_on_dlq_forward(
    application_container: ApplicationContainer,
) -> None:
    payload = json.dumps({"Message": "not used"})
    _ = payload
    client = RecordingSqsClient(["not json"])
    poller = build_poller(client, application_container)
    assert await poller.poll_once() == 1
    assert len(client.sent) == 1
