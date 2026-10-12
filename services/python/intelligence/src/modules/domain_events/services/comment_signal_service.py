from src.events.domain_event_dto import CommentCreatedDomainEvent, CommentHiddenDomainEvent, CommentUnhiddenDomainEvent
from src.interfaces.feature_backend_interface import (
    FeatureWriteOperation,
    HashFieldAssign,
    HashFieldIncrement,
    KeyExpiry,
)
from src.modules.events_ingestion.services.event_feature_update_service import COMMENTED_AFFINITY_WEIGHT
from src.repositories.online_feature_keyspace_repository import (
    ACCOUNT_AFFINITY_KIND,
    AFFINITY_HALF_LIFE_SECONDS,
    ITEM_STATISTICS_TTL_SECONDS,
    TOPIC_AFFINITY_KIND,
)
from src.repositories.online_feature_repository import OnlineFeatureStore, build_forward_decayed_increment_operations
from src.services.identifier_hashing_service import OpaqueIdentifierHasher

OCCURRED_AT_FIELD = "occurred_at"
HIDDEN_FIELD = "hidden"
TOPIC_FIELD_PREFIX = "topic:"


class CommentSignalService:
    def __init__(self, feature_store: OnlineFeatureStore, identifier_hasher: OpaqueIdentifierHasher) -> None:
        self.feature_store = feature_store
        self.identifier_hasher = identifier_hasher

    async def remember_contribution(self, event: CommentCreatedDomainEvent) -> None:
        if event.payload.comment_id is None or event.payload.author_id is None:
            return
        key = self.feature_store.keyspace.comment_signal_key(event.payload.comment_id)
        topics = dict.fromkeys([*event.payload.topics, *event.payload.hashtags])
        operations: list[FeatureWriteOperation] = [
            HashFieldAssign(key, OCCURRED_AT_FIELD, event.occurred_at.timestamp()),
            HashFieldAssign(key, HIDDEN_FIELD, 0.0),
            *(HashFieldAssign(key, TOPIC_FIELD_PREFIX + topic, 1.0) for topic in topics),
            KeyExpiry(key, ITEM_STATISTICS_TTL_SECONDS),
        ]
        await self.feature_store.feature_backend.apply_write_operations(operations)

    async def apply_visibility_change(self, event: CommentHiddenDomainEvent | CommentUnhiddenDomainEvent) -> None:
        hide = isinstance(event, CommentHiddenDomainEvent)
        keyspace = self.feature_store.keyspace
        key = keyspace.comment_signal_key(event.payload.comment_id)
        record = (await self.feature_store.feature_backend.read_hash_fields([key]))[0]
        if OCCURRED_AT_FIELD not in record or bool(record.get(HIDDEN_FIELD)) == hide:
            return
        weight = -COMMENTED_AFFINITY_WEIGHT if hide else COMMENTED_AFFINITY_WEIGHT
        occurred_at = record[OCCURRED_AT_FIELD]
        actor = self.identifier_hasher.hash_user_id(event.actor_id)
        post_author = self.identifier_hasher.hash_user_id(event.payload.post_author_id)
        operations: list[FeatureWriteOperation] = []
        if post_author != actor:
            operations += build_forward_decayed_increment_operations(
                keyspace.affinity_base_key(ACCOUNT_AFFINITY_KIND, actor),
                post_author,
                weight,
                occurred_at,
                AFFINITY_HALF_LIFE_SECONDS,
            )
        for field in record:
            if field.startswith(TOPIC_FIELD_PREFIX):
                operations += build_forward_decayed_increment_operations(
                    keyspace.affinity_base_key(TOPIC_AFFINITY_KIND, actor),
                    field.removeprefix(TOPIC_FIELD_PREFIX),
                    weight,
                    occurred_at,
                    AFFINITY_HALF_LIFE_SECONDS,
                )
        item_key = keyspace.item_statistics_key(event.payload.post_id)
        operations += [
            HashFieldIncrement(item_key, "comments", -1.0 if hide else 1.0),
            KeyExpiry(item_key, ITEM_STATISTICS_TTL_SECONDS),
            HashFieldAssign(key, HIDDEN_FIELD, 1.0 if hide else 0.0),
        ]
        await self.feature_store.feature_backend.apply_write_operations(operations)
