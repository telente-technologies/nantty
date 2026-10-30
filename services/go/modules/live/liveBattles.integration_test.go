package live

import (
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
)

type battleScene struct {
	harness *liveHarness
	liveId  string
	host    liveUser
	first   liveUser
	second  liveUser
	fan     liveUser
}

func newBattleScene(t *testing.T) battleScene {
	harness := startLiveModuleAgainstFreshSchema(t)
	scene := battleScene{harness: harness, host: harness.newUser("host", "creator"), first: harness.newUser("first", "creator"), second: harness.newUser("second", "buyer"), fan: harness.newUser("fan", "buyer")}
	scene.liveId = harness.goLive(scene.host, nil)
	harness.putOnStage(scene.liveId, scene.host, scene.first)
	harness.putOnStage(scene.liveId, scene.host, scene.second)
	return scene
}

func (scene battleScene) createBattle(winnerTakesAll bool, participants ...liveUser) map[string]any {
	ids := make([]string, 0, len(participants))
	for _, participant := range participants {
		ids = append(ids, participant.id.String())
	}
	return scene.harness.expect("POST", "/api/v1/lives/"+scene.liveId+"/battles", &scene.host, uuid.NewString(), map[string]any{
		"participantUserIds": ids, "durationSeconds": 60, "winnerTakesAll": winnerTakesAll,
	}, http.StatusOK)
}

func (scene battleScene) respond(user liveUser, battleId, action string) map[string]any {
	return scene.harness.expect("POST", "/api/v1/battles/"+battleId+"/"+action, &user, "", nil, http.StatusOK)
}

func (scene battleScene) gift(receiver liveUser, giftId string, quantity int) map[string]any {
	return scene.harness.expect("POST", "/api/v1/live/gifts", &scene.fan, uuid.NewString(), map[string]any{
		"liveId": scene.liveId, "giftId": giftId, "quantity": quantity, "receiverUserId": receiver.id.String(),
	}, http.StatusCreated)
}

func (scene battleScene) stage() map[string]any { return scene.harness.stage(scene.liveId, scene.host) }

func (scene battleScene) waitForBattleState(state string) map[string]any {
	scene.harness.t.Helper()
	var battle map[string]any
	waitUntil(scene.harness.t, func() bool {
		active, _ := scene.stage()["activeBattle"].(map[string]any)
		battle = active
		return active != nil && active["state"] == state
	})
	return battle
}

func (scene battleScene) startRunningBattle(winnerTakesAll bool, participants ...liveUser) string {
	proposal := scene.createBattle(winnerTakesAll, participants...)
	var battleId string
	if winnerTakesAll {
		battleId = proposal["battleProposal"].(map[string]any)["id"].(string)
		for _, participant := range participants[1:] {
			scene.respond(participant, battleId, "accept")
		}
	}
	battle := scene.waitForBattleState("countdown")
	scene.harness.clock.Advance(4 * time.Second)
	scene.waitForBattleState("active")
	return battle["id"].(string)
}

func TestWinnerTakesAllNeedsEveryAcceptanceAndSettlesExactlyOnce(t *testing.T) {
	scene := newBattleScene(t)
	pending := scene.createBattle(true, scene.host, scene.first, scene.second)
	proposal := pending["battleProposal"].(map[string]any)
	battleId := proposal["id"].(string)
	if pending["phase"] != "battlePending" || proposal["winnerTakesAll"] != true || proposal["needsHostDecision"] != false || len(proposal["consents"].([]any)) != 3 {
		t.Fatalf("unexpected proposal %v", pending)
	}
	scene.respond(scene.first, battleId, "accept")
	if scene.stage()["phase"] != "battlePending" {
		t.Fatal("one acceptance is not enough")
	}
	scene.harness.expect("POST", "/api/v1/battles/"+battleId+"/accept", &scene.first, "", nil, http.StatusConflict)
	scene.harness.expect("POST", "/api/v1/lives/"+scene.liveId+"/battles", &scene.host, uuid.NewString(), map[string]any{
		"participantUserIds": []string{scene.host.id.String(), scene.first.id.String()}, "durationSeconds": 60,
	}, http.StatusConflict)
	scene.respond(scene.second, battleId, "accept")
	scene.waitForBattleState("countdown")
	scene.harness.clock.Advance(4 * time.Second)
	scene.waitForBattleState("active")
	hostGift := scene.gift(scene.host, "gift_rose", 10)
	scene.gift(scene.first, "gift_heart", 1)
	if hostGift["battleId"] != battleId {
		t.Fatalf("the server attaches the active battle: %v", hostGift)
	}
	scores := scoresByUser(scene.stage()["activeBattle"].(map[string]any))
	if scores[scene.host.id.String()] != 100 || scores[scene.first.id.String()] != 5 {
		t.Fatalf("scores come from gifts: %v", scores)
	}
	scene.harness.clock.Advance(61 * time.Second)
	settled := scene.waitForBattleState("settled")
	transfers := settled["transfers"].([]any)
	if settled["endReason"] != "timer" || settled["isTie"] != false || len(transfers) != 1 || settled["winnerUserIds"].([]any)[0] != scene.host.id.String() {
		t.Fatalf("unexpected settlement %v", settled)
	}
	moved := transfers[0].(map[string]any)
	if moved["fromUserId"] != scene.first.id.String() || moved["toUserId"] != scene.host.id.String() || moved["coins"] != float64(3) {
		t.Fatalf("only the loser's holding moves to the winner: %v", moved)
	}
	time.Sleep(300 * time.Millisecond)
	if calls := scene.harness.money.SettleCallCount[battleId]; calls != 1 {
		t.Fatalf("settlement must run exactly once, ran %d times", calls)
	}
	for _, eventType := range []string{"battle.created", "battle.started", "battle.scoreUpdated", "battle.ended", "battle.settled", "battle.winnerCelebrated"} {
		scene.harness.waitForEvent(eventType)
	}
}

func scoresByUser(battle map[string]any) map[string]float64 {
	scores := map[string]float64{}
	for _, entry := range battle["participants"].([]any) {
		participant := entry.(map[string]any)
		scores[participant["userId"].(string)] = participant["score"].(float64)
	}
	return scores
}

func TestDeclinedWinnerTakesAllLetsTheHostRunNormalOrCancel(t *testing.T) {
	scene := newBattleScene(t)
	battleId := scene.createBattle(true, scene.host, scene.first, scene.second)["battleProposal"].(map[string]any)["id"].(string)
	declined := scene.respond(scene.second, battleId, "decline")["battleProposal"].(map[string]any)
	if declined["needsHostDecision"] != true {
		t.Fatalf("a decline needs the host to decide: %v", declined)
	}
	scene.harness.expect("POST", "/api/v1/battles/"+battleId+"/cancel", &scene.first, "", nil, http.StatusForbidden)
	cancelled := scene.respond(scene.host, battleId, "cancel")
	if cancelled["battleProposal"] != nil || cancelled["activeBattle"] != nil || cancelled["phase"] != "onStage" {
		t.Fatalf("cancel returns to the stage: %v", cancelled)
	}
	scene.harness.waitForEvent("battle.cancelled")
	again := scene.createBattle(true, scene.host, scene.first, scene.second)["battleProposal"].(map[string]any)["id"].(string)
	scene.respond(scene.first, again, "decline")
	scene.respond(scene.host, again, "start-without-winner-takes-all")
	battle := scene.waitForBattleState("countdown")
	if battle["winnerTakesAll"] != false || len(battle["participants"].([]any)) != 3 {
		t.Fatalf("normal battle keeps every participant: %v", battle)
	}
}

func TestUnansweredProposalTimesOutAndIsAbandonedWithoutAHostDecision(t *testing.T) {
	scene := newBattleScene(t)
	battleId := scene.createBattle(true, scene.host, scene.first)["battleProposal"].(map[string]any)["id"].(string)
	scene.harness.clock.Advance(16 * time.Second)
	waitUntil(t, func() bool { return scene.stage()["battleProposal"].(map[string]any)["needsHostDecision"] == true })
	scene.harness.clock.Advance(60 * time.Second)
	waitUntil(t, func() bool { return scene.stage()["battleProposal"] == nil })
	scene.harness.expect("POST", "/api/v1/battles/"+battleId+"/accept", &scene.first, "", nil, http.StatusGone)
}

func TestTieKeepsEveryonesOwnCoinsEvenUnderWinnerTakesAll(t *testing.T) {
	scene := newBattleScene(t)
	battleId := scene.startRunningBattle(true, scene.host, scene.first)
	scene.gift(scene.host, "gift_rose", 2)
	scene.gift(scene.first, "gift_rose", 2)
	ended := scene.respond(scene.host, battleId, "end")
	if ended["activeBattle"].(map[string]any)["endReason"] != "hostEnded" {
		t.Fatalf("unexpected end %v", ended)
	}
	settled := scene.waitForBattleState("settled")
	if settled["isTie"] != true || len(settled["transfers"].([]any)) != 0 || len(settled["winnerUserIds"].([]any)) != 2 {
		t.Fatalf("a tie voids winner-takes-all: %v", settled)
	}
	if rule := scene.harness.money.Settlements[battleId].RuleApplied; rule != "keepOwn" {
		t.Fatalf("money should be told keepOwn, got %s", rule)
	}
}

func TestForfeitEndsEarlyThenHostEndingTheLiveSettlesTheNextBattle(t *testing.T) {
	scene := newBattleScene(t)
	firstBattle := scene.startRunningBattle(false, scene.host, scene.first)
	scene.gift(scene.host, "gift_rose", 1)
	scene.harness.expect("POST", "/api/v1/lives/"+scene.liveId+"/guests/me/leave", &scene.first, "", nil, http.StatusOK)
	settled := scene.waitForBattleState("settled")
	if settled["endReason"] != "forfeit" || settled["winnerUserIds"].([]any)[0] != scene.host.id.String() {
		t.Fatalf("the remaining participant wins by forfeit: %v", settled)
	}
	left := participantState(settled, scene.first.id.String())
	if left != "forfeited" {
		t.Fatalf("leaving forfeits, got %s", left)
	}
	scene.harness.expect("POST", "/api/v1/live/gifts", &scene.fan, uuid.NewString(), map[string]any{
		"liveId": scene.liveId, "giftId": "gift_rose", "quantity": 1, "receiverUserId": scene.first.id.String(),
	}, http.StatusUnprocessableEntity)
	secondBattle := scene.startRunningBattle(true, scene.host, scene.second)
	scene.gift(scene.second, "gift_rose", 3)
	scene.harness.expect("POST", "/api/v1/lives/"+scene.liveId+"/end", &scene.host, "", nil, http.StatusNoContent)
	waitUntil(t, func() bool { return len(scene.harness.money.Settlements[secondBattle].Payouts) > 0 })
	if scene.harness.money.SettleCallCount[firstBattle] != 1 || scene.harness.money.SettleCallCount[secondBattle] != 1 {
		t.Fatalf("each battle settles once: %v", scene.harness.money.SettleCallCount)
	}
	closing, _ := scene.stage()["activeBattle"].(map[string]any)
	if closing == nil || closing["endReason"] != "hostEndedLive" || closing["state"] != "settled" {
		t.Fatalf("ending the live ends the battle with hostEndedLive: %v", closing)
	}
}

func participantState(battle map[string]any, userId string) string {
	for _, entry := range battle["participants"].([]any) {
		participant := entry.(map[string]any)
		if participant["userId"] == userId {
			return fmt.Sprint(participant["state"])
		}
	}
	return ""
}

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
