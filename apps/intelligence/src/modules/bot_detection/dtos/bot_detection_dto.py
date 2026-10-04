from typing import Literal

from pydantic import AwareDatetime, Field

from src.dtos.common_dto import ContractModel, RankingResponseMetadata
from src.modules.risk.dtos.risk_scoring_dto import RiskReason
from src.validators.common_field_validator import OpaqueIdentifier, UnitInterval

HeadlessSignal = Literal[
    "webdriver",
    "headless_user_agent",
    "no_languages",
    "zero_plugins",
    "automation_globals",
    "emulator",
    "rooted_or_jailbroken",
]
AttestationVerdict = Literal["passed", "failed", "unavailable", "not_supplied"]


class RequestCadenceMetadata(ContractModel):
    requests_last_minute: int = Field(default=0, ge=0, le=1_000_000)
    median_interval_ms: float | None = Field(default=None, ge=0, le=1e9)
    interval_coefficient_of_variation: float | None = Field(default=None, ge=0, le=100)
    active_hours_last_day: int = Field(default=0, ge=0, le=24)


class BotBehaviourMetadata(ContractModel):
    account_age_hours: float | None = Field(default=None, ge=0, le=1e6)
    cadence: RequestCadenceMetadata = Field(default_factory=RequestCadenceMetadata)
    headless_signals: list[HeadlessSignal] = Field(default_factory=list, max_length=10)
    attestation_verdict: AttestationVerdict = "not_supplied"
    follows_last_hour: int = Field(default=0, ge=0, le=1_000_000)
    likes_last_hour: int = Field(default=0, ge=0, le=1_000_000)
    comments_last_hour: int = Field(default=0, ge=0, le=1_000_000)
    duplicate_comment_share: UnitInterval = 0.0
    engagement_manipulation_share: UnitInterval = 0.0
    device_account_count: int = Field(default=1, ge=0, le=100_000)
    ip_account_count: int = Field(default=1, ge=0, le=100_000)


class BotScoreRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    account_id: OpaqueIdentifier
    behaviour: BotBehaviourMetadata = Field(default_factory=BotBehaviourMetadata)
    now: AwareDatetime | None = None


class BotScoreResponse(ContractModel):
    account_id: str
    score: float
    level: Literal["low", "medium", "high"]
    reasons: list[RiskReason]
    advisory_only: Literal[True] = True
    published_to_trust: bool
    metadata: RankingResponseMetadata


class BotScoreAdvisory(ContractModel):
    score_id: str
    account_id: str
    score: float
    reason_codes: list[str]
    model_version: str
    advisory_only: Literal[True] = True
    generated_at: AwareDatetime
