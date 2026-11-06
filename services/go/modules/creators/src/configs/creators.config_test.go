package configs

import (
	"testing"

	platformconfig "nantty/platform/config"
)

func TestSpaceDonationPolicyDefaultsAndValidation(t *testing.T) {
	for _, name := range []string{"SPACE_COIN_DONATION_MIN_COINS", "SPACE_COIN_DONATION_MAX_COINS"} {
		t.Setenv(name, "")
	}
	settings := ReadCreatorsSettingsFromEnvironment(platformconfig.NewEnvironmentReader())
	if settings.SpaceDonationMinimumCoins != 1 || settings.SpaceDonationMaximumCoins != 10000 {
		t.Fatalf("default donation policy = %d..%d", settings.SpaceDonationMinimumCoins, settings.SpaceDonationMaximumCoins)
	}

	t.Setenv("SPACE_COIN_DONATION_MIN_COINS", "7")
	t.Setenv("SPACE_COIN_DONATION_MAX_COINS", "250")
	settings = ReadCreatorsSettingsFromEnvironment(platformconfig.NewEnvironmentReader())
	if settings.SpaceDonationMinimumCoins != 7 || settings.SpaceDonationMaximumCoins != 250 {
		t.Fatalf("configured donation policy = %d..%d", settings.SpaceDonationMinimumCoins, settings.SpaceDonationMaximumCoins)
	}

	t.Setenv("SPACE_COIN_DONATION_MIN_COINS", "251")
	reader := platformconfig.NewEnvironmentReader()
	settings = ReadCreatorsSettingsFromEnvironment(reader)
	if settings.SpaceDonationMinimumCoins != 1 || settings.SpaceDonationMaximumCoins != 10000 || reader.CombinedConfigurationError() == nil {
		t.Fatalf("invalid policy must be reported and safely reset: settings=%+v", settings)
	}
}

func TestBattleContributionBoundsDefaultConfigureAndRejectInvalidRanges(t *testing.T) {
	t.Setenv("LIVE_BATTLE_CONTRIBUTION_MIN_COINS", "")
	t.Setenv("LIVE_BATTLE_CONTRIBUTION_MAX_COINS", "")
	settings := ReadCreatorsSettingsFromEnvironment(platformconfig.NewEnvironmentReader())
	if settings.BattleContributionMinimumCoins != 1 || settings.BattleContributionMaximumCoins != 10000 {
		t.Fatalf("default battle contribution bounds = %d..%d", settings.BattleContributionMinimumCoins, settings.BattleContributionMaximumCoins)
	}
	t.Setenv("LIVE_BATTLE_CONTRIBUTION_MIN_COINS", "10")
	t.Setenv("LIVE_BATTLE_CONTRIBUTION_MAX_COINS", "500")
	settings = ReadCreatorsSettingsFromEnvironment(platformconfig.NewEnvironmentReader())
	if settings.BattleContributionMinimumCoins != 10 || settings.BattleContributionMaximumCoins != 500 {
		t.Fatalf("configured battle contribution bounds = %d..%d", settings.BattleContributionMinimumCoins, settings.BattleContributionMaximumCoins)
	}
	t.Setenv("LIVE_BATTLE_CONTRIBUTION_MAX_COINS", "9")
	reader := platformconfig.NewEnvironmentReader()
	settings = ReadCreatorsSettingsFromEnvironment(reader)
	if settings.BattleContributionMinimumCoins != 1 || settings.BattleContributionMaximumCoins != 10000 || reader.CombinedConfigurationError() == nil {
		t.Fatalf("invalid bounds must be reported and reset: settings=%+v", settings)
	}
}
