from abc import ABC, abstractmethod
from typing import ClassVar


class Command:
    command_type: ClassVar[str]


class Query:
    query_type: ClassVar[str]


class CommandHandler[CommandType: Command, ResultType](ABC):
    command_type: ClassVar[str]

    @abstractmethod
    async def execute(self, command: CommandType) -> ResultType:
        pass


class QueryHandler[QueryType: Query, ResultType](ABC):
    query_type: ClassVar[str]

    @abstractmethod
    async def execute(self, query: QueryType) -> ResultType:
        pass
