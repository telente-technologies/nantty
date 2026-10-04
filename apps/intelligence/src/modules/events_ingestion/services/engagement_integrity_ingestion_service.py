from collections.abc import Sequence
from dataclasses import replace

from src.interfaces.feature_backend_interface import (
    FeatureBackend,
    FeatureWriteOperation,
    HashFieldIncrement,
    KeyExpiry,
)
from src.modules.trending.services.trending_contribution_service import TrendingContribution
from src.repositories.online_feature_keyspace_repository import (
    DAILY_COUNTER_TTL_SECONDS,
    ITEM_STATISTICS_TTL_SECONDS,
    TRENDING_ACTOR_DEDUPLICATION_TTL_SECONDS,
    OnlineFeatureKeyspace,
    format_utc_day_bucket,
    format_utc_hour_bucket,
)

LOW_TRUST_LEVELS = frozenset({"new", "low"})
LOW_TRUST_WEIGHT_MULTIPLIER = 0.25
CLUSTERED_WEIGHT_MULTIPLIER = 0.1
ACTOR_HOURLY_ENGAGEMENT_CAP = 60
ACTOR_VELOCITY_TTL_SECONDS = 2 * 3600
PRIMARY_ITEM_KINDS = frozenset({"post", "clip"})
VELOCITY_FIELD = "engagements"


def build_integrity_counter_operations(
    contribution: TrendingContribution, low_trust: bool, clustered: bool, keyspace: OnlineFeatureKeyspace
) -> list[FeatureWriteOperation]:
    if contribution.item_kind in PRIMARY_ITEM_KINDS:
        key = keyspace.item_statistics_key(contribution.item_id)
        ttl_seconds = ITEM_STATISTICS_TTL_SECONDS
    elif contribution.item_kind in ("hashtag", "topic"):
        key = keyspace.trending_integrity_key(
            contribution.item_kind, contribution.item_id, format_utc_day_bucket(contribution.occurred_at)
        )
        ttl_seconds = DAILY_COUNTER_TTL_SECONDS
    else:
        return []
    operations: list[FeatureWriteOperation] = [HashFieldIncrement(key, "integrity_engagements", 1.0)]
    if low_trust:
        operations.append(HashFieldIncrement(key, "integrity_low_trust", 1.0))
    if clustered:
        operations.append(HashFieldIncrement(key, "integrity_clustered", 1.0))
    operations.append(KeyExpiry(key, ttl_seconds))
    return operations


async def adjust_trending_contributions_for_integrity(
    backend: FeatureBackend, keyspace: OnlineFeatureKeyspace, contributions: Sequence[TrendingContribution]
) -> tuple[list[TrendingContribution], list[FeatureWriteOperation]]:
    if not contributions:
        return [], []
    actor_hours = list(
        dict.fromkeys((item.actor_id, format_utc_hour_bucket(item.occurred_at)) for item in contributions)
    )
    velocity_rows = await backend.read_hash_fields(
        [keyspace.actor_velocity_key(actor_id, hour) for actor_id, hour in actor_hours]
    )
    engagements_so_far = {
        actor_hour: row.get(VELOCITY_FIELD, 0.0) for actor_hour, row in zip(actor_hours, velocity_rows, strict=True)
    }
    clustered_indices = [index for index, item in enumerate(contributions) if item.actor_cluster_key]
    cluster_claims = await backend.claim_keys_if_absent(
        [
            keyspace.trending_cluster_claim_key(
                contributions[index].item_kind,
                contributions[index].item_id,
                contributions[index].actor_cluster_key or "",
                format_utc_hour_bucket(contributions[index].occurred_at),
            )
            for index in clustered_indices
        ],
        TRENDING_ACTOR_DEDUPLICATION_TTL_SECONDS,
    )
    clustered = {index for index, claimed in zip(clustered_indices, cluster_claims, strict=True) if not claimed}
    adjusted: list[TrendingContribution] = []
    operations: list[FeatureWriteOperation] = []
    for index, contribution in enumerate(contributions):
        actor_hour = (contribution.actor_id, format_utc_hour_bucket(contribution.occurred_at))
        if contribution.item_kind in PRIMARY_ITEM_KINDS:
            engagements_so_far[actor_hour] += 1
            velocity_key = keyspace.actor_velocity_key(*actor_hour)
            operations += [
                HashFieldIncrement(velocity_key, VELOCITY_FIELD, 1.0),
                KeyExpiry(velocity_key, ACTOR_VELOCITY_TTL_SECONDS),
            ]
        if engagements_so_far[actor_hour] > ACTOR_HOURLY_ENGAGEMENT_CAP:
            continue
        low_trust = contribution.actor_trust in LOW_TRUST_LEVELS
        is_clustered = index in clustered
        multiplier = (LOW_TRUST_WEIGHT_MULTIPLIER if low_trust else 1.0) * (
            CLUSTERED_WEIGHT_MULTIPLIER if is_clustered else 1.0
        )
        operations += build_integrity_counter_operations(contribution, low_trust, is_clustered, keyspace)
        adjusted.append(replace(contribution, weight=contribution.weight * multiplier))
    return adjusted, operations
