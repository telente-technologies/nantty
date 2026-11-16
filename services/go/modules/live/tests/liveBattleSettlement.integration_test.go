package live_test

import (
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
)

func TestFailedSettlementIsRetriedAndNeverDoubleSettles(t *testing.T) {
	scene := newBattleScene(t)
	battleId := scene.startRunningBattle(true, scene.host, scene.first)
	scene.gift(scene.host, "gift_rose", 1)
	scene.harness.money.FailSettlementOn = true
	scene.respond(scene.host, battleId, "end")
	waitUntil(t, func() bool { return scene.harness.money.SettleCallCount[battleId] == 1 })
	if stage := scene.stage()["activeBattle"].(map[string]any); stage["state"] != "settling" || stage["settledAt"] != nil {
		t.Fatalf("a failed settlement keeps the battle settling: %v", stage)
	}
	scene.harness.money.FailSettlementOn = false
	scene.harness.clock.Advance(250 * time.Millisecond)
	if err := newServiceFor(scene.harness).SettleDueBattles(t.Context()); err != nil {
		t.Fatal(err)
	}
	scene.waitForBattleState("settled")
	callsAfterSuccess := scene.harness.money.SettleCallCount[battleId]
	service := newServiceFor(scene.harness)
	done := make(chan error, 2)
	for range 2 {
		go func() { done <- service.SettleBattle(t.Context(), uuid.MustParse(battleId)) }()
	}
	for range 2 {
		if err := <-done; err != nil {
			t.Fatal(err)
		}
	}
	if scene.harness.money.SettleCallCount[battleId] != callsAfterSuccess || len(scene.harness.money.Settlements) != 1 {
		t.Fatalf("a settled battle must not settle again: calls=%d", scene.harness.money.SettleCallCount[battleId])
	}
}

func TestBattleSettlementLedgerCallDoesNotHoldDatabaseLock(t *testing.T) {
	scene := newBattleScene(t)
	battleId := scene.startRunningBattle(true, scene.host, scene.first)
	scene.harness.money.FailSettlementOn = true
	scene.respond(scene.host, battleId, "end")
	scene.harness.money.FailSettlementOn = false
	scene.harness.clock.Advance(250 * time.Millisecond)

	entered, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	scene.harness.money.SettlementHook = func() {
		once.Do(func() {
			close(entered)
			<-release
		})
	}
	service := newServiceFor(scene.harness)
	firstDone := make(chan error, 1)
	go func() { firstDone <- service.SettleBattle(t.Context(), uuid.MustParse(battleId)) }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("ledger settlement call did not start")
	}
	row, err := scene.harness.module.Container.Client.Battle.Query().Where(battlerecord.ID(uuid.MustParse(battleId))).Only(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if row.SettlementAttempts < 1 || row.SettlementLeaseUntil == nil {
		t.Fatalf("claim must durably consume an attempt before calling the ledger: attempts=%d lease=%v", row.SettlementAttempts, row.SettlementLeaseUntil)
	}

	// A second settlement attempt should observe the lease and return promptly.
	// If the first call still owns a DB transaction lock, this blocks behind it.
	secondDone := make(chan error, 1)
	go func() { secondDone <- service.SettleBattle(t.Context(), uuid.MustParse(battleId)) }()
	select {
	case err := <-secondDone:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("database row remained locked during the external ledger call")
	}

	// Simulate process loss: after the persisted lease expires, a worker must
	// reclaim the battle using the next persisted attempt number.
	scene.harness.clock.Advance(31 * time.Second)
	if err := service.SettleBattle(t.Context(), uuid.MustParse(battleId)); err != nil {
		t.Fatal(err)
	}
	recovered, err := scene.harness.module.Container.Client.Battle.Query().Where(battlerecord.ID(uuid.MustParse(battleId))).Only(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if recovered.SettlementAttempts != row.SettlementAttempts+1 || recovered.State != battlerecord.StateSettled {
		t.Fatalf("expired lease should consume exactly one additional attempt and settle, before=%d after=%d state=%s", row.SettlementAttempts, recovered.SettlementAttempts, recovered.State)
	}
	close(release)
	if err := <-firstDone; err != nil {
		t.Fatal(err)
	}
	if len(scene.harness.money.Settlements) != 1 {
		t.Fatalf("expired-lease recovery must retain one ledger settlement, got %d", len(scene.harness.money.Settlements))
	}
}

func TestAmbiguousLedgerFailureRetriesWithSameIdempotencyKey(t *testing.T) {
	scene := newBattleScene(t)
	battleId := scene.startRunningBattle(true, scene.host, scene.first)
	scene.gift(scene.host, "gift_rose", 1)
	scene.harness.money.FailSettlementOn = true
	scene.respond(scene.host, battleId, "end")
	scene.harness.money.FailSettlementOn = false
	scene.harness.money.FailAfterSettlementOnce = true
	service := newServiceFor(scene.harness)

	scene.harness.clock.Advance(250 * time.Millisecond)
	if err := service.SettleDueBattles(t.Context()); err == nil {
		t.Fatal("expected an ambiguous error after the ledger committed")
	}
	if _, ok := scene.harness.money.Settlements[battleId]; !ok {
		t.Fatal("simulated ledger must have committed before dropping its response")
	}

	scene.harness.clock.Advance(500 * time.Millisecond)
	if err := service.SettleDueBattles(t.Context()); err != nil {
		t.Fatal(err)
	}
	scene.waitForBattleState("settled")
	if got := scene.harness.money.SettleCallCount[battleId]; got != 3 {
		t.Fatalf("expected original failure, ambiguous commit, and idempotent replay; got %d calls", got)
	}
	var credited int64
	for _, amount := range scene.harness.money.GiftEarnedCoins {
		credited += amount
	}
	var earned int64
	for _, payout := range scene.harness.money.Settlements[battleId].Payouts {
		earned += payout.HoldingCoins
	}
	if credited != earned {
		t.Fatalf("ambiguous retry duplicated payout: credited=%d settled=%d", credited, earned)
	}
}
