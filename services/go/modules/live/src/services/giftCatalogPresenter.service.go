package services

import (
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/types"
)

func presentGift(gift *ent.Gift) types.LiveGiftView {
	view := types.LiveGiftView{
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
