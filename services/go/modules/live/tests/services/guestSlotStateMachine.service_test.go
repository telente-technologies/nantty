package services_test

import (
	"testing"

	"nantty/modules/live/src/services"
)

func TestGuestSlotTransitions(t *testing.T) {
	cases := []struct {
		name    string
		from    services.GuestSlotState
		event   services.GuestSlotEvent
		want    services.GuestSlotState
		wantErr bool
	}{
		{"invite accepted", services.SlotInvited, services.GuestAccepts, services.SlotJoining, false},
		{"invite declined", services.SlotInvited, services.GuestDeclines, services.SlotDeclined, false},
		{"invite expires", services.SlotInvited, services.InvitationExpires, services.SlotExpired, false},
		{"host cancels invite", services.SlotInvited, services.HostCancelsInvitation, services.SlotCancelled, false},
		{"media connects", services.SlotJoining, services.GuestMediaConnects, services.SlotOnStage, false},
		{"join times out", services.SlotJoining, services.GuestJoinTimesOut, services.SlotFailed, false},
		{"on stage leaves", services.SlotOnStage, services.GuestLeaves, services.SlotLeft, false},
		{"host removes", services.SlotOnStage, services.HostRemovesGuest, services.SlotRemoved, false},
		{"disconnect", services.SlotOnStage, services.GuestDisconnects, services.SlotReconnecting, false},
		{"reconnects", services.SlotReconnecting, services.GuestReconnects, services.SlotOnStage, false},
		{"reconnect timeout", services.SlotReconnecting, services.ReconnectTimesOut, services.SlotLeft, false},
		{"removed while reconnecting", services.SlotReconnecting, services.HostRemovesGuest, services.SlotRemoved, false},
		{"cannot accept twice", services.SlotJoining, services.GuestAccepts, services.SlotJoining, true},
		{"expired cannot be accepted", services.SlotExpired, services.GuestAccepts, services.SlotExpired, true},
		{"declined is terminal", services.SlotDeclined, services.GuestMediaConnects, services.SlotDeclined, true},
		{"left cannot reconnect", services.SlotLeft, services.GuestReconnects, services.SlotLeft, true},
		{"invited cannot be removed", services.SlotInvited, services.HostRemovesGuest, services.SlotInvited, true},
		{"removed cannot leave", services.SlotRemoved, services.GuestLeaves, services.SlotRemoved, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := services.NextGuestSlotState(testCase.from, testCase.event)
			if (err != nil) != testCase.wantErr || got != testCase.want {
				t.Fatalf("got %s, %v; want %s, error=%v", got, err, testCase.want, testCase.wantErr)
			}
		})
	}
}

func TestSeatOccupancyAndStageVisibility(t *testing.T) {
	for state, want := range map[services.GuestSlotState][2]bool{
		services.SlotInvited: {true, false}, services.SlotJoining: {true, false}, services.SlotOnStage: {true, true}, services.SlotReconnecting: {true, true},
		services.SlotLeft: {false, false}, services.SlotRemoved: {false, false}, services.SlotDeclined: {false, false}, services.SlotExpired: {false, false},
	} {
		if services.IsGuestSlotOccupyingSeat(state) != want[0] || services.IsGuestSlotVisibleOnStage(state) != want[1] {
			t.Errorf("state %s occupancy/visibility mismatch", state)
		}
	}
}
