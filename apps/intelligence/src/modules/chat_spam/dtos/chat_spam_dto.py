from typing import Literal

from pydantic import AwareDatetime, Field

from src.dtos.common_dto import ContractModel, RankingResponseMetadata
from src.modules.risk.dtos.risk_scoring_dto import RiskReason
from src.validators.common_field_validator import OpaqueIdentifier, UnitInterval


class SenderBehaviourMetadata(ContractModel):
    account_age_hours: float | None = Field(default=None, ge=0, le=1e6)
    messages_last_hour: int = Field(default=0, ge=0, le=1_000_000)
    messages_last_day: int = Field(default=0, ge=0, le=1_000_000)
    new_recipients_last_hour: int = Field(default=0, ge=0, le=1_000_000)
    distinct_recipients_last_day: int = Field(default=0, ge=0, le=1_000_000)
    recipient_reply_rate: UnitInterval | None = None
    block_rate: UnitInterval = 0.0
    report_rate: UnitInterval = 0.0
    links_sent_last_day: int = Field(default=0, ge=0, le=1_000_000)
    reported_links_count: int = Field(default=0, ge=0, le=1_000_000)
    device_account_count: int = Field(default=1, ge=0, le=100_000)
    ip_account_count: int = Field(default=1, ge=0, le=100_000)


class ChatSpamRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    sender_id: OpaqueIdentifier
    behaviour: SenderBehaviourMetadata = Field(default_factory=SenderBehaviourMetadata)
    use_stored_behaviour: bool = True
    now: AwareDatetime | None = None


class ChatSpamResponse(ContractModel):
    sender_id: str
    score: float
    level: Literal["low", "medium", "high"]
    recommended_action: Literal["allow", "throttle", "review"]
    reasons: list[RiskReason]
    suspension_suggested: bool
    metadata: RankingResponseMetadata
