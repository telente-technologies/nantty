package dtos

import (
	"time"

	"zudomart/platform/money"
)

type DiscountInput struct {
	Kind  string `json:"kind"`
	Value int64  `json:"value"`
}

type ScopeInput struct {
	Kind string   `json:"kind"`
	Ids  []string `json:"ids"`
}

type PromotionRequest struct {
	Name                  *string        `json:"name"`
	Kind                  *string        `json:"kind"`
	Code                  *string        `json:"code"`
	Discount              *DiscountInput `json:"discount"`
	Scope                 *ScopeInput    `json:"scope"`
	MinimumSpendMinor     **int64        `json:"minimumSpendMinor"`
	UsageLimit            **int          `json:"usageLimit"`
	UsageLimitPerCustomer **int          `json:"usageLimitPerCustomer"`
	StartsAt              *time.Time     `json:"startsAt"`
	EndsAt                **time.Time    `json:"endsAt"`
	Status                *string        `json:"status"`
}

type ValidateCodeRequest struct {
	Code          string `json:"code"`
	SubtotalMinor int64  `json:"subtotalMinor"`
}

type PromotionView struct {
	Id                    string        `json:"id"`
	Name                  string        `json:"name"`
	Kind                  string        `json:"kind"`
	Code                  *string       `json:"code"`
	Discount              DiscountInput `json:"discount"`
	Scope                 ScopeInput    `json:"scope"`
	MinimumSpend          *money.Money  `json:"minimumSpend"`
	UsageLimit            *int          `json:"usageLimit"`
	UsageLimitPerCustomer *int          `json:"usageLimitPerCustomer"`
	UsedCount             int           `json:"usedCount"`
	StartsAt              time.Time     `json:"startsAt"`
	EndsAt                *time.Time    `json:"endsAt"`
	Status                string        `json:"status"`
	CreatedAt             time.Time     `json:"createdAt"`
}

type ValidatedCodeView struct {
	PromotionId   string        `json:"promotionId"`
	Code          string        `json:"code"`
	Discount      DiscountInput `json:"discount"`
	Scope         ScopeInput    `json:"scope"`
	DiscountMinor int64         `json:"discountMinor"`
	Message       string        `json:"message"`
}
