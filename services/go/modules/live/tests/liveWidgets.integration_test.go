package live_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwt"

	"nantty/platform/jwtauth"
)

func (harness *liveHarness) widgetTokenFor(user liveUser) liveUser {
	harness.t.Helper()
	now := time.Now()
	token, err := jwt.NewBuilder().Issuer(testIssuer).Audience([]string{jwtauth.WidgetTokenAudience}).Subject(user.id.String()).JwtID(uuid.NewString()).
		IssuedAt(now).Expiration(now.Add(time.Hour)).Claim("sid", uuid.NewString()).Claim("scope", jwtauth.WidgetTokenScope).Build()
	if err != nil {
		harness.t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), harness.signer))
	if err != nil {
		harness.t.Fatal(err)
	}
	return liveUser{id: user.id, token: string(signed)}
}

func TestLiveNowWidgetListsOnlyFollowedHostsTheViewerMayWatch(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	viewer := harness.newUser("viewer")
	followed, blocked, stranger, subscribersOnly := harness.newUser("followed", "creator"), harness.newUser("blocked", "creator"), harness.newUser("stranger", "creator"), harness.newUser("vip", "creator")
	for _, host := range []liveUser{followed, blocked, subscribersOnly} {
		harness.relations.Follow(viewer.id, host.id)
	}
	harness.relations.Block(blocked.id, viewer.id)
	followedLive := harness.goLive(followed, nil)
	harness.goLive(blocked, nil)
	harness.goLive(stranger, nil)
	harness.goLive(subscribersOnly, map[string]any{"visibility": "subscribers"})

	widget := harness.widgetTokenFor(viewer)
	payload := harness.expect("GET", "/api/v1/widgets/live-now", &widget, "", nil, http.StatusOK)
	lives := payload["lives"].([]any)
	if len(lives) != 1 {
		t.Fatalf("expected only the followed, unblocked, watchable live, got %v", lives)
	}
	entry := lives[0].(map[string]any)
	if entry["id"] != followedLive || entry["hostId"] != followed.id.String() || entry["deepLink"] != "nantty://live/"+followedLive {
		t.Fatalf("unexpected widget entry %v", entry)
	}
	harness.expect("GET", "/api/v1/widgets/live-now", &viewer, "", nil, http.StatusOK)
	harness.expect("GET", "/api/v1/widgets/live-now", nil, "", nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/lives/suggested", &widget, "", nil, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/lives", &widget, "", map[string]any{"title": "nope", "category": "gaming"}, http.StatusUnauthorized)
}
