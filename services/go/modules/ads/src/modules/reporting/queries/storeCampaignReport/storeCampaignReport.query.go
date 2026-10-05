package storecampaignreport

import (
	"time"

	"zudomart/modules/ads/src/types"
)

type Query struct {
	StoreId string
	From    time.Time
	To      time.Time
}

type Row struct {
	Campaign    string      `json:"campaign"`
	CampaignId  string      `json:"campaignId"`
	Status      string      `json:"status"`
	Spend       types.Money `json:"spend"`
	Impressions int64       `json:"impressions"`
	Clicks      int64       `json:"clicks"`
	Orders      int64       `json:"orders"`
	Revenue     types.Money `json:"revenue"`
}
