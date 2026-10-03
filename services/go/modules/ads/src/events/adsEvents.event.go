package events

import "time"

const (
	EventSource = "zudomart.ads"

	AdImpressionRecorded    = "ad.impressionRecorded"
	AdReviewed              = "ad.reviewed"
	AdSpendBatched          = "adSpend.batched"
	AdCreatorEarningsPosted = "adCreatorEarnings.posted"
	AdPremiumPoolAllocated  = "adPremiumPool.allocated"
	AdBoostCreated          = "adBoost.created"
)

type AdImpressionRecordedEventData struct {
	ImpressionId  string    `json:"impressionId"`
	AdId          string    `json:"adId"`
	CampaignId    string    `json:"campaignId"`
	AccountId     string    `json:"accountId"`
	UserId        string    `json:"userId"`
	Placement     string    `json:"placement"`
	SlotKind      string    `json:"slotKind"`
	ContentId     string    `json:"contentId"`
	CreatorUserId string    `json:"creatorUserId"`
	Country       string    `json:"country"`
	AiGenerated   bool      `json:"aiGenerated"`
	WatchMs       int       `json:"watchMs"`
	Completed     bool      `json:"completed"`
	Clicked       bool      `json:"clicked"`
	FraudScore    float64   `json:"fraudScore"`
	Currency      string    `json:"currency"`
	ChargeMicros  int64     `json:"chargeMicros"`
	QualifiedAt   time.Time `json:"qualifiedAt"`
}

type AdReviewedEventData struct {
	AdId         string `json:"adId"`
	AccountId    string `json:"accountId"`
	Decision     string `json:"decision"`
	PolicyCode   string `json:"policyCode"`
	ReviewerName string `json:"reviewerName"`
}

type AdSpendBatchedEventData struct {
	BatchId             string `json:"batchId"`
	AccountId           string `json:"accountId"`
	Currency            string `json:"currency"`
	DebitMinor          int64  `json:"debitMinor"`
	SpendMicros         int64  `json:"spendMicros"`
	CreatorShareMicros  int64  `json:"creatorShareMicros"`
	PlatformShareMicros int64  `json:"platformShareMicros"`
	ImpressionCount     int    `json:"impressionCount"`
	IdempotencyKey      string `json:"idempotencyKey"`
}

type AdCreatorEarningsPostedEventData struct {
	CreatorUserId  string `json:"creatorUserId"`
	Currency       string `json:"currency"`
	AmountMinor    int64  `json:"amountMinor"`
	BatchId        string `json:"batchId"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type PremiumAllocationEntry struct {
	CreatorUserId string `json:"creatorUserId"`
	AmountMinor   int64  `json:"amountMinor"`
}

type AdPremiumPoolAllocatedEventData struct {
	Month       string                   `json:"month"`
	Currency    string                   `json:"currency"`
	PoolMinor   int64                    `json:"poolMinor"`
	Allocations []PremiumAllocationEntry `json:"allocations"`
}

type AdBoostCreatedEventData struct {
	BoostId          string `json:"boostId"`
	UserId           string `json:"userId"`
	PostId           string `json:"postId"`
	Goal             string `json:"goal"`
	TotalBudgetMinor int64  `json:"totalBudgetMinor"`
	Currency         string `json:"currency"`
	PaymentMethod    string `json:"paymentMethod"`
}
