package payments

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"nantty/modules/payments/src/generated/ent/connectedaccountjob"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/payments/src/modules/gateway/services"
)

func onboardSellerIdentity(t *testing.T, harness *paymentstesting.MoneyHarness) (string, string) {
	t.Helper()
	seller := uuid.NewString()
	token := harness.Tokens.UserAccessToken(seller)
	saved := harness.Call(http.MethodPut, "/api/v1/payments/payout-onboarding/me/identity?role=seller", token, "", map[string]any{
		"legalName": "Temitope Adeyemi", "dateOfBirth": "1995-04-02", "addressLine1": "4 Allen Avenue", "city": "Ikeja", "state": "Lagos", "idType": "bvn", "idNumber": "22212345678",
	})
	if saved.Status != http.StatusOK {
		t.Fatalf("identity: %d %s", saved.Status, saved.Raw)
	}
	return seller, token
}

func countDuplicateAdvisories(t *testing.T, harness *paymentstesting.MoneyHarness, userId string) int {
	t.Helper()
	outbox := pgx.Identifier{harness.Payments.Application.Container.Settings.Money.DatabaseSchema, "outbox_events"}.Sanitize()
	var count int
	if err := harness.Database.QueryRow(`SELECT count(*) FROM `+outbox+` WHERE event_type = $1 AND subject = $2 AND payload::text LIKE '%"advisoryOnly": true%'`, services.DuplicateBankAccountEventType, userId).Scan(&count); err != nil {
		t.Fatal(err)
	}
	return count
}

func TestSecondStoreWithTheSameBankAccountIsRefusedAndSentToTrustReview(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	gateway := harness.Payments.Application.Gateway
	ctx := context.Background()
	bank := map[string]any{"bankCode": "058", "bankName": "GTBank", "accountNumber": "0123456789"}

	_, firstToken := onboardSellerIdentity(t, harness)
	if saved := harness.Call(http.MethodPut, "/api/v1/payments/payout-onboarding/me/bank", firstToken, "", bank, harness.StepUpFor(firstToken)); saved.Status != http.StatusOK {
		t.Fatalf("first store: %d %s", saved.Status, saved.Raw)
	}
	second, secondToken := onboardSellerIdentity(t, harness)
	refused := harness.Call(http.MethodPut, "/api/v1/payments/payout-onboarding/me/bank", secondToken, "", bank, harness.StepUpFor(secondToken))
	if refused.Status != http.StatusConflict || refused.Body["code"] != "BANK_ACCOUNT_ALREADY_LINKED" || !strings.Contains(string(refused.Raw), "already linked to another store") {
		t.Fatalf("the second store must be told clearly: %d %s", refused.Status, refused.Raw)
	}
	client := gateway.Container.Client(harness.Database)
	if queued, _ := client.ConnectedAccountJob.Query().Where(connectedaccountjob.UserID(second)).Count(ctx); queued != 0 {
		t.Fatalf("nothing is queued for a refused bank account: %d jobs", queued)
	}
	if count := countDuplicateAdvisories(t, harness, second); count != 1 {
		t.Fatalf("one trust advisory: %d", count)
	}

	legacy, legacyToken := onboardSellerIdentity(t, harness)
	if _, err := gateway.EnqueueConnectedAccountStep(ctx, legacy, models.JobStepCreateSettlementSubaccount, interfaces.PayeeBankAccount{AccountName: "TEMITOPE ADEYEMI", BankCode: "058", AccountNumber: "0123456789", Currency: "NGN"}); err != nil {
		t.Fatal(err)
	}
	gateway.ProcessDueConnectedAccountJobs(ctx, 20)
	job, err := client.ConnectedAccountJob.Query().Where(connectedaccountjob.UserID(legacy)).Only(ctx)
	if err != nil || job.Status != connectedaccountjob.StatusFailed || !services.IsDuplicateBankAccountJobError(job.LastError) || job.AttemptCount != 1 {
		t.Fatalf("an already queued duplicate fails once and stops: %+v err=%v", job, err)
	}
	if requeued, err := gateway.ReconcileStuckConnectedAccounts(ctx, 0); err != nil || requeued != 0 {
		t.Fatalf("reconciliation must not retry a duplicate account forever: requeued=%d err=%v", requeued, err)
	}
	state := harness.Call(http.MethodGet, "/api/v1/payments/payout-onboarding/me", legacyToken, "", nil)
	if !strings.Contains(string(state.Raw), "BANK_ACCOUNT_ALREADY_LINKED") {
		t.Fatalf("the onboarding state explains why: %s", state.Raw)
	}
	if countDuplicateAdvisories(t, harness, legacy) != 1 {
		t.Fatal("the worker path raises the advisory too")
	}
}
