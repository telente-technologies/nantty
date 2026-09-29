import asyncio
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np

from src.configs.settings_config import IntelligenceSettings
from src.container import build_application_container
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.utils.synthetic_commerce_simulator_util import simulate_ad_session, simulate_order_risk_check
from src.utils.synthetic_session_simulator_util import (
    SyntheticEventRecorder,
    draw_probability,
    simulate_clip_session,
    simulate_feed_session,
)
from src.utils.synthetic_world_util import build_synthetic_world


@dataclass(frozen=True)
class SyntheticGenerationSummary:
    session_count: int
    accepted_event_count: int
    rejected_event_count: int


async def generate_synthetic_dataset(
    storage_directory: Path,
    user_count: int = 40,
    sessions_per_user: int = 4,
    window_days: int = 3,
    seed: int = 7,
) -> SyntheticGenerationSummary:
    random_generator = np.random.default_rng(seed)
    window_end = datetime.now(UTC) - timedelta(hours=2)
    settings = IntelligenceSettings(
        environment="development",
        shared_secret="synthetic-data-generation-only-secret",  # noqa: S106
        event_storage_uri=str(storage_directory),
        model_registry_path=Path(tempfile.mkdtemp(prefix="synthetic-empty-registry-")),
        feature_log_max_buffered_rows=1_000_000,
    )
    container = build_application_container(settings, InMemoryFeatureBackend())
    world = build_synthetic_world(random_generator, user_count, window_end, window_days)
    window_seconds = window_days * 86_400
    sessions = sorted(
        (window_end - timedelta(seconds=float(random_generator.uniform(0, window_seconds * 0.7))), user_index)
        for user_index in range(len(world.users))
        for _session in range(sessions_per_user)
    )
    accepted_event_count = 0
    rejected_event_count = 0
    for session_time, user_index in sessions:
        user = world.users[user_index]
        recorder = SyntheticEventRecorder()
        recorder.sequence_number = accepted_event_count + rejected_event_count + user_index * 1_000_000
        shown_post_ids = await simulate_feed_session(container, world, user, session_time, random_generator, recorder)
        if draw_probability(random_generator, 0.6):
            await simulate_clip_session(container, world, user, session_time, random_generator, recorder)
        if draw_probability(random_generator, 0.7):
            await simulate_ad_session(container, world, user, session_time, shown_post_ids, random_generator, recorder)
        if draw_probability(random_generator, 0.5):
            await simulate_order_risk_check(container, user, session_time, random_generator, recorder)
        if recorder.events:
            response = await container.event_ingestion_service.ingest_event_batch(recorder.events)
            accepted_event_count += response.accepted + response.duplicates
            rejected_event_count += len(response.rejected)
    await container.feature_log_sink.flush_buffered_rows()
    return SyntheticGenerationSummary(len(sessions), accepted_event_count, rejected_event_count)


def run_synthetic_data_generation(storage_directory: Path, user_count: int, sessions_per_user: int, seed: int) -> None:
    summary = asyncio.run(
        generate_synthetic_dataset(
            storage_directory, user_count=user_count, sessions_per_user=sessions_per_user, seed=seed
        )
    )
    print(
        f"synthetic sessions={summary.session_count} events={summary.accepted_event_count} "
        f"rejected={summary.rejected_event_count}"
    )
