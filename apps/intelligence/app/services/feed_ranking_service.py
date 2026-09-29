from app.configs.ranking_heuristics_config import (
    FEED_CREATOR_AFFINITY_BOOST,
    FEED_ENGAGEMENT_BLEND_WEIGHTS,
    FEED_FRESHNESS_HALF_LIFE_HOURS,
    FEED_FRESHNESS_MINIMUM_MULTIPLIER,
    FEED_HEURISTIC_HEADS,
    FOLLOWING_FEED_MAXIMUM_BOOST_MINUTES,
)
from app.features.feed_feature_vector_builder import (
    AFFINITY_HALF_SATURATION_POINT,
    FEED_FEATURE_NAMES,
    FEED_FEATURE_SCHEMA_VERSION,
    build_feed_feature_values,
    convert_feature_values_to_mapping,
)
from app.models.common_model import ExcludedItem, RankingResponseMetadata
from app.models.feed_ranking_model import (
    FeedCandidate,
    FeedRankingRequest,
    FeedRankingResponse,
    RankedFeedItem,
    SocialProofBanner,
)
from app.registry.active_model_holder import ActiveModelHolder
from app.services.candidate_filtering_service import filter_candidates_for_viewer
from app.services.feed_diversity_service import DiversityCandidate, DiversityRules, rerank_candidates_for_diversity
from app.services.head_probability_predictor_service import (
    blend_head_probabilities,
    predict_heads_with_model_or_heuristic,
)
from app.services.ranking_context_service import (
    log_served_feature_rows,
    read_viewer_online_features_safely,
    resolve_request_identifier,
    resolve_request_time,
)
from app.services.social_proof_service import (
    SocialProofCandidate,
    SocialProofRules,
    select_posts_eligible_for_friend_social_proof,
)
from app.stores.feature_log_sink import FeatureLogParquetSink
from app.stores.online_feature_store import OnlineFeatureStore, ViewerOnlineFeatures
from app.utils.decay_math_util import (
    calculate_freshness_decay_multiplier,
    squash_non_negative_value_into_unit_interval,
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


def calculate_following_feed_boosted_timestamp(candidate: FeedCandidate, features: dict[str, float]) -> float:
    engagement_signal = squash_non_negative_value_into_unit_interval(features["like_rate"] * 10, 1.0)
    boost_strength = 0.6 * max(features["creator_affinity"], 0.0) + 0.4 * engagement_signal
    return candidate.created_at.timestamp() + boost_strength * FOLLOWING_FEED_MAXIMUM_BOOST_MINUTES * 60


class FeedRankingService:
    def __init__(
        self,
        feature_store: OnlineFeatureStore | None,
        model_holder: ActiveModelHolder,
        feature_log_sink: FeatureLogParquetSink | None,
    ) -> None:
        self.feature_store = feature_store
        self.model_holder = model_holder
        self.feature_log_sink = feature_log_sink

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
        candidates = filter_outcome.kept_candidates
        excluded = list(filter_outcome.excluded_items)
        if request.feed_mode == "following":
            candidates = candidates + filter_outcome.previously_seen_candidates
        else:
            excluded += [
                ExcludedItem(item_id=candidate.item_id, reason="already_seen")
                for candidate in filter_outcome.previously_seen_candidates
            ]
        followed_account_ids = frozenset(viewer.followed_account_ids)
        chosen_topics = frozenset(viewer.chosen_topics)
        feature_rows = [
            build_feed_feature_values(candidate, viewer, followed_account_ids, chosen_topics, online_features, now)
            for candidate in candidates
        ]
        loaded_model = self.model_holder.get_loaded_model("feed_engagement")
        prediction = predict_heads_with_model_or_heuristic(
            feature_rows,
            FEED_FEATURE_NAMES,
            loaded_model.bundle if loaded_model else None,
            loaded_model.version if loaded_model else None,
            FEED_HEURISTIC_HEADS,
        )
        blended_engagement = (
            blend_head_probabilities(prediction.probabilities_by_head, FEED_ENGAGEMENT_BLEND_WEIGHTS).tolist()
            if candidates
            else []
        )
        feature_mappings = [convert_feature_values_to_mapping(row) for row in feature_rows]
        final_scores: dict[str, float] = {}
        for candidate, features, engagement in zip(candidates, feature_mappings, blended_engagement, strict=True):
            if request.feed_mode == "following":
                final_scores[candidate.item_id] = calculate_following_feed_boosted_timestamp(candidate, features)
                continue
            freshness = calculate_freshness_decay_multiplier(
                features["age_hours"], FEED_FRESHNESS_HALF_LIFE_HOURS, FEED_FRESHNESS_MINIMUM_MULTIPLIER
            )
            affinity_multiplier = 1.0 + FEED_CREATOR_AFFINITY_BOOST * max(features["creator_affinity"], 0.0)
            reported_multiplier = 0.3 if candidate.is_reported else 1.0
            final_scores[candidate.item_id] = float(engagement) * freshness * affinity_multiplier * reported_multiplier
        ordered = self.order_candidates_with_diversity(request, candidates, final_scores)
        if request.feed_mode == "following":
            seen_ids = {candidate.item_id for candidate in filter_outcome.previously_seen_candidates}
            ordered = [item for item in ordered if item.item_id not in seen_ids] + [
                item for item in ordered if item.item_id in seen_ids
            ]
        banners = self.select_social_proof_banners(request, ordered, candidates, online_features)
        features_by_item = {
            candidate.item_id: mapping for candidate, mapping in zip(candidates, feature_mappings, strict=True)
        }
        response_items = [
            RankedFeedItem(
                item_id=item.item_id,
                position=position,
                score=round(item.score, 8),
                reasons=explain_feed_score_reasons(features_by_item[item.item_id]),
                social_proof=banners.get(item.item_id),
            )
            for position, item in enumerate(ordered)
        ]
        log_served_feature_rows(
            self.feature_log_sink,
            request_id,
            "feed",
            viewer.user_id,
            [item.item_id for item in ordered],
            {candidate.item_id: row for candidate, row in zip(candidates, feature_rows, strict=True)},
            prediction.model_version,
            FEED_FEATURE_SCHEMA_VERSION,
            now,
        )
        return FeedRankingResponse(
            items=response_items,
            excluded=excluded,
            metadata=RankingResponseMetadata(
                request_id=request_id,
                ranking_source=f"{request.feed_mode}:{prediction.ranking_source}",
                model_version=prediction.model_version,
                degraded=degraded,
                generated_at=now,
            ),
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
        viewer = request.viewer
        closeness_by_friend = {
            account_id: squash_non_negative_value_into_unit_interval(raw_affinity, AFFINITY_HALF_SATURATION_POINT)
            for account_id, raw_affinity in online_features.account_affinity_by_account.items()
        }
        selections = select_posts_eligible_for_friend_social_proof(
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
            viewer.user_id,
            frozenset(viewer.followed_account_ids),
            frozenset(viewer.blocked_account_ids) | frozenset(viewer.muted_account_ids),
            closeness_by_friend,
            SocialProofRules(
                minimum_close_friends=request.options.social_proof_minimum_close_friends,
                minimum_gap_between_banners=request.options.social_proof_minimum_gap,
                minimum_closeness=request.options.social_proof_minimum_closeness,
            ),
        )
        return {
            item_id: SocialProofBanner(
                friend_ids=selection.friend_ids,
                total_friend_count=selection.total_friend_count,
                primary_action=selection.primary_action,
            )
            for item_id, selection in selections.items()
        }
