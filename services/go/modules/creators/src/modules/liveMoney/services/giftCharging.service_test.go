package services

import (
	"errors"
	"testing"
)

func TestLiveGiftChargeRechecksCoinSupportState(t *testing.T) {
	tests := []struct {
		name, hostID, state, requestedHostID, wantReason string
		enabled                                          bool
	}{
		{name: "active opted-in host", hostID: "host-1", state: "live", requestedHostID: "host-1", enabled: true},
		{name: "host identity changed", hostID: "host-2", state: "live", requestedHostID: "host-1", enabled: true, wantReason: "LIVE_HOST_MISMATCH"},
		{name: "session ended", hostID: "host-1", state: "ended", requestedHostID: "host-1", enabled: true, wantReason: "LIVE_NOT_ACTIVE"},
		{name: "coin support disabled", hostID: "host-1", state: "live", requestedHostID: "host-1", enabled: false, wantReason: "LIVE_COIN_SUPPORT_DISABLED"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateLiveCoinSupportState(test.hostID, test.state, test.enabled, test.requestedHostID)
			if test.wantReason == "" {
				if err != nil {
					t.Fatalf("valid live state rejected: %v", err)
				}
				return
			}
			var failure *LiveMoneyError
			if !errors.As(err, &failure) || failure.Reason != test.wantReason {
				t.Fatalf("validation error = %#v, want reason %s", err, test.wantReason)
			}
		})
	}
}
