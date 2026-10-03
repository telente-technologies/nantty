package submitipclaim

import "encoding/json"

type Command struct {
	IdempotencyKey     string
	Kind               string
	ClaimantBrandId    string
	ClaimantBrand      json.RawMessage
	ClaimantUserId     string
	AccusedSellerId    string
	ListingId          string
	Listing            json.RawMessage
	Statement          string
	TrademarkReference string
	Evidence           json.RawMessage
}

type Result struct {
	ClaimId  string `json:"claimId"`
	Status   string `json:"status"`
	Replayed bool   `json:"-"`
}
