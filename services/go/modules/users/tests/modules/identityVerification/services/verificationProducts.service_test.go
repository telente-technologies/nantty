package services_test

import (
	"testing"

	"nantty/modules/users/src/integrations"
	"nantty/modules/users/src/modules/identityVerification/services"
)

func TestIsPersonalIdentityNumberTypeExcludesBankVerification(t *testing.T) {
	tests := []struct {
		name string
		item integrations.SmileIdSupportedKycType
		want bool
	}{
		{name: "national identity number", item: integrations.SmileIdSupportedKycType{Country: "NG", Type: "NIN_V2", RequiredFields: []string{"first_name", "last_name"}}, want: true},
		{name: "bank type", item: integrations.SmileIdSupportedKycType{Country: "NG", Type: "BANK_ACCOUNT"}},
		{name: "bank code metadata", item: integrations.SmileIdSupportedKycType{Country: "NG", Type: "ACCOUNT_NUMBER", BankCode: "058"}},
		{name: "bank code field", item: integrations.SmileIdSupportedKycType{Country: "NG", Type: "ACCOUNT_NUMBER", RequiredFields: []string{"bank_code"}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := services.IsPersonalIdentityNumberType(test.item); got != test.want {
				t.Fatalf("IsPersonalIdentityNumberType(%+v) = %t, want %t", test.item, got, test.want)
			}
		})
	}
}

func TestCountryNameFromCodeUsesEnglishDisplayNameWithSafeFallback(t *testing.T) {
	if got := services.CountryNameFromCode("ng"); got != "Nigeria" {
		t.Fatalf("CountryNameFromCode(ng) = %q, want Nigeria", got)
	}
	if got := services.CountryNameFromCode("?"); got != "?" {
		t.Fatalf("invalid country code should be returned unchanged, got %q", got)
	}
}

func TestSmileProductForSelectionKeepsDocumentProductsSeparateFromIdNumbers(t *testing.T) {
	for _, test := range []struct {
		method, product, want string
		ok                    bool
	}{
		{method: services.VerificationMethodDocument, product: "document_verification", want: "document_verification", ok: true},
		{method: services.VerificationMethodDocument, product: "enhanced_document_verification", want: "enhanced_document_verification", ok: true},
		{method: services.VerificationMethodIdNumber, product: "enhanced_kyc", want: "enhanced_kyc", ok: true},
		{method: services.VerificationMethodIdNumber, product: "document_verification", ok: false},
		{method: services.VerificationMethodDocument, product: "enhanced_kyc", ok: false},
		// Residency verification is intentionally outside the checkmark flow and
		// Smile Links do not support this product. Keep unknown product requests closed.
		{method: services.VerificationMethodDocument, product: "residency_document_verification", ok: false},
	} {
		got, ok := services.SmileProductForSelection(test.method, "NG", "NIN_V2", test.product)
		if got != test.want || ok != test.ok {
			t.Fatalf("SmileProductForSelection(%q, %q) = (%q, %t), want (%q, %t)", test.method, test.product, got, ok, test.want, test.ok)
		}
	}
}

func TestSmileDocumentTypeAllowedUsesGlobalCatalogByDefaultAndHonorsOptionalRestriction(t *testing.T) {
	if !services.SmileDocumentTypeAllowed(nil, "US", "PASSPORT") {
		t.Fatal("an enabled Standard Document Verification product should use the complete public supported-document catalog by default")
	}
	allowed := []string{"NG:PASSPORT"}
	if !services.SmileDocumentTypeAllowed(allowed, "NG", "PASSPORT") || services.SmileDocumentTypeAllowed(allowed, "US", "PASSPORT") {
		t.Fatal("a configured optional country/type restriction must be applied exactly")
	}
}
