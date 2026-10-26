package dtos

import "nantty/platform/money"

type RewardSettingsRequest struct {
	Enabled                bool        `json:"enabled"`
	PercentBackBasisPoints int         `json:"percentBackBasisPoints"`
	MinimumOrder           money.Money `json:"minimumOrder"`
	MaxPerOrder            money.Money `json:"maxPerOrder"`
	ExpiryDays             int         `json:"expiryDays"`
}

type RewardSettingsView struct {
	Enabled                bool        `json:"enabled"`
	PercentBackBasisPoints int         `json:"percentBackBasisPoints"`
	MinimumOrder           money.Money `json:"minimumOrder"`
	MaxPerOrder            money.Money `json:"maxPerOrder"`
	ExpiryDays             int         `json:"expiryDays"`
}
