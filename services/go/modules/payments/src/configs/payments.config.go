package configs

import (
	"encoding/base64"
	"os"
	"strings"

	"zudomart/modules/ledger/src/loaders"
	platformconfig "zudomart/platform/config"
)

const PaystackBaseUrl = "https://api.paystack.co"

type PaymentsSettings struct {
	Money                       loaders.MoneyModuleSettings
	Paystack                    PaystackSettings
	DefaultProvider             string
	AllowedReturnUrls           []string
	AdsReturnOrigins            []string
	OnboardingReturnUrl         string
	OnboardingRefreshUrl        string
	ConnectedAccountCountry     string
	EscrowFeeBps                int64
	BusinessEscrowFeeBps        int64
	EscrowMode                  string
	CheckoutExpiryMinutes       int
	AccountDirectorySchema      string
	OrderStatusSchema           string
	UsersSchema                 string
	UnverifiedSellerSalesCaps   map[string]int64
	CustomerValidationMode      string
	WebSubscriptionPlanProducts map[string]string
	AppleInAppPurchaseFeeBps    int64
	GooglePlayBillingFeeBps     int64
	AppleInAppPurchaseEnabled   bool
	GooglePlayBillingEnabled    bool
	AppleStore                  AppleStoreSettings
	GooglePlay                  GooglePlaySettings
	SavedCardFingerprintKey     string
	ConnectContactEmailDomain   string
	InternalApiToken            string
	DataEncryptionKey           []byte
	VerificationReviewEstimate  string
	ProcessWebhooksInBackground bool
	PayoutArrivalEstimate       string
}

type PaystackSettings struct {
	BaseUrl                string
	SecretKey              string
	PublicKey              string
	PreviousSecretKey      string
	WebhookIpAllowlist     []string
	SessionTimeoutSeconds  int
	TransferFeeBands       string
	Channels               []string
	SubaccountBearsFee     bool
	MaximumAttempts        int
	CardVerificationAmount int64
	SupportedCurrencies    []string
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
	SubscriptionPrefixes   []string
	PushToken              string
	PushAudience           string
	PushServiceAccount     string
}

func ReadPaymentsSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) PaymentsSettings {
	settings := PaymentsSettings{
		Money: loaders.ReadMoneyModuleSettingsFromEnvironment(reader, "payments"),
		Paystack: PaystackSettings{
			BaseUrl: reader.ReadStringOrDefault("PAYSTACK_API_BASE_URL", PaystackBaseUrl), SecretKey: reader.ReadStringOrDefault("PAYSTACK_SECRET_KEY", ""),
			PublicKey: reader.ReadStringOrDefault("PAYSTACK_PUBLIC_KEY", ""), PreviousSecretKey: reader.ReadStringOrDefault("PAYSTACK_PREVIOUS_SECRET_KEY", ""),
			WebhookIpAllowlist:     reader.ReadCommaSeparatedListOrDefault("PAYSTACK_WEBHOOK_IP_ALLOWLIST", nil),
			SessionTimeoutSeconds:  reader.ReadIntegerOrDefault("PAYSTACK_PAYMENT_SESSION_TIMEOUT_SECONDS", 1800),
			TransferFeeBands:       reader.ReadStringOrDefault("PAYSTACK_TRANSFER_FEE_BANDS", "500000:1000;5000000:2500;*:5000"),
			Channels:               reader.ReadCommaSeparatedListOrDefault("PAYSTACK_CHECKOUT_CHANNELS", []string{"card", "bank", "ussd", "bank_transfer"}),
			SubaccountBearsFee:     reader.ReadStringOrDefault("PAYSTACK_SPLIT_BEARER", "subaccount") == "subaccount",
			MaximumAttempts:        reader.ReadIntegerOrDefault("PAYSTACK_MAXIMUM_ATTEMPTS", 3),
			CardVerificationAmount: int64(reader.ReadIntegerOrDefault("PAYSTACK_CARD_VERIFICATION_AMOUNT_MINOR", 5000)),
			SupportedCurrencies:    reader.ReadCommaSeparatedListOrDefault("PAYSTACK_SUPPORTED_CURRENCIES", []string{"NGN", "USD"}),
		},
		DefaultProvider:             reader.ReadStringOrDefault("PAYMENTS_DEFAULT_PROVIDER", "paystack"),
		AllowedReturnUrls:           reader.ReadCommaSeparatedListOrDefault("PAYMENT_RETURN_URLS", []string{"https://zudomart.com/pay/return", "https://app.zudomart.com/pay/return"}),
		AdsReturnOrigins:            reader.ReadCommaSeparatedListOrDefault("PAYMENT_ADS_RETURN_ORIGINS", []string{"https://ads.zudomart.com"}),
		OnboardingReturnUrl:         reader.ReadStringOrDefault("CONNECT_ONBOARDING_RETURN_URL", "https://zudomart.com/seller/verification/return"),
		OnboardingRefreshUrl:        reader.ReadStringOrDefault("CONNECT_ONBOARDING_REFRESH_URL", "https://zudomart.com/seller/verification/refresh"),
		ConnectedAccountCountry:     reader.ReadStringOrDefault("CONNECT_ACCOUNT_COUNTRY", "NG"),
		EscrowFeeBps:                int64(reader.ReadIntegerOrDefault("ESCROW_FEE_BPS", 150)),
		BusinessEscrowFeeBps:        int64(reader.ReadIntegerOrDefault("ESCROW_FEE_BUSINESS_PLAN_BPS", 100)),
		EscrowMode:                  reader.ReadStringOrDefault("ESCROW_MODE", "e2"),
		CheckoutExpiryMinutes:       reader.ReadIntegerOrDefault("CHECKOUT_SESSION_EXPIRY_MINUTES", 15),
		AccountDirectorySchema:      reader.ReadStringOrDefault("PAYMENTS_ACCOUNT_DIRECTORY_SCHEMA", "auth"),
		OrderStatusSchema:           reader.ReadStringOrDefault("PAYMENTS_ORDER_STATUS_SCHEMA", "orders"),
		UsersSchema:                 reader.ReadStringOrDefault("PAYMENTS_USERS_SCHEMA", "users"),
		UnverifiedSellerSalesCaps:   loaders.ParseCurrencyAmountMap(reader.ReadStringOrDefault("UNVERIFIED_SELLER_SALES_CAPS", "NGN:20000000")),
		CustomerValidationMode:      reader.ReadStringOrDefault("PAYOUT_BANK_VALIDATION", "required"),
		WebSubscriptionPlanProducts: parsePlanProducts(reader.ReadStringOrDefault("PAYSTACK_PLAN_CODES", "")),
		AppleInAppPurchaseFeeBps:    int64(reader.ReadIntegerOrDefault("APPLE_IAP_STORE_FEE_BPS", 3000)),
		GooglePlayBillingFeeBps:     int64(reader.ReadIntegerOrDefault("GOOGLE_PLAY_STORE_FEE_BPS", 1500)),
		AppleStore: AppleStoreSettings{
			BundleId: reader.ReadStringOrDefault("APPLE_IAP_BUNDLE_ID", ""), Environment: reader.ReadStringOrDefault("APPLE_IAP_ENVIRONMENT", "Sandbox"),
			RootCertificatesPem: readValueOrFile(reader, "APPLE_IAP_ROOT_CERTIFICATES_PEM", "APPLE_IAP_ROOT_CERTIFICATES_PATH"), IssuerId: reader.ReadStringOrDefault("APPLE_IAP_ISSUER_ID", ""),
			KeyId: reader.ReadStringOrDefault("APPLE_IAP_KEY_ID", ""), PrivateKeyPem: readValueOrFile(reader, "APPLE_IAP_PRIVATE_KEY_PEM", "APPLE_IAP_PRIVATE_KEY_PATH"),
			ApiBaseUrl: reader.ReadStringOrDefault("APPLE_IAP_API_BASE_URL", "https://api.storekit-sandbox.itunes.apple.com"),
		},
		GooglePlay: GooglePlaySettings{
			PackageName: reader.ReadStringOrDefault("GOOGLE_PLAY_PACKAGE_NAME", ""), ServiceAccountJson: readValueOrFile(reader, "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH"),
			ApiBaseUrl: reader.ReadStringOrDefault("GOOGLE_PLAY_API_BASE_URL", "https://androidpublisher.googleapis.com"), ProductPrices: reader.ReadStringOrDefault("GOOGLE_PLAY_PRODUCT_PRICES", ""),
			SubscriptionProductIds: reader.ReadCommaSeparatedListOrDefault("GOOGLE_PLAY_SUBSCRIPTION_PRODUCTS", nil), PushToken: reader.ReadStringOrDefault("GOOGLE_PLAY_RTDN_PUSH_TOKEN", ""),
			SubscriptionPrefixes: reader.ReadCommaSeparatedListOrDefault("GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_PREFIXES", []string{"zudomart.creatorsub."}),
			PushAudience:         reader.ReadStringOrDefault("GOOGLE_PLAY_RTDN_PUSH_AUDIENCE", ""), PushServiceAccount: reader.ReadStringOrDefault("GOOGLE_PLAY_RTDN_PUSH_SERVICE_ACCOUNT", ""),
		},
		SavedCardFingerprintKey:     reader.ReadStringOrDefault("SAVED_CARD_FINGERPRINT_KEY", ""),
		ConnectContactEmailDomain:   reader.ReadStringOrDefault("CONNECT_CONTACT_EMAIL_DOMAIN", ""),
		InternalApiToken:            reader.ReadStringOrDefault("MONEY_INTERNAL_API_TOKEN", ""),
		ProcessWebhooksInBackground: reader.ReadStringOrDefault("PAYMENTS_PROCESS_WEBHOOKS_IN_BACKGROUND", "true") == "true",
		VerificationReviewEstimate:  reader.ReadStringOrDefault("PAYOUT_VERIFICATION_REVIEW_ESTIMATE", "Usually within 2 business days"),
		PayoutArrivalEstimate:       reader.ReadStringOrDefault("PAYOUT_ARRIVAL_ESTIMATE", "Usually the same day"),
	}
	settings.AppleInAppPurchaseEnabled = settings.AppleStore.BundleId != "" && settings.AppleStore.RootCertificatesPem != ""
	settings.GooglePlayBillingEnabled = settings.GooglePlay.PackageName != "" && settings.GooglePlay.ServiceAccountJson != ""
	settings.DataEncryptionKey = readOptionalEncryptionKey(reader, settings.Money.IsProduction())
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
	key := settings.Paystack.SecretKey
	if key != "" && ((production && !strings.HasPrefix(key, "sk_live_")) || (!production && !strings.HasPrefix(key, "sk_test_"))) {
		problems = append(problems, "PAYSTACK_SECRET_KEY_MUST_MATCH_APP_ENV")
	}
	if production && key == "" {
		problems = append(problems, "PAYSTACK_SECRET_KEY")
	}
	if settings.EscrowFeeBps < 0 || settings.EscrowFeeBps >= 10_000 || settings.BusinessEscrowFeeBps < 0 || settings.BusinessEscrowFeeBps > settings.EscrowFeeBps {
		problems = append(problems, "ESCROW_FEE_BPS_BETWEEN_0_AND_9999_AND_BUSINESS_NOT_ABOVE_DEFAULT")
	}
	if settings.EscrowMode != "e2" && settings.EscrowMode != "e1" {
		problems = append(problems, "ESCROW_MODE_E1_OR_E2")
	}
	return problems
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

func readOptionalEncryptionKey(reader *platformconfig.EnvironmentReader, required bool) []byte {
	encoded := reader.ReadStringOrDefault("DATA_ENCRYPTION_KEY", "")
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if (encoded != "" && (err != nil || len(decoded) != 32)) || (required && encoded == "") {
		reader.ReadRequiredString("DATA_ENCRYPTION_KEY_AS_BASE64_OF_32_BYTES")
		return nil
	}
	return decoded
}

func readValueOrFile(reader *platformconfig.EnvironmentReader, valueKey, pathKey string) string {
	if value := reader.ReadStringOrDefault(valueKey, ""); value != "" {
		return value
	}
	path := reader.ReadStringOrDefault(pathKey, "")
	if path == "" {
		return ""
	}
	contents, err := os.ReadFile(path)
	if err != nil {
		reader.ReportProblem(pathKey + " must point to a readable file")
		return ""
	}
	return string(contents)
}
