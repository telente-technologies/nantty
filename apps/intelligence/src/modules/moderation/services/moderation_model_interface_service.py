from typing import Protocol

from src.modules.moderation.dtos.content_moderation_dto import ModerationCategory, ModerationContentType


class ModerationModel(Protocol):
    version: str

    def classify(self, text: str, content_type: ModerationContentType) -> dict[ModerationCategory, float]: ...


class ModerationModelHolder:
    def __init__(self) -> None:
        self._model: ModerationModel | None = None

    def register_model(self, model: ModerationModel) -> None:
        self._model = model

    def clear_model(self) -> None:
        self._model = None

    @property
    def active_model(self) -> ModerationModel | None:
        return self._model
