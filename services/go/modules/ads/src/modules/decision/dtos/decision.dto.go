package dtos

import "zudomart/modules/ads/src/types"

type SlotRequest struct {
	Kind                string   `json:"kind"`
	ContentId           string   `json:"contentId"`
	NeighbourContentIds []string `json:"neighbourContentIds"`
	SlotsSinceLastAd    *int     `json:"slotsSinceLastAd"`
}

type ViewerHints struct {
	Region            string   `json:"region"`
	AgeBand           string   `json:"ageBand"`
	Gender            string   `json:"gender"`
	Topics            []string `json:"topics"`
	CustomAudienceIds []string `json:"customAudienceIds"`
}

type DecideRequest struct {
	Slot      SlotRequest  `json:"slot"`
	SessionId string       `json:"sessionId"`
	Viewer    *ViewerHints `json:"viewer"`
}

type InternalViewer struct {
	Country           string   `json:"country"`
	Region            string   `json:"region"`
	AgeBand           string   `json:"ageBand"`
	Gender            string   `json:"gender"`
	Topics            []string `json:"topics"`
	CustomAudienceIds []string `json:"customAudienceIds"`
	PremiumAdFree     bool     `json:"premiumAdFree"`
}

type InternalContentSignal struct {
	ContentId            string   `json:"contentId"`
	CreatorUserId        string   `json:"creatorUserId"`
	ContentKind          string   `json:"contentKind"`
	DurationSeconds      int      `json:"durationSeconds"`
	BrandSafe            bool     `json:"brandSafe"`
	Sensitive            bool     `json:"sensitive"`
	KidsContent          bool     `json:"kidsContent"`
	AiGenerated          bool     `json:"aiGenerated"`
	MonetizationEligible bool     `json:"monetizationEligible"`
	OptedInPlacements    []string `json:"optedInPlacements"`
	Topics               []string `json:"topics"`
}

type InternalDecideRequest struct {
	UserId    string                 `json:"userId"`
	SessionId string                 `json:"sessionId"`
	Slot      SlotRequest            `json:"slot"`
	Viewer    InternalViewer         `json:"viewer"`
	Content   *InternalContentSignal `json:"content"`
}

type DecidedAd struct {
	AdId             string                    `json:"adId"`
	ImpressionToken  string                    `json:"impressionToken"`
	ExpiresAt        string                    `json:"expiresAt"`
	Placement        string                    `json:"placement"`
	SlotKind         string                    `json:"slotKind"`
	Format           string                    `json:"format"`
	Label            string                    `json:"label"`
	Creative         types.Creative            `json:"creative"`
	SkipAfterSeconds *int                      `json:"skipAfterSeconds"`
	ClickLinks       *types.CreativeClickLinks `json:"clickLinks"`
}

type DecideResponse struct {
	Ad             *DecidedAd `json:"ad"`
	DeclinedReason string     `json:"declinedReason,omitempty"`
}
