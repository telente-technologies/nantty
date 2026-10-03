package events

const CreatorApplicationDecidedType = "creatorApplication.decided"

type DecidedData struct {
	AccountId     string `json:"accountId"`
	ApplicationId string `json:"applicationId"`
	Status        string `json:"status"`
	Decision      string `json:"decision"`
	Automatic     bool   `json:"automatic"`
	Reason        string `json:"reason,omitempty"`
	ReviewedBy    string `json:"reviewedBy,omitempty"`
}
