from datetime import datetime
from typing import Literal

from src.dtos.common_dto import ContractModel


class SuspensionEvidence(ContractModel):
    code: str
    weight: float


class SuspensionSuggestion(ContractModel):
    suggestion_id: str
    subject_type: Literal["account"] = "account"
    subject_id: str
    source: str
    score: float
    evidence: list[SuspensionEvidence]
    advisory_only: Literal[True] = True
    requires_human_review: Literal[True] = True
    appeal_path: str = "/account/status"
    generated_at: datetime
