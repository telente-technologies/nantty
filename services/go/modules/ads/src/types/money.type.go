package types

type Money struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type Budget struct {
	Type   string `json:"type"`
	Amount Money  `json:"amount"`
}

type BidStrategy struct {
	Type   string `json:"type"`
	Amount *Money `json:"amount"`
}

type FrequencyCap struct {
	Impressions int `json:"impressions"`
	PerDays     int `json:"perDays"`
}

type Schedule struct {
	StartAt string  `json:"startAt"`
	EndAt   *string `json:"endAt"`
}

const MicrosPerMinorUnit int64 = 1_000_000
