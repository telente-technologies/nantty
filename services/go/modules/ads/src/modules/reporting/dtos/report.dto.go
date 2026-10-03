package dtos

import "zudomart/modules/ads/src/types"

type ReportMetrics struct {
	Impressions         int64        `json:"impressions"`
	Reach               int64        `json:"reach"`
	Frequency           float64      `json:"frequency"`
	Clicks              int64        `json:"clicks"`
	Ctr                 float64      `json:"ctr"`
	Cpc                 *types.Money `json:"cpc"`
	Cpm                 *types.Money `json:"cpm"`
	Spend               types.Money  `json:"spend"`
	Conversions         int64        `json:"conversions"`
	ConversionValue     types.Money  `json:"conversionValue"`
	Roas                *float64     `json:"roas"`
	VideoViews          int64        `json:"videoViews"`
	AverageWatchPercent *float64     `json:"averageWatchPercent"`
	FollowersGained     int64        `json:"followersGained"`
}

type ReportQuery struct {
	From            string   `json:"from"`
	To              string   `json:"to"`
	CompareFrom     *string  `json:"compareFrom"`
	CompareTo       *string  `json:"compareTo"`
	Breakdown       string   `json:"breakdown"`
	CampaignIds     []string `json:"campaignIds"`
	ClickWindowDays int      `json:"clickWindowDays"`
	ViewWindowDays  int      `json:"viewWindowDays"`
}

type ReportRow struct {
	Key        string         `json:"key"`
	Label      string         `json:"label"`
	Metrics    ReportMetrics  `json:"metrics"`
	Comparison *ReportMetrics `json:"comparison"`
}

type ReportSeriesPoint struct {
	Date    string        `json:"date"`
	Metrics ReportMetrics `json:"metrics"`
}

type ReportResponse struct {
	Currency         string              `json:"currency"`
	Query            ReportQuery         `json:"query"`
	Totals           ReportMetrics       `json:"totals"`
	ComparisonTotals *ReportMetrics      `json:"comparisonTotals"`
	Rows             []ReportRow         `json:"rows"`
	Series           []ReportSeriesPoint `json:"series"`
	ComparisonSeries []ReportSeriesPoint `json:"comparisonSeries"`
	GeneratedAt      string              `json:"generatedAt"`
}
