from src.interfaces.cqrs_interface import CommandHandler
from src.modules.domain_events.commands.process_domain_event_messages.process_domain_event_messages_command import (
    ProcessDomainEventMessagesCommand,
)
from src.modules.domain_events.services.domain_event_consumer_service import (
    DomainEventConsumerService,
    DomainEventProcessingOutcome,
)


class ProcessDomainEventMessagesHandler(
    CommandHandler[ProcessDomainEventMessagesCommand, list[DomainEventProcessingOutcome]]
):
    command_type = "domainEvents.processDomainEventMessages"

    def __init__(self, consumer: DomainEventConsumerService) -> None:
        self.consumer = consumer

    async def execute(self, command: ProcessDomainEventMessagesCommand) -> list[DomainEventProcessingOutcome]:
        return [await self.consumer.process_message_body(body) for body in command.message_bodies]
