package services_test

import (
	"testing"

	"nantty/modules/live/src/services"
)

func TestNewLiveCoinSupportRequiresExplicitOptIn(t *testing.T) {
	enabled, disabled := true, false
	for _, test := range []struct {
		name       string
		preference *bool
		want       bool
	}{
		{name: "omitted defaults off"},
		{name: "explicit off", preference: &disabled},
		{name: "explicit on", preference: &enabled, want: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := services.LiveCoinSupportEnabled(test.preference); got != test.want {
				t.Fatalf("coin support = %v, want %v", got, test.want)
			}
		})
	}
}
