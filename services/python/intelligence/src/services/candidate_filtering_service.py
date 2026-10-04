from collections.abc import Callable, Sequence
from dataclasses import dataclass

from src.dtos.common_dto import ExcludedItem, ViewerContext


@dataclass(frozen=True, slots=True)
class CandidateFilterOutcome[CandidateType]:
    kept_candidates: list[CandidateType]
    previously_seen_candidates: list[CandidateType]
    excluded_items: list[ExcludedItem]


def filter_candidates_for_viewer[CandidateType](
    candidates: Sequence[CandidateType],
    viewer: ViewerContext,
    additionally_seen_item_ids: frozenset[str],
    read_item_id: Callable[[CandidateType], str],
    read_account_ids: Callable[[CandidateType], Sequence[str | None]],
) -> CandidateFilterOutcome[CandidateType]:
    blocked_or_muted_account_ids = frozenset(viewer.blocked_account_ids) | frozenset(viewer.muted_account_ids)
    hidden_item_ids = frozenset(viewer.hidden_item_ids)
    seen_item_ids = frozenset(viewer.seen_item_ids) | additionally_seen_item_ids
    kept: list[CandidateType] = []
    seen: list[CandidateType] = []
    excluded: list[ExcludedItem] = []
    encountered_item_ids: set[str] = set()
    for candidate in candidates:
        item_id = read_item_id(candidate)
        if item_id in encountered_item_ids:
            excluded.append(ExcludedItem(item_id=item_id, reason="duplicate_candidate"))
            continue
        encountered_item_ids.add(item_id)
        account_ids = [account_id for account_id in read_account_ids(candidate) if account_id]
        if any(account_id in blocked_or_muted_account_ids for account_id in account_ids):
            excluded.append(ExcludedItem(item_id=item_id, reason="blocked_or_muted_author"))
            continue
        if item_id in hidden_item_ids:
            excluded.append(ExcludedItem(item_id=item_id, reason="hidden_by_viewer"))
            continue
        if item_id in seen_item_ids:
            seen.append(candidate)
            continue
        kept.append(candidate)
    return CandidateFilterOutcome(kept, seen, excluded)
