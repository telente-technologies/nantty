package payments

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	moneytesting "zudomart/modules/ledger/src/databases/moneyTesting"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	"zudomart/modules/payments/src/modules/gateway/services"
)

func countPaymentsOutbox(t *testing.T, harness *paymentstesting.MoneyHarness, eventType, subject string) int {
	t.Helper()
	var count int
	schema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	query := "SELECT count(*) FROM " + pgx.Identifier{schema, "outbox_events"}.Sanitize() + " WHERE event_type = $1 AND subject = $2"
	if err := harness.Database.QueryRow(query, eventType, subject).Scan(&count); err != nil {
		t.Fatal(err)
	}
	return count
}

func verificationLevelOf(t *testing.T, harness *paymentstesting.MoneyHarness, token string) map[string]any {
	t.Helper()
	response := harness.Call(http.MethodGet, "/api/v1/payments/verification/me", token, "", nil)
	if response.Status != http.StatusOK {
		t.Fatalf("verification level: %d %s", response.Status, response.Raw)
	}
	return response.Body
}

func TestBvnConsentMakesUsersPayoutVerifiedAndSmileIdMakesThemIdentityVerified(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	paymentsContainer := harness.Payments.Application.Container
	paymentsContainer.Settings.CustomerValidationMode = "required"
	gateway := harness.Payments.Application.Gateway
	creator := uuid.NewString()
	token := harness.Tokens.UserAccessToken(creator)
	if level := verificationLevelOf(t, harness, token); level["level"].(float64) != 0 || level["nextStep"] != "payout_setup" {
		t.Fatalf("a new user is L0: %v", level)
	}
	harness.PreparePayoutOnboarding(creator, false)
	if level := verificationLevelOf(t, harness, token); level["level"].(float64) != 0 || level["nextStep"] != "bank_validation" {
		t.Fatalf("a ready payout account without the BVN consent is not L1 yet: %v", level)
	}
	if err := gateway.RequireVerificationLevel(context.Background(), creator, 1); err != services.ErrVerificationRequired {
		t.Fatalf("L1 actions must be refused: %v", err)
	}
	harness.CompleteBvnConsent(creator)
	if repeated := harness.Call(http.MethodGet, "/api/v1/payments/payout-onboarding/me/bank-validation", token, "", nil); repeated.Body["status"] != "verified" {
		t.Fatalf("polling again keeps the verified result: %s", repeated.Raw)
	}
	if level := verificationLevelOf(t, harness, token); level["level"].(float64) != 1 || level["unlocks"].(map[string]any)["ads"] != true {
		t.Fatalf("BVN-verified users are payout-verified: %v", level)
	}
	if changed := countPaymentsOutbox(t, harness, "verificationLevel.changed", creator); changed != 1 {
		t.Fatalf("one level change must emit one event, got %d", changed)
	}
	internal := http.Header{"X-Internal-Token": {strings.Repeat("i", 32)}}
	if read := harness.Call(http.MethodGet, "/api/v1/internal/users/"+creator+"/verification-level", "", "", nil, internal); read.Status != http.StatusOK || read.Body["level"].(float64) != 1 {
		t.Fatalf("internal level: %d %s", read.Status, read.Raw)
	}
	if forged := harness.Call(http.MethodGet, "/api/v1/internal/users/"+creator+"/verification-level", "", "", nil); forged.Status != http.StatusUnauthorized {
		t.Fatalf("internal level without the token: %d", forged.Status)
	}
	users := moneytesting.CreateEmptySchema(t, harness.Database, "users")
	for _, statement := range []string{
		`CREATE TABLE ` + pgx.Identifier{users, "profiles"}.Sanitize() + ` (account_id uuid, kind text, country_code text)`,
		`CREATE TABLE ` + pgx.Identifier{users, "verification_cases"}.Sanitize() + ` (account_id uuid, status text, liveness_result text, face_match_result text)`,
	} {
		if _, err := harness.Database.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	paymentsContainer.Settings.UsersSchema = users
	if _, err := harness.Database.Exec(`INSERT INTO `+pgx.Identifier{users, "verification_cases"}.Sanitize()+` VALUES ($1, 'approved', 'passed', 'failed')`, creator); err != nil {
		t.Fatal(err)
	}
	if err := gateway.RefreshVerificationLevel(context.Background(), creator); err != nil || verificationLevelOf(t, harness, token)["level"].(float64) != 1 {
		t.Fatalf("a failed face match is not identity verification: %v", err)
	}
	if _, err := harness.Database.Exec(`INSERT INTO `+pgx.Identifier{users, "verification_cases"}.Sanitize()+` VALUES ($1, 'approved', 'passed', 'passed')`, creator); err != nil {
		t.Fatal(err)
	}
	if err := gateway.RefreshVerificationLevel(context.Background(), creator); err != nil || verificationLevelOf(t, harness, token)["level"].(float64) != 2 || countPaymentsOutbox(t, harness, "verificationLevel.changed", creator) != 2 {
		t.Fatalf("liveness and face match make the user L2: %v", err)
	}
	paymentsContainer.Settings.UsersSchema = users + "_missing"
	if unavailable := harness.Call(http.MethodGet, "/api/v1/payments/verification/me", token, "", nil); unavailable.Status != http.StatusServiceUnavailable || unavailable.Body["code"] != "VERIFICATION_UNAVAILABLE" {
		t.Fatalf("an unreadable level must fail closed: %d %s", unavailable.Status, unavailable.Raw)
	}
	if err := gateway.RequireVerificationLevel(context.Background(), creator, 1); err != services.ErrVerificationUnavailable {
		t.Fatalf("gates must fail closed: %v", err)
	}
}

func TestBankValidationNeedsABvn(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	harness.Payments.Application.Container.Settings.CustomerValidationMode = "required"
	user := uuid.NewString()
	token := harness.Tokens.UserAccessToken(user)
	if early := harness.Call(http.MethodPost, "/api/v1/payments/payout-onboarding/me/bank-validation", token, "", nil); early.Status != http.StatusConflict {
		t.Fatalf("validation before identity: %d %s", early.Status, early.Raw)
	}
	saved := harness.Call(http.MethodPut, "/api/v1/payments/payout-onboarding/me/identity", token, "", map[string]any{
		"legalName": "Temitope Adeyemi", "dateOfBirth": "1995-04-02", "addressLine1": "4 Allen Avenue", "city": "Ikeja", "state": "Lagos", "idType": "nin", "idNumber": "12345678901",
	})
	if saved.Status != http.StatusOK {
		t.Fatalf("identity: %d %s", saved.Status, saved.Raw)
	}
	if nin := harness.Call(http.MethodPost, "/api/v1/payments/payout-onboarding/me/bank-validation", token, "", nil); nin.Status != http.StatusUnprocessableEntity || nin.Body["code"] != "BVN_REQUIRED" {
		t.Fatalf("NIN-only users must add a BVN: %d %s", nin.Status, nin.Raw)
	}
}
