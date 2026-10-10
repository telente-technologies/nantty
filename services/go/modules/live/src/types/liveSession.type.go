package types

import "github.com/google/uuid"

type CreateLiveSessionInput struct {
	Title        string
	Category     string
	Visibility   string
	StoreId      *uuid.UUID
	ProductIds   []uuid.UUID
	StartNow     bool
	CountryCode  string
	Monetization LiveMonetizationInput
}

type LiveAdSettingsInput struct {
	AllowAds           bool     `json:"allowAds"`
	Placements         []string `json:"placements"`
	MaxInterruptions   int      `json:"maxInterruptions"`
	MinIntervalMinutes int      `json:"minIntervalMinutes"`
	ShowAdIndicator    bool     `json:"showAdIndicator"`
}

type LiveMonetizationInput struct {
	LiveAdSettings             *LiveAdSettingsInput
	AcceptedLiveAdTermsVersion string
	SponsorshipLine            string
}

type MediaTokenView struct {
	Url        string `json:"url"`
	Token      string `json:"token"`
	CanPublish bool   `json:"canPublish"`
	Role       string `json:"role"`
}

type LiveProductView struct {
	ProductId string     `json:"productId"`
	Pinned    bool       `json:"pinned"`
	Title     *string    `json:"title"`
	Price     *MoneyView `json:"price"`
	ImageUrl  *string    `json:"imageUrl"`
}

type HostSummary struct {
	UserSummary
	Followers int `json:"followers"`
	Following int `json:"following"`
}

type MediaConnection struct {
	LivekitUrl string `json:"livekitUrl"`
}

type LiveSessionView struct {
	Id                         string          `json:"id"`
	Host                       HostSummary     `json:"host"`
	Title                      string          `json:"title"`
	Category                   string          `json:"category"`
	State                      string          `json:"state"`
	Status                     string          `json:"status"`
	Visibility                 string          `json:"visibility"`
	Viewers                    int             `json:"viewers"`
	PeakViewers                int             `json:"peakViewers"`
	StartedAt                  *string         `json:"startedAt"`
	EndedAt                    *string         `json:"endedAt"`
	CoverUrl                   *string         `json:"coverUrl"`
	PlaybackUrl                *string         `json:"playbackUrl"`
	Media                      MediaConnection `json:"media"`
	GiftsEnabled               bool            `json:"giftsEnabled"`
	HostIsCreator              bool            `json:"hostIsCreator"`
	IsFollowingHost            bool            `json:"isFollowingHost"`
	StoreId                    *string         `json:"storeId"`
	Products                   []any           `json:"products"`
	PinnedProductId            *string         `json:"pinnedProductId"`
	LiveAdSettings             map[string]any  `json:"liveAdSettings"`
	AcceptedLiveAdTermsVersion *string         `json:"acceptedLiveAdTermsVersion"`
	SponsorshipLine            *string         `json:"sponsorshipLine"`
	TopSupporterUserId         *string         `json:"topSupporterUserId"`
	Safety                     *LiveSafetyView `json:"safety"`
}

type SuggestedLiveView struct {
	Id       string      `json:"id"`
	Host     UserSummary `json:"host"`
	Title    string      `json:"title"`
	CoverUrl *string     `json:"coverUrl"`
}
