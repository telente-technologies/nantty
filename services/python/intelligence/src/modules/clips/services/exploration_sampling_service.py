import hashlib
import math
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

MAXIMUM_EXPLORATION_SHARE = 0.5


@dataclass(frozen=True, slots=True)
class ExplorationArm:
    item_id: str
    group_key: str
    success_count: float
    trial_count: float


def build_deterministic_random_generator(*seed_parts: str) -> np.random.Generator:
    digest = hashlib.sha256("|".join(seed_parts).encode("utf-8")).digest()
    return np.random.Generator(np.random.PCG64(int.from_bytes(digest[:16], "big")))


def calculate_exploration_slot_positions(output_limit: int, exploration_share: float) -> set[int]:
    if exploration_share <= 0 or output_limit <= 0:
        return set()
    share = min(exploration_share, MAXIMUM_EXPLORATION_SHARE)
    positions = {
        position
        for position in range(output_limit)
        if math.floor((position + 1) * share + 1e-9) > math.floor(position * share + 1e-9)
    }
    if not positions and output_limit * share >= 0.5:
        positions.add(output_limit - 1)
    return positions


def sample_thompson_scores_for_arms(
    arms: Sequence[ExplorationArm], random_generator: np.random.Generator
) -> dict[str, float]:
    sampled_scores: dict[str, float] = {}
    for arm in sorted(arms, key=lambda candidate_arm: candidate_arm.item_id):
        success_count = max(min(arm.success_count, arm.trial_count), 0.0)
        failure_count = max(arm.trial_count - success_count, 0.0)
        sampled_scores[arm.item_id] = float(random_generator.beta(1.0 + success_count, 1.0 + failure_count))
    return sampled_scores


def choose_thompson_winner(
    arms: Sequence[ExplorationArm],
    sampled_scores: dict[str, float],
    forbidden_group_key: str | None,
) -> ExplorationArm | None:
    eligible_arms = [arm for arm in arms if arm.group_key != forbidden_group_key]
    if not eligible_arms:
        return None
    return max(eligible_arms, key=lambda arm: (sampled_scores[arm.item_id], arm.item_id))
