package audiences_test

import (
	"strings"
	"testing"

	"nantty/modules/ads/src/modules/audiences/dtos"
	"nantty/modules/ads/src/modules/audiences/validators"
)

func TestCustomerListsAcceptOnlyLowercaseSha256DigestsAndDeduplicate(t *testing.T) {
	good := strings.Repeat("a", 64)
	hashes, err := validators.ValidateCustomerList(dtos.CustomerListRequest{Name: "VIPs", IdentifierType: "email", HashAlgorithm: "sha256", HashedIdentifiers: []string{good, good, strings.Repeat("b", 64)}})
	if err != nil || len(hashes) != 2 {
		t.Fatalf("expected two unique hashes, got %v %v", hashes, err)
	}
	for name, rows := range map[string][]string{"raw email": {"ada@example.com"}, "uppercase": {strings.Repeat("A", 64)}, "empty": {}} {
		if _, err := validators.ValidateCustomerList(dtos.CustomerListRequest{Name: "x", IdentifierType: "email", HashAlgorithm: "sha256", HashedIdentifiers: rows}); err == nil {
			t.Fatalf("%s must be rejected", name)
		}
	}
}

func TestLookalikeNeedsSimilarityBetweenOneAndTen(t *testing.T) {
	for _, percent := range []int{0, 11} {
		value := percent
		if validators.ValidateCreate(dtos.CreateAudienceRequest{Type: "lookalike", Name: "L", SourceAudienceId: "x", CountryCode: "NG", SimilarityPercent: &value}) == nil {
			t.Fatalf("similarity %d must be rejected", percent)
		}
	}
	five := 5
	if err := validators.ValidateCreate(dtos.CreateAudienceRequest{Type: "lookalike", Name: "L", SourceAudienceId: "x", CountryCode: "NG", SimilarityPercent: &five}); err != nil {
		t.Fatal(err)
	}
}
