package users

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	linkedprofiles "nantty/modules/users/src/modules/linkedProfiles"
)

func TestSellerApplicationsPendingAtDeployAreRegistered(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	catalog := pgx.Identifier{harness.schema + "_catalog"}.Sanitize()
	applications := pgx.Identifier{harness.schema + "_catalog", "seller_applications"}.Sanitize()
	harness.execSql(`CREATE SCHEMA ` + catalog)
	t.Cleanup(func() { harness.execSql(`DROP SCHEMA ` + catalog + ` CASCADE`) })
	harness.execSql(`CREATE TABLE ` + applications + ` (id uuid PRIMARY KEY, account_id uuid NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)

	applicantId, applicantToken := harness.newAccount("pending.applicant", "Applicant")
	pending := uuid.NewString()
	harness.execSql(`INSERT INTO `+applications+` (id, account_id, status) VALUES ($1, $2, 'pending')`, pending, applicantId)
	conflictedId, conflictedToken := harness.newAccount("pending.conflicted", "Conflicted")
	page := harness.expect("POST", "/api/v1/users/me/business-profiles", conflictedToken, businessBody("pending.conflicted.page", "business"), http.StatusCreated)
	conflicted := uuid.NewString()
	harness.execSql(`INSERT INTO `+applications+` (id, account_id, status, created_at) VALUES ($1, $2, 'pending', now() - interval '1 day')`, conflicted, conflictedId)
	rejectedId, rejectedToken := harness.newAccount("pending.rejected", "Rejected")
	harness.execSql(`INSERT INTO `+applications+` (id, account_id, status) VALUES ($1, $2, 'rejected')`, uuid.NewString(), rejectedId)

	report, err := linkedprofiles.BackfillRegistry(context.Background(), harness.module.Container())
	if err != nil || report.Registered != 2 || report.Held != 1 {
		t.Fatalf("both pending applications are registered and the conflicting one is held: %+v %v", report, err)
	}
	if again, _ := linkedprofiles.BackfillRegistry(context.Background(), harness.module.Container()); again.Registered != 0 {
		t.Fatalf("the backfill is idempotent: %+v", again)
	}
	items := harness.linked(applicantToken)["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["profileId"] != pending || items[0].(map[string]any)["status"] != "active" {
		t.Fatalf("a pending application reserves the store slot: %v", items)
	}
	status, body := harness.call("POST", "/api/v1/users/me/business-profiles", applicantToken, businessBody("pending.applicant.page", "business"))
	expectCode(t, status, body, http.StatusConflict, "PROFILE_LIMIT_STORE_OR_BUSINESS")

	statuses := map[string]string{}
	summary := harness.linked(conflictedToken)
	for _, raw := range summary["items"].([]any) {
		item := raw.(map[string]any)
		statuses[item["profileId"].(string)] = item["status"].(string)
	}
	if statuses[page["id"].(string)] != "active" || statuses[conflicted] != "held" || summary["choiceRequired"] != true {
		t.Fatalf("an existing business page wins over an older pending application, which waits for the owner: %v", summary)
	}
	if rejected := harness.linked(rejectedToken)["items"].([]any); len(rejected) != 0 {
		t.Fatalf("decided applications are not registered: %v", rejected)
	}
}
