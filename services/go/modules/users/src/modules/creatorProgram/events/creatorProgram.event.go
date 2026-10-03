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

const (
	CreatorApplicationApprovedType    = "creatorApplication.approved"
	CreatorApplicationNeedsReviewType = "creatorApplication.needsReview"
	CreatorApplicationIneligibleType  = "creatorApplication.ineligible"
)

type ApprovedNotice struct {
	AccountId string `json:"accountId"`
	Handle    string `json:"handle"`
}

type NeedsReviewNotice struct {
	AccountId        string `json:"accountId"`
	ApplicationId    string `json:"applicationId"`
	ReviewWithinDays int    `json:"reviewWithinDays"`
}

type RequirementNotice struct {
	Label   string `json:"label"`
	Value   int    `json:"value"`
	Target  int    `json:"target"`
	Display string `json:"display,omitempty"`
}

type IneligibleNotice struct {
	AccountId    string              `json:"accountId"`
	Requirements []RequirementNotice `json:"requirements"`
	ReapplyFrom  string              `json:"reapplyFrom,omitempty"`
}
