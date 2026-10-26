package services

import (
	"testing"

	"nantty/modules/ads/src/types"
)

func TestRuleMetricsUseMajorUnitsAndRefuseEmptyDenominators(t *testing.T) {
	totals := DeliveryTotals{Impressions: 2_000, Reach: 1_000, Clicks: 20, SpendMicros: 1_000 * 100 * types.MicrosPerMinorUnit, ConversionValueMinor: 300_000}
	cases := map[string]float64{"cpc": 50, "cpm": 500, "ctr": 1, "spend": 1_000, "cost_per_result": 50, "frequency": 2, "roas": 3, "impressions": 2_000}
	for metric, want := range cases {
		if got, ok := MetricValue(metric, totals); !ok || got != want {
			t.Errorf("%s = %v %v, want %v", metric, got, ok, want)
		}
	}
	if _, ok := MetricValue("cpc", DeliveryTotals{}); ok {
		t.Error("cpc without clicks must be undefined")
	}
	if ConditionHolds(types.RuleCondition{Metric: "cpc", Operator: "less_than", Value: 100}, DeliveryTotals{}) {
		t.Error("an undefined metric must never trigger")
	}
}

func TestExperimentNeedsConfidenceBeforeNamingAWinner(t *testing.T) {
	strong := DecideExperiment("ctr", []ArmTotals{
		{AdSetId: "a", AdSetName: "A", Totals: DeliveryTotals{Impressions: 10_000, Clicks: 400}},
		{AdSetId: "b", AdSetName: "B", Totals: DeliveryTotals{Impressions: 10_000, Clicks: 200}},
	})
	if strong.WinnerAdSetId == nil || *strong.WinnerAdSetId != "a" || strong.ConfidencePercent < 99 {
		t.Fatalf("expected A to win clearly: %+v", strong)
	}
	weak := DecideExperiment("ctr", []ArmTotals{
		{AdSetId: "a", Totals: DeliveryTotals{Impressions: 100, Clicks: 3}},
		{AdSetId: "b", Totals: DeliveryTotals{Impressions: 100, Clicks: 2}},
	})
	if weak.WinnerAdSetId != nil {
		t.Fatalf("a tiny difference must not name a winner: %+v", weak)
	}
	cheaper := DecideExperiment("cost_per_result", []ArmTotals{
		{AdSetId: "a", Totals: DeliveryTotals{Impressions: 10_000, Clicks: 100, SpendMicros: 100_000 * types.MicrosPerMinorUnit}},
		{AdSetId: "b", Totals: DeliveryTotals{Impressions: 10_000, Clicks: 300, SpendMicros: 100_000 * types.MicrosPerMinorUnit}},
	})
	if cheaper.WinnerAdSetId == nil || *cheaper.WinnerAdSetId != "b" {
		t.Fatalf("lower cost per result wins: %+v", cheaper)
	}
}
