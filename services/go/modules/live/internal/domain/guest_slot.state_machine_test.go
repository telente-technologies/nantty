package domain

import "testing"

func TestGuestSlotTransitions(t *testing.T) {
	cases := []struct {
		name    string
		from    GuestSlotState
		event   GuestSlotEvent
		want    GuestSlotState
		wantErr bool
	}{
		{"invite accepted", SlotInvited, GuestAccepts, SlotJoining, false},
		{"invite declined", SlotInvited, GuestDeclines, SlotDeclined, false},
		{"invite expires", SlotInvited, InvitationExpires, SlotExpired, false},
		{"host cancels invite", SlotInvited, HostCancelsInvitation, SlotCancelled, false},
		{"media connects", SlotJoining, GuestMediaConnects, SlotOnStage, false},
		{"join times out", SlotJoining, GuestJoinTimesOut, SlotFailed, false},
		{"on stage leaves", SlotOnStage, GuestLeaves, SlotLeft, false},
		{"host removes", SlotOnStage, HostRemovesGuest, SlotRemoved, false},
		{"disconnect", SlotOnStage, GuestDisconnects, SlotReconnecting, false},
		{"reconnects", SlotReconnecting, GuestReconnects, SlotOnStage, false},
		{"reconnect timeout", SlotReconnecting, ReconnectTimesOut, SlotLeft, false},
		{"removed while reconnecting", SlotReconnecting, HostRemovesGuest, SlotRemoved, false},
		{"cannot accept twice", SlotJoining, GuestAccepts, SlotJoining, true},
		{"expired cannot be accepted", SlotExpired, GuestAccepts, SlotExpired, true},
		{"declined is terminal", SlotDeclined, GuestMediaConnects, SlotDeclined, true},
		{"left cannot reconnect", SlotLeft, GuestReconnects, SlotLeft, true},
		{"invited cannot be removed", SlotInvited, HostRemovesGuest, SlotInvited, true},
		{"removed cannot leave", SlotRemoved, GuestLeaves, SlotRemoved, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := NextGuestSlotState(testCase.from, testCase.event)
			if (err != nil) != testCase.wantErr || got != testCase.want {
				t.Fatalf("got %s, %v; want %s, error=%v", got, err, testCase.want, testCase.wantErr)
			}
		})
	}
}

func TestSeatOccupancyAndStageVisibility(t *testing.T) {
	for state, want := range map[GuestSlotState][2]bool{
		SlotInvited: {true, false}, SlotJoining: {true, false}, SlotOnStage: {true, true}, SlotReconnecting: {true, true},
		SlotLeft: {false, false}, SlotRemoved: {false, false}, SlotDeclined: {false, false}, SlotExpired: {false, false},
	} {
		if IsGuestSlotOccupyingSeat(state) != want[0] || IsGuestSlotVisibleOnStage(state) != want[1] {
			t.Errorf("state %s occupancy/visibility mismatch", state)
		}
	}
}
