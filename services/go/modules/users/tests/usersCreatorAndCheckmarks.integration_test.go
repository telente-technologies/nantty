package users_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	applyentitlement "nantty/modules/users/src/modules/checkmarks/commands/applyEntitlement"
	checkmarkservices "nantty/modules/users/src/modules/checkmarks/services"
)

var internalToken = []string{"X-Internal-Token", strings.Repeat("u", 32)}

func (harness *usersTestHarness) profileIdOf(token string) string {
	harness.t.Helper()
	profiles := harness.expect("GET", "/api/v1/users/me/profiles", token, nil, http.StatusOK)["data"].([]any)
	return profiles[0].(map[string]any)["id"].(string)
}

func (harness *usersTestHarness) putSignals(profileId string, signals map[string]any) {
	harness.t.Helper()
	headers := append([]string{}, internalToken...)
	if _, exists := signals["daysSinceLastViolation"]; exists {
		signals["creatorStandingSnapshotId"] = uuid.NewString()
		signals["creatorStandingSource"] = "moderation_creator_standing_v1"
		signals["creatorStandingAsOf"] = time.Now().UTC().Format(time.RFC3339Nano)
		headers = append(headers, "X-Creator-Standing-Token", strings.Repeat("s", 32))
	}
	harness.expect("PUT", "/api/v1/internal/profiles/"+profileId+"/signals", "", signals, http.StatusNoContent, headers...)
}

func (harness *usersTestHarness) putCreatorMetrics(profileId string, realFollowers, verifiedFollowers, impressions int) {
	harness.t.Helper()
	payload := map[string]any{"realFollowers": realFollowers, "verifiedFollowers": verifiedFollowers, "qualifyingImpressionsLast30Days": impressions, "originalPostsLast60Days": 12, "creatorMetricsSnapshotId": uuid.NewString(), "creatorMetricsAsOf": time.Now().UTC().Format(time.RFC3339Nano), "source": "analytics_creator_eligibility_v1"}
	harness.expect("PUT", "/api/v1/internal/profiles/"+profileId+"/signals", "", payload, http.StatusNoContent, "X-Internal-Token", strings.Repeat("u", 32), "X-Creator-Metrics-Token", strings.Repeat("c", 32))
}

func TestCheckmarkRulesFollowTheProfileTypeAndLifetimeGrantsRespectThem(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, personalToken := harness.newAccount("blue.person", "Blue Person")
	profileId := harness.profileIdOf(personalToken)
	harness.putSignals(profileId, map[string]any{"realFollowers": 2000, "idVerified": true, "daysSinceLastViolation": 500})

	harness.expect("GET", "/api/v1/verification/suggestions", personalToken, nil, http.StatusOK)
	harness.expect("POST", "/api/v1/verification/suggestions/blue/dismiss", personalToken, nil, http.StatusNoContent)
	harness.expect("POST", "/api/v1/verification/suggestions/black/dismiss", personalToken, nil, http.StatusNotFound)
	harness.expect("POST", "/api/v1/verification/applications", personalToken, map[string]any{"kind": "gold", "planId": "p", "businessName": "X"}, http.StatusBadRequest)
	applied := harness.expect("POST", "/api/v1/verification/applications", personalToken, map[string]any{
		"kind": "blue", "planId": "plan_blue", "legalName": "Blue Person", "identityDocument": map[string]any{"documentType": "passport", "documentNumber": "A1234567", "documentPhotoUrl": "https://x.test/a.png"}, "selfiePhotoUrl": "https://x.test/s.png",
	}, http.StatusCreated)
	if applied["applicationId"] == nil {
		t.Fatalf("unexpected %v", applied)
	}
	harness.expect("POST", "/api/v1/verification/applications", personalToken, map[string]any{"kind": "blue", "planId": "plan_blue", "legalName": "Blue Person"}, http.StatusConflict)

	reviewer, reviewerStepUp := harness.staff("admin", "verification:review", "verification:revoke", "verification:grant", "users:read")
	pending := harness.expect("GET", "/api/v1/admin/verifications", reviewer, nil, http.StatusOK)["data"].([]any)
	if len(pending) != 1 || pending[0].(map[string]any)["color"] != "BLUE" || pending[0].(map[string]any)["subjectKind"] != "PERSON" {
		t.Fatalf("unexpected queue %v", pending)
	}
	verificationId := pending[0].(map[string]any)["id"].(string)
	approved := harness.expect("POST", "/api/v1/admin/verifications/"+verificationId+"/approve", reviewer, map[string]string{"reason": "identity verified"}, http.StatusOK, reviewerStepUp...)
	if approved["status"] != "VERIFIED" {
		t.Fatalf("unexpected %v", approved)
	}
	harness.expect("POST", "/api/v1/admin/verifications/"+verificationId+"/approve", reviewer, map[string]string{"reason": "identity verified"}, http.StatusConflict, reviewerStepUp...)
	mine := harness.expect("GET", "/api/v1/verification/me", personalToken, nil, http.StatusOK)
	if mine["current"].(map[string]any)["color"] != "blue" || mine["current"].(map[string]any)["badgeVisible"] != true {
		t.Fatalf("a personal profile only ever gets blue: %v", mine)
	}
	harness.expect("POST", "/api/v1/admin/verifications/"+verificationId+"/revoke", reviewer, map[string]string{"reason": "impersonation found"}, http.StatusForbidden)

	harness.expect("POST", "/api/v1/admin/checkmark-grants", reviewer, map[string]any{"username": "blue.person", "color": "gold", "reason": "wrong colour"}, http.StatusForbidden)
	_, otherToken := harness.newAccount("other.person", "Other Person")
	harness.expect("GET", "/api/v1/users/me", otherToken, nil, http.StatusOK)
	superadmin, superadminStepUp := harness.staff("superadmin")
	reviewerAccess, reviewerStepUp := harness.staff("admin", "verification:grant")
	harness.expect("POST", "/api/v1/admin/checkmark-grants", reviewerAccess, map[string]any{"username": "other.person", "color": "gold", "reason": "wrong colour for a person"}, http.StatusBadRequest, reviewerStepUp...)
	black := harness.expect("POST", "/api/v1/admin/checkmark-grants", reviewerAccess, map[string]any{"username": "other.person", "color": "black", "reason": "not for a person"}, http.StatusForbidden, reviewerStepUp...)
	if black["code"] != "BLACK_ADMIN_ONLY" {
		t.Fatalf("unexpected %v", black)
	}
	grant := harness.expect("POST", "/api/v1/admin/checkmark-grants", reviewerAccess, map[string]any{"username": "other.person", "color": "blue", "reason": "partner programme"}, http.StatusCreated, reviewerStepUp...)
	harness.expect("POST", "/api/v1/admin/checkmark-grants", reviewerAccess, map[string]any{"username": "other.person", "color": "blue", "reason": "partner programme"}, http.StatusConflict, reviewerStepUp...)
	harness.expect("POST", "/api/v1/admin/checkmark-grants/"+grant["id"].(string)+"/revoke", superadmin, map[string]string{"reason": "partnership ended"}, http.StatusForbidden)
	harness.expect("POST", "/api/v1/admin/checkmark-grants/"+grant["id"].(string)+"/revoke", superadmin, map[string]string{"reason": "partnership ended"}, http.StatusOK, superadminStepUp...)
	harness.expect("POST", "/api/v1/admin/checkmark-grants/"+grant["id"].(string)+"/revoke", superadmin, map[string]string{"reason": "partnership ended"}, http.StatusConflict, superadminStepUp...)
	harness.waitForPublishedEvents("checkmark.applicationSubmitted", "checkmark.approved", "profileCheckmark.changed")
}

func TestGovernmentBlackNeedsTwoDifferentAdminsAndKeepsTheHandleWhenRevoked(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("agency.owner", "Agency Owner")
	gov := harness.expect("POST", "/api/v1/users/me/business-profiles", token, map[string]any{
		"displayName": "Federal Agency", "handle": "northern.records.office", "description": "Official", "businessType": "government", "categories": []map[string]any{{"customName": "Government"}},
	}, http.StatusCreated)
	govId := gov["id"].(string)
	harness.expect("PUT", "/api/v1/users/me/acting-profile", token, map[string]string{"profileId": govId}, http.StatusOK)
	harness.expect("POST", "/api/v1/verification/black-applications", token, map[string]any{"agencyName": "A", "representativeName": "", "representativeRole": ""}, http.StatusBadRequest)
	created := harness.expect("POST", "/api/v1/verification/black-applications", token, map[string]any{
		"agencyName": "Federal Agency", "legalIdentityName": "Federal Agency of Records", "legalRegistrationRef": "REG-NG-01",
		"jurisdictionCountryCode": "NG", "officialWebsite": "https://records.gov.ng", "officialContactPhone": "+2348000000001",
		"institutionalEmail": "admin@records.gov.ng", "representativeName": "Ada Officer", "representativeRole": "Director",
		"representativeEmail": "ada@records.gov.ng", "evidenceNotes": "Official gazette filing",
	}, http.StatusCreated)
	if created["applicationId"] == nil {
		t.Fatalf("unexpected %v", created)
	}
	appId := created["applicationId"].(string)
	harness.expect("POST", "/api/v1/verification/black-applications", token, map[string]any{
		"agencyName": "Federal Agency", "jurisdictionCountryCode": "NG", "institutionalEmail": "admin@records.gov.ng",
		"representativeName": "Ada Officer", "representativeRole": "Director",
	}, http.StatusConflict)
	harness.expect("GET", "/api/v1/verification/suggestions", token, nil, http.StatusOK)

	first, firstStepUp := harness.staff("admin", "verification:review", "verification:revoke", "users:read")
	second, secondStepUp := harness.staff("admin", "verification:review", "verification:revoke", "users:read")
	list := harness.expect("GET", "/api/v1/admin/black-applications", first, nil, http.StatusOK)["data"].([]any)
	if len(list) != 1 || len(list[0].(map[string]any)["checklist"].([]any)) != 4 {
		t.Fatalf("unexpected list %v", list)
	}
	id := list[0].(map[string]any)["id"].(string)
	base := "/api/v1/admin/black-applications/" + id
	approve := map[string]string{"reason": "vetting complete and documents match"}
	emailUnverified := harness.expect("POST", base+"/approve", first, approve, http.StatusConflict, firstStepUp...)
	if emailUnverified["code"] != "INSTITUTIONAL_EMAIL_NOT_VERIFIED" {
		t.Fatalf("must require institutional email OTP before approval: %v", emailUnverified)
	}
	otpCode, _, err := checkmarkservices.IssueInstitutionalEmailOtp(context.Background(), harness.module.Container(), uuid.MustParse(appId), uuid.MustParse(accountId), "admin@records.gov.ng")
	if err != nil {
		t.Fatalf("issue otp: %v", err)
	}
	verified := harness.expect("POST", "/api/v1/verification/black-applications/"+appId+"/email/verify", token, map[string]string{"code": otpCode}, http.StatusOK)
	if verified["institutionalEmailVerified"] != true || verified["status"] != "IN_REVIEW" {
		t.Fatalf("expected verified email to advance to IN_REVIEW only: %v", verified)
	}
	incomplete := harness.expect("POST", base+"/approve", first, approve, http.StatusConflict, firstStepUp...)
	if incomplete["code"] != "CHECKLIST_INCOMPLETE" {
		t.Fatalf("unexpected %v", incomplete)
	}
	for _, key := range []string{"LETTERHEAD_LETTER", "OFFICIAL_CHANNEL", "REPRESENTATIVE", "ENTITY_PROOF"} {
		harness.expect("POST", base+"/checklist", first, map[string]any{"key": key, "isVerified": true, "note": "checked"}, http.StatusOK)
	}
	harness.expect("POST", base+"/checklist", first, map[string]any{"key": "NOT_A_KEY", "isVerified": true}, http.StatusBadRequest)
	harness.expect("POST", base+"/approve", first, approve, http.StatusForbidden)
	awaiting := harness.expect("POST", base+"/approve", first, approve, http.StatusOK, firstStepUp...)
	if awaiting["status"] != "AWAITING_SECOND_APPROVAL" {
		t.Fatalf("unexpected %v", awaiting)
	}
	sameAdmin := harness.expect("POST", base+"/approve", first, approve, http.StatusConflict, firstStepUp...)
	if sameAdmin["code"] != "SAME_ADMIN" {
		t.Fatalf("unexpected %v", sameAdmin)
	}
	done := harness.expect("POST", base+"/approve", second, approve, http.StatusOK, secondStepUp...)
	if done["status"] != "APPROVED" || done["handleReserved"] != true || done["reverificationDueAt"] == nil || done["privateCheckoutEnabled"] != true {
		t.Fatalf("two approvals authorize private checkout, reserve the handle and set yearly re-verification: %v", done)
	}
	// Approval alone must NOT make the Black badge visible before paid USD subscription settlement.
	if mine := harness.expect("GET", "/api/v1/verification/me", token, nil, http.StatusOK); mine["current"].(map[string]any)["badgeVisible"] != false || mine["handleReserved"] != true {
		t.Fatalf("badge must remain hidden until payment activates entitlement: %v", mine)
	}
	// Entitlement grant activates the visible badge, and pause hides it without revoking verification.
	if err := (applyentitlement.Handler{Container: harness.module.Container()}).Execute(context.Background(), applyentitlement.Command{
		EventType: "entitlement.granted", ProfileId: govId, Plan: "black", Checkmark: "black",
	}); err != nil {
		t.Fatalf("entitlement.granted: %v", err)
	}
	if active := harness.expect("GET", "/api/v1/verification/me", token, nil, http.StatusOK); active["current"].(map[string]any)["badgeVisible"] != true || active["current"].(map[string]any)["color"] != "black" {
		t.Fatalf("entitlement.granted must show black badge for approved org: %v", active)
	}
	if err := (applyentitlement.Handler{Container: harness.module.Container()}).Execute(context.Background(), applyentitlement.Command{
		EventType: "entitlement.paused", ProfileId: govId, Plan: "black", Checkmark: "black",
	}); err != nil {
		t.Fatalf("entitlement.paused: %v", err)
	}
	if paused := harness.expect("GET", "/api/v1/verification/me", token, nil, http.StatusOK); paused["current"].(map[string]any)["badgeVisible"] != false || paused["current"].(map[string]any)["status"] != "paused" {
		t.Fatalf("entitlement.paused must hide badge while keeping approval: %v", paused)
	}
	harness.expect("POST", base+"/reverification-reminder", first, nil, http.StatusOK)
	revoked := harness.expect("POST", base+"/revoke", first, map[string]string{"reason": "misuse of the badge"}, http.StatusOK, firstStepUp...)
	if revoked["status"] != "REVOKED" || revoked["handleReserved"] != true {
		t.Fatalf("revoking keeps the handle reserved: %v", revoked)
	}
	appeal := harness.expect("POST", "/api/v1/verification/black-applications/"+appId+"/appeals", token, map[string]string{
		"reason": "Updated ministry documentation attached", "supportingDetails": "Official gazette #992",
	}, http.StatusCreated)
	appeals := harness.expect("GET", "/api/v1/admin/black-applications/appeals", first, nil, http.StatusOK)["data"].([]any)
	if len(appeals) != 1 {
		t.Fatalf("expected appeal in admin list: %v", appeals)
	}
	decided := harness.expect("POST", "/api/v1/admin/black-applications/appeals/"+appeal["id"].(string)+"/decide", second, map[string]string{
		"decision": "overturned", "note": "Reopened for second verification check",
	}, http.StatusOK, secondStepUp...)
	if decided["status"] != "overturned" {
		t.Fatalf("expected appeal decision to be overturned: %v", decided)
	}
	reopened := harness.expect("GET", "/api/v1/admin/black-applications", first, nil, http.StatusOK)["data"].([]any)
	if len(reopened) != 1 || reopened[0].(map[string]any)["status"] != "IN_REVIEW" {
		t.Fatalf("expected overturned appeal to reopen application to IN_REVIEW: %v", reopened)
	}
	harness.waitForPublishedEvents("checkmark.approved", "checkmark.revoked", "blackApplication.reverificationDue")
}
