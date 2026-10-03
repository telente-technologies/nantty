from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.chat_spam.dtos.chat_spam_dto import ChatSpamRequest


@dataclass(frozen=True, slots=True)
class ScoreChatSpamQuery(Query):
    query_type: ClassVar[str] = "chatSpam.scoreChatSpam"
    request: ChatSpamRequest
