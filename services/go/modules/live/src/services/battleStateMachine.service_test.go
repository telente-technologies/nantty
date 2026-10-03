package services

import "testing"

func TestBattleTransitions(t *testing.T) {
	cases := []struct {
		name    string
		from    BattleState
		event   BattleEvent
		want    BattleState
		wantErr bool
	}{
		{"all accepted starts countdown", BattlePending, AllParticipantsAccepted, BattleCountdown, false},
		{"decline then host runs normal", BattlePending, HostStartsWithoutRule, BattleCountdown, false},
		{"decline then host cancels", BattlePending, HostCancelsBattle, BattleCancelled, false},
		{"proposal abandoned", BattlePending, ProposalAbandoned, BattleCancelled, false},
		{"countdown elapses", BattleCountdown, CountdownElapsed, BattleActive, false},
		{"timer ends", BattleActive, TimerElapsed, BattleEnded, false},
		{"host ends early", BattleActive, HostEndsBattle, BattleEnded, false},
		{"host ends live mid battle", BattleActive, HostEndsLive, BattleEnded, false},
		{"forfeit leaves one", BattleActive, TooFewParticipants, BattleEnded, false},
		{"host ends live during countdown", BattleCountdown, HostEndsLive, BattleEnded, false},
		{"pending cancelled when live ends", BattlePending, HostEndsLive, BattleCancelled, false},
		{"settlement committed once", BattleEnded, SettlementCommitted, BattleSettled, false},
		{"second settlement rejected", BattleSettled, SettlementCommitted, BattleSettled, true},
		{"cannot settle an active battle", BattleActive, SettlementCommitted, BattleActive, true},
		{"cannot cancel an active battle", BattleActive, HostCancelsBattle, BattleActive, true},
		{"cancelled is terminal", BattleCancelled, CountdownElapsed, BattleCancelled, true},
		{"cannot end twice", BattleEnded, TimerElapsed, BattleEnded, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := NextBattleState(testCase.from, testCase.event)
			if (err != nil) != testCase.wantErr || got != testCase.want {
				t.Fatalf("got %s, %v; want %s, error=%v", got, err, testCase.want, testCase.wantErr)
			}
		})
	}
}

func participant(user string, state ParticipantState, score int64) ParticipantFacts {
	return ParticipantFacts{UserId: user, State: state, Score: score}
}

func TestDecideBattleOutcome(t *testing.T) {
	cases := []struct {
		name            string
		participants    []ParticipantFacts
		winnerTakesAll  bool
		wantWinner      string
		wantTie         bool
		wantRuleApplies bool
	}{
		{"clear winner keep own", []ParticipantFacts{participant("a", ParticipantActive, 50), participant("b", ParticipantActive, 20)}, false, "a", false, false},
		{"clear winner winner takes all", []ParticipantFacts{participant("a", ParticipantActive, 50), participant("b", ParticipantActive, 20)}, true, "a", false, true},
		{"tie voids winner takes all", []ParticipantFacts{participant("a", ParticipantActive, 30), participant("b", ParticipantActive, 30)}, true, "", true, false},
		{"all zero is a tie", []ParticipantFacts{participant("a", ParticipantActive, 0), participant("b", ParticipantActive, 0)}, true, "", true, false},
		{"forfeiter with top score cannot win", []ParticipantFacts{participant("a", ParticipantForfeited, 90), participant("b", ParticipantActive, 10), participant("c", ParticipantActive, 5)}, true, "b", false, true},
		{"sole remaining participant wins", []ParticipantFacts{participant("a", ParticipantForfeited, 40), participant("b", ParticipantActive, 1)}, true, "b", false, true},
		{"sole remaining with zero has no winner", []ParticipantFacts{participant("a", ParticipantForfeited, 40), participant("b", ParticipantActive, 0)}, true, "", true, false},
		{"removed participant cannot win", []ParticipantFacts{participant("a", ParticipantLeft, 90), participant("b", ParticipantActive, 10)}, false, "b", false, false},
		{"three way tie at top", []ParticipantFacts{participant("a", ParticipantActive, 9), participant("b", ParticipantActive, 9), participant("c", ParticipantActive, 1)}, true, "", true, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			outcome := DecideBattleOutcome(testCase.participants, testCase.winnerTakesAll)
			if outcome.WinnerUserId != testCase.wantWinner || outcome.IsTie != testCase.wantTie || outcome.WinnerTakesAllApplies != testCase.wantRuleApplies {
				t.Fatalf("got %+v", outcome)
			}
		})
	}
}

func TestParticipantDepartureForfeitsOrRemoves(t *testing.T) {
	participants := []ParticipantFacts{participant("a", ParticipantActive, 5), participant("b", ParticipantActive, 7), participant("c", ParticipantActive, 1)}
	if !ApplyParticipantDeparture(participants, "b", false) || participants[1].State != ParticipantForfeited || participants[1].RemovedByHost {
		t.Fatalf("voluntary leave should forfeit: %+v", participants[1])
	}
	if !ApplyParticipantDeparture(participants, "c", true) || participants[2].State != ParticipantLeft || !participants[2].RemovedByHost {
		t.Fatalf("host removal should mark left and removedByHost: %+v", participants[2])
	}
	if ApplyParticipantDeparture(participants, "b", false) {
		t.Fatal("an already forfeited participant cannot depart twice")
	}
	if CountActiveParticipants(participants) != 1 {
		t.Fatal("only one participant should remain active, ending the battle early")
	}
}

func TestRankingSharesRankOnTies(t *testing.T) {
	ranks := RankActiveParticipants([]ParticipantFacts{participant("a", ParticipantActive, 10), participant("b", ParticipantActive, 10), participant("c", ParticipantActive, 3), participant("d", ParticipantForfeited, 99)})
	if ranks["a"] != 1 || ranks["b"] != 1 || ranks["c"] != 2 || ranks["d"] != 0 {
		t.Fatalf("unexpected ranks %v", ranks)
	}
}

func TestWinnerTakesAllConsentVerdicts(t *testing.T) {
	cases := []struct {
		name     string
		consents []string
		want     ConsentVerdict
	}{
		{"everyone accepted", []string{"accepted", "accepted"}, ConsentAllAccepted},
		{"one declined decides immediately", []string{"accepted", "declined", "pending"}, ConsentDeclined},
		{"still waiting", []string{"accepted", "pending"}, ConsentStillWaiting},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := JudgeWinnerTakesAllConsents(testCase.consents); got != testCase.want {
				t.Fatalf("got %s want %s", got, testCase.want)
			}
		})
	}
}
