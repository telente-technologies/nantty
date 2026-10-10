import argparse
import json
import sys
from datetime import timedelta
from pathlib import Path
from typing import Any

from src.configs.settings_config import load_intelligence_settings
from src.integrations.dataset_storage_integration import (
    DatasetStorageLocation,
    build_dataset_storage_location,
    build_local_dataset_storage_location,
)
from src.jobs.compact_datasets_job import compact_small_parquet_files
from src.jobs.generate_synthetic_data_job import run_synthetic_data_generation
from src.jobs.train_item_similarity_job import train_item_similarity_model
from src.jobs.train_ranking_classifiers_job import CLASSIFIER_TRAINING_SPECIFICATIONS, train_classifier_model
from src.loggers.structured_json_logger import configure_structured_logging
from src.modules.model_registry.repositories.model_registry_repository import ModelRegistry

TRAINABLE_MODEL_NAMES = [*CLASSIFIER_TRAINING_SPECIFICATIONS, "item_similarity"]


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="zudomart-intelligence-pipeline")
    parser.add_argument("--storage", help="local dataset directory overriding INTELLIGENCE_EVENT_STORAGE_URI")
    parser.add_argument("--registry", help="model registry directory overriding INTELLIGENCE_MODEL_REGISTRY_PATH")
    subcommands = parser.add_subparsers(dest="command", required=True)
    synthetic = subcommands.add_parser("generate-synthetic-data", help="write a small synthetic event dataset")
    synthetic.add_argument("--users", type=int, default=40)
    synthetic.add_argument("--sessions-per-user", type=int, default=4)
    synthetic.add_argument("--seed", type=int, default=7)
    train = subcommands.add_parser("train", help="train, evaluate and register models")
    train.add_argument("--model", choices=[*TRAINABLE_MODEL_NAMES, "all"], default="all")
    train.add_argument("--force-activation", action="store_true", help="activate even if the quality gate fails")
    compact = subcommands.add_parser("compact", help="merge small parquet files in closed partitions")
    compact.add_argument("--skip-newer-than-days", type=int, default=1)
    activate = subcommands.add_parser("activate", help="point a model at a registered version")
    activate.add_argument("--model", choices=TRAINABLE_MODEL_NAMES, required=True)
    activate.add_argument("--version", required=True)
    return parser


def resolve_storage_and_registry(arguments: argparse.Namespace) -> tuple[DatasetStorageLocation, ModelRegistry]:
    settings = load_intelligence_settings()
    location = (
        build_local_dataset_storage_location(arguments.storage)
        if arguments.storage
        else build_dataset_storage_location(settings)
    )
    registry_path = Path(arguments.registry) if arguments.registry else settings.model_registry_path
    return location, ModelRegistry(
        registry_path, settings.model_signing_secret.get_secret_value(), settings.environment
    )


def train_requested_models(
    location: DatasetStorageLocation, registry: ModelRegistry, model_name: str, force_activation: bool
) -> list[dict[str, Any]]:
    requested = TRAINABLE_MODEL_NAMES if model_name == "all" else [model_name]
    results: list[dict[str, Any]] = []
    for name in requested:
        if name == "item_similarity":
            results.append(train_item_similarity_model(location, registry, force_activation))
        else:
            results.append(
                train_classifier_model(location, registry, CLASSIFIER_TRAINING_SPECIFICATIONS[name], force_activation)
            )
    return results


def main(argument_values: list[str] | None = None) -> int:
    arguments = build_argument_parser().parse_args(argument_values)
    configure_structured_logging("WARNING")
    if arguments.command == "generate-synthetic-data":
        storage_directory = Path(arguments.storage or load_intelligence_settings().event_storage_uri)
        run_synthetic_data_generation(storage_directory, arguments.users, arguments.sessions_per_user, arguments.seed)
        return 0
    location, registry = resolve_storage_and_registry(arguments)
    if arguments.command == "train":
        results = train_requested_models(location, registry, arguments.model, arguments.force_activation)
        sys.stdout.write(json.dumps(results, indent=2, default=str) + "\n")
        return 0
    if arguments.command == "compact":
        compacted = compact_small_parquet_files(location, timedelta(days=arguments.skip_newer_than_days))
        sys.stdout.write(json.dumps(compacted) + "\n")
        return 0
    registry.activate_model_version(arguments.model, arguments.version)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
