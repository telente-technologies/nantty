from src.configs.ranking_heuristics_config import CLIP_HEURISTIC_HEADS
from src.dtos.common_dto import ExcludedItem, RankingResponseMetadata
from src.enums.ranking_surface_enum import RankingSurface
from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.modules.clips.dtos.clip_ranking_dto import (
    ClipCandidate,
    ClipRankingRequest,
    ClipRankingResponse,
    RankedClipItem,
)
from src.modules.clips.services.clip_feature_vector_service import (
    CLIP_FEATURE_NAMES,
    CLIP_FEATURE_SCHEMA_VERSION,
    build_clip_feature_values,
    is_exploration_eligible_clip,
    read_clip_watch_counts,
)
from src.modules.clips.services.exploration_sampling_service import (
    ExplorationArm,
    build_deterministic_random_generator,
    calculate_exploration_slot_positions,
    choose_thompson_winner,
    sample_thompson_scores_for_arms,
)
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder
from src.repositories.feature_log_parquet_repository import FeatureLogParquetSink
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.candidate_filtering_service import filter_candidates_for_viewer
from src.services.diversity_reranking_service import DiversityCandidate, DiversityRules, rerank_candidates_for_diversity
from src.services.head_probability_predictor_service import predict_heads_with_model_or_heuristic
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


def build_clip_exploration_arms(
    candidates: list[ClipCandidate], online_features: ViewerOnlineFeatures
) -> list[ExplorationArm]:
    arms: list[ExplorationArm] = []
    for candidate in candidates:
        if not is_exploration_eligible_clip(candidate, online_features):
            continue
        watches, completions, _rewatches = read_clip_watch_counts(candidate, online_features)
        arms.append(ExplorationArm(candidate.item_id, candidate.creator_id, completions, watches))
    return arms


def merge_exploitation_and_exploration_orders(
    exploitation_order: list[DiversityCandidate],
    exploration_arms: list[ExplorationArm],
    sampled_scores: dict[str, float],
    exploration_positions: set[int],
    creator_by_item: dict[str, str],
    output_limit: int,
) -> list[tuple[str, bool]]:
    merged: list[tuple[str, bool]] = []
    placed_item_ids: set[str] = set()
    remaining_arms = list(exploration_arms)
    exploitation_queue = list(exploitation_order)
    while len(merged) < output_limit and (exploitation_queue or remaining_arms):
        previous_creator = creator_by_item[merged[-1][0]] if merged else None
        if len(merged) in exploration_positions and remaining_arms:
            winner = choose_thompson_winner(remaining_arms, sampled_scores, previous_creator)
            if winner is not None:
                remaining_arms.remove(winner)
                if winner.item_id not in placed_item_ids:
                    merged.append((winner.item_id, True))
                    placed_item_ids.add(winner.item_id)
                continue
        next_index = next(
            (
                index
                for index, candidate in enumerate(exploitation_queue)
                if candidate.item_id not in placed_item_ids and candidate.author_key != previous_creator
            ),
            None,
        )
        if next_index is None:
            next_index = next(
                (index for index, item in enumerate(exploitation_queue) if item.item_id not in placed_item_ids), None
            )
        if next_index is None:
            break
        chosen = exploitation_queue.pop(next_index)
        merged.append((chosen.item_id, False))
        placed_item_ids.add(chosen.item_id)
        remaining_arms = [arm for arm in remaining_arms if arm.item_id != chosen.item_id]
    return merged


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
        viewer = request.viewer
        topic_ids = {topic for candidate in request.candidates for topic in [*candidate.topics, *candidate.hashtags]}
        online_features, degraded = await read_viewer_online_features_safely(
            self.feature_store,
            viewer.user_id,
            sorted({candidate.creator_id for candidate in request.candidates}),
            sorted(topic_ids),
            [candidate.item_id for candidate in request.candidates],
            now,
        )
        filter_outcome = filter_candidates_for_viewer(
            request.candidates,
            viewer,
            online_features.recently_seen_item_ids,
            lambda candidate: candidate.item_id,
            lambda candidate: [candidate.creator_id],
        )
        candidates = filter_outcome.kept_candidates
        excluded = list(filter_outcome.excluded_items) + [
            ExcludedItem(item_id=candidate.item_id, reason="already_seen")
            for candidate in filter_outcome.previously_seen_candidates
        ]
        followed_account_ids = frozenset(viewer.followed_account_ids)
        chosen_topics = frozenset(viewer.chosen_topics)
        feature_rows = [
            build_clip_feature_values(candidate, viewer, followed_account_ids, chosen_topics, online_features, now)
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
        diversity_candidates: list[DiversityCandidate] = []
        for index, (candidate, feature_row) in enumerate(zip(candidates, feature_rows, strict=True)):
            completion = float(prediction.probabilities_by_head["completion"][index])
            rewatch = float(prediction.probabilities_by_head["rewatch"][index])
            freshness = calculate_freshness_decay_multiplier(
                feature_row[0], CLIP_FRESHNESS_HALF_LIFE_HOURS, CLIP_FRESHNESS_MINIMUM_MULTIPLIER
            )
            affinity = max(feature_row[CLIP_FEATURE_NAMES.index("creator_affinity")], 0.0)
            score = (
                completion
                * (1.0 + CLIP_REWATCH_BONUS_WEIGHT * rewatch)
                * freshness
                * (1.0 + CLIP_CREATOR_AFFINITY_BOOST * affinity)
            )
            diversity_candidates.append(
                DiversityCandidate(
                    candidate.item_id,
                    score,
                    candidate.creator_id,
                    None,
                    False,
                    frozenset([*candidate.topics, *candidate.hashtags]),
                )
            )
        exploitation_order = rerank_candidates_for_diversity(
            diversity_candidates, CLIP_DIVERSITY_RULES, len(diversity_candidates)
        )
        exploration_arms = build_clip_exploration_arms(candidates, online_features)
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
        items = [
            RankedClipItem(
                item_id=item_id,
                position=position,
                score=round(score_by_item[item_id], 8),
                is_exploration=is_exploration,
                reasons=["exploration_new_creator"] if is_exploration else ["predicted_watch_completion"],
            )
            for position, (item_id, is_exploration) in enumerate(merged_order)
        ]
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
        return ClipRankingResponse(
            items=items,
            excluded=excluded,
            metadata=RankingResponseMetadata(
                request_id=request_id,
                ranking_source=f"clips:{prediction.ranking_source}",
                model_version=prediction.model_version,
                degraded=degraded or prediction.model_version is None,
                generated_at=now,
            ),
        )
