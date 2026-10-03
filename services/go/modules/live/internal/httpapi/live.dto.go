package httpapi

type liveAdSettingsRequest struct {
	AllowAds             bool     `json:"allowAds"`
	Placements           []string `json:"placements"`
	MaxInterruptions     int      `json:"maxInterruptions"`
	MinIntervalMinutes   int      `json:"minIntervalMinutes"`
	ShowAdIndicator      bool     `json:"showAdIndicator"`
	AcceptedTermsVersion *string  `json:"acceptedTermsVersion"`
	AcceptedAt           *string  `json:"acceptedAt"`
}

type createLiveRequest struct {
	Title                      string                 `json:"title"`
	Category                   string                 `json:"category"`
	Visibility                 string                 `json:"visibility"`
	StoreId                    string                 `json:"storeId"`
	ProductIds                 []string               `json:"productIds"`
	StartNow                   *bool                  `json:"startNow"`
	LiveAdSettings             *liveAdSettingsRequest `json:"liveAdSettings"`
	AcceptedLiveAdTermsVersion *string                `json:"acceptedLiveAdTermsVersion"`
	SponsorshipLine            *string                `json:"sponsorshipLine"`
}

type monetizationRequest struct {
	LiveAdSettings             *liveAdSettingsRequest `json:"liveAdSettings"`
	AcceptedLiveAdTermsVersion *string                `json:"acceptedLiveAdTermsVersion"`
	SponsorshipLine            *string                `json:"sponsorshipLine"`
}

type reactionRequest struct {
	Emoji string `json:"emoji"`
}

type shareRequest struct {
	UserIds []string `json:"userIds"`
}

type pinProductRequest struct {
	ProductId string `json:"productId"`
}

type inviteGuestRequest struct {
	UserId string `json:"userId"`
}

type muteRequest struct {
	Audio *bool `json:"audio"`
	Video *bool `json:"video"`
}

type removeGuestRequest struct {
	Reason string `json:"reason"`
}

type connectionRequest struct {
	Connected *bool `json:"connected"`
}

type createBattleRequest struct {
	ParticipantUserIds []string `json:"participantUserIds"`
	DurationSeconds    int      `json:"durationSeconds"`
	WinnerTakesAll     bool     `json:"winnerTakesAll"`
}

type sendGiftRequest struct {
	LiveId         string `json:"liveId"`
	GiftId         string `json:"giftId"`
	Quantity       int    `json:"quantity"`
	ReceiverUserId string `json:"receiverUserId"`
	ComboId        string `json:"comboId"`
}

type pathSendGiftRequest struct {
	GiftId         string `json:"giftId"`
	Quantity       int    `json:"quantity"`
	ReceiverUserId string `json:"receiverUserId"`
	ComboId        string `json:"comboId"`
}

type giftGoalRequest struct {
	Title       *string `json:"title"`
	TargetCoins *int64  `json:"targetCoins"`
	GiftId      *string `json:"giftId"`
}

type engagementRequest struct {
	Action string `json:"action"`
}

type giftRequest struct {
	Id                string         `json:"id"`
	Name              *string        `json:"name"`
	Description       *string        `json:"description"`
	Tier              *string        `json:"tier"`
	PriceCoins        *int64         `json:"priceCoins"`
	AnimationEngine   *string        `json:"animationEngine"`
	AnimationAssetKey *string        `json:"animationAssetKey"`
	PreviewAssetKey   *string        `json:"previewAssetKey"`
	DurationMs        *int           `json:"durationMs"`
	DisplayLevel      *string        `json:"displayLevel"`
	Sound             *string        `json:"sound"`
	Haptic            *string        `json:"haptic"`
	Comboable         *bool          `json:"comboable"`
	IsActive          *bool          `json:"isActive"`
	SortOrder         *int           `json:"sortOrder"`
	Metadata          map[string]any `json:"metadata"`
}
