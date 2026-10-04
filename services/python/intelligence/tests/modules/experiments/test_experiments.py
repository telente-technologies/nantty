import hashlib
from collections import Counter
from datetime import datetime

from src.modules.experiments.dtos.experiment_dto import ExperimentDefinition
from src.modules.experiments.services.experiment_service import assign_user_to_experiment_variant
from tests.conftest import SignedIntelligenceClient, build_event


def build_experiment(
    weights: dict[str, int], salt: str = "", traffic_allocation: float = 1.0, key: str = "feed_blend"
) -> ExperimentDefinition:
    return ExperimentDefinition.model_validate(
        {
            "key": key,
            "salt": salt,
            "trafficAllocation": traffic_allocation,
            "variants": [{"name": name, "weight": weight} for name, weight in weights.items()],
        }
    )


def reproduce_documented_bucket(text: str, bucket_count: int) -> int:
    return int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest()[:8], "big") % bucket_count


def reproduce_documented_assignment(user_id: str, experiment: ExperimentDefinition) -> str | None:
    allocation_bucket = reproduce_documented_bucket(f"{experiment.key}:{experiment.salt}:allocation:{user_id}", 10_000)
    if allocation_bucket >= experiment.traffic_allocation * 10_000:
        return None
    total_weight = sum(variant.weight for variant in experiment.variants)
    variant_bucket = reproduce_documented_bucket(f"{experiment.key}:{experiment.salt}:variant:{user_id}", total_weight)
    cumulative_weight = 0
    for variant in experiment.variants:
        cumulative_weight += variant.weight
        if variant_bucket < cumulative_weight:
            return variant.name
    return None


def test_assignment_is_deterministic_for_the_same_user_and_key() -> None:
    experiment = build_experiment({"control": 50, "treatment": 50})
    first = [assign_user_to_experiment_variant(f"user_{index}", experiment) for index in range(200)]
    second = [assign_user_to_experiment_variant(f"user_{index}", experiment) for index in range(200)]
    assert first == second


def test_changing_the_salt_reshuffles_users() -> None:
    original = build_experiment({"control": 50, "treatment": 50})
    resalted = build_experiment({"control": 50, "treatment": 50}, salt="round2")
    changed = sum(
        assign_user_to_experiment_variant(f"user_{index}", original).variant
        != assign_user_to_experiment_variant(f"user_{index}", resalted).variant
        for index in range(1000)
    )
    assert 350 < changed < 650


def test_variant_weights_are_respected_within_two_percent() -> None:
    experiment = build_experiment({"control": 70, "treatment": 20, "holdout": 10})
    counts = Counter(assign_user_to_experiment_variant(f"user_{index}", experiment).variant for index in range(20_000))
    assert abs(counts["control"] / 20_000 - 0.7) < 0.02
    assert abs(counts["treatment"] / 20_000 - 0.2) < 0.02
    assert abs(counts["holdout"] / 20_000 - 0.1) < 0.02


def test_traffic_allocation_limits_share_of_users_in_the_experiment() -> None:
    experiment = build_experiment({"control": 1, "treatment": 1}, traffic_allocation=0.3)
    assigned = sum(
        assign_user_to_experiment_variant(f"user_{index}", experiment).variant is not None for index in range(20_000)
    )
    assert abs(assigned / 20_000 - 0.3) < 0.02


def test_zero_weight_variant_is_never_chosen() -> None:
    experiment = build_experiment({"control": 1, "disabled": 0, "treatment": 1})
    variants = {assign_user_to_experiment_variant(f"user_{index}", experiment).variant for index in range(5000)}
    assert variants == {"control", "treatment"}


def test_assignment_matches_the_documented_hash_algorithm() -> None:
    experiment = build_experiment({"control": 3, "treatment": 5, "holdout": 2}, salt="s1", traffic_allocation=0.8)
    for index in range(2000):
        user_id = f"user_{index}"
        assert assign_user_to_experiment_variant(user_id, experiment).variant == reproduce_documented_assignment(
            user_id, experiment
        )


async def test_metrics_endpoint_reports_exposures_and_experiment_event_counts(
    signed_client: SignedIntelligenceClient, reference_now: datetime
) -> None:
    experiment = {"key": "feed_blend", "variants": [{"name": "a", "weight": 1}, {"name": "b", "weight": 1}]}
    assignments: dict[str, str] = {}
    for index in range(20):
        response = await signed_client.post(
            "/v1/experiments/assign", {"userId": f"user_{index}", "experiments": [experiment]}
        )
        assert response.status_code == 200
        assignments[f"user_{index}"] = response.json()["assignments"][0]["variant"]
    events = [
        build_event(
            f"like_{user_id}",
            "post_liked",
            user_id,
            reference_now,
            {"postId": "post_1", "authorId": "author_1"},
            context={"experimentAssignments": {"feed_blend": variant}},
        )
        for user_id, variant in assignments.items()
    ]
    assert (await signed_client.post("/v1/events", {"events": events})).json()["accepted"] == 20
    response = await signed_client.get("/v1/experiments/feed_blend/metrics?variants=a,b")
    assert response.status_code == 200
    variants = {variant["name"]: variant for variant in response.json()["variants"]}
    expected = Counter(assignments.values())
    for name in ("a", "b"):
        assert variants[name]["eventCounts"]["exposures"] == expected[name]
        assert variants[name]["eventCounts"]["post_liked"] == expected[name]
        assert variants[name]["distinctUsers"] == expected[name]
        assert variants[name]["eventsPerUser"]["post_liked"] == 1.0


async def test_metrics_endpoint_rejects_invalid_experiment_keys(signed_client: SignedIntelligenceClient) -> None:
    invalid_key = await signed_client.get("/v1/experiments/Bad_Key/metrics?variants=a")
    invalid_variants = await signed_client.get("/v1/experiments/feed_blend/metrics?variants=A;B")
    assert invalid_key.status_code == 422
    assert invalid_variants.status_code == 422
