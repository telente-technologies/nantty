package dtos

type StartSavedCardSetupRequestDto struct {
	ReturnTo string `json:"returnTo"`
}

type ChargeSavedCardRequestDto struct {
	PaymentReference  string `json:"paymentReference"`
	AuthorizationCode string `json:"authorizationCode"`
}

type RefundBankDestinationRequestDto struct {
	BankCode      string `json:"bankCode"`
	AccountNumber string `json:"accountNumber"`
}
