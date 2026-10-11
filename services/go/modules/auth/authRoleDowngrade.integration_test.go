package auth

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
)

func TestRemovingARoleEndsTheAccountsSessionsSoTheOldRoleClaimStopsWorking(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	registered := harness.registerAccountAndLogIn("role.downgrade@example.com", "correct-horse1")
	accountId := uuid.MustParse(registered["user"].(map[string]any)["id"].(string))
	enforcement := harness.enforcement()
	if err := enforcement.SetAccountRole(context.Background(), accountId, "seller", true); err != nil {
		t.Fatal(err)
	}
	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": registered["refreshToken"].(string)}, http.StatusOK)
	signedIn := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": "role.downgrade@example.com", "password": "correct-horse1"}, http.StatusOK)
	if err := enforcement.SetAccountRole(context.Background(), accountId, "seller", false); err != nil {
		t.Fatal(err)
	}
	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": signedIn["refreshToken"].(string)}, http.StatusUnauthorized)
}
