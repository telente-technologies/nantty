import asyncio
import contextlib
import json
import logging
from dataclasses import dataclass
from typing import Literal

from pydantic import ValidationError

from src.events.contract_envelope_normalizer import is_unattributed_purchase, unwrap_queue_message_body
from src.events.domain_event_dto import (
    AccountDeletionExecutedDomainEvent,
    AccountDeletionRequestedDomainEvent,
    CommentCreatedDomainEvent,
    CommentHiddenDomainEvent,
    CommentUnhiddenDomainEvent,
    ConsentGrantedDomainEvent,
    ConsentWithdrawnDomainEvent,
    DomainEvent,
    MediaProcessedDomainEvent,
    PostCreatedDomainEvent,
    domain_event_type_adapter,
)
from src.modules.content_scoring.services.content_scoring_service import ContentScoringService
from src.modules.domain_events.services.behaviour_feature_service import build_behaviour_operations
from src.modules.domain_events.services.comment_signal_service import CommentSignalService
from src.modules.domain_events.services.domain_event_translation_service import translate_to_intelligence_event
from src.modules.domain_events.services.personal_data_purge_service import PersonalDataPurgeService
from src.modules.events_ingestion.services.event_ingestion_service import EventIngestionService
from src.repositories.online_feature_keyspace_repository import ACCOUNT_DELETED_FIELD
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.identifier_hashing_service import OpaqueIdentifierHasher

consumer_logger = logging.getLogger("intelligence.domain_events")

type ProcessingStatus = Literal["processed", "duplicate", "rejected", "skipped_deleted_account", "skipped_unattributed"]
DOMAIN_CLAIM_NAMESPACE = "domain"


def describe_rejected_envelope(normalized: object) -> dict[str, str]:
    if not isinstance(normalized, dict):
        return {}
    described = {
        "event_id": normalized.get("eventId") or normalized.get("id"),
        "event_type": normalized.get("eventType") or normalized.get("type"),
        "schema_version": normalized.get("schemaVersion"),
    }
    return {key: str(value)[:128] for key, value in described.items() if value is not None}


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
        identifier_hasher: OpaqueIdentifierHasher,
        content_scoring_service: ContentScoringService | None = None,
    ) -> None:
        self.feature_store = feature_store
        self.identifier_hasher = identifier_hasher
        self.event_ingestion_service = event_ingestion_service
        self.purge_service = purge_service
        self.content_scoring_service = content_scoring_service
        self.comment_signals = CommentSignalService(feature_store, identifier_hasher)

    async def score_content_for_trust(self, event: DomainEvent) -> None:
        if self.content_scoring_service is None:
            return
        try:
            if isinstance(event, PostCreatedDomainEvent):
                payload = event.payload
                await self.content_scoring_service.score_created_post(
                    payload.post_id, event.actor_id, payload.kind, payload.text, payload.media_ids, event.occurred_at
                )
            elif isinstance(event, MediaProcessedDomainEvent):
                await self.content_scoring_service.score_processed_media(
                    event.payload.media_id,
                    event.actor_id,
                    event.payload.purpose,
                    event.occurred_at,
                    event.payload.image_key,
                )
        except Exception:
            consumer_logger.exception("content_score_side_effect_failed")

    def parse_message_body(self, message_body: str) -> DomainEvent | None:
        normalized: object = None
        try:
            normalized = unwrap_queue_message_body(json.loads(message_body))
            return domain_event_type_adapter.validate_python(normalized)
        except (ValidationError, ValueError, TypeError) as parse_error:
            consumer_logger.warning(
                "domain_event_rejected",
                extra={"error_type": type(parse_error).__name__, **describe_rejected_envelope(normalized)},
            )
            return None

    @staticmethod
    def is_unattributed_purchase_body(message_body: str) -> bool:
        try:
            return is_unattributed_purchase(unwrap_queue_message_body(json.loads(message_body)))
        except ValueError, TypeError:
            return False

    async def process_message_body(self, message_body: str) -> DomainEventProcessingOutcome:
        event = self.parse_message_body(message_body)
        if event is None:
            if self.is_unattributed_purchase_body(message_body):
                return DomainEventProcessingOutcome("skipped_unattributed")
            return DomainEventProcessingOutcome("rejected")
        backend = self.feature_store.feature_backend
        keyspace = self.feature_store.keyspace
        claim_key = keyspace.internal_claim_key(DOMAIN_CLAIM_NAMESPACE, event.event_id)
        if not (
            await backend.claim_keys_if_absent(
                [claim_key], self.event_ingestion_service.deduplication_retention_seconds
            )
        )[0]:
            return DomainEventProcessingOutcome("duplicate", event.event_id)
        try:
            return await self.apply_event(event)
        except asyncio.CancelledError:
            with contextlib.suppress(Exception):
                await backend.delete_keys([claim_key])
            raise
        except Exception:
            with contextlib.suppress(Exception):
                await backend.delete_keys([claim_key])
            raise

    def account_identities(self, actor_id: str) -> list[str]:
        hashed = self.identifier_hasher.hash_user_id(actor_id)
        return [actor_id] if hashed == actor_id else [actor_id, hashed]

    async def apply_event(self, event: DomainEvent) -> DomainEventProcessingOutcome:
        if isinstance(event, AccountDeletionExecutedDomainEvent):
            for identity in self.account_identities(event.actor_id):
                await self.purge_service.purge_account(identity)
            return DomainEventProcessingOutcome("processed", event.event_id)
        if isinstance(event, AccountDeletionRequestedDomainEvent):
            for identity in self.account_identities(event.actor_id):
                await self.purge_service.record_personalization_choice(identity, False)
            return DomainEventProcessingOutcome("processed", event.event_id)
        if isinstance(event, ConsentGrantedDomainEvent | ConsentWithdrawnDomainEvent):
            gating_types = {"personalization", "advertising"}
            granted = isinstance(event, ConsentGrantedDomainEvent)
            if event.payload.consent_type in gating_types and (
                not granted or event.payload.consent_type == "personalization"
            ):
                for identity in self.account_identities(event.actor_id):
                    await self.purge_service.record_personalization_choice(identity, granted)
            return DomainEventProcessingOutcome("processed", event.event_id)
        await self.score_content_for_trust(event)
        if isinstance(event, MediaProcessedDomainEvent):
            return DomainEventProcessingOutcome("processed", event.event_id)
        consent_rows = await self.feature_store.feature_backend.read_hash_fields(
            [self.feature_store.keyspace.consent_key(event.actor_id)]
        )
        if consent_rows[0].get(ACCOUNT_DELETED_FIELD):
            return DomainEventProcessingOutcome("skipped_deleted_account", event.event_id)
        if isinstance(event, CommentHiddenDomainEvent | CommentUnhiddenDomainEvent):
            await self.comment_signals.apply_visibility_change(event)
            return DomainEventProcessingOutcome("processed", event.event_id)
        personalization_allowed = await self.feature_store.is_personalization_allowed(
            self.identifier_hasher.hash_user_id(event.actor_id)
        )
        intelligence_event = translate_to_intelligence_event(event, personalization_allowed, self.identifier_hasher)
        if intelligence_event is not None:
            await self.event_ingestion_service.ingest_event_batch([intelligence_event])
            if isinstance(event, CommentCreatedDomainEvent):
                await self.comment_signals.remember_contribution(event)
        operations = build_behaviour_operations(event, self.feature_store.keyspace)
        if operations:
            await self.feature_store.feature_backend.apply_write_operations(operations)
        return DomainEventProcessingOutcome("processed", event.event_id)
