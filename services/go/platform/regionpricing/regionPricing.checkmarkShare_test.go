package regionpricing

import "testing"

func TestCheckmarkShareIsStandalonePriceCappedAtAmountPaid(t *testing.T) {
	cases := []struct {
		name                   string
		standalone, paid, want int64
	}{
		{"seller plan pays more than the checkmark", 300_000, 500_000, 300_000},
		{"discounted bundle pays less than the standalone price", 300_000, 255_000, 255_000},
		{"nothing paid", 300_000, 0, 0},
		{"unknown standalone price", 0, 500_000, 0},
		{"negative inputs never refund", -1, 500_000, 0},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := CheckmarkShareMinor(testCase.standalone, testCase.paid); got != testCase.want {
				t.Fatalf("got %d, want %d", got, testCase.want)
			}
		})
	}
}

func TestDefaultCheckmarkStandalonePriceFollowsRegionChannelAndInterval(t *testing.T) {
	if got := DefaultCheckmarkStandalonePrice("gold", "NGN", "web", "month"); got != 300_000 {
		t.Fatalf("Gold web month in NGN = %d", got)
	}
	if got := DefaultCheckmarkStandalonePrice("blue", "NGN", "android", "month"); got != 290_000 {
		t.Fatalf("Blue android month in NGN = %d", got)
	}
	if got := DefaultCheckmarkStandalonePrice("blue", "NGN", "web", "year"); got != YearlyFromMonthly(250_000, DefaultYearlyDiscountBps, "NGN") {
		t.Fatalf("Blue web year in NGN = %d", got)
	}
	if got := DefaultCheckmarkStandalonePrice("gold", "NGN", "ios", "month"); got != 300_000 {
		t.Fatalf("Gold has no app price so the web price applies, got %d", got)
	}
	if got := DefaultCheckmarkStandalonePrice("blue", "JPY", "web", "month"); got != 0 {
		t.Fatalf("unsupported currency = %d", got)
	}
}
