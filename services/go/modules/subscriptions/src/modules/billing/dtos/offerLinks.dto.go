package dtos

import "time"

type OfferAmountDto struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type CreateOfferLinkRequestDto struct {
	Label          string          `json:"label"`
	PlanCodes      []string        `json:"planCodes"`
	DiscountKind   string          `json:"discountKind"`
	PercentOff     int64           `json:"percentOff"`
	AmountOff      *OfferAmountDto `json:"amountOff"`
	SingleUse      bool            `json:"singleUse"`
	MaxClaims      int             `json:"maxClaims"`
	DurationCycles int             `json:"durationCycles"`
	ExpiresAt      *time.Time      `json:"expiresAt"`
	Reason         string          `json:"reason"`
}

type RevokeOfferLinkRequestDto struct {
	Reason string `json:"reason"`
}

type SendOfferLinkRequestDto struct {
	RecipientEmails []string `json:"recipientEmails"`
	Note            string   `json:"note"`
	Reason          string   `json:"reason"`
}

type ClaimOfferRequestDto struct {
	ProfileId string `json:"profileId"`
}
