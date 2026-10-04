import os
import uuid
from collections.abc import AsyncIterator

import pytest

from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.databases.redis_feature_database import RedisFeatureBackend
from src.interfaces.feature_backend_interface import (
    DistinctMemberAdd,
    FeatureBackend,
    HashFieldAssign,
    HashFieldIncrement,
    KeyExpiry,
    SortedSetAssignScore,
    SortedSetIncrement,
    SortedSetKeepHighestScores,
)

TEST_REDIS_URL = os.environ.get("INTELLIGENCE_TEST_REDIS_URL", "")


@pytest.fixture(params=["memory", "redis"])
async def backend_under_test(request: pytest.FixtureRequest) -> AsyncIterator[tuple[FeatureBackend, str]]:
    prefix = f"test:{uuid.uuid4().hex}"
    if request.param == "memory":
        yield InMemoryFeatureBackend(), prefix
        return
    if not TEST_REDIS_URL:
        pytest.skip("INTELLIGENCE_TEST_REDIS_URL not set")
    redis_backend = RedisFeatureBackend(TEST_REDIS_URL, 1.0)
    yield redis_backend, prefix
    await redis_backend.close_backend_connections()


async def test_backends_agree_on_claims_and_deletion(backend_under_test: tuple[FeatureBackend, str]) -> None:
    backend, prefix = backend_under_test
    keys = [f"{prefix}:claim:a", f"{prefix}:claim:b"]
    assert await backend.claim_keys_if_absent(keys, 60) == [True, True]
    assert await backend.claim_keys_if_absent([keys[0], f"{prefix}:claim:c"], 60) == [False, True]
    await backend.delete_keys([keys[0]])
    assert await backend.claim_keys_if_absent([keys[0]], 60) == [True]


async def test_backends_agree_on_write_and_read_primitives(backend_under_test: tuple[FeatureBackend, str]) -> None:
    backend, prefix = backend_under_test
    ranking_key, hash_key, distinct_key = f"{prefix}:zset", f"{prefix}:hash", f"{prefix}:hll"
    await backend.apply_write_operations(
        [
            SortedSetIncrement(ranking_key, "first", 2.0),
            SortedSetIncrement(ranking_key, "first", 1.5),
            SortedSetAssignScore(ranking_key, "second", 10.0),
            SortedSetAssignScore(ranking_key, "third", 1.0),
            SortedSetKeepHighestScores(ranking_key, 2),
            HashFieldIncrement(hash_key, "views", 3.0),
            HashFieldAssign(hash_key, "flag", 1.0),
            DistinctMemberAdd(distinct_key, "user_a"),
            DistinctMemberAdd(distinct_key, "user_a"),
            DistinctMemberAdd(distinct_key, "user_b"),
            KeyExpiry(ranking_key, 600),
        ]
    )
    assert await backend.read_sorted_set_member_scores(
        [(ranking_key, ["first", "third", "missing"]), (ranking_key, [])]
    ) == [
        [3.5, None, None],
        [],
    ]
    assert await backend.read_sorted_set_highest_members([ranking_key], 5) == [[("second", 10.0), ("first", 3.5)]]
    assert await backend.read_hash_fields([hash_key, f"{prefix}:absent"]) == [{"views": 3.0, "flag": 1.0}, {}]
    assert await backend.count_distinct_members([distinct_key]) == [2]
    assert await backend.check_backend_is_reachable()
