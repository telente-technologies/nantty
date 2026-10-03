package submitverificationapplication

type Command struct {
	AccountId          string
	Kind               string
	PlanId             string
	LegalName          string
	DocumentType       string
	DocumentNumber     string
	DocumentPhotoUrl   string
	SelfiePhotoUrl     string
	BusinessName       string
	RegistrationNumber string
	BusinessAddress    string
	DocumentUrls       []string
}

type Result struct {
	ApplicationId string  `json:"applicationId"`
	CheckoutUrl   *string `json:"checkoutUrl"`
}
