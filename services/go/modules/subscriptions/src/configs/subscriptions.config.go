package configs

import (
	"strings"

	"zudomart/modules/ledger/src/loaders"
	platformconfig "zudomart/platform/config"
)

type StoreProductPlan struct {
	PlanCode string
	Interval string
}

type SubscriptionsSettings struct {
	Money                  loaders.MoneyModuleSettings
	InternalApiToken       string
	DefaultCountry         string
	AccountDirectorySchema string
	UsersSchema            string
	CatalogSchema          string
	FingerprintKey         string
	StoreProductPlans      map[string]StoreProductPlan
	TrustedCountryHeader   string
	AdminInternalUrl       string
	AdminInternalToken     string
	BillingJobsQueue       string
}

func ReadSubscriptionsSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) SubscriptionsSettings {
	settings := SubscriptionsSettings{
		Money:                  loaders.ReadMoneyModuleSettingsFromEnvironment(reader, "subscriptions"),
		InternalApiToken:       reader.ReadStringOrDefault("MONEY_INTERNAL_API_TOKEN", ""),
		DefaultCountry:         reader.ReadStringOrDefault("SUBSCRIPTIONS_DEFAULT_COUNTRY", "NG"),
		AccountDirectorySchema: reader.ReadStringOrDefault("SUBSCRIPTIONS_ACCOUNT_DIRECTORY_SCHEMA", "auth"),
		UsersSchema:            reader.ReadStringOrDefault("SUBSCRIPTIONS_USERS_SCHEMA", "users"),
		CatalogSchema:          reader.ReadStringOrDefault("SUBSCRIPTIONS_CATALOG_SCHEMA", "catalog"),
		FingerprintKey:         reader.ReadStringOrDefault("SAVED_CARD_FINGERPRINT_KEY", ""),
		StoreProductPlans:      ParseStoreProductPlans(reader.ReadStringOrDefault("SUBSCRIPTIONS_STORE_PRODUCT_PLANS", "")),
		TrustedCountryHeader:   reader.ReadStringOrDefault("PRICING_TRUSTED_COUNTRY_HEADER", "CloudFront-Viewer-Country"),
		AdminInternalUrl:       reader.ReadStringOrDefault("ADMIN_INTERNAL_URL", ""),
		AdminInternalToken:     reader.ReadStringOrDefault("ADMIN_INTERNAL_API_TOKEN", ""),
		BillingJobsQueue:       reader.ReadStringOrDefault("SUBSCRIPTION_BILLING_QUEUE", "jobs-subscription-billing"),
	}
	if settings.Money.IsProduction() && settings.FingerprintKey == "" {
		reader.ReadRequiredString("SAVED_CARD_FINGERPRINT_KEY")
	}
	return settings
}

func ParseStoreProductPlans(raw string) map[string]StoreProductPlan {
	plans := map[string]StoreProductPlan{}
	for _, entry := range strings.Split(raw, ",") {
		parts := strings.Split(strings.TrimSpace(entry), ":")
		if len(parts) == 3 && parts[0] != "" && (parts[2] == "month" || parts[2] == "year") {
			plans[parts[0]] = StoreProductPlan{PlanCode: parts[1], Interval: parts[2]}
		}
	}
	return plans
}
