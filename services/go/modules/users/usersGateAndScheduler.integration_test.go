package users

import (
	"net/http"
	"testing"
)

func TestPolicyGateReportsUnacceptedMaterialPoliciesPastTheirEffectiveDate(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("gate.person", "Gate Person")
	author, authorStepUp := harness.staff("admin", "legal.documents.view", "legal.documents.edit", "legal.documents.publish", "legal.notices.send")
	publisher, publisherStepUp := harness.staff("admin", "legal.documents.view", "legal.documents.publish")
	gatePath := "/api/v1/internal/accounts/" + accountId + "/policy-gate"
	harness.expect("GET", gatePath, "", nil, http.StatusUnauthorized)
	if gate := harness.expect("GET", gatePath, "", nil, http.StatusOK, internalToken...); gate["acceptanceRequired"] != false {
		t.Fatalf("nothing published yet: %v", gate)
	}
	draft := harness.expect("POST", "/api/v1/admin/legal/documents/terms/versions", author, map[string]any{"bodyMarkdown": "# Terms v2", "changeSummary": "New rules", "isMaterialChange": true, "effectiveAt": "2999-01-01T00:00:00Z"}, http.StatusCreated)
	versionId := draft["id"].(string)
	harness.expect("POST", "/api/v1/admin/legal/versions/"+versionId+"/submit", author, nil, http.StatusOK)
	harness.expect("POST", "/api/v1/admin/legal/versions/"+versionId+"/publish", publisher, map[string]any{"reason": "legal approved", "acknowledgeShortNotice": true}, http.StatusOK, publisherStepUp...)
	_ = authorStepUp
	if gate := harness.expect("GET", gatePath, "", nil, http.StatusOK, internalToken...); gate["acceptanceRequired"] != false {
		t.Fatalf("a future effective date does not gate yet: %v", gate)
	}
	harness.execSql("UPDATE legal_versions SET effective_at = now() - interval '1 hour' WHERE id = $1", mustParseUuid(versionId))
	gate := harness.expect("GET", gatePath, "", nil, http.StatusOK, internalToken...)
	if gate["acceptanceRequired"] != true || gate["documentKeys"].([]any)[0] != "terms" {
		t.Fatalf("a material change past its effective date gates writes: %v", gate)
	}
	harness.expect("PUT", "/api/v1/users/me/consents", token, map[string]any{"policyVersionId": versionId, "consents": map[string]bool{}}, http.StatusOK)
	if gate := harness.expect("GET", gatePath, "", nil, http.StatusOK, internalToken...); gate["acceptanceRequired"] != false {
		t.Fatalf("accepting clears the gate: %v", gate)
	}
}

func TestUserDetailCarriesTheCurrencyOfTheProfileCountry(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("currency.person", "Currency Person")
	harness.expect("PATCH", "/api/v1/users/me/preferences", token, map[string]any{"countryCode": "NG"}, http.StatusNoContent)
	admin, _ := harness.staff("admin", "users:read")
	detail := harness.expect("GET", "/api/v1/admin/users/"+accountId, admin, nil, http.StatusOK)
	user := detail["user"].(map[string]any)
	if user["currency"] != "NGN" || user["country"] != "NG" || len(detail["wallet"].(map[string]any)["balances"].([]any)) != 0 {
		t.Fatalf("unexpected detail %v", user)
	}
}

func TestDailyCheckmarkSuggestionsUseTheAdminThresholdsAndFireOnce(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, eligible := harness.newAccount("suggest.yes", "Suggest Yes")
	_, notYet := harness.newAccount("suggest.no", "Suggest No")
	harness.putSignals(harness.profileIdOf(eligible), map[string]any{"realFollowers": 2500, "idVerified": true, "daysSinceLastViolation": 500})
	harness.putSignals(harness.profileIdOf(notYet), map[string]any{"realFollowers": 10, "idVerified": true, "daysSinceLastViolation": 500})
	harness.expect("GET", "/api/v1/verification/suggestions", eligible, nil, http.StatusOK)
	harness.runSuggestionScheduler()
	harness.runSuggestionScheduler()
	count := 0
	for _, event := range harness.publisher.PublishedEventTypes() {
		if event == "checkmark.suggested" {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("only the eligible profile is suggested, once: %d", count)
	}
}
