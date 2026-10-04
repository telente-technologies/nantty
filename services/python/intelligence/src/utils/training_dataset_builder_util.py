from dataclasses import dataclass
from datetime import timedelta

import numpy as np
import numpy.typing as npt
import polars as pl

from src.enums.ranking_surface_enum import RankingSurface
from src.integrations.dataset_storage_integration import DatasetStorageLocation
from src.utils.dataset_loading_util import (
    extract_payload_number,
    extract_payload_text,
    load_feature_logs,
    load_raw_events,
)

LABEL_ATTRIBUTION_WINDOW = timedelta(hours=24)
LONG_DWELL_MILLISECONDS = 8000


@dataclass(frozen=True)
class TrainingDataset:
    features: npt.NDArray[np.float64]
    labels: dict[str, npt.NDArray[np.int8]]
    group_ids: npt.NDArray[np.str_]
    logged_at_seconds: npt.NDArray[np.float64]

    @property
    def row_count(self) -> int:
        return int(self.features.shape[0])


def select_label_events(
    events: pl.DataFrame, event_types: list[str], item_key: pl.Expr, condition: pl.Expr
) -> pl.DataFrame:
    return (
        events.filter(pl.col("event_type").is_in(event_types))
        .with_columns(item_key.alias("item_key"))
        .filter(condition & pl.col("item_key").is_not_null())
        .select("actor_id", "item_key", "occurred_at")
    )


def attach_binary_label(
    logs: pl.DataFrame, label_events: pl.DataFrame, label_name: str, match_actor: bool = True
) -> pl.DataFrame:
    join_keys = ["actor_id", "item_key"] if match_actor else ["item_key"]
    candidate_events = label_events if match_actor else label_events.drop("actor_id")
    joined_rows = logs.select("row_id", "actor_id", "item_key", "logged_at").join(
        candidate_events, on=join_keys, how="inner"
    )
    if match_actor:
        joined_rows = joined_rows.filter(
            (pl.col("occurred_at") >= pl.col("logged_at"))
            & (pl.col("occurred_at") <= pl.col("logged_at") + LABEL_ATTRIBUTION_WINDOW)
        )
    matched_rows = joined_rows.select("row_id").unique().with_columns(pl.lit(1, dtype=pl.Int8).alias(label_name))
    return logs.join(matched_rows, on="row_id", how="left").with_columns(pl.col(label_name).fill_null(0))


def convert_logs_to_training_dataset(logs: pl.DataFrame, label_names: list[str], feature_count: int) -> TrainingDataset:
    if logs.height == 0:
        return TrainingDataset(
            np.zeros((0, feature_count)),
            {name: np.zeros(0, dtype=np.int8) for name in label_names},
            np.zeros(0, dtype=np.str_),
            np.zeros(0),
        )
    feature_matrix = np.asarray(logs.get_column("features").to_list(), dtype=np.float64).reshape(
        logs.height, feature_count
    )
    return TrainingDataset(
        features=feature_matrix,
        labels={name: logs.get_column(name).to_numpy().astype(np.int8) for name in label_names},
        group_ids=logs.get_column("request_id").to_numpy().astype(np.str_),
        logged_at_seconds=logs.get_column("logged_at").dt.epoch("ms").to_numpy().astype(np.float64) / 1000.0,
    )


def build_feed_training_dataset(
    location: DatasetStorageLocation, schema_version: int, feature_count: int
) -> TrainingDataset:
    logs = load_feature_logs(location, RankingSurface.FEED, schema_version).with_columns(
        pl.col("item_id").alias("item_key")
    )
    events = load_raw_events(
        location, ["post_viewed", "post_liked", "commented", "shared", "product_viewed", "added_to_cart", "purchased"]
    )
    post_key = extract_payload_text("$.postId")
    source_post_key = extract_payload_text("$.sourcePostId")
    dwell = extract_payload_number("$.dwellMs")
    label_specifications = [
        ("viewed", ["post_viewed"], post_key, pl.lit(value=True)),
        ("long_dwell", ["post_viewed"], post_key, dwell >= LONG_DWELL_MILLISECONDS),
        ("like", ["post_liked"], post_key, pl.lit(value=True)),
        ("comment", ["commented"], post_key, pl.lit(value=True)),
        ("share", ["shared"], post_key, pl.lit(value=True)),
        ("purchase_intent", ["product_viewed", "added_to_cart", "purchased"], source_post_key, pl.lit(value=True)),
    ]
    for label_name, event_types, item_key, condition in label_specifications:
        logs = attach_binary_label(logs, select_label_events(events, event_types, item_key, condition), label_name)
    logs = logs.filter(pl.col("viewed") == 1).sort("logged_at")
    return convert_logs_to_training_dataset(logs, [spec[0] for spec in label_specifications[1:]], feature_count)


def build_clip_training_dataset(
    location: DatasetStorageLocation, schema_version: int, feature_count: int
) -> TrainingDataset:
    logs = load_feature_logs(location, RankingSurface.CLIPS, schema_version).with_columns(
        pl.col("item_id").alias("item_key")
    )
    events = load_raw_events(location, ["clip_watched"])
    clip_key = extract_payload_text("$.clipId")
    watched = select_label_events(events, ["clip_watched"], clip_key, pl.lit(value=True))
    completed = select_label_events(
        events, ["clip_watched"], clip_key, extract_payload_number("$.watchFraction") >= 0.9
    )
    rewatched = select_label_events(events, ["clip_watched"], clip_key, extract_payload_number("$.loopCount") >= 1)
    logs = attach_binary_label(logs, watched, "watched")
    logs = attach_binary_label(logs, completed, "completion")
    logs = attach_binary_label(logs, rewatched, "rewatch")
    logs = logs.filter(pl.col("watched") == 1).sort("logged_at")
    return convert_logs_to_training_dataset(logs, ["completion", "rewatch"], feature_count)


def build_ad_click_training_dataset(
    location: DatasetStorageLocation, schema_version: int, feature_count: int
) -> TrainingDataset:
    logs = load_feature_logs(location, RankingSurface.ADS, schema_version).with_columns(
        pl.concat_str([pl.col("request_id"), pl.col("item_id")], separator="|").alias("item_key")
    )
    events = load_raw_events(location, ["ad_impression", "ad_click"])
    auction_ad_key = pl.concat_str([extract_payload_text("$.auctionId"), extract_payload_text("$.adId")], separator="|")
    logs = attach_binary_label(
        logs, select_label_events(events, ["ad_impression"], auction_ad_key, pl.lit(value=True)), "shown"
    )
    logs = attach_binary_label(
        logs, select_label_events(events, ["ad_click"], auction_ad_key, pl.lit(value=True)), "click"
    )
    logs = logs.filter(pl.col("shown") == 1).sort("logged_at")
    return convert_logs_to_training_dataset(logs, ["click"], feature_count)


def build_order_risk_training_dataset(
    location: DatasetStorageLocation, schema_version: int, feature_count: int
) -> TrainingDataset:
    logs = load_feature_logs(location, RankingSurface.RISK, schema_version).with_columns(
        pl.col("item_id").alias("item_key")
    )
    events = load_raw_events(location, ["risk_outcome_labeled"])
    subject_key = extract_payload_text("$.subjectId")
    order_subject = extract_payload_text("$.subjectType") == "order"
    labeled = select_label_events(events, ["risk_outcome_labeled"], subject_key, order_subject)
    fraud = select_label_events(
        events,
        ["risk_outcome_labeled"],
        subject_key,
        order_subject & (extract_payload_text("$.outcome") == "fraud_confirmed"),
    )
    logs = attach_binary_label(logs, labeled, "labeled", match_actor=False)
    logs = attach_binary_label(logs, fraud, "fraud", match_actor=False)
    logs = logs.filter(pl.col("labeled") == 1).unique(subset=["item_key"], keep="last").sort("logged_at")
    return convert_logs_to_training_dataset(logs, ["fraud"], feature_count)
