package dtos

import "zudomart/modules/ads/src/types"

type BoostAudience struct {
	Mode        string   `json:"mode"`
	CountryCode string   `json:"countryCode,omitempty"`
	States      []string `json:"states,omitempty"`
	Interests   []string `json:"interests,omitempty"`
	AgeMin      int      `json:"ageMin,omitempty"`
	AgeMax      int      `json:"ageMax,omitempty"`
}

type BoostOptions struct {
	MinimumDailyBudget    types.Money   `json:"minimumDailyBudget"`
	SuggestedDailyBudgets []types.Money `json:"suggestedDailyBudgets"`
	DurationDayOptions    []int         `json:"durationDayOptions"`
	Interests             []string      `json:"interests"`
}

type BoostEstimateRequest struct {
	PostId       string        `json:"postId"`
	Goal         string        `json:"goal"`
	Audience     BoostAudience `json:"audience"`
	DailyBudget  types.Money   `json:"dailyBudget"`
	DurationDays int           `json:"durationDays"`
}

type BoostEstimate struct {
	EstimatedReachMin     int64       `json:"estimatedReachMin"`
	EstimatedReachMax     int64       `json:"estimatedReachMax"`
	EstimatedResultsLabel string      `json:"estimatedResultsLabel"`
	TotalCost             types.Money `json:"totalCost"`
}

type CreateBoostRequest struct {
	BoostEstimateRequest
	PaymentMethod string `json:"paymentMethod"`
}

type BoostResults struct {
	Impressions   int64 `json:"impressions"`
	Reach         int64 `json:"reach"`
	ProfileVisits int64 `json:"profileVisits"`
	Messages      int64 `json:"messages"`
}

type Boost struct {
	Id              string       `json:"id"`
	PostId          string       `json:"postId"`
	Status          string       `json:"status"`
	Goal            string       `json:"goal"`
	TotalBudget     types.Money  `json:"totalBudget"`
	Spent           types.Money  `json:"spent"`
	StartsAt        *string      `json:"startsAt"`
	EndsAt          *string      `json:"endsAt"`
	Results         BoostResults `json:"results"`
	RejectionReason *string      `json:"rejectionReason"`
}

type CreatedBoost struct {
	Boost       Boost   `json:"boost"`
	CheckoutUrl *string `json:"checkoutUrl"`
}
