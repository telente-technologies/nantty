package httpserver_test

import (
	"errors"
	. "nantty/platform/httpserver"
	"net/http"
	"testing"
)

func TestErrorWithDetailsStillMatchesItsSentinel(t *testing.T) {
	sentinel := NewApiError(http.StatusUnprocessableEntity, "WALLET_DAILY_LIMIT", "limit")
	detailed := sentinel.WithDetails(map[string]any{"remainingMinor": 10})
	if !errors.Is(detailed, sentinel) || sentinel.Details != nil || detailed.Details["remainingMinor"] != 10 {
		t.Fatalf("details are copied and the sentinel still matches: %+v", detailed)
	}
	if errors.Is(detailed, NewApiError(http.StatusUnprocessableEntity, "OTHER", "x")) {
		t.Fatal("a different code must not match")
	}
}
