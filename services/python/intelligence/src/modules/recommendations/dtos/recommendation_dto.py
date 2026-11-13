from typing import Literal

from pydantic import AwareDatetime, Field

from src.dtos.common_dto import ContractModel, MoneyAmount, RankingResponseMetadata, ViewerContext
from src.modules.clips.dtos.clip_ranking_dto import ClipCandidate
from src.validators.common_field_validator import (
    MAXIMUM_RANKING_CANDIDATES,
    MAXIMUM_TOPICS_PER_ITEM,
    CountryCode,
    NonNegativeCount,
    OpaqueIdentifier,
    TopicSlug,
)

ProductRecommendationSurface = Literal["similar", "bought_together", "featured_with", "mart_home", "for_you", "clips"]


class ProductCandidate(ContractModel):
    product_id: OpaqueIdentifier
    store_id: OpaqueIdentifier
    category_id: OpaqueIdentifier | None = None
    topics: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)
    price: MoneyAmount | None = None
    rating: float | None = Field(default=None, ge=0.0, le=5.0)
    sales_count: NonNegativeCount = 0
    view_count: NonNegativeCount = 0
    country: CountryCode | None = None
    store_verified: bool = False
    in_stock: bool = True


class ProductRecommendationRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    surface: ProductRecommendationSurface
    viewer: ViewerContext
    personalization_allowed: bool = False
    anchor_product: ProductCandidate | None = None
    candidates: list[ProductCandidate] = Field(default_factory=list, max_length=MAXIMUM_RANKING_CANDIDATES)
    excluded_product_ids: list[OpaqueIdentifier] = Field(default_factory=list, max_length=1000)
    limit: int = Field(default=20, ge=1, le=100)
    now: AwareDatetime | None = None


class ProductCandidateRecallRequest(ContractModel):
    viewer: ViewerContext
    personalization_allowed: bool = False
    limit: int = Field(default=50, ge=1, le=100)
    now: AwareDatetime | None = None


class ProductCandidateRecallResponse(ContractModel):
    item_ids: list[OpaqueIdentifier]


class RecommendedItem(ContractModel):
    item_id: str
    score: float
    reason: str


class RecommendationResponse(ContractModel):
    items: list[RecommendedItem]
    metadata: RankingResponseMetadata


class AccountCandidate(ContractModel):
    account_id: OpaqueIdentifier
    kind: Literal["user", "store"]
    mutual_follow_count: NonNegativeCount = 0
    follower_count: NonNegativeCount = 0
    topics: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)
    country: CountryCode | None = None
    is_verified: bool = False


class AccountRecommendationRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    viewer: ViewerContext
    candidates: list[AccountCandidate] = Field(max_length=MAXIMUM_RANKING_CANDIDATES)
    limit: int = Field(default=20, ge=1, le=100)
    now: AwareDatetime | None = None


class ClipSuggestionRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    viewer: ViewerContext
    candidates: list[ClipCandidate] = Field(default_factory=list, max_length=MAXIMUM_RANKING_CANDIDATES)
    limit: int = Field(default=20, ge=1, le=100)
    now: AwareDatetime | None = None
