from typing import Literal

from pydantic import Field

from src.dtos.common_dto import ContractModel
from src.validators.common_field_validator import OpaqueIdentifier

EligibilityTier = Literal["buy_now", "request", "blocked"]


class EligibilityThresholds(ContractModel):
    minimum_account_age_days: int = Field(default=90, ge=0, le=3650)
    minimum_real_followers: int = Field(default=1000, ge=0, le=100_000_000)
    no_violations_in_days: int = Field(default=90, ge=0, le=3650)
    minimum_completed_orders: int = Field(default=20, ge=0, le=1_000_000)
    minimum_success_rate_percent: int = Field(default=90, ge=0, le=100)


class VerificationEligibilityRequest(ContractModel):
    profile_id: OpaqueIdentifier
    color: Literal["blue", "gold"]
    account_age_days: int = Field(ge=0, le=100_000)
    real_followers: int = Field(default=0, ge=0, le=1_000_000_000)
    original_posts_last60_days: int = Field(default=0, ge=0, le=1_000_000)
    days_since_last_violation: int = Field(default=100_000, ge=0, le=100_000)
    fraud_score: int = Field(default=0, ge=0, le=100)
    risk_score: int = Field(default=0, ge=0, le=100)
    borderline_content: bool = False
    phone_verified: bool = False
    email_verified: bool = False
    account_restricted: bool = False
    completed_orders: int = Field(default=0, ge=0, le=100_000_000)
    success_rate_percent: int = Field(default=0, ge=0, le=100)
    has_active_store_or_brand_page: bool = False
    thresholds: EligibilityThresholds = EligibilityThresholds()


class VerificationEligibilityResponse(ContractModel):
    profile_id: str
    trust_score: int
    tier: EligibilityTier
    reasons: list[str]
    recheck_after_hours: int
    scoring_source: str
