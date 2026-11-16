package services_test

import (
	"slices"
	"testing"
	"time"

	"nantty/modules/ads/src/modules/boosts/services"
)

func TestNativeAppsOnlyOfferCardOrTheFreePremiumBoost(t *testing.T) {
	if methods := services.PaymentMethodsFor("ios", true); !slices.Equal(methods, []string{"card", "free"}) {
		t.Fatalf("ios: %v", methods)
	}
	if methods := services.PaymentMethodsFor("Android", false); !slices.Equal(methods, []string{"card"}) {
		t.Fatalf("android: %v", methods)
	}
	if methods := services.PaymentMethodsFor("web", true); !slices.Equal(methods, []string{"card", "balance", "free"}) {
		t.Fatalf("web: %v", methods)
	}
}

func TestFreeBoostPeriodsFollowTheAccountTimezone(t *testing.T) {
	lateOnTheLastDay := time.Date(2026, 10, 31, 23, 30, 0, 0, time.UTC)
	if period, resets := services.FreeBoostPeriod(lateOnTheLastDay, "Africa/Lagos"); period != "2026-11" || !resets.Equal(time.Date(2026, 11, 30, 23, 0, 0, 0, time.UTC)) {
		t.Fatalf("Lagos: %s %s", period, resets)
	}
	if period, _ := services.FreeBoostPeriod(lateOnTheLastDay, "not/a-zone"); period != "2026-10" {
		t.Fatalf("UTC fallback: %s", period)
	}
}
