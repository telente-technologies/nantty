package services_test

import (
	"testing"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/identityVerification/services"
)

func TestCaseViewIncludesProviderProductForMethodAwareReview(t *testing.T) {
	view := services.ConvertCaseToView(&ent.VerificationCase{SmileProduct: "enhanced_kyc"}, true)
	if view.Product != "enhanced_kyc" {
		t.Fatalf("case product = %q, want enhanced_kyc", view.Product)
	}
}
