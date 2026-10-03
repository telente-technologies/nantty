package integrations

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"zudomart/modules/payments/src/interfaces"
	"zudomart/platform/money"
)

type AppleAppStoreSettings struct {
	BundleId            string
	Environment         string
	RootCertificatesPem []byte
	IssuerId            string
	KeyId               string
	PrivateKeyPem       []byte
	ApiBaseUrl          string
	StoreFeeBasisPoints int64
	HttpClient          *http.Client
}

type AppleAppStoreVerifier struct {
	settings   AppleAppStoreSettings
	signedData *AppleSignedDataVerifier
	signingKey *ecdsa.PrivateKey
	Now        func() time.Time
}

type appleTransactionPayload struct {
	TransactionId         string `json:"transactionId"`
	OriginalTransactionId string `json:"originalTransactionId"`
	BundleId              string `json:"bundleId"`
	ProductId             string `json:"productId"`
	PurchaseDate          int64  `json:"purchaseDate"`
	ExpiresDate           int64  `json:"expiresDate"`
	RevocationDate        int64  `json:"revocationDate"`
	Price                 int64  `json:"price"`
	Currency              string `json:"currency"`
	Environment           string `json:"environment"`
	Type                  string `json:"type"`
}

func NewAppleAppStoreVerifier(settings AppleAppStoreSettings) (*AppleAppStoreVerifier, error) {
	signedData, err := NewAppleSignedDataVerifier(settings.RootCertificatesPem)
	if err != nil {
		return nil, err
	}
	verifier := &AppleAppStoreVerifier{settings: settings, signedData: signedData, Now: time.Now}
	signedData.Now = func() time.Time { return verifier.Now() }
	if len(settings.PrivateKeyPem) > 0 {
		if verifier.signingKey, err = parseEcdsaPrivateKey(settings.PrivateKeyPem); err != nil {
			return nil, err
		}
	}
	if verifier.settings.HttpClient == nil {
		verifier.settings.HttpClient = &http.Client{Timeout: 15 * time.Second}
	}
	return verifier, nil
}

func (verifier *AppleAppStoreVerifier) Store() string { return "apple_iap" }
func (verifier *AppleAppStoreVerifier) StoreFeeBasisPoints() int64 {
	return verifier.settings.StoreFeeBasisPoints
}

func (verifier *AppleAppStoreVerifier) VerifyPurchaseReceipt(ctx context.Context, receipt interfaces.StoreReceipt) (interfaces.VerifiedStorePurchase, error) {
	signed := receipt.ReceiptData
	if verifier.signingKey != nil && receipt.TransactionId != "" {
		fetched, err := verifier.fetchSignedTransaction(ctx, receipt.TransactionId)
		if err != nil {
			return interfaces.VerifiedStorePurchase{}, err
		}
		signed = fetched
	}
	transaction, err := verifier.decodeTransaction(signed)
	if err != nil {
		return interfaces.VerifiedStorePurchase{}, err
	}
	if transaction.RevocationDate != 0 || (receipt.TransactionId != "" && transaction.TransactionId != receipt.TransactionId) {
		return interfaces.VerifiedStorePurchase{}, interfaces.ErrStoreReceiptInvalid
	}
	currency := strings.ToUpper(transaction.Currency)
	verified := interfaces.VerifiedStorePurchase{
		StoreTransactionId: transaction.TransactionId, OriginalTransactionId: transaction.OriginalTransactionId, ProductId: transaction.ProductId,
		PriceMinor: convertMilliunitsToMinorUnits(transaction.Price, currency), Currency: currency, Environment: strings.ToLower(transaction.Environment),
		PurchasedAt: time.UnixMilli(transaction.PurchaseDate).UTC(), IsSubscription: transaction.Type == "Auto-Renewable Subscription",
	}
	if transaction.ExpiresDate > 0 {
		expires := time.UnixMilli(transaction.ExpiresDate).UTC()
		verified.ExpiresAt = &expires
	}
	return verified, nil
}

func (verifier *AppleAppStoreVerifier) decodeTransaction(signed string) (appleTransactionPayload, error) {
	var transaction appleTransactionPayload
	if err := verifier.signedData.VerifyAndDecode(signed, &transaction); err != nil {
		return transaction, err
	}
	if transaction.BundleId != verifier.settings.BundleId || transaction.TransactionId == "" {
		return transaction, interfaces.ErrStoreReceiptInvalid
	}
	if verifier.settings.Environment != "" && !strings.EqualFold(transaction.Environment, verifier.settings.Environment) {
		return transaction, interfaces.ErrStoreReceiptInvalid
	}
	return transaction, nil
}

func (verifier *AppleAppStoreVerifier) VerifySignedRefundNotification(_ context.Context, rawBody []byte, _ http.Header) (interfaces.StoreRefundNotification, error) {
	var envelope struct {
		SignedPayload string `json:"signedPayload"`
	}
	if json.Unmarshal(rawBody, &envelope) != nil || envelope.SignedPayload == "" {
		return interfaces.StoreRefundNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	var payload struct {
		NotificationType string `json:"notificationType"`
		NotificationUuid string `json:"notificationUUID"`
		SignedDate       int64  `json:"signedDate"`
		Data             struct {
			BundleId              string `json:"bundleId"`
			SignedTransactionInfo string `json:"signedTransactionInfo"`
		} `json:"data"`
	}
	if err := verifier.signedData.VerifyAndDecode(envelope.SignedPayload, &payload); err != nil || payload.Data.BundleId != verifier.settings.BundleId || payload.NotificationUuid == "" {
		return interfaces.StoreRefundNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	transaction, err := verifier.decodeTransaction(payload.Data.SignedTransactionInfo)
	if err != nil {
		return interfaces.StoreRefundNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	notification := interfaces.StoreRefundNotification{
		NotificationId: payload.NotificationUuid, StoreTransactionId: transaction.TransactionId, OriginalTransactionId: transaction.OriginalTransactionId,
		ProductId: transaction.ProductId, Kind: classifyAppleNotification(payload.NotificationType),
	}
	if transaction.RevocationDate > 0 {
		notification.RefundedAt = time.UnixMilli(transaction.RevocationDate).UTC()
	}
	if transaction.ExpiresDate > 0 {
		expires := time.UnixMilli(transaction.ExpiresDate).UTC()
		notification.ExpiresAt = &expires
	}
	return notification, nil
}

func classifyAppleNotification(notificationType string) interfaces.StoreNotificationKind {
	switch notificationType {
	case "REFUND", "REVOKE":
		return interfaces.StoreNotificationRefund
	case "DID_RENEW", "SUBSCRIBED", "OFFER_REDEEMED":
		return interfaces.StoreNotificationRenewed
	case "EXPIRED", "GRACE_PERIOD_EXPIRED":
		return interfaces.StoreNotificationExpired
	case "DID_FAIL_TO_RENEW":
		return interfaces.StoreNotificationRenewalFailed
	}
	return interfaces.StoreNotificationOther
}

func (verifier *AppleAppStoreVerifier) fetchSignedTransaction(ctx context.Context, transactionId string) (string, error) {
	token, err := verifier.signApiToken()
	if err != nil {
		return "", err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(verifier.settings.ApiBaseUrl, "/")+"/inApps/v1/transactions/"+url.PathEscape(transactionId), nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	var body struct {
		SignedTransactionInfo string `json:"signedTransactionInfo"`
	}
	status, err := sendJsonRequest(verifier.settings.HttpClient, request, &body)
	if status == http.StatusNotFound {
		return "", interfaces.ErrStoreReceiptInvalid
	}
	if err != nil {
		return "", err
	}
	return body.SignedTransactionInfo, nil
}

func (verifier *AppleAppStoreVerifier) signApiToken() (string, error) {
	now := verifier.Now()
	header := map[string]string{"alg": "ES256", "kid": verifier.settings.KeyId, "typ": "JWT"}
	claims := map[string]any{"iss": verifier.settings.IssuerId, "iat": now.Unix(), "exp": now.Add(10 * time.Minute).Unix(), "aud": "appstoreconnect-v1", "bid": verifier.settings.BundleId}
	signingInput := encodeJwsSegment(header) + "." + encodeJwsSegment(claims)
	digest := sha256.Sum256([]byte(signingInput))
	r, s, err := ecdsa.Sign(rand.Reader, verifier.signingKey, digest[:])
	if err != nil {
		return "", err
	}
	signature := make([]byte, 64)
	r.FillBytes(signature[:32])
	s.FillBytes(signature[32:])
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func encodeJwsSegment(value any) string {
	encoded, _ := json.Marshal(value)
	return base64.RawURLEncoding.EncodeToString(encoded)
}

func parseEcdsaPrivateKey(pemBytes []byte) (*ecdsa.PrivateKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("apple: the App Store private key is not PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	key, isEcdsa := parsed.(*ecdsa.PrivateKey)
	if !isEcdsa {
		return nil, errors.New("apple: the App Store private key must be an EC key")
	}
	return key, nil
}

func convertMilliunitsToMinorUnits(milliunits int64, currency string) int64 {
	exponent := money.MinorUnitExponentForCurrency(money.CurrencyCode(currency))
	scaled := milliunits * int64(math.Pow10(exponent))
	return (scaled + 500) / 1000
}

const maximumStoreResponseBytes = 2 << 20

func sendJsonRequest(client *http.Client, request *http.Request, destination any) (int, error) {
	request.Header.Set("Accept", "application/json")
	response, err := client.Do(request)
	if err != nil {
		return 0, fmt.Errorf("%w: %v", interfaces.ErrProviderUnavailable, err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode > 299 {
		return response.StatusCode, fmt.Errorf("%w: store api returned %d", interfaces.ErrProviderUnavailable, response.StatusCode)
	}
	if err := json.NewDecoder(http.MaxBytesReader(nil, response.Body, maximumStoreResponseBytes)).Decode(destination); err != nil {
		return response.StatusCode, fmt.Errorf("%w: decode store api response: %v", interfaces.ErrProviderUnavailable, err)
	}
	return response.StatusCode, nil
}
