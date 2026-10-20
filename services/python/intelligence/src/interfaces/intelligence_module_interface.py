from typing import TYPE_CHECKING, Protocol

from fastapi import APIRouter

if TYPE_CHECKING:
    from src.container import ApplicationContainer


class IntelligenceModule(Protocol):
    module_id: str

    def register_handlers(self, container: ApplicationContainer) -> None:
        pass

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        pass
