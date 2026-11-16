package services_test

import (
	"testing"

	"nantty/modules/live/src/services"
)

func TestBattleTransitions(t *testing.T) {
	cases := []struct {
		name    string
		from    services.BattleState
		event   services.BattleEvent
		want    services.BattleState
		wantErr bool
	}{
		{"all accepted starts countdown", services.BattlePending, services.AllParticipantsAccepted, services.BattleCountdown, false},
		{"decline then host runs normal", services.BattlePending, services.HostStartsWithoutRule, services.BattleCountdown, false},
		{"decline then host cancels", services.BattlePending, services.HostCancelsBattle, services.BattleCancelled, false},
		{"proposal abandoned", services.BattlePending, services.ProposalAbandoned, services.BattleCancelled, false},
		{"countdown elapses", services.BattleCountdown, services.CountdownElapsed, services.BattleActive, false},
		{"timer ends", services.BattleActive, services.TimerElapsed, services.BattleEnded, false},
		{"host ends early", services.BattleActive, services.HostEndsBattle, services.BattleEnded, false},
		{"host ends live mid battle", services.BattleActive, services.HostEndsLive, services.BattleEnded, false},
		{"forfeit leaves one", services.BattleActive, services.TooFewParticipants, services.BattleEnded, false},
		{"host ends live during countdown", services.BattleCountdown, services.HostEndsLive, services.BattleEnded, false},
		{"pending cancelled when live ends", services.BattlePending, services.HostEndsLive, services.BattleCancelled, false},
		{"settlement committed once", services.BattleEnded, services.SettlementCommitted, services.BattleSettled, false},
		{"second settlement rejected", services.BattleSettled, services.SettlementCommitted, services.BattleSettled, true},
		{"cannot settle an active battle", services.BattleActive, services.SettlementCommitted, services.BattleActive, true},
		{"cannot cancel an active battle", services.BattleActive, services.HostCancelsBattle, services.BattleActive, true},
		{"cancelled is terminal", services.BattleCancelled, services.CountdownElapsed, services.BattleCancelled, true},
		{"cannot end twice", services.BattleEnded, services.TimerElapsed, services.BattleEnded, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := services.NextBattleState(testCase.from, testCase.event)
			if (err != nil) != testCase.wantErr || got != testCase.want {
				t.Fatalf("got %s, %v; want %s, error=%v", got, err, testCase.want, testCase.wantErr)
			}
		})
	}
}

func participant(user string, state services.ParticipantState, score int64) services.ParticipantFacts {
	return services.ParticipantFacts{UserId: user, State: state, Score: score}
}

func TestDecideBattleOutcome(t *testing.T) {
	cases := []struct {
		name            string
		participants    []services.ParticipantFacts
		winnerTakesAll  bool
		wantWinner      string
		wantTie         bool
		wantRuleApplies bool
	}{
		{"clear winner keep own", []services.ParticipantFacts{participant("a", services.ParticipantActive, 50), participant("b", services.ParticipantActive, 20)}, false, "a", false, false},
		{"clear winner winner takes all", []services.ParticipantFacts{participant("a", services.ParticipantActive, 50), participant("b", services.ParticipantActive, 20)}, true, "a", false, true},
		{"tie voids winner takes all", []services.ParticipantFacts{participant("a", services.ParticipantActive, 30), participant("b", services.ParticipantActive, 30)}, true, "", true, false},
		{"all zero is a tie", []services.ParticipantFacts{participant("a", services.ParticipantActive, 0), participant("b", services.ParticipantActive, 0)}, true, "", true, false},
		{"forfeiter with top score cannot win", []services.ParticipantFacts{participant("a", services.ParticipantForfeited, 90), participant("b", services.ParticipantActive, 10), participant("c", services.ParticipantActive, 5)}, true, "b", false, true},
		{"sole remaining participant wins", []services.ParticipantFacts{participant("a", services.ParticipantForfeited, 40), participant("b", services.ParticipantActive, 1)}, true, "b", false, true},
		{"sole remaining with zero has no winner", []services.ParticipantFacts{participant("a", services.ParticipantForfeited, 40), participant("b", services.ParticipantActive, 0)}, true, "", true, false},
		{"removed participant cannot win", []services.ParticipantFacts{participant("a", services.ParticipantLeft, 90), participant("b", services.ParticipantActive, 10)}, false, "b", false, false},
		{"three way tie at top", []services.ParticipantFacts{participant("a", services.ParticipantActive, 9), participant("b", services.ParticipantActive, 9), participant("c", services.ParticipantActive, 1)}, true, "", true, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			outcome := services.DecideBattleOutcome(testCase.participants, testCase.winnerTakesAll)
			if outcome.WinnerUserId != testCase.wantWinner || outcome.IsTie != testCase.wantTie || outcome.WinnerTakesAllApplies != testCase.wantRuleApplies {
				t.Fatalf("got %+v", outcome)
			}
		})
	}
}

func TestParticipantDepartureForfeitsOrRemoves(t *testing.T) {
	participants := []services.ParticipantFacts{participant("a", services.ParticipantActive, 5), participant("b", services.ParticipantActive, 7), participant("c", services.ParticipantActive, 1)}
	if !services.ApplyParticipantDeparture(participants, "b", false) || participants[1].State != services.ParticipantForfeited || participants[1].RemovedByHost {
		t.Fatalf("voluntary leave should forfeit: %+v", participants[1])
	}
	if !services.ApplyParticipantDeparture(participants, "c", true) || participants[2].State != services.ParticipantLeft || !participants[2].RemovedByHost {
		t.Fatalf("host removal should mark left and removedByHost: %+v", participants[2])
	}
	if services.ApplyParticipantDeparture(participants, "b", false) {
		t.Fatal("an already forfeited participant cannot depart twice")
	}
	if services.CountActiveParticipants(participants) != 1 {
		t.Fatal("only one participant should remain active, ending the battle early")
	}
}

func TestRankingSharesRankOnTies(t *testing.T) {
	ranks := services.RankActiveParticipants([]services.ParticipantFacts{participant("a", services.ParticipantActive, 10), participant("b", services.ParticipantActive, 10), participant("c", services.ParticipantActive, 3), participant("d", services.ParticipantForfeited, 99)})
	if ranks["a"] != 1 || ranks["b"] != 1 || ranks["c"] != 2 || ranks["d"] != 0 {
		t.Fatalf("unexpected ranks %v", ranks)
	}
}

func TestWinnerTakesAllConsentVerdicts(t *testing.T) {
	cases := []struct {
		name     string
		consents []string
		want     services.ConsentVerdict
	}{
		{"everyone accepted", []string{"accepted", "accepted"}, services.ConsentAllAccepted},
		{"one declined decides immediately", []string{"accepted", "declined", "pending"}, services.ConsentDeclined},
		{"still waiting", []string{"accepted", "pending"}, services.ConsentStillWaiting},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := services.JudgeWinnerTakesAllConsents(testCase.consents); got != testCase.want {
				t.Fatalf("got %s want %s", got, testCase.want)
			}
		})
	}
}
