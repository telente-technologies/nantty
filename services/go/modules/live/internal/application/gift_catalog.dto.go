package application

import "zudomart/modules/live/internal/ent"

type LiveGiftView struct {
	Id                string         `json:"id"`
	Name              string         `json:"name"`
	Description       *string        `json:"description,omitempty"`
	Tier              string         `json:"tier"`
	PriceCoins        int64          `json:"priceCoins"`
	AnimationEngine   string         `json:"animationEngine"`
	AnimationAssetKey string         `json:"animationAssetKey"`
	PreviewAssetKey   string         `json:"previewAssetKey"`
	DurationMs        int            `json:"durationMs"`
	DisplayLevel      string         `json:"displayLevel"`
	Sound             *string        `json:"sound"`
	Haptic            *string        `json:"haptic"`
	Comboable         bool           `json:"comboable"`
	IsActive          bool           `json:"isActive"`
	SortOrder         int            `json:"sortOrder"`
	Metadata          map[string]any `json:"metadata,omitempty"`
}

func presentGift(gift *ent.Gift) LiveGiftView {
	view := LiveGiftView{
		Id: gift.ID, Name: gift.Name, Description: gift.Description, Tier: string(gift.Tier), PriceCoins: gift.PriceCoins,
		AnimationEngine: string(gift.AnimationEngine), AnimationAssetKey: gift.AnimationAssetKey, PreviewAssetKey: gift.PreviewAssetKey,
		DurationMs: gift.DurationMs, DisplayLevel: string(gift.DisplayLevel), Sound: gift.Sound, Comboable: gift.Comboable,
		IsActive: gift.IsActive, SortOrder: gift.SortOrder, Metadata: gift.Metadata,
	}
	if gift.Haptic != nil {
		haptic := string(*gift.Haptic)
		view.Haptic = &haptic
	}
	return view
}
