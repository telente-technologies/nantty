package dtos

import "encoding/json"

type SubmitRequest struct {
	Kind               string          `json:"kind"`
	ClaimantBrandId    string          `json:"claimantBrandId"`
	ClaimantBrand      json.RawMessage `json:"claimantBrand"`
	ClaimantUserId     string          `json:"claimantUserId"`
	AccusedSellerId    string          `json:"accusedSellerId"`
	ListingId          string          `json:"listingId"`
	Listing            json.RawMessage `json:"listing"`
	Statement          string          `json:"statement"`
	TrademarkReference string          `json:"trademarkReference"`
	Evidence           json.RawMessage `json:"evidence"`
}

type DecideRequest struct {
	Reason    string `json:"reason"`
	AddStrike *bool  `json:"addStrike"`
}

type RespondRequest struct {
	Statement string `json:"statement"`
}
