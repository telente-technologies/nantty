package users

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestRestrictSuspendAppealAndReinstate(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	targetId, targetToken := harness.newAccount("sam.target", "Sam Target")
	trust, trustStepUp := harness.staff("admin", "users:restrict", "users:suspend", "users:read")
	noPermission, _ := harness.staff("admin", "users:read")

	restrictPath := "/api/v1/admin/users/" + targetId + "/restrict"
	harness.expect("POST", restrictPath, noPermission, map[string]any{"features": []string{"POSTING"}, "durationDays": 7, "reason": "spam posting"}, http.StatusForbidden)
	for _, invalid := range []map[string]any{
		{"features": []string{}, "durationDays": 7, "reason": "spam posting"},
		{"features": []string{"FLYING"}, "durationDays": 7, "reason": "spam posting"},
		{"features": []string{"POSTING"}, "durationDays": 91, "reason": "spam posting"},
		{"features": []string{"POSTING"}, "durationDays": 7, "reason": "no"},
	} {
		harness.expect("POST", restrictPath, trust, invalid, http.StatusBadRequest, trustStepUp...)
	}
	restricted := harness.expect("POST", restrictPath, trust, map[string]any{"features": []string{"POSTING", "MESSAGING"}, "durationDays": 7, "reason": "spam in messages"}, http.StatusOK, trustStepUp...)
	if len(restricted["restrictions"].([]any)) != 1 || restricted["user"].(map[string]any)["status"] != "ACTIVE" {
		t.Fatalf("a restriction limits features and keeps the account active: %v", restricted)
	}
	harness.waitForPublishedEvents("account.restricted")
	if !harness.audit.has("user.restricted") {
		t.Fatal("restrict must be audited")
	}

	suspendPath := "/api/v1/admin/users/" + targetId + "/suspend"
	suspended := harness.expect("POST", suspendPath, trust, map[string]any{"durationDays": 30, "reasonCode": "SCAM", "reason": "scam listings"}, http.StatusOK, trustStepUp...)
	if suspended["user"].(map[string]any)["status"] != "SUSPENDED" || suspended["restriction"].(map[string]any)["kind"] != "SUSPENSION" {
		t.Fatalf("unexpected suspension %v", suspended)
	}
	harness.expect("POST", suspendPath, trust, map[string]any{"durationDays": 30, "reason": "again please"}, http.StatusConflict, trustStepUp...)
	notice := harness.expect("GET", "/api/v1/users/me/suspension", targetToken, nil, http.StatusOK)
	if notice["retentionDays"] != float64(120) || notice["reason"] != "scam listings" {
		t.Fatalf("the suspended user sees the 120 day notice: %v", notice)
	}
	harness.expect("POST", "/api/v1/users/me/suspension/appeal", targetToken, map[string]string{"message": "short"}, http.StatusBadRequest)
	harness.expect("POST", "/api/v1/users/me/suspension/appeal", targetToken, map[string]string{"message": "This was a mistake, these were my own products."}, http.StatusNoContent)
	harness.expect("POST", "/api/v1/users/me/suspension/appeal", targetToken, map[string]string{"message": "Trying a second time to appeal."}, http.StatusConflict)

	queue := harness.expect("GET", "/api/v1/admin/suspensions/accounts?appeal=PENDING", trust, nil, http.StatusOK)["data"].([]any)
	if len(queue) != 1 || queue[0].(map[string]any)["appeal"].(map[string]any)["status"] != "PENDING" {
		t.Fatalf("the appeal queue must hold the pending appeal: %v", queue)
	}
	caseId := queue[0].(map[string]any)["caseId"].(string)
	decidePath := "/api/v1/admin/suspensions/accounts/" + caseId + "/appeal/decide"
	harness.expect("POST", decidePath, trust, map[string]string{"outcome": "OVERTURNED", "reason": "documents check out"}, http.StatusForbidden)
	harness.expect("POST", decidePath, trust, map[string]string{"outcome": "MAYBE", "reason": "documents check out"}, http.StatusBadRequest, trustStepUp...)
	harness.expect("POST", decidePath, trust, map[string]string{"outcome": "OVERTURNED", "reason": "documents check out"}, http.StatusOK, trustStepUp...)
	harness.expect("GET", "/api/v1/users/me/suspension", targetToken, nil, http.StatusNotFound)
	harness.expect("POST", decidePath, trust, map[string]string{"outcome": "UPHELD", "reason": "documents check out"}, http.StatusConflict, trustStepUp...)
	harness.waitForPublishedEvents("account.suspended", "appeal.decided", "suspension.ended")
	if !harness.audit.has("suspension.appeal_overturned") {
		t.Fatal("appeal decisions must be audited")
	}
}

func TestBanBlocksReSignupOnlyWhenPermanentAndNeedsStepUp(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	firstId, _ := harness.newAccount("ban.first", "Ban First")
	secondId, _ := harness.newAccount("ban.second", "Ban Second")
	admin, stepUp := harness.staff("admin", "users:ban", "users:read")

	harness.expect("POST", "/api/v1/admin/users/"+firstId+"/ban", admin, map[string]any{"durationDays": nil, "reason": "fraud ring member"}, http.StatusForbidden)
	banned := harness.expect("POST", "/api/v1/admin/users/"+firstId+"/ban", admin, map[string]any{"durationDays": nil, "reason": "fraud ring member"}, http.StatusOK, stepUp...)
	if banned["user"].(map[string]any)["status"] != "BANNED" {
		t.Fatalf("unexpected %v", banned)
	}
	harness.expect("POST", "/api/v1/admin/users/"+firstId+"/ban", admin, map[string]any{"durationDays": nil, "reason": "fraud ring member"}, http.StatusConflict, stepUp...)
	harness.expect("POST", "/api/v1/admin/users/"+secondId+"/ban", admin, map[string]any{"durationDays": 7, "reason": "abusive language"}, http.StatusOK, stepUp...)
	if len(harness.accounts.Bans) != 2 || !harness.accounts.Bans[0].BlockFutureSignup || harness.accounts.Bans[1].BlockFutureSignup {
		t.Fatalf("only a permanent ban blocks email, phone and device re-signup: %+v", harness.accounts.Bans)
	}
	harness.expect("POST", "/api/v1/admin/users/"+firstId+"/unban", admin, map[string]any{"reason": "appeal accepted"}, http.StatusOK, stepUp...)
	harness.expect("POST", "/api/v1/admin/users/"+firstId+"/unban", admin, map[string]any{"reason": "appeal accepted"}, http.StatusConflict, stepUp...)
}

func TestDeleteAccountRemovesProfileAndAnonymisesFinancialRecords(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	targetId, targetToken := harness.newAccount("delete.me", "Delete Me")
	harness.expect("GET", "/api/v1/users/me", targetToken, nil, http.StatusOK)
	admin, stepUp := harness.staff("admin", "users:delete", "users:read")
	path := "/api/v1/admin/users/" + targetId + "/delete"

	harness.expect("POST", path, admin, map[string]any{"confirmUsername": "delete.me", "reason": "legal erasure order"}, http.StatusForbidden)
	harness.expect("POST", path, admin, map[string]any{"confirmUsername": "someone.else", "reason": "legal erasure order"}, http.StatusBadRequest, stepUp...)
	harness.moneyBlocked.Store(true)
	blocked := harness.expect("POST", path, admin, map[string]any{"confirmUsername": "delete.me", "reason": "legal erasure order"}, http.StatusConflict, stepUp...)
	if blocked["code"] != "PENDING_WITHDRAWALS" || !strings.Contains(blocked["message"].(string), "non-zero balance") {
		t.Fatalf("deletion is refused while payouts are pending: %v", blocked)
	}
	harness.moneyBlocked.Store(false)
	deleted := harness.expect("POST", path, admin, map[string]any{"confirmUsername": "delete.me", "reason": "legal erasure order"}, http.StatusOK, stepUp...)
	removal := deleted["deletion"].(map[string]any)
	if len(removal["removed"].([]any)) == 0 || len(removal["anonymizedRecords"].([]any)) == 0 || removal["retainedUntil"] == nil {
		t.Fatalf("the response must say what was removed and what is retained: %v", deleted)
	}
	if deleted["user"].(map[string]any)["status"] != "DELETED" {
		t.Fatalf("unexpected %v", deleted)
	}
	harness.expect("POST", path, admin, map[string]any{"confirmUsername": "delete.me", "reason": "legal erasure order"}, http.StatusConflict, stepUp...)
	harness.waitForPublishedEvents("account.deletionExecuted")
	if !harness.audit.has("user.deleted") {
		t.Fatal("deletion must be audited")
	}
}

func TestSuspendedAccountIsDeletedAfter120DaysAndReinstatingStopsTheClock(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	dueId, _ := harness.newAccount("clock.due", "Clock Due")
	savedId, _ := harness.newAccount("clock.saved", "Clock Saved")
	admin, stepUp := harness.staff("admin", "users:suspend", "users:read")
	for _, id := range []string{dueId, savedId} {
		harness.expect("POST", "/api/v1/admin/users/"+id+"/suspend", admin, map[string]any{"durationDays": 0, "reasonCode": "FRAUD", "reason": "payment fraud pattern"}, http.StatusOK, stepUp...)
	}
	cases := harness.expect("GET", "/api/v1/admin/suspensions/accounts", admin, nil, http.StatusOK)["data"].([]any)
	if len(cases) != 2 || cases[0].(map[string]any)["daysUntilDeletion"].(float64) < 118 {
		t.Fatalf("both suspended accounts start a 120 day countdown: %v", cases)
	}
	var savedCase string
	for _, entry := range cases {
		if entry.(map[string]any)["user"].(map[string]any)["id"] == savedId {
			savedCase = entry.(map[string]any)["caseId"].(string)
		}
	}
	harness.expect("POST", "/api/v1/admin/suspensions/accounts/"+savedCase+"/reinstate", admin, map[string]string{"reason": "cleared after review"}, http.StatusOK, stepUp...)
	harness.execSql("UPDATE account_suspensions SET deletion_due_at = now() - interval '1 day' WHERE account_id = $1", mustParseUuid(dueId))
	deadline := harness.waitUntil(func() bool {
		summary, _, _ := harness.accounts.FindAccountSummary(t.Context(), mustParseUuid(dueId))
		return summary.Status == "deleted"
	})
	if !deadline {
		t.Fatal("the worker must delete the account once the 120 days are over")
	}
	saved, _, _ := harness.accounts.FindAccountSummary(t.Context(), mustParseUuid(savedId))
	if saved.Status != "active" {
		t.Fatalf("a reinstated account is not deleted: %+v", saved)
	}
}

func TestReassignUsernameAndHeldUsernamesRespectTheHold(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	ownerId, ownerToken := harness.newAccount("brand.name", "Brand Owner")
	recipientId, _ := harness.newAccount("claimant.person", "Claimant")
	thirdId, _ := harness.newAccount("third.person", "Third")
	harness.expect("GET", "/api/v1/users/me", ownerToken, nil, http.StatusOK)
	admin, stepUp := harness.staff("admin", "usernames:reassign", "users:read")

	path := "/api/v1/admin/users/" + ownerId + "/username/reassign"
	harness.expect("POST", path, admin, map[string]any{"recipientUserId": recipientId, "reason": "verified trademark owner"}, http.StatusForbidden)
	harness.expect("POST", path, admin, map[string]any{"recipientUserId": uuid.NewString(), "reason": "verified trademark owner"}, http.StatusBadRequest, stepUp...)
	moved := harness.expect("POST", path, admin, map[string]any{"recipientUserId": recipientId, "reason": "verified trademark owner"}, http.StatusOK, stepUp...)
	automatic := moved["user"].(map[string]any)["username"].(string)
	if !strings.HasPrefix(automatic, "user_") {
		t.Fatalf("the previous owner gets an automatic username: %v", moved)
	}
	recipient := harness.expect("GET", "/api/v1/admin/users/"+recipientId, admin, nil, http.StatusOK)
	if recipient["user"].(map[string]any)["username"] != "brand.name" {
		t.Fatalf("the recipient owns the contested username: %v", recipient)
	}
	history := recipient["usernameHistory"].([]any)
	if history[0].(map[string]any)["kind"] != "REASSIGNED_TO" {
		t.Fatalf("history is kept: %v", history)
	}
	hold := harness.expect("GET", "/api/v1/admin/usernames/hold?username=claimant.person", admin, nil, http.StatusOK)
	if hold["isHeld"] != true || hold["availableAt"] == nil {
		t.Fatalf("the recipient's old username is held for 120 days: %v", hold)
	}
	held := harness.expect("GET", "/api/v1/admin/usernames/held", admin, nil, http.StatusOK)["items"].([]any)
	if len(held) != 1 {
		t.Fatalf("unexpected held list %v", held)
	}
	assign := "/api/v1/admin/users/" + thirdId + "/username/assign-held"
	conflict := harness.expect("POST", assign, admin, map[string]any{"username": "claimant.person", "reason": "ordered by support"}, http.StatusConflict, stepUp...)
	if conflict["code"] != "USERNAME_HELD" {
		t.Fatalf("unexpected %v", conflict)
	}
	harness.expect("POST", assign, admin, map[string]any{"username": "claimant.person", "reason": "ordered by support", "bypassHold": true}, http.StatusOK, stepUp...)
	if !harness.audit.has("username.assigned_hold_bypassed") {
		t.Fatal("a bypassed hold must be audited with its own action")
	}
}
