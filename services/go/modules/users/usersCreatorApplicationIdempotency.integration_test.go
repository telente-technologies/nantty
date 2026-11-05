package users

import (
	"net/http"
	"testing"
)

func TestCreatorApplicationSubmissionRequiresValidIdempotencyKey(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("creator.idempotency.required", "Creator Idempotency")

	missing := harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{"contentCategories": []string{"tech"}, "acceptedCreatorTermsVersion": "1"}, http.StatusBadRequest)
	if missing["code"] != "IDEMPOTENCY_KEY_REQUIRED" {
		t.Fatalf("missing key should use the standard required-key response: %v", missing)
	}
	invalid := harness.expect("POST", "/api/v1/creators/applications", token, map[string]any{"contentCategories": []string{"tech"}, "acceptedCreatorTermsVersion": "1"}, http.StatusBadRequest, "Idempotency-Key", "short")
	if invalid["code"] != "IDEMPOTENCY_KEY_REQUIRED" {
		t.Fatalf("invalid key should use the standard required-key response: %v", invalid)
	}
}

func TestCreatorApplicationSubmissionReplaysByAccountAndRejectsPayloadMismatch(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("creator.idempotency.owner", "Creator Idempotency Owner")
	_, otherToken := harness.newAccount("creator.idempotency.other", "Creator Idempotency Other")
	key := "creator-submit-key-0001"
	input := map[string]any{
		"contentCategories": []string{"tech"}, "socialLinks": []any{}, "sampleContentUrls": []string{},
		"payoutAccountId": "pa_creator", "acceptedCreatorTermsVersion": "2026-09",
	}

	created := harness.expect("POST", "/api/v1/creators/applications", token, input, http.StatusCreated, "Idempotency-Key", key)
	replayed := harness.expect("POST", "/api/v1/creators/applications", token, input, http.StatusCreated, "Idempotency-Key", key)
	if replayed["id"] != created["id"] {
		t.Fatalf("same account, key, and payload must replay the original application: created=%v replayed=%v", created, replayed)
	}

	changed := map[string]any{
		"contentCategories": []string{"fashion"}, "socialLinks": []any{}, "sampleContentUrls": []string{},
		"payoutAccountId": "pa_creator", "acceptedCreatorTermsVersion": "2026-09",
	}
	conflict := harness.expect("POST", "/api/v1/creators/applications", token, changed, http.StatusConflict, "Idempotency-Key", key)
	if conflict["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("same key with a different payload must conflict: %v", conflict)
	}

	// Keys are scoped to the authenticated account, not globally across users.
	other := harness.expect("POST", "/api/v1/creators/applications", otherToken, input, http.StatusCreated, "Idempotency-Key", key)
	if other["id"] == created["id"] {
		t.Fatalf("another account must not replay this account's application: %v", other)
	}
}
