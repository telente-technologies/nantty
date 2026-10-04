from datetime import datetime
from typing import Literal

from pydantic import Field

from src.dtos.common_dto import ContractModel

SocialSensitiveLabel = Literal["nudity", "graphic_violence", "dangerous_acts", "self_harm"]


class SensitiveLabelScore(ContractModel):
    label: SocialSensitiveLabel
    score: float = Field(ge=0.0, le=1.0)


class SensitivityAdvisedData(ContractModel):
    target_type: Literal["post", "clip"]
    target_id: str
    owner_id: str
    media_id: str | None = None
    scores: list[SensitiveLabelScore]
    confidence: float = Field(ge=0.0, le=1.0)
    model_version: str
    advisory_only: Literal[True] = True


class SensitivityAdvisedEvent(ContractModel):
    id: str
    type: Literal["content.sensitivityAdvised"] = "content.sensitivityAdvised"
    source: Literal["intelligence"] = "intelligence"
    subject: str
    schema_version: Literal[1] = 1
    occurred_at: datetime
    data: SensitivityAdvisedData
