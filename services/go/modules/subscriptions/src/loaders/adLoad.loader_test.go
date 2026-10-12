package loaders

import (
	"context"
	"encoding/json"
	"log/slog"
	"testing"
	"time"

	ledgerloaders "zudomart/modules/ledger/src/loaders"
	"zudomart/modules/subscriptions/src/constants"
)

func sourceWithPlans(document string) *ledgerloaders.PlatformSettingsSource {
	return ledgerloaders.NewPlatformSettingsSourceFromFetcher(func(_ context.Context, key string) (json.RawMessage, error) {
		return json.RawMessage(document), nil
	}, time.Minute, slog.New(slog.DiscardHandler))
}

func TestDefaultAdLoadByPlan(t *testing.T) {
	table := DefaultAdLoadTable()
	cases := map[string]struct {
		plans []string
		want  int
	}{
		"free":                        {nil, 100},
		"blue essential":              {[]string{constants.PlanBlueEssential}, 75},
		"blue verified":               {[]string{constants.PlanBlue}, 60},
		"gold only":                   {[]string{constants.PlanGoldOnly}, 50},
		"gold pro":                    {[]string{constants.PlanSellerPro}, 50},
		"gold business is ad-free":    {[]string{constants.PlanSellerBusiness}, 0},
		"black":                       {[]string{constants.PlanBlack}, 20},
		"premium is ad-free":          {[]string{constants.PlanPremium}, 0},
		"the lowest live plan wins":   {[]string{constants.PlanBlueEssential, constants.PlanBlack}, 20},
		"unknown plan keeps the load": {[]string{"retired_plan"}, 100},
	}
	for name, testCase := range cases {
		if got := table.PercentFor(testCase.plans); got != testCase.want {
			t.Errorf("%s: got %d want %d", name, got, testCase.want)
		}
	}
}

func TestAdLoadIsReadFromThePlansDocument(t *testing.T) {
	source := sourceWithPlans(`{"freeAdLoadPercent":90,"plans":[{"planKey":"BLUE_VERIFIED","adLoadPercent":40},{"planKey":"BLACK_OFFICIAL","adLoadPercent":10},{"planKey":"BLUE_PREMIUM","adLoadPercent":80},{"planKey":"GOLD_BUSINESS","adLoadPercent":30},{"planKey":"GOLD_PRO","adLoadPercent":250}]}`)
	table := ReadAdLoadTable(context.Background(), source)
	if table.FreePercent != 90 || table.PercentFor([]string{constants.PlanBlue}) != 40 || table.PercentFor([]string{constants.PlanBlack}) != 10 {
		t.Fatalf("configured loads must be used: %+v", table)
	}
	if table.PercentFor([]string{constants.PlanPremium}) != 0 || table.PercentFor([]string{constants.PlanSellerBusiness}) != 0 {
		t.Fatalf("ad-free plans stay at 0 even when the stored document says otherwise: %+v", table)
	}
	if table.PercentFor([]string{constants.PlanSellerPro}) != 90 {
		t.Fatalf("an out-of-range load is clamped to 100, then capped by the free load: %+v", table)
	}
	if table.PercentFor([]string{constants.PlanBlueEssential}) != 75 {
		t.Fatalf("plans missing from the document keep their default: %+v", table)
	}
}

func TestAdLoadFallsBackToDefaultsWhenTheDocumentIsBroken(t *testing.T) {
	if table := ReadAdLoadTable(context.Background(), sourceWithPlans(`not json`)); table.FreePercent != 100 || table.PercentFor([]string{constants.PlanBlack}) != 20 {
		t.Fatalf("defaults expected: %+v", table)
	}
}
