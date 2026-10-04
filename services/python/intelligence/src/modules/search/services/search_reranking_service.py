import math

from src.dtos.common_dto import RankingResponseMetadata
from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.modules.search.dtos.search_rerank_dto import (
    RerankedSearchItem,
    SearchRerankRequest,
    SearchRerankResponse,
    SearchResultCandidate,
)
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.ranking_context_service import (
    read_viewer_online_features_safely,
    resolve_request_identifier,
    resolve_request_time,
)
from src.utils.affinity_feature_util import read_normalized_affinity, summarize_topic_affinities
from src.utils.decay_math_util import calculate_age_in_hours, calculate_freshness_decay_multiplier

SEARCH_FRESHNESS_HALF_LIFE_HOURS = 24.0 * 14
SEARCH_FRESHNESS_TIEBREAK_WEIGHT = 0.02


def calculate_personalization_signal(
    candidate: SearchResultCandidate,
    online_features: ViewerOnlineFeatures,
    chosen_topics: frozenset[str],
    followed_account_ids: frozenset[str],
    viewer_country: str | None,
) -> float:
    creator_affinity = max(
        read_normalized_affinity(online_features.account_affinity_by_account, candidate.author_id), 0
    )
    topic_affinity_max, _mean = summarize_topic_affinities(online_features.topic_affinity_by_topic, candidate.topics)
    chosen_topic_match = 1.0 if any(topic in chosen_topics for topic in candidate.topics) else 0.0
    follows = 1.0 if candidate.author_id is not None and candidate.author_id in followed_account_ids else 0.0
    same_country = 1.0 if viewer_country is not None and candidate.country == viewer_country else 0.0
    combined = (
        0.35 * creator_affinity
        + 0.25 * max(topic_affinity_max, 0.0)
        + 0.15 * chosen_topic_match
        + 0.15 * follows
        + 0.10 * same_country
    )
    return min(max(combined, 0.0), 1.0)


def rerank_search_results(
    request: SearchRerankRequest, online_features: ViewerOnlineFeatures
) -> list[RerankedSearchItem]:
    if not request.candidates:
        return []
    now = resolve_request_time(request.now)
    maximum_relevance = max(candidate.text_relevance_score for candidate in request.candidates) or 1.0
    maximum_log_popularity = max(math.log1p(candidate.popularity_count) for candidate in request.candidates) or 1.0
    chosen_topics = frozenset(request.viewer.chosen_topics)
    followed = frozenset(request.viewer.followed_account_ids)
    excluded_accounts = frozenset(request.viewer.blocked_account_ids) | frozenset(request.viewer.muted_account_ids)
    scored: dict[str, float] = {}
    for candidate in request.candidates:
        if candidate.item_id in scored or (
            candidate.author_id is not None and candidate.author_id in excluded_accounts
        ):
            continue
        freshness = 0.0
        if candidate.created_at is not None:
            freshness = calculate_freshness_decay_multiplier(
                calculate_age_in_hours(candidate.created_at, now), SEARCH_FRESHNESS_HALF_LIFE_HOURS
            )
        scored[candidate.item_id] = (
            request.text_relevance_weight * candidate.text_relevance_score / maximum_relevance
            + request.personalization_weight
            * calculate_personalization_signal(
                candidate, online_features, chosen_topics, followed, request.viewer.country
            )
            + request.popularity_weight * math.log1p(candidate.popularity_count) / maximum_log_popularity
            + SEARCH_FRESHNESS_TIEBREAK_WEIGHT * freshness
        )
    ordered = sorted(scored.items(), key=lambda pair: (-pair[1], pair[0]))[: request.limit]
    return [
        RerankedSearchItem(item_id=item_id, position=position, score=round(score, 8))
        for position, (item_id, score) in enumerate(ordered)
    ]


class SearchRerankingService:
    def __init__(self, feature_store: OnlineFeatureStore | None) -> None:
        self.feature_store = feature_store

    async def rerank(self, request: SearchRerankRequest) -> SearchRerankResponse:
        now = resolve_request_time(request.now)
        account_ids = sorted({candidate.author_id for candidate in request.candidates if candidate.author_id})
        topic_ids = sorted({topic for candidate in request.candidates for topic in candidate.topics})
        online_features, degraded = await read_viewer_online_features_safely(
            self.feature_store, request.viewer.user_id, account_ids, topic_ids, [], now, False
        )
        return SearchRerankResponse(
            items=rerank_search_results(request, online_features),
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(request.request_id),
                ranking_source="search:blended_relevance",
                degraded=degraded,
                generated_at=now,
            ),
        )
