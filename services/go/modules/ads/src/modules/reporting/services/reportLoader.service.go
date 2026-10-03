package services

import (
	"context"
	"slices"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	"zudomart/modules/ads/src/generated/ent/adstatsdaily"
	"zudomart/modules/ads/src/generated/ent/predicate"
)

var breakdownColumns = map[string]string{
	"campaign": adstatsdaily.FieldCampaignID, "ad_set": adstatsdaily.FieldAdGroupID, "ad": adstatsdaily.FieldAdID, "placement": adstatsdaily.FieldPlacement,
	"day": adstatsdaily.FieldDay, "country": adstatsdaily.FieldCountry, "state": adstatsdaily.FieldRegion, "age": adstatsdaily.FieldAgeBand, "gender": adstatsdaily.FieldGender,
}

func IsKnownBreakdown(breakdown string) bool { _, known := breakdownColumns[breakdown]; return known }

func IsDemographicBreakdown(breakdown string) bool {
	return slices.Contains([]string{"country", "state", "age", "gender"}, breakdown)
}

type statsRow struct {
	CampaignId      string `json:"campaign_id"`
	AdGroupId       string `json:"ad_group_id"`
	AdId            string `json:"ad_id"`
	Placement       string `json:"placement"`
	Day             string `json:"day"`
	Country         string `json:"country"`
	Region          string `json:"region"`
	AgeBand         string `json:"age_band"`
	Gender          string `json:"gender"`
	Impressions     int64  `json:"sum_impressions"`
	Reach           int64  `json:"sum_reach"`
	Clicks          int64  `json:"sum_clicks"`
	Spend           int64  `json:"sum_spend"`
	Conversions     int64  `json:"sum_conversions"`
	ConversionValue int64  `json:"sum_conversion_value"`
	VideoViews      int64  `json:"sum_video_views"`
}

func (row statsRow) keyFor(breakdown string) string {
	return map[string]string{"campaign": row.CampaignId, "ad_set": row.AdGroupId, "ad": row.AdId, "placement": row.Placement, "day": row.Day, "country": row.Country, "state": row.Region, "age": row.AgeBand, "gender": row.Gender}[breakdown]
}

func sum(alias, column string) ent.AggregateFunc {
	return func(selector *sql.Selector) string { return sql.As(sql.Sum(selector.C(column)), alias) }
}

type Window struct {
	AccountId   uuid.UUID
	From        string
	To          string
	CampaignIds []uuid.UUID
}

func LoadByBreakdown(ctx context.Context, client *ent.Client, window Window, breakdown string) (map[string]RawMetrics, error) {
	column := breakdownColumns[breakdown]
	filters := []predicate.AdStatsDaily{adstatsdaily.AccountID(window.AccountId), adstatsdaily.DayGTE(window.From), adstatsdaily.DayLTE(window.To)}
	if len(window.CampaignIds) > 0 {
		filters = append(filters, adstatsdaily.CampaignIDIn(window.CampaignIds...))
	}
	var rows []statsRow
	err := client.AdStatsDaily.Query().Where(filters...).GroupBy(column).Aggregate(
		sum("sum_impressions", adstatsdaily.FieldImpressions), sum("sum_reach", adstatsdaily.FieldReach), sum("sum_clicks", adstatsdaily.FieldClicks), sum("sum_spend", adstatsdaily.FieldSpendMicros),
		sum("sum_conversions", adstatsdaily.FieldConversions), sum("sum_conversion_value", adstatsdaily.FieldConversionValueMinor), sum("sum_video_views", adstatsdaily.FieldVideoViews),
	).Scan(ctx, &rows)
	if err != nil {
		return nil, err
	}
	result := make(map[string]RawMetrics, len(rows))
	for _, row := range rows {
		result[row.keyFor(breakdown)] = RawMetrics{Impressions: row.Impressions, Reach: row.Reach, Clicks: row.Clicks, SpendMicros: row.Spend, Conversions: row.Conversions, ConversionValue: row.ConversionValue, VideoViews: row.VideoViews}
	}
	return result, nil
}

func LabelsFor(ctx context.Context, client *ent.Client, accountId uuid.UUID, breakdown string, keys []string) (map[string]string, error) {
	ids := make([]uuid.UUID, 0, len(keys))
	for _, key := range keys {
		if parsed, err := uuid.Parse(key); err == nil {
			ids = append(ids, parsed)
		}
	}
	labels := map[string]string{}
	switch breakdown {
	case "campaign":
		rows, err := client.AdCampaign.Query().Where(adcampaign.AccountID(accountId), adcampaign.IDIn(ids...)).All(ctx)
		for _, row := range rows {
			labels[row.ID.String()] = row.Name
		}
		return labels, err
	case "ad_set":
		rows, err := client.AdGroup.Query().Where(adgroup.AccountID(accountId), adgroup.IDIn(ids...)).All(ctx)
		for _, row := range rows {
			labels[row.ID.String()] = row.Name
		}
		return labels, err
	case "ad":
		rows, err := client.Ad.Query().Where(ad.AccountID(accountId), ad.IDIn(ids...)).All(ctx)
		for _, row := range rows {
			labels[row.ID.String()] = row.Name
		}
		return labels, err
	}
	return labels, nil
}
