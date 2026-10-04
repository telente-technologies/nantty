import json
import os
import pickle
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import sklearn

from src.modules.model_registry.models.model_bundle_model import LoadedModel
from src.utils.artifact_integrity_util import calculate_file_sha256_hex, sign_artifact_digest, verify_artifact_integrity

ARTIFACT_FILE_NAME = "artifact.pkl"
METADATA_FILE_NAME = "metadata.json"
ACTIVE_POINTER_FILE_NAME = "ACTIVE"
VERSION_PATTERN = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")


class ModelArtifactRejectedError(RuntimeError):
    pass


def build_new_model_version(created_at: datetime, artifact_sha256_hex: str) -> str:
    return f"{created_at.astimezone(UTC).strftime('%Y%m%dT%H%M%SZ')}-{artifact_sha256_hex[:8]}"


def write_text_file_atomically(target_path: Path, content: str) -> None:
    temporary_path = target_path.with_name(f".{target_path.name}.tmp")
    temporary_path.write_text(content, encoding="utf-8")
    os.replace(temporary_path, target_path)


class ModelRegistry:
    def __init__(self, registry_root: Path, signing_secret: str) -> None:
        self.registry_root = registry_root
        self.signing_secret = signing_secret

    def model_directory(self, model_name: str) -> Path:
        return self.registry_root / model_name

    def register_model_version(
        self, model_name: str, bundle: Any, metadata: dict[str, Any], created_at: datetime
    ) -> str:
        staging_directory = self.model_directory(model_name) / f".staging-{os.getpid()}"
        staging_directory.mkdir(parents=True, exist_ok=True)
        staging_artifact_path = staging_directory / ARTIFACT_FILE_NAME
        with staging_artifact_path.open("wb") as artifact_file:
            pickle.dump(bundle, artifact_file, protocol=pickle.HIGHEST_PROTOCOL)
        artifact_sha256_hex = calculate_file_sha256_hex(staging_artifact_path)
        version = build_new_model_version(created_at, artifact_sha256_hex)
        complete_metadata = {
            **metadata,
            "modelName": model_name,
            "version": version,
            "createdAt": created_at.astimezone(UTC).isoformat(),
            "artifactSha256": artifact_sha256_hex,
            "artifactSignature": (
                sign_artifact_digest(self.signing_secret, artifact_sha256_hex) if self.signing_secret else None
            ),
        }
        (staging_directory / METADATA_FILE_NAME).write_text(
            json.dumps(complete_metadata, indent=2, sort_keys=True), encoding="utf-8"
        )
        os.replace(staging_directory, self.model_directory(model_name) / version)
        return version

    def read_active_version(self, model_name: str) -> str | None:
        pointer_path = self.model_directory(model_name) / ACTIVE_POINTER_FILE_NAME
        if not pointer_path.is_file():
            return None
        version = pointer_path.read_text(encoding="utf-8").strip()
        return version if VERSION_PATTERN.match(version) else None

    def activate_model_version(self, model_name: str, version: str) -> None:
        if not VERSION_PATTERN.match(version) or not (self.model_directory(model_name) / version).is_dir():
            raise ModelArtifactRejectedError(f"unknown version {version} for {model_name}")
        write_text_file_atomically(self.model_directory(model_name) / ACTIVE_POINTER_FILE_NAME, version)

    def read_version_metadata(self, model_name: str, version: str) -> dict[str, Any]:
        metadata_path = self.model_directory(model_name) / version / METADATA_FILE_NAME
        loaded_metadata: dict[str, Any] = json.loads(metadata_path.read_text(encoding="utf-8"))
        return loaded_metadata

    def load_model_version(self, model_name: str, version: str) -> LoadedModel:
        if not VERSION_PATTERN.match(version):
            raise ModelArtifactRejectedError("malformed version")
        version_directory = self.model_directory(model_name) / version
        metadata = self.read_version_metadata(model_name, version)
        integrity_failure = verify_artifact_integrity(
            version_directory / ARTIFACT_FILE_NAME,
            str(metadata.get("artifactSha256", "")),
            self.signing_secret,
            metadata.get("artifactSignature"),
        )
        if integrity_failure is not None:
            raise ModelArtifactRejectedError(integrity_failure)
        trained_with_version = metadata.get("environment", {}).get("scikitLearn")
        if trained_with_version is not None and trained_with_version != sklearn.__version__:
            raise ModelArtifactRejectedError("incompatible_scikit_learn_version")
        with (version_directory / ARTIFACT_FILE_NAME).open("rb") as artifact_file:
            bundle = pickle.load(artifact_file)  # noqa: S301 - digest and HMAC verified above
        return LoadedModel(model_name, version, metadata, bundle)

    def list_registered_versions(self, model_name: str) -> list[str]:
        directory = self.model_directory(model_name)
        if not directory.is_dir():
            return []
        return sorted(entry.name for entry in directory.iterdir() if VERSION_PATTERN.match(entry.name))
