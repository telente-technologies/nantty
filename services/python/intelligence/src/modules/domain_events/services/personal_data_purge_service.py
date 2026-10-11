import time
from datetime import UTC, datetime

from src.interfaces.feature_backend_interface import (
    FeatureBackend,
    FeatureWriteOperation,
    HashFieldAssign,
    SortedSetAssignScore,
    SortedSetKeepHighestScores,
)
from src.modules.domain_events.services.behaviour_feature_service import list_recent_day_buckets
from src.repositories.online_feature_keyspace_repository import (
    ACCOUNT_AFFINITY_KIND,
    ACCOUNT_DELETED_FIELD,
    AFFINITY_HALF_LIFE_SECONDS,
    BEHAVIOUR_RETENTION_DAYS,
    DAILY_COUNTER_TTL_SECONDS,
    PERSONALIZATION_OPT_OUT_FIELD,
    SECONDS_PER_DAY,
    TOPIC_AFFINITY_KIND,
    VALUE_FLOW_HALF_LIFE_SECONDS,
    OnlineFeatureKeyspace,
    append_generation_suffix,
)
from src.utils.decay_math_util import find_forward_decay_generation

FLOW_DIRECTIONS = ("out", "in")
MAXIMUM_PENDING_ERASURES = 1_000_000
BEHAVIOUR_SET_NAMES = ("recipients", "devices", "ips")


def ad_frequency_purge_bucket_count() -> int:
    return DAILY_COUNTER_TTL_SECONDS // SECONDS_PER_DAY + 1


def list_all_generation_keys(base_key: str, half_life_seconds: float) -> list[str]:
    current = find_forward_decay_generation(time.time(), half_life_seconds).generation_index
    return [append_generation_suffix(base_key, index) for index in range(current + 1)]


class PersonalDataPurgeService:
    def __init__(self, backend: FeatureBackend, keyspace: OnlineFeatureKeyspace) -> None:
        self.backend = backend
        self.keyspace = keyspace

    async def record_personalization_choice(self, user_id: str, personalization_allowed: bool) -> None:
        operations: list[FeatureWriteOperation] = [
            HashFieldAssign(
                self.keyspace.consent_key(user_id),
                PERSONALIZATION_OPT_OUT_FIELD,
                0.0 if personalization_allowed else 1.0,
            )
        ]
        await self.backend.apply_write_operations(operations)
        if not personalization_allowed:
            await self.purge_personalization_features(user_id)

    async def purge_personalization_features(self, user_id: str) -> None:
        await self.backend.apply_write_operations(
            [HashFieldAssign(self.keyspace.consent_key(user_id), PERSONALIZATION_OPT_OUT_FIELD, 1.0)]
        )
        now = datetime.now(UTC)
        keys = [self.keyspace.recently_seen_items_key(user_id)]
        for kind in (TOPIC_AFFINITY_KIND, ACCOUNT_AFFINITY_KIND):
            keys += list_all_generation_keys(self.keyspace.affinity_base_key(kind, user_id), AFFINITY_HALF_LIFE_SECONDS)
        keys += [
            self.keyspace.ad_frequency_key(day, user_id)
            for day in list_recent_day_buckets(now, ad_frequency_purge_bucket_count())
        ]
        await self.backend.delete_keys(keys)

    async def purge_account(self, user_id: str) -> None:
        await self.backend.apply_write_operations(
            [HashFieldAssign(self.keyspace.consent_key(user_id), ACCOUNT_DELETED_FIELD, 1.0)]
        )
        await self.purge_personalization_features(user_id)
        now = datetime.now(UTC)
        keys = [self.keyspace.account_profile_key(user_id)]
        for day in list_recent_day_buckets(now, BEHAVIOUR_RETENTION_DAYS + 1):
            keys.append(self.keyspace.behaviour_counter_key(user_id, day))
            keys += [self.keyspace.behaviour_distinct_key(name, user_id, day) for name in BEHAVIOUR_SET_NAMES]
        for direction in FLOW_DIRECTIONS:
            keys += list_all_generation_keys(
                self.keyspace.value_flow_base_key(direction, user_id), VALUE_FLOW_HALF_LIFE_SECONDS
            )
        await self.backend.delete_keys(keys)
        erasure_key = self.keyspace.pending_dataset_erasure_key()
        await self.backend.apply_write_operations(
            [
                HashFieldAssign(self.keyspace.consent_key(user_id), ACCOUNT_DELETED_FIELD, 1.0),
                SortedSetAssignScore(erasure_key, user_id, now.timestamp()),
                SortedSetKeepHighestScores(erasure_key, MAXIMUM_PENDING_ERASURES),
            ]
        )
