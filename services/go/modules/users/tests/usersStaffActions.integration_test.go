package users_test

import (
	"net/http"
	"strings"
	"testing"
)

func TestStaffRevealsPersonalDataWarnsAndForcesLogoutWithAudit(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	userId, _ := harness.newAccount("pii.owner", "Pii Owner")
	reader, _ := harness.staffHeaders("users:read")
	revealer, revealerStepUp := harness.staffHeaders("users:read-pii")
	moderator, moderatorStepUp := harness.staffHeaders("users:moderate")

	harness.expect("GET", "/api/v1/admin/users/"+userId+"/personal-data?purpose=support+ticket+123", reader, nil, http.StatusForbidden)
	harness.expect("GET", "/api/v1/admin/users/"+userId+"/personal-data?purpose=support+ticket+123", revealer, nil, http.StatusForbidden)
	harness.expect("GET", "/api/v1/admin/users/"+userId+"/personal-data", revealer, nil, http.StatusBadRequest, revealerStepUp...)
	revealed := harness.expect("GET", "/api/v1/admin/users/"+userId+"/personal-data?purpose=support+ticket+123", revealer, nil, http.StatusOK, revealerStepUp...)
	if revealed["email"] != "pii.owner@example.com" || revealed["legalName"] != "Pii Owner" || revealed["expiresInSeconds"] != float64(300) || revealed["phone"] != "" {
		t.Fatalf("unexpected personal data %v", revealed)
	}
	if !harness.audit.has("user.personal_data_revealed") {
		t.Fatalf("revealing personal data is audited: %v", harness.audit.actions)
	}

	harness.expect("POST", "/api/v1/admin/users/"+userId+"/warn", reader, map[string]any{"reason": "spam in comments", "policy": "Spam"}, http.StatusForbidden)
	harness.expect("POST", "/api/v1/admin/users/"+userId+"/warn", moderator, map[string]any{"reason": "spam in comments", "policy": "Spam", "addStrike": true}, http.StatusUnprocessableEntity, moderatorStepUp...)
	warned := harness.expect("POST", "/api/v1/admin/users/"+userId+"/warn", moderator, map[string]any{"reason": "spam in comments", "policy": "Spam", "addStrike": false}, http.StatusOK, moderatorStepUp...)
	if warned["user"].(map[string]any)["id"] != userId {
		t.Fatalf("warn returns the user detail: %v", warned)
	}
	harness.waitForPublishedEvents("account.warned")

	harness.expect("POST", "/api/v1/admin/users/"+userId+"/force-logout", moderator, map[string]any{"reason": "x"}, http.StatusBadRequest, moderatorStepUp...)
	harness.expect("POST", "/api/v1/admin/users/"+userId+"/force-logout", moderator, map[string]any{"reason": "stolen phone", "sessionId": "nope"}, http.StatusBadRequest, moderatorStepUp...)
	harness.expect("POST", "/api/v1/admin/users/"+userId+"/force-logout", moderator, map[string]any{"reason": "stolen phone reported"}, http.StatusOK, moderatorStepUp...)
	if !harness.audit.has("user.warned") || !harness.audit.has("user.force_logout") {
		t.Fatalf("warn and force logout are audited: %v", harness.audit.actions)
	}
}

func TestWithholdAndReclaimAnAccountUsername(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	ownerId, _ := harness.newAccount("dangote", "Squatter")
	claimantId, _ := harness.newAccount("dangote.group", "Dangote Group")
	staffToken, stepUp := harness.staffHeaders("users.usernames.withhold", "users.usernames.read", "usernames:reassign", "verification:grant")

	harness.expect("POST", "/api/v1/admin/users/"+ownerId+"/username/withhold", staffToken, map[string]any{"reason": "brand impersonation"}, http.StatusForbidden)
	withheld := harness.expect("POST", "/api/v1/admin/users/"+ownerId+"/username/withhold", staffToken, map[string]any{"reason": "brand impersonation"}, http.StatusOK, stepUp...)
	assigned := withheld["assignedUsername"].(string)
	if !strings.HasPrefix(assigned, "user_") || withheld["withheldUsername"].(map[string]any)["username"] != "dangote" || withheld["user"].(map[string]any)["username"] != assigned {
		t.Fatalf("unexpected withhold result %v", withheld)
	}
	harness.expect("POST", "/api/v1/admin/users/"+ownerId+"/username/withhold", staffToken, map[string]any{"reason": "brand impersonation"}, http.StatusConflict, stepUp...)
	list := harness.expect("GET", "/api/v1/admin/usernames/withheld", staffToken, nil, http.StatusOK)
	entries := list["data"].([]any)
	if len(entries) != 1 || entries[0].(map[string]any)["originalOwnerId"] != ownerId || entries[0].(map[string]any)["originalOwnerDisplayName"] != "Squatter" {
		t.Fatalf("unexpected withheld list %v", list)
	}
	preview := harness.expect("GET", "/api/v1/admin/usernames/confusables?candidate=Dang0te", staffToken, nil, http.StatusOK)
	if preview["normalized"] != "dang0te" || preview["isWithheld"] != false || preview["takenByUserId"] != nil {
		t.Fatalf("unexpected preview %v", preview)
	}
	if again := harness.expect("GET", "/api/v1/admin/usernames/confusables?candidate=dangote", staffToken, nil, http.StatusOK); again["isWithheld"] != true {
		t.Fatalf("the withheld name shows as withheld: %v", again)
	}
	if admin := harness.expect("GET", "/api/v1/admin/usernames/confusables?candidate=admin", staffToken, nil, http.StatusOK); len(admin["collisions"].([]any)) == 0 {
		t.Fatalf("system reserved names collide: %v", admin)
	}

	reclaim := map[string]any{"reason": "trademark confirmed", "mode": "ASSIGN_TO_CLAIMANT", "claimantUserId": claimantId}
	notVerified := harness.expect("POST", "/api/v1/admin/users/"+ownerId+"/username/reclaim", staffToken, reclaim, http.StatusUnprocessableEntity, stepUp...)
	if notVerified["code"] != "CLAIMANT_NOT_VERIFIED" {
		t.Fatalf("only verified claimants receive withheld names: %v", notVerified)
	}
	harness.expect("POST", "/api/v1/admin/checkmark-grants", staffToken, map[string]any{"username": "dangote.group", "color": "blue", "reason": "brand owner verified"}, http.StatusCreated, stepUp...)
	detail := harness.expect("POST", "/api/v1/admin/users/"+ownerId+"/username/reclaim", staffToken, reclaim, http.StatusOK, stepUp...)
	if detail["withheldUsername"] != nil || detail["user"].(map[string]any)["username"] != assigned {
		t.Fatalf("the owner keeps the generated name and the hold is gone: %v", detail)
	}
	claimant := harness.expect("GET", "/api/v1/users/"+claimantId, "", nil, http.StatusOK)
	if claimant["username"] != "dangote" {
		t.Fatalf("the claimant now has the name: %v", claimant)
	}
	harness.expect("POST", "/api/v1/admin/users/"+ownerId+"/username/reclaim", staffToken, reclaim, http.StatusConflict, stepUp...)
}

func TestAdminUserListFiltersAndSuspendedSearch(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	plainId, _ := harness.newAccount("plain.user", "Plain")
	creatorId, _ := harness.newAccount("star.creator", "Star")
	harness.expect("GET", "/api/v1/users/"+plainId, "", nil, http.StatusOK)
	harness.expect("GET", "/api/v1/users/"+creatorId, "", nil, http.StatusOK)
	harness.execSql("UPDATE profiles SET creator_status = 'approved' WHERE account_id = $1", creatorId)
	reader, _ := harness.staffHeaders("users:read")
	creators := harness.expect("GET", "/api/v1/admin/users?role=creator", reader, nil, http.StatusOK)["data"].([]any)
	if len(creators) != 1 || creators[0].(map[string]any)["id"] != creatorId {
		t.Fatalf("role=creator lists creators only: %v", creators)
	}
	if unverified := harness.expect("GET", "/api/v1/admin/users?verification=NONE&risk=LOW&status=ACTIVE", reader, nil, http.StatusOK)["data"].([]any); len(unverified) != 2 {
		t.Fatalf("both accounts are unverified, low risk and active: %v", unverified)
	}
	if banned := harness.expect("GET", "/api/v1/admin/users?status=BANNED", reader, nil, http.StatusOK)["data"].([]any); len(banned) != 0 {
		t.Fatalf("no account is banned: %v", banned)
	}
	harness.expect("GET", "/api/v1/admin/users?risk=EXTREME", reader, nil, http.StatusBadRequest)
	suspender, suspenderStepUp := harness.staffHeaders("users:suspend")
	harness.expect("POST", "/api/v1/admin/users/"+creatorId+"/suspend", suspender, map[string]any{"reason": "repeated fraud reports", "durationDays": 7, "reasonCode": "SCAM"}, http.StatusOK, suspenderStepUp...)
	if found := harness.expect("GET", "/api/v1/admin/suspensions/accounts?search=star", suspender, nil, http.StatusOK)["data"].([]any); len(found) != 1 {
		t.Fatalf("search finds the suspended account: %v", found)
	}
	if none := harness.expect("GET", "/api/v1/admin/suspensions/accounts?search=plain", suspender, nil, http.StatusOK)["data"].([]any); len(none) != 0 {
		t.Fatalf("search filters other accounts out: %v", none)
	}
}

func TestVerificationViewListsDocumentsAndStaffOpensThemWithAudit(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("gold.seller", "Gold Seller")
	profileId := harness.profileIdOf(token)
	applicationId := "0192f1a0-0000-7000-8000-0000000000aa"
	harness.execSql(`INSERT INTO verification_applications (id, created_at, profile_id, account_id, color, applicant, document_keys)
		VALUES ($1, now(), $2, $3, 'gold', '{"legalName":"Gold Seller","businessName":"Gold Ltd"}', '["https://media.example.com/cac.jpg"]')`, applicationId, profileId, accountId)
	reviewer, _ := harness.staffHeaders("verification:review")
	viewer, _ := harness.staffHeaders("verification:documents")
	view := harness.expect("GET", "/api/v1/admin/verifications/"+applicationId, reviewer, nil, http.StatusOK)
	documents := view["documents"].([]any)
	applicant := view["applicant"].(map[string]any)
	if len(documents) != 1 || documents[0].(map[string]any)["kind"] != "CAC_CERTIFICATE" || applicant["category"] != "PERSONAL" {
		t.Fatalf("unexpected verification view %v", view)
	}
	if _, present := applicant["agencyName"]; !present {
		t.Fatalf("the applicant carries agencyName: %v", applicant)
	}
	documentPath := "/api/v1/admin/verifications/" + applicationId + "/documents/document-1"
	harness.expect("GET", documentPath, reviewer, nil, http.StatusForbidden)
	harness.expect("GET", "/api/v1/admin/verifications/"+applicationId+"/documents/document-9", viewer, nil, http.StatusNotFound)
	opened := harness.expect("GET", documentPath, viewer, nil, http.StatusOK)
	if opened["viewUrl"] != "https://media.example.com/cac.jpg" || opened["watermarkText"] == "" {
		t.Fatalf("unexpected document access %v", opened)
	}
	if !harness.audit.has("verification.document_viewed") {
		t.Fatalf("opening a document is audited: %v", harness.audit.actions)
	}
}
