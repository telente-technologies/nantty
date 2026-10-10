package services

import (
	"slices"
	"testing"
	"time"
)

func TestNativeAppsOnlyOfferCardOrTheFreePremiumBoost(t *testing.T) {
	if methods := PaymentMethodsFor("ios", true); !slices.Equal(methods, []string{"card", "free"}) {
		t.Fatalf("ios: %v", methods)
	}
	if methods := PaymentMethodsFor("Android", false); !slices.Equal(methods, []string{"card"}) {
		t.Fatalf("android: %v", methods)
	}
	if methods := PaymentMethodsFor("web", true); !slices.Equal(methods, []string{"card", "balance", "free"}) {
		t.Fatalf("web: %v", methods)
	}
}

func TestFreeBoostPeriodsFollowTheAccountTimezone(t *testing.T) {
	lateOnTheLastDay := time.Date(2026, 10, 31, 23, 30, 0, 0, time.UTC)
	if period, resets := FreeBoostPeriod(lateOnTheLastDay, "Africa/Lagos"); period != "2026-11" || !resets.Equal(time.Date(2026, 11, 30, 23, 0, 0, 0, time.UTC)) {
		t.Fatalf("Lagos: %s %s", period, resets)
	}
	if period, _ := FreeBoostPeriod(lateOnTheLastDay, "not/a-zone"); period != "2026-10" {
		t.Fatalf("UTC fallback: %s", period)
	}
}
