package dtos

import recordaudiomatches "zudomart/modules/moderation/src/modules/copyrightClaims/commands/recordAudioMatches"

type SubmitClaimRequest struct {
	TargetType         string   `json:"targetType"`
	TargetId           string   `json:"targetId"`
	WorkDescription    string   `json:"workDescription"`
	OwnershipStatement string   `json:"ownershipStatement"`
	ContactEmail       string   `json:"contactEmail"`
	GoodFaith          bool     `json:"goodFaith"`
	ClaimantName       string   `json:"claimantName"`
	Organization       string   `json:"organization"`
	RepresentativeOf   string   `json:"representativeOf"`
	ClaimedUrls        []string `json:"claimedUrls"`
	WorkType           string   `json:"workType"`
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
