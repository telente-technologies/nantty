package storecampaignreport

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/types"
)

type Handler struct{ Container *container.Container }

type campaignTotals struct {
	impressions, clicks, spendMicros, orders, revenueMinor int64
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]Row, error) {
	deployed := handler.Container
	accounts, err := deployed.Client.AdAccount.Query().Where(adaccount.StoreID(query.StoreId)).All(ctx)
	if err != nil || len(accounts) == 0 {
		return []Row{}, err
	}
	currencies, accountIds := map[uuid.UUID]string{}, make([]uuid.UUID, 0, len(accounts))
	for _, account := range accounts {
		currencies[account.ID], accountIds = account.Currency, append(accountIds, account.ID)
	}
	totals, err := handler.readTotals(ctx, accountIds, query)
	if err != nil {
		return nil, err
	}
	campaigns, err := deployed.Client.AdCampaign.Query().Where(adcampaign.AccountIDIn(accountIds...)).Order(ent.Desc(adcampaign.FieldCreatedAt)).Limit(500).All(ctx)
	if err != nil {
		return nil, err
	}
	rows := make([]Row, 0, len(campaigns))
	for _, campaign := range campaigns {
		total, delivered := totals[campaign.ID]
		if !delivered && campaign.Status != adcampaign.StatusActive {
			continue
		}
		currency := currencies[campaign.AccountID]
		rows = append(rows, Row{
			Campaign: campaign.Name, CampaignId: campaign.ID.String(), Status: string(campaign.Status), Impressions: total.impressions, Clicks: total.clicks, Orders: total.orders,
			Spend: types.Money{AmountMinor: total.spendMicros / types.MicrosPerMinorUnit, Currency: currency}, Revenue: types.Money{AmountMinor: total.revenueMinor, Currency: currency},
		})
	}
	return rows, nil
}

func (handler Handler) readTotals(ctx context.Context, accountIds []uuid.UUID, query Query) (map[uuid.UUID]campaignTotals, error) {
	totals := map[uuid.UUID]campaignTotals{}
	for _, accountId := range accountIds {
		result, err := handler.Container.Database.QueryContext(ctx, `SELECT campaign_id, SUM(impressions), SUM(clicks), SUM(spend_micros), SUM(conversions), SUM(conversion_value_minor)
			FROM ad_stats_dailies WHERE account_id = $1 AND day >= $2 AND day <= $3 GROUP BY campaign_id`, accountId, query.From.Format(time.DateOnly), query.To.Format(time.DateOnly))
		if err != nil {
			return nil, err
		}
		for result.Next() {
			var campaignId uuid.UUID
			var total campaignTotals
			if err := result.Scan(&campaignId, &total.impressions, &total.clicks, &total.spendMicros, &total.orders, &total.revenueMinor); err != nil {
				result.Close()
				return nil, err
			}
			totals[campaignId] = total
		}
		if err := result.Close(); err != nil {
			return nil, err
		}
	}
	return totals, nil
}
