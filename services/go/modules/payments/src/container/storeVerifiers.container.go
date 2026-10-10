package container

import (
	"strconv"
	"strings"

	"zudomart/modules/payments/src/configs"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
)

func NewStoreVerifiersFromSettings(settings configs.PaymentsSettings) (map[string]interfaces.StoreReceiptVerifier, error) {
	verifiers := map[string]interfaces.StoreReceiptVerifier{
		constants.StoreAppleIap:   integrations.NewAppleInAppPurchaseVerifier(false, settings.AppleInAppPurchaseFeeBps),
		constants.StoreGooglePlay: integrations.NewGooglePlayBillingVerifier(false, settings.GooglePlayBillingFeeBps),
	}
	if settings.AppleInAppPurchaseEnabled {
		apple := settings.AppleStore
		verifier, err := integrations.NewAppleAppStoreVerifier(integrations.AppleAppStoreSettings{
			BundleId: apple.BundleId, Environment: apple.Environment, RootCertificatesPem: []byte(unescapeNewlines(apple.RootCertificatesPem)),
			IssuerId: apple.IssuerId, KeyId: apple.KeyId, PrivateKeyPem: []byte(unescapeNewlines(apple.PrivateKeyPem)), ApiBaseUrl: apple.ApiBaseUrl,
			StoreFeeBasisPoints: settings.AppleInAppPurchaseFeeBps,
		})
		if err != nil {
			return nil, err
		}
		verifiers[constants.StoreAppleIap] = verifier
	}
	if settings.GooglePlayBillingEnabled {
		google := settings.GooglePlay
		verifier, err := integrations.NewGooglePlayVerifier(integrations.GooglePlaySettings{
			PackageName: google.PackageName, ServiceAccountJson: []byte(google.ServiceAccountJson), ApiBaseUrl: google.ApiBaseUrl,
			ProductPrices: ParseGooglePlayProductPrices(google.ProductPrices), SubscriptionProductIds: google.SubscriptionProductIds, SubscriptionPrefixes: google.SubscriptionPrefixes,
			PushToken: google.PushToken, PushAudience: google.PushAudience, PushServiceAccountEmail: google.PushServiceAccount, StoreFeeBasisPoints: settings.GooglePlayBillingFeeBps,
		})
		if err != nil {
			return nil, err
		}
		verifiers[constants.StoreGooglePlay] = verifier
	}
	return verifiers, nil
}

func ParseGooglePlayProductPrices(raw string) map[string]integrations.GooglePlayProductPrice {
	prices := map[string]integrations.GooglePlayProductPrice{}
	for _, entry := range strings.Split(raw, ",") {
		parts := strings.Split(strings.TrimSpace(entry), ":")
		if len(parts) != 3 || len(parts[1]) != 3 {
			continue
		}
		amount, err := strconv.ParseInt(parts[2], 10, 64)
		if err == nil && amount > 0 && parts[0] != "" {
			prices[parts[0]] = integrations.GooglePlayProductPrice{AmountMinor: amount, Currency: strings.ToUpper(parts[1])}
		}
	}
	return prices
}

func unescapeNewlines(value string) string {
	return strings.ReplaceAll(value, `\n`, "\n")
}
