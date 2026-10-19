package dtos

import "zudomart/modules/ads/src/types"

type DeliverySummary struct {
	Impressions     int64        `json:"impressions"`
	Reach           int64        `json:"reach"`
	Clicks          int64        `json:"clicks"`
	Results         int64        `json:"results"`
	Spend           types.Money  `json:"spend"`
	CostPerResult   *types.Money `json:"costPerResult"`
	ConversionValue types.Money  `json:"conversionValue"`
	SpentToday      types.Money  `json:"spentToday"`
}

type Campaign struct {
	Id              string          `json:"id"`
	AccountId       string          `json:"accountId"`
	Name            string          `json:"name"`
	Objective       string          `json:"objective"`
	Status          string          `json:"status"`
	BudgetLevel     string          `json:"budgetLevel"`
	Budget          *types.Budget   `json:"budget"`
	SpendCap        *types.Money    `json:"spendCap"`
	Schedule        types.Schedule  `json:"schedule"`
	AdCategory      string          `json:"adCategory"`
	AdSetCount      int             `json:"adSetCount"`
	AdCount         int             `json:"adCount"`
	RejectedAdCount int             `json:"rejectedAdCount"`
	Delivery        DeliverySummary `json:"delivery"`
	CreatedAt       string          `json:"createdAt"`
	UpdatedAt       string          `json:"updatedAt"`
}

type AdSet struct {
	Id                string              `json:"id"`
	AccountId         string              `json:"accountId"`
	CampaignId        string              `json:"campaignId"`
	Name              string              `json:"name"`
	Status            string              `json:"status"`
	Audience          types.AudienceSpec  `json:"audience"`
	PlacementMode     string              `json:"placementMode"`
	Placements        []string            `json:"placements"`
	Schedule          types.Schedule      `json:"schedule"`
	Budget            *types.Budget       `json:"budget"`
	BidStrategy       types.BidStrategy   `json:"bidStrategy"`
	FrequencyCap      *types.FrequencyCap `json:"frequencyCap"`
	ConversionEventId *string             `json:"conversionEventId"`
	ExperimentId      *string             `json:"experimentId"`
	AdCount           int                 `json:"adCount"`
	Delivery          DeliverySummary     `json:"delivery"`
	CreatedAt         string              `json:"createdAt"`
	UpdatedAt         string              `json:"updatedAt"`
}

type AdAppeal struct {
	Status         string  `json:"status"`
	Message        string  `json:"message"`
	SubmittedAt    string  `json:"submittedAt"`
	ResolvedAt     *string `json:"resolvedAt"`
	ResolutionNote *string `json:"resolutionNote"`
}

type AdReview struct {
	Status       string    `json:"status"`
	PolicyCode   *string   `json:"policyCode"`
	PolicyReason *string   `json:"policyReason"`
	ReviewedAt   *string   `json:"reviewedAt"`
	Appeal       *AdAppeal `json:"appeal"`
}

type Ad struct {
	Id         string          `json:"id"`
	AccountId  string          `json:"accountId"`
	CampaignId string          `json:"campaignId"`
	AdSetId    string          `json:"adSetId"`
	Name       string          `json:"name"`
	Status     string          `json:"status"`
	Review     AdReview        `json:"review"`
	Creative   types.Creative  `json:"creative"`
	Delivery   DeliverySummary `json:"delivery"`
	CreatedAt  string          `json:"createdAt"`
	UpdatedAt  string          `json:"updatedAt"`
}

type CampaignInput struct {
	Name        string         `json:"name"`
	Objective   string         `json:"objective"`
	BudgetLevel string         `json:"budgetLevel"`
	Budget      *types.Budget  `json:"budget"`
	SpendCap    *types.Money   `json:"spendCap"`
	Schedule    types.Schedule `json:"schedule"`
	AdCategory  string         `json:"adCategory"`
}

type AdSetInput struct {
	Name              string              `json:"name"`
	Audience          types.AudienceSpec  `json:"audience"`
	PlacementMode     string              `json:"placementMode"`
	Placements        []string            `json:"placements"`
	Schedule          types.Schedule      `json:"schedule"`
	Budget            *types.Budget       `json:"budget"`
	BidStrategy       types.BidStrategy   `json:"bidStrategy"`
	FrequencyCap      *types.FrequencyCap `json:"frequencyCap"`
	ConversionEventId *string             `json:"conversionEventId"`
}

type AdInput struct {
	Name     string              `json:"name"`
	Creative types.CreativeInput `json:"creative"`
}

type CampaignDraftSubmission struct {
	Campaign        CampaignInput `json:"campaign"`
	AdSet           AdSetInput    `json:"adSet"`
	Ads             []AdInput     `json:"ads"`
	SubmitForReview bool          `json:"submitForReview"`
}

type CampaignDraftResult struct {
	Campaign Campaign `json:"campaign"`
	AdSet    AdSet    `json:"adSet"`
	Ads      []Ad     `json:"ads"`
}

type CampaignPatch struct {
	Name        *string                     `json:"name"`
	BudgetLevel *string                     `json:"budgetLevel"`
	Budget      *types.Budget               `json:"budget"`
	SpendCap    types.Nullable[types.Money] `json:"spendCap,omitzero"`
	Schedule    *types.Schedule             `json:"schedule"`
	Status      *string                     `json:"status"`
	Objective   *string                     `json:"objective"`
	AdCategory  *string                     `json:"adCategory"`
}

type AdSetPatch struct {
	Name          *string                            `json:"name"`
	Audience      *types.AudienceSpec                `json:"audience"`
	PlacementMode *string                            `json:"placementMode"`
	Placements    *[]string                          `json:"placements"`
	Schedule      *types.Schedule                    `json:"schedule"`
	Budget        *types.Budget                      `json:"budget"`
	BidStrategy   *types.BidStrategy                 `json:"bidStrategy"`
	FrequencyCap  types.Nullable[types.FrequencyCap] `json:"frequencyCap,omitzero"`
	Status        *string                            `json:"status"`
}

type AdPatch struct {
	Name     *string              `json:"name"`
	Creative *types.CreativeInput `json:"creative"`
	Status   *string              `json:"status"`
}

type CreateAdSetRequest struct {
	CampaignId string `json:"campaignId"`
	AdSetInput
}

type CreateAdRequest struct {
	AdSetId string `json:"adSetId"`
	AdInput
}

type AppealRequest struct {
	Message string `json:"message"`
}

type BulkActionRequest struct {
	Level  string   `json:"level"`
	Ids    []string `json:"ids"`
	Action string   `json:"action"`
}

type BulkFailure struct {
	Id      string `json:"id"`
	Message string `json:"message"`
}

type BulkActionResult struct {
	SucceededIds []string      `json:"succeededIds"`
	Failed       []BulkFailure `json:"failed"`
}
