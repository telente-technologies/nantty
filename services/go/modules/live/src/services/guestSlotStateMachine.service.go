package services

import "fmt"

type GuestSlotState string

const (
	SlotInvited      GuestSlotState = "invited"
	SlotJoining      GuestSlotState = "joining"
	SlotOnStage      GuestSlotState = "onStage"
	SlotReconnecting GuestSlotState = "reconnecting"
	SlotLeft         GuestSlotState = "left"
	SlotRemoved      GuestSlotState = "removed"
	SlotDeclined     GuestSlotState = "declined"
	SlotExpired      GuestSlotState = "expired"
	SlotCancelled    GuestSlotState = "cancelled"
	SlotFailed       GuestSlotState = "failed"
)

type GuestSlotEvent string

const (
	GuestAccepts          GuestSlotEvent = "accept"
	GuestDeclines         GuestSlotEvent = "decline"
	InvitationExpires     GuestSlotEvent = "expire"
	HostCancelsInvitation GuestSlotEvent = "hostCancel"
	GuestMediaConnects    GuestSlotEvent = "mediaConnected"
	GuestJoinTimesOut     GuestSlotEvent = "joinTimeout"
	GuestLeaves           GuestSlotEvent = "leave"
	HostRemovesGuest      GuestSlotEvent = "hostRemove"
	GuestDisconnects      GuestSlotEvent = "disconnect"
	GuestReconnects       GuestSlotEvent = "reconnect"
	ReconnectTimesOut     GuestSlotEvent = "reconnectTimeout"
)

const (
	MaximumStreamersOnStage      = 10
	InvitationLifetimeSeconds    = 60
	JoiningTimeoutSeconds        = 30
	ReconnectGraceSeconds        = 30
	ProposalAnswerWindowSeconds  = 15
	HostDecisionWindowSeconds    = 45
	BattleCountdownSeconds       = 3
	BattleSettlingDisplaySeconds = 2
	BattleResultDisplaySeconds   = 10
)

var guestSlotTransitions = map[GuestSlotState]map[GuestSlotEvent]GuestSlotState{
	SlotInvited: {GuestAccepts: SlotJoining, GuestDeclines: SlotDeclined, InvitationExpires: SlotExpired, HostCancelsInvitation: SlotCancelled},
	SlotJoining: {GuestMediaConnects: SlotOnStage, GuestJoinTimesOut: SlotFailed, GuestLeaves: SlotLeft, HostRemovesGuest: SlotRemoved},
	SlotOnStage: {GuestLeaves: SlotLeft, HostRemovesGuest: SlotRemoved, GuestDisconnects: SlotReconnecting},
	SlotReconnecting: {
		GuestReconnects: SlotOnStage, ReconnectTimesOut: SlotLeft, GuestLeaves: SlotLeft, HostRemovesGuest: SlotRemoved,
	},
}

func NextGuestSlotState(current GuestSlotState, event GuestSlotEvent) (GuestSlotState, error) {
	if next, allowed := guestSlotTransitions[current][event]; allowed {
		return next, nil
	}
	return current, fmt.Errorf("guest slot in state %s cannot handle %s", current, event)
}

func IsGuestSlotOccupyingSeat(state GuestSlotState) bool {
	return state == SlotInvited || state == SlotJoining || state == SlotOnStage || state == SlotReconnecting
}

func IsGuestSlotVisibleOnStage(state GuestSlotState) bool {
	return state == SlotOnStage || state == SlotReconnecting
}
