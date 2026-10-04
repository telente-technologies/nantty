from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.creator_eligibility.dtos.real_followers_dto import RealFollowersRequest


@dataclass(frozen=True, slots=True)
class EstimateRealFollowersQuery(Query):
    query_type: ClassVar[str] = "creatorEligibility.estimateRealFollowers"
    request: RealFollowersRequest
