package events

const (
	IpClaimReceivedType = "ipClaim.received"
	IpClaimDecidedType  = "ipClaim.decided"
)

type ReceivedData struct {
	ClaimId         string `json:"claimId"`
	Kind            string `json:"kind"`
	AccusedSellerId string `json:"accusedSellerId"`
	ListingId       string `json:"listingId"`
}

type DecidedData struct {
	ClaimId         string `json:"claimId"`
	Outcome         string `json:"outcome"`
	Kind            string `json:"kind"`
	ClaimantUserId  string `json:"claimantUserId,omitempty"`
	AccusedSellerId string `json:"accusedSellerId"`
	ListingId       string `json:"listingId"`
	Reason          string `json:"reason"`
	StrikeAdded     bool   `json:"strikeAdded"`
}
