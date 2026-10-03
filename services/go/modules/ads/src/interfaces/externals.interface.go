package interfaces

import (
	"context"

	"zudomart/modules/ads/src/types"
)

type ConsentReader interface {
	PersonalizedAdsEnabled(ctx context.Context, userId string) (bool, error)
}

type ContentSignalReader interface {
	FindContentSignal(ctx context.Context, contentId string) (types.ContentSignal, bool, error)
}

type PctrScorer interface {
	ScorePredictedClickRatesInPpm(ctx context.Context, request types.PctrRequest) (map[string]int64, error)
}

type FraudModelScorer interface {
	ScoreAdEvent(ctx context.Context, impressionId, userId, eventKind string) (*float64, error)
}

type FundingGateway interface {
	ChargeUserWalletForBoost(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey string) error
}
