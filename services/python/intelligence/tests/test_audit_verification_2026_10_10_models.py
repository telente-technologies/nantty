import json
import logging
import os
import time
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import polars as pl
import pyarrow as arrow
import pyarrow.parquet as arrow_parquet
import pytest

from src.configs.settings_config import IntelligenceSettings
from src.container import build_application_container
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.enums.ranking_surface_enum import RankingSurface
from src.integrations.dataset_storage_integration import build_local_dataset_storage_location
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError
from src.jobs.compact_datasets_job import COMPACTION_MANIFEST_NAME, compact_partition_directory
from src.jobs.erase_personal_data_job import erase_pending_actors_once
from src.jobs.pipeline_cli_job import main as run_pipeline_command
from src.jobs.train_item_similarity_job import (
    build_similar_items,
    evaluate_leave_last_out_recall,
    select_held_out_interactions,
)
from src.modules.ads.dtos.ad_selection_dto import AdSelectionRequest
from src.modules.clips.services.exploration_sampling_service import calculate_exploration_slot_positions
from src.modules.domain_events.services.personal_data_purge_service import PersonalDataPurgeService
from src.modules.feed.dtos.feed_ranking_dto import FeedRankingRequest
from src.modules.feed.services.feed_fairness_service import assess_candidate_integrity
from src.modules.help_content.dtos.help_answer_draft_dto import HelpAnswerDraftRequest
from src.modules.help_content.services.help_answer_drafting_service import draft_help_answer
from src.modules.model_registry.repositories.model_registry_repository import ModelRegistry
from src.modules.model_registry.services.model_promotion_service import register_and_maybe_activate_model
from src.modules.moderation.dtos.content_moderation_dto import ContentModerationRequest
from src.modules.moderation.services.content_moderation_service import ContentModerationService
from src.modules.moderation.services.moderation_model_interface_service import ModerationModelHolder
from src.modules.risk.dtos.risk_scoring_dto import RiskReason
from src.modules.trending.services.headline_text_service import clean_post_text_for_headline
from src.repositories.feature_log_parquet_repository import (
    FEATURE_LOG_ARROW_SCHEMA,
    FeatureLogParquetSink,
    LoggedFeatureRow,
)
from src.repositories.online_feature_keyspace_repository import OnlineFeatureKeyspace
from src.services.engagement_integrity_service import IntegrityAssessment
from src.utils.dataset_loading_util import load_feature_logs
from tests.conftest import TEST_SHARED_SECRET, build_viewer
from tests.modules.ads.test_ad_auction_and_pricing import build_ad_candidate
from tests.modules.feed.test_feed_ranking import build_feed_candidates

NOW = datetime(2026, 10, 10, 12, 0, tzinfo=UTC)


async def test_heuristic_only_text_moderation_reports_degraded_without_forcing_review() -> None:
    response = await ContentModerationService(ModerationModelHolder()).classify_content(
        ContentModerationRequest(content_id="c1", content_type="comment", text="lovely dress", now=NOW)
    )
    assert response.metadata.degraded is True
    assert response.suggested_action == "allow"


@pytest.mark.parametrize(
    ("text", "category"),
    [("I want to end my life tonight", "self_harm"), ("all those people are vermin", "hate")],
)
async def test_self_harm_and_hate_are_moderation_categories(text: str, category: str) -> None:
    response = await ContentModerationService(ModerationModelHolder()).classify_content(
        ContentModerationRequest(content_id="c1", content_type="post", text=text, now=NOW)
    )
    assert response.top_category == category
    assert response.suggested_action != "allow"


def test_item_similarity_recall_is_measured_without_the_held_out_interaction() -> None:
    interactions = pl.DataFrame(
        {
            "actor_id": ["a", "a"],
            "product_id": ["p1", "p2"],
            "occurred_at": [NOW, NOW + timedelta(minutes=5)],
        }
    )
    aggregated = interactions.select("actor_id", "product_id").with_columns(pl.lit(1.0).alias("weight"))
    leaky = build_similar_items(aggregated, ["p1", "p2"])
    held_out = select_held_out_interactions(interactions)
    honest = build_similar_items(aggregated.join(held_out, on=["actor_id", "product_id"], how="anti"), ["p1", "p2"])
    assert held_out.rows() == [("a", "p2")]
    assert evaluate_leave_last_out_recall(interactions, leaky) == 1.0
    assert evaluate_leave_last_out_recall(interactions, honest) == 0.0


def register(registry: ModelRegistry, value: float | None, marker: str, force: bool = False) -> dict[str, Any]:
    return register_and_maybe_activate_model(
        registry, "order_risk", {"marker": marker}, {}, "auc", value, {}, force_activation=force
    )


def test_quality_gate_rules(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, "", "test")
    assert register(registry, 0.40, "below")["activated"] is False
    assert register(registry, None, "missing")["decision"] == "primary_metric_unavailable"
    first = register(registry, 0.80, "first")
    assert first["activated"] is True
    assert register(registry, 0.70, "worse")["decision"] == "regressed_against_active_version"
    refused = register(registry, None, "forced-unmeasured", force=True)
    assert (refused["activated"], refused["decision"]) == (False, "force_refused_without_primary_metric")
    assert registry.read_active_version("order_risk") == first["version"]
    assert register(registry, 0.70, "forced-measured", force=True)["activated"] is True


def test_forcing_an_unmeasured_model_is_allowed_only_to_bootstrap(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, "", "test")
    assert register(registry, None, "bootstrap", force=True)["activated"] is True


def test_promotion_decisions_are_logged_at_warning(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="intelligence.pipeline.promotion"):
        register(ModelRegistry(tmp_path, "", "test"), 0.9, "logged")
    assert "model_registered" in caplog.messages


def test_stale_staging_directories_are_removed(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, "", "test")
    stale = tmp_path / "order_risk" / ".staging-123"
    stale.mkdir(parents=True)
    old = time.time() - 7200
    os.utime(stale, (old, old))
    register(registry, 0.9, "gc")
    assert not stale.exists()


def test_synthetic_generation_refuses_object_storage() -> None:
    assert run_pipeline_command(["--storage", "s3://bucket/data", "generate-synthetic-data"]) == 2


def feature_row(index: int, actor_id: str = "viewer") -> LoggedFeatureRow:
    return LoggedFeatureRow(
        request_id=f"r{index}",
        surface="feed",
        actor_id=actor_id,
        item_id=f"i{index}",
        logged_at=NOW,
        served_position=index,
        model_version=None,
        feature_schema_version=1,
        features=[0.0],
    )


async def test_dropped_feature_rows_are_reported(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    sink = FeatureLogParquetSink(build_local_dataset_storage_location(str(tmp_path)), 100)
    sink.append_feature_rows([feature_row(index) for index in range(150)])
    with caplog.at_level(logging.WARNING, logger="intelligence.feature_logs"):
        assert await sink.flush_buffered_rows() == 100
    assert "feature_log_rows_dropped" in caplog.messages
    assert sink.report_new_dropped_rows() == 0


def write_feature_part(directory: Path, name: str, rows: Sequence[LoggedFeatureRow]) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    table = arrow.Table.from_pylist(
        [
            {
                "request_id": row.request_id,
                "surface": row.surface,
                "actor_id": row.actor_id,
                "item_id": row.item_id,
                "logged_at": row.logged_at,
                "served_position": row.served_position,
                "model_version": row.model_version,
                "feature_schema_version": row.feature_schema_version,
                "features": list(row.features),
            }
            for row in rows
        ],
        schema=FEATURE_LOG_ARROW_SCHEMA,
    )
    path = directory / name
    arrow_parquet.write_table(table, path)
    return path


def test_interrupted_compaction_is_finished_and_rows_are_not_doubled(tmp_path: Path) -> None:
    location = build_local_dataset_storage_location(str(tmp_path))
    directory = tmp_path / "feature_logs" / "surface=feed" / "log_date=2026-10-10"
    sources = [write_feature_part(directory, f"part-{index}.parquet", [feature_row(index)]) for index in range(2)]
    write_feature_part(directory, "part-merged.parquet", [feature_row(0), feature_row(1)])
    (directory / COMPACTION_MANIFEST_NAME).write_text(
        json.dumps({"merged": "part-merged.parquet", "sources": [str(path) for path in sources]})
    )
    compact_partition_directory(location, str(directory), FEATURE_LOG_ARROW_SCHEMA)
    assert sorted(path.name for path in directory.iterdir()) == ["part-merged.parquet"]
    write_feature_part(directory, "part-dup.parquet", [feature_row(0)])
    assert load_feature_logs(location, RankingSurface.FEED, 1).height == 2


async def test_account_erasure_reaches_parquet_at_rest(tmp_path: Path) -> None:
    location = build_local_dataset_storage_location(str(tmp_path))
    directory = tmp_path / "feature_logs" / "surface=feed" / "log_date=2026-10-10"
    write_feature_part(directory, "part-a.parquet", [feature_row(0, "erased"), feature_row(1, "kept")])
    write_feature_part(directory, "part-b.parquet", [feature_row(2, "kept")])
    backend = InMemoryFeatureBackend()
    keyspace = OnlineFeatureKeyspace("intel")
    await PersonalDataPurgeService(backend, keyspace).purge_account("erased")
    erased = await erase_pending_actors_once(location, backend, keyspace, 90)
    assert erased["feature_logs"] == 1
    remaining = load_feature_logs(location, RankingSurface.FEED, 1)
    assert sorted(remaining.get_column("actor_id").to_list()) == ["kept", "kept"]
    assert (await erase_pending_actors_once(location, backend, keyspace, 90))["feature_logs"] == 0


class UnavailableReadsBackend(InMemoryFeatureBackend):
    async def read_hash_fields(self, keys: Sequence[str]) -> list[dict[str, float]]:  # noqa: ARG002
        raise FeatureBackendUnavailableError("down")

    async def read_sorted_set_highest_members(
        self,
        keys: Sequence[str],  # noqa: ARG002
        limit_per_key: int,  # noqa: ARG002
    ) -> list[list[tuple[str, float]]]:
        raise FeatureBackendUnavailableError("down")


async def test_frequency_caps_fail_closed_when_counters_are_unavailable(tmp_path: Path) -> None:
    settings = IntelligenceSettings(
        environment="test",
        shared_secret=TEST_SHARED_SECRET,
        event_storage_uri=str(tmp_path / "data"),
        model_registry_path=tmp_path / "registry",
    )
    service = build_application_container(settings, UnavailableReadsBackend()).ad_selection_service

    def request(snapshot: dict[str, int]) -> AdSelectionRequest:
        return AdSelectionRequest.model_validate(
            {
                "placement": "feed",
                "viewer": build_viewer(),
                "organicItems": [],
                "candidates": [build_ad_candidate("ad_1", "adv_1", "cpc", 5000).model_dump(by_alias=True, mode="json")],
                "exchangeRates": [{"currency": "USD", "usdPerMajorUnit": "1.0"}],
                "viewerImpressionsTodayByCampaign": snapshot,
                "now": NOW.isoformat(),
            }
        )

    blind = await service.select_ads(request({}))
    assert [item.reason for item in blind.rejected] == ["frequency_unavailable"]
    informed = await service.select_ads(request({"campaign_ad_1": 0}))
    assert "frequency_unavailable" not in [item.reason for item in informed.rejected]


def test_unknown_integrity_is_not_treated_as_fully_trusted() -> None:
    candidates = FeedRankingRequest.model_validate(
        {"viewer": build_viewer(), "candidates": build_feed_candidates(NOW, 2), "now": NOW.isoformat()}
    ).candidates
    unknown = assess_candidate_integrity(candidates, {}, online_counters_available=False)
    assert all(item.trusted_engagement_share < 1.0 for item in unknown.values())


async def test_manipulated_engagement_suggestions_keep_their_real_score(
    application_container: Any,
) -> None:
    scores: list[float] = []

    class RecordingSuggestions:
        async def suggest_if_warranted(
            self, _account: str, _source: str, score: float, _reasons: list[RiskReason], _now: datetime
        ) -> bool:
            scores.append(score)
            return False

    ranking = application_container.feed_ranking_service
    ranking.suggestion_service = RecordingSuggestions()
    request = FeedRankingRequest.model_validate(
        {"viewer": build_viewer(), "candidates": build_feed_candidates(NOW, 1), "now": NOW.isoformat()}
    )
    assessment = IntegrityAssessment(0.4, True, 0.55, ("burst",))
    await ranking.flag_manipulated_authors(request, {request.candidates[0].item_id: assessment}, NOW)
    assert scores == [0.55]


def test_help_drafts_and_headlines_strip_markup() -> None:
    draft = draft_help_answer(
        HelpAnswerDraftRequest(
            category="payments",
            subject="<script>alert(1)</script> refund",
            question="How do I get a refund? [click](javascript:alert(1))",
            answer="Open the order and tap refund. <img src=x onerror=alert(1)>",
        )
    )
    rendered = f"{draft.title} {draft.answer_markdown}"
    assert "<" not in rendered
    assert ">" not in rendered
    assert "](" not in rendered
    assert "<" not in clean_post_text_for_headline("<img src=x onerror=alert(1)> big sale today")


@pytest.mark.parametrize(
    ("limit", "share", "expected"),
    [(10, 0.2, 2), (10, 0.9, 5), (4, 0.2, 1), (3, 0.1, 0)],
)
def test_exploration_slots_match_the_requested_share(limit: int, share: float, expected: int) -> None:
    assert len(calculate_exploration_slot_positions(limit, share)) == expected
