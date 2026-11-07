import asyncio
from collections.abc import Sequence
from datetime import datetime

from src.interfaces.feature_backend_interface import (
    FeatureBackend,
    FeatureWriteOperation,
    KeyExpiry,
    SortedSetIncrement,
)
from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.repositories.online_feature_keyspace_repository import (
    ACCOUNT_AFFINITY_KIND,
    ACCOUNT_DELETED_FIELD,
    AFFINITY_HALF_LIFE_SECONDS,
    ITEM_AFFINITY_KIND,
    PERSONALIZATION_OPT_OUT_FIELD,
    TOPIC_AFFINITY_KIND,
    OnlineFeatureKeyspace,
    append_generation_suffix,
    format_utc_day_bucket,
)
from src.repositories.online_feature_keyspace_repository import SEEN_ITEMS_RETENTION_COUNT as SEEN_ITEMS_READ_LIMIT
from src.utils.decay_math_util import (
    HALF_LIVES_PER_FORWARD_DECAY_GENERATION,
    calculate_forward_decay_read_multiplier,
    calculate_forward_decay_write_weight,
    list_readable_forward_decay_generations,
)


def build_forward_decayed_increment_operations(
    base_key: str, member: str, base_weight: float, event_unix_time_seconds: float, half_life_seconds: float
) -> list[FeatureWriteOperation]:
    generation_index, stored_weight = calculate_forward_decay_write_weight(
        base_weight, event_unix_time_seconds, half_life_seconds
    )
    generation_key = append_generation_suffix(base_key, generation_index)
    retention_seconds = int(half_life_seconds * HALF_LIVES_PER_FORWARD_DECAY_GENERATION * 2.2)
    return [
        SortedSetIncrement(generation_key, member, stored_weight),
        KeyExpiry(generation_key, retention_seconds),
    ]


class OnlineFeatureStore:
    def __init__(self, feature_backend: FeatureBackend, keyspace: OnlineFeatureKeyspace) -> None:
        self.feature_backend = feature_backend
        self.keyspace = keyspace

    async def is_personalization_allowed(self, user_id: str) -> bool:
        rows = await self.feature_backend.read_hash_fields([self.keyspace.consent_key(user_id)])
        flags = rows[0]
        return not (flags.get(PERSONALIZATION_OPT_OUT_FIELD, 0.0) or flags.get(ACCOUNT_DELETED_FIELD, 0.0))

    async def read_decayed_member_scores(
        self, base_key: str, members: Sequence[str], half_life_seconds: float, read_unix_time_seconds: float
    ) -> dict[str, float]:
        unique_members = list(dict.fromkeys(members))
        if not unique_members:
            return {}
        generations = list_readable_forward_decay_generations(read_unix_time_seconds, half_life_seconds)
        requests = [(append_generation_suffix(base_key, generation), unique_members) for generation in generations]
        raw_scores_per_generation = await self.feature_backend.read_sorted_set_member_scores(requests)
        decayed_scores: dict[str, float] = dict.fromkeys(unique_members, 0.0)
        for generation, raw_scores in zip(generations, raw_scores_per_generation, strict=True):
            multiplier = calculate_forward_decay_read_multiplier(generation, read_unix_time_seconds, half_life_seconds)
            for member, raw_score in zip(unique_members, raw_scores, strict=True):
                if raw_score is not None:
                    decayed_scores[member] += raw_score * multiplier
        return decayed_scores

    async def read_decayed_highest_members(
        self, base_key: str, limit: int, half_life_seconds: float, read_unix_time_seconds: float
    ) -> list[tuple[str, float]]:
        generations = list_readable_forward_decay_generations(read_unix_time_seconds, half_life_seconds)
        generation_keys = [append_generation_suffix(base_key, generation) for generation in generations]
        rows_per_generation = await self.feature_backend.read_sorted_set_highest_members(generation_keys, limit)
        combined_scores: dict[str, float] = {}
        for generation, rows in zip(generations, rows_per_generation, strict=True):
            multiplier = calculate_forward_decay_read_multiplier(generation, read_unix_time_seconds, half_life_seconds)
            for member, raw_score in rows:
                combined_scores[member] = combined_scores.get(member, 0.0) + raw_score * multiplier
        ordered = sorted(combined_scores.items(), key=lambda pair: (-pair[1], pair[0]))
        return ordered[:limit]

    async def read_viewer_online_features(
        self,
        viewer_user_id: str,
        account_ids: Sequence[str],
        topic_ids: Sequence[str],
        item_ids: Sequence[str],
        now: datetime,
        include_recently_seen_items: bool = True,
    ) -> ViewerOnlineFeatures:
        read_unix_time_seconds = now.timestamp()
        unique_item_ids = list(dict.fromkeys(item_ids))
        seen_keys = [self.keyspace.recently_seen_items_key(viewer_user_id)] if include_recently_seen_items else []
        (
            personalization_allowed,
            topic_affinity,
            account_affinity,
            item_affinity,
            item_rows,
            seen_rows,
        ) = await asyncio.gather(
            self.is_personalization_allowed(viewer_user_id),
            self.read_decayed_member_scores(
                self.keyspace.affinity_base_key(TOPIC_AFFINITY_KIND, viewer_user_id),
                topic_ids,
                AFFINITY_HALF_LIFE_SECONDS,
                read_unix_time_seconds,
            ),
            self.read_decayed_member_scores(
                self.keyspace.affinity_base_key(ACCOUNT_AFFINITY_KIND, viewer_user_id),
                account_ids,
                AFFINITY_HALF_LIFE_SECONDS,
                read_unix_time_seconds,
            ),
            self.read_decayed_member_scores(
                self.keyspace.affinity_base_key(ITEM_AFFINITY_KIND, viewer_user_id),
                unique_item_ids,
                AFFINITY_HALF_LIFE_SECONDS,
                read_unix_time_seconds,
            ),
            self.feature_backend.read_hash_fields(
                [self.keyspace.item_statistics_key(item_id) for item_id in unique_item_ids]
            ),
            self.feature_backend.read_sorted_set_highest_members(seen_keys, SEEN_ITEMS_READ_LIMIT),
        )
        if not personalization_allowed:
            return ViewerOnlineFeatures(item_statistics_by_item=dict(zip(unique_item_ids, item_rows, strict=True)))
        seen_item_ids = frozenset(member for rows in seen_rows for member, _score in rows)
        return ViewerOnlineFeatures(
            topic_affinity_by_topic=topic_affinity,
            account_affinity_by_account=account_affinity,
            item_affinity_by_item=item_affinity,
            item_statistics_by_item=dict(zip(unique_item_ids, item_rows, strict=True)),
            recently_seen_item_ids=seen_item_ids,
        )

    async def read_viewer_top_topic_affinities(
        self, viewer_user_id: str, limit: int, now: datetime
    ) -> list[tuple[str, float]]:
        if not await self.is_personalization_allowed(viewer_user_id):
            return []
        return await self.read_decayed_highest_members(
            self.keyspace.affinity_base_key(TOPIC_AFFINITY_KIND, viewer_user_id),
            limit,
            AFFINITY_HALF_LIFE_SECONDS,
            now.timestamp(),
        )

    async def read_viewer_top_item_affinities(
        self, viewer_user_id: str, limit: int, now: datetime
    ) -> list[tuple[str, float]]:
        if not await self.is_personalization_allowed(viewer_user_id):
            return []
        return await self.read_decayed_highest_members(
            self.keyspace.affinity_base_key(ITEM_AFFINITY_KIND, viewer_user_id),
            limit,
            AFFINITY_HALF_LIFE_SECONDS,
            now.timestamp(),
        )

    async def read_ad_statistics(self, ad_ids: Sequence[str]) -> dict[str, dict[str, float]]:
        unique_ad_ids = list(dict.fromkeys(ad_ids))
        rows = await self.feature_backend.read_hash_fields(
            [self.keyspace.ad_statistics_key(ad_id) for ad_id in unique_ad_ids]
        )
        return dict(zip(unique_ad_ids, rows, strict=True))

    async def read_viewer_ad_frequency_today(self, viewer_user_id: str, now: datetime) -> dict[str, float]:
        rows = await self.feature_backend.read_hash_fields(
            [self.keyspace.ad_frequency_key(format_utc_day_bucket(now), viewer_user_id)]
        )
        return rows[0]

    async def read_campaign_spend_today(
        self, campaign_ids: Sequence[str], now: datetime
    ) -> dict[str, dict[str, float]]:
        unique_campaign_ids = list(dict.fromkeys(campaign_ids))
        day_bucket = format_utc_day_bucket(now)
        rows = await self.feature_backend.read_hash_fields(
            [self.keyspace.campaign_spend_key(day_bucket, campaign_id) for campaign_id in unique_campaign_ids]
        )
        return dict(zip(unique_campaign_ids, rows, strict=True))
