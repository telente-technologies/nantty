package integrations

import (
	"context"
	"sync"

	adserrors "nantty/modules/ads/src/errors"
)

type UnconfiguredFundingGateway struct{}

func (UnconfiguredFundingGateway) ChargeUserWalletForBoost(context.Context, string, string, int64, string) error {
	return adserrors.UpstreamUnavailable
}

func (UnconfiguredFundingGateway) ChargeEarningsForBoost(context.Context, string, string, int64, string) error {
	return adserrors.UpstreamUnavailable
}

func (UnconfiguredFundingGateway) RefundBoostCharge(context.Context, string, string, int64, string, string) error {
	return adserrors.UpstreamUnavailable
}

type InMemoryFundingGateway struct {
	mutex   sync.Mutex
	charged map[string]int64
}

func NewInMemoryFundingGateway() *InMemoryFundingGateway {
	return &InMemoryFundingGateway{charged: map[string]int64{}}
}

func (gateway *InMemoryFundingGateway) ChargeUserWalletForBoost(_ context.Context, userId, _ string, amountMinor int64, idempotencyKey string) error {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	if _, replay := gateway.charged[userId+idempotencyKey]; !replay {
		gateway.charged[userId+idempotencyKey] = amountMinor
	}
	return nil
}

func (gateway *InMemoryFundingGateway) ChargeEarningsForBoost(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey string) error {
	return gateway.ChargeUserWalletForBoost(ctx, userId, currency, amountMinor, idempotencyKey)
}

func (gateway *InMemoryFundingGateway) RefundBoostCharge(_ context.Context, userId, _ string, _ int64, _, debitIdempotencyKey string) error {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	delete(gateway.charged, userId+debitIdempotencyKey)
	return nil
}

func (gateway *InMemoryFundingGateway) ChargedAmount(userId, idempotencyKey string) (int64, bool) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	amount, found := gateway.charged[userId+idempotencyKey]
	return amount, found
}
