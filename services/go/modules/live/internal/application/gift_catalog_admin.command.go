package application

import (
	"context"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/gift"
)

type GiftInput struct {
	Id                string
	Name              *string
	Description       *string
	Tier              *string
	PriceCoins        *int64
	AnimationEngine   *string
	AnimationAssetKey *string
	PreviewAssetKey   *string
	DurationMs        *int
	DisplayLevel      *string
	Sound             *string
	Haptic            *string
	Comboable         *bool
	IsActive          *bool
	SortOrder         *int
	Metadata          map[string]any
}

func (application *LiveApplication) CreateGift(ctx context.Context, input GiftInput) (LiveGiftView, error) {
	builder := application.Client.Gift.Create().SetID(input.Id).SetName(*input.Name).SetTier(gift.Tier(*input.Tier)).SetPriceCoins(*input.PriceCoins).
		SetAnimationAssetKey(*input.AnimationAssetKey).SetPreviewAssetKey(*input.PreviewAssetKey).SetDurationMs(*input.DurationMs).
		SetDisplayLevel(gift.DisplayLevel(*input.DisplayLevel)).SetNillableDescription(input.Description).SetNillableSound(input.Sound)
	if input.AnimationEngine != nil {
		builder.SetAnimationEngine(gift.AnimationEngine(*input.AnimationEngine))
	}
	if input.Haptic != nil {
		builder.SetHaptic(gift.Haptic(*input.Haptic))
	}
	if input.Comboable != nil {
		builder.SetComboable(*input.Comboable)
	}
	if input.IsActive != nil {
		builder.SetIsActive(*input.IsActive)
	}
	if input.SortOrder != nil {
		builder.SetSortOrder(*input.SortOrder)
	}
	if input.Metadata != nil {
		builder.SetMetadata(input.Metadata)
	}
	created, err := builder.Save(ctx)
	if ent.IsConstraintError(err) {
		return LiveGiftView{}, apiError(409, "GIFT_ALREADY_EXISTS", "A gift with this id already exists.")
	}
	if err != nil {
		return LiveGiftView{}, err
	}
	return presentGift(created), nil
}

func (application *LiveApplication) UpdateGift(ctx context.Context, input GiftInput) (LiveGiftView, error) {
	update := application.Client.Gift.UpdateOneID(input.Id)
	if input.Name != nil {
		update.SetName(*input.Name)
	}
	if input.Description != nil {
		update.SetDescription(*input.Description)
	}
	if input.Tier != nil {
		update.SetTier(gift.Tier(*input.Tier))
	}
	if input.PriceCoins != nil {
		update.SetPriceCoins(*input.PriceCoins)
	}
	if input.AnimationEngine != nil {
		update.SetAnimationEngine(gift.AnimationEngine(*input.AnimationEngine))
	}
	if input.AnimationAssetKey != nil {
		update.SetAnimationAssetKey(*input.AnimationAssetKey)
	}
	if input.PreviewAssetKey != nil {
		update.SetPreviewAssetKey(*input.PreviewAssetKey)
	}
	if input.DurationMs != nil {
		update.SetDurationMs(*input.DurationMs)
	}
	if input.DisplayLevel != nil {
		update.SetDisplayLevel(gift.DisplayLevel(*input.DisplayLevel))
	}
	if input.Sound != nil {
		update.SetSound(*input.Sound)
	}
	if input.Haptic != nil {
		update.SetHaptic(gift.Haptic(*input.Haptic))
	}
	if input.Comboable != nil {
		update.SetComboable(*input.Comboable)
	}
	if input.IsActive != nil {
		update.SetIsActive(*input.IsActive)
	}
	if input.SortOrder != nil {
		update.SetSortOrder(*input.SortOrder)
	}
	if input.Metadata != nil {
		update.SetMetadata(input.Metadata)
	}
	updated, err := update.Save(ctx)
	if ent.IsNotFound(err) {
		return LiveGiftView{}, errGiftNotFound
	}
	if err != nil {
		return LiveGiftView{}, err
	}
	return presentGift(updated), nil
}

func (application *LiveApplication) RetireGift(ctx context.Context, giftId string) error {
	err := application.Client.Gift.UpdateOneID(giftId).SetIsActive(false).Exec(ctx)
	if ent.IsNotFound(err) {
		return errGiftNotFound
	}
	return err
}
