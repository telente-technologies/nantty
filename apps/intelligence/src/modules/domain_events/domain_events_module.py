from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.domain_events.commands.process_domain_event_messages.process_domain_event_messages_handler import (
    ProcessDomainEventMessagesHandler,
)


class DomainEventsModule:
    module_id = "domain_events"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.command_bus.register_handler(
            ProcessDomainEventMessagesHandler(container.domain_event_consumer_service)
        )

    def build_router(self, _container: ApplicationContainer) -> APIRouter:
        return APIRouter(prefix="/v1", tags=["domain_events"])
