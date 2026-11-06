package models

import (
	"errors"
	"math/bits"
	"sort"
)

const MaximumCreatorGiftShareBps = 7000

var (
	ErrInvalidGiftAmount = errors.New("gift quantity or price is out of range")
	ErrInvalidDonation   = errors.New("space coin donation amount is out of range")
	ErrInvalidCoinFeeBps = errors.New("coin platform fee must be between 0 and 10000 basis points")
	ErrUnknownWinner     = errors.New("the winner is not a battle participant")
)

type GiftSplit struct {
	TotalCoins         int64
	CreatorAmountCoins int64
	PlatformFeeCoins   int64
	CreatorShareBps    int64
}

func SplitGiftCoins(quantity, unitPriceCoins, creatorShareBps int64) (GiftSplit, error) {
	if quantity < 1 || quantity > 100 || unitPriceCoins <= 0 {
		return GiftSplit{}, ErrInvalidGiftAmount
	}
	high, total := bits.Mul64(uint64(quantity), uint64(unitPriceCoins))
	if high != 0 || total > 1<<62 {
		return GiftSplit{}, ErrInvalidGiftAmount
	}
	share := min(max(creatorShareBps, 0), MaximumCreatorGiftShareBps)
	coins := int64(total)
	creator := coins/10_000*share + coins%10_000*share/10_000
	return GiftSplit{TotalCoins: coins, CreatorAmountCoins: creator, PlatformFeeCoins: coins - creator, CreatorShareBps: share}, nil
}

// SplitSpaceDonationCoins validates a server-bounded coin amount and computes
// the existing creator/platform share without multiplying the full amount.
func SplitSpaceDonationCoins(coins, creatorShareBps, minimumCoins, maximumCoins int64) (GiftSplit, error) {
	if minimumCoins < 1 || maximumCoins < minimumCoins || maximumCoins > 1<<62 || coins < minimumCoins || coins > maximumCoins {
		return GiftSplit{}, ErrInvalidDonation
	}
	share := min(max(creatorShareBps, int64(0)), int64(MaximumCreatorGiftShareBps))
	creator := coins/10_000*share + coins%10_000*share/10_000
	return GiftSplit{TotalCoins: coins, CreatorAmountCoins: creator, PlatformFeeCoins: coins - creator, CreatorShareBps: share}, nil
}

// SplitCoinsByPlatformFeeBps applies a fixed platform fee and gives the
// remainder to the recipient. Quotient/remainder arithmetic avoids overflow
// from multiplying an arbitrary coin amount by basis points.
func SplitCoinsByPlatformFeeBps(coins, platformFeeBps int64) (GiftSplit, error) {
	if coins <= 0 {
		return GiftSplit{}, ErrInvalidDonation
	}
	if platformFeeBps < 0 || platformFeeBps > 10_000 {
		return GiftSplit{}, ErrInvalidCoinFeeBps
	}
	platformFee := coins/10_000*platformFeeBps + coins%10_000*platformFeeBps/10_000
	return GiftSplit{
		TotalCoins:         coins,
		CreatorAmountCoins: coins - platformFee,
		PlatformFeeCoins:   platformFee,
		CreatorShareBps:    10_000 - platformFeeBps,
	}, nil
}

type ParticipantOutcome string

const (
	OutcomeActive        ParticipantOutcome = "active"
	OutcomeForfeited     ParticipantOutcome = "forfeited"
	OutcomeRemovedByHost ParticipantOutcome = "removedByHost"
)

type BattleHolding struct {
	UserId       string
	Outcome      ParticipantOutcome
	HoldingCoins int64
}

type BattlePayout struct {
	UserId         string `json:"userId"`
	HoldingCoins   int64  `json:"holdingCoins"`
	BeneficiaryId  string `json:"beneficiaryUserId"`
	CreditedUserId string `json:"creditedUserId"`
}

type BattleTransfer struct {
	FromUserId string `json:"fromUserId"`
	ToUserId   string `json:"toUserId"`
	Coins      int64  `json:"coins"`
}

type BattleSettlementPlan struct {
	RuleApplied string
	WinnerId    string
	Payouts     []BattlePayout
	Transfers   []BattleTransfer
}

func PlanBattleSettlement(rule, winnerId string, holdings []BattleHolding, creditableUserId func(string) string) (BattleSettlementPlan, error) {
	sort.Slice(holdings, func(left, right int) bool { return holdings[left].UserId < holdings[right].UserId })
	winnerTakesAll := rule == "winnerTakesAll" && winnerId != ""
	if winnerTakesAll {
		found := false
		for _, holding := range holdings {
			found = found || (holding.UserId == winnerId && holding.Outcome == OutcomeActive)
		}
		if !found {
			return BattleSettlementPlan{}, ErrUnknownWinner
		}
	}
	plan := BattleSettlementPlan{RuleApplied: "keepOwn"}
	if winnerTakesAll {
		plan.RuleApplied, plan.WinnerId = "winnerTakesAll", winnerId
	}
	for _, holding := range holdings {
		beneficiary := holding.UserId
		if winnerTakesAll && holding.Outcome != OutcomeRemovedByHost {
			beneficiary = winnerId
		}
		plan.Payouts = append(plan.Payouts, BattlePayout{UserId: holding.UserId, HoldingCoins: holding.HoldingCoins, BeneficiaryId: beneficiary, CreditedUserId: creditableUserId(beneficiary)})
		if beneficiary != holding.UserId && holding.HoldingCoins > 0 {
			plan.Transfers = append(plan.Transfers, BattleTransfer{FromUserId: holding.UserId, ToUserId: beneficiary, Coins: holding.HoldingCoins})
		}
	}
	return plan, nil
}
