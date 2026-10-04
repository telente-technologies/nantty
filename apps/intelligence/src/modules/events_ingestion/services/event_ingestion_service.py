import logging
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from pydantic import JsonValue, ValidationError

from src.events.event_envelope_dto import (
    EventBatchResponse,
    IntelligenceEvent,
    RejectedEvent,
    describe_validation_failure_without_values,
    intelligence_event_type_adapter,
)
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError, FeatureWriteOperation
from src.modules.events_ingestion.repositories.raw_event_parquet_repository import RawEventParquetSink
from src.modules.events_ingestion.services.engagement_integrity_ingestion_service import (
    adjust_trending_contributions_for_integrity,
)
from src.modules.events_ingestion.services.event_feature_update_service import plan_online_feature_updates_for_events
from src.modules.trending.services.trending_contribution_service import (
    build_trending_actor_claim_key,
    build_trending_write_operations,
)
from src.repositories.online_feature_keyspace_repository import TRENDING_ACTOR_DEDUPLICATION_TTL_SECONDS
from src.repositories.online_feature_repository import OnlineFeatureStore

ingestion_logger = logging.getLogger("intelligence.events")
MAXIMUM_FUTURE_CLOCK_DRIFT = timedelta(minutes=5)


class EventStorageUnavailableError(RuntimeError):
    pass


def validate_raw_events(
    raw_events: Sequence[dict[str, JsonValue]], received_at: datetime
) -> tuple[list[IntelligenceEvent], list[RejectedEvent]]:
    valid_events: list[IntelligenceEvent] = []
    rejected: list[RejectedEvent] = []
    for index, raw_event in enumerate(raw_events):
        raw_event_id = raw_event.get("eventId")
        event_id = raw_event_id if isinstance(raw_event_id, str) and len(raw_event_id) <= 128 else None
        try:
            event = intelligence_event_type_adapter.validate_python(raw_event)
        except ValidationError as validation_error:
            reason = describe_validation_failure_without_values(validation_error.errors(include_input=False))
            rejected.append(RejectedEvent(index=index, event_id=event_id, reason=reason))
            continue
        if event.occurred_at > received_at + MAXIMUM_FUTURE_CLOCK_DRIFT:
            rejected.append(RejectedEvent(index=index, event_id=event_id, reason="occurred_at_in_future"))
            continue
        valid_events.append(event)
    return valid_events, rejected


class EventIngestionService:
    def __init__(
        self,
        feature_store: OnlineFeatureStore,
        raw_event_sink: RawEventParquetSink,
        deduplication_retention_seconds: int,
    ) -> None:
        self.feature_store = feature_store
        self.raw_event_sink = raw_event_sink
        self.deduplication_retention_seconds = deduplication_retention_seconds

    async def ingest_event_batch(
        self, raw_events: Sequence[dict[str, JsonValue]], received_at: datetime | None = None
    ) -> EventBatchResponse:
        received_at = received_at or datetime.now(UTC)
        valid_events, rejected = validate_raw_events(raw_events, received_at)
        unique_events: dict[str, IntelligenceEvent] = {}
        duplicate_count = 0
        for event in valid_events:
            if event.event_id in unique_events:
                duplicate_count += 1
                continue
            unique_events[event.event_id] = event
        keyspace = self.feature_store.keyspace
        backend = self.feature_store.feature_backend
        claim_keys = [keyspace.event_deduplication_key(event_id) for event_id in unique_events]
        try:
            claim_results = await backend.claim_keys_if_absent(claim_keys, self.deduplication_retention_seconds)
        except FeatureBackendUnavailableError as backend_error:
            raise EventStorageUnavailableError("deduplication store unavailable") from backend_error
        new_events = [event for event, claimed in zip(unique_events.values(), claim_results, strict=True) if claimed]
        duplicate_count += len(unique_events) - len(new_events)
        claimed_keys = [keyspace.event_deduplication_key(event.event_id) for event in new_events]
        try:
            await self.raw_event_sink.write_events(new_events, received_at)
        except Exception as storage_error:
            await self.release_claims_quietly(claimed_keys)
            ingestion_logger.exception("raw_event_write_failed", extra={"event_count": len(new_events)})
            raise EventStorageUnavailableError("raw event storage unavailable") from storage_error
        await self.update_online_features_best_effort(new_events)
        return EventBatchResponse(accepted=len(new_events), duplicates=duplicate_count, rejected=rejected)

    async def release_claims_quietly(self, claimed_keys: list[str]) -> None:
        try:
            await self.feature_store.feature_backend.delete_keys(claimed_keys)
        except FeatureBackendUnavailableError:
            ingestion_logger.warning("event_claim_release_failed", extra={"event_count": len(claimed_keys)})

    async def update_online_features_best_effort(self, events: Sequence[IntelligenceEvent]) -> None:
        if not events:
            return
        keyspace = self.feature_store.keyspace
        backend = self.feature_store.feature_backend
        update_plan = plan_online_feature_updates_for_events(events, keyspace)
        try:
            trending_claims = await backend.claim_keys_if_absent(
                [
                    build_trending_actor_claim_key(contribution, keyspace)
                    for contribution in update_plan.trending_contributions
                ],
                TRENDING_ACTOR_DEDUPLICATION_TTL_SECONDS,
            )
            operations: list[FeatureWriteOperation] = list(update_plan.write_operations)
            claimed_contributions = [
                contribution
                for contribution, claimed in zip(update_plan.trending_contributions, trending_claims, strict=True)
                if claimed
            ]
            adjusted_contributions, integrity_operations = await adjust_trending_contributions_for_integrity(
                backend, keyspace, claimed_contributions
            )
            operations += integrity_operations
            for contribution in adjusted_contributions:
                operations += build_trending_write_operations(contribution, keyspace)
            await backend.apply_write_operations(operations)
        except FeatureBackendUnavailableError:
            ingestion_logger.warning("online_feature_update_failed", extra={"event_count": len(events)})
