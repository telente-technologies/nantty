import math
from dataclasses import dataclass
from datetime import timedelta

from src.constants.trend_category_taxonomy_constant import POLITICS_MINIMUM_ACTOR_MULTIPLIER, TrendCategory
from src.dtos.common_dto import RankingResponseMetadata
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError
from src.modules.trending.dtos.trending_dto import TrendingItem, TrendingRequest, TrendingResponse
from src.modules.trending.services.trending_contribution_service import GLOBAL_TRENDING_SCOPE
from src.repositories.online_feature_keyspace_repository import (
    TRENDING_LONG_HALF_LIFE_SECONDS,
    TRENDING_SHORT_HALF_LIFE_SECONDS,
    format_utc_day_bucket,
)
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.ranking_context_service import resolve_request_identifier, resolve_request_time
from src.services.trend_category_service import classify_trend_category, is_spammy_hashtag

BASELINE_PRIOR_WEIGHT = 1.0
MAXIMUM_ACCELERATION = 10.0
CANDIDATE_OVERFETCH_MULTIPLIER = 4
CATEGORY_OVERFETCH_MULTIPLIER = 4
MANIPULATION_MINIMUM_ENGAGEMENTS = 10
MANIPULATION_EXCLUSION_SHARE = 0.5
CATEGORISED_KINDS = frozenset({"hashtag", "topic"})


@dataclass(frozen=True, slots=True)
class TrendingSignal:
    item_id: str
    short_horizon_weight: float
    long_horizon_weight: float
    distinct_actors: int
    negative_feedback_rate: float
    category: TrendCategory = "other"
    manipulation_share: float = 0.0
    integrity_engagements: float = 0.0


def is_signal_manipulated(signal: TrendingSignal) -> bool:
    return (
        signal.integrity_engagements >= MANIPULATION_MINIMUM_ENGAGEMENTS
        and signal.manipulation_share >= MANIPULATION_EXCLUSION_SHARE
    )


def calculate_trending_acceleration(short_horizon_weight: float, long_horizon_weight: float) -> float:
    expected_short_weight_if_steady = long_horizon_weight * (
        TRENDING_SHORT_HALF_LIFE_SECONDS / TRENDING_LONG_HALF_LIFE_SECONDS
    )
    return short_horizon_weight / (expected_short_weight_if_steady + BASELINE_PRIOR_WEIGHT)


def calculate_trending_score(signal: TrendingSignal, minimum_distinct_actors: int) -> tuple[float, float] | None:
    if signal.category == "politics":
        minimum_distinct_actors *= POLITICS_MINIMUM_ACTOR_MULTIPLIER
    if signal.distinct_actors < minimum_distinct_actors or signal.short_horizon_weight <= 0:
        return None
    acceleration = calculate_trending_acceleration(signal.short_horizon_weight, signal.long_horizon_weight)
    spam_penalty = 1.0 - min(signal.negative_feedback_rate * 10.0, 0.9)
    breadth_bonus = math.log1p(signal.distinct_actors)
    integrity_factor = 1.0 - min(signal.manipulation_share, 0.9)
    score = (
        signal.short_horizon_weight
        * math.sqrt(min(acceleration, MAXIMUM_ACCELERATION))
        * spam_penalty
        * integrity_factor
    )
    return score * breadth_bonus, acceleration


def rank_trending_signals(
    signals: list[TrendingSignal],
    minimum_distinct_actors: int,
    excluded_ids: frozenset[str],
    limit: int,
    category: TrendCategory | None = None,
) -> list[TrendingItem]:
    scored_items: list[TrendingItem] = []
    for signal in signals:
        if signal.item_id in excluded_ids or is_signal_manipulated(signal):
            continue
        if category is not None and signal.category != category:
            continue
        score_and_acceleration = calculate_trending_score(signal, minimum_distinct_actors)
        if score_and_acceleration is None:
            continue
        score, acceleration = score_and_acceleration
        scored_items.append(
            TrendingItem(
                item_id=signal.item_id,
                score=round(score, 6),
                acceleration=round(acceleration, 4),
                distinct_actors=signal.distinct_actors,
                category=signal.category,
                manipulation_share=round(signal.manipulation_share, 4),
            )
        )
    return sorted(scored_items, key=lambda item: (-item.score, item.item_id))[:limit]


class TrendingService:
    def __init__(self, feature_store: OnlineFeatureStore | None) -> None:
        self.feature_store = feature_store

    async def read_trending(self, request: TrendingRequest) -> TrendingResponse:
        now = resolve_request_time(request.now)
        scope = request.country or GLOBAL_TRENDING_SCOPE
        items: list[TrendingItem] = []
        manipulated_ids: list[str] = []
        degraded = self.feature_store is None
        if self.feature_store is not None:
            try:
                items, manipulated_ids = await self.read_and_rank_trending_items(self.feature_store, request, scope)
            except FeatureBackendUnavailableError:
                degraded = True
        return TrendingResponse(
            kind=request.kind,
            scope=scope,
            category=request.category,
            items=items,
            manipulated_ids=manipulated_ids,
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(None),
                ranking_source="trending:decayed_velocity",
                degraded=degraded,
                generated_at=now,
            ),
        )

    async def read_and_rank_trending_items(
        self, feature_store: OnlineFeatureStore, request: TrendingRequest, scope: str
    ) -> tuple[list[TrendingItem], list[str]]:
        now = resolve_request_time(request.now)
        keyspace = feature_store.keyspace
        overfetch = CANDIDATE_OVERFETCH_MULTIPLIER * (CATEGORY_OVERFETCH_MULTIPLIER if request.category else 1)
        short_rows = await feature_store.read_decayed_highest_members(
            keyspace.trending_base_key(request.kind, scope, "short"),
            request.limit * overfetch + len(request.excluded_ids),
            TRENDING_SHORT_HALF_LIFE_SECONDS,
            now.timestamp(),
        )
        if request.kind == "hashtag":
            short_rows = [(item_id, weight) for item_id, weight in short_rows if not is_spammy_hashtag(item_id)]
        item_ids = [item_id for item_id, _weight in short_rows]
        long_weights = await feature_store.read_decayed_member_scores(
            keyspace.trending_base_key(request.kind, scope, "long"),
            item_ids,
            TRENDING_LONG_HALF_LIFE_SECONDS,
            now.timestamp(),
        )
        day_buckets = [format_utc_day_bucket(now), format_utc_day_bucket(now - timedelta(days=1))]
        actor_counts = await feature_store.feature_backend.count_distinct_members(
            [
                keyspace.trending_distinct_actors_key(request.kind, scope, item_id, day_bucket)
                for item_id in item_ids
                for day_bucket in day_buckets
            ]
        )
        item_statistics = await feature_store.feature_backend.read_hash_fields(
            [keyspace.item_statistics_key(item_id) for item_id in item_ids]
        )
        integrity_rows = await self.read_integrity_rows(feature_store, request, item_ids, item_statistics, day_buckets)
        signals: list[TrendingSignal] = []
        for index, (item_id, short_weight) in enumerate(short_rows):
            statistics = item_statistics[index]
            exposure = max(statistics.get("views", 0.0) + statistics.get("watches", 0.0), 1.0)
            negative = statistics.get("reports", 0.0) * 3.0 + statistics.get("hides", 0.0)
            integrity = integrity_rows[index]
            engagements = integrity.get("integrity_engagements", 0.0)
            suspicious = integrity.get("integrity_low_trust", 0.0) * 0.75 + integrity.get("integrity_clustered", 0.0)
            signals.append(
                TrendingSignal(
                    item_id=item_id,
                    short_horizon_weight=short_weight,
                    long_horizon_weight=long_weights.get(item_id, 0.0),
                    distinct_actors=max(actor_counts[index * 2], actor_counts[index * 2 + 1]),
                    negative_feedback_rate=min(negative / exposure, 1.0),
                    category=classify_trend_category(item_id) if request.kind in CATEGORISED_KINDS else "other",
                    manipulation_share=min(suspicious / engagements, 1.0) if engagements else 0.0,
                    integrity_engagements=engagements,
                )
            )
        manipulated = sorted(signal.item_id for signal in signals if is_signal_manipulated(signal))
        ranked = rank_trending_signals(
            signals, request.minimum_distinct_actors, frozenset(request.excluded_ids), request.limit, request.category
        )
        return ranked, manipulated

    async def read_integrity_rows(
        self,
        feature_store: OnlineFeatureStore,
        request: TrendingRequest,
        item_ids: list[str],
        item_statistics: list[dict[str, float]],
        day_buckets: list[str],
    ) -> list[dict[str, float]]:
        if request.kind not in CATEGORISED_KINDS:
            return item_statistics
        rows = await feature_store.feature_backend.read_hash_fields(
            [
                feature_store.keyspace.trending_integrity_key(request.kind, item_id, day_bucket)
                for item_id in item_ids
                for day_bucket in day_buckets
            ]
        )
        combined: list[dict[str, float]] = []
        for index in range(len(item_ids)):
            merged: dict[str, float] = {}
            for row in rows[index * len(day_buckets) : (index + 1) * len(day_buckets)]:
                for field_name, value in row.items():
                    merged[field_name] = merged.get(field_name, 0.0) + value
            combined.append(merged)
        return combined
