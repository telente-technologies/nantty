package dtos

import "zudomart/platform/money"

type MarketingCampaign struct {
	Id          string      `json:"id"`
	Kind        string      `json:"kind"`
	Name        string      `json:"name"`
	Status      string      `json:"status"`
	StartsAt    *string     `json:"startsAt"`
	EndsAt      *string     `json:"endsAt"`
	Reach       int         `json:"reach"`
	Redemptions int         `json:"redemptions"`
	Revenue     money.Money `json:"revenue"`
	Href        string      `json:"href"`
}

type MarketingOverview struct {
	ActiveCampaigns         int                 `json:"activeCampaigns"`
	ScheduledCampaigns      int                 `json:"scheduledCampaigns"`
	RedemptionsLast30Days   int                 `json:"redemptionsLast30Days"`
	RevenueLast30Days       money.Money         `json:"revenueLast30Days"`
	DiscountGivenLast30Days money.Money         `json:"discountGivenLast30Days"`
	Campaigns               []MarketingCampaign `json:"campaigns"`
}
