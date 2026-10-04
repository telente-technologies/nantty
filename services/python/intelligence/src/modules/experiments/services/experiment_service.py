import contextlib

from src.interfaces.feature_backend_interface import (
    DistinctMemberAdd,
    FeatureBackendUnavailableError,
    FeatureWriteOperation,
    HashFieldIncrement,
    KeyExpiry,
)
from src.modules.experiments.dtos.experiment_dto import (
    ExperimentAssignment,
    ExperimentAssignmentRequest,
    ExperimentAssignmentResponse,
    ExperimentDefinition,
    ExperimentMetricsResponse,
    VariantMetrics,
)
from src.repositories.online_feature_keyspace_repository import EXPERIMENT_COUNTER_TTL_SECONDS
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.utils.decay_math_util import hash_text_to_bucket

EXPERIMENT_BUCKET_COUNT = 10_000
EXPOSURE_COUNTER_FIELD = "exposures"


def assign_user_to_experiment_variant(user_id: str, experiment: ExperimentDefinition) -> ExperimentAssignment:
    allocation_bucket = hash_text_to_bucket(
        f"{experiment.key}:{experiment.salt}:allocation:{user_id}", EXPERIMENT_BUCKET_COUNT
    )
    if allocation_bucket >= experiment.traffic_allocation * EXPERIMENT_BUCKET_COUNT:
        return ExperimentAssignment(key=experiment.key, variant=None, bucket=allocation_bucket)
    total_weight = sum(variant.weight for variant in experiment.variants)
    if total_weight == 0:
        return ExperimentAssignment(key=experiment.key, variant=None, bucket=allocation_bucket)
    variant_bucket = hash_text_to_bucket(f"{experiment.key}:{experiment.salt}:variant:{user_id}", total_weight)
    cumulative_weight = 0
    for variant in experiment.variants:
        cumulative_weight += variant.weight
        if variant_bucket < cumulative_weight:
            return ExperimentAssignment(key=experiment.key, variant=variant.name, bucket=allocation_bucket)
    return ExperimentAssignment(key=experiment.key, variant=experiment.variants[-1].name, bucket=allocation_bucket)


class ExperimentService:
    def __init__(self, feature_store: OnlineFeatureStore | None) -> None:
        self.feature_store = feature_store

    async def assign_variants(self, request: ExperimentAssignmentRequest) -> ExperimentAssignmentResponse:
        assignments = [
            assign_user_to_experiment_variant(request.user_id, experiment) for experiment in request.experiments
        ]
        if request.record_exposure and self.feature_store is not None:
            operations: list[FeatureWriteOperation] = []
            keyspace = self.feature_store.keyspace
            for assignment in assignments:
                if assignment.variant is None:
                    continue
                counter_key = keyspace.experiment_counter_key(assignment.key, assignment.variant)
                users_key = keyspace.experiment_distinct_users_key(assignment.key, assignment.variant)
                operations += [
                    HashFieldIncrement(counter_key, EXPOSURE_COUNTER_FIELD, 1.0),
                    KeyExpiry(counter_key, EXPERIMENT_COUNTER_TTL_SECONDS),
                    DistinctMemberAdd(users_key, request.user_id),
                    KeyExpiry(users_key, EXPERIMENT_COUNTER_TTL_SECONDS),
                ]
            with contextlib.suppress(FeatureBackendUnavailableError):
                await self.feature_store.feature_backend.apply_write_operations(operations)
        return ExperimentAssignmentResponse(assignments=assignments)

    async def read_variant_metrics(self, experiment_key: str, variant_names: list[str]) -> ExperimentMetricsResponse:
        if self.feature_store is None:
            raise FeatureBackendUnavailableError("feature store not configured")
        keyspace = self.feature_store.keyspace
        backend = self.feature_store.feature_backend
        counters = await backend.read_hash_fields(
            [keyspace.experiment_counter_key(experiment_key, variant) for variant in variant_names]
        )
        distinct_users = await backend.count_distinct_members(
            [keyspace.experiment_distinct_users_key(experiment_key, variant) for variant in variant_names]
        )
        variants = []
        for variant_name, counter, user_count in zip(variant_names, counters, distinct_users, strict=True):
            event_counts = {event_type: int(count) for event_type, count in sorted(counter.items())}
            variants.append(
                VariantMetrics(
                    name=variant_name,
                    distinct_users=user_count,
                    event_counts=event_counts,
                    events_per_user={
                        event_type: round(count / user_count, 6) if user_count else 0.0
                        for event_type, count in event_counts.items()
                    },
                )
            )
        return ExperimentMetricsResponse(key=experiment_key, variants=variants)
