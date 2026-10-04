import logging
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from src.enums.ranking_surface_enum import RankingSurface
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError
from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.repositories.feature_log_parquet_repository import FeatureLogParquetSink, LoggedFeatureRow
from src.repositories.online_feature_repository import OnlineFeatureStore

ranking_logger = logging.getLogger("intelligence.ranking")


def resolve_request_time(requested_now: datetime | None) -> datetime:
    if requested_now is None:
        return datetime.now(UTC)
    return requested_now.astimezone(UTC)


def resolve_request_identifier(requested_identifier: str | None) -> str:
    return requested_identifier or uuid.uuid4().hex


async def read_viewer_online_features_safely(
    feature_store: OnlineFeatureStore | None,
    viewer_user_id: str,
    account_ids: Sequence[str],
    topic_ids: Sequence[str],
    item_ids: Sequence[str],
    now: datetime,
    include_recently_seen_items: bool = True,
) -> tuple[ViewerOnlineFeatures, bool]:
    if feature_store is None:
        return ViewerOnlineFeatures(), True
    try:
        online_features = await feature_store.read_viewer_online_features(
            viewer_user_id, account_ids, topic_ids, item_ids, now, include_recently_seen_items
        )
    except FeatureBackendUnavailableError:
        ranking_logger.warning("online_features_unavailable")
        return ViewerOnlineFeatures(), True
    return online_features, False


def log_served_feature_rows(
    feature_log_sink: FeatureLogParquetSink | None,
    request_id: str,
    surface: RankingSurface,
    viewer_user_id: str,
    served_item_ids: Sequence[str],
    feature_rows_by_item: dict[str, list[float]],
    model_version: str | None,
    feature_schema_version: int,
    logged_at: datetime,
) -> None:
    if feature_log_sink is None:
        return
    feature_log_sink.append_feature_rows(
        [
            LoggedFeatureRow(
                request_id=request_id,
                surface=surface,
                actor_id=viewer_user_id,
                item_id=item_id,
                logged_at=logged_at,
                served_position=position,
                model_version=model_version,
                feature_schema_version=feature_schema_version,
                features=feature_rows_by_item[item_id],
            )
            for position, item_id in enumerate(served_item_ids)
        ]
    )
