package services

import (
	"context"
	"math"
	"strings"
	"sync"
	"time"

	"zudomart/modules/ledger/src/databases"
)

type SellerReserveTerms struct {
	ReserveBps int64
	HoldFor    time.Duration
}

type SellerReservePolicy func(ctx context.Context, executor databases.ExecutorQuerier, sellerUserId string) (SellerReserveTerms, error)

var (
	sellerReservePolicyMutex sync.RWMutex
	sellerReservePolicy      SellerReservePolicy
)

func RegisterSellerReservePolicy(policy SellerReservePolicy) {
	sellerReservePolicyMutex.Lock()
	defer sellerReservePolicyMutex.Unlock()
	sellerReservePolicy = policy
}

func registeredSellerReservePolicy() SellerReservePolicy {
	sellerReservePolicyMutex.RLock()
	defer sellerReservePolicyMutex.RUnlock()
	return sellerReservePolicy
}

const sellerReserveSourcePrefix = "seller-reserve:"

func multiplyInt64WithoutOverflow(left, right int64) (int64, bool) {
	if left == 0 || right == 0 {
		return 0, true
	}
	if left > 0 {
		if (right > 0 && left > math.MaxInt64/right) || (right < 0 && right < math.MinInt64/left) {
			return 0, false
		}
	} else if (right > 0 && left < math.MinInt64/right) || (right < 0 && left < math.MaxInt64/right) {
		return 0, false
	}
	return left * right, true
}

func SellerReserveAmount(availableMinor, reserveBps int64) int64 {
	if availableMinor <= 0 || reserveBps <= 0 {
		return 0
	}
	bps := min(reserveBps, 10_000)
	reserve := availableMinor / 10_000 * bps
	remainderProduct, ok := multiplyInt64WithoutOverflow(availableMinor%10_000, bps)
	if !ok {
		return min(availableMinor, availableMinor)
	}
	reserve += (remainderProduct + 5_000) / 10_000
	return min(reserve, availableMinor)
}

func (balances SellerBalances) reserveForMaturity(ctx context.Context, executor databases.ExecutorQuerier, sellerUserId, sourceReference string, availableMinor int64) (SellerReserveTerms, int64, error) {
	policy := registeredSellerReservePolicy()
	if policy == nil || strings.HasPrefix(sourceReference, sellerReserveSourcePrefix) {
		return SellerReserveTerms{}, 0, nil
	}
	terms, err := policy(ctx, executor, sellerUserId)
	if err != nil {
		return SellerReserveTerms{}, 0, err
	}
	return terms, SellerReserveAmount(availableMinor, terms.ReserveBps), nil
}
