package services

import (
	"zudomart/modules/ads/src/modules/reporting/dtos"
	"zudomart/modules/ads/src/types"
)

type RawMetrics struct {
	Impressions     int64
	Reach           int64
	Clicks          int64
	SpendMicros     int64
	Conversions     int64
	ConversionValue int64
	VideoViews      int64
}

func (raw *RawMetrics) Add(other RawMetrics) {
	raw.Impressions += other.Impressions
	raw.Reach += other.Reach
	raw.Clicks += other.Clicks
	raw.SpendMicros += other.SpendMicros
	raw.Conversions += other.Conversions
	raw.ConversionValue += other.ConversionValue
	raw.VideoViews += other.VideoViews
}

func ComputeMetrics(raw RawMetrics, currency string) dtos.ReportMetrics {
	spendMinor := raw.SpendMicros / types.MicrosPerMinorUnit
	metrics := dtos.ReportMetrics{
		Impressions: raw.Impressions, Reach: raw.Reach, Clicks: raw.Clicks, Spend: types.Money{AmountMinor: spendMinor, Currency: currency},
		Conversions: raw.Conversions, ConversionValue: types.Money{AmountMinor: raw.ConversionValue, Currency: currency}, VideoViews: raw.VideoViews,
	}
	if raw.Reach > 0 {
		metrics.Frequency = float64(raw.Impressions) / float64(raw.Reach)
	}
	if raw.Impressions > 0 {
		metrics.Ctr = float64(raw.Clicks) / float64(raw.Impressions)
		metrics.Cpm = &types.Money{AmountMinor: raw.SpendMicros * 1_000 / types.MicrosPerMinorUnit / raw.Impressions, Currency: currency}
	}
	if raw.Clicks > 0 {
		metrics.Cpc = &types.Money{AmountMinor: spendMinor / raw.Clicks, Currency: currency}
	}
	if spendMinor > 0 {
		roas := float64(raw.ConversionValue) / float64(spendMinor)
		metrics.Roas = &roas
	}
	return metrics
}

const privacyReachFloor = 100

func MergeSmallDemographicRows(rows map[string]RawMetrics) map[string]RawMetrics {
	merged := map[string]RawMetrics{}
	other := RawMetrics{}
	hasOther := false
	for key, raw := range rows {
		if raw.Reach < privacyReachFloor {
			other.Add(raw)
			hasOther = true
			continue
		}
		merged[key] = raw
	}
	if hasOther {
		merged["other"] = other
	}
	return merged
}
