package validators

import (
	"testing"

	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

func TestPayoutAccountNumbersFollowCountryRules(t *testing.T) {
	cases := []struct {
		country, number string
		valid           bool
	}{{"NG", "0123456789", true}, {"NG", "012345678", false}, {"GH", "1234567890123", true}, {"KE", "1234567", false}, {"ZA", "123456789", true}, {"GB", "GB33BUKB20201555555555", true}, {"GB", "12-34", false}}
	for _, testCase := range cases {
		err := ValidateResolvePayoutAccount(testCase.country)(dtos.ResolvePayoutAccountBody{BankCode: "058", AccountNumber: testCase.number})
		if (err == nil) != testCase.valid {
			t.Errorf("%s %s: valid=%v, got %v", testCase.country, testCase.number, testCase.valid, err)
		}
	}
}

func TestScheduleNeedsAnAccountUnlessManual(t *testing.T) {
	if err := ValidateSavePayoutSchedule(dtos.SavePayoutScheduleBody{Mode: "weekly", Weekday: 1, DayOfMonth: 1}); err == nil {
		t.Fatal("automatic payouts need an account")
	}
	if err := ValidateSavePayoutSchedule(dtos.SavePayoutScheduleBody{Mode: "manual", Weekday: 1, DayOfMonth: 1}); err != nil {
		t.Fatalf("manual needs no account: %v", err)
	}
	if err := ValidateSavePayoutSchedule(dtos.SavePayoutScheduleBody{Mode: "monthly", Weekday: 7, DayOfMonth: 29, KeepMinimumBalanceMinor: -1}); err == nil {
		t.Fatal("bad weekday, day of month and balance must fail")
	}
	if err := ValidateRequestPayout(dtos.RequestPayoutBody{AmountMinor: 0, AccountId: "nope"}); err == nil {
		t.Fatal("payouts need a positive amount and an account id")
	}
}
