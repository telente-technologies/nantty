from collections.abc import Mapping, Sequence

from src.utils.decay_math_util import squash_signed_value_into_symmetric_interval

AFFINITY_HALF_SATURATION_POINT = 3.0


RATE_PRIOR_STRENGTH = 20.0


def read_normalized_affinity(raw_affinity_by_key: Mapping[str, float], key: str | None) -> float:
    if key is None:
        return 0.0
    return squash_signed_value_into_symmetric_interval(
        raw_affinity_by_key.get(key, 0.0), AFFINITY_HALF_SATURATION_POINT
    )


def summarize_topic_affinities(
    raw_topic_affinity: Mapping[str, float], candidate_topics: Sequence[str]
) -> tuple[float, float]:
    if not candidate_topics:
        return 0.0, 0.0
    normalized_affinities = [read_normalized_affinity(raw_topic_affinity, topic) for topic in candidate_topics]
    return max(normalized_affinities), sum(normalized_affinities) / len(normalized_affinities)
