package configs

import (
	"time"

	"nantty/modules/ledger/src/loaders"
	platformconfig "nantty/platform/config"
)

type EscrowSettings struct {
	Money                    loaders.MoneyModuleSettings
	PlatformCommissionBps    int64
	InspectionPeriod         time.Duration
	SellerResponseWindow     time.Duration
	AutoReleaseSweepInterval time.Duration
	SellerCreditHoldPeriod   time.Duration
	StaffReviewWindow        time.Duration
	UndeliveredReleasePeriod time.Duration
	InternalApiToken         string
}

const DefaultUndeliveredReleasePeriod = 30 * 24 * time.Hour

func (settings EscrowSettings) UndeliveredReleaseWindow() time.Duration {
	if settings.UndeliveredReleasePeriod <= 0 {
		return DefaultUndeliveredReleasePeriod
	}
	return settings.UndeliveredReleasePeriod
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
		StaffReviewWindow:        reader.ReadDurationOrDefault("ESCROW_STAFF_REVIEW_WINDOW", 48*time.Hour),
		UndeliveredReleasePeriod: reader.ReadDurationOrDefault("ESCROW_UNDELIVERED_RELEASE_PERIOD", DefaultUndeliveredReleasePeriod),
	}
	if settings.PlatformCommissionBps < 0 || settings.PlatformCommissionBps > 10_000 {
		reader.ReadRequiredString("ESCROW_FEE_BPS_BETWEEN_0_AND_10000")
	}
	return settings
}
