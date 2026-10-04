package startidentitycapture

type Command struct {
	AccountId       string
	CaseId          string
	ConsentVersion  string
	ConsentAccepted bool
	Platform        string
	DocumentCountry string
	DocumentType    string
}

type Result struct {
	Mode        string `json:"mode"`
	Token       string `json:"token,omitempty"`
	Url         string `json:"url,omitempty"`
	Product     string `json:"product"`
	JobId       string `json:"jobId"`
	UserId      string `json:"userId"`
	PartnerId   string `json:"partnerId"`
	Environment string `json:"environment"`
	CallbackUrl string `json:"callbackUrl"`
}
