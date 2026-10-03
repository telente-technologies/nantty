package dtos

type FrequencyPolicy struct {
	Format                   string `json:"format"`
	SessionCap               int    `json:"sessionCap"`
	HourCap                  int    `json:"hourCap"`
	DayCap                   int    `json:"dayCap"`
	AdvertiserDayCap         int    `json:"advertiserDayCap"`
	MinGapSlots              int    `json:"minGapSlots"`
	CooldownSecondsAfterSkip int    `json:"cooldownSecondsAfterSkip"`
	Active                   bool   `json:"active"`
}

type AdPolicies struct {
	Frequency []FrequencyPolicy `json:"frequency"`
}

type PremiumConsumption struct {
	CreatorUserId string `json:"creatorUserId"`
	WatchSeconds  int64  `json:"watchSeconds"`
}

type PremiumPoolRequest struct {
	Month       string               `json:"month"`
	Currency    string               `json:"currency"`
	PoolMinor   int64                `json:"poolMinor"`
	Consumption []PremiumConsumption `json:"consumption"`
}

type PremiumAllocation struct {
	CreatorUserId string `json:"creatorUserId"`
	AmountMinor   int64  `json:"amountMinor"`
}

type PremiumPoolResult struct {
	Allocations []PremiumAllocation `json:"allocations"`
}
