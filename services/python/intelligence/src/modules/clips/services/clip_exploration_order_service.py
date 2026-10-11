from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.modules.clips.dtos.clip_ranking_dto import ClipCandidate
from src.modules.clips.services.clip_feature_vector_service import is_exploration_eligible_clip, read_clip_watch_counts
from src.modules.clips.services.exploration_sampling_service import ExplorationArm, choose_thompson_winner
from src.services.diversity_reranking_service import DiversityCandidate


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
