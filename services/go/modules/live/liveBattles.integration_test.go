package live

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
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

func (scene battleScene) contributeCoins(sender, receiver liveUser, battleID string, coins int64, key string, wantStatus int) map[string]any {
	return scene.harness.expect("POST", "/api/v1/battles/"+battleID+"/coins", &sender, key,
		map[string]any{"recipientUserId": receiver.id.String(), "coins": coins}, wantStatus)
}

func TestBattleCoinContributionReturnsUpdatedStageAndRejectsNonParticipants(t *testing.T) {
	scene := newBattleScene(t)
	battleID := scene.startRunningBattle(false, scene.host, scene.first)
	result := scene.contributeCoins(scene.host, scene.first, battleID, 100, "battle-coin-api-0001", http.StatusOK)
	active := result["activeBattle"].(map[string]any)
	if result["liveId"] != scene.liveId || active["id"] != battleID {
		t.Fatalf("contribution should return the live stage snapshot: %v", result)
	}
	scores := scoresByUser(active)
	if scores[scene.first.id.String()] != 100 {
		t.Fatalf("stage score should reflect gross contribution coins, scores=%v", scores)
	}
	scene.contributeCoins(scene.fan, scene.first, battleID, 10, "battle-coin-outside-01", http.StatusForbidden)
	ended := scene.respond(scene.host, battleID, "end")
	settled := scene.waitForBattleState("settled")
	if ended["activeBattle"] == nil || len(settled["payouts"].([]any)) == 0 {
		t.Fatalf("battle holding must remain compatible with existing settlement: %v", settled)
	}
	for _, raw := range settled["payouts"].([]any) {
		payout := raw.(map[string]any)
		if payout["userId"] == scene.first.id.String() && payout["earnedCoins"] == float64(98) {
			return
		}
	}
	t.Fatalf("contribution net holding should be paid out by settlement: %v", settled["payouts"])
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
