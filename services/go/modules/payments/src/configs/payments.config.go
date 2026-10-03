package configs

import (
	"strconv"
	"strings"

	"zudomart/modules/ledger/src/loaders"
	platformconfig "zudomart/platform/config"
)

const (
	BachsSandboxBaseUrl    = "https://sandbox-api.bachs.io"
	BachsProductionBaseUrl = "https://api.bachs.io"
)

type PaymentsSettings struct {
	Money                       loaders.MoneyModuleSettings
	BachsBaseUrl                string
	BachsSecretKey              string
	BachsWebhookSigningSecrets  []string
	BachsPayoutFeeOverrides     map[string]int64
	BachsPayoutFeeSchedule      string
	BachsMaximumAttempts        int
	DefaultProvider             string
	AllowedReturnUrls           []string
	OnboardingReturnUrl         string
	OnboardingRefreshUrl        string
	ConnectedAccountCountry     string
	PlatformCommissionBps       int64
	CheckoutExpiryMinutes       int
	AccountDirectorySchema      string
	WebSubscriptionPlanProducts map[string]string
	AppleInAppPurchaseFeeBps    int64
	GooglePlayBillingFeeBps     int64
	AppleInAppPurchaseEnabled   bool
	GooglePlayBillingEnabled    bool
	AppleStore                  AppleStoreSettings
	GooglePlay                  GooglePlaySettings
	SavedCardFingerprintKey     string
}

type AppleStoreSettings struct {
	BundleId            string
	Environment         string
	RootCertificatesPem string
	IssuerId            string
	KeyId               string
	PrivateKeyPem       string
	ApiBaseUrl          string
}

type GooglePlaySettings struct {
	PackageName            string
	ServiceAccountJson     string
	ApiBaseUrl             string
	ProductPrices          string
	SubscriptionProductIds []string
	PushToken              string
}

func ReadPaymentsSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) PaymentsSettings {
	settings := PaymentsSettings{
		Money:                       loaders.ReadMoneyModuleSettingsFromEnvironment(reader, "payments"),
		BachsBaseUrl:                reader.ReadStringOrDefault("BACHS_API_BASE_URL", BachsSandboxBaseUrl),
		BachsSecretKey:              reader.ReadStringOrDefault("BACHS_SECRET_KEY", ""),
		BachsWebhookSigningSecrets:  reader.ReadCommaSeparatedListOrDefault("BACHS_WEBHOOK_SIGNING_SECRETS", nil),
		BachsPayoutFeeOverrides:     parseCurrencyAmountOverrides(reader.ReadStringOrDefault("BACHS_PAYOUT_FEE_OVERRIDES", "")),
		BachsPayoutFeeSchedule:      reader.ReadStringOrDefault("BACHS_PAYOUT_FEE_SCHEDULE", ""),
		BachsMaximumAttempts:        reader.ReadIntegerOrDefault("BACHS_MAXIMUM_ATTEMPTS", 3),
		DefaultProvider:             reader.ReadStringOrDefault("PAYMENTS_DEFAULT_PROVIDER", "bachs"),
		AllowedReturnUrls:           reader.ReadCommaSeparatedListOrDefault("PAYMENT_RETURN_URLS", []string{"https://zudomart.com/pay/return", "https://app.zudomart.com/pay/return"}),
		OnboardingReturnUrl:         reader.ReadStringOrDefault("CONNECT_ONBOARDING_RETURN_URL", "https://zudomart.com/seller/verification/return"),
		OnboardingRefreshUrl:        reader.ReadStringOrDefault("CONNECT_ONBOARDING_REFRESH_URL", "https://zudomart.com/seller/verification/refresh"),
		ConnectedAccountCountry:     reader.ReadStringOrDefault("CONNECT_ACCOUNT_COUNTRY", "NG"),
		PlatformCommissionBps:       int64(reader.ReadIntegerOrDefault("ESCROW_PLATFORM_COMMISSION_BPS", 500)),
		CheckoutExpiryMinutes:       reader.ReadIntegerOrDefault("CHECKOUT_SESSION_EXPIRY_MINUTES", 15),
		AccountDirectorySchema:      reader.ReadStringOrDefault("PAYMENTS_ACCOUNT_DIRECTORY_SCHEMA", "auth"),
		WebSubscriptionPlanProducts: parsePlanProducts(reader.ReadStringOrDefault("BACHS_SUBSCRIPTION_PLAN_PRODUCTS", "")),
		AppleInAppPurchaseFeeBps:    int64(reader.ReadIntegerOrDefault("APPLE_IAP_STORE_FEE_BPS", 3000)),
		GooglePlayBillingFeeBps:     int64(reader.ReadIntegerOrDefault("GOOGLE_PLAY_STORE_FEE_BPS", 1500)),
		AppleStore: AppleStoreSettings{
			BundleId: reader.ReadStringOrDefault("APPLE_IAP_BUNDLE_ID", ""), Environment: reader.ReadStringOrDefault("APPLE_IAP_ENVIRONMENT", "Sandbox"),
			RootCertificatesPem: reader.ReadStringOrDefault("APPLE_IAP_ROOT_CERTIFICATES_PEM", ""), IssuerId: reader.ReadStringOrDefault("APPLE_IAP_ISSUER_ID", ""),
			KeyId: reader.ReadStringOrDefault("APPLE_IAP_KEY_ID", ""), PrivateKeyPem: reader.ReadStringOrDefault("APPLE_IAP_PRIVATE_KEY_PEM", ""),
			ApiBaseUrl: reader.ReadStringOrDefault("APPLE_IAP_API_BASE_URL", "https://api.storekit-sandbox.itunes.apple.com"),
		},
		GooglePlay: GooglePlaySettings{
			PackageName: reader.ReadStringOrDefault("GOOGLE_PLAY_PACKAGE_NAME", ""), ServiceAccountJson: reader.ReadStringOrDefault("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", ""),
			ApiBaseUrl: reader.ReadStringOrDefault("GOOGLE_PLAY_API_BASE_URL", "https://androidpublisher.googleapis.com"), ProductPrices: reader.ReadStringOrDefault("GOOGLE_PLAY_PRODUCT_PRICES", ""),
			SubscriptionProductIds: reader.ReadCommaSeparatedListOrDefault("GOOGLE_PLAY_SUBSCRIPTION_PRODUCTS", nil), PushToken: reader.ReadStringOrDefault("GOOGLE_PLAY_RTDN_PUSH_TOKEN", ""),
		},
		SavedCardFingerprintKey: reader.ReadStringOrDefault("SAVED_CARD_FINGERPRINT_KEY", ""),
	}
	settings.AppleInAppPurchaseEnabled = settings.AppleStore.BundleId != "" && settings.AppleStore.RootCertificatesPem != ""
	settings.GooglePlayBillingEnabled = settings.GooglePlay.PackageName != "" && settings.GooglePlay.ServiceAccountJson != ""
	if settings.Money.IsProduction() && settings.SavedCardFingerprintKey == "" {
		reader.ReadRequiredString("SAVED_CARD_FINGERPRINT_KEY")
	}
	for _, problem := range ProviderKeyEnvironmentMismatches(settings) {
		reader.ReadRequiredString(problem)
	}
	return settings
}

func ProviderKeyEnvironmentMismatches(settings PaymentsSettings) []string {
	production := settings.Money.IsProduction()
	var problems []string
	if settings.BachsSecretKey != "" {
		keyIsLive := strings.HasPrefix(settings.BachsSecretKey, "sk_live_")
		keyIsSandbox := strings.HasPrefix(settings.BachsSecretKey, "sk_sandbox_")
		if (production && !keyIsLive) || (!production && !keyIsSandbox) {
			problems = append(problems, "BACHS_SECRET_KEY_MUST_MATCH_APP_ENV")
		}
	}
	expectedBaseUrl := BachsSandboxBaseUrl
	if production {
		expectedBaseUrl = BachsProductionBaseUrl
	}
	if settings.BachsSecretKey != "" && strings.TrimRight(settings.BachsBaseUrl, "/") != expectedBaseUrl {
		problems = append(problems, "BACHS_API_BASE_URL_MUST_MATCH_APP_ENV")
	}
	if settings.BachsSecretKey != "" && len(settings.BachsWebhookSigningSecrets) == 0 {
		problems = append(problems, "BACHS_WEBHOOK_SIGNING_SECRETS")
	}
	if settings.PlatformCommissionBps < 0 || settings.PlatformCommissionBps >= 10_000 {
		problems = append(problems, "ESCROW_PLATFORM_COMMISSION_BPS_BETWEEN_0_AND_9999")
	}
	return problems
}

func parseCurrencyAmountOverrides(raw string) map[string]int64 {
	overrides := map[string]int64{}
	for _, entry := range strings.Split(raw, ",") {
		currency, value, found := strings.Cut(strings.TrimSpace(entry), ":")
		amount, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		if !found || err != nil || amount < 0 || len(strings.TrimSpace(currency)) != 3 {
			continue
		}
		overrides[strings.ToUpper(strings.TrimSpace(currency))] = amount
	}
	return overrides
}

func parsePlanProducts(raw string) map[string]string {
	products := map[string]string{}
	for _, entry := range strings.Split(raw, ",") {
		plan, product, found := strings.Cut(strings.TrimSpace(entry), ":")
		if found && plan != "" && product != "" {
			products[plan] = product
		}
	}
	return products
}
