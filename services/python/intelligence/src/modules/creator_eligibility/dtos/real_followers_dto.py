from pydantic import AwareDatetime, Field

from src.dtos.common_dto import ContractModel, RankingResponseMetadata
from src.validators.common_field_validator import OpaqueIdentifier


class FollowerSignals(ContractModel):
    follower_id: OpaqueIdentifier
    account_age_days: float = Field(ge=0, le=100_000)
    has_profile_photo: bool = False
    post_count: int = Field(default=0, ge=0, le=10_000_000)
    active_days_last_30: int = Field(default=0, ge=0, le=30)
    followed_account_count: int = Field(default=0, ge=0, le=10_000_000)
    device_cluster_size: int = Field(default=1, ge=0, le=100_000)
    signup_burst_size: int = Field(default=1, ge=0, le=1_000_000)


class RealFollowersRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    creator_id: OpaqueIdentifier
    followers: list[FollowerSignals] = Field(max_length=5000)
    total_follower_count: int | None = Field(default=None, ge=0, le=1_000_000_000)
    now: AwareDatetime | None = None


class RealFollowersResponse(ContractModel):
    creator_id: str
    sampled_followers: int
    estimated_real_ratio: float
    estimated_real_followers: int
    real_followers_lower_bound: int
    suspicious_followers: int
    top_reasons: list[str]
    metadata: RankingResponseMetadata
