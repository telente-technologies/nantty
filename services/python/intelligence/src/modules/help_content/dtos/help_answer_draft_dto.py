from pydantic import Field

from src.dtos.common_dto import ContractModel


class HelpAnswerDraftRequest(ContractModel):
    category: str = Field(min_length=1, max_length=40, pattern=r"^[a-z_]+$")
    locale: str = Field(default="en", min_length=2, max_length=5)
    subject: str = Field(min_length=1, max_length=300)
    question: str = Field(min_length=1, max_length=6000)
    answer: str = Field(min_length=1, max_length=12000)


class HelpAnswerDraftResponse(ContractModel):
    title: str
    summary: str
    question: str
    answer_markdown: str
    tags: list[str]
    source: str
    redacted_by_intelligence: int
