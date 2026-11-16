package updatelivecoinsupport_test

import (
	"testing"

	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent/livesession"
	updatelivecoinsupport "nantty/modules/live/src/modules/sessions/commands/updateLiveCoinSupport"
)

func TestHostMayChangeCoinSupport(t *testing.T) {
	host, anotherUser := uuid.New(), uuid.New()
	if !updatelivecoinsupport.HostMayChangeCoinSupport(host.String(), host) {
		t.Fatal("authenticated host should be authorized")
	}
	if updatelivecoinsupport.HostMayChangeCoinSupport(host.String(), anotherUser) {
		t.Fatal("non-host must not be authorized")
	}
}

func TestCoinSupportStatePolicy(t *testing.T) {
	for _, test := range []struct {
		state       string
		isScheduled bool
	}{{string(livesession.StateIdle), true}, {string(livesession.StateConnecting), false}, {string(livesession.StateLive), false}} {
		if !updatelivecoinsupport.LiveStateAllowsCoinSupportChange(test.state, test.isScheduled) {
			t.Errorf("state %q scheduled=%v should permit changing coin support", test.state, test.isScheduled)
		}
	}
	for _, test := range []struct {
		state       string
		isScheduled bool
	}{{string(livesession.StateIdle), false}, {string(livesession.StateEnded), true}, {"unknown", true}} {
		if updatelivecoinsupport.LiveStateAllowsCoinSupportChange(test.state, test.isScheduled) {
			t.Errorf("state %q scheduled=%v should reject changing coin support", test.state, test.isScheduled)
		}
	}
}
