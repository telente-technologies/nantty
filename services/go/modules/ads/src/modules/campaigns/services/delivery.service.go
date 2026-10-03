package services

import (
	"context"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adstatsdaily"
	"zudomart/modules/ads/src/generated/ent/predicate"
	"zudomart/modules/ads/src/modules/campaigns/dtos"
	"zudomart/modules/ads/src/types"
)

type DeliveryWindow struct {
	From  string
	To    string
	Today string
}

type RawDelivery struct {
	Impressions      int64
	Reach            int64
	Clicks           int64
	SpendMicros      int64
	Conversions      int64
	ConversionValue  int64
	SpentTodayMicros int64
}

type deliveryRow struct {
	CampaignId      uuid.UUID `json:"campaign_id"`
	AdGroupId       uuid.UUID `json:"ad_group_id"`
	AdId            uuid.UUID `json:"ad_id"`
	Impressions     int64     `json:"sum_impressions"`
	Reach           int64     `json:"sum_reach"`
	Clicks          int64     `json:"sum_clicks"`
	Spend           int64     `json:"sum_spend"`
	Conversions     int64     `json:"sum_conversions"`
	ConversionValue int64     `json:"sum_conversion_value"`
}

func sumColumn(alias, column string) ent.AggregateFunc {
	return func(selector *sql.Selector) string { return sql.As(sql.Sum(selector.C(column)), alias) }
}

func (row deliveryRow) idFor(level string) uuid.UUID {
	switch level {
	case "ad":
		return row.AdId
	case "ad_group":
		return row.AdGroupId
	default:
		return row.CampaignId
	}
}

func idColumnForLevel(level string) string {
	switch level {
	case "ad":
		return adstatsdaily.FieldAdID
	case "ad_group":
		return adstatsdaily.FieldAdGroupID
	default:
		return adstatsdaily.FieldCampaignID
	}
}

func LoadDelivery(ctx context.Context, client *ent.Client, level string, ids []uuid.UUID, window DeliveryWindow) (map[uuid.UUID]RawDelivery, error) {
	result := make(map[uuid.UUID]RawDelivery, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	column := idColumnForLevel(level)
	conditions := []predicate.AdStatsDaily{predicate.AdStatsDaily(sql.FieldIn(column, ids...))}
	if window.From != "" {
		conditions = append(conditions, adstatsdaily.DayGTE(window.From))
	}
	if window.To != "" {
		conditions = append(conditions, adstatsdaily.DayLTE(window.To))
	}
	var rows []deliveryRow
	err := client.AdStatsDaily.Query().Where(conditions...).GroupBy(column).Aggregate(
		sumColumn("sum_impressions", adstatsdaily.FieldImpressions), sumColumn("sum_reach", adstatsdaily.FieldReach), sumColumn("sum_clicks", adstatsdaily.FieldClicks),
		sumColumn("sum_spend", adstatsdaily.FieldSpendMicros), sumColumn("sum_conversions", adstatsdaily.FieldConversions), sumColumn("sum_conversion_value", adstatsdaily.FieldConversionValueMinor),
	).Scan(ctx, &rows)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.idFor(level)] = RawDelivery{Impressions: row.Impressions, Reach: row.Reach, Clicks: row.Clicks, SpendMicros: row.Spend, Conversions: row.Conversions, ConversionValue: row.ConversionValue}
	}
	return result, loadSpentToday(ctx, client, level, ids, window.Today, result)
}

func loadSpentToday(ctx context.Context, client *ent.Client, level string, ids []uuid.UUID, today string, result map[uuid.UUID]RawDelivery) error {
	column := idColumnForLevel(level)
	var rows []deliveryRow
	err := client.AdStatsDaily.Query().Where(predicate.AdStatsDaily(sql.FieldIn(column, ids...)), adstatsdaily.Day(today)).GroupBy(column).
		Aggregate(sumColumn("sum_spend", adstatsdaily.FieldSpendMicros)).Scan(ctx, &rows)
	if err != nil {
		return err
	}
	for _, row := range rows {
		raw := result[row.idFor(level)]
		raw.SpentTodayMicros = row.Spend
		result[row.idFor(level)] = raw
	}
	return nil
}

func ResultsForObjective(objective string, raw RawDelivery) int64 {
	switch objective {
	case "awareness":
		return raw.Impressions
	case "sales":
		return raw.Conversions
	default:
		return raw.Clicks
	}
}

func PresentDelivery(raw RawDelivery, objective, currency string) dtos.DeliverySummary {
	spendMinor := raw.SpendMicros / types.MicrosPerMinorUnit
	summary := dtos.DeliverySummary{
		Impressions: raw.Impressions, Reach: raw.Reach, Clicks: raw.Clicks, Results: ResultsForObjective(objective, raw),
		Spend: types.Money{AmountMinor: spendMinor, Currency: currency}, ConversionValue: types.Money{AmountMinor: raw.ConversionValue, Currency: currency},
		SpentToday: types.Money{AmountMinor: raw.SpentTodayMicros / types.MicrosPerMinorUnit, Currency: currency},
	}
	if summary.Results > 0 {
		summary.CostPerResult = &types.Money{AmountMinor: spendMinor / summary.Results, Currency: currency}
	}
	return summary
}
