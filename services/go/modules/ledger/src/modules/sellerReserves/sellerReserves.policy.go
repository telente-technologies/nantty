package sellerreserves

import (
	"context"
	"math"
	"sync"
	"time"

	"zudomart/modules/ledger/src/databases"
)

type Terms struct {
	ReserveBps int64
	HoldFor    time.Duration
}

type Policy func(ctx context.Context, executor databases.ExecutorQuerier, sellerUserId string) (Terms, error)

var (
	policyMutex sync.RWMutex
	registered  Policy
)

func RegisterPolicy(policy Policy) {
	policyMutex.Lock()
	defer policyMutex.Unlock()
	registered = policy
}

func TermsFor(ctx context.Context, executor databases.ExecutorQuerier, sellerUserId string) (Terms, error) {
	policyMutex.RLock()
	policy := registered
	policyMutex.RUnlock()
	if policy == nil {
		return Terms{}, nil
	}
	return policy(ctx, executor, sellerUserId)
}

func multiplyWithoutOverflow(left, right int64) (int64, bool) {
	if left == 0 || right == 0 {
		return 0, true
	}
	if left > math.MaxInt64/right {
		return 0, false
	}
	return left * right, true
}

func ReserveAmount(availableMinor, reserveBps int64) int64 {
	if availableMinor <= 0 || reserveBps <= 0 {
		return 0
	}
	bps := min(reserveBps, 10_000)
	reserve := availableMinor / 10_000 * bps
	remainderProduct, ok := multiplyWithoutOverflow(availableMinor%10_000, bps)
	if !ok {
		return availableMinor
	}
	reserve += (remainderProduct + 5_000) / 10_000
	return min(reserve, availableMinor)
}
