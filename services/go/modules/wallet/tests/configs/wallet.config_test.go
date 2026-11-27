package configs_test

import (
	"encoding/base64"
	"testing"

	"nantty/modules/wallet/src/configs"
	platformconfig "nantty/platform/config"
)

func TestWalletCreatorMinimumPayoutDefaultsToTwentyThousandNairaAndCanBeConfigured(t *testing.T) {
	t.Setenv("DATA_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(make([]byte, 32)))
	t.Setenv("CREATOR_MINIMUM_PAYOUTS", "")
	settings := configs.ReadWalletSettingsFromEnvironment(platformconfig.NewEnvironmentReader())
	if settings.MinimumPayoutMinorByCurrency["NGN"] != 2_000_000 {
		t.Fatalf("NGN default minimum must be ₦20,000 in minor units, got %d", settings.MinimumPayoutMinorByCurrency["NGN"])
	}

	t.Setenv("CREATOR_MINIMUM_PAYOUTS", "NGN:3000000,EUR:1200")
	settings = configs.ReadWalletSettingsFromEnvironment(platformconfig.NewEnvironmentReader())
	if settings.MinimumPayoutMinorByCurrency["NGN"] != 3_000_000 || settings.MinimumPayoutMinorByCurrency["EUR"] != 1_200 {
		t.Fatalf("explicit currency overrides must be preserved: %+v", settings.MinimumPayoutMinorByCurrency)
	}
}
