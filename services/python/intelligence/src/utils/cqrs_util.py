from typing import Any

from src.errors.intelligence_error import HandlerNotRegisteredError
from src.interfaces.cqrs_interface import Command, CommandHandler, Query, QueryHandler


class CommandBus:
    def __init__(self) -> None:
        self._handlers: dict[str, CommandHandler[Any, Any]] = {}

    def register_handler(self, handler: CommandHandler[Any, Any]) -> None:
        self._handlers[handler.command_type] = handler

    async def execute(self, command: Command) -> Any:
        handler = self._handlers.get(command.command_type)
        if handler is None:
            raise HandlerNotRegisteredError(command.command_type)
        return await handler.execute(command)


class QueryBus:
    def __init__(self) -> None:
        self._handlers: dict[str, QueryHandler[Any, Any]] = {}

    def register_handler(self, handler: QueryHandler[Any, Any]) -> None:
        self._handlers[handler.query_type] = handler

    async def execute(self, query: Query) -> Any:
        handler = self._handlers.get(query.query_type)
        if handler is None:
            raise HandlerNotRegisteredError(query.query_type)
        return await handler.execute(query)
