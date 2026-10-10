package types

import "time"

type CandidateAd struct {
	AdId                  string
	AdGroupId             string
	CampaignId            string
	CampaignKind          string
	AccountId             string
	Format                string
	Creative              Creative
	Audience              AudienceSpec
	Placements            []string
	GroupBudgetType       string
	GroupBudgetMicros     int64
	CampaignBudgetType    string
	CampaignBudgetMicros  int64
	SpendCapMicros        int64
	BidType               string
	BidMinor              int64
	FrequencyImpressions  int
	FrequencyPerDays      int
	StartAt               time.Time
	EndAt                 *time.Time
	Currency              string
	Timezone              string
	AvailableFundsMicros  int64
	MonthlySpendLimit     *int64
	VideoDurationSeconds  int
	HistoricalImpressions int64
	HistoricalClicks      int64
	ExperimentId          string
	ExperimentBucketFrom  int
	ExperimentBucketTo    int
}

type ContentSignal struct {
	ContentId            string
	CreatorUserId        string
	ContentKind          string
	DurationSeconds      int
	BrandSafe            bool
	Sensitive            bool
	KidsContent          bool
	AiGenerated          bool
	MonetizationEligible bool
	OptedInPlacements    []string
	Topics               []string
}

type DecisionSlot struct {
	Kind                string
	ContentId           string
	NeighbourContentIds []string
	SlotsSinceLastAd    *int
}

type AdClickSignals struct {
	ClicksByActorLastMinute    int
	MillisecondsFromImpression int64
}

type PctrCandidate struct {
	AdId                  string
	CampaignId            string
	AccountId             string
	Format                string
	BidType               string
	BidMinor              int64
	DailyBudgetMinor      int64
	Currency              string
	Placements            []string
	HistoricalImpressions int64
	HistoricalClicks      int64
}

type PctrRequest struct {
	Viewer     Viewer
	SlotKind   string
	Placement  string
	Candidates []PctrCandidate
}
