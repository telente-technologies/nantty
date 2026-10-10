package integrations

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

const GooglePlayPushTokenHeader = "X-Zudomart-Push-Token"

type GooglePlayProductPrice struct {
	AmountMinor int64
	Currency    string
}

type GooglePlaySettings struct {
	PackageName             string
	ServiceAccountJson      []byte
	ApiBaseUrl              string
	ProductPrices           map[string]GooglePlayProductPrice
	SubscriptionProductIds  []string
	SubscriptionPrefixes    []string
	PushToken               string
	PushAudience            string
	PushServiceAccountEmail string
	PushCertificatesUrl     string
	StoreFeeBasisPoints     int64
	HttpClient              *http.Client
}

type GooglePlayVerifier struct {
	settings GooglePlaySettings
	tokens   *googleAccessTokenSource
	oidc     googleOidcKeys
	Now      func() time.Time
}

func NewGooglePlayVerifier(settings GooglePlaySettings) (*GooglePlayVerifier, error) {
	if settings.HttpClient == nil {
		settings.HttpClient = &http.Client{Timeout: 15 * time.Second}
	}
	if settings.ApiBaseUrl == "" {
		settings.ApiBaseUrl = "https://androidpublisher.googleapis.com"
	}
	verifier := &GooglePlayVerifier{settings: settings, Now: time.Now}
	tokens, err := newGoogleAccessTokenSource(settings.ServiceAccountJson, settings.HttpClient, func() time.Time { return verifier.Now() })
	if err != nil {
		return nil, err
	}
	verifier.tokens = tokens
	return verifier, nil
}

func (verifier *GooglePlayVerifier) Store() string { return "google_play" }
func (verifier *GooglePlayVerifier) StoreFeeBasisPoints() int64 {
	return verifier.settings.StoreFeeBasisPoints
}

func (verifier *GooglePlayVerifier) VerifyPurchaseReceipt(ctx context.Context, receipt interfaces.StoreReceipt) (interfaces.VerifiedStorePurchase, error) {
	if receipt.ReceiptData == "" {
		return interfaces.VerifiedStorePurchase{}, interfaces.ErrStoreReceiptInvalid
	}
	if verifier.isSubscriptionProduct(receipt.ProductId) {
		return verifier.verifySubscription(ctx, receipt.ReceiptData, receipt.ProductId)
	}
	price, priced := verifier.settings.ProductPrices[receipt.ProductId]
	if !priced {
		return interfaces.VerifiedStorePurchase{}, interfaces.ErrStoreReceiptInvalid
	}
	var purchase struct {
		PurchaseState      int    `json:"purchaseState"`
		OrderId            string `json:"orderId"`
		PurchaseTimeMillis string `json:"purchaseTimeMillis"`
		PurchaseType       *int   `json:"purchaseType"`
	}
	path := "/purchases/products/" + url.PathEscape(receipt.ProductId) + "/tokens/" + url.PathEscape(receipt.ReceiptData)
	if err := verifier.getPublisherResource(ctx, path, &purchase); err != nil {
		return interfaces.VerifiedStorePurchase{}, err
	}
	if purchase.PurchaseState != 0 || purchase.OrderId == "" {
		return interfaces.VerifiedStorePurchase{}, interfaces.ErrStoreReceiptInvalid
	}
	purchasedMillis, _ := strconv.ParseInt(purchase.PurchaseTimeMillis, 10, 64)
	return interfaces.VerifiedStorePurchase{
		StoreTransactionId: purchase.OrderId, OriginalTransactionId: receipt.ReceiptData, ProductId: receipt.ProductId,
		PriceMinor: price.AmountMinor, Currency: price.Currency, Environment: googleEnvironment(purchase.PurchaseType != nil && *purchase.PurchaseType == 0),
		PurchasedAt: time.UnixMilli(purchasedMillis).UTC(),
	}, nil
}

func (verifier *GooglePlayVerifier) getPublisherResource(ctx context.Context, path string, destination any) error {
	token, err := verifier.tokens.AccessToken(ctx)
	if err != nil {
		return err
	}
	target := strings.TrimRight(verifier.settings.ApiBaseUrl, "/") + "/androidpublisher/v3/applications/" + url.PathEscape(verifier.settings.PackageName) + path
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	status, err := sendJsonRequest(verifier.settings.HttpClient, request, destination)
	if status == http.StatusNotFound || status == http.StatusBadRequest || status == http.StatusGone {
		return interfaces.ErrStoreReceiptInvalid
	}
	return err
}

func (verifier *GooglePlayVerifier) VerifySignedRefundNotification(ctx context.Context, rawBody []byte, headers http.Header) (interfaces.StoreRefundNotification, error) {
	if !verifier.pushAuthorized(ctx, headers.Get(GooglePlayPushTokenHeader)) {
		return interfaces.StoreRefundNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	var push struct {
		Message struct {
			Data      string `json:"data"`
			MessageId string `json:"messageId"`
		} `json:"message"`
	}
	if json.Unmarshal(rawBody, &push) != nil || push.Message.MessageId == "" {
		return interfaces.StoreRefundNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	decoded, err := base64.StdEncoding.DecodeString(push.Message.Data)
	if err != nil {
		return interfaces.StoreRefundNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	var developer struct {
		PackageName              string `json:"packageName"`
		EventTimeMillis          string `json:"eventTimeMillis"`
		SubscriptionNotification *struct {
			NotificationType int    `json:"notificationType"`
			PurchaseToken    string `json:"purchaseToken"`
			SubscriptionId   string `json:"subscriptionId"`
		} `json:"subscriptionNotification"`
		VoidedPurchaseNotification *struct {
			PurchaseToken string `json:"purchaseToken"`
			OrderId       string `json:"orderId"`
		} `json:"voidedPurchaseNotification"`
	}
	if json.Unmarshal(decoded, &developer) != nil || developer.PackageName != verifier.settings.PackageName {
		return interfaces.StoreRefundNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	eventMillis, _ := strconv.ParseInt(developer.EventTimeMillis, 10, 64)
	notification := interfaces.StoreRefundNotification{NotificationId: push.Message.MessageId, Kind: interfaces.StoreNotificationOther}
	switch {
	case developer.VoidedPurchaseNotification != nil:
		voided := developer.VoidedPurchaseNotification
		notification.Kind, notification.StoreTransactionId, notification.OriginalTransactionId = interfaces.StoreNotificationRefund, voided.OrderId, voided.PurchaseToken
		notification.RefundedAt = time.UnixMilli(eventMillis).UTC()
	case developer.SubscriptionNotification != nil:
		return verifier.convertSubscriptionNotification(ctx, notification, developer.SubscriptionNotification.NotificationType, developer.SubscriptionNotification.PurchaseToken, developer.SubscriptionNotification.SubscriptionId)
	}
	return notification, nil
}

func googleEnvironment(test bool) string {
	if test {
		return "sandbox"
	}
	return "production"
}
