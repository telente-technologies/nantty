package dtos

import "zudomart/modules/ads/src/types"

type AdvertiserRef struct {
	Id     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

type ReviewCreative struct {
	Format       string `json:"format"`
	ImageUrl     string `json:"imageUrl"`
	Headline     string `json:"headline"`
	PrimaryText  string `json:"primaryText"`
	CallToAction string `json:"callToAction"`
	LandingUrl   string `json:"landingUrl"`
}

type ReviewTargeting struct {
	Countries  []string `json:"countries"`
	AgeRange   string   `json:"ageRange"`
	Interests  []string `json:"interests"`
	Placements []string `json:"placements"`
}

type ReviewSchedule struct {
	StartsAt string  `json:"startsAt"`
	EndsAt   *string `json:"endsAt"`
}

type ReviewDecision struct {
	PolicyCategoryId *string `json:"policyCategoryId"`
	Reason           string  `json:"reason"`
	DecidedByName    string  `json:"decidedByName"`
	DecidedAt        string  `json:"decidedAt"`
}

type AdForReview struct {
	Id             string                `json:"id"`
	CampaignName   string                `json:"campaignName"`
	Advertiser     AdvertiserRef         `json:"advertiser"`
	IsBoostedPost  bool                  `json:"isBoostedPost"`
	Creative       ReviewCreative        `json:"creative"`
	Targeting      ReviewTargeting       `json:"targeting"`
	DailyBudget    types.Money           `json:"dailyBudget"`
	TotalBudget    *types.Money          `json:"totalBudget"`
	Schedule       ReviewSchedule        `json:"schedule"`
	AutoCheckFlags []types.AutoCheckFlag `json:"autoCheckFlags"`
	Status         string                `json:"status"`
	SubmittedAt    string                `json:"submittedAt"`
	Decision       *ReviewDecision       `json:"decision"`
	Appeal         *AppealForReview      `json:"appeal"`
}

type AppealForReview struct {
	Status      string `json:"status"`
	Message     string `json:"message"`
	SubmittedAt string `json:"submittedAt"`
}

type Advertiser struct {
	Id              string        `json:"id"`
	Name            string        `json:"name"`
	Owner           AdvertiserRef `json:"owner"`
	Status          string        `json:"status"`
	Country         string        `json:"country"`
	Currency        string        `json:"currency"`
	SpendByCurrency []types.Money `json:"spendByCurrency"`
	ActiveCampaigns int           `json:"activeCampaigns"`
	ViolationCount  int           `json:"violationCount"`
	LastViolationAt *string       `json:"lastViolationAt"`
	CreatedAt       string        `json:"createdAt"`
}

type PolicyCategory struct {
	Id             string `json:"id"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	Severity       string `json:"severity"`
	IsActive       bool   `json:"isActive"`
	RejectionCount int    `json:"rejectionCount"`
}

type ApproveRequest struct {
	Reason                string `json:"reason"`
	OverrideCriticalFlags bool   `json:"overrideCriticalFlags"`
}

type RejectRequest struct {
	PolicyCategoryId string `json:"policyCategoryId"`
	Reason           string `json:"reason"`
}

type ResolveAppealRequest struct {
	Decision string `json:"decision"`
	Note     string `json:"note"`
}

type SuspensionRequest struct {
	Reason string `json:"reason"`
}

type PolicyCategoryRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	IsActive    *bool  `json:"isActive"`
	Reason      string `json:"reason"`
}

type PagedList[Item any] struct {
	Data       []Item  `json:"data"`
	NextCursor *string `json:"nextCursor"`
	Page       int     `json:"page"`
	PageSize   int     `json:"pageSize"`
	Total      int     `json:"total"`
}
