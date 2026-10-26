package getadcardreport

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adcardstatsdaily"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	campaignservices "nantty/modules/ads/src/modules/campaigns/services"
	adsservices "nantty/modules/ads/src/services"
)

type Query struct {
	AccountId uuid.UUID
	AdId      uuid.UUID
	UserId    uuid.UUID
	From      string
	To        string
}

type CardRow struct {
	CardIndex   int     `json:"cardIndex"`
	Headline    string  `json:"headline"`
	ImageUrl    string  `json:"imageUrl"`
	Impressions int64   `json:"impressions"`
	Clicks      int64   `json:"clicks"`
	Ctr         float64 `json:"ctr"`
}

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]CardRow, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionReportsView)
	if err != nil {
		return nil, err
	}
	row, err := (campaignservices.Loader{Client: deployed.Client, Now: deployed.Now}).FindAd(ctx, account.ID, query.AdId)
	if err != nil {
		return nil, err
	}
	rows := make([]CardRow, 0, len(row.Creative.Resolved.Cards))
	for index, card := range row.Creative.Resolved.Cards {
		rows = append(rows, CardRow{CardIndex: index, Headline: card.Headline, ImageUrl: card.Media.Url})
	}
	stats := deployed.Client.AdCardStatsDaily.Query().Where(adcardstatsdaily.AdID(row.ID))
	if query.From != "" {
		stats = stats.Where(adcardstatsdaily.DayGTE(query.From))
	}
	if query.To != "" {
		stats = stats.Where(adcardstatsdaily.DayLTE(query.To))
	}
	daily, err := stats.All(ctx)
	if err != nil {
		return nil, err
	}
	for _, day := range daily {
		if day.CardIndex < len(rows) {
			rows[day.CardIndex].Impressions += day.Impressions
			rows[day.CardIndex].Clicks += day.Clicks
		}
	}
	for index := range rows {
		if rows[index].Impressions > 0 {
			rows[index].Ctr = float64(rows[index].Clicks) / float64(rows[index].Impressions)
		}
	}
	return rows, nil
}
