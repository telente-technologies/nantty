package configs

import (
	"encoding/base64"
	"os"
	"strings"

	"nantty/modules/ledger/src/loaders"
	platformconfig "nantty/platform/config"
)

type PaymentsSettings struct {
	Money                       loaders.MoneyModuleSettings
	Flutterwave                 FlutterwaveSettings
	Wallets                     WalletSettings
	PublicWebhookBaseUrl        string
	AdminInternalUrl            string
	AdminInternalToken          string
	DefaultProvider             string
	CheckoutChannels            []string
	SubaccountBearsFee          bool
	CardVerificationAmount      int64
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
	SellerDebtLimits            loaders.SellerDebtLimits
	PaymentMinimums             map[string]int64
	PaymentLimits               loaders.PaymentLimits
	EscrowSchema                string
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
		Money:                     loaders.ReadMoneyModuleSettingsFromEnvironment(reader, "payments"),
		Flutterwave:               ReadFlutterwaveSettings(reader),
		Wallets:                   ReadWalletSettings(reader),
		PublicWebhookBaseUrl:      reader.ReadStringOrDefault("PAYMENTS_PUBLIC_WEBHOOK_BASE_URL", ""),
		AdminInternalUrl:          reader.ReadStringOrDefault("ADMIN_INTERNAL_URL", ""),
		AdminInternalToken:        reader.ReadStringOrDefault("ADMIN_INTERNAL_API_TOKEN", ""),
		DefaultProvider:           reader.ReadStringOrDefault("PAYMENTS_PROVIDER", "flutterwave"),
		CheckoutChannels:          reader.ReadCommaSeparatedListOrDefault("CHECKOUT_CHANNELS", []string{"card", "bank", "ussd", "bank_transfer"}),
		SubaccountBearsFee:        reader.ReadStringOrDefault("PAYMENT_SPLIT_BEARER", "subaccount") == "subaccount",
		CardVerificationAmount:    int64(reader.ReadIntegerOrDefault("CARD_VERIFICATION_AMOUNT_MINOR", 5000)),
		AllowedReturnUrls:         reader.ReadCommaSeparatedListOrDefault("PAYMENT_RETURN_URLS", []string{"https://nantty.com/pay/return", "https://app.nantty.com/pay/return"}),
		AdsReturnOrigins:          reader.ReadCommaSeparatedListOrDefault("PAYMENT_ADS_RETURN_ORIGINS", []string{"https://ads.nantty.com"}),
		OnboardingReturnUrl:       reader.ReadStringOrDefault("CONNECT_ONBOARDING_RETURN_URL", "https://nantty.com/seller/verification/return"),
		OnboardingRefreshUrl:      reader.ReadStringOrDefault("CONNECT_ONBOARDING_REFRESH_URL", "https://nantty.com/seller/verification/refresh"),
		ConnectedAccountCountry:   reader.ReadStringOrDefault("CONNECT_ACCOUNT_COUNTRY", "NG"),
		EscrowFeeBps:              int64(reader.ReadIntegerOrDefault("ESCROW_FEE_BPS", 150)),
		BusinessEscrowFeeBps:      int64(reader.ReadIntegerOrDefault("ESCROW_FEE_BUSINESS_PLAN_BPS", 100)),
		EscrowMode:                reader.ReadStringOrDefault("ESCROW_MODE", "e2"),
		CheckoutExpiryMinutes:     reader.ReadIntegerOrDefault("CHECKOUT_SESSION_EXPIRY_MINUTES", 15),
		AccountDirectorySchema:    reader.ReadStringOrDefault("PAYMENTS_ACCOUNT_DIRECTORY_SCHEMA", "auth"),
		OrderStatusSchema:         reader.ReadStringOrDefault("PAYMENTS_ORDER_STATUS_SCHEMA", "orders"),
		UsersSchema:               reader.ReadStringOrDefault("PAYMENTS_USERS_SCHEMA", "users"),
		UnverifiedSellerSalesCaps: loaders.ParseCurrencyAmountMap(reader.ReadStringOrDefault("UNVERIFIED_SELLER_SALES_CAPS", "NGN:20000000")),
		SellerDebtLimits: loaders.ParseSellerDebtLimitsFromEnvironment(reader.ReadStringOrDefault("SELLER_DEBT_LIMITS_NGN", "unverified:1000000,payoutVerified:5000000,identityVerified:20000000"),
			int64(reader.ReadIntegerOrDefault("SELLER_DEBT_LIMIT_OUTSIDE_NIGERIA_PERCENT", 50)), reader.ReadIntegerOrDefault("SELLER_TRUSTED_AGE_DAYS", 90), reader.ReadIntegerOrDefault("SELLER_TRUSTED_CLEAN_DAYS", 90)),
		PaymentMinimums: loaders.ParseCurrencyAmountMap(reader.ReadStringOrDefault("PAYMENT_MINIMUM_AMOUNTS", "NGN:100,GHS:100,KES:100,USD:100")),
		PaymentLimits: loaders.ParsePaymentLimitsFromEnvironment(reader.ReadStringOrDefault("PAYMENT_MAXIMUMS_NGN", "orderCheckout:500000000,coinPurchase:50000000,adsTopUp:1000000000"),
			reader.ReadStringOrDefault("WALLET_DAILY_LIMITS_NGN", "basic:5000000,mid:20000000,full:500000000")),
		EscrowSchema:                reader.ReadStringOrDefault("PAYMENTS_ESCROW_SCHEMA", "escrow"),
		CustomerValidationMode:      reader.ReadStringOrDefault("PAYOUT_BANK_VALIDATION", "required"),
		WebSubscriptionPlanProducts: parsePlanProducts(reader.ReadStringOrDefault("PAYMENT_PLAN_CODES", "")),
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
			SubscriptionPrefixes: reader.ReadCommaSeparatedListOrDefault("GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_PREFIXES", []string{"nantty.creatorsub."}),
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
	var problems []string
	if settings.EscrowFeeBps < 0 || settings.EscrowFeeBps >= 10_000 || settings.BusinessEscrowFeeBps < 0 || settings.BusinessEscrowFeeBps > settings.EscrowFeeBps {
		problems = append(problems, "ESCROW_FEE_BPS_BETWEEN_0_AND_9999_AND_BUSINESS_NOT_ABOVE_DEFAULT")
	}
	if settings.DefaultProvider != "" && settings.DefaultProvider != "flutterwave" {
		problems = append(problems, "PAYMENTS_PROVIDER_MUST_BE_FLUTTERWAVE")
	}
	problems = append(problems, flutterwaveKeyProblems(settings)...)
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
