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
	AdBoostCancelled        = "adBoost.cancelled"
	AdMediaUploaded         = "adMedia.uploaded"
	AdReportReady           = "adReport.ready"
	AdInviteCreated         = "adInvite.created"
	AdRuleTriggered         = "adRule.triggered"
)

type AdInviteCreatedEventData struct {
	InviteId        string `json:"inviteId"`
	AccountId       string `json:"accountId"`
	AccountName     string `json:"accountName"`
	Role            string `json:"role"`
	InvitedBy       string `json:"invitedBy"`
	InvitedByUserId string `json:"invitedByUserId"`
	InviteeUserId   string `json:"inviteeUserId"`
	ExpiresAt       string `json:"expiresAt"`
	InviteUrl       string `json:"inviteUrl"`
}

type AdRuleTriggeredEventData struct {
	RuleId      string   `json:"ruleId"`
	AccountId   string   `json:"accountId"`
	RuleName    string   `json:"ruleName"`
	Action      string   `json:"action"`
	TargetIds   []string `json:"targetIds"`
	TriggeredAt string   `json:"triggeredAt"`
}

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

type AdMediaUploadedEventData struct {
	MediaId   string `json:"mediaId"`
	AccountId string `json:"accountId"`
	ObjectKey string `json:"objectKey"`
	MimeType  string `json:"mimeType"`
	Kind      string `json:"kind"`
	SizeBytes int64  `json:"sizeBytes"`
}

type AdReportReadyEventData struct {
	ScheduledReportId string   `json:"scheduledReportId"`
	AccountId         string   `json:"accountId"`
	ReportName        string   `json:"reportName"`
	Recipients        []string `json:"recipients"`
	Frequency         string   `json:"frequency"`
	PeriodFrom        string   `json:"periodFrom"`
	PeriodTo          string   `json:"periodTo"`
	Currency          string   `json:"currency"`
	SpendMinor        int64    `json:"spendMinor"`
	Impressions       int64    `json:"impressions"`
	Clicks            int64    `json:"clicks"`
	CsvUrl            string   `json:"csvUrl,omitempty"`
	PdfUrl            string   `json:"pdfUrl,omitempty"`
	UrlsExpireAt      string   `json:"urlsExpireAt,omitempty"`
}

type AdBoostCancelledEventData struct {
	BoostId             string `json:"boostId"`
	UserId              string `json:"userId"`
	PostId              string `json:"postId"`
	Reason              string `json:"reason"`
	PaymentMethod       string `json:"paymentMethod"`
	Currency            string `json:"currency"`
	RefundMinor         int64  `json:"refundMinor"`
	DebitIdempotencyKey string `json:"debitIdempotencyKey"`
	AllowanceRestored   bool   `json:"allowanceRestored"`
}
