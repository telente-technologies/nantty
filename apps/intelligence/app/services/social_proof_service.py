from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from app.models.feed_ranking_model import FriendAction, FriendEngagement

ACTION_VALUE_MULTIPLIER: dict[FriendAction, float] = {
    "liked": 1.0,
    "commented": 1.2,
    "shared": 1.3,
    "purchased": 1.5,
}
MINIMUM_SOCIAL_PROOF_VALUE = 0.8
MAXIMUM_DISPLAYED_FRIEND_IDS = 3
UNFOLLOWED_AUTHOR_VALUE_MULTIPLIER = 1.3
FOLLOWED_AUTHOR_VALUE_MULTIPLIER = 0.8


@dataclass(frozen=True, slots=True)
class SocialProofCandidate:
    item_id: str
    position: int
    author_id: str
    store_id: str | None
    friend_engagements: Sequence[FriendEngagement]


@dataclass(frozen=True, slots=True)
class SocialProofRules:
    minimum_close_friends: int
    minimum_gap_between_banners: int
    minimum_closeness: float


@dataclass(frozen=True, slots=True)
class SocialProofSelection:
    item_id: str
    position: int
    friend_ids: list[str]
    total_friend_count: int
    primary_action: FriendAction
    value: float


def collect_qualifying_friend_engagements(
    candidate: SocialProofCandidate,
    viewer_user_id: str,
    excluded_account_ids: frozenset[str],
    closeness_by_friend: Mapping[str, float],
    minimum_closeness: float,
) -> dict[str, tuple[float, FriendAction]]:
    strongest_by_friend: dict[str, tuple[float, FriendAction]] = {}
    for engagement in candidate.friend_engagements:
        if engagement.friend_id == viewer_user_id or engagement.friend_id in excluded_account_ids:
            continue
        closeness = max(engagement.closeness or 0.0, closeness_by_friend.get(engagement.friend_id, 0.0))
        if closeness < minimum_closeness:
            continue
        previous = strongest_by_friend.get(engagement.friend_id)
        if previous is None or ACTION_VALUE_MULTIPLIER[engagement.action] > ACTION_VALUE_MULTIPLIER[previous[1]]:
            strongest_by_friend[engagement.friend_id] = (closeness, engagement.action)
    return strongest_by_friend


def evaluate_social_proof_value(
    candidate: SocialProofCandidate,
    qualifying_friends: Mapping[str, tuple[float, FriendAction]],
    followed_account_ids: frozenset[str],
) -> float:
    raw_value = sum(closeness * ACTION_VALUE_MULTIPLIER[action] for closeness, action in qualifying_friends.values())
    viewer_follows_author = candidate.author_id in followed_account_ids or (
        candidate.store_id is not None and candidate.store_id in followed_account_ids
    )
    multiplier = FOLLOWED_AUTHOR_VALUE_MULTIPLIER if viewer_follows_author else UNFOLLOWED_AUTHOR_VALUE_MULTIPLIER
    return raw_value * multiplier


def choose_primary_action(qualifying_friends: Mapping[str, tuple[float, FriendAction]]) -> FriendAction:
    action_totals: dict[FriendAction, float] = {}
    for closeness, action in qualifying_friends.values():
        action_totals[action] = action_totals.get(action, 0.0) + closeness
    return max(action_totals.items(), key=lambda pair: (pair[1], ACTION_VALUE_MULTIPLIER[pair[0]]))[0]


def select_posts_eligible_for_friend_social_proof(
    ordered_candidates: Sequence[SocialProofCandidate],
    viewer_user_id: str,
    followed_account_ids: frozenset[str],
    excluded_account_ids: frozenset[str],
    closeness_by_friend: Mapping[str, float],
    rules: SocialProofRules,
) -> dict[str, SocialProofSelection]:
    scored_options: list[SocialProofSelection] = []
    for candidate in ordered_candidates:
        qualifying_friends = collect_qualifying_friend_engagements(
            candidate, viewer_user_id, excluded_account_ids, closeness_by_friend, rules.minimum_closeness
        )
        if len(qualifying_friends) < rules.minimum_close_friends:
            continue
        value = evaluate_social_proof_value(candidate, qualifying_friends, followed_account_ids)
        if value < MINIMUM_SOCIAL_PROOF_VALUE:
            continue
        friends_by_closeness = sorted(qualifying_friends.items(), key=lambda pair: (-pair[1][0], pair[0]))
        scored_options.append(
            SocialProofSelection(
                item_id=candidate.item_id,
                position=candidate.position,
                friend_ids=[friend_id for friend_id, _details in friends_by_closeness[:MAXIMUM_DISPLAYED_FRIEND_IDS]],
                total_friend_count=len(qualifying_friends),
                primary_action=choose_primary_action(qualifying_friends),
                value=value,
            )
        )
    chosen_positions: list[int] = []
    selections: dict[str, SocialProofSelection] = {}
    for option in sorted(scored_options, key=lambda selection: (-selection.value, selection.position)):
        too_close_to_existing_banner = any(
            abs(option.position - chosen_position) < rules.minimum_gap_between_banners
            for chosen_position in chosen_positions
        )
        if too_close_to_existing_banner:
            continue
        chosen_positions.append(option.position)
        selections[option.item_id] = option
    return selections
