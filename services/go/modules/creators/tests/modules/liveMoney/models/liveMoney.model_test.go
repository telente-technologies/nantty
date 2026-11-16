package models_test

import (
	"errors"
	"testing"

	"nantty/modules/creators/src/modules/liveMoney/models"
)

func TestGiftSplitRoundsDownForTheCreatorAndCapsTheShareAtSeventyPercent(t *testing.T) {
	cases := []struct {
		quantity, price, bps, total, creator, platform, appliedBps int64
	}{
		{1, 100, 7000, 100, 70, 30, 7000}, {1, 1, 7000, 1, 0, 1, 7000}, {3, 1, 7000, 3, 2, 1, 7000}, {5, 7, 5000, 35, 17, 18, 5000},
		{1, 100, 9000, 100, 70, 30, 7000}, {1, 100, -10, 100, 0, 100, 0}, {100, 1_000_000, 6000, 100_000_000, 60_000_000, 40_000_000, 6000},
	}
	for _, testCase := range cases {
		split, err := models.SplitGiftCoins(testCase.quantity, testCase.price, testCase.bps)
		if err != nil || split.TotalCoins != testCase.total || split.CreatorAmountCoins != testCase.creator || split.PlatformFeeCoins != testCase.platform || split.CreatorShareBps != testCase.appliedBps {
			t.Errorf("%+v: %+v %v", testCase, split, err)
		}
	}
	for _, invalid := range [][2]int64{{0, 10}, {101, 10}, {1, 0}, {1, -5}, {100, 1 << 62}} {
		if _, err := models.SplitGiftCoins(invalid[0], invalid[1], 7000); !errors.Is(err, models.ErrInvalidGiftAmount) {
			t.Errorf("%v accepted", invalid)
		}
	}
}

func TestBattleSettlementPlansFollowTheRulesAndNeverRefundViewers(t *testing.T) {
	member := func(userId string) string {
		if userId == "guest" {
			return "host"
		}
		return userId
	}
	holdings := func() []models.BattleHolding {
		return []models.BattleHolding{{"host", models.OutcomeActive, 300}, {"rival", models.OutcomeActive, 500}, {"quitter", models.OutcomeForfeited, 100}, {"removed", models.OutcomeRemovedByHost, 50}, {"guest", models.OutcomeActive, 20}}
	}
	keepOwn, err := models.PlanBattleSettlement("keepOwn", "rival", holdings(), member)
	if err != nil || keepOwn.RuleApplied != "keepOwn" || len(keepOwn.Transfers) != 0 {
		t.Fatalf("keep own: %+v %v", keepOwn, err)
	}
	for _, payout := range keepOwn.Payouts {
		if payout.BeneficiaryId != payout.UserId || (payout.UserId == "guest" && payout.CreditedUserId != "host") {
			t.Errorf("keep own payout %+v", payout)
		}
	}
	winnerTakesAll, err := models.PlanBattleSettlement("winnerTakesAll", "rival", holdings(), member)
	if err != nil || winnerTakesAll.RuleApplied != "winnerTakesAll" {
		t.Fatalf("winner takes all: %+v %v", winnerTakesAll, err)
	}
	moved := map[string]int64{}
	for _, transfer := range winnerTakesAll.Transfers {
		if transfer.ToUserId != "rival" {
			t.Errorf("transfer to %s", transfer.ToUserId)
		}
		moved[transfer.FromUserId] = transfer.Coins
	}
	if moved["host"] != 300 || moved["quitter"] != 100 || moved["guest"] != 20 || moved["removed"] != 0 || len(moved) != 3 {
		t.Fatalf("moved = %v", moved)
	}
	tie, err := models.PlanBattleSettlement("winnerTakesAll", "", holdings(), member)
	if err != nil || tie.RuleApplied != "keepOwn" || len(tie.Transfers) != 0 {
		t.Fatalf("a tie must settle as keep own: %+v", tie)
	}
	for _, invalidWinner := range []string{"stranger", "quitter", "removed"} {
		if _, err := models.PlanBattleSettlement("winnerTakesAll", invalidWinner, holdings(), member); !errors.Is(err, models.ErrUnknownWinner) {
			t.Errorf("winner %s accepted", invalidWinner)
		}
	}
}
