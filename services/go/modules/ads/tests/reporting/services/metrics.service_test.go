package services_test

import (
	"testing"

	"nantty/modules/ads/src/modules/reporting/services"
)

func TestComputeMetricsDerivesRatesFromRawCounters(t *testing.T) {
	metrics := services.ComputeMetrics(services.RawMetrics{Impressions: 10_000, Reach: 4_000, Clicks: 250, SpendMicros: 500_000 * 1_000_000, Conversions: 10, ConversionValue: 2_000_000, VideoViews: 3_000}, "NGN")
	if metrics.Ctr != 0.025 || metrics.Frequency != 2.5 {
		t.Fatalf("ctr %v frequency %v", metrics.Ctr, metrics.Frequency)
	}
	if metrics.Spend.AmountMinor != 500_000 || metrics.Cpc.AmountMinor != 2_000 || metrics.Cpm.AmountMinor != 50_000 {
		t.Fatalf("cost metrics wrong: %+v %+v %+v", metrics.Spend, metrics.Cpc, metrics.Cpm)
	}
	if metrics.Roas == nil || *metrics.Roas != 4 {
		t.Fatalf("roas should be conversion value over spend, got %v", metrics.Roas)
	}
}

func TestComputeMetricsHandlesZeroDenominators(t *testing.T) {
	metrics := services.ComputeMetrics(services.RawMetrics{}, "NGN")
	if metrics.Cpc != nil || metrics.Cpm != nil || metrics.Roas != nil || metrics.Ctr != 0 {
		t.Fatalf("empty window must not divide by zero: %+v", metrics)
	}
}

func TestSmallDemographicRowsMergeIntoOther(t *testing.T) {
	rows := services.MergeSmallDemographicRows(map[string]services.RawMetrics{"NG": {Reach: 500, Impressions: 900}, "GH": {Reach: 40, Impressions: 50}, "KE": {Reach: 60, Impressions: 70}})
	if len(rows) != 2 || rows["other"].Impressions != 120 || rows["NG"].Impressions != 900 {
		t.Fatalf("rows under 100 people must be merged, got %+v", rows)
	}
}
