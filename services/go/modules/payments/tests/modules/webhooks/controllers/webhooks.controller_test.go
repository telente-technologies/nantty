package controllers_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"nantty/modules/ledger/src/loaders"
	"nantty/modules/payments/src/constants"
	"nantty/modules/payments/src/container"
	"nantty/modules/payments/src/integrations"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway"
	gatewayservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/payments/src/modules/webhooks/controllers"
)

type tokenObservingVerifier struct {
	seenToken string
}

func (verifier *tokenObservingVerifier) Store() string              { return constants.StoreGooglePlay }
func (verifier *tokenObservingVerifier) StoreFeeBasisPoints() int64 { return 0 }
func (verifier *tokenObservingVerifier) VerifyPurchaseReceipt(context.Context, interfaces.StoreReceipt) (interfaces.VerifiedStorePurchase, error) {
	return interfaces.VerifiedStorePurchase{}, errors.New("not used")
}
func (verifier *tokenObservingVerifier) VerifySignedRefundNotification(_ context.Context, _ []byte, headers http.Header) (interfaces.StoreRefundNotification, error) {
	verifier.seenToken = headers.Get(integrations.GooglePlayPushTokenHeader)
	if verifier.seenToken == "" {
		return interfaces.StoreRefundNotification{}, interfaces.ErrStoreVerificationNotConfigured
	}
	return interfaces.StoreRefundNotification{}, errors.New("signature rejected")
}

func TestStoreNotificationPushTokenComesFromHeadersNeverTheQueryString(t *testing.T) {
	verifier := &tokenObservingVerifier{}
	deployed := &container.Container{
		Resources:      loaders.MoneyModuleResources{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))},
		StoreVerifiers: map[string]interfaces.StoreReceiptVerifier{constants.StoreGooglePlay: verifier},
	}
	application := &gateway.Application{Container: deployed, Gateway: gatewayservices.NewPaymentGateway(deployed)}
	controller := controllers.WebhooksController{Application: application}

	call := func(target string, headers map[string]string) int {
		request := httptest.NewRequest(http.MethodPost, target, strings.NewReader(`{}`))
		request.SetPathValue("store", constants.StoreGooglePlay)
		for name, value := range headers {
			request.Header.Set(name, value)
		}
		recorder := httptest.NewRecorder()
		controller.ReceiveStoreRefundNotification(recorder, request)
		return recorder.Code
	}

	if status := call("/webhooks/store-notifications/google_play?token=push-secret", nil); status != http.StatusNotImplemented || verifier.seenToken != "" {
		t.Fatalf("query token should be ignored: status=%d observed=%q", status, verifier.seenToken)
	}
	if status := call("/webhooks/store-notifications/google_play", map[string]string{integrations.GooglePlayPushTokenHeader: "push-secret"}); status != http.StatusUnauthorized || verifier.seenToken != "push-secret" {
		t.Fatalf("push-token header should reach verifier: status=%d observed=%q", status, verifier.seenToken)
	}
	if status := call("/webhooks/store-notifications/google_play", map[string]string{"Authorization": "Bearer push-secret"}); status != http.StatusUnauthorized || verifier.seenToken != "push-secret" {
		t.Fatalf("bearer token should reach verifier: status=%d observed=%q", status, verifier.seenToken)
	}
}
