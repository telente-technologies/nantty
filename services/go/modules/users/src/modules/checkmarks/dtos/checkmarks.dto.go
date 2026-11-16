package dtos

type IdentityDocument struct {
	DocumentType     string `json:"documentType"`
	DocumentNumber   string `json:"documentNumber"`
	DocumentPhotoUrl string `json:"documentPhotoUrl"`
}

type ApplicationRequest struct {
	Kind                       string           `json:"kind"`
	PlanId                     string           `json:"planId"`
	LegalName                  string           `json:"legalName"`
	IdentityDocument           IdentityDocument `json:"identityDocument"`
	SelfiePhotoUrl             string           `json:"selfiePhotoUrl"`
	BusinessName               string           `json:"businessName"`
	BusinessRegistrationNumber string           `json:"businessRegistrationNumber"`
	BusinessAddress            string           `json:"businessAddress"`
	DocumentUrls               []string         `json:"documentUrls"`
}

type BlackApplicationRequest struct {
	AgencyName              string `json:"agencyName"`
	LegalIdentityName       string `json:"legalIdentityName"`
	LegalRegistrationRef    string `json:"legalRegistrationRef"`
	JurisdictionCountryCode string `json:"jurisdictionCountryCode"`
	OfficialWebsite         string `json:"officialWebsite"`
	OfficialContactPhone    string `json:"officialContactPhone"`
	InstitutionalEmail      string `json:"institutionalEmail"`
	RepresentativeName      string `json:"representativeName"`
	RepresentativeRole      string `json:"representativeRole"`
	RepresentativeEmail     string `json:"representativeEmail"`
	RepresentativeIdRef     string `json:"representativeIdRef"`
	EvidenceNotes           string `json:"evidenceNotes"`
}

type VerifyBlackEmailRequest struct {
	Code string `json:"code"`
}

type BlackCheckoutAuthRequest struct {
	Enabled        bool   `json:"enabled"`
	ExpiresInHours int    `json:"expiresInHours"`
	Reason         string `json:"reason"`
}

type BlackAppealRequest struct {
	Reason            string `json:"reason"`
	SupportingDetails string `json:"supportingDetails"`
}

type BlackAppealDecisionRequest struct {
	Decision string `json:"decision"`
	Note     string `json:"note"`
}

type ReasonRequest struct {
	Reason string `json:"reason"`
}

type GrantRequest struct {
	Username string `json:"username"`
	Color    string `json:"color"`
	Reason   string `json:"reason"`
}

type ChecklistRequest struct {
	Key        string `json:"key"`
	IsVerified bool   `json:"isVerified"`
	Note       string `json:"note"`
}

type CreateAccountRequest struct {
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Country     string `json:"country"`
	ProfileType string `json:"profileType"`
	Reason      string `json:"reason"`
}

type BillingEventRequest struct {
	Event     string  `json:"event"`
	PeriodEnd *string `json:"currentPeriodEnd"`
	Price     *struct {
		AmountMinor int64  `json:"amountMinor"`
		Currency    string `json:"currency"`
	} `json:"price"`
}
