package configs

import (
	"time"

	"zudomart/modules/ledger/src/loaders"
	platformconfig "zudomart/platform/config"
)

type EscrowSettings struct {
	Money                    loaders.MoneyModuleSettings
	PlatformCommissionBps    int64
	InspectionPeriod         time.Duration
	SellerResponseWindow     time.Duration
	AutoReleaseSweepInterval time.Duration
	SellerCreditHoldPeriod   time.Duration
	InternalApiToken         string
}

func ReadEscrowSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) EscrowSettings {
	settings := EscrowSettings{
		Money:                    loaders.ReadMoneyModuleSettingsFromEnvironment(reader, "escrow"),
		PlatformCommissionBps:    int64(reader.ReadIntegerOrDefault("ESCROW_FEE_BPS", 150)),
		InternalApiToken:         reader.ReadStringOrDefault("MONEY_INTERNAL_API_TOKEN", ""),
		InspectionPeriod:         reader.ReadDurationOrDefault("ESCROW_INSPECTION_PERIOD", 72*time.Hour),
		SellerResponseWindow:     reader.ReadDurationOrDefault("ESCROW_SELLER_RESPONSE_WINDOW", 48*time.Hour),
		AutoReleaseSweepInterval: reader.ReadDurationOrDefault("ESCROW_AUTO_RELEASE_SWEEP_INTERVAL", time.Minute),
		SellerCreditHoldPeriod:   reader.ReadDurationOrDefault("SELLER_CREDIT_HOLD_PERIOD", 24*time.Hour),
	}
	if settings.PlatformCommissionBps < 0 || settings.PlatformCommissionBps > 10_000 {
		reader.ReadRequiredString("ESCROW_FEE_BPS_BETWEEN_0_AND_10000")
	}
	return settings
}
