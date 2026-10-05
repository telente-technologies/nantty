package dtos

import "encoding/json"

type SendGiftRequest struct {
	LiveId         string `json:"liveId"`
	GiftId         string `json:"giftId"`
	Quantity       int    `json:"quantity"`
	ReceiverUserId string `json:"receiverUserId"`
	ComboId        string `json:"comboId"`
}

type PathSendGiftRequest struct {
	GiftId         string `json:"giftId"`
	Quantity       int    `json:"quantity"`
	ReceiverUserId string `json:"receiverUserId"`
	ComboId        string `json:"comboId"`
}

type GiftGoalRequest struct {
	Title       *string        `json:"title"`
	TargetCoins *int64         `json:"targetCoins"`
	GiftId      NullableString `json:"giftId"`
}

type NullableString struct {
	Present bool
	Value   *string
}

func (field *NullableString) UnmarshalJSON(raw []byte) error {
	field.Present = true
	return json.Unmarshal(raw, &field.Value)
}

type GiftRequest struct {
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
