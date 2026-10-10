package events

const (
	BusinessDocumentSubmittedType    = "businessDocument.submitted"
	BusinessDocumentReviewedType     = "businessDocument.reviewed"
	BusinessVerificationApprovedType = "businessVerification.approved"
	BusinessVerificationRevokedType  = "businessVerification.revoked"
)

type DocumentEventData struct {
	AccountId  string `json:"accountId"`
	DocumentId string `json:"documentId"`
	Kind       string `json:"kind"`
	Status     string `json:"status,omitempty"`
	Reason     string `json:"reason,omitempty"`
}

type VerificationApprovedData struct {
	AccountId            string `json:"accountId"`
	ProfileId            string `json:"profileId,omitempty"`
	GoldEligible         bool   `json:"goldEligible"`
	GoldCheckmarkGranted bool   `json:"goldCheckmarkGranted"`
}

type VerificationRevokedData struct {
	AccountId    string `json:"accountId"`
	ProfileId    string `json:"profileId,omitempty"`
	DocumentKind string `json:"documentKind"`
	Reason       string `json:"reason"`
}
