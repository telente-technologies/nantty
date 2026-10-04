from datetime import datetime

from src.dtos.common_dto import ExcludedItem, RankingResponseMetadata
from src.enums.ranking_surface_enum import RankingSurface
from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.modules.feed.dtos.feed_ranking_dto import (
    FeedCandidate,
    FeedRankingRequest,
    FeedRankingResponse,
    RankedFeedItem,
    SocialProofBanner,
)
from src.modules.feed.services.feed_fairness_service import (
    apply_quality_and_capped_boosts,
    assess_candidate_integrity,
    build_ranking_explanations,
    discount_candidate_engagement,
    filter_candidates_for_viewer_safety,
)
from src.modules.feed.services.feed_feature_vector_service import (
    FEED_FEATURE_SCHEMA_VERSION,
    build_feed_feature_values,
    convert_feature_values_to_mapping,
)
from src.modules.feed.services.feed_scoring_service import score_feed_candidates_in_two_stages
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder
from src.modules.risk.dtos.risk_scoring_dto import RiskReason
from src.modules.social_proof.services.social_proof_service import (
    SocialProofCandidate,
    build_social_proof_banners_for_viewer,
    convert_selection_to_banner,
)
from src.modules.trust_advisory.services.suspension_suggestion_service import SuspensionSuggestionService
from src.repositories.feature_log_parquet_repository import FeatureLogParquetSink
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.candidate_filtering_service import filter_candidates_for_viewer
from src.services.diversity_reranking_service import DiversityCandidate, DiversityRules, rerank_candidates_for_diversity
from src.services.engagement_integrity_service import IntegrityAssessment
from src.services.ranking_boost_policy_service import clamp_boost_policy_to_hard_caps
from src.services.ranking_context_service import (
    log_served_feature_rows,
    read_viewer_online_features_safely,
    resolve_request_identifier,
    resolve_request_time,
)


def explain_feed_score_reasons(features: dict[str, float]) -> list[str]:
    reason_checks = [
        ("following", features["viewer_follows_author"] > 0),
        ("creator_affinity", features["creator_affinity"] > 0.3),
        ("topic_affinity", features["topic_affinity_max"] > 0.3),
        ("chosen_topic", features["chosen_topic_match_count"] > 0),
        ("friends_engaged", features["friend_engagement_count"] > 0),
        ("fresh", features["age_hours"] < 6),
        ("popular", features["like_rate"] > 0.1),
        ("local", features["same_country_as_viewer"] > 0),
    ]
    return [reason for reason, applies in reason_checks if applies][:4]


def build_diversity_candidate(candidate: FeedCandidate, score: float) -> DiversityCandidate:
    return DiversityCandidate(
        item_id=candidate.item_id,
        score=score,
        author_key=candidate.author_id,
        store_key=candidate.store_id,
        is_product=candidate.content_kind == "product",
        topics=frozenset([*candidate.topics, *candidate.hashtags]),
    )


class FeedRankingService:
    def __init__(
        self,
        feature_store: OnlineFeatureStore | None,
        model_holder: ActiveModelHolder,
        feature_log_sink: FeatureLogParquetSink | None,
        suggestion_service: SuspensionSuggestionService | None = None,
    ) -> None:
        self.feature_store = feature_store
        self.model_holder = model_holder
        self.feature_log_sink = feature_log_sink
        self.suggestion_service = suggestion_service

    async def rank_feed(self, request: FeedRankingRequest) -> FeedRankingResponse:
        now = resolve_request_time(request.now)
        request_id = resolve_request_identifier(request.request_id)
        viewer = request.viewer
        account_ids = {candidate.author_id for candidate in request.candidates}
        account_ids |= {candidate.store_id for candidate in request.candidates if candidate.store_id}
        account_ids |= {
            engagement.friend_id for candidate in request.candidates for engagement in candidate.friend_engagements
        }
        topic_ids = {topic for candidate in request.candidates for topic in [*candidate.topics, *candidate.hashtags]}
        online_features, degraded = await read_viewer_online_features_safely(
            self.feature_store,
            viewer.user_id,
            sorted(account_ids),
            sorted(topic_ids),
            [candidate.item_id for candidate in request.candidates],
            now,
        )
        filter_outcome = filter_candidates_for_viewer(
            request.candidates,
            viewer,
            online_features.recently_seen_item_ids,
            lambda candidate: candidate.item_id,
            lambda candidate: [candidate.author_id, candidate.store_id],
        )
        safety_outcome = filter_candidates_for_viewer_safety(filter_outcome.kept_candidates, viewer)
        excluded = list(filter_outcome.excluded_items) + safety_outcome.excluded_items
        assessments = assess_candidate_integrity(
            [*safety_outcome.kept_candidates, *filter_outcome.previously_seen_candidates],
            online_features.item_statistics_by_item,
        )
        candidates = [
            discount_candidate_engagement(candidate, assessments[candidate.item_id])
            for candidate in safety_outcome.kept_candidates
        ]
        previously_seen = filter_candidates_for_viewer_safety(filter_outcome.previously_seen_candidates, viewer)
        previously_seen_candidates = [
            discount_candidate_engagement(candidate, assessments[candidate.item_id])
            for candidate in previously_seen.kept_candidates
        ]
        if request.feed_mode == "following":
            candidates = candidates + previously_seen_candidates
        else:
            excluded += [
                ExcludedItem(item_id=candidate.item_id, reason="already_seen")
                for candidate in previously_seen_candidates
            ]
        followed_account_ids = frozenset(viewer.followed_account_ids)
        chosen_topics = frozenset(viewer.chosen_topics)
        feature_rows = [
            build_feed_feature_values(candidate, viewer, followed_account_ids, chosen_topics, online_features, now)
            for candidate in candidates
        ]
        feature_mappings = [convert_feature_values_to_mapping(row) for row in feature_rows]
        scoring = score_feed_candidates_in_two_stages(
            candidates,
            feature_rows,
            feature_mappings,
            request.feed_mode,
            self.model_holder.get_loaded_model("feed_engagement"),
        )
        clamped_policy = clamp_boost_policy_to_hard_caps(request.boost_policy)
        boosts: dict[str, float] = {}
        final_scores = scoring.final_score_by_item
        if request.feed_mode == "for_you":
            final_scores, boosts = apply_quality_and_capped_boosts(final_scores, candidates, clamped_policy)
        scored_candidates = [candidate for candidate in candidates if candidate.item_id in final_scores]
        ordered = self.order_candidates_with_diversity(request, scored_candidates, final_scores)
        if request.feed_mode == "following":
            seen_ids = {candidate.item_id for candidate in previously_seen_candidates}
            ordered = [item for item in ordered if item.item_id not in seen_ids] + [
                item for item in ordered if item.item_id in seen_ids
            ]
        banners = self.select_social_proof_banners(request, ordered, candidates, online_features)
        features_by_item = {
            candidate.item_id: mapping for candidate, mapping in zip(candidates, feature_mappings, strict=True)
        }
        candidate_by_item = {candidate.item_id: candidate for candidate in candidates}
        trending_topics = frozenset(request.trending_topics)
        response_items = [
            RankedFeedItem(
                item_id=item.item_id,
                position=position,
                score=round(item.score, 8),
                reasons=explain_feed_score_reasons(features_by_item[item.item_id]),
                explanations=build_ranking_explanations(
                    candidate_by_item[item.item_id],
                    features_by_item[item.item_id],
                    trending_topics,
                    boosts.get(item.item_id, 1.0),
                ),
                boost_multiplier=boosts.get(item.item_id, 1.0),
                trusted_engagement_share=assessments[item.item_id].trusted_engagement_share,
                social_proof=banners.get(item.item_id),
            )
            for position, item in enumerate(ordered)
        ]
        log_served_feature_rows(
            self.feature_log_sink,
            request_id,
            RankingSurface.FEED,
            viewer.user_id,
            [item.item_id for item in ordered],
            {candidate.item_id: row for candidate, row in zip(candidates, feature_rows, strict=True)},
            scoring.model_version,
            FEED_FEATURE_SCHEMA_VERSION,
            now,
        )
        manipulated_item_ids = sorted(item_id for item_id, assessment in assessments.items() if assessment.manipulated)
        await self.flag_manipulated_authors(request, assessments, now)
        return FeedRankingResponse(
            items=response_items,
            excluded=excluded,
            manipulated_item_ids=manipulated_item_ids,
            boost_policy_version=clamped_policy.version,
            metadata=RankingResponseMetadata(
                request_id=request_id,
                ranking_source=f"{request.feed_mode}:{scoring.ranking_source}",
                model_version=scoring.model_version,
                degraded=degraded,
                generated_at=now,
            ),
        )

    async def flag_manipulated_authors(
        self, request: FeedRankingRequest, assessments: dict[str, IntegrityAssessment], now: datetime
    ) -> None:
        if self.suggestion_service is None:
            return
        for candidate in request.candidates:
            assessment = assessments.get(candidate.item_id)
            if assessment is None or not assessment.manipulated:
                continue
            await self.suggestion_service.suggest_if_warranted(
                candidate.author_id,
                "engagement_integrity",
                max(assessment.suspicion_score, 0.8),
                [RiskReason(code=reason, weight=1.0) for reason in assessment.reasons]
                or [RiskReason(code="manipulated_engagement", weight=1.0)],
                now,
            )

    def order_candidates_with_diversity(
        self, request: FeedRankingRequest, candidates: list[FeedCandidate], final_scores: dict[str, float]
    ) -> list[DiversityCandidate]:
        diversity_candidates = [
            build_diversity_candidate(candidate, final_scores[candidate.item_id]) for candidate in candidates
        ]
        options = request.options
        if request.feed_mode == "following":
            rules = DiversityRules(
                max_consecutive_same_author=max(options.max_consecutive_same_author, 2),
                max_consecutive_product_posts=request.limit,
                maximum_product_post_share=1.0,
                topic_repeat_penalty=1.0,
                topic_window_size=0,
            )
        else:
            rules = DiversityRules(
                max_consecutive_same_author=options.max_consecutive_same_author,
                max_consecutive_product_posts=options.max_consecutive_product_posts,
                maximum_product_post_share=options.maximum_product_post_share,
                topic_repeat_penalty=options.topic_repeat_penalty,
                topic_window_size=options.topic_window_size,
            )
        return rerank_candidates_for_diversity(diversity_candidates, rules, request.limit)

    def select_social_proof_banners(
        self,
        request: FeedRankingRequest,
        ordered: list[DiversityCandidate],
        candidates: list[FeedCandidate],
        online_features: ViewerOnlineFeatures,
    ) -> dict[str, SocialProofBanner]:
        if not request.options.include_social_proof:
            return {}
        candidate_by_id = {candidate.item_id: candidate for candidate in candidates}
        selections = build_social_proof_banners_for_viewer(
            [
                SocialProofCandidate(
                    item_id=item.item_id,
                    position=position,
                    author_id=candidate_by_id[item.item_id].author_id,
                    store_id=candidate_by_id[item.item_id].store_id,
                    friend_engagements=candidate_by_id[item.item_id].friend_engagements,
                )
                for position, item in enumerate(ordered)
            ],
            request.viewer,
            request.options,
            online_features.account_affinity_by_account,
        )
        return {item_id: convert_selection_to_banner(selection) for item_id, selection in selections.items()}
