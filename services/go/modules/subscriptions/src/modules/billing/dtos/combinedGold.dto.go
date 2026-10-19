package dtos

type CombinedGoldQuoteRequestDto struct {
	ProfileIds   []string `json:"profileIds"`
	Interval     string   `json:"interval"`
	OfferClaimId string   `json:"offerClaimId"`
}

type CombinedGoldCheckoutRequestDto struct {
	ProfileIds         []string `json:"profileIds"`
	Interval           string   `json:"interval"`
	OfferClaimId       string   `json:"offerClaimId"`
	ReturnTo           string   `json:"returnTo"`
	ExpectedTotalMinor *int64   `json:"expectedTotalMinor"`
}

type CombinedGoldProfilesRequestDto struct {
	ProfileIds          []string `json:"profileIds"`
	ExpectedChargeMinor *int64   `json:"expectedChargeMinor"`
}
