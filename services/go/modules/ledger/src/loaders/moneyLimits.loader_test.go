package loaders

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"nantty/platform/regionpricing"
)

func TestSellerDebtLimitsPickTheLevelAndHalveOutsideNigeria(t *testing.T) {
	limits := ParseSellerDebtLimitsFromEnvironment("unverified:1000000,payoutVerified:5000000,identityVerified:20000000", 50, 90, 90)
	naira := limits.AmountsIn("NGN", regionpricing.DefaultUsdRatesE8)
	if naira.ForLevel(0, false) != 1_000_000 || naira.ForLevel(1, false) != 5_000_000 || naira.ForLevel(2, false) != 20_000_000 || naira.ForLevel(1, true) != 20_000_000 {
		t.Fatalf("NG limits by level, trusted sellers get the top level: %+v", naira)
	}
	cedis := limits.AmountsIn("GHS", regionpricing.DefaultUsdRatesE8)
	full := regionpricing.ConvertLimitFromBaseCurrency(1_000_000, "GHS", regionpricing.DefaultUsdRatesE8)
	if cedis.Unverified <= 0 || cedis.Unverified >= full || cedis.Unverified > full/2+full/10 {
		t.Fatalf("outside Nigeria is about half the NG amount in local currency: half=%d full=%d", cedis.Unverified, full)
	}
	limits.CurrencyOverrides["GHS"] = DebtLevelAmounts{Unverified: 7_000, PayoutVerified: 30_000, IdentityVerified: 90_000}
	if limits.AmountsIn("ghs", regionpricing.DefaultUsdRatesE8).ForLevel(1, false) != 30_000 {
		t.Fatal("an explicit currency override wins over the conversion")
	}
}

func TestPaymentLimitsComeFromAdminSettingsWithAnEnvironmentFallback(t *testing.T) {
	fallback := ParsePaymentLimitsFromEnvironment("orderCheckout:500000000,coinPurchase:50000000,adsTopUp:1000000000", "basic:5000000,mid:20000000,full:500000000")
	if fallback.Base.OrderCheckout != 500_000_000 || fallback.Base.WalletDaily.Mid != 20_000_000 {
		t.Fatalf("environment defaults: %+v", fallback.Base)
	}
	stored, _ := json.Marshal(PaymentLimits{Base: PaymentLimitAmounts{OrderCheckout: 1, CoinPurchase: 2, AdsTopUp: 3, WalletDaily: WalletDailyAmounts{Basic: 4, Mid: 5, Full: 6}}})
	source := NewPlatformSettingsSourceFromFetcher(func(_ context.Context, key string) (json.RawMessage, error) {
		if key == PaymentLimitsSettingKey {
			return stored, nil
		}
		return nil, context.Canceled
	}, time.Minute, nil)
	if got := source.ReadPaymentLimits(context.Background(), fallback); got.Base.OrderCheckout != 1 || got.CurrencyOverrides == nil {
		t.Fatalf("the admin setting is the source of truth: %+v", got)
	}
	if got := source.ReadSellerDebtLimits(context.Background(), DefaultSellerDebtLimits()); got.Base.Unverified != 1_000_000 {
		t.Fatalf("an unreadable setting falls back to the environment: %+v", got)
	}
	if rates := source.UsdRatesE8(context.Background()); rates["NGN"] == 0 {
		t.Fatal("without the currency module the default rates are used")
	}
}
