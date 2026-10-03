package loaders

import (
	"context"
	"encoding/json"
	"time"
)

const (
	GiftShareTiersSettingKey = "gift.shareTiers"
	EscrowPolicySettingKey   = "escrow.policy"
)

type EscrowPolicy struct {
	AutoReleasePeriod      time.Duration
	SellerCreditHoldPeriod time.Duration
	SellerReserveBps       int64
}

type GiftShareTier struct {
	MinimumMonthlyGiftCoins int64 `json:"minimumMonthlyGiftCoins"`
	CreatorShareBps         int64 `json:"creatorShareBps"`
}

func (source *PlatformSettingsSource) ReadEscrowPolicy(ctx context.Context, environmentFallback EscrowPolicy) EscrowPolicy {
	raw, found := source.ReadValue(ctx, EscrowPolicySettingKey)
	if !found {
		return environmentFallback
	}
	var stored struct {
		AutoReleaseDays       int64 `json:"autoReleaseDays"`
		SellerCreditHoldHours int64 `json:"sellerCreditHoldHours"`
		SellerReserveBps      int64 `json:"sellerReserveBps"`
	}
	if json.Unmarshal(raw, &stored) != nil || stored.AutoReleaseDays < 1 {
		return environmentFallback
	}
	return EscrowPolicy{
		AutoReleasePeriod:      time.Duration(stored.AutoReleaseDays) * 24 * time.Hour,
		SellerCreditHoldPeriod: time.Duration(stored.SellerCreditHoldHours) * time.Hour,
		SellerReserveBps:       stored.SellerReserveBps,
	}
}

func (source *PlatformSettingsSource) ReadGiftShareTiers(ctx context.Context) ([]GiftShareTier, bool) {
	raw, found := source.ReadValue(ctx, GiftShareTiersSettingKey)
	if !found {
		return nil, false
	}
	var stored struct {
		Tiers []GiftShareTier `json:"tiers"`
	}
	if json.Unmarshal(raw, &stored) != nil || len(stored.Tiers) == 0 {
		return nil, false
	}
	return stored.Tiers, true
}

func GiftShareBpsForMonthlyVolume(tiers []GiftShareTier, monthlyGiftCoins int64) int64 {
	var share int64
	for _, tier := range tiers {
		if monthlyGiftCoins >= tier.MinimumMonthlyGiftCoins && tier.CreatorShareBps > share {
			share = tier.CreatorShareBps
		}
	}
	return share
}
