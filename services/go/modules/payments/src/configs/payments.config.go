package configs

import (
	"strconv"
	"strings"

	"zudomart/modules/ledger/src/loaders"
	platformconfig "zudomart/platform/config"
)

type PaymentsSettings struct {
	Money                     loaders.MoneyModuleSettings
	PaystackSecretKey         string
	PaystackBaseUrl           string
	FlutterwaveSecretKey      string
	FlutterwaveWebhookHash    string
	FlutterwaveBaseUrl        string
	DefaultProvider           string
	AllowedReturnUrls         []string
	CustomerEmailDomain       string
	TransferFeeOverrides      map[string]int64
	AppleInAppPurchaseFeeBps  int64
	GooglePlayBillingFeeBps   int64
	AppleInAppPurchaseEnabled bool
	GooglePlayBillingEnabled  bool
}

func ReadPaymentsSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) PaymentsSettings {
	settings := PaymentsSettings{
		Money:                     loaders.ReadMoneyModuleSettingsFromEnvironment(reader, "payments"),
		PaystackSecretKey:         reader.ReadStringOrDefault("PAYSTACK_SECRET_KEY", ""),
		PaystackBaseUrl:           reader.ReadStringOrDefault("PAYSTACK_BASE_URL", "https://api.paystack.co"),
		FlutterwaveSecretKey:      reader.ReadStringOrDefault("FLUTTERWAVE_SECRET_KEY", ""),
		FlutterwaveWebhookHash:    reader.ReadStringOrDefault("FLUTTERWAVE_WEBHOOK_HASH", ""),
		FlutterwaveBaseUrl:        reader.ReadStringOrDefault("FLUTTERWAVE_BASE_URL", "https://api.flutterwave.com/v3"),
		DefaultProvider:           reader.ReadStringOrDefault("PAYMENTS_DEFAULT_PROVIDER", "paystack"),
		AllowedReturnUrls:         reader.ReadCommaSeparatedListOrDefault("PAYMENT_RETURN_URLS", []string{"zudomart://payments/return"}),
		CustomerEmailDomain:       reader.ReadStringOrDefault("PAYMENT_CUSTOMER_EMAIL_DOMAIN", "customers.zudomart.app"),
		TransferFeeOverrides:      parseTransferFeeOverrides(reader.ReadStringOrDefault("PAYOUT_TRANSFER_FEE_OVERRIDES", "")),
		AppleInAppPurchaseFeeBps:  int64(reader.ReadIntegerOrDefault("APPLE_IAP_STORE_FEE_BPS", 3000)),
		GooglePlayBillingFeeBps:   int64(reader.ReadIntegerOrDefault("GOOGLE_PLAY_STORE_FEE_BPS", 1500)),
		AppleInAppPurchaseEnabled: reader.ReadStringOrDefault("APPLE_IAP_ISSUER_ID", "") != "",
		GooglePlayBillingEnabled:  reader.ReadStringOrDefault("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "") != "",
	}
	for _, problem := range ProviderKeyEnvironmentMismatches(settings) {
		reader.ReadRequiredString(problem)
	}
	return settings
}

func ProviderKeyEnvironmentMismatches(settings PaymentsSettings) []string {
	production := settings.Money.IsProduction()
	var problems []string
	paystackLive := strings.HasPrefix(settings.PaystackSecretKey, "sk_live_")
	if settings.PaystackSecretKey != "" && production != paystackLive {
		problems = append(problems, "PAYSTACK_SECRET_KEY_MUST_MATCH_APP_ENV")
	}
	flutterwaveTest := strings.Contains(settings.FlutterwaveSecretKey, "_TEST")
	if settings.FlutterwaveSecretKey != "" && production == flutterwaveTest {
		problems = append(problems, "FLUTTERWAVE_SECRET_KEY_MUST_MATCH_APP_ENV")
	}
	return problems
}

func parseTransferFeeOverrides(raw string) map[string]int64 {
	overrides := map[string]int64{}
	for _, entry := range strings.Split(raw, ",") {
		parts := strings.Split(strings.TrimSpace(entry), ":")
		if len(parts) != 3 {
			continue
		}
		fee, err := strconv.ParseInt(parts[2], 10, 64)
		if err != nil || fee < 0 {
			continue
		}
		overrides[parts[0]+":"+strings.ToUpper(parts[1])] = fee
	}
	return overrides
}
