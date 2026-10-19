package getboostreport

import (
	"context"
	"sort"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	campaignservices "zudomart/modules/ads/src/modules/campaigns/services"
	reportingservices "zudomart/modules/ads/src/modules/reporting/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.BoostReport, error) {
	deployed := handler.Container
	boost, err := deployed.Client.AdBoost.Query().Where(adboost.ID(query.BoostId), adboost.UserID(query.UserId)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.BoostReport{}, adserrors.NotFound
	}
	if err != nil {
		return dtos.BoostReport{}, err
	}
	account, err := deployed.Client.AdAccount.Get(ctx, boost.AccountID)
	if err != nil {
		return dtos.BoostReport{}, err
	}
	today := adsservices.DayKeyInTimezone(deployed.Now(), account.Timezone)
	window := reportingservices.Window{AccountId: account.ID, From: adsservices.DayKeyInTimezone(boost.CreatedAt, account.Timezone), To: today, CampaignIds: []uuid.UUID{boost.CampaignID}}
	byDay, err := reportingservices.LoadByBreakdown(ctx, deployed.Client, window, "day")
	if err != nil {
		return dtos.BoostReport{}, err
	}
	days := make([]string, 0, len(byDay))
	for day := range byDay {
		days = append(days, day)
	}
	sort.Strings(days)
	report := dtos.BoostReport{Currency: boost.Currency, ResultLabel: services.KeyResultLabelFor(boost.Goal), Series: make([]dtos.BoostReportPoint, 0, len(days))}
	var totals reportingservices.RawMetrics
	for _, day := range days {
		raw := byDay[day]
		totals.Add(raw)
		report.Series = append(report.Series, dtos.BoostReportPoint{
			Date: day, Impressions: raw.Impressions, Reach: raw.Reach, Clicks: raw.Clicks, Results: resultsFor(boost.Goal, raw),
			Spend: types.Money{AmountMinor: raw.SpendMicros / types.MicrosPerMinorUnit, Currency: boost.Currency},
		})
	}
	report.Totals = dtos.BoostReportTotals{Impressions: totals.Impressions, Reach: totals.Reach, Clicks: totals.Clicks, Results: resultsFor(boost.Goal, totals),
		Spend: types.Money{AmountMinor: totals.SpendMicros / types.MicrosPerMinorUnit, Currency: boost.Currency}}
	if report.Totals.Results > 0 && report.Totals.Spend.AmountMinor > 0 {
		report.Totals.CostPerResult = &types.Money{AmountMinor: report.Totals.Spend.AmountMinor / report.Totals.Results, Currency: boost.Currency}
	}
	return report, nil
}

func resultsFor(goal adboost.Goal, raw reportingservices.RawMetrics) int64 {
	return services.KeyResultValue(goal, campaignservices.RawDelivery{Impressions: raw.Impressions, Reach: raw.Reach, Clicks: raw.Clicks, Conversions: raw.Conversions})
}
