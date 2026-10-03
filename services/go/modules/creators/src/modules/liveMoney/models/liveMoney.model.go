package models

import (
	"errors"
	"math/bits"
	"sort"
)

const MaximumCreatorGiftShareBps = 7000

var (
	ErrInvalidGiftAmount = errors.New("gift quantity or price is out of range")
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
