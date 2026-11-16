package services_test

import (
	"testing"

	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/services"
)

func TestBvnDecisionNeedsMatchingNamesAndNoWatchlistHit(t *testing.T) {
	clean := interfaces.BvnIdentity{FirstName: "TEMITOPE", LastName: "ADEYEMI", Status: "COMPLETED"}
	if reason := services.BvnIdentityRejectionReason(clean, "Temitope Adeyemi", "ADEYEMI TEMITOPE O"); reason != "" {
		t.Fatalf("matching names must pass: %s", reason)
	}
	if reason := services.BvnIdentityRejectionReason(clean, "Chukwuemeka Obi", ""); reason == "" {
		t.Fatal("a different legal name must be refused")
	}
	if reason := services.BvnIdentityRejectionReason(clean, "Temitope Adeyemi", "CHUKWUEMEKA OBI"); reason == "" {
		t.Fatal("a bank account in another name must be refused")
	}
	watchlisted := clean
	watchlisted.Watchlisted = true
	if reason := services.BvnIdentityRejectionReason(watchlisted, "Temitope Adeyemi", ""); reason == "" {
		t.Fatal("a watchlisted BVN goes to manual review, never straight to a wallet")
	}
}
