package payments

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/interfaces"
)

type fakeDocumentVerifier struct {
	sessions atomic.Int64
}

func (verifier *fakeDocumentVerifier) CreateDocumentVerificationSession(_ context.Context, request interfaces.DocumentVerificationRequest) (interfaces.DocumentVerificationSession, error) {
	number := verifier.sessions.Add(1)
	id := "vs_" + strings.Repeat("x", int(number))
	return interfaces.DocumentVerificationSession{SessionId: id, Url: "https://verify.example.test/s/" + id + "?return=" + request.ReturnUrl, ExpiresAt: time.Now().Add(30 * time.Minute)}, nil
}

func (verifier *fakeDocumentVerifier) VerifyDocumentVerificationWebhook(rawBody []byte, headers http.Header) (interfaces.DocumentVerificationEvent, error) {
	if headers.Get("X-Test-Signature") != "valid" {
		return interfaces.DocumentVerificationEvent{}, errors.New("bad signature")
	}
	session, outcome, _ := strings.Cut(string(rawBody), ":")
	return interfaces.DocumentVerificationEvent{SessionId: session, Outcome: outcome}, nil
}

func TestDocumentsRequiredAccountGetsAHostedLinkAndTheWebhookMovesItToReview(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	gateway := harness.Payments.Application.Gateway
	creator := uuid.NewString()
	token := harness.Tokens.UserAccessToken(creator)
	if saved := harness.Call(http.MethodPut, "/api/v1/payments/payout-onboarding/me/identity", token, "", map[string]any{
		"legalName": "Temitope Adeyemi", "dateOfBirth": "1995-04-02", "addressLine1": "4 Allen Avenue", "city": "Ikeja", "state": "Lagos", "idType": "nin", "idNumber": "12345678901",
	}); saved.Status != http.StatusOK {
		t.Fatalf("identity: %d %s", saved.Status, saved.Raw)
	}
	if bank := harness.Call(http.MethodPut, "/api/v1/payments/payout-onboarding/me/bank", token, "", map[string]any{"bankCode": "058", "bankName": "GTBank", "accountNumber": "0123456789"}, harness.StepUpFor(token)); bank.Status != http.StatusOK {
		t.Fatalf("bank: %d %s", bank.Status, bank.Raw)
	}
	gateway.ProcessDueConnectedAccountJobs(context.Background(), 20)
	schema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	if _, err := harness.Database.Exec(`UPDATE `+pgx.Identifier{schema, "connected_accounts"}.Sanitize()+` SET verification_status = 'documentsRequired' WHERE user_id = $1`, creator); err != nil {
		t.Fatal(err)
	}
	state := harness.Call(http.MethodGet, "/api/v1/payments/payout-onboarding/me", token, "", nil)
	if state.Body["requiresDocumentStep"] != true || state.Body["accountStatus"] != "documentsRequired" || state.Body["currentStep"] != "document" || state.Body["documentStatus"] != "not_started" {
		t.Fatalf("documents required state: %s", state.Raw)
	}
	if unavailable := harness.Call(http.MethodPost, "/api/v1/payments/payout-onboarding/me/document-link", token, "", nil); unavailable.Status != http.StatusServiceUnavailable {
		t.Fatalf("no verifier configured: %d %s", unavailable.Status, unavailable.Raw)
	}
	verifier := &fakeDocumentVerifier{}
	harness.Payments.Application.Container.Documents = verifier
	link := harness.Call(http.MethodPost, "/api/v1/payments/payout-onboarding/me/document-link", token, "", nil)
	again := harness.Call(http.MethodPost, "/api/v1/payments/payout-onboarding/me/document-link", token, "", nil)
	if link.Status != http.StatusOK || link.Body["returnUrl"] != "https://nantty.test/seller/verification/return" || link.Body["expiresAt"] == nil || again.Body["url"] != link.Body["url"] || verifier.sessions.Load() != 1 {
		t.Fatalf("document link: %d %s / %s", link.Status, link.Raw, again.Raw)
	}
	if other := harness.Call(http.MethodPost, "/api/v1/payments/payout-onboarding/me/document-link", harness.Tokens.UserAccessToken(uuid.NewString()), "", nil); other.Status != http.StatusConflict {
		t.Fatalf("an account without a document requirement got a link: %d", other.Status)
	}
	if issued := harness.Call(http.MethodGet, "/api/v1/payments/payout-onboarding/me", token, "", nil); issued.Body["documentStatus"] != "link_issued" {
		t.Fatalf("issued: %s", issued.Raw)
	}
	if forged := harness.Call(http.MethodPost, "/api/v1/payments/webhooks/document-verification", "", "", []byte("vs_x:submitted")); forged.Status != http.StatusUnauthorized {
		t.Fatalf("unsigned webhook accepted: %d", forged.Status)
	}
	signed := http.Header{"X-Test-Signature": {"valid"}}
	for range 2 {
		if delivered := harness.Call(http.MethodPost, "/api/v1/payments/webhooks/document-verification", "", "", []byte("vs_x:submitted"), signed); delivered.Status != http.StatusOK {
			t.Fatalf("webhook: %d %s", delivered.Status, delivered.Raw)
		}
	}
	review := harness.Call(http.MethodGet, "/api/v1/payments/payout-onboarding/me", token, "", nil)
	if review.Body["documentStatus"] != "in_review" || review.Body["requiresDocumentStep"] != false || review.Body["status"] != "pending_review" {
		t.Fatalf("after submission: %s", review.Raw)
	}
	harness.Call(http.MethodPost, "/api/v1/payments/webhooks/document-verification", "", "", []byte("vs_x:rejected"), signed)
	if rejected := harness.Call(http.MethodGet, "/api/v1/payments/payout-onboarding/me", token, "", nil); rejected.Body["documentStatus"] != "rejected" || rejected.Body["requiresDocumentStep"] != true {
		t.Fatalf("after rejection: %s", rejected.Raw)
	}
	if fresh := harness.Call(http.MethodPost, "/api/v1/payments/payout-onboarding/me/document-link", token, "", nil); fresh.Status != http.StatusOK || fresh.Body["url"] == link.Body["url"] {
		t.Fatalf("rejected documents need a new link: %d %s", fresh.Status, fresh.Raw)
	}
}
