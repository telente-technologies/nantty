package dtos

import (
	recordaudiomatches "nantty/modules/moderation/src/modules/copyrightClaims/commands/recordAudioMatches"
	"nantty/modules/moderation/src/modules/copyrightClaims/validators"
)

type SubmitClaimRequest struct {
	TargetType          string               `json:"targetType"`
	TargetId            string               `json:"targetId"`
	WorkDescription     string               `json:"workDescription"`
	OwnershipStatement  string               `json:"ownershipStatement"`
	ContactEmail        string               `json:"contactEmail"`
	GoodFaith           bool                 `json:"goodFaith"`
	ClaimantName        string               `json:"claimantName"`
	Organization        string               `json:"organization"`
	RepresentativeOf    string               `json:"representativeOf"`
	ClaimedUrls         []string             `json:"claimedUrls"`
	WorkType            string               `json:"workType"`
	ClaimScope          string               `json:"claimScope"`
	ClaimantPhone       string               `json:"claimantPhone"`
	ClaimantAddress     string               `json:"claimantAddress"`
	OriginalWorkUrl     string               `json:"originalWorkUrl"`
	OriginalWorkMediaId string               `json:"originalWorkMediaId"`
	ProofUrls           []string             `json:"proofUrls"`
	ProofMediaIds       []string             `json:"proofMediaIds"`
	Segments            []validators.Segment `json:"segments"`
	AccuracyDeclared    bool                 `json:"accuracyDeclared"`
	SignatureName       string               `json:"signatureName"`
}

type ReasonRequest struct {
	Reason string `json:"reason"`
}

type CounterNoticeRequest struct {
	Statement    string `json:"statement"`
	ContactEmail string `json:"contactEmail"`
	GoodFaith    bool   `json:"goodFaith"`
}

type AudioMatchesRequest struct {
	Matches []recordaudiomatches.Match `json:"matches"`
}

type UpdatePolicyRequest struct {
	TakedownDeadlineHours     int    `json:"takedownDeadlineHours"`
	StrikeLifetimeDays        int    `json:"strikeLifetimeDays"`
	WarningLifetimeDays       int    `json:"warningLifetimeDays"`
	StrikeWindowDays          int    `json:"strikeWindowDays"`
	RestrictionThreshold      int    `json:"restrictionThreshold"`
	SuspensionReviewThreshold int    `json:"suspensionReviewThreshold"`
	RestrictionDays           int    `json:"restrictionDays"`
	Reason                    string `json:"reason"`
}
