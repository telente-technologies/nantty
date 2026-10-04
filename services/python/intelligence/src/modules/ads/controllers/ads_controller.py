from src.modules.ads.dtos.ad_selection_dto import AdSelectionRequest, AdSelectionResponse
from src.modules.ads.queries.select_ads_for_placement.select_ads_for_placement_query import SelectAdsForPlacementQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class AdsController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def select_ads(self, request: AdSelectionRequest) -> AdSelectionResponse:
        response: AdSelectionResponse = await run_within_request_deadline(
            self.query_bus.execute(SelectAdsForPlacementQuery(request)), self.deadline_seconds
        )
        return response
