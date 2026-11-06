package dtos

import "encoding/json"

type LiveAdSettingsRequest struct {
	AllowAds             bool     `json:"allowAds"`
	Placements           []string `json:"placements"`
	MaxInterruptions     int      `json:"maxInterruptions"`
	MinIntervalMinutes   int      `json:"minIntervalMinutes"`
	ShowAdIndicator      bool     `json:"showAdIndicator"`
	AcceptedTermsVersion *string  `json:"acceptedTermsVersion"`
	AcceptedAt           *string  `json:"acceptedAt"`
}

type CreateLiveRequest struct {
	Title                      string                 `json:"title"`
	Category                   string                 `json:"category"`
	Visibility                 string                 `json:"visibility"`
	StoreId                    string                 `json:"storeId"`
	ProductIds                 []string               `json:"productIds"`
	StartNow                   *bool                  `json:"startNow"`
	LiveAdSettings             *LiveAdSettingsRequest `json:"liveAdSettings"`
	AcceptedLiveAdTermsVersion *string                `json:"acceptedLiveAdTermsVersion"`
	SponsorshipLine            *string                `json:"sponsorshipLine"`
	ScheduledAt                *string                `json:"scheduledAt"`
	GiftsEnabled               *bool                  `json:"giftsEnabled"`
}

type UpdateLiveRequest struct {
	Title       *string         `json:"title"`
	Category    *string         `json:"category"`
	ScheduledAt json.RawMessage `json:"scheduledAt"`
}

type MonetizationRequest struct {
	LiveAdSettings             *LiveAdSettingsRequest `json:"liveAdSettings"`
	AcceptedLiveAdTermsVersion *string                `json:"acceptedLiveAdTermsVersion"`
	SponsorshipLine            *string                `json:"sponsorshipLine"`
}

type ReactionRequest struct {
	Emoji string `json:"emoji"`
}

type ShareRequest struct {
	UserIds []string `json:"userIds"`
}

type PinProductRequest struct {
	ProductId string `json:"productId"`
}
