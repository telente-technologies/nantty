package integrations

import "testing"

func TestPublishedPayoutFeeDefaults(t *testing.T) {
	provider := NewBachsConnectProvider(BachsConnectSettings{})
	cases := []struct {
		currency string
		amount   int64
		want     int64
	}{
		{"NGN", 50_000_000, 5_000},
		{"USD", 8_000, 100},
		{"USD", 1_000_000, 1_500},
		{"USD", 50_000, 500},
		{"GHS", 100_000, 300},
	}
	for _, testCase := range cases {
		got, err := provider.QuotePayoutFee(testCase.currency, testCase.amount)
		if err != nil || got != testCase.want {
			t.Fatalf("%s %d: got %d err %v want %d", testCase.currency, testCase.amount, got, err, testCase.want)
		}
	}
}

func TestPayoutFeeScheduleOverrides(t *testing.T) {
	provider := NewBachsConnectProvider(BachsConnectSettings{PayoutFeeRules: ParsePayoutFeeRules("NGN:flat=7500;bad;USD:oops=1")})
	if fee, _ := provider.QuotePayoutFee("NGN", 100); fee != 7_500 {
		t.Fatalf("override ignored: %d", fee)
	}
	if fee, _ := provider.QuotePayoutFee("USD", 50_000); fee != 500 {
		t.Fatalf("malformed entry changed default: %d", fee)
	}
	flat := NewBachsConnectProvider(BachsConnectSettings{PayoutFeeMinorByCurrency: map[string]int64{"NGN": 6_000}})
	if fee, _ := flat.QuotePayoutFee("NGN", 100); fee != 6_000 {
		t.Fatalf("flat override ignored: %d", fee)
	}
}
