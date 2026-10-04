from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from src.events.event_envelope_dto import (
    AddedToCartEvent,
    ClipWatchedEvent,
    CommentedEvent,
    IntelligenceEvent,
    PostLikedEvent,
    PostViewedEvent,
    ProductViewedEvent,
    PurchasedEvent,
    SharedEvent,
)
from src.interfaces.feature_backend_interface import DistinctMemberAdd, FeatureWriteOperation, KeyExpiry
from src.repositories.online_feature_keyspace_repository import (
    DAILY_COUNTER_TTL_SECONDS,
    TRENDING_LONG_HALF_LIFE_SECONDS,
    TRENDING_SHORT_HALF_LIFE_SECONDS,
    OnlineFeatureKeyspace,
    format_utc_day_bucket,
    format_utc_hour_bucket,
)
from src.repositories.online_feature_repository import build_forward_decayed_increment_operations

type TrendingItemKind = Literal["hashtag", "topic", "post", "clip", "product"]
GLOBAL_TRENDING_SCOPE = "global"


@dataclass(frozen=True, slots=True)
class TrendingContribution:
    item_kind: TrendingItemKind
    item_id: str
    actor_id: str
    country: str | None
    weight: float
    occurred_at: datetime
    actor_trust: str | None = None
    actor_cluster_key: str | None = None


def build_contributions_for_social_item(
    event: IntelligenceEvent,
    item_kind: TrendingItemKind,
    item_id: str,
    topics: Sequence[str],
    hashtags: Sequence[str],
    weight: float,
) -> list[TrendingContribution]:
    trust = event.context.actor_trust
    cluster = event.context.actor_cluster_key
    targets: list[tuple[TrendingItemKind, str]] = [(item_kind, item_id)]
    targets += [("hashtag", hashtag) for hashtag in dict.fromkeys(hashtags)]
    targets += [("topic", topic) for topic in dict.fromkeys(topics)]
    return [
        TrendingContribution(kind, target, event.actor_id, event.country, weight, event.occurred_at, trust, cluster)
        for kind, target in targets
    ]


def list_trending_contributions_for_event(event: IntelligenceEvent) -> list[TrendingContribution]:
    match event:
        case PostViewedEvent() if event.payload.dwell_ms >= 8000:
            payload = event.payload
            return build_contributions_for_social_item(
                event, "post", payload.post_id, payload.topics, payload.hashtags, 0.3
            )
        case PostLikedEvent():
            payload_liked = event.payload
            return build_contributions_for_social_item(
                event, "post", payload_liked.post_id, payload_liked.topics, payload_liked.hashtags, 1.0
            )
        case CommentedEvent():
            payload_commented = event.payload
            return build_contributions_for_social_item(
                event, "post", payload_commented.post_id, payload_commented.topics, payload_commented.hashtags, 2.0
            )
        case SharedEvent():
            payload_shared = event.payload
            return build_contributions_for_social_item(
                event, "post", payload_shared.post_id, payload_shared.topics, payload_shared.hashtags, 3.0
            )
        case ClipWatchedEvent() if event.payload.watch_fraction >= 0.9:
            payload_clip = event.payload
            return build_contributions_for_social_item(
                event, "clip", payload_clip.clip_id, payload_clip.topics, payload_clip.hashtags, 1.0
            )
        case ProductViewedEvent():
            return [
                TrendingContribution(
                    "product", event.payload.product_id, event.actor_id, event.country, 0.3, event.occurred_at
                )
            ]
        case AddedToCartEvent():
            return [
                TrendingContribution(
                    "product", event.payload.product_id, event.actor_id, event.country, 1.5, event.occurred_at
                )
            ]
        case PurchasedEvent():
            return [
                TrendingContribution("product", item.product_id, event.actor_id, event.country, 4.0, event.occurred_at)
                for item in event.payload.items
            ]
        case _:
            return []


def build_trending_actor_claim_key(contribution: TrendingContribution, keyspace: OnlineFeatureKeyspace) -> str:
    return keyspace.trending_actor_claim_key(
        contribution.item_kind,
        contribution.item_id,
        contribution.actor_id,
        format_utc_hour_bucket(contribution.occurred_at),
    )


def build_trending_write_operations(
    contribution: TrendingContribution, keyspace: OnlineFeatureKeyspace
) -> list[FeatureWriteOperation]:
    scopes = [GLOBAL_TRENDING_SCOPE]
    if contribution.country:
        scopes.append(contribution.country)
    event_unix_time = contribution.occurred_at.timestamp()
    day_bucket = format_utc_day_bucket(contribution.occurred_at)
    operations: list[FeatureWriteOperation] = []
    for scope in scopes:
        for horizon, half_life_seconds in (
            ("short", TRENDING_SHORT_HALF_LIFE_SECONDS),
            ("long", TRENDING_LONG_HALF_LIFE_SECONDS),
        ):
            operations += build_forward_decayed_increment_operations(
                keyspace.trending_base_key(contribution.item_kind, scope, horizon),
                contribution.item_id,
                contribution.weight,
                event_unix_time,
                half_life_seconds,
            )
        actors_key = keyspace.trending_distinct_actors_key(
            contribution.item_kind, scope, contribution.item_id, day_bucket
        )
        operations += [
            DistinctMemberAdd(actors_key, contribution.actor_id),
            KeyExpiry(actors_key, DAILY_COUNTER_TTL_SECONDS),
        ]
    return operations
