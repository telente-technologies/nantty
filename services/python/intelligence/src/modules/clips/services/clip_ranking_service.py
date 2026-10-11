from datetime import datetime

from src.configs.ranking_heuristics_config import CLIP_HEURISTIC_HEADS
from src.dtos.common_dto import ExcludedItem, RankingResponseMetadata, ViewerContext
from src.enums.ranking_surface_enum import RankingSurface
from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.modules.clips.dtos.clip_ranking_dto import (
    ClipCandidate,
    ClipRankingRequest,
    ClipRankingResponse,
    RankedClipItem,
)
from src.modules.clips.services.clip_exploration_order_service import (
    build_clip_exploration_arms,
    merge_exploitation_and_exploration_orders,
)
from src.modules.clips.services.clip_fairness_service import (
    CLIP_ENGAGEMENT_WEIGHT,
    assess_clip_integrity,
    build_clip_explanations,
    calculate_clip_author_boost,
    calculate_clip_engagement_signal,
    calculate_integrity_multiplier,
    discount_clip_engagement,
    filter_clips_for_viewer_safety,
)
from src.modules.clips.services.clip_feature_vector_service import (
    CLIP_FEATURE_NAMES,
    CLIP_FEATURE_SCHEMA_VERSION,
    build_clip_feature_values,
    read_clip_watch_counts,
)
from src.modules.clips.services.exploration_sampling_service import (
    build_deterministic_random_generator,
    calculate_exploration_slot_positions,
    sample_thompson_scores_for_arms,
)
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder
from src.repositories.feature_log_parquet_repository import FeatureLogParquetSink
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.candidate_filtering_service import filter_candidates_for_viewer
from src.services.diversity_reranking_service import DiversityCandidate, DiversityRules, rerank_candidates_for_diversity
from src.services.engagement_integrity_service import IntegrityAssessment
from src.services.head_probability_predictor_service import predict_heads_with_model_or_heuristic
from src.services.ranking_boost_policy_service import clamp_boost_policy_to_hard_caps
from src.services.ranking_context_service import (
    log_served_feature_rows,
    read_viewer_online_features_safely,
    resolve_request_identifier,
    resolve_request_time,
)
from src.utils.decay_math_util import calculate_freshness_decay_multiplier

CLIP_FRESHNESS_HALF_LIFE_HOURS = 72.0
CLIP_FRESHNESS_MINIMUM_MULTIPLIER = 0.15
CLIP_REWATCH_BONUS_WEIGHT = 0.5
CLIP_CREATOR_AFFINITY_BOOST = 0.3
CLIP_DIVERSITY_RULES = DiversityRules(
    max_consecutive_same_author=1,
    max_consecutive_product_posts=100,
    maximum_product_post_share=1.0,
    topic_repeat_penalty=0.9,
    topic_window_size=2,
)


def strip_personal_viewer_context(viewer: ViewerContext) -> ViewerContext:
    return viewer.model_copy(update={"followed_account_ids": [], "chosen_topics": [], "seen_item_ids": []})


def score_clip(
    candidate: ClipCandidate,
    feature_row: list[float],
    completion: float,
    rewatch: float,
    online_features: ViewerOnlineFeatures,
    assessment: IntegrityAssessment,
    boost: float,
) -> float:
    freshness = calculate_freshness_decay_multiplier(
        feature_row[0], CLIP_FRESHNESS_HALF_LIFE_HOURS, CLIP_FRESHNESS_MINIMUM_MULTIPLIER
    )
    affinity = max(feature_row[CLIP_FEATURE_NAMES.index("creator_affinity")], 0.0)
    watches, _completions, _rewatches = read_clip_watch_counts(candidate, online_features)
    engagement = calculate_clip_engagement_signal(candidate, watches)
    return (
        completion
        * (1.0 + CLIP_REWATCH_BONUS_WEIGHT * rewatch)
        * freshness
        * (1.0 + CLIP_CREATOR_AFFINITY_BOOST * affinity)
        * (1.0 + CLIP_ENGAGEMENT_WEIGHT * engagement)
        * calculate_integrity_multiplier(assessment)
        * boost
    )


class ClipRankingService:
    def __init__(
        self,
        feature_store: OnlineFeatureStore | None,
        model_holder: ActiveModelHolder,
        feature_log_sink: FeatureLogParquetSink | None,
    ) -> None:
        self.feature_store = feature_store
        self.model_holder = model_holder
        self.feature_log_sink = feature_log_sink

    async def rank_clips(self, request: ClipRankingRequest) -> ClipRankingResponse:
        now = resolve_request_time(request.now)
        request_id = resolve_request_identifier(request.request_id)
        viewer = request.viewer if request.personalized else strip_personal_viewer_context(request.viewer)
        online_features, degraded = await self.read_online_features(request, viewer, now)
        filter_outcome = filter_candidates_for_viewer(
            request.candidates,
            viewer,
            online_features.recently_seen_item_ids,
            lambda candidate: candidate.item_id,
            lambda candidate: [candidate.creator_id],
        )
        safety_outcome = filter_clips_for_viewer_safety(filter_outcome.kept_candidates, viewer)
        excluded = [
            *filter_outcome.excluded_items,
            *safety_outcome.excluded_items,
            *(
                ExcludedItem(item_id=candidate.item_id, reason="already_seen")
                for candidate in filter_outcome.previously_seen_candidates
            ),
        ]
        assessments = assess_clip_integrity(
            safety_outcome.kept_candidates, online_features.item_statistics_by_item, not degraded
        )
        candidates = [
            discount_clip_engagement(candidate, assessments[candidate.item_id])
            for candidate in safety_outcome.kept_candidates
        ]
        feature_rows = [
            build_clip_feature_values(
                candidate,
                viewer,
                frozenset(viewer.followed_account_ids),
                frozenset(viewer.chosen_topics),
                online_features,
                now,
            )
            for candidate in candidates
        ]
        loaded_model = self.model_holder.get_loaded_model("clip_watch")
        prediction = predict_heads_with_model_or_heuristic(
            feature_rows,
            CLIP_FEATURE_NAMES,
            loaded_model.bundle if loaded_model else None,
            loaded_model.version if loaded_model else None,
            CLIP_HEURISTIC_HEADS,
        )
        clamped_policy = clamp_boost_policy_to_hard_caps(request.boost_policy)
        boosts = {candidate.item_id: calculate_clip_author_boost(candidate, clamped_policy) for candidate in candidates}
        diversity_candidates = [
            DiversityCandidate(
                candidate.item_id,
                score_clip(
                    candidate,
                    feature_row,
                    float(prediction.probabilities_by_head["completion"][index]),
                    float(prediction.probabilities_by_head["rewatch"][index]),
                    online_features,
                    assessments[candidate.item_id],
                    boosts[candidate.item_id],
                ),
                candidate.creator_id,
                None,
                False,
                frozenset([*candidate.topics, *candidate.hashtags]),
            )
            for index, (candidate, feature_row) in enumerate(zip(candidates, feature_rows, strict=True))
        ]
        exploitation_order = rerank_candidates_for_diversity(
            diversity_candidates, CLIP_DIVERSITY_RULES, len(diversity_candidates)
        )
        exploration_arms = build_clip_exploration_arms(
            [candidate for candidate in candidates if not assessments[candidate.item_id].manipulated],
            online_features,
        )
        random_generator = build_deterministic_random_generator(viewer.user_id, request_id)
        merged_order = merge_exploitation_and_exploration_orders(
            exploitation_order,
            exploration_arms,
            sample_thompson_scores_for_arms(exploration_arms, random_generator),
            calculate_exploration_slot_positions(request.limit, request.exploration_share),
            {candidate.item_id: candidate.creator_id for candidate in candidates},
            request.limit,
        )
        score_by_item = {candidate.item_id: candidate.score for candidate in diversity_candidates}
        candidate_by_item = {candidate.item_id: candidate for candidate in candidates}
        features_by_item = {
            candidate.item_id: dict(zip(CLIP_FEATURE_NAMES, row, strict=True))
            for candidate, row in zip(candidates, feature_rows, strict=True)
        }
        trending_topics = frozenset(request.trending_topics)
        items = [
            RankedClipItem(
                item_id=item_id,
                position=position,
                score=round(score_by_item[item_id], 8),
                is_exploration=is_exploration,
                reasons=["exploration_new_creator"] if is_exploration else ["predicted_watch_completion"],
                explanations=build_clip_explanations(
                    candidate_by_item[item_id],
                    features_by_item[item_id],
                    trending_topics,
                    boosts[item_id],
                    is_exploration,
                ),
                boost_multiplier=boosts[item_id],
                trusted_engagement_share=assessments[item_id].trusted_engagement_share,
            )
            for position, (item_id, is_exploration) in enumerate(merged_order)
        ]
        if request.personalized:
            log_served_feature_rows(
                self.feature_log_sink,
                request_id,
                RankingSurface.CLIPS,
                viewer.user_id,
                [item.item_id for item in items],
                {candidate.item_id: row for candidate, row in zip(candidates, feature_rows, strict=True)},
                prediction.model_version,
                CLIP_FEATURE_SCHEMA_VERSION,
                now,
            )
        personalization_suffix = "" if request.personalized else ":non_personalized"
        return ClipRankingResponse(
            items=items,
            excluded=excluded,
            manipulated_item_ids=sorted(item_id for item_id, value in assessments.items() if value.manipulated),
            boost_policy_version=clamped_policy.version,
            metadata=RankingResponseMetadata(
                request_id=request_id,
                ranking_source=f"clips:{prediction.ranking_source}{personalization_suffix}",
                model_version=prediction.model_version,
                degraded=degraded or prediction.model_version is None,
                generated_at=now,
            ),
        )

    async def read_online_features(
        self, request: ClipRankingRequest, viewer: ViewerContext, now: datetime
    ) -> tuple[ViewerOnlineFeatures, bool]:
        item_ids = [candidate.item_id for candidate in request.candidates]
        if not request.personalized:
            features, degraded = await read_viewer_online_features_safely(
                self.feature_store, viewer.user_id, [], [], item_ids, now, include_recently_seen_items=False
            )
            return ViewerOnlineFeatures(item_statistics_by_item=features.item_statistics_by_item), degraded
        topic_ids = {topic for candidate in request.candidates for topic in [*candidate.topics, *candidate.hashtags]}
        return await read_viewer_online_features_safely(
            self.feature_store,
            viewer.user_id,
            sorted({candidate.creator_id for candidate in request.candidates}),
            sorted(topic_ids),
            item_ids,
            now,
        )
