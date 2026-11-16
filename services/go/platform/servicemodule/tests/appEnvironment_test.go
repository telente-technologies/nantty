package servicemodule_test

import (
	. "nantty/platform/servicemodule"
	"testing"
)

func TestOnlyKnownAppEnvironmentsAreAccepted(t *testing.T) {
	for _, value := range []string{"development", "staging", "production", "test"} {
		if !IsKnownAppEnvironment(value) {
			t.Fatalf("%q should be accepted", value)
		}
	}
	for _, value := range []string{"", "prod", "Production", "dev", "live"} {
		if IsKnownAppEnvironment(value) {
			t.Fatalf("%q must be refused so production-only checks never silently switch off", value)
		}
	}
}
