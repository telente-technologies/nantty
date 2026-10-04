package privacy

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/modules/users/src/generated/ent/retentionpolicy"
	"zudomart/modules/users/src/generated/ent/shippingaddress"
	"zudomart/modules/users/src/generated/ent/userconsent"
	executedueaccountdeletions "zudomart/modules/users/src/modules/accountDeletion/commands/executeDueAccountDeletions"
	"zudomart/modules/users/src/services"
)

func setRetentionAction(t *testing.T, harness *privacyHarness, category, action string) {
	t.Helper()
	_, err := harness.container.Client.RetentionPolicy.Update().Where(retentionpolicy.CategoryEQ(retentionpolicy.Category(category))).SetAction(retentionpolicy.Action(action)).SetNeedsLegalReview(false).Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
}

func TestAccountDeletionRequestGracePeriodCancelAndRetainByDefault(t *testing.T) {
	harness := startPrivacyHarness(t)
	accountId, token := harness.newAccount("leaver")
	harness.seedUserOwnedData(accountId, "leaver")
	executor := executedueaccountdeletions.Handler{Container: harness.container}

	harness.expect("POST", "/api/v1/users/me/deletion-request", "", map[string]any{"confirm": true}, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/users/me/deletion-request", token, map[string]any{"confirm": false}, http.StatusBadRequest)
	harness.expect("GET", "/api/v1/users/me/deletion-request", token, nil, http.StatusNotFound)
	requested := harness.expect("POST", "/api/v1/users/me/deletion-request", token, map[string]any{"confirm": true, "reason": "moving on"}, http.StatusAccepted)
	scheduled, _ := time.Parse(time.RFC3339, requested["scheduledFor"].(string))
	if requested["status"] != "pending" || scheduled.Sub(harness.clock.now()) < 29*24*time.Hour || len(requested["retentionPolicy"].([]any)) != 8 {
		t.Fatalf("a pending request with a 30 day grace period and a policy snapshot is expected: %v", requested)
	}
	if duplicate := harness.expect("POST", "/api/v1/users/me/deletion-request", token, map[string]any{"confirm": true}, http.StatusConflict); duplicate["code"] != "DELETION_ALREADY_REQUESTED" {
		t.Fatalf("unexpected %v", duplicate)
	}
	if executed, err := executor.Execute(context.Background(), executedueaccountdeletions.Command{}); err != nil || executed != 0 {
		t.Fatalf("nothing is due inside the grace period: %d %v", executed, err)
	}
	cancelled := harness.expect("POST", "/api/v1/users/me/deletion-request/cancel", token, nil, http.StatusOK)
	if cancelled["status"] != "cancelled" {
		t.Fatalf("unexpected %v", cancelled)
	}
	harness.expect("POST", "/api/v1/users/me/deletion-request/cancel", token, nil, http.StatusNotFound)

	harness.expect("POST", "/api/v1/users/me/deletion-request", token, map[string]any{"confirm": true}, http.StatusAccepted)
	harness.clock.advance(31 * 24 * time.Hour)
	if executed, err := executor.Execute(context.Background(), executedueaccountdeletions.Command{}); err != nil || executed != 1 {
		t.Fatalf("the due request must run once: %d %v", executed, err)
	}
	summary, _, _ := harness.directory.FindAccountSummary(context.Background(), accountId)
	if summary.Active || summary.Username != "leaver" {
		t.Fatalf("with the default retain policy the account is deactivated but its identity is kept: %+v", summary)
	}
	if count, _ := harness.container.Client.ShippingAddress.Query().Where(shippingaddress.AccountID(accountId)).Count(context.Background()); count != 1 {
		t.Fatalf("retain means users data stays, addresses=%d", count)
	}
	types := harness.outboxEventTypes()
	if countOf(types, "account.deletionRequested") != 2 || countOf(types, "account.deletionCancelled") != 1 || countOf(types, "account.deletionExecuted") != 1 {
		t.Fatalf("unexpected events %v", types)
	}
}

func TestAccountDeletionAppliesConfiguredRetentionToUsersOwnedData(t *testing.T) {
	harness := startPrivacyHarness(t)
	accountId, token := harness.newAccount("erased")
	bystanderId, _ := harness.newAccount("bystander")
	harness.seedUserOwnedData(accountId, "erased")
	harness.seedUserOwnedData(bystanderId, "bystander")
	setRetentionAction(t, harness, "account", "anonymize")
	setRetentionAction(t, harness, "consents", "delete")
	setRetentionAction(t, harness, "orders", "delete")

	harness.expect("POST", "/api/v1/users/me/deletion-request", token, map[string]any{"confirm": true}, http.StatusAccepted)
	harness.clock.advance(31 * 24 * time.Hour)
	if executed, err := (executedueaccountdeletions.Handler{Container: harness.container}).Execute(context.Background(), executedueaccountdeletions.Command{}); err != nil || executed != 1 {
		t.Fatalf("execution failed: %d %v", executed, err)
	}
	ctx := context.Background()
	client := harness.container.Client
	anonymized, err := client.Profile.Query().Where(profile.AccountID(accountId)).Only(ctx)
	if err != nil || !strings.HasPrefix(anonymized.Handle, "deleted_") || anonymized.DisplayName != "" || anonymized.Bio != "" || anonymized.Status != profile.StatusArchived {
		t.Fatalf("profile must be anonymized: %+v %v", anonymized, err)
	}
	if count, _ := client.ShippingAddress.Query().Where(shippingaddress.AccountID(accountId)).Count(ctx); count != 0 {
		t.Fatalf("addresses must be deleted, %d left", count)
	}
	if count, _ := client.UserConsent.Query().Where(userconsent.AccountID(accountId)).Count(ctx); count != 0 {
		t.Fatalf("consents must be deleted per policy, %d left", count)
	}
	summary, _, _ := harness.directory.FindAccountSummary(ctx, accountId)
	if summary.Active || !strings.HasPrefix(summary.Username, "deleted_") {
		t.Fatalf("the account must be deactivated and its username released: %+v", summary)
	}
	untouched, _ := client.Profile.Query().Where(profile.AccountID(bystanderId)).Only(ctx)
	if untouched == nil || untouched.Handle != "bystander" {
		t.Fatalf("other users must not be affected: %+v", untouched)
	}
	if count, _ := client.ShippingAddress.Query().Where(shippingaddress.AccountID(bystanderId)).Count(ctx); count != 1 {
		t.Fatal("other users' addresses must stay")
	}
	rows, _ := client.OutboxEvent.Query().All(ctx)
	for _, row := range rows {
		if row.EventType == "account.deletionExecuted" && !strings.Contains(string(row.Payload), "handled_by_owning_service") {
			t.Fatalf("categories owned by other services must be reported as delegated: %s", row.Payload)
		}
	}
}

func TestPendingDeletionIsCancelledWhenTheUserLogsInAgainInsideTheGrace(t *testing.T) {
	harness := startPrivacyHarness(t)
	accountId, token := harness.newAccount("returner")
	canceller := services.DeletionGraceCancelService{Container: harness.container}

	if cancelled, err := canceller.CancelPendingDeletionOnLogin(context.Background(), accountId); err != nil || cancelled {
		t.Fatalf("nothing pending means nothing cancelled: %v %v", cancelled, err)
	}
	harness.expect("POST", "/api/v1/users/me/deletion-request", token, map[string]any{"confirm": true}, http.StatusAccepted)
	harness.clock.advance(29 * 24 * time.Hour)
	if cancelled, err := canceller.CancelPendingDeletionOnLogin(context.Background(), accountId); err != nil || !cancelled {
		t.Fatalf("a login on day 29 cancels the deletion: %v %v", cancelled, err)
	}
	if status := harness.expect("GET", "/api/v1/users/me/deletion-request", token, nil, http.StatusOK); status["status"] != "cancelled" {
		t.Fatalf("unexpected %v", status)
	}
	harness.clock.advance(5 * 24 * time.Hour)
	if executed, err := (executedueaccountdeletions.Handler{Container: harness.container}).Execute(context.Background(), executedueaccountdeletions.Command{}); err != nil || executed != 0 {
		t.Fatalf("a cancelled request never runs: %d %v", executed, err)
	}
	harness.expect("POST", "/api/v1/users/me/deletion-request", token, map[string]any{"confirm": true}, http.StatusAccepted)
	harness.clock.advance(31 * 24 * time.Hour)
	if cancelled, _ := canceller.CancelPendingDeletionOnLogin(context.Background(), accountId); cancelled {
		t.Fatal("a request past its grace is not cancellable by login")
	}
}
