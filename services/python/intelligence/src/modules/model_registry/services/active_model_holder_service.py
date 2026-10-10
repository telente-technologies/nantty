import asyncio
import logging
from typing import Any

from src.modules.model_registry.models.model_bundle_model import REGISTERED_MODEL_NAMES, LoadedModel
from src.modules.model_registry.repositories.model_registry_repository import ModelRegistry

model_reload_logger = logging.getLogger("intelligence.model_reload")
MAXIMUM_CONSECUTIVE_REJECTIONS_BEFORE_ROLLBACK = 3


class ActiveModelHolder:
    def __init__(self, model_registry: ModelRegistry) -> None:
        self.model_registry = model_registry
        self._loaded_models: dict[str, LoadedModel] = {}
        self._consecutive_rejections: dict[str, int] = {}

    def get_loaded_model(self, model_name: str) -> LoadedModel | None:
        return self._loaded_models.get(model_name)

    def get_active_bundle(self, model_name: str) -> Any | None:
        loaded_model = self._loaded_models.get(model_name)
        return loaded_model.bundle if loaded_model else None

    def get_active_version(self, model_name: str) -> str | None:
        loaded_model = self._loaded_models.get(model_name)
        return loaded_model.version if loaded_model else None

    def consecutive_rejections(self, model_name: str) -> int:
        return self._consecutive_rejections.get(model_name, 0)

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

    def record_rejection(self, model_name: str) -> None:
        rejections = self._consecutive_rejections.get(model_name, 0) + 1
        self._consecutive_rejections[model_name] = rejections
        if rejections < MAXIMUM_CONSECUTIVE_REJECTIONS_BEFORE_ROLLBACK:
            return
        last_good = self.model_registry.read_last_good_version(model_name)
        active = self.model_registry.read_active_version(model_name)
        if last_good is None or last_good == active:
            return
        try:
            self.model_registry.activate_model_version(model_name, last_good)
        except Exception as rollback_error:
            model_reload_logger.error(
                "model_rollback_failed", extra={"model_name": model_name, "reason": str(rollback_error)}
            )
            return
        self._consecutive_rejections[model_name] = 0
        model_reload_logger.error(
            "model_rolled_back_to_last_good", extra={"model_name": model_name, "model_version": last_good}
        )

    def reload_changed_models_synchronously(self) -> list[str]:
        reloaded_model_names: list[str] = []
        for model_name in REGISTERED_MODEL_NAMES:
            try:
                active_version = self.model_registry.read_active_version(model_name)
                if active_version is None or active_version == self.get_active_version(model_name):
                    continue
                loaded_model = self.model_registry.load_model_version(model_name, active_version)
            except Exception as load_error:
                model_reload_logger.error(
                    "model_reload_rejected", extra={"model_name": model_name, "reason": str(load_error)}
                )
                self.record_rejection(model_name)
                continue
            self.install_loaded_model(loaded_model)
            self._consecutive_rejections[model_name] = 0
            try:
                self.model_registry.record_last_good_version(model_name, loaded_model.version)
            except Exception as record_error:
                model_reload_logger.error(
                    "model_last_good_record_failed",
                    extra={"model_name": model_name, "reason": str(record_error)},
                )
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
            try:
                await self.reload_changed_models()
            except asyncio.CancelledError:
                raise
            except Exception:
                model_reload_logger.exception("model_reload_loop_iteration_failed")
