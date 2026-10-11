package payments

import (
	"bytes"
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	"zudomart/modules/payments/src/modules/gateway/services"
)

func skipIntegrationWhenShort(t *testing.T) {
	t.Helper()
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
}

func TestPayoutAccountCreationIsQueuedAndNeverDuplicatedAcrossRetries(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	gateway := harness.Payments.Application.Gateway
	seller := uuid.NewString()
	token := harness.Tokens.UserAccessToken(seller)
	saved := harness.Call(http.MethodPut, "/api/v1/payments/payout-onboarding/me/identity?role=seller", token, "", map[string]any{
		"legalName": "Temitope Adeyemi", "dateOfBirth": "1995-04-02", "addressLine1": "4 Allen Avenue", "city": "Ikeja", "state": "Lagos", "idType": "bvn", "idNumber": "22212345678",
	})
	if saved.Status != http.StatusOK || saved.Body["accountStatus"] != "pending_creation" || saved.Body["idLast4"] != "5678" || saved.Body["currentStep"] != "bank" {
		t.Fatalf("identity: %d %s", saved.Status, saved.Raw)
	}
	if mismatch := harness.Call(http.MethodPut, "/api/v1/payments/payout-onboarding/me/bank", token, "", map[string]any{"bankCode": "058", "bankName": "GTBank", "accountNumber": "1112223334"}, harness.StepUpFor(token)); mismatch.Status != http.StatusUnprocessableEntity || mismatch.Body["code"] != "NAME_MISMATCH" {
		t.Fatalf("name mismatch: %d %s", mismatch.Status, mismatch.Raw)
	}
	harness.Paystack.Recipients["RCP_pre_existing"] = map[string]any{"recipient_code": "RCP_pre_existing", "metadata": map[string]any{"zudomartUserId": seller}, "details": map[string]any{"account_number": "0123456789", "bank_code": "058"}}
	bank := harness.Call(http.MethodPut, "/api/v1/payments/payout-onboarding/me/bank", token, "", map[string]any{"bankCode": "058", "bankName": "GTBank", "accountNumber": "0123456789"}, harness.StepUpFor(token))
	if bank.Status != http.StatusOK || bank.Body["syncByStep"].(map[string]any)["bank"] != "sending" || bank.Body["withdrawalsEnabled"] != false {
		t.Fatalf("bank: %d %s", bank.Status, bank.Raw)
	}
	harness.Paystack.FailNextRequests = 3
	gateway.ProcessDueConnectedAccountJobs(context.Background(), 1)
	if err := gateway.RequirePayoutAccountVerified(context.Background(), seller); err == nil {
		t.Fatal("withdrawals must stay refused until the payout account exists")
	}
	schema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	jobs := pgx.Identifier{schema, "connected_account_jobs"}.Sanitize()
	if _, err := harness.Database.Exec(`UPDATE `+jobs+` SET next_attempt_at = now() WHERE user_id = $1`, seller); err != nil {
		t.Fatal(err)
	}
	gateway.ProcessDueConnectedAccountJobs(context.Background(), 20)
	gateway.ProcessDueConnectedAccountJobs(context.Background(), 20)
	if harness.Paystack.RecipientCreations != 0 || harness.Paystack.SubaccountCreations != 1 {
		t.Fatalf("a retried job must reuse the existing recipient: recipients %d subaccounts %d", harness.Paystack.RecipientCreations, harness.Paystack.SubaccountCreations)
	}
	state := harness.Call(http.MethodGet, "/api/v1/payments/payout-onboarding/me", token, "", nil)
	if state.Body["accountStatus"] != "verified" || state.Body["withdrawalsEnabled"] != true || state.Body["syncByStep"].(map[string]any)["bank"] != "done" {
		t.Fatalf("state after the worker: %s", state.Raw)
	}
	if err := gateway.RequirePayoutAccountVerified(context.Background(), seller); err != nil {
		t.Fatalf("a verified seller can withdraw: %v", err)
	}
	if link := harness.Call(http.MethodPost, "/api/v1/payments/payout-onboarding/me/document-link", token, "", nil); link.Status != http.StatusConflict || link.Body["code"] != "ACCOUNT_NOT_READY" {
		t.Fatalf("document link: %d %s", link.Status, link.Raw)
	}
	fees := harness.Call(http.MethodGet, "/api/v1/payments/payout-fees", "", "", nil)
	if fees.Status != http.StatusOK || fees.Body["fee"].(map[string]any)["amountMinor"].(float64) != 5000 {
		t.Fatalf("fees: %d %s", fees.Status, fees.Raw)
	}
}

func TestFailedPayoutAccountJobsAreRequeuedByReconciliation(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	gateway := harness.Payments.Application.Gateway
	creator := uuid.NewString()
	if err := gateway.SavePayoutOnboardingIdentity(context.Background(), creator, services.OnboardingIdentityInput{LegalName: "Temitope Adeyemi", DateOfBirth: "1994-01-01", AddressLine1: "1 Road", City: "Ikeja", State: "Lagos", IdType: "nin", IdNumber: "12345678901"}); err != nil {
		t.Fatal(err)
	}
	if err := gateway.SavePayoutOnboardingBank(context.Background(), creator, services.OnboardingBankInput{BankCode: "058", BankName: "GTBank", AccountNumber: "0123456789"}); err != nil {
		t.Fatal(err)
	}
	schema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	table := pgx.Identifier{schema, "connected_account_jobs"}.Sanitize()
	if _, err := harness.Database.Exec(`UPDATE `+table+` SET status = 'failed', attempt_count = 5, last_error = 'paystack 502', updated_at = now() - interval '2 days' WHERE user_id = $1`, creator); err != nil {
		t.Fatal(err)
	}
	requeued, err := gateway.ReconcileStuckConnectedAccounts(context.Background(), 24*time.Hour)
	if err != nil || requeued != 1 {
		t.Fatalf("requeued %d err %v", requeued, err)
	}
	gateway.ProcessDueConnectedAccountJobs(context.Background(), 20)
	if _, err := gateway.FindConnectedAccountForUser(context.Background(), harness.Database, creator); err != nil {
		t.Fatalf("the requeued job must create the recipient: %v", err)
	}
}

func TestSavedCardAuthorizationNeverLeavesTheServerAndChargesUseTheOwnersSavedCardId(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	var logs bytes.Buffer
	harness.Payments.Application.Container.Resources.Logger = slog.New(slog.NewTextHandler(&logs, &slog.HandlerOptions{Level: slog.LevelDebug}))
	buyer, stranger := uuid.NewString(), uuid.NewString()
	token, strangerToken := harness.Tokens.UserAccessToken(buyer), harness.Tokens.UserAccessToken(stranger)
	started := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups", token, "", map[string]any{})
	if started.Status != http.StatusCreated || started.Body["verificationCharge"].(map[string]any)["amountMinor"].(float64) != 5000 {
		t.Fatalf("start: %d %s", started.Status, started.Raw)
	}
	reference := started.Body["reference"].(string)
	transaction := harness.PayCheckout(reference, 75, "card")
	completed := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups/"+reference+"/complete", token, "", nil)
	savedCardId, _ := completed.Body["savedCardId"].(string)
	if completed.Status != http.StatusOK || savedCardId == "" || completed.Body["last4"] != "4081" || strings.Contains(string(completed.Raw), transaction.AuthorizationCode) || completed.Body["authorizationCode"] != nil {
		t.Fatalf("complete must return our saved card id, never the provider authorization: %d %s", completed.Status, completed.Raw)
	}
	if again := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups/"+reference+"/complete", token, "", nil); again.Status != http.StatusOK || again.Body["savedCardId"] != savedCardId {
		t.Fatalf("completing again returns the same saved card: %d %s", again.Status, again.Raw)
	}
	other := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups", strangerToken, "", map[string]any{})
	otherReference := other.Body["reference"].(string)
	if stolen := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/charges", strangerToken, "stolen-card-charge-1", map[string]any{"paymentReference": otherReference, "savedCardId": savedCardId}); stolen.Status != http.StatusConflict || stolen.Body["code"] != "BILLING_CARD_MISSING" {
		t.Fatalf("another account cannot charge this saved card: %d %s", stolen.Status, stolen.Raw)
	}
	if legacy := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/charges", strangerToken, "legacy-card-charge-1", map[string]any{"paymentReference": otherReference, "authorizationCode": transaction.AuthorizationCode}); legacy.Status != http.StatusBadRequest {
		t.Fatalf("a provider authorization from a client is refused: %d %s", legacy.Status, legacy.Raw)
	}
	harness.Payments.Application.Gateway.RetryPendingRefunds(context.Background(), 10)
	if len(harness.Paystack.Refunds) != 1 {
		t.Fatalf("the verification charge must be refunded: %+v", harness.Paystack.Refunds)
	}
	assertNoColumnContains(t, harness.Database, harness.Payments.Application.Container.Settings.Money.DatabaseSchema, transaction.AuthorizationCode)
	if strings.Contains(logs.String(), transaction.AuthorizationCode) || strings.Contains(logs.String(), "AUTH_") {
		t.Fatal("the provider authorization must never be logged")
	}
	harness.AssertLedgerHealthy()
}

func assertNoColumnContains(t *testing.T, database *sql.DB, schema, needle string) {
	t.Helper()
	rows, err := database.Query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1 AND data_type IN ('character varying', 'text', 'jsonb', 'bytea')`, schema)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var table, column string
		if err := rows.Scan(&table, &column); err != nil {
			t.Fatal(err)
		}
		var found bool
		query := `SELECT EXISTS (SELECT 1 FROM ` + pgx.Identifier{schema, table}.Sanitize() + ` WHERE position($1 in ` + pgx.Identifier{column}.Sanitize() + `::text) > 0)`
		if err := database.QueryRow(query, needle).Scan(&found); err != nil {
			t.Fatal(err)
		}
		if found {
			t.Fatalf("%s.%s stores the saved card reference", table, column)
		}
	}
}
