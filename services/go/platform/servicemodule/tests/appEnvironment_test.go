package servicemodule_test

import (
	. "nantty/platform/servicemodule"
	"testing"
	"time"
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

func TestHTTPWriteTimeoutForDeployable(t *testing.T) {
	if got, err := HTTPWriteTimeoutForDeployable("go-identity", 0); err != nil || got != 30*time.Second {
		t.Fatalf("identity default timeout = %s, %v", got, err)
	}
	if got, err := HTTPWriteTimeoutForDeployable("go-money", 0); err != nil || got != 30*time.Second {
		t.Fatalf("other service default timeout = %s, %v", got, err)
	}
	if got, err := HTTPWriteTimeoutForDeployable("go-identity", 30*time.Second); err != nil || got != 30*time.Second {
		t.Fatalf("identity timeout at provider-safe cap = %s, %v", got, err)
	}
	if _, err := HTTPWriteTimeoutForDeployable("go-identity", 35*time.Second); err == nil {
		t.Fatal("identity service must reject a timeout that reaches Smile's acknowledgement deadline")
	}
}
