package configs

import (
	"strings"
	"time"

	"zudomart/modules/ledger/src/loaders"
	platformconfig "zudomart/platform/config"
)

const FlutterwaveBaseUrl = "https://api.flutterwave.com/v3"

type FlutterwaveSettings struct {
	BaseUrl             string
	SecretKey           string
	WebhookHash         string
	MerchantId          string
	SupportedCurrencies []string
	TransferCallbackUrl string
	MaximumAttempts     int
}

type WalletSettings struct {
	AliasEmailDomain             string
	PsaCountries                 []string
	DepositFeeBps                int64
	DepositFeeCaps               map[string]int64
	DepositHold                  time.Duration
	FirstDepositHold             time.Duration
	CardBuyerWalletAtCheckout    bool
	ReconciliationDriftTolerance int64
	MovementStuckAfter           time.Duration
}

func ReadFlutterwaveSettings(reader *platformconfig.EnvironmentReader) FlutterwaveSettings {
	return FlutterwaveSettings{
		BaseUrl: reader.ReadStringOrDefault("FLUTTERWAVE_API_BASE_URL", FlutterwaveBaseUrl), SecretKey: reader.ReadStringOrDefault("FLUTTERWAVE_SECRET_KEY", ""),
		WebhookHash: reader.ReadStringOrDefault("FLUTTERWAVE_WEBHOOK_HASH", ""), MerchantId: reader.ReadStringOrDefault("FLUTTERWAVE_MERCHANT_ID", ""),
		SupportedCurrencies: reader.ReadCommaSeparatedListOrDefault("FLUTTERWAVE_SUPPORTED_CURRENCIES", []string{"NGN", "GHS", "KES", "ZAR", "USD"}),
		TransferCallbackUrl: reader.ReadStringOrDefault("FLUTTERWAVE_TRANSFER_CALLBACK_URL", ""),
		MaximumAttempts:     reader.ReadIntegerOrDefault("FLUTTERWAVE_MAXIMUM_READ_ATTEMPTS", 3),
	}
}

func ReadWalletSettings(reader *platformconfig.EnvironmentReader) WalletSettings {
	return WalletSettings{
		AliasEmailDomain:             reader.ReadStringOrDefault("WALLET_ALIAS_EMAIL_DOMAIN", "wallets.zudomart.com"),
		PsaCountries:                 reader.ReadCommaSeparatedListOrDefault("WALLET_PSA_COUNTRIES", []string{"NG"}),
		DepositFeeBps:                int64(reader.ReadIntegerOrDefault("WALLET_DEPOSIT_FEE_BPS", 50)),
		DepositFeeCaps:               loaders.ParseCurrencyAmountMap(reader.ReadStringOrDefault("WALLET_DEPOSIT_FEE_CAPS", "NGN:100000")),
		DepositHold:                  reader.ReadDurationOrDefault("DEPOSIT_WITHDRAWAL_COOLDOWN", 24*time.Hour),
		FirstDepositHold:             reader.ReadDurationOrDefault("FIRST_DEPOSIT_WITHDRAWAL_COOLDOWN", 72*time.Hour),
		CardBuyerWalletAtCheckout:    reader.ReadStringOrDefault("WALLET_CARD_BUYER_PSA_AT_CHECKOUT", "true") == "true",
		ReconciliationDriftTolerance: int64(reader.ReadIntegerOrDefault("WALLET_RECONCILIATION_DRIFT_TOLERANCE_MINOR", 0)),
		MovementStuckAfter:           reader.ReadDurationOrDefault("WALLET_MOVEMENT_STUCK_AFTER", time.Hour),
	}
}

func (settings WalletSettings) UsesProviderWallets(country string) bool {
	for _, supported := range settings.PsaCountries {
		if strings.EqualFold(supported, country) {
			return true
		}
	}
	return false
}

func (settings WalletSettings) DepositFee(currency string, grossMinor int64) int64 {
	if settings.DepositFeeBps <= 0 || grossMinor <= 0 {
		return 0
	}
	fee := (grossMinor*settings.DepositFeeBps + 9_999) / 10_000
	if cap, capped := settings.DepositFeeCaps[currency]; capped && fee > cap {
		fee = cap
	}
	return min(fee, grossMinor)
}

func flutterwaveKeyProblems(settings PaymentsSettings) []string {
	key, production := settings.Flutterwave.SecretKey, settings.Money.IsProduction()
	var problems []string
	if key != "" && ((production && (!strings.HasPrefix(key, "FLWSECK-") || strings.Contains(key, "_TEST"))) || (!production && !strings.HasPrefix(key, "FLWSECK_TEST-"))) {
		problems = append(problems, "FLUTTERWAVE_SECRET_KEY_MUST_MATCH_APP_ENV")
	}
	if key == "" && !production {
		return append(problems, depositFeeProblems(settings)...)
	}
	if key == "" {
		problems = append(problems, "FLUTTERWAVE_SECRET_KEY")
	}
	if len(settings.Flutterwave.WebhookHash) < 32 {
		problems = append(problems, "FLUTTERWAVE_WEBHOOK_HASH_AT_LEAST_32_CHARACTERS")
	}
	if settings.Flutterwave.MerchantId == "" {
		problems = append(problems, "FLUTTERWAVE_MERCHANT_ID")
	}
	return append(problems, depositFeeProblems(settings)...)
}

func depositFeeProblems(settings PaymentsSettings) []string {
	var problems []string
	if settings.Wallets.DepositFeeBps < 0 || settings.Wallets.DepositFeeBps >= 10_000 {
		problems = append(problems, "WALLET_DEPOSIT_FEE_BPS_BETWEEN_0_AND_9999")
	}
	return problems
}
