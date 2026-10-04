from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Command


@dataclass(frozen=True, slots=True)
class ProcessDomainEventMessagesCommand(Command):
    command_type: ClassVar[str] = "domainEvents.processDomainEventMessages"
    message_bodies: tuple[str, ...]
