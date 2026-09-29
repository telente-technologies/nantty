from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.clips.dtos.clip_ranking_dto import ClipRankingRequest


@dataclass(frozen=True, slots=True)
class RankClipCandidatesQuery(Query):
    query_type: ClassVar[str] = "clips.rankClipCandidates"
    request: ClipRankingRequest
