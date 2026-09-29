from collections.abc import Sequence
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

from src.interfaces.feature_backend_interface import (
    DistinctMemberAdd,
    FeatureBackendUnavailableError,
    FeatureWriteOperation,
    HashFieldAssign,
    HashFieldIncrement,
    KeyExpiry,
    SortedSetAssignScore,
    SortedSetIncrement,
    SortedSetKeepHighestScores,
)

SCRIPT_KEY_CHUNK_SIZE = 1000
READ_MANY_HASHES_LUA_SCRIPT = """
local rows = {}
for index, key in ipairs(KEYS) do
    rows[index] = redis.call('HGETALL', key)
end
return rows
"""


def convert_optional_redis_number(raw_value: Any) -> float | None:
    if raw_value is None:
        return None
    return float(raw_value)


class RedisFeatureBackend:
    def __init__(self, redis_url: str, socket_timeout_seconds: float) -> None:
        self._redis_client: Redis = Redis.from_url(
            redis_url,
            socket_timeout=socket_timeout_seconds,
            socket_connect_timeout=max(socket_timeout_seconds, 0.5),
            decode_responses=True,
            health_check_interval=30,
        )
        self._read_many_hashes_script = self._redis_client.register_script(READ_MANY_HASHES_LUA_SCRIPT)

    async def claim_keys_if_absent(self, keys: Sequence[str], ttl_seconds: int) -> list[bool]:
        if not keys:
            return []
        try:
            async with self._redis_client.pipeline(transaction=False) as pipeline:
                for key in keys:
                    pipeline.set(key, "1", nx=True, ex=ttl_seconds)
                raw_results = await pipeline.execute()
        except RedisError as redis_error:
            raise FeatureBackendUnavailableError("redis claim failed") from redis_error
        return [bool(raw_result) for raw_result in raw_results]

    async def delete_keys(self, keys: Sequence[str]) -> None:
        if not keys:
            return
        try:
            await self._redis_client.delete(*keys)
        except RedisError as redis_error:
            raise FeatureBackendUnavailableError("redis delete failed") from redis_error

    async def apply_write_operations(self, operations: Sequence[FeatureWriteOperation]) -> None:
        if not operations:
            return
        try:
            async with self._redis_client.pipeline(transaction=False) as pipeline:
                for operation in operations:
                    match operation:
                        case SortedSetIncrement(key=key, member=member, amount=amount):
                            pipeline.zincrby(key, amount, member)
                        case SortedSetAssignScore(key=key, member=member, score=score):
                            pipeline.zadd(key, {member: score})
                        case SortedSetKeepHighestScores(key=key, keep_count=keep_count):
                            pipeline.zremrangebyrank(key, 0, -(keep_count + 1))
                        case HashFieldIncrement(key=key, field=field, amount=amount):
                            pipeline.hincrbyfloat(key, field, amount)
                        case HashFieldAssign(key=key, field=field, value=value):
                            pipeline.hset(key, field, value)
                        case DistinctMemberAdd(key=key, member=member):
                            pipeline.pfadd(key, member)
                        case KeyExpiry(key=key, ttl_seconds=ttl_seconds):
                            pipeline.expire(key, ttl_seconds)
                await pipeline.execute()
        except RedisError as redis_error:
            raise FeatureBackendUnavailableError("redis write failed") from redis_error

    async def read_sorted_set_member_scores(
        self, key_and_member_requests: Sequence[tuple[str, Sequence[str]]]
    ) -> list[list[float | None]]:
        non_empty_requests = [(key, list(members)) for key, members in key_and_member_requests if members]
        if not non_empty_requests:
            return [[] for _ in key_and_member_requests]
        try:
            async with self._redis_client.pipeline(transaction=False) as pipeline:
                for key, members in non_empty_requests:
                    pipeline.zmscore(key, members)
                raw_results = iter(await pipeline.execute())
        except RedisError as redis_error:
            raise FeatureBackendUnavailableError("redis read failed") from redis_error
        results: list[list[float | None]] = []
        for _key, requested_members in key_and_member_requests:
            if not requested_members:
                results.append([])
                continue
            results.append([convert_optional_redis_number(value) for value in next(raw_results)])
        return results

    async def read_sorted_set_highest_members(
        self, keys: Sequence[str], limit_per_key: int
    ) -> list[list[tuple[str, float]]]:
        if not keys:
            return []
        try:
            async with self._redis_client.pipeline(transaction=False) as pipeline:
                for key in keys:
                    pipeline.zrevrange(key, 0, limit_per_key - 1, withscores=True)
                raw_results = await pipeline.execute()
        except RedisError as redis_error:
            raise FeatureBackendUnavailableError("redis read failed") from redis_error
        return [[(str(member), float(score)) for member, score in rows] for rows in raw_results]

    async def read_hash_fields(self, keys: Sequence[str]) -> list[dict[str, float]]:
        results: list[dict[str, float]] = []
        try:
            for chunk_start in range(0, len(keys), SCRIPT_KEY_CHUNK_SIZE):
                chunk_keys = list(keys[chunk_start : chunk_start + SCRIPT_KEY_CHUNK_SIZE])
                flat_rows = await self._read_many_hashes_script(keys=chunk_keys)
                for flat_row in flat_rows:
                    results.append(
                        {str(flat_row[index]): float(flat_row[index + 1]) for index in range(0, len(flat_row), 2)}
                    )
        except RedisError as redis_error:
            raise FeatureBackendUnavailableError("redis read failed") from redis_error
        return results

    async def count_distinct_members(self, keys: Sequence[str]) -> list[int]:
        if not keys:
            return []
        try:
            async with self._redis_client.pipeline(transaction=False) as pipeline:
                for key in keys:
                    pipeline.pfcount(key)
                raw_results = await pipeline.execute()
        except RedisError as redis_error:
            raise FeatureBackendUnavailableError("redis read failed") from redis_error
        return [int(raw_result) for raw_result in raw_results]

    async def check_backend_is_reachable(self) -> bool:
        try:
            return bool(await self._redis_client.ping())
        except RedisError:
            return False

    async def close_backend_connections(self) -> None:
        await self._redis_client.aclose()
