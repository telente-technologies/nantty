package interfaces

import (
	"context"

	"github.com/google/uuid"
)

type ProductRankingCandidate struct {
	ProductId     string
	StoreId       string
	CategoryId    string
	Topics        []string
	PriceMinor    int64
	Currency      string
	Rating        float64
	SalesCount    int
	Country       string
	StoreVerified bool
	InStock       bool
}

type ProductRecommender interface {
	RecallProductIds(ctx context.Context, viewerId uuid.UUID, personalizationAllowed bool, limit int) ([]string, error)
	RankProducts(ctx context.Context, viewerId uuid.UUID, personalizationAllowed bool, country string, surface string, candidates []ProductRankingCandidate) ([]string, error)
}
