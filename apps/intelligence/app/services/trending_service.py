import math
from dataclasses import dataclass
from datetime import timedelta

from app.models.common_model import RankingResponseMetadata
from app.models.discovery_model import TrendingItem, TrendingRequest, TrendingResponse
from app.services.ranking_context_service import resolve_request_identifier, resolve_request_time
from app.services.trending_contribution_service import GLOBAL_TRENDING_SCOPE
from app.stores.feature_backend_protocol import FeatureBackendUnavailableError
from app.stores.online_feature_keyspace import (
    TRENDING_LONG_HALF_LIFE_SECONDS,
    TRENDING_SHORT_HALF_LIFE_SECONDS,
    format_utc_day_bucket,
)
from app.stores.online_feature_store import OnlineFeatureStore

BASELINE_PRIOR_WEIGHT = 1.0
MAXIMUM_ACCELERATION = 10.0
CANDIDATE_OVERFETCH_MULTIPLIER = 4


@dataclass(frozen=True, slots=True)
class TrendingSignal:
    item_id: str
    short_horizon_weight: float
    long_horizon_weight: float
    distinct_actors: int
    negative_feedback_rate: float


def calculate_trending_acceleration(short_horizon_weight: float, long_horizon_weight: float) -> float:
    expected_short_weight_if_steady = long_horizon_weight * (
        TRENDING_SHORT_HALF_LIFE_SECONDS / TRENDING_LONG_HALF_LIFE_SECONDS
    )
    return short_horizon_weight / (expected_short_weight_if_steady + BASELINE_PRIOR_WEIGHT)


def calculate_trending_score(signal: TrendingSignal, minimum_distinct_actors: int) -> tuple[float, float] | None:
    if signal.distinct_actors < minimum_distinct_actors or signal.short_horizon_weight <= 0:
        return None
    acceleration = calculate_trending_acceleration(signal.short_horizon_weight, signal.long_horizon_weight)
    spam_penalty = 1.0 - min(signal.negative_feedback_rate * 10.0, 0.9)
    breadth_bonus = math.log1p(signal.distinct_actors)
    score = signal.short_horizon_weight * math.sqrt(min(acceleration, MAXIMUM_ACCELERATION)) * spam_penalty
    return score * breadth_bonus, acceleration


def rank_trending_signals(
    signals: list[TrendingSignal], minimum_distinct_actors: int, excluded_ids: frozenset[str], limit: int
) -> list[TrendingItem]:
    scored_items: list[TrendingItem] = []
    for signal in signals:
        if signal.item_id in excluded_ids:
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
        degraded = self.feature_store is None
        if self.feature_store is not None:
            try:
                items = await self.read_and_rank_trending_items(self.feature_store, request, scope)
            except FeatureBackendUnavailableError:
                degraded = True
        return TrendingResponse(
            kind=request.kind,
            scope=scope,
            items=items,
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(None),
                ranking_source="trending:decayed_velocity",
                degraded=degraded,
                generated_at=now,
            ),
        )

    async def read_and_rank_trending_items(
        self, feature_store: OnlineFeatureStore, request: TrendingRequest, scope: str
    ) -> list[TrendingItem]:
        now = resolve_request_time(request.now)
        keyspace = feature_store.keyspace
        short_rows = await feature_store.read_decayed_highest_members(
            keyspace.trending_base_key(request.kind, scope, "short"),
            request.limit * CANDIDATE_OVERFETCH_MULTIPLIER + len(request.excluded_ids),
            TRENDING_SHORT_HALF_LIFE_SECONDS,
            now.timestamp(),
        )
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
        signals: list[TrendingSignal] = []
        for index, (item_id, short_weight) in enumerate(short_rows):
            statistics = item_statistics[index]
            exposure = max(statistics.get("views", 0.0) + statistics.get("watches", 0.0), 1.0)
            negative = statistics.get("reports", 0.0) * 3.0 + statistics.get("hides", 0.0)
            signals.append(
                TrendingSignal(
                    item_id=item_id,
                    short_horizon_weight=short_weight,
                    long_horizon_weight=long_weights.get(item_id, 0.0),
                    distinct_actors=max(actor_counts[index * 2], actor_counts[index * 2 + 1]),
                    negative_feedback_rate=min(negative / exposure, 1.0),
                )
            )
        return rank_trending_signals(
            signals, request.minimum_distinct_actors, frozenset(request.excluded_ids), request.limit
        )
