package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/types"
)

type DeliveryTotals struct {
	Impressions          int64
	Reach                int64
	Clicks               int64
	SpendMicros          int64
	Conversions          int64
	ConversionValueMinor int64
}

var levelColumns = map[string]string{"campaign": "campaign_id", "ad_set": "ad_group_id", "ad": "ad_id"}

func ReadDeliveryTotals(ctx context.Context, database *sql.DB, level string, targetId uuid.UUID, fromDay string) (DeliveryTotals, error) {
	column, known := levelColumns[level]
	if !known {
		return DeliveryTotals{}, nil
	}
	var totals DeliveryTotals
	err := database.QueryRowContext(ctx, `SELECT COALESCE(SUM(impressions), 0), COALESCE(SUM(reach), 0), COALESCE(SUM(clicks), 0), COALESCE(SUM(spend_micros), 0),
		COALESCE(SUM(conversions), 0), COALESCE(SUM(conversion_value_minor), 0) FROM ad_stats_dailies WHERE `+column+` = $1 AND day >= $2`, targetId, fromDay).
		Scan(&totals.Impressions, &totals.Reach, &totals.Clicks, &totals.SpendMicros, &totals.Conversions, &totals.ConversionValueMinor)
	return totals, err
}

func WindowStartDay(window string, now time.Time, timezone string) string {
	location, err := time.LoadLocation(timezone)
	if err != nil {
		location = time.UTC
	}
	local := now.In(location)
	switch window {
	case "today":
		return local.Format("2006-01-02")
	case "last_3_days":
		return local.AddDate(0, 0, -2).Format("2006-01-02")
	case "last_7_days":
		return local.AddDate(0, 0, -6).Format("2006-01-02")
	}
	return "0000-00-00"
}

func ratio(numerator, denominator float64) (float64, bool) {
	if denominator == 0 {
		return 0, false
	}
	return numerator / denominator, true
}

func MetricValue(metric string, totals DeliveryTotals) (float64, bool) {
	spendMajor := float64(totals.SpendMicros) / float64(types.MicrosPerMinorUnit) / 100
	results := totals.Conversions
	if results == 0 {
		results = totals.Clicks
	}
	switch metric {
	case "cpc":
		return ratio(spendMajor, float64(totals.Clicks))
	case "cpm":
		value, ok := ratio(spendMajor, float64(totals.Impressions))
		return value * 1000, ok
	case "ctr":
		value, ok := ratio(float64(totals.Clicks), float64(totals.Impressions))
		return value * 100, ok
	case "spend":
		return spendMajor, true
	case "cost_per_result":
		return ratio(spendMajor, float64(results))
	case "frequency":
		return ratio(float64(totals.Impressions), float64(totals.Reach))
	case "roas":
		return ratio(float64(totals.ConversionValueMinor)/100, spendMajor)
	case "impressions":
		return float64(totals.Impressions), true
	}
	return 0, false
}

func ConditionHolds(condition types.RuleCondition, totals DeliveryTotals) bool {
	value, defined := MetricValue(condition.Metric, totals)
	if !defined {
		return false
	}
	if condition.Operator == "greater_than" {
		return value > condition.Value
	}
	return value < condition.Value
}
