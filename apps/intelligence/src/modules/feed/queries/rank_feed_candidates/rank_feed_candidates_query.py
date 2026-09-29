from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.feed.dtos.feed_ranking_dto import FeedRankingRequest


@dataclass(frozen=True, slots=True)
class RankFeedCandidatesQuery(Query):
    query_type: ClassVar[str] = "feed.rankFeedCandidates"
    request: FeedRankingRequest
