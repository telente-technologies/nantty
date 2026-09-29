import time
from collections.abc import Callable, Sequence

from src.interfaces.feature_backend_interface import (
    DistinctMemberAdd,
    FeatureWriteOperation,
    HashFieldAssign,
    HashFieldIncrement,
    KeyExpiry,
    SortedSetAssignScore,
    SortedSetIncrement,
    SortedSetKeepHighestScores,
)


class InMemoryFeatureBackend:
    def __init__(self, current_time_provider: Callable[[], float] = time.time) -> None:
        self._current_time_provider = current_time_provider
        self._claimed_keys: dict[str, float] = {}
        self._sorted_sets: dict[str, dict[str, float]] = {}
        self._hashes: dict[str, dict[str, float]] = {}
        self._distinct_sets: dict[str, set[str]] = {}
        self._expiry_times: dict[str, float] = {}

    def _discard_key_if_expired(self, key: str) -> None:
        expiry_time = self._expiry_times.get(key)
        if expiry_time is not None and expiry_time <= self._current_time_provider():
            self._sorted_sets.pop(key, None)
            self._hashes.pop(key, None)
            self._distinct_sets.pop(key, None)
            self._expiry_times.pop(key, None)

    async def claim_keys_if_absent(self, keys: Sequence[str], ttl_seconds: int) -> list[bool]:
        now = self._current_time_provider()
        claim_results: list[bool] = []
        for key in keys:
            existing_expiry = self._claimed_keys.get(key)
            if existing_expiry is not None and existing_expiry > now:
                claim_results.append(False)
                continue
            self._claimed_keys[key] = now + ttl_seconds
            claim_results.append(True)
        return claim_results

    async def delete_keys(self, keys: Sequence[str]) -> None:
        for key in keys:
            self._claimed_keys.pop(key, None)
            self._sorted_sets.pop(key, None)
            self._hashes.pop(key, None)
            self._distinct_sets.pop(key, None)

    async def apply_write_operations(self, operations: Sequence[FeatureWriteOperation]) -> None:
        for operation in operations:
            self._discard_key_if_expired(operation.key)
            match operation:
                case SortedSetIncrement(key=key, member=member, amount=amount):
                    members = self._sorted_sets.setdefault(key, {})
                    members[member] = members.get(member, 0.0) + amount
                case SortedSetAssignScore(key=key, member=member, score=score):
                    self._sorted_sets.setdefault(key, {})[member] = score
                case SortedSetKeepHighestScores(key=key, keep_count=keep_count):
                    members = self._sorted_sets.get(key, {})
                    kept = sorted(members.items(), key=lambda pair: pair[1], reverse=True)[:keep_count]
                    self._sorted_sets[key] = dict(kept)
                case HashFieldIncrement(key=key, field=field, amount=amount):
                    fields = self._hashes.setdefault(key, {})
                    fields[field] = fields.get(field, 0.0) + amount
                case HashFieldAssign(key=key, field=field, value=value):
                    self._hashes.setdefault(key, {})[field] = value
                case DistinctMemberAdd(key=key, member=member):
                    self._distinct_sets.setdefault(key, set()).add(member)
                case KeyExpiry(key=key, ttl_seconds=ttl_seconds):
                    self._expiry_times[key] = self._current_time_provider() + ttl_seconds

    async def read_sorted_set_member_scores(
        self, key_and_member_requests: Sequence[tuple[str, Sequence[str]]]
    ) -> list[list[float | None]]:
        results: list[list[float | None]] = []
        for key, members in key_and_member_requests:
            self._discard_key_if_expired(key)
            stored_members = self._sorted_sets.get(key, {})
            results.append([stored_members.get(member) for member in members])
        return results

    async def read_sorted_set_highest_members(
        self, keys: Sequence[str], limit_per_key: int
    ) -> list[list[tuple[str, float]]]:
        results: list[list[tuple[str, float]]] = []
        for key in keys:
            self._discard_key_if_expired(key)
            stored_members = self._sorted_sets.get(key, {})
            ordered = sorted(stored_members.items(), key=lambda pair: (-pair[1], pair[0]))
            results.append(ordered[:limit_per_key])
        return results

    async def read_hash_fields(self, keys: Sequence[str]) -> list[dict[str, float]]:
        results: list[dict[str, float]] = []
        for key in keys:
            self._discard_key_if_expired(key)
            results.append(dict(self._hashes.get(key, {})))
        return results

    async def count_distinct_members(self, keys: Sequence[str]) -> list[int]:
        counts: list[int] = []
        for key in keys:
            self._discard_key_if_expired(key)
            counts.append(len(self._distinct_sets.get(key, set())))
        return counts

    async def check_backend_is_reachable(self) -> bool:
        return True

    async def close_backend_connections(self) -> None:
        return None
