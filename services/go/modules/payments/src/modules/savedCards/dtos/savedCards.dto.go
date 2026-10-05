package dtos

type StartSavedCardSetupRequestDto struct {
	ReturnTo string `json:"returnTo"`
}

type ChargeSavedCardRequestDto struct {
	PaymentReference string `json:"paymentReference"`
	SavedCardId      string `json:"savedCardId"`
}

type RefundBankDestinationRequestDto struct {
	BankCode      string `json:"bankCode"`
	AccountNumber string `json:"accountNumber"`
}
