from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class SortedSetIncrement:
    key: str
    member: str
    amount: float


@dataclass(frozen=True, slots=True)
class SortedSetAssignScore:
    key: str
    member: str
    score: float


@dataclass(frozen=True, slots=True)
class SortedSetKeepHighestScores:
    key: str
    keep_count: int


@dataclass(frozen=True, slots=True)
class HashFieldIncrement:
    key: str
    field: str
    amount: float


@dataclass(frozen=True, slots=True)
class HashFieldAssign:
    key: str
    field: str
    value: float


@dataclass(frozen=True, slots=True)
class DistinctMemberAdd:
    key: str
    member: str


@dataclass(frozen=True, slots=True)
class KeyExpiry:
    key: str
    ttl_seconds: int


type FeatureWriteOperation = (
    SortedSetIncrement
    | SortedSetAssignScore
    | SortedSetKeepHighestScores
    | HashFieldIncrement
    | HashFieldAssign
    | DistinctMemberAdd
    | KeyExpiry
)


class FeatureBackendUnavailableError(RuntimeError):
    pass


class FeatureBackend(Protocol):
    async def claim_keys_if_absent(self, keys: Sequence[str], ttl_seconds: int) -> list[bool]:
        pass

    async def delete_keys(self, keys: Sequence[str]) -> None:
        pass

    async def apply_write_operations(self, operations: Sequence[FeatureWriteOperation]) -> None:
        pass

    async def read_sorted_set_member_scores(
        self, key_and_member_requests: Sequence[tuple[str, Sequence[str]]]
    ) -> list[list[float | None]]:
        pass

    async def read_sorted_set_highest_members(
        self, keys: Sequence[str], limit_per_key: int
    ) -> list[list[tuple[str, float]]]:
        pass

    async def read_hash_fields(self, keys: Sequence[str]) -> list[dict[str, float]]:
        pass

    async def count_distinct_members(self, keys: Sequence[str]) -> list[int]:
        pass

    async def check_backend_is_reachable(self) -> bool:
        pass

    async def close_backend_connections(self) -> None:
        pass
