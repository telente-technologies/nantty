package dtos

import "nantty/modules/ads/src/types"

type NumberRange struct {
	Lower int64 `json:"lower"`
	Upper int64 `json:"upper"`
}

type Lookalike struct {
	SourceAudienceId  string `json:"sourceAudienceId"`
	CountryCode       string `json:"countryCode"`
	SimilarityPercent int    `json:"similarityPercent"`
}

type CustomAudience struct {
	Id               string       `json:"id"`
	AccountId        string       `json:"accountId"`
	Name             string       `json:"name"`
	Type             string       `json:"type"`
	Status           string       `json:"status"`
	ApproximateSize  *NumberRange `json:"approximateSize"`
	RetentionDays    *int         `json:"retentionDays"`
	Description      string       `json:"description"`
	Lookalike        *Lookalike   `json:"lookalike"`
	UsedInAdSetCount int          `json:"usedInAdSetCount"`
	CreatedAt        string       `json:"createdAt"`
	UpdatedAt        string       `json:"updatedAt"`
}

type CreateAudienceRequest struct {
	Type              string `json:"type"`
	Name              string `json:"name"`
	RetentionDays     *int   `json:"retentionDays"`
	MinimumOrders     *int   `json:"minimumOrders"`
	EngagementSource  string `json:"engagementSource"`
	SourceAudienceId  string `json:"sourceAudienceId"`
	CountryCode       string `json:"countryCode"`
	SimilarityPercent *int   `json:"similarityPercent"`
}

type CustomerListRequest struct {
	Name              string   `json:"name"`
	IdentifierType    string   `json:"identifierType"`
	HashAlgorithm     string   `json:"hashAlgorithm"`
	HashedIdentifiers []string `json:"hashedIdentifiers"`
}

type RenameRequest struct {
	Name string `json:"name"`
}

type EstimateRequest struct {
	Objective   string             `json:"objective"`
	Audience    types.AudienceSpec `json:"audience"`
	Placements  []string           `json:"placements"`
	Budget      *types.Budget      `json:"budget"`
	BidStrategy types.BidStrategy  `json:"bidStrategy"`
	Schedule    types.Schedule     `json:"schedule"`
}

type AudienceEstimate struct {
	AudienceSize NumberRange  `json:"audienceSize"`
	Breadth      string       `json:"breadth"`
	DailyReach   *NumberRange `json:"dailyReach"`
	DailyResults *NumberRange `json:"dailyResults"`
	ResultLabel  string       `json:"resultLabel"`
	Warnings     []string     `json:"warnings"`
}
