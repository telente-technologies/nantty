package ads_test

import (
	"net/http"
	"testing"
)

func TestInvitesAcceptAnEmailOrAUsernameAndExplainMisses(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	owner := h.newUser("invite-owner")
	h.newUser("invite-by-name")
	h.newUser("invite-by-mail")
	base := "/api/v1/ads/accounts/" + createAccount(h, &owner, "invite-account") + "/invites"

	byName := h.expect("POST", base, &owner, "", map[string]any{"username": "@invite-by-name", "role": "analyst"}, http.StatusCreated)
	if byName["username"] != "invite-by-name" {
		t.Fatalf("invite by username: %v", byName)
	}
	byMail := h.expect("POST", base, &owner, "", map[string]any{"email": "Invite-By-Mail@example.test", "role": "advertiser"}, http.StatusCreated)
	if byMail["username"] != "invite-by-mail" {
		t.Fatalf("invite by email: %v", byMail)
	}
	h.expect("POST", base, &owner, "", map[string]any{"username": "invite-by-mail@example.test", "role": "analyst"}, http.StatusBadRequest)

	cases := []map[string]any{
		{"email": "nobody@example.test", "role": "analyst"},
		{"email": "not-an-email", "role": "analyst"},
		{"email": "a@example.test", "username": "a", "role": "analyst"},
		{"role": "analyst"},
	}
	for _, body := range cases {
		status, decoded := h.call("POST", base, &owner, "", body)
		if status != http.StatusUnprocessableEntity && status != http.StatusBadRequest {
			t.Fatalf("%v = %d %v, want a validation error", body, status, decoded)
		}
		if decoded["message"] == nil {
			t.Fatalf("%v: no message in %v", body, decoded)
		}
	}
}
