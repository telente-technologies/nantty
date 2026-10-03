package dtos

type ResolveBankAccountRequestDto struct {
	BankCode      string `json:"bankCode"`
	AccountNumber string `json:"accountNumber"`
	CountryCode   string `json:"countryCode,omitempty"`
}

type ResolvedBankAccountDto struct {
	AccountName string `json:"accountName"`
}
