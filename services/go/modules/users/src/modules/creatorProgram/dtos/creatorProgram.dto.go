package dtos

import "time"

type SocialLink struct {
	Platform string `json:"platform"`
	Url      string `json:"url"`
}

type SubmitApplicationRequest struct {
	ContentCategories           []string     `json:"contentCategories"`
	SocialLinks                 []SocialLink `json:"socialLinks"`
	SampleContentUrls           []string     `json:"sampleContentUrls"`
	PayoutAccountId             string       `json:"payoutAccountId"`
	AcceptedCreatorTermsVersion string       `json:"acceptedCreatorTermsVersion"`
}

type DecisionRequest struct {
	Reason string `json:"reason"`
}

type ProfileSignalsRequest struct {
	AccountId                 string     `json:"accountId"`
	RealFollowers             *int       `json:"realFollowers"`
	VerifiedFollowers         *int       `json:"verifiedFollowers"`
	QualifyingImpressions30d  *int       `json:"qualifyingImpressionsLast30Days"`
	CreatorMetricsSnapshotId  string     `json:"creatorMetricsSnapshotId"`
	CreatorMetricsAsOf        *time.Time `json:"creatorMetricsAsOf"`
	OriginalPostsLast60Days   *int       `json:"originalPostsLast60Days"`
	DaysSinceLastViolation    *int       `json:"daysSinceLastViolation"`
	CreatorStandingSnapshotId string     `json:"creatorStandingSnapshotId"`
	CreatorStandingSource     string     `json:"creatorStandingSource"`
	CreatorStandingAsOf       *time.Time `json:"creatorStandingAsOf"`
	FraudScore                *int       `json:"fraudScore"`
	RiskScore                 *int       `json:"riskScore"`
	IdVerified                *bool      `json:"idVerified"`
	BorderlineContent         *bool      `json:"borderlineContent"`
	CompletedOrders           *int       `json:"completedOrders"`
	SuccessRatePercent        *int       `json:"successRatePercent"`
	HasActiveStoreOrBrandPage *bool      `json:"hasActiveStoreOrBrandPage"`
	SellerPlan                *string    `json:"sellerPlan"`
	Source                    string     `json:"source"`
}
