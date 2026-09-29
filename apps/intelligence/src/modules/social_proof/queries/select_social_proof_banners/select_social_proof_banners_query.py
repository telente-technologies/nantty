from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.social_proof.dtos.social_proof_dto import SocialProofRequest


@dataclass(frozen=True, slots=True)
class SelectSocialProofBannersQuery(Query):
    query_type: ClassVar[str] = "social_proof.selectSocialProofBanners"
    request: SocialProofRequest
