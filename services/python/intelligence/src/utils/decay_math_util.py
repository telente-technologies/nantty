import hashlib
import math
from dataclasses import dataclass
from datetime import UTC, datetime

FORWARD_DECAY_BASE_EPOCH_SECONDS = datetime(2026, 1, 1, tzinfo=UTC).timestamp()
HALF_LIVES_PER_FORWARD_DECAY_GENERATION = 64
SECONDS_PER_HOUR = 3600.0


@dataclass(frozen=True, slots=True)
class ForwardDecayGeneration:
    generation_index: int
    epoch_seconds: float


def calculate_freshness_decay_multiplier(
    item_age_hours: float, half_life_hours: float, minimum_multiplier: float = 0.0
) -> float:
    non_negative_age_hours = max(item_age_hours, 0.0)
    decay_multiplier = math.pow(0.5, non_negative_age_hours / half_life_hours)
    return max(decay_multiplier, minimum_multiplier)


def calculate_age_in_hours(created_at: datetime, now: datetime) -> float:
    return max((now - created_at).total_seconds() / SECONDS_PER_HOUR, 0.0)


def squash_non_negative_value_into_unit_interval(value: float, half_saturation_point: float) -> float:
    if value <= 0:
        return 0.0
    return value / (value + half_saturation_point)


def squash_signed_value_into_symmetric_interval(value: float, half_saturation_point: float) -> float:
    return math.copysign(squash_non_negative_value_into_unit_interval(abs(value), half_saturation_point), value)


def logistic_sigmoid(value: float) -> float:
    if value >= 0:
        return 1.0 / (1.0 + math.exp(-value))
    exponential = math.exp(value)
    return exponential / (1.0 + exponential)


def calculate_smoothed_rate(
    success_count: float, trial_count: float, prior_rate: float, prior_strength: float
) -> float:
    return (success_count + prior_rate * prior_strength) / (max(trial_count, 0.0) + prior_strength)


def find_forward_decay_generation(unix_time_seconds: float, half_life_seconds: float) -> ForwardDecayGeneration:
    generation_span_seconds = half_life_seconds * HALF_LIVES_PER_FORWARD_DECAY_GENERATION
    generation_index = max(int((unix_time_seconds - FORWARD_DECAY_BASE_EPOCH_SECONDS) // generation_span_seconds), 0)
    epoch_seconds = FORWARD_DECAY_BASE_EPOCH_SECONDS + generation_index * generation_span_seconds
    return ForwardDecayGeneration(generation_index, epoch_seconds)


def calculate_forward_decay_write_weight(
    base_weight: float, event_unix_time_seconds: float, half_life_seconds: float
) -> tuple[int, float]:
    generation = find_forward_decay_generation(event_unix_time_seconds, half_life_seconds)
    elapsed_half_lives = (event_unix_time_seconds - generation.epoch_seconds) / half_life_seconds
    try:
        return generation.generation_index, base_weight * math.pow(2.0, elapsed_half_lives)
    except OverflowError:
        return generation.generation_index, 0.0


def calculate_forward_decay_read_multiplier(
    generation_index: int, read_unix_time_seconds: float, half_life_seconds: float
) -> float:
    generation_span_seconds = half_life_seconds * HALF_LIVES_PER_FORWARD_DECAY_GENERATION
    epoch_seconds = FORWARD_DECAY_BASE_EPOCH_SECONDS + generation_index * generation_span_seconds
    elapsed_half_lives = (read_unix_time_seconds - epoch_seconds) / half_life_seconds
    try:
        return math.pow(2.0, -elapsed_half_lives)
    except OverflowError:
        return 0.0


def list_readable_forward_decay_generations(read_unix_time_seconds: float, half_life_seconds: float) -> list[int]:
    current_generation = find_forward_decay_generation(read_unix_time_seconds, half_life_seconds)
    if current_generation.generation_index == 0:
        return [0]
    return [current_generation.generation_index, current_generation.generation_index - 1]


def hash_text_to_unit_interval(text: str) -> float:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / float(2**64)


def hash_text_to_bucket(text: str, bucket_count: int) -> int:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") % bucket_count
