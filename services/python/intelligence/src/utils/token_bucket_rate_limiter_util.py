import time
from collections.abc import Callable
from dataclasses import dataclass

MAXIMUM_TRACKED_CLIENTS = 10_000


@dataclass(slots=True)
class TokenBucketState:
    available_tokens: float
    last_refill_time: float


class TokenBucketRateLimiter:
    def __init__(
        self,
        tokens_per_second: float,
        burst_size: int,
        current_time_provider: Callable[[], float] = time.monotonic,
    ) -> None:
        self.tokens_per_second = tokens_per_second
        self.burst_size = burst_size
        self.current_time_provider = current_time_provider
        self._bucket_by_client: dict[str, TokenBucketState] = {}

    def try_consume_token(self, client_key: str) -> tuple[bool, float]:
        now = self.current_time_provider()
        bucket = self._bucket_by_client.get(client_key)
        if bucket is None:
            if len(self._bucket_by_client) >= MAXIMUM_TRACKED_CLIENTS:
                self._bucket_by_client.clear()
            bucket = TokenBucketState(float(self.burst_size), now)
            self._bucket_by_client[client_key] = bucket
        elapsed_seconds = max(now - bucket.last_refill_time, 0.0)
        bucket.available_tokens = min(
            float(self.burst_size), bucket.available_tokens + elapsed_seconds * self.tokens_per_second
        )
        bucket.last_refill_time = now
        if bucket.available_tokens >= 1.0:
            bucket.available_tokens -= 1.0
            return True, 0.0
        seconds_until_next_token = (1.0 - bucket.available_tokens) / self.tokens_per_second
        return False, seconds_until_next_token
