package users

import (
	"net/http"
	"strings"
	"testing"
)

var internalToken = []string{"X-Internal-Token", strings.Repeat("u", 32)}

func (harness *usersTestHarness) profileIdOf(token string) string {
	harness.t.Helper()
	profiles := harness.expect("GET", "/api/v1/users/me/profiles", token, nil, http.StatusOK)["data"].([]any)
	return profiles[0].(map[string]any)["id"].(string)
}

func (harness *usersTestHarness) putSignals(profileId string, signals map[string]any) {
	harness.t.Helper()
	harness.expect("PUT", "/api/v1/internal/profiles/"+profileId+"/signals", "", signals, http.StatusNoContent, internalToken...)
}

func TestCreatorProgramDecisionsFollowTheAdminThresholds(t *testing.T) {
	cases := []struct {
		name         string
		signals      map[string]any
		wantDecision string
		wantStatus   string
	}{
		{"every threshold met is approved automatically", map[string]any{"realFollowers": 1500, "originalPostsLast60Days": 12, "daysSinceLastViolation": 400, "fraudScore": 10}, "auto_approve", "approved"},
		{"500 to 999 followers goes to manual review", map[string]any{"realFollowers": 700, "originalPostsLast60Days": 12, "daysSinceLastViolation": 400, "riskScore": 20}, "manual_review", "pending"},
		{"a high fraud score with enough followers goes to review", map[string]any{"realFollowers": 1500, "originalPostsLast60Days": 12, "daysSinceLastViolation": 400, "fraudScore": 55, "riskScore": 40}, "manual_review", "pending"},
		{"under 500 followers is not eligible", map[string]any{"realFollowers": 120}, "not_eligible", "rejected"},
		{"a risk score above the review limit is not eligible", map[string]any{"realFollowers": 900, "riskScore": 80}, "not_eligible", "rejected"},
	}
	for index, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			harness := startUsersModuleAgainstFreshSchema(t)
			username := "creator.case" + string(rune('a'+index))
			_, token := harness.newAccount(username, "Creator Case")
			harness.putSignals(harness.profileIdOf(token), testCase.signals)
			eligibility := harness.expect("GET", "/api/v1/creators/eligibility", token, nil, http.StatusOK)
			if eligibility["decision"] != testCase.wantDecision || len(eligibility["requirements"].([]any)) != 4 {
				t.Fatalf("unexpected eligibility %v", eligibility)
			}
			application := harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{
				"contentCategories": []string{"tech"}, "socialLinks": []any{}, "sampleContentUrls": []string{}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1",
			}, http.StatusCreated)
			if application["status"] != testCase.wantStatus {
				t.Fatalf("unexpected application %v", application)
			}
			if testCase.wantStatus == "rejected" {
				if application["reapplyAvailableAt"] == nil || application["rejectionReason"] == nil {
					t.Fatalf("a rejected application explains why and when to try again: %v", application)
				}
				harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{"contentCategories": []string{"tech"}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1"}, http.StatusConflict)
			}
			me := harness.expect("GET", "/api/v1/users/me", token, nil, http.StatusOK)
			if (me["creatorStatus"] == "approved") != (testCase.wantStatus == "approved") {
				t.Fatalf("creator status lives on the personal profile: %v", me)
			}
		})
	}
}

func TestCreatorApplicationNeedsInputAndAdminReviewQueueDecides(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("review.me", "Review Me")
	harness.putSignals(harness.profileIdOf(token), map[string]any{"realFollowers": 650, "daysSinceLastViolation": 400})
	harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{"contentCategories": []string{}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1"}, http.StatusUnprocessableEntity)
	harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{"contentCategories": []string{"tech"}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1"}, http.StatusCreated)
	harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{"contentCategories": []string{"tech"}, "payoutAccountId": "pa_1", "acceptedCreatorTermsVersion": "1"}, http.StatusConflict)

	reviewer, _ := harness.staff("admin", "applications:creators")
	denied, _ := harness.staff("admin", "users:read")
	harness.expect("GET", "/api/v1/admin/applications/creators", denied, nil, http.StatusForbidden)
	queue := harness.expect("GET", "/api/v1/admin/applications/creators", reviewer, nil, http.StatusOK)["data"].([]any)
	if len(queue) != 1 || queue[0].(map[string]any)["status"] != "PENDING" || len(queue[0].(map[string]any)["eligibility"].([]any)) != 4 {
		t.Fatalf("the review queue shows the checklist: %v", queue)
	}
	id := queue[0].(map[string]any)["id"].(string)
	harness.expect("POST", "/api/v1/admin/applications/creators/"+id+"/approve", reviewer, map[string]string{"reason": "ok"}, http.StatusBadRequest)
	approved := harness.expect("POST", "/api/v1/admin/applications/creators/"+id+"/approve", reviewer, map[string]string{"reason": "checked content and followers"}, http.StatusOK)
	if approved["status"] != "APPROVED" {
		t.Fatalf("unexpected %v", approved)
	}
	harness.expect("POST", "/api/v1/admin/applications/creators/"+id+"/reject", reviewer, map[string]string{"reason": "changed my mind"}, http.StatusConflict)
	if me := harness.expect("GET", "/api/v1/users/me", token, nil, http.StatusOK); me["isCreator"] != true {
		t.Fatalf("approval turns the personal profile into a creator account: %v", me)
	}
	harness.waitForPublishedEvents("creatorApplication.needsReview", "creatorApplication.approved", "creatorApplication.decided")
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

	reviewer, _ := harness.staff("admin", "verification:review", "verification:revoke", "verification:grant", "users:read")
	pending := harness.expect("GET", "/api/v1/admin/verifications", reviewer, nil, http.StatusOK)["data"].([]any)
	if len(pending) != 1 || pending[0].(map[string]any)["color"] != "BLUE" || pending[0].(map[string]any)["subjectKind"] != "PERSON" {
		t.Fatalf("unexpected queue %v", pending)
	}
	verificationId := pending[0].(map[string]any)["id"].(string)
	approved := harness.expect("POST", "/api/v1/admin/verifications/"+verificationId+"/approve", reviewer, map[string]string{"reason": "identity verified"}, http.StatusOK)
	if approved["status"] != "VERIFIED" {
		t.Fatalf("unexpected %v", approved)
	}
	harness.expect("POST", "/api/v1/admin/verifications/"+verificationId+"/approve", reviewer, map[string]string{"reason": "identity verified"}, http.StatusConflict)
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
	_, token := harness.newAccount("agency.owner", "Agency Owner")
	gov := harness.expect("POST", "/api/v1/users/me/business-profiles", token, map[string]any{
		"displayName": "Federal Agency", "handle": "northern.records.office", "description": "Official", "businessType": "government", "categories": []map[string]any{{"customName": "Government"}},
	}, http.StatusCreated)
	harness.expect("PUT", "/api/v1/users/me/acting-profile", token, map[string]string{"profileId": gov["id"].(string)}, http.StatusOK)
	harness.expect("POST", "/api/v1/verification/black-applications", token, map[string]any{"agencyName": "A", "representativeName": "", "representativeRole": ""}, http.StatusBadRequest)
	created := harness.expect("POST", "/api/v1/verification/black-applications", token, map[string]any{"agencyName": "Federal Agency", "representativeName": "Ada Officer", "representativeRole": "Director"}, http.StatusCreated)
	if created["applicationId"] == nil {
		t.Fatalf("unexpected %v", created)
	}
	harness.expect("POST", "/api/v1/verification/black-applications", token, map[string]any{"agencyName": "Federal Agency", "representativeName": "Ada Officer", "representativeRole": "Director"}, http.StatusConflict)
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
	if done["status"] != "APPROVED" || done["handleReserved"] != true || done["reverificationDueAt"] == nil {
		t.Fatalf("two approvals grant Black, reserve the handle and set the yearly re-verification: %v", done)
	}
	if mine := harness.expect("GET", "/api/v1/verification/me", token, nil, http.StatusOK); mine["current"].(map[string]any)["color"] != "black" || mine["handleReserved"] != true {
		t.Fatalf("unexpected %v", mine)
	}
	harness.expect("POST", base+"/reverification-reminder", first, nil, http.StatusOK)
	revoked := harness.expect("POST", base+"/revoke", first, map[string]string{"reason": "misuse of the badge"}, http.StatusOK, firstStepUp...)
	if revoked["status"] != "REVOKED" || revoked["handleReserved"] != true {
		t.Fatalf("revoking keeps the handle reserved: %v", revoked)
	}
	harness.waitForPublishedEvents("checkmark.approved", "checkmark.revoked", "blackApplication.reverificationDue")
}
