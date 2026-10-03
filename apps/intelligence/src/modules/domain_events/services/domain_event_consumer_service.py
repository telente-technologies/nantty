import json
import logging
from dataclasses import dataclass
from typing import Literal

from pydantic import ValidationError

from src.events.domain_event_dto import (
    AccountDeletionExecutedDomainEvent,
    AccountDeletionRequestedDomainEvent,
    ConsentGrantedDomainEvent,
    ConsentWithdrawnDomainEvent,
    DomainEvent,
    domain_event_type_adapter,
    unwrap_queue_message_body,
)
from src.modules.domain_events.services.behaviour_feature_service import build_behaviour_operations
from src.modules.domain_events.services.domain_event_translation_service import translate_to_intelligence_event
from src.modules.domain_events.services.personal_data_purge_service import PersonalDataPurgeService
from src.modules.events_ingestion.services.event_ingestion_service import EventIngestionService
from src.repositories.online_feature_keyspace_repository import ACCOUNT_DELETED_FIELD
from src.repositories.online_feature_repository import OnlineFeatureStore

consumer_logger = logging.getLogger("intelligence.domain_events")

type ProcessingStatus = Literal["processed", "duplicate", "rejected", "skipped_deleted_account"]
DOMAIN_CLAIM_PREFIX = "domain:"
DOMAIN_CLAIM_TTL_SECONDS = 7 * 24 * 3600


@dataclass(frozen=True, slots=True)
class DomainEventProcessingOutcome:
    status: ProcessingStatus
    event_id: str | None = None


class DomainEventConsumerService:
    def __init__(
        self,
        feature_store: OnlineFeatureStore,
        event_ingestion_service: EventIngestionService,
        purge_service: PersonalDataPurgeService,
    ) -> None:
        self.feature_store = feature_store
        self.event_ingestion_service = event_ingestion_service
        self.purge_service = purge_service

    def parse_message_body(self, message_body: str) -> DomainEvent | None:
        try:
            return domain_event_type_adapter.validate_python(unwrap_queue_message_body(json.loads(message_body)))
        except (ValidationError, ValueError, TypeError) as parse_error:
            error_type = type(parse_error).__name__
            consumer_logger.warning("domain_event_rejected", extra={"error_type": error_type})
            return None

    async def process_message_body(self, message_body: str) -> DomainEventProcessingOutcome:
        event = self.parse_message_body(message_body)
        if event is None:
            return DomainEventProcessingOutcome("rejected")
        backend = self.feature_store.feature_backend
        keyspace = self.feature_store.keyspace
        claim_key = keyspace.event_deduplication_key(f"{DOMAIN_CLAIM_PREFIX}{event.event_id}")
        if not (await backend.claim_keys_if_absent([claim_key], DOMAIN_CLAIM_TTL_SECONDS))[0]:
            return DomainEventProcessingOutcome("duplicate", event.event_id)
        try:
            return await self.apply_event(event)
        except Exception:
            await backend.delete_keys([claim_key])
            raise

    async def apply_event(self, event: DomainEvent) -> DomainEventProcessingOutcome:
        if isinstance(event, AccountDeletionExecutedDomainEvent):
            await self.purge_service.purge_account(event.actor_id)
            return DomainEventProcessingOutcome("processed", event.event_id)
        if isinstance(event, AccountDeletionRequestedDomainEvent):
            await self.purge_service.record_personalization_choice(event.actor_id, False)
            return DomainEventProcessingOutcome("processed", event.event_id)
        if isinstance(event, ConsentGrantedDomainEvent | ConsentWithdrawnDomainEvent):
            gating_types = {"personalization", "advertising"}
            granted = isinstance(event, ConsentGrantedDomainEvent)
            if event.payload.consent_type in gating_types and (
                not granted or event.payload.consent_type == "personalization"
            ):
                await self.purge_service.record_personalization_choice(event.actor_id, granted)
            return DomainEventProcessingOutcome("processed", event.event_id)
        consent_rows = await self.feature_store.feature_backend.read_hash_fields(
            [self.feature_store.keyspace.consent_key(event.actor_id)]
        )
        if consent_rows[0].get(ACCOUNT_DELETED_FIELD):
            return DomainEventProcessingOutcome("skipped_deleted_account", event.event_id)
        personalization_allowed = await self.feature_store.is_personalization_allowed(event.actor_id)
        intelligence_event = translate_to_intelligence_event(event, personalization_allowed)
        if intelligence_event is not None:
            await self.event_ingestion_service.ingest_event_batch([intelligence_event])
        operations = build_behaviour_operations(event, self.feature_store.keyspace)
        if operations:
            await self.feature_store.feature_backend.apply_write_operations(operations)
        return DomainEventProcessingOutcome("processed", event.event_id)
