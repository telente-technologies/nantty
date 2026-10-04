import asyncio
import logging
from typing import Any

from src.modules.model_registry.models.model_bundle_model import REGISTERED_MODEL_NAMES, LoadedModel
from src.modules.model_registry.repositories.model_registry_repository import ModelArtifactRejectedError, ModelRegistry

model_reload_logger = logging.getLogger("intelligence.model_reload")


class ActiveModelHolder:
    def __init__(self, model_registry: ModelRegistry) -> None:
        self.model_registry = model_registry
        self._loaded_models: dict[str, LoadedModel] = {}

    def get_loaded_model(self, model_name: str) -> LoadedModel | None:
        return self._loaded_models.get(model_name)

    def get_active_bundle(self, model_name: str) -> Any | None:
        loaded_model = self._loaded_models.get(model_name)
        return loaded_model.bundle if loaded_model else None

    def get_active_version(self, model_name: str) -> str | None:
        loaded_model = self._loaded_models.get(model_name)
        return loaded_model.version if loaded_model else None

    def describe_loaded_models(self) -> dict[str, dict[str, Any]]:
        return {
            model_name: {
                "version": loaded_model.version,
                "createdAt": loaded_model.metadata.get("createdAt"),
                "metrics": loaded_model.metadata.get("metrics", {}),
            }
            for model_name, loaded_model in self._loaded_models.items()
        }

    def install_loaded_model(self, loaded_model: LoadedModel) -> None:
        self._loaded_models = {**self._loaded_models, loaded_model.model_name: loaded_model}

    def reload_changed_models_synchronously(self) -> list[str]:
        reloaded_model_names: list[str] = []
        for model_name in REGISTERED_MODEL_NAMES:
            try:
                active_version = self.model_registry.read_active_version(model_name)
                if active_version is None or active_version == self.get_active_version(model_name):
                    continue
                loaded_model = self.model_registry.load_model_version(model_name, active_version)
            except (ModelArtifactRejectedError, OSError, ValueError) as load_error:
                model_reload_logger.error(
                    "model_reload_rejected", extra={"model_name": model_name, "reason": str(load_error)}
                )
                continue
            self.install_loaded_model(loaded_model)
            reloaded_model_names.append(model_name)
            model_reload_logger.info(
                "model_activated", extra={"model_name": model_name, "model_version": loaded_model.version}
            )
        return reloaded_model_names

    async def reload_changed_models(self) -> list[str]:
        return await asyncio.to_thread(self.reload_changed_models_synchronously)

    async def run_periodic_reload_loop(self, reload_interval_seconds: float) -> None:
        while True:
            await asyncio.sleep(reload_interval_seconds)
            await self.reload_changed_models()
