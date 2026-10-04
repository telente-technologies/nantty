from collections.abc import Sequence
from dataclasses import dataclass

DIVERSITY_LOOKAHEAD_WINDOW = 40
MINIMUM_ITEMS_BEFORE_PRODUCT_SHARE_RULE = 3


@dataclass(frozen=True, slots=True)
class DiversityCandidate:
    item_id: str
    score: float
    author_key: str
    store_key: str | None
    is_product: bool
    topics: frozenset[str]


@dataclass(frozen=True, slots=True)
class DiversityRules:
    max_consecutive_same_author: int
    max_consecutive_product_posts: int
    maximum_product_post_share: float
    topic_repeat_penalty: float
    topic_window_size: int


def count_trailing_items_matching(placed_items: Sequence[DiversityCandidate], candidate: DiversityCandidate) -> int:
    trailing_count = 0
    for placed_item in reversed(placed_items):
        same_author = placed_item.author_key == candidate.author_key
        same_store = candidate.store_key is not None and placed_item.store_key == candidate.store_key
        if not (same_author or same_store):
            break
        trailing_count += 1
    return trailing_count


def count_trailing_product_posts(placed_items: Sequence[DiversityCandidate]) -> int:
    trailing_count = 0
    for placed_item in reversed(placed_items):
        if not placed_item.is_product:
            break
        trailing_count += 1
    return trailing_count


def violates_hard_diversity_rules(
    placed_items: Sequence[DiversityCandidate],
    candidate: DiversityCandidate,
    rules: DiversityRules,
    placed_product_count: int,
) -> bool:
    if count_trailing_items_matching(placed_items, candidate) >= rules.max_consecutive_same_author:
        return True
    if candidate.is_product:
        if count_trailing_product_posts(placed_items) >= rules.max_consecutive_product_posts:
            return True
        product_share_after_placement = (placed_product_count + 1) / (len(placed_items) + 1)
        if len(placed_items) >= MINIMUM_ITEMS_BEFORE_PRODUCT_SHARE_RULE and (
            product_share_after_placement > rules.maximum_product_post_share
        ):
            return True
    return False


def calculate_topic_repetition_adjusted_score(
    placed_items: Sequence[DiversityCandidate], candidate: DiversityCandidate, rules: DiversityRules
) -> float:
    if rules.topic_window_size == 0 or not candidate.topics:
        return candidate.score
    recent_topics: set[str] = set()
    for placed_item in placed_items[-rules.topic_window_size :]:
        recent_topics |= placed_item.topics
    repeated_topic_count = len(candidate.topics & recent_topics)
    return candidate.score * (rules.topic_repeat_penalty**repeated_topic_count)


def rerank_candidates_for_diversity(
    candidates: Sequence[DiversityCandidate], rules: DiversityRules, output_limit: int
) -> list[DiversityCandidate]:
    remaining = sorted(candidates, key=lambda candidate: (-candidate.score, candidate.item_id))
    placed_items: list[DiversityCandidate] = []
    placed_product_count = 0
    while remaining and len(placed_items) < output_limit:
        best_index_satisfying_rules: int | None = None
        best_adjusted_score_satisfying_rules = float("-inf")
        best_index_overall = 0
        best_adjusted_score_overall = float("-inf")
        for index, candidate in enumerate(remaining[:DIVERSITY_LOOKAHEAD_WINDOW]):
            adjusted_score = calculate_topic_repetition_adjusted_score(placed_items, candidate, rules)
            if adjusted_score > best_adjusted_score_overall:
                best_index_overall, best_adjusted_score_overall = index, adjusted_score
            if adjusted_score > best_adjusted_score_satisfying_rules and not violates_hard_diversity_rules(
                placed_items, candidate, rules, placed_product_count
            ):
                best_index_satisfying_rules, best_adjusted_score_satisfying_rules = index, adjusted_score
        chosen_index = best_index_satisfying_rules if best_index_satisfying_rules is not None else best_index_overall
        chosen_candidate = remaining.pop(chosen_index)
        placed_items.append(chosen_candidate)
        placed_product_count += 1 if chosen_candidate.is_product else 0
    return placed_items
