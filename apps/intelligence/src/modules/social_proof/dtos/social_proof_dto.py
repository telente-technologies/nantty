from pydantic import AwareDatetime, Field

from src.dtos.common_dto import ContractModel, RankingResponseMetadata, ViewerContext
from src.modules.feed.dtos.feed_ranking_dto import FeedRankingOptions, FriendEngagement, SocialProofBanner
from src.validators.common_field_validator import MAXIMUM_RANKING_CANDIDATES, OpaqueIdentifier


class SocialProofItem(ContractModel):
    item_id: OpaqueIdentifier
    author_id: OpaqueIdentifier
    store_id: OpaqueIdentifier | None = None
    friend_engagements: list[FriendEngagement] = Field(default_factory=list, max_length=50)


class SocialProofRequest(ContractModel):
    viewer: ViewerContext
    ordered_items: list[SocialProofItem] = Field(max_length=MAXIMUM_RANKING_CANDIDATES)
    options: FeedRankingOptions = Field(default_factory=FeedRankingOptions)
    now: AwareDatetime | None = None


class SocialProofSelectionItem(ContractModel):
    item_id: OpaqueIdentifier
    position: int
    banner: SocialProofBanner


class SocialProofResponse(ContractModel):
    selections: list[SocialProofSelectionItem]
    metadata: RankingResponseMetadata
