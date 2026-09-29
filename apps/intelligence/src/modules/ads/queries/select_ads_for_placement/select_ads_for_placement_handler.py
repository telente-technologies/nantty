from src.interfaces.cqrs_interface import QueryHandler
from src.modules.ads.dtos.ad_selection_dto import AdSelectionResponse
from src.modules.ads.queries.select_ads_for_placement.select_ads_for_placement_query import SelectAdsForPlacementQuery
from src.modules.ads.services.ad_selection_service import AdSelectionService


class SelectAdsForPlacementHandler(QueryHandler[SelectAdsForPlacementQuery, AdSelectionResponse]):
    query_type = "ads.selectAdsForPlacement"

    def __init__(self, ad_selection_service: AdSelectionService) -> None:
        self.ad_selection_service = ad_selection_service

    async def execute(self, query: SelectAdsForPlacementQuery) -> AdSelectionResponse:
        return await self.ad_selection_service.select_ads(query.request)
