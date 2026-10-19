package dtos

import "encoding/json"

type AffiliationRequestDto struct {
	ProductId string `json:"productId"`
	StoreId   string `json:"storeId"`
	Message   string `json:"message"`
}

type SettingsPatchDto struct {
	Enabled                               *bool           `json:"enabled"`
	DefaultCommissionBasisPoints          *int64          `json:"defaultCommissionBasisPoints"`
	AutoApproveCreatorsWithFollowersAbove json.RawMessage `json:"autoApproveCreatorsWithFollowersAbove"`
	CookieWindowDays                      *int            `json:"cookieWindowDays"`
}

type ProductCommissionDto struct {
	CommissionBasisPoints *int64 `json:"commissionBasisPoints"`
	Excluded              *bool  `json:"excluded"`
}

type DecisionDto struct {
	Reason string `json:"reason"`
}

type CreatorStatusDto struct {
	Status string `json:"status"`
}

type AffiliateLinkRequestDto struct {
	ProductId string `json:"productId"`
}

type AffiliateLinkClickDto struct {
	VisitorId string `json:"visitorId"`
}
