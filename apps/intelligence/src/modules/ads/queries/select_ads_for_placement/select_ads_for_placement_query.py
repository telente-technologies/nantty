from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.ads.dtos.ad_selection_dto import AdSelectionRequest


@dataclass(frozen=True, slots=True)
class SelectAdsForPlacementQuery(Query):
    query_type: ClassVar[str] = "ads.selectAdsForPlacement"
    request: AdSelectionRequest
