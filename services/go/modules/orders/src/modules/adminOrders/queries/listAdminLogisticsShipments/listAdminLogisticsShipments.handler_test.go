package listadminlogistics

import "testing"

func TestShipmentStatusFilterAllowlist(t *testing.T) {
	for _, status := range []string{"pending", "quoted", "booked", "picked_up", "in_transit", "delivered", "cancelled", "failed"} {
		if !ValidShipmentStatus(status) {
			t.Errorf("expected status %q to be accepted", status)
		}
	}
	for _, status := range []string{"", "unknown", "FAILED", "open"} {
		if ValidShipmentStatus(status) {
			t.Errorf("expected status %q to be rejected", status)
		}
	}
}

func TestSafeTrackingNumber(t *testing.T) {
	valid := "ABCD-1234"
	invalid := "<script>"
	if got := safeTrackingNumber(&valid); got == nil || *got != valid {
		t.Fatalf("valid tracking number was not preserved: %v", got)
	}
	if got := safeTrackingNumber(&invalid); got != nil {
		t.Fatalf("invalid tracking number must be omitted: %v", got)
	}
	if got := safeTrackingNumber(nil); got != nil {
		t.Fatalf("missing tracking number must remain null: %v", got)
	}
}

func TestSafeTrackingURL(t *testing.T) {
	valid := "https://carrier.example/track/ABCD-1234?key=opaque"
	if got := safeTrackingURL(&valid); got == nil || *got != valid {
		t.Fatalf("valid HTTPS tracking URL was not preserved: %v", got)
	}
	for _, candidate := range []string{
		"http://carrier.example/track/1234",
		"https:///track/1234",
		"https://user:password@carrier.example/track/1234",
		" https://carrier.example/track/1234",
		"https://carrier.example/" + string(make([]byte, 301)),
	} {
		if got := safeTrackingURL(&candidate); got != nil {
			t.Errorf("unsafe tracking URL must be omitted: %q", candidate)
		}
	}
	if got := safeTrackingURL(nil); got != nil {
		t.Fatalf("missing tracking URL must remain null: %v", got)
	}
}

func TestClaimSummaryOnlyReturnsAllowlistedCategories(t *testing.T) {
	for _, kind := range []string{"loss", "damage", "delay", "failed_delivery", "not_received", "wrong_item"} {
		if got := safeClaimKind(kind); got != kind {
			t.Errorf("safe kind %q became %q", kind, got)
		}
	}
	if got := safeClaimKind("email@example.test +2348000000000"); got != "other" {
		t.Fatalf("free-text claim kind leaked: %q", got)
	}
	for _, status := range []string{"open", "reviewing", "approved", "rejected", "resolved", "closed"} {
		if got := safeClaimStatus(status); got != status {
			t.Errorf("safe status %q became %q", status, got)
		}
	}
	if got := safeClaimStatus("buyer phone +2348000000000"); got != "other" {
		t.Fatalf("free-text claim status leaked: %q", got)
	}
}
