package controllers

import (
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	commonv1 "zudomart/contracts/gen/go/zudomart/common/v1"
)

func TestBoostRequestsAreValidatedBeforeTouchingTheLedger(t *testing.T) {
	cases := []struct {
		name   string
		amount *commonv1.Money
		key    string
		debit  string
		refund bool
		valid  bool
	}{
		{"debit", &commonv1.Money{AmountMinor: 500_000, Currency: "NGN"}, "boost-key-123", "", false, true},
		{"refund", &commonv1.Money{AmountMinor: 100, Currency: "NGN"}, "refund-boost-key-123", "boost-key-123", true, true},
		{"refund without debit key", &commonv1.Money{AmountMinor: 100, Currency: "NGN"}, "refund-boost-key-123", "", true, false},
		{"zero amount", &commonv1.Money{AmountMinor: 0, Currency: "NGN"}, "boost-key-123", "", false, false},
		{"other currency", &commonv1.Money{AmountMinor: 100, Currency: "USD"}, "boost-key-123", "", false, false},
		{"short key", &commonv1.Money{AmountMinor: 100, Currency: "NGN"}, "k", "", false, false},
	}
	for _, testCase := range cases {
		_, err := convertBoostRequest("user-1", testCase.amount, testCase.key, testCase.debit, testCase.refund)
		if testCase.valid != (err == nil) || (!testCase.valid && status.Code(err) != codes.InvalidArgument) {
			t.Fatalf("%s: %v", testCase.name, err)
		}
	}
}
