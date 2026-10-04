from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.help_content.dtos.help_answer_draft_dto import HelpAnswerDraftRequest


@dataclass(frozen=True, slots=True)
class DraftHelpAnswerQuery(Query):
    query_type: ClassVar[str] = "helpContent.draftHelpAnswer"
    request: HelpAnswerDraftRequest
