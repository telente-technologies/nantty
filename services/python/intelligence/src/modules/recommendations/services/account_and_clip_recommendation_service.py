import math

from src.dtos.common_dto import RankingResponseMetadata
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError
from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.modules.clips.dtos.clip_ranking_dto import ClipRankingRequest
from src.modules.clips.services.clip_ranking_service import ClipRankingService
from src.modules.recommendations.dtos.recommendation_dto import (
    AccountCandidate,
    AccountRecommendationRequest,
    ClipSuggestionRequest,
    RecommendationResponse,
    RecommendedItem,
)
from src.repositories.online_feature_keyspace_repository import CLIP_TOPIC_POPULARITY_HALF_LIFE_SECONDS
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.ranking_context_service import (
    read_viewer_online_features_safely,
    resolve_request_identifier,
    resolve_request_time,
)
from src.utils.affinity_feature_util import read_normalized_affinity, summarize_topic_affinities
from src.utils.decay_math_util import squash_non_negative_value_into_unit_interval

SUGGESTED_CLIP_TOPIC_COUNT = 5


def score_account_candidate(
    candidate: AccountCandidate,
    online_features: ViewerOnlineFeatures,
    chosen_topics: frozenset[str],
    viewer_country: str | None,
    maximum_log_followers: float,
) -> tuple[float, str]:
    mutual_signal = squash_non_negative_value_into_unit_interval(float(candidate.mutual_follow_count), 3.0)
    topic_affinity_max, _mean = summarize_topic_affinities(online_features.topic_affinity_by_topic, candidate.topics)
    chosen_match = 1.0 if any(topic in chosen_topics for topic in candidate.topics) else 0.0
    topic_signal = max(0.6 * max(topic_affinity_max, 0.0) + 0.4 * chosen_match, 0.0)
    engagement_signal = max(
        read_normalized_affinity(online_features.account_affinity_by_account, candidate.account_id), 0
    )
    popularity_signal = math.log1p(candidate.follower_count) / maximum_log_followers
    components = {
        "mutual_follows": 0.35 * mutual_signal,
        "shared_interests": 0.25 * topic_signal,
        "you_engaged": 0.2 * engagement_signal,
        "popular": 0.1 * popularity_signal,
        "verified": 0.05 * (1.0 if candidate.is_verified else 0.0),
        "nearby": 0.05 * (1.0 if viewer_country is not None and candidate.country == viewer_country else 0.0),
    }
    strongest_reason = max(components.items(), key=lambda pair: pair[1])[0]
    return sum(components.values()), strongest_reason


class AccountAndClipRecommendationService:
    def __init__(self, feature_store: OnlineFeatureStore | None, clip_ranking_service: ClipRankingService) -> None:
        self.feature_store = feature_store
        self.clip_ranking_service = clip_ranking_service

    async def recommend_accounts(self, request: AccountRecommendationRequest) -> RecommendationResponse:
        now = resolve_request_time(request.now)
        viewer = request.viewer
        online_features, degraded = await read_viewer_online_features_safely(
            self.feature_store,
            viewer.user_id,
            sorted({candidate.account_id for candidate in request.candidates}),
            sorted({topic for candidate in request.candidates for topic in candidate.topics}),
            [],
            now,
            False,
        )
        excluded = (
            frozenset(viewer.followed_account_ids)
            | frozenset(viewer.blocked_account_ids)
            | frozenset(viewer.muted_account_ids)
            | {viewer.user_id}
        )
        maximum_log_followers = max([math.log1p(candidate.follower_count) for candidate in request.candidates] + [1.0])
        scored: dict[str, tuple[float, str]] = {}
        for candidate in request.candidates:
            if candidate.account_id in excluded or candidate.account_id in scored:
                continue
            scored[candidate.account_id] = score_account_candidate(
                candidate, online_features, frozenset(viewer.chosen_topics), viewer.country, maximum_log_followers
            )
        ordered = sorted(scored.items(), key=lambda pair: (-pair[1][0], pair[0]))[: request.limit]
        return RecommendationResponse(
            items=[
                RecommendedItem(item_id=account_id, score=round(score, 8), reason=reason)
                for account_id, (score, reason) in ordered
            ],
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(request.request_id),
                ranking_source="accounts:blended_rules",
                degraded=degraded,
                generated_at=now,
            ),
        )

    async def suggest_clips(self, request: ClipSuggestionRequest) -> RecommendationResponse:
        now = resolve_request_time(request.now)
        request_id = resolve_request_identifier(request.request_id)
        if request.candidates:
            ranked = await self.clip_ranking_service.rank_clips(
                ClipRankingRequest(
                    request_id=request_id,
                    viewer=request.viewer,
                    candidates=request.candidates,
                    limit=request.limit,
                    now=now,
                )
            )
            return RecommendationResponse(
                items=[
                    RecommendedItem(
                        item_id=item.item_id,
                        score=item.score,
                        reason="exploration" if item.is_exploration else "predicted_watch",
                    )
                    for item in ranked.items
                ],
                metadata=ranked.metadata,
            )
        items, degraded = await self.read_popular_clips_for_viewer_topics(request)
        bundle_missing = self.clip_ranking_service.model_holder.get_loaded_model("clip_watch") is None
        return RecommendationResponse(
            items=items,
            metadata=RankingResponseMetadata(
                request_id=request_id,
                ranking_source="clips:topic_popularity",
                degraded=degraded or bundle_missing,
                generated_at=now,
            ),
        )

    async def read_popular_clips_for_viewer_topics(
        self, request: ClipSuggestionRequest
    ) -> tuple[list[RecommendedItem], bool]:
        if self.feature_store is None:
            return [], True
        now = resolve_request_time(request.now)
        try:
            top_topics = await self.feature_store.read_viewer_top_topic_affinities(
                request.viewer.user_id, SUGGESTED_CLIP_TOPIC_COUNT, now
            )
            topics = list(dict.fromkeys([*request.viewer.chosen_topics, *(topic for topic, _ in top_topics)]))
            combined: dict[str, tuple[float, str]] = {}
            for topic in topics[: SUGGESTED_CLIP_TOPIC_COUNT * 2]:
                rows = await self.feature_store.read_decayed_highest_members(
                    self.feature_store.keyspace.clip_topic_popularity_base_key(topic),
                    request.limit * 2,
                    CLIP_TOPIC_POPULARITY_HALF_LIFE_SECONDS,
                    now.timestamp(),
                )
                for clip_id, score in rows:
                    if score > combined.get(clip_id, (0.0, ""))[0]:
                        combined[clip_id] = (score, f"topic:{topic}")
        except FeatureBackendUnavailableError:
            return [], True
        excluded = frozenset(request.viewer.seen_item_ids) | frozenset(request.viewer.hidden_item_ids)
        ordered = sorted(
            ((clip_id, details) for clip_id, details in combined.items() if clip_id not in excluded),
            key=lambda pair: (-pair[1][0], pair[0]),
        )[: request.limit]
        return [
            RecommendedItem(item_id=clip_id, score=round(score, 8), reason=reason)
            for clip_id, (score, reason) in ordered
        ], False
