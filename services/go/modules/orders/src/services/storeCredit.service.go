package services

import (
	"slices"
	"time"

	"nantty/modules/orders/src/enums"
)

type CreditEntry struct {
	Kind        string
	AmountMinor int64
	ExpiresAt   *time.Time
	CreatedAt   time.Time
}

type CreditState struct {
	BalanceMinor          int64
	NextExpiryAt          *time.Time
	UnrecordedExpiryMinor int64
}

func ComputeCreditState(entries []CreditEntry, now time.Time) CreditState {
	grants := []*CreditEntry{}
	remaining := map[*CreditEntry]int64{}
	var consumed int64
	for index := range entries {
		entry := &entries[index]
		switch entry.Kind {
		case enums.CreditEarn, enums.CreditRestore:
			grants = append(grants, entry)
			remaining[entry] = entry.AmountMinor
		case enums.CreditRedeem, enums.CreditReverse, enums.CreditExpire:
			consumed += entry.AmountMinor
		}
	}
	slices.SortStableFunc(grants, func(left, right *CreditEntry) int {
		switch {
		case left.ExpiresAt == nil && right.ExpiresAt != nil:
			return 1
		case left.ExpiresAt != nil && right.ExpiresAt == nil:
			return -1
		case left.ExpiresAt != nil && !left.ExpiresAt.Equal(*right.ExpiresAt):
			return left.ExpiresAt.Compare(*right.ExpiresAt)
		}
		return left.CreatedAt.Compare(right.CreatedAt)
	})
	for _, grant := range grants {
		take := min(consumed, remaining[grant])
		remaining[grant] -= take
		consumed -= take
	}
	state := CreditState{}
	for _, grant := range grants {
		left := remaining[grant]
		if left == 0 {
			continue
		}
		if grant.ExpiresAt != nil && !grant.ExpiresAt.After(now) {
			state.UnrecordedExpiryMinor += left
			continue
		}
		state.BalanceMinor += left
		if grant.ExpiresAt != nil && (state.NextExpiryAt == nil || grant.ExpiresAt.Before(*state.NextExpiryAt)) {
			state.NextExpiryAt = grant.ExpiresAt
		}
	}
	return state
}

type RewardRules struct {
	Enabled           bool
	BasisPoints       int
	MinimumOrderMinor int64
	MaximumMinor      int64
}

func CalculateEarnedCreditMinor(rules RewardRules, discountedSubtotalMinor int64) int64 {
	if !rules.Enabled || rules.BasisPoints <= 0 || discountedSubtotalMinor < rules.MinimumOrderMinor || discountedSubtotalMinor <= 0 {
		return 0
	}
	earned := (discountedSubtotalMinor*int64(rules.BasisPoints) + 5_000) / 10_000
	if rules.MaximumMinor > 0 && earned > rules.MaximumMinor {
		earned = rules.MaximumMinor
	}
	return earned
}

func RedeemableCreditMinor(balanceMinor, subtotalMinor int64) int64 {
	return max(min(balanceMinor, subtotalMinor-1), 0)
}

func ProportionalReversalMinor(earnedMinor, alreadyReversedMinor, refundedMinor, totalMinor, balanceMinor int64) int64 {
	if totalMinor <= 0 || earnedMinor <= 0 {
		return 0
	}
	target := earnedMinor * min(refundedMinor, totalMinor) / totalMinor
	return max(min(target-alreadyReversedMinor, balanceMinor), 0)
}
