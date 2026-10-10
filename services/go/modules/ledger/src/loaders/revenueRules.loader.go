package loaders

import (
	"context"
	"encoding/json"
	"log/slog"
)

const RevenueRulesSettingKey = "revenue"

type RevenueRules struct {
	CreatorAdShareBasisPoints          *int64 `json:"creatorAdShareBasisPoints"`
	GiftCreatorShareCeilingBasisPoints *int64 `json:"giftCreatorShareCeilingBasisPoints"`
	CoinTransferFeeBasisPoints         *int64 `json:"coinTransferFeeBasisPoints"`
	CoinUnitValues                     []struct {
		AmountMinor int64  `json:"amountMinor"`
		Currency    string `json:"currency"`
	} `json:"coinUnitValues"`
	EscrowFee struct {
		DefaultBasisPoints      *int64 `json:"defaultBasisPoints"`
		BusinessPlanBasisPoints *int64 `json:"businessPlanBasisPoints"`
	} `json:"escrowFee"`
}

func (source *PlatformSettingsSource) ReadRevenueRules(ctx context.Context) RevenueRules {
	raw, found := source.ReadValue(ctx, RevenueRulesSettingKey)
	var rules RevenueRules
	if found && json.Unmarshal(raw, &rules) != nil {
		source.logger.Warn("revenue setting unreadable, using the environment fallback")
		return RevenueRules{}
	}
	return rules
}

func basisPointsOr(value *int64, fallback int64) int64 {
	if value == nil || *value < 0 || *value >= 10_000 {
		return fallback
	}
	return *value
}

func (source *PlatformSettingsSource) CoinTransferFeeBps(ctx context.Context, environmentFallback int64) int64 {
	return basisPointsOr(source.ReadRevenueRules(ctx).CoinTransferFeeBasisPoints, environmentFallback)
}

func (source *PlatformSettingsSource) CreatorAdShareBps(ctx context.Context, environmentFallback int64) int64 {
	value := source.ReadRevenueRules(ctx).CreatorAdShareBasisPoints
	if value != nil && *value == 10_000 {
		return *value
	}
	return basisPointsOr(value, environmentFallback)
}

func (source *PlatformSettingsSource) GiftCreatorShareCeilingBps(ctx context.Context, environmentFallback int64) int64 {
	return basisPointsOr(source.ReadRevenueRules(ctx).GiftCreatorShareCeilingBasisPoints, environmentFallback)
}

func (source *PlatformSettingsSource) EscrowFeeBps(ctx context.Context, defaultFallback, businessFallback int64) (int64, int64) {
	fee := source.ReadRevenueRules(ctx).EscrowFee
	standard, business := basisPointsOr(fee.DefaultBasisPoints, defaultFallback), basisPointsOr(fee.BusinessPlanBasisPoints, businessFallback)
	if business > standard {
		source.logger.Warn("revenue escrow fee has a business rate above the default, using the environment fallback", slog.Int64("default", standard), slog.Int64("business", business))
		return defaultFallback, businessFallback
	}
	return standard, business
}

func (source *PlatformSettingsSource) CoinCashValuesMinor(ctx context.Context, environmentFallback map[string]int64) map[string]int64 {
	units := source.ReadRevenueRules(ctx).CoinUnitValues
	if len(units) == 0 {
		return environmentFallback
	}
	values := make(map[string]int64, len(units))
	for _, unit := range units {
		if len(unit.Currency) != 3 || unit.AmountMinor <= 0 {
			return environmentFallback
		}
		values[unit.Currency] = unit.AmountMinor
	}
	return values
}
