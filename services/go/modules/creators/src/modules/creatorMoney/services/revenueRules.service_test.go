package services

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"testing"

	"zudomart/modules/creators/src/configs"
	"zudomart/modules/creators/src/container"
	"zudomart/modules/ledger/src/loaders"
)

func TestRevenueRulesFollowTheAdminRevenueSetting(t *testing.T) {
	revenue := `{}`
	platform := loaders.NewPlatformSettingsSourceFromFetcher(func(context.Context, string) (json.RawMessage, error) {
		return json.RawMessage(revenue), nil
	}, 0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	settings := configs.CreatorsSettings{}
	settings.Revenue.AdsCreatorShareBps, settings.Revenue.CoinTransferFeeBps = 4000, 2500
	money := CreatorMoney{Container: &container.Container{Resources: loaders.MoneyModuleResources{Platform: platform}, Settings: settings}}
	ctx := context.Background()

	if rules := money.RevenueRules(ctx, "NGN"); rules.AdsRevenueCreatorSharePercent != 40 || rules.CoinTransferPlatformFeePercent != 25 || rules.CoinCashValue.AmountMinor != 1000 {
		t.Fatalf("missing values must use the environment, got %+v", rules)
	}
	revenue = `{"creatorAdShareBasisPoints":5500,"coinTransferFeeBasisPoints":2000,"giftCreatorShareCeilingBasisPoints":6000,"coinUnitValues":[{"amountMinor":1100,"currency":"NGN"}]}`
	rules := money.RevenueRules(ctx, "NGN")
	if rules.AdsRevenueCreatorSharePercent != 55 || rules.CoinTransferPlatformFeePercent != 20 || rules.GiftCreatorSharePercentUpTo != 60 || rules.CoinCashValue.AmountMinor != 1100 {
		t.Fatalf("a changed setting must take effect, got %+v", rules)
	}
}
