package creators

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	"nantty/modules/creators/src/generated/ent/creatorearning"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func TestBattleHoldingsSettleOnceByRuleAndTiesKeepTheirOwn(t *testing.T) {
	harness := startCreatorsHarness(t)
	viewer, host, rival, removed := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness.makeCreator(host, "top")
	harness.makeCreator(rival, "top")
	harness.makeCreator(removed, "top")
	harness.issueCoins(viewer, 1_000)
	ctx := harness.authorized()
	for index, receiver := range []string{host, rival, rival, removed} {
		if _, err := harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, receiver, host, fmt.Sprintf("battle-gift-%02d", index), 1, 100, "battle-1")); err != nil {
			t.Fatal(err)
		}
	}
	totals, err := harness.client.GetBattleGiftTotals(ctx, &moneyv1.GetBattleGiftTotalsRequest{BattleId: "battle-1"})
	if err != nil || len(totals.Totals) != 3 {
		t.Fatalf("totals: %+v %v", totals, err)
	}
	viewerBefore := harness.balance(ledgermodels.UserSpendableCoinsAccount(viewer))
	winner := rival
	request := &moneyv1.SettleBattleRequest{BattleId: "battle-1", LiveId: "live-1", HostUserId: host, Rule: moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_WINNER_TAKES_ALL, WinnerUserId: &winner,
		Participants: []*moneyv1.BattleParticipant{
			{UserId: host, Outcome: moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_ACTIVE},
			{UserId: rival, Outcome: moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_ACTIVE},
			{UserId: removed, Outcome: moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_REMOVED_BY_HOST},
		}}
	settled, err := harness.client.SettleBattle(ctx, request)
	if err != nil || settled.Replayed || len(settled.Settlement.Transfers) != 1 || settled.Settlement.Transfers[0].FromUserId != host || settled.Settlement.Transfers[0].Coins != 70 {
		t.Fatalf("settle: %+v %v", settled, err)
	}
	if harness.balance(ledgermodels.CreatorEarnedCoinsAccount(rival)) != 210 || harness.balance(ledgermodels.CreatorEarnedCoinsAccount(removed)) != 70 || harness.balance(ledgermodels.CreatorEarnedCoinsAccount(host)) != 0 {
		t.Fatal("winner takes all did not move exactly the losers' holdings")
	}
	if harness.balance(ledgermodels.UserSpendableCoinsAccount(viewer)) != viewerBefore {
		t.Fatal("a viewer balance changed at settlement")
	}
	if again, err := harness.client.SettleBattle(ctx, request); err != nil || !again.Replayed {
		t.Fatalf("second settlement: %+v %v", again, err)
	}
	earnings := harness.module.Container.Client(harness.database).CreatorEarning
	for userId, want := range map[string]int64{rival: 210, removed: 70, host: 0} {
		rows, err := earnings.Query().Where(creatorearning.CreatorID(userId)).All(context.Background())
		total := int64(0)
		for _, row := range rows {
			total += row.NetMinor
		}
		if err != nil || total != want {
			t.Fatalf("battle earnings for %s: %d %v", userId, total, err)
		}
	}
	request.Rule = moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_KEEP_OWN
	if _, reason, _ := errorReason(func() error { _, err := harness.client.SettleBattle(ctx, request); return err }()); reason != "BATTLE_ALREADY_SETTLED_DIFFERENTLY" {
		t.Fatalf("different settlement reason %q", reason)
	}
	if _, err := harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, rival, host, "tie-gift-01", 1, 100, "battle-2")); err != nil {
		t.Fatal(err)
	}
	tie, err := harness.client.SettleBattle(ctx, &moneyv1.SettleBattleRequest{BattleId: "battle-2", LiveId: "live-1", HostUserId: host, Rule: moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_WINNER_TAKES_ALL,
		Participants: []*moneyv1.BattleParticipant{{UserId: host, Outcome: moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_ACTIVE}, {UserId: rival, Outcome: moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_ACTIVE}}})
	if err != nil || tie.Settlement.RuleApplied != moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_KEEP_OWN || len(tie.Settlement.Transfers) != 0 || harness.balance(ledgermodels.CreatorEarnedCoinsAccount(rival)) != 280 {
		t.Fatalf("tie: %+v %v", tie, err)
	}
	assertHealthy(t, harness)
}
