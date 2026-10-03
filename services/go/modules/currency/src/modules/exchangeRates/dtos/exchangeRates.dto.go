package dtos

type SetExchangeRateRequest struct {
	Rate               string `json:"rate"`
	Reason             string `json:"reason"`
	ConfirmLargeChange bool   `json:"confirmLargeChange"`
}
