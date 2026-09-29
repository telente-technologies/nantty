from src.interfaces.cqrs_interface import QueryHandler
from src.modules.social_proof.dtos.social_proof_dto import SocialProofResponse
from src.modules.social_proof.queries.select_social_proof_banners.select_social_proof_banners_query import (
    SelectSocialProofBannersQuery,
)
from src.modules.social_proof.services.social_proof_service import SocialProofService


class SelectSocialProofBannersHandler(QueryHandler[SelectSocialProofBannersQuery, SocialProofResponse]):
    query_type = "social_proof.selectSocialProofBanners"

    def __init__(self, social_proof_service: SocialProofService) -> None:
        self.social_proof_service = social_proof_service

    async def execute(self, query: SelectSocialProofBannersQuery) -> SocialProofResponse:
        return await self.social_proof_service.select_social_proof(query.request)
