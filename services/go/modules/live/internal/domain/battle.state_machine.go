package domain

import "fmt"

type BattleState string

const (
	BattlePending   BattleState = "pending"
	BattleCountdown BattleState = "countdown"
	BattleActive    BattleState = "active"
	BattleEnded     BattleState = "ended"
	BattleSettled   BattleState = "settled"
	BattleCancelled BattleState = "cancelled"
)

type BattleEvent string

const (
	AllParticipantsAccepted BattleEvent = "allAccepted"
	HostStartsWithoutRule   BattleEvent = "hostStartsNormal"
	HostCancelsBattle       BattleEvent = "hostCancel"
	ProposalAbandoned       BattleEvent = "proposalAbandoned"
	CountdownElapsed        BattleEvent = "countdownElapsed"
	TimerElapsed            BattleEvent = "timerElapsed"
	HostEndsBattle          BattleEvent = "hostEnd"
	HostEndsLive            BattleEvent = "hostEndsLive"
	TooFewParticipants      BattleEvent = "tooFewParticipants"
	SettlementCommitted     BattleEvent = "settlementCommitted"
)

var battleTransitions = map[BattleState]map[BattleEvent]BattleState{
	BattlePending: {
		AllParticipantsAccepted: BattleCountdown, HostStartsWithoutRule: BattleCountdown,
		HostCancelsBattle: BattleCancelled, ProposalAbandoned: BattleCancelled, HostEndsLive: BattleCancelled, TooFewParticipants: BattleCancelled,
	},
	BattleCountdown: {CountdownElapsed: BattleActive, HostEndsLive: BattleEnded, TooFewParticipants: BattleEnded},
	BattleActive:    {TimerElapsed: BattleEnded, HostEndsBattle: BattleEnded, HostEndsLive: BattleEnded, TooFewParticipants: BattleEnded},
	BattleEnded:     {SettlementCommitted: BattleSettled},
}

func NextBattleState(current BattleState, event BattleEvent) (BattleState, error) {
	if next, allowed := battleTransitions[current][event]; allowed {
		return next, nil
	}
	return current, fmt.Errorf("battle in state %s cannot handle %s", current, event)
}

func IsBattleOccupyingLive(state BattleState) bool {
	return state == BattlePending || state == BattleCountdown || state == BattleActive || state == BattleEnded
}

type EndReason string

const (
	EndedByTimer    EndReason = "timer"
	EndedByHost     EndReason = "hostEnded"
	EndedByHostLive EndReason = "hostEndedLive"
	EndedByForfeit  EndReason = "forfeit"
)
