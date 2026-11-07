from collections.abc import Sequence
from dataclasses import dataclass

from src.events.event_envelope_dto import (
    AdClickEvent,
    AdConversionEvent,
    AddedToCartEvent,
    AdImpressionEvent,
    ClipWatchedEvent,
    CommentedEvent,
    FollowedEvent,
    HiddenEvent,
    IntelligenceEvent,
    PostLikedEvent,
    PostViewedEvent,
    ProductViewedEvent,
    PurchasedEvent,
    ReportedEvent,
    SavedEvent,
    SearchedEvent,
    SharedEvent,
)
from src.interfaces.feature_backend_interface import (
    DistinctMemberAdd,
    FeatureWriteOperation,
    HashFieldIncrement,
    KeyExpiry,
    SortedSetAssignScore,
    SortedSetKeepHighestScores,
)
from src.modules.risk.services.value_flow_feature_service import build_value_flow_operations
from src.modules.trending.services.trending_contribution_service import (
    TrendingContribution,
    list_trending_contributions_for_event,
)
from src.repositories.online_feature_keyspace_repository import (
    ACCOUNT_AFFINITY_KIND,
    AFFINITY_HALF_LIFE_SECONDS,
    CLIP_TOPIC_POPULARITY_HALF_LIFE_SECONDS,
    DAILY_COUNTER_TTL_SECONDS,
    EXPERIMENT_COUNTER_TTL_SECONDS,
    ITEM_AFFINITY_KIND,
    ITEM_STATISTICS_TTL_SECONDS,
    SEEN_ITEMS_RETENTION_COUNT,
    SEEN_ITEMS_TTL_SECONDS,
    TOPIC_AFFINITY_KIND,
    OnlineFeatureKeyspace,
    format_utc_day_bucket,
)
from src.repositories.online_feature_repository import build_forward_decayed_increment_operations

LONG_DWELL_MILLISECONDS = 8000
COMMENTED_AFFINITY_WEIGHT = 2.0


@dataclass(frozen=True, slots=True)
class EventFeatureUpdatePlan:
    write_operations: list[FeatureWriteOperation]
    trending_contributions: list[TrendingContribution]


def calculate_affinity_signal_weight(event: IntelligenceEvent) -> float:
    weight: float
    match event:
        case PostViewedEvent():
            weight = min(event.payload.dwell_ms / 20_000.0, 1.0) * 0.5
        case PostLikedEvent():
            weight = 1.0
        case CommentedEvent():
            weight = COMMENTED_AFFINITY_WEIGHT
        case SharedEvent():
            weight = 3.0
        case SavedEvent():
            weight = 2.5
        case FollowedEvent():
            weight = 4.0
        case ClipWatchedEvent():
            weight = event.payload.watch_fraction + 0.5 * min(event.payload.loop_count, 4)
        case ProductViewedEvent():
            weight = 0.5
        case SearchedEvent() if event.payload.clicked_item_type == "product" and event.payload.clicked_item_id:
            weight = 1.5
        case AddedToCartEvent():
            weight = 2.0
        case PurchasedEvent():
            weight = 5.0
        case HiddenEvent():
            weight = -3.0
        case ReportedEvent():
            weight = -5.0
        case _:
            weight = 0.0
    return weight


def find_affinity_targets(event: IntelligenceEvent) -> tuple[list[str], list[str]]:
    targets: tuple[list[str], list[str]]
    match event:
        case PostViewedEvent() | PostLikedEvent() | CommentedEvent() | SharedEvent():
            targets = [event.payload.author_id], [*event.payload.topics, *event.payload.hashtags]
        case ClipWatchedEvent():
            targets = [event.payload.creator_id], [*event.payload.topics, *event.payload.hashtags]
        case SavedEvent():
            authors = [event.payload.author_id] if event.payload.author_id else []
            targets = authors, [*event.payload.topics, *event.payload.hashtags]
        case ProductViewedEvent():
            targets = [event.payload.store_id], list(event.payload.topics)
        case AddedToCartEvent() | PurchasedEvent():
            targets = [event.payload.store_id], []
        case FollowedEvent():
            targets = [event.payload.target_account_id], []
        case HiddenEvent():
            authors = [event.payload.target_author_id] if event.payload.target_author_id else []
            targets = authors, list(event.payload.topics)
        case ReportedEvent():
            authors = [event.payload.target_author_id] if event.payload.target_author_id else []
            targets = authors, []
        case _:
            targets = [], []
    return targets


def find_item_affinity_targets(event: IntelligenceEvent) -> list[tuple[str, float]]:
    match event:
        case ProductViewedEvent():
            return [(event.payload.product_id, 0.5)]
        case AddedToCartEvent():
            return [(event.payload.product_id, 2.0)]
        case PurchasedEvent():
            return [(item.product_id, 5.0 * item.quantity) for item in event.payload.items]
        case SearchedEvent() if event.payload.clicked_item_type == "product" and event.payload.clicked_item_id:
            return [(event.payload.clicked_item_id, 1.5)]
        case _:
            return []


def build_item_statistics_increments(event: IntelligenceEvent) -> list[tuple[str, str, float]]:
    result: list[tuple[str, str, float]]
    match event:
        case PostViewedEvent():
            long_dwell = 1.0 if event.payload.dwell_ms >= LONG_DWELL_MILLISECONDS else 0.0
            result = [
                (event.payload.post_id, "views", 1.0),
                (event.payload.post_id, "dwell_ms_sum", float(event.payload.dwell_ms)),
                (event.payload.post_id, "long_dwells", long_dwell),
            ]
        case PostLikedEvent():
            result = [(event.payload.post_id, "likes", 1.0)]
        case CommentedEvent():
            result = [(event.payload.post_id, "comments", 1.0)]
        case SharedEvent():
            result = [(event.payload.post_id, "shares", 1.0)]
        case SavedEvent():
            result = [(event.payload.target_id, "saves", 1.0)]
        case ClipWatchedEvent():
            completed = 1.0 if event.payload.watch_fraction >= 0.9 else 0.0
            rewatched = 1.0 if event.payload.loop_count >= 1 else 0.0
            result = [
                (event.payload.clip_id, "watches", 1.0),
                (event.payload.clip_id, "watch_fraction_sum", event.payload.watch_fraction),
                (event.payload.clip_id, "completions", completed),
                (event.payload.clip_id, "rewatches", rewatched),
            ]
        case ProductViewedEvent():
            product_increments = [(event.payload.product_id, "product_views", 1.0)]
            if event.payload.source_post_id:
                product_increments.append((event.payload.source_post_id, "product_clicks", 1.0))
            result = product_increments
        case AddedToCartEvent():
            result = [(event.payload.product_id, "carts", 1.0)]
        case PurchasedEvent():
            result = [(item.product_id, "purchases", float(item.quantity)) for item in event.payload.items]
        case ReportedEvent():
            result = [(event.payload.target_id, "reports", 1.0)]
        case HiddenEvent():
            result = [(event.payload.target_id, "hides", 1.0)]
        case _:
            result = []
    return result


def build_advertising_operations(
    event: IntelligenceEvent, keyspace: OnlineFeatureKeyspace
) -> list[FeatureWriteOperation]:
    day_bucket = format_utc_day_bucket(event.occurred_at)
    operations: list[FeatureWriteOperation] = []
    if not isinstance(event, AdImpressionEvent | AdClickEvent | AdConversionEvent):
        return []
    ad_key = keyspace.ad_statistics_key(event.payload.ad_id)
    match event:
        case AdImpressionEvent():
            frequency_key = keyspace.ad_frequency_key(day_bucket, event.actor_id)
            operations += [
                HashFieldIncrement(ad_key, "impressions", 1.0),
                HashFieldIncrement(frequency_key, event.payload.campaign_id, 1.0),
                KeyExpiry(frequency_key, DAILY_COUNTER_TTL_SECONDS),
            ]
            charge = event.payload.charge
        case AdClickEvent():
            operations.append(HashFieldIncrement(ad_key, "clicks", 1.0))
            charge = event.payload.charge
        case AdConversionEvent():
            operations.append(HashFieldIncrement(ad_key, "conversions", 1.0))
            charge = None
    operations.append(KeyExpiry(ad_key, ITEM_STATISTICS_TTL_SECONDS))
    if charge is not None and charge.amount_minor > 0:
        spend_key = keyspace.campaign_spend_key(day_bucket, event.payload.campaign_id)
        operations += [
            HashFieldIncrement(spend_key, charge.currency, float(charge.amount_minor)),
            KeyExpiry(spend_key, DAILY_COUNTER_TTL_SECONDS),
        ]
    return operations


def build_experiment_operations(
    event: IntelligenceEvent, keyspace: OnlineFeatureKeyspace
) -> list[FeatureWriteOperation]:
    operations: list[FeatureWriteOperation] = []
    for experiment_key, variant_name in event.context.experiment_assignments.items():
        counter_key = keyspace.experiment_counter_key(experiment_key, variant_name)
        users_key = keyspace.experiment_distinct_users_key(experiment_key, variant_name)
        operations += [
            HashFieldIncrement(counter_key, event.event_type, 1.0),
            KeyExpiry(counter_key, EXPERIMENT_COUNTER_TTL_SECONDS),
            DistinctMemberAdd(users_key, event.actor_id),
            KeyExpiry(users_key, EXPERIMENT_COUNTER_TTL_SECONDS),
        ]
    return operations


def plan_online_feature_updates_for_events(
    events: Sequence[IntelligenceEvent], keyspace: OnlineFeatureKeyspace
) -> EventFeatureUpdatePlan:
    operations: list[FeatureWriteOperation] = []
    trending_contributions: list[TrendingContribution] = []
    for event in events:
        event_unix_time = event.occurred_at.timestamp()
        affinity_weight = calculate_affinity_signal_weight(event)
        account_ids, topic_ids = find_affinity_targets(event)
        if affinity_weight != 0.0:
            for account_id in account_ids:
                if account_id == event.actor_id:
                    continue
                operations += build_forward_decayed_increment_operations(
                    keyspace.affinity_base_key(ACCOUNT_AFFINITY_KIND, event.actor_id),
                    account_id,
                    affinity_weight,
                    event_unix_time,
                    AFFINITY_HALF_LIFE_SECONDS,
                )
        for item_id, item_weight in find_item_affinity_targets(event):
            if item_weight != 0.0:
                operations += build_forward_decayed_increment_operations(
                    keyspace.affinity_base_key(ITEM_AFFINITY_KIND, event.actor_id),
                    item_id,
                    item_weight,
                    event_unix_time,
                    AFFINITY_HALF_LIFE_SECONDS,
                )
        for topic_id in dict.fromkeys(topic_ids):
            operations += build_forward_decayed_increment_operations(
                keyspace.affinity_base_key(TOPIC_AFFINITY_KIND, event.actor_id),
                topic_id,
                affinity_weight,
                event_unix_time,
                AFFINITY_HALF_LIFE_SECONDS,
            )
        for item_id, field_name, amount in build_item_statistics_increments(event):
            item_key = keyspace.item_statistics_key(item_id)
            operations += [
                HashFieldIncrement(item_key, field_name, amount),
                KeyExpiry(item_key, ITEM_STATISTICS_TTL_SECONDS),
            ]
        if isinstance(event, PostViewedEvent | ClipWatchedEvent):
            seen_item_id = event.payload.post_id if isinstance(event, PostViewedEvent) else event.payload.clip_id
            seen_key = keyspace.recently_seen_items_key(event.actor_id)
            operations += [
                SortedSetAssignScore(seen_key, seen_item_id, event_unix_time),
                SortedSetKeepHighestScores(seen_key, SEEN_ITEMS_RETENTION_COUNT),
                KeyExpiry(seen_key, SEEN_ITEMS_TTL_SECONDS),
            ]
        if isinstance(event, ClipWatchedEvent) and event.payload.watch_fraction >= 0.5:
            for topic_id in event.payload.topics:
                operations += build_forward_decayed_increment_operations(
                    keyspace.clip_topic_popularity_base_key(topic_id),
                    event.payload.clip_id,
                    event.payload.watch_fraction,
                    event_unix_time,
                    CLIP_TOPIC_POPULARITY_HALF_LIFE_SECONDS,
                )
        operations += build_advertising_operations(event, keyspace)
        operations += build_experiment_operations(event, keyspace)
        operations += build_value_flow_operations(event, keyspace)
        trending_contributions += list_trending_contributions_for_event(event)
    return EventFeatureUpdatePlan(operations, trending_contributions)
