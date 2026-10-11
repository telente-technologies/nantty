package configs

import "testing"

func TestWithdrawalDailyCapsFailClosedForUnconfiguredCurrencies(t *testing.T) {
	configured := WithdrawalLimits{DailyCapMinor: ParseLevelCurrencyCaps("1:NGN:100000")}
	if amount, capped := configured.DailyCapFor(1, "NGN"); !capped || amount != 100_000 {
		t.Fatalf("NGN cap: %d %v", amount, capped)
	}
	if _, capped := configured.DailyCapFor(2, "GHS"); capped {
		t.Fatal("a currency without a configured cap must report no cap, so withdrawals are refused")
	}
	if _, capped := configured.DailyCapFor(0, "NGN"); capped {
		t.Fatal("a level below every configured cap has no cap")
	}
	defaults := WithdrawalLimits{}
	for _, currency := range []string{"NGN", "GHS", "KES", "ZAR"} {
		if amount, capped := defaults.DailyCapFor(1, currency); !capped || amount <= 0 {
			t.Fatalf("default L1 cap missing for %s", currency)
		}
	}
	if _, capped := defaults.DailyCapFor(1, "USD"); capped {
		t.Fatal("currencies outside the defaults stay uncapped and therefore refused")
	}
}
