package configs

import (
	"strconv"
	"strings"

	"nantty/modules/ledger/src/loaders"
	platformconfig "nantty/platform/config"
)

type RevenueSettings struct {
	TipCreatorShareBps           int64
	AdsCreatorShareBps           int64
	SubscriptionCreatorShareBps  int64
	CoinTransferFeeBps           int64
	MaximumAffiliateBps          int64
	ViolationLookbackDays        int
	CoinCashValueMinorByCurrency map[string]int64
	MinimumPayoutMinorByCurrency map[string]int64
}

type CreatorsSettings struct {
	Money                          loaders.MoneyModuleSettings
	DefaultTierId                  string
	Revenue                        RevenueSettings
	SpaceDonationMinimumCoins      int64
	SpaceDonationMaximumCoins      int64
	BattleContributionMinimumCoins int64
	BattleContributionMaximumCoins int64
	UsersSchema                    string
	SocialSchema                   string
	LiveSchema                     string
	CatalogSchema                  string
	InventorySchema                string
	SocialInternalUrl              string
	SocialInternalToken            string
	AdminInternalUrl               string
	AdminInternalToken             string
	InternalApiToken               string
}

func ReadCreatorsSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) CreatorsSettings {
	minimumDonation := int64(reader.ReadIntegerOrDefault("SPACE_COIN_DONATION_MIN_COINS", 1))
	maximumDonation := int64(reader.ReadIntegerOrDefault("SPACE_COIN_DONATION_MAX_COINS", 10000))
	// The explicit defaults are a conservative policy, not user-selected coin denominations.
	// Operators can adjust them centrally; the amount bound also keeps ledger arithmetic safe.
	if minimumDonation < 1 || maximumDonation < minimumDonation || maximumDonation > 1<<62 {
		reader.ReportProblem("SPACE_COIN_DONATION_MIN_COINS must be positive and no greater than SPACE_COIN_DONATION_MAX_COINS, which must not exceed 4611686018427387904")
		minimumDonation, maximumDonation = 1, 10000
	}
	minimumBattleContribution := int64(reader.ReadIntegerOrDefault("LIVE_BATTLE_CONTRIBUTION_MIN_COINS", 1))
	maximumBattleContribution := int64(reader.ReadIntegerOrDefault("LIVE_BATTLE_CONTRIBUTION_MAX_COINS", 10000))
	if minimumBattleContribution < 1 || maximumBattleContribution < minimumBattleContribution || maximumBattleContribution > 1<<62 {
		reader.ReportProblem("LIVE_BATTLE_CONTRIBUTION_MIN_COINS must be positive and no greater than LIVE_BATTLE_CONTRIBUTION_MAX_COINS, which must not exceed 4611686018427387904")
		minimumBattleContribution, maximumBattleContribution = 1, 10000
	}
	return CreatorsSettings{
		Money:                          loaders.ReadMoneyModuleSettingsFromEnvironment(reader, "creators"),
		DefaultTierId:                  reader.ReadStringOrDefault("CREATORS_DEFAULT_TIER", "starter"),
		SpaceDonationMinimumCoins:      minimumDonation,
		SpaceDonationMaximumCoins:      maximumDonation,
		BattleContributionMinimumCoins: minimumBattleContribution,
		BattleContributionMaximumCoins: maximumBattleContribution,
		Revenue: RevenueSettings{
			TipCreatorShareBps:           int64(reader.ReadIntegerOrDefault("TIP_CREATOR_SHARE_BPS", 7000)),
			AdsCreatorShareBps:           int64(reader.ReadIntegerOrDefault("ADS_REVENUE_CREATOR_SHARE_BPS", 4000)),
			SubscriptionCreatorShareBps:  8000,
			CoinTransferFeeBps:           int64(reader.ReadIntegerOrDefault("COIN_TRANSFER_FEE_BPS", 200)),
			MaximumAffiliateBps:          int64(reader.ReadIntegerOrDefault("AFFILIATE_MAX_COMMISSION_BPS", 5000)),
			ViolationLookbackDays:        reader.ReadIntegerOrDefault("CREATOR_VIOLATION_LOOKBACK_DAYS", 90),
			CoinCashValueMinorByCurrency: ParseCurrencyAmounts(reader.ReadStringOrDefault("COIN_CASH_VALUES", "NGN:1000,GHS:10,KES:100,ZAR:15,GBP:1,EUR:1,USD:1")),
			MinimumPayoutMinorByCurrency: ParseCurrencyAmounts(reader.ReadStringOrDefault("CREATOR_MINIMUM_PAYOUTS", "NGN:1000,GHS:1000,KES:1000,ZAR:1000,GBP:1000,EUR:1000,USD:1000")),
		},
		UsersSchema:         reader.ReadStringOrDefault("CREATORS_USERS_SCHEMA", "users"),
		SocialSchema:        reader.ReadStringOrDefault("CREATORS_SOCIAL_SCHEMA", "social"),
		LiveSchema:          reader.ReadStringOrDefault("CREATORS_LIVE_SCHEMA", "live"),
		CatalogSchema:       reader.ReadStringOrDefault("CREATORS_CATALOG_SCHEMA", "catalog"),
		InventorySchema:     reader.ReadStringOrDefault("CREATORS_INVENTORY_SCHEMA", "inventory"),
		SocialInternalUrl:   reader.ReadStringOrDefault("SOCIAL_INTERNAL_URL", ""),
		SocialInternalToken: reader.ReadStringOrDefault("SOCIAL_INTERNAL_API_TOKEN", ""),
		AdminInternalUrl:    reader.ReadStringOrDefault("ADMIN_INTERNAL_URL", ""),
		AdminInternalToken:  reader.ReadStringOrDefault("ADMIN_INTERNAL_API_TOKEN", ""),
		InternalApiToken:    reader.ReadStringOrDefault("MONEY_INTERNAL_API_TOKEN", ""),
	}
}

func ParseCurrencyAmounts(raw string) map[string]int64 {
	amounts := map[string]int64{}
	for _, entry := range strings.Split(raw, ",") {
		currency, amount, found := strings.Cut(strings.TrimSpace(entry), ":")
		if value, err := strconv.ParseInt(amount, 10, 64); found && err == nil && value >= 0 && len(currency) == 3 {
			amounts[strings.ToUpper(currency)] = value
		}
	}
	return amounts
}
