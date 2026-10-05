package dtos

type IdentityDocumentRequest struct {
	DocumentType     string `json:"documentType"`
	DocumentNumber   string `json:"documentNumber"`
	DocumentPhotoUrl string `json:"documentPhotoUrl"`
}

type PayoutAccountRequest struct {
	BankCode      string `json:"bankCode"`
	AccountNumber string `json:"accountNumber"`
}

type SubmitApplicationRequest struct {
	StoreName        string                  `json:"storeName"`
	CategoryId       string                  `json:"categoryId"`
	Description      string                  `json:"description"`
	Phone            string                  `json:"phone"`
	AddressLine      string                  `json:"addressLine"`
	City             string                  `json:"city"`
	State            string                  `json:"state"`
	IdentityDocument IdentityDocumentRequest `json:"identityDocument"`
	PayoutAccount    PayoutAccountRequest    `json:"payoutAccount"`
}

type DecisionRequest struct {
	Reason string `json:"reason"`
}
