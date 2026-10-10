package integrations

import (
	"context"
	"net/http"

	"zudomart/modules/payments/src/interfaces"
)

type AppStoreReceiptVerifierSettings struct {
	Store               string
	Configured          bool
	StoreFeeBasisPoints int64
}

type AppStoreReceiptVerifier struct {
	settings AppStoreReceiptVerifierSettings
}

func NewAppleInAppPurchaseVerifier(configured bool, storeFeeBasisPoints int64) *AppStoreReceiptVerifier {
	return &AppStoreReceiptVerifier{settings: AppStoreReceiptVerifierSettings{Store: "apple_iap", Configured: configured, StoreFeeBasisPoints: storeFeeBasisPoints}}
}

func NewGooglePlayBillingVerifier(configured bool, storeFeeBasisPoints int64) *AppStoreReceiptVerifier {
	return &AppStoreReceiptVerifier{settings: AppStoreReceiptVerifierSettings{Store: "google_play", Configured: configured, StoreFeeBasisPoints: storeFeeBasisPoints}}
}

func (verifier *AppStoreReceiptVerifier) IsPlaceholder() bool { return !verifier.settings.Configured }

func (verifier *AppStoreReceiptVerifier) Store() string { return verifier.settings.Store }

func (verifier *AppStoreReceiptVerifier) StoreFeeBasisPoints() int64 {
	return verifier.settings.StoreFeeBasisPoints
}

func (verifier *AppStoreReceiptVerifier) VerifyPurchaseReceipt(context.Context, interfaces.StoreReceipt) (interfaces.VerifiedStorePurchase, error) {
	return interfaces.VerifiedStorePurchase{}, interfaces.ErrStoreVerificationNotConfigured
}

func (verifier *AppStoreReceiptVerifier) VerifySignedRefundNotification(context.Context, []byte, http.Header) (interfaces.StoreRefundNotification, error) {
	return interfaces.StoreRefundNotification{}, interfaces.ErrStoreVerificationNotConfigured
}
