package integrations

import (
	"context"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"zudomart/modules/payments/src/interfaces"
	"zudomart/platform/money"
)

type googleMoney struct {
	CurrencyCode string `json:"currencyCode"`
	Units        string `json:"units"`
	Nanos        int64  `json:"nanos"`
}

type googleSubscriptionPurchase struct {
	SubscriptionState    string    `json:"subscriptionState"`
	LatestOrderId        string    `json:"latestOrderId"`
	StartTime            time.Time `json:"startTime"`
	AcknowledgementState string    `json:"acknowledgementState"`
	TestPurchase         *struct{} `json:"testPurchase"`
	ExternalAccount      struct {
		ObfuscatedExternalAccountId string `json:"obfuscatedExternalAccountId"`
	} `json:"externalAccountIdentifiers"`
	LineItems []struct {
		ProductId        string    `json:"productId"`
		ExpiryTime       time.Time `json:"expiryTime"`
		AutoRenewingPlan *struct {
			RecurringPrice *googleMoney `json:"recurringPrice"`
		} `json:"autoRenewingPlan"`
	} `json:"lineItems"`
}

var entitledGoogleStates = []string{"SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"}

func (verifier *GooglePlayVerifier) isSubscriptionProduct(productId string) bool {
	if slices.Contains(verifier.settings.SubscriptionProductIds, productId) {
		return true
	}
	for _, prefix := range verifier.settings.SubscriptionPrefixes {
		if prefix != "" && strings.HasPrefix(productId, prefix) {
			return true
		}
	}
	return false
}

func (verifier *GooglePlayVerifier) verifySubscription(ctx context.Context, purchaseToken, productId string) (interfaces.VerifiedStorePurchase, error) {
	var subscription googleSubscriptionPurchase
	if err := verifier.getPublisherResource(ctx, "/purchases/subscriptionsv2/tokens/"+url.PathEscape(purchaseToken), &subscription); err != nil {
		return interfaces.VerifiedStorePurchase{}, err
	}
	if !slices.Contains(entitledGoogleStates, subscription.SubscriptionState) || subscription.LatestOrderId == "" {
		return interfaces.VerifiedStorePurchase{}, interfaces.ErrStoreReceiptInvalid
	}
	verified := interfaces.VerifiedStorePurchase{
		StoreTransactionId: subscription.LatestOrderId, OriginalTransactionId: purchaseToken, ProductId: productId,
		Environment: googleEnvironment(subscription.TestPurchase != nil), PurchasedAt: subscription.StartTime.UTC(), IsSubscription: true,
		AccountToken: strings.ToLower(subscription.ExternalAccount.ObfuscatedExternalAccountId), NeedsAcknowledgement: subscription.AcknowledgementState == "ACKNOWLEDGEMENT_STATE_PENDING",
	}
	if price, priced := verifier.settings.ProductPrices[productId]; priced {
		verified.PriceMinor, verified.Currency = price.AmountMinor, price.Currency
	}
	for _, item := range subscription.LineItems {
		if item.ProductId != productId {
			continue
		}
		expires := item.ExpiryTime.UTC()
		verified.ExpiresAt = &expires
		if verified.Currency == "" && item.AutoRenewingPlan != nil && item.AutoRenewingPlan.RecurringPrice != nil {
			verified.PriceMinor, verified.Currency = convertGoogleMoney(*item.AutoRenewingPlan.RecurringPrice)
		}
	}
	if verified.ExpiresAt == nil || verified.Currency == "" || verified.PriceMinor <= 0 {
		return interfaces.VerifiedStorePurchase{}, interfaces.ErrStoreReceiptInvalid
	}
	return verified, nil
}

func convertGoogleMoney(price googleMoney) (int64, string) {
	currency := strings.ToUpper(price.CurrencyCode)
	units, err := strconv.ParseInt(price.Units, 10, 64)
	if err != nil || len(currency) != 3 {
		return 0, ""
	}
	exponent := money.MinorUnitExponentForCurrency(money.CurrencyCode(currency))
	scale := int64(1)
	for range exponent {
		scale *= 10
	}
	return units*scale + (price.Nanos*scale+500_000_000)/1_000_000_000, currency
}

func (verifier *GooglePlayVerifier) convertSubscriptionNotification(ctx context.Context, notification interfaces.StoreRefundNotification, notificationType int, purchaseToken, productId string) (interfaces.StoreRefundNotification, error) {
	notification.OriginalTransactionId, notification.ProductId = purchaseToken, productId
	switch notificationType {
	case 1, 2, 4, 7:
		notification.Kind = interfaces.StoreNotificationRenewed
		verified, err := verifier.verifySubscription(ctx, purchaseToken, productId)
		if err != nil {
			return interfaces.StoreRefundNotification{}, err
		}
		notification.StoreTransactionId, notification.ExpiresAt, notification.AccountToken = verified.StoreTransactionId, verified.ExpiresAt, verified.AccountToken
		notification.Transaction = &verified
	case 3:
		notification.Kind = interfaces.StoreNotificationCancelled
	case 12, 13:
		notification.Kind = interfaces.StoreNotificationExpired
	case 5:
		notification.Kind = interfaces.StoreNotificationRenewalFailed
	case 6:
		notification.Kind = interfaces.StoreNotificationGrace
	}
	return notification, nil
}
