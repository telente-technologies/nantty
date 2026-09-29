from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from src.dtos.common_dto import RankingResponseMetadata, ViewerContext
from src.modules.feed.dtos.feed_ranking_dto import FeedRankingOptions, FriendAction, FriendEngagement, SocialProofBanner
from src.modules.social_proof.dtos.social_proof_dto import (
    SocialProofRequest,
    SocialProofResponse,
    SocialProofSelectionItem,
)
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.ranking_context_service import (
    read_viewer_online_features_safely,
    resolve_request_identifier,
    resolve_request_time,
)
from src.utils.affinity_feature_util import AFFINITY_HALF_SATURATION_POINT
from src.utils.decay_math_util import squash_non_negative_value_into_unit_interval

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


def build_social_proof_banners_for_viewer(
    ordered_candidates: Sequence[SocialProofCandidate],
    viewer: ViewerContext,
    options: FeedRankingOptions,
    raw_account_affinity: Mapping[str, float],
) -> dict[str, SocialProofSelection]:
    closeness_by_friend = {
        account_id: squash_non_negative_value_into_unit_interval(raw_affinity, AFFINITY_HALF_SATURATION_POINT)
        for account_id, raw_affinity in raw_account_affinity.items()
    }
    return select_posts_eligible_for_friend_social_proof(
        ordered_candidates,
        viewer.user_id,
        frozenset(viewer.followed_account_ids),
        frozenset(viewer.blocked_account_ids) | frozenset(viewer.muted_account_ids),
        closeness_by_friend,
        SocialProofRules(
            minimum_close_friends=options.social_proof_minimum_close_friends,
            minimum_gap_between_banners=options.social_proof_minimum_gap,
            minimum_closeness=options.social_proof_minimum_closeness,
        ),
    )


def convert_selection_to_banner(selection: SocialProofSelection) -> SocialProofBanner:
    return SocialProofBanner(
        friend_ids=selection.friend_ids,
        total_friend_count=selection.total_friend_count,
        primary_action=selection.primary_action,
    )


class SocialProofService:
    def __init__(self, feature_store: OnlineFeatureStore | None) -> None:
        self.feature_store = feature_store

    async def select_social_proof(self, request: SocialProofRequest) -> SocialProofResponse:
        now = resolve_request_time(request.now)
        friend_ids = sorted(
            {engagement.friend_id for item in request.ordered_items for engagement in item.friend_engagements}
        )
        online_features, degraded = await read_viewer_online_features_safely(
            self.feature_store, request.viewer.user_id, friend_ids, [], [], now, False
        )
        selections = build_social_proof_banners_for_viewer(
            [
                SocialProofCandidate(item.item_id, position, item.author_id, item.store_id, item.friend_engagements)
                for position, item in enumerate(request.ordered_items)
            ],
            request.viewer,
            request.options,
            online_features.account_affinity_by_account,
        )
        return SocialProofResponse(
            selections=[
                SocialProofSelectionItem(
                    item_id=selection.item_id,
                    position=selection.position,
                    banner=convert_selection_to_banner(selection),
                )
                for selection in sorted(selections.values(), key=lambda chosen: chosen.position)
            ],
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(None),
                ranking_source="social_proof:rules",
                degraded=degraded,
                generated_at=now,
            ),
        )
