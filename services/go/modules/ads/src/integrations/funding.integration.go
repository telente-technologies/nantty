package integrations

import (
	"context"
	"sync"

	adserrors "zudomart/modules/ads/src/errors"
)

type UnconfiguredFundingGateway struct{}

func (UnconfiguredFundingGateway) ChargeUserWalletForBoost(context.Context, string, string, int64, string) error {
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
