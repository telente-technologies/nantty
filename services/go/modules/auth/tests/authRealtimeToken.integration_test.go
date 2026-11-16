package auth_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwt"

	"nantty/platform/jwtauth"
)

func TestRealtimeTokenIsShortLivedSocketOnlyAndSessionBound(t *testing.T) {
	refillAuthRateLimitAroundTest(t)
	harness := startAuthModuleAgainstFreshSchema(t)
	registered := harness.registerAccountAndLogIn("realtime.owner@example.com", "realtimepass1")
	access := registered["accessToken"].(string)

	harness.expect("POST", "/api/v1/auth/realtime-token", "", nil, http.StatusUnauthorized)
	issued := harness.expect("POST", "/api/v1/auth/realtime-token", access, nil, http.StatusOK)
	realtime := issued["realtimeToken"].(string)
	if issued["scope"] != jwtauth.RealtimeTokenScope || issued["expiresIn"].(float64) > 120 || issued["expiresIn"].(float64) < 30 {
		t.Fatalf("unexpected realtime grant %v", issued)
	}
	parsed, err := jwt.ParseInsecure([]byte(realtime))
	if err != nil {
		t.Fatal(err)
	}
	audience, _ := parsed.Audience()
	expiresAt, _ := parsed.Expiration()
	var sessionId, scope string
	_ = parsed.Get("sid", &sessionId)
	_ = parsed.Get("scope", &scope)
	if len(audience) != 1 || audience[0] != jwtauth.RealtimeTokenAudience || scope != jwtauth.RealtimeTokenScope || sessionId == "" || time.Until(expiresAt) > 2*time.Minute {
		t.Fatalf("realtime token claims are wrong: aud=%v scope=%q sid=%q exp=%v", audience, scope, sessionId, expiresAt)
	}
	harness.expect("GET", "/api/v1/auth/sessions", realtime, nil, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/auth/realtime-token", realtime, nil, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/auth/widget-token", realtime, nil, http.StatusUnauthorized)
}
