package dtos

import (
	"zudomart/modules/ads/src/types"
	"zudomart/platform/regionpricing"
)

type BoostAudience struct {
	Mode        string   `json:"mode"`
	CountryCode string   `json:"countryCode,omitempty"`
	States      []string `json:"states,omitempty"`
	Interests   []string `json:"interests,omitempty"`
	AgeMin      int      `json:"ageMin,omitempty"`
	AgeMax      int      `json:"ageMax,omitempty"`
	Gender      string   `json:"gender,omitempty"`
	TopicIds    []string `json:"topicIds,omitempty"`
}

type BoostOptions struct {
	MinimumDailyBudget    types.Money                  `json:"minimumDailyBudget"`
	SuggestedDailyBudgets []types.Money                `json:"suggestedDailyBudgets"`
	DurationDayOptions    []int                        `json:"durationDayOptions"`
	Interests             []string                     `json:"interests"`
	Region                string                       `json:"region"`
	Packages              []regionpricing.BoostPackage `json:"packages"`
	PaymentMethods        []string                     `json:"paymentMethods"`
	FreeBoost             FreeBoost                    `json:"freeBoost"`
	PaymentOptions        []PaymentOption              `json:"paymentOptions"`
	AdBalance             AdBalanceSummary             `json:"adBalance"`
	MaximumDurationDays   int                          `json:"maximumDurationDays"`
	MaximumScheduleDays   int                          `json:"maximumScheduleDays"`
	GoalsByDestination    map[string][]string          `json:"goalsByDestination"`
}

type PaymentOption struct {
	Method     string  `json:"method"`
	Available  bool    `json:"available"`
	ReasonCode *string `json:"reasonCode"`
	Reason     *string `json:"reason"`
}

type AdBalanceSummary struct {
	AccountId *string     `json:"accountId"`
	Balance   types.Money `json:"balance"`
	Credit    types.Money `json:"credit"`
	Committed types.Money `json:"committed"`
	Spendable types.Money `json:"spendable"`
}

type FreeBoost struct {
	Premium            bool        `json:"premium"`
	Eligible           bool        `json:"eligible"`
	RemainingThisMonth int         `json:"remainingThisMonth"`
	MaxTotal           types.Money `json:"maxTotal"`
	ResetsAt           string      `json:"resetsAt"`
}

type BoostEstimateRequest struct {
	PostId          string        `json:"postId"`
	DestinationType string        `json:"destinationType,omitempty"`
	TargetId        string        `json:"targetId,omitempty"`
	Goal            string        `json:"goal"`
	Audience        BoostAudience `json:"audience"`
	BudgetType      string        `json:"budgetType,omitempty"`
	DailyBudget     types.Money   `json:"dailyBudget"`
	TotalBudget     *types.Money  `json:"totalBudget,omitempty"`
	DurationDays    int           `json:"durationDays"`
	StartAt         *string       `json:"startAt,omitempty"`
}

type BoostEstimate struct {
	EstimatedReachMin     int64               `json:"estimatedReachMin"`
	EstimatedReachMax     int64               `json:"estimatedReachMax"`
	EstimatedResultsLabel string              `json:"estimatedResultsLabel"`
	TotalCost             types.Money         `json:"totalCost"`
	Impressions           regionpricing.Range `json:"impressions"`
	Clicks                regionpricing.Range `json:"clicks"`
	CostPerResult         regionpricing.Range `json:"costPerResultMinor"`
	MinimumDailyBudget    types.Money         `json:"minimumDailyBudget"`
	Region                string              `json:"region"`
}

type CreateBoostRequest struct {
	BoostEstimateRequest
	PaymentMethod string `json:"paymentMethod"`
}

type BoostResults struct {
	Impressions   int64 `json:"impressions"`
	Reach         int64 `json:"reach"`
	Clicks        int64 `json:"clicks"`
	ProfileVisits int64 `json:"profileVisits"`
	StoreVisits   int64 `json:"storeVisits"`
	ProductVisits int64 `json:"productVisits"`
	Messages      int64 `json:"messages"`
}

type BoostKeyResult struct {
	Label string `json:"label"`
	Value int64  `json:"value"`
}

type BoostActions struct {
	Pause        bool `json:"pause"`
	Resume       bool `json:"resume"`
	Stop         bool `json:"stop"`
	ChangeBudget bool `json:"changeBudget"`
	Resubmit     bool `json:"resubmit"`
}

type Boost struct {
	Id               string         `json:"id"`
	PostId           string         `json:"postId"`
	DestinationType  string         `json:"destinationType"`
	TargetId         string         `json:"targetId"`
	Status           string         `json:"status"`
	Goal             string         `json:"goal"`
	BudgetType       string         `json:"budgetType"`
	DailyBudget      types.Money    `json:"dailyBudget"`
	DurationDays     int            `json:"durationDays"`
	TotalBudget      types.Money    `json:"totalBudget"`
	Spent            types.Money    `json:"spent"`
	StartsAt         *string        `json:"startsAt"`
	EndsAt           *string        `json:"endsAt"`
	ScheduledStartAt *string        `json:"scheduledStartAt"`
	CreatedAt        string         `json:"createdAt"`
	Audience         BoostAudience  `json:"audience"`
	Results          BoostResults   `json:"results"`
	KeyResult        BoostKeyResult `json:"keyResult"`
	CostPerResult    *types.Money   `json:"costPerResult"`
	RejectionReason  *string        `json:"rejectionReason"`
	PaymentMethod    string         `json:"paymentMethod"`
	Actions          BoostActions   `json:"actions"`
}

type CreatedBoost struct {
	Boost       Boost   `json:"boost"`
	CheckoutUrl *string `json:"checkoutUrl"`
}
