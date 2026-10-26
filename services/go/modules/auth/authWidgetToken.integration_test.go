package auth

import (
	"context"
	"net/http"
	"testing"
	"time"

	"nantty/modules/auth/src/configs"
	"nantty/platform/jwtauth"
)

func widgetTokenVerifierForHarness(t *testing.T, harness *authTestHarness) *jwtauth.AccessTokenVerifier {
	t.Helper()
	verifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(context.Background(), harness.server.URL+"/.well-known/jwks.json", harness.settings.TokenIssuer, harness.settings.TokenAudience)
	if err != nil {
		t.Fatal(err)
	}
	return verifier
}

func TestWidgetTokenIsScopedRotatedAndDiesWithTheSession(t *testing.T) {
	registerValkeyDenylistForTest(t)
	refillAuthRateLimitAroundTest(t)
	harness := startAuthModuleAgainstFreshSchema(t, func(settings *configs.AuthSettings) { settings.WidgetTokenTimeToLive = 24 * time.Hour })
	verifier := widgetTokenVerifierForHarness(t, harness)
	ctx := context.Background()
	email := "widget.owner@example.com"
	registered := harness.registerAccountAndLogIn(email, "widgetpass1")
	access := registered["accessToken"].(string)
	widgetPasses := func(token string) bool {
		_, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, token)
		return err == nil
	}

	harness.expect("POST", "/api/v1/auth/widget-token", "", nil, http.StatusUnauthorized)
	issued := harness.expect("POST", "/api/v1/auth/widget-token", access, nil, http.StatusOK)
	first := issued["widgetToken"].(string)
	if issued["expiresIn"].(float64) != 86400 || issued["scope"] != jwtauth.WidgetTokenScope || !widgetPasses(first) {
		t.Fatalf("unexpected widget token grant %v", issued)
	}
	if _, err := verifier.VerifyAccessTokenAndExtractPrincipal(ctx, first); err == nil {
		t.Fatal("a widget token must never pass as a session access token")
	}
	harness.expect("GET", "/api/v1/auth/sessions", first, nil, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/auth/widget-token", first, nil, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/auth/step-up", first, map[string]string{"password": "widgetpass1"}, http.StatusUnauthorized)

	second := harness.expect("POST", "/api/v1/auth/widget-token", access, nil, http.StatusOK)["widgetToken"].(string)
	if widgetPasses(first) || !widgetPasses(second) {
		t.Fatal("rotating must invalidate the previous widget token for this device")
	}
	harness.expect("DELETE", "/api/v1/auth/widget-token", access, nil, http.StatusNoContent)
	if widgetPasses(second) {
		t.Fatal("a revoked widget token must fail")
	}

	third := harness.expect("POST", "/api/v1/auth/widget-token", access, nil, http.StatusOK)["widgetToken"].(string)
	other := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "widgetpass1"}, http.StatusOK)["accessToken"].(string)
	otherWidget := harness.expect("POST", "/api/v1/auth/widget-token", other, nil, http.StatusOK)["widgetToken"].(string)
	if !widgetPasses(third) || !widgetPasses(otherWidget) {
		t.Fatal("each device keeps its own widget token")
	}
	harness.expect("POST", "/api/v1/auth/logout", access, nil, http.StatusNoContent)
	if widgetPasses(third) {
		t.Fatal("signing out must kill this device's widget token")
	}
	if !widgetPasses(otherWidget) {
		t.Fatal("signing out one device must not touch another device's widget")
	}
	harness.expect("DELETE", "/api/v1/auth/sessions", other, nil, http.StatusNoContent)
	if !widgetPasses(otherWidget) {
		t.Fatal("revoking other devices keeps the current device's widget")
	}
	harness.expect("POST", "/api/v1/auth/logout", other, nil, http.StatusNoContent)
	if widgetPasses(otherWidget) {
		t.Fatal("revoking the device must kill its widget token")
	}
}
