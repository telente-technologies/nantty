package creators

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/creators/src/repositories"
)

func TestCreatorTodayWidgetHidesAmountsAndOnlyAcceptsWidgetScopeOnWidgetRoutes(t *testing.T) {
	creator, fan := uuid.NewString(), uuid.NewString()
	harness := startHttpHarness(t, repositories.StaticCreatorsDirectory{Followers: map[string]int64{creator: 7}})
	harness.makeCreator(creator, "top")
	widgetToken := harness.tokens.UserWidgetToken(creator)

	status, shown := harness.call(http.MethodGet, "/api/v1/widgets/creator-today?currency=NGN", widgetToken, "", nil)
	if status != http.StatusOK || shown["creatorProgramMember"] != true || shown["newFollowersToday"] != float64(7) || shown["earningsToday"] == nil {
		t.Fatalf("widget: %d %v", status, shown)
	}
	status, hidden := harness.call(http.MethodGet, "/api/v1/widgets/creator-today?currency=NGN&amounts=hidden", harness.tokens.UserAccessToken(creator), "", nil)
	if status != http.StatusOK || hidden["earningsToday"] != nil || hidden["amountsHidden"] != true {
		t.Fatalf("hidden amounts must not leave the server: %d %v", status, hidden)
	}
	if _, outsider := harness.call(http.MethodGet, "/api/v1/widgets/creator-today", harness.tokens.UserWidgetToken(fan), "", nil); outsider["creatorProgramMember"] != false || outsider["deepLink"] != "zudomart://creator" {
		t.Fatalf("non-members get an invitation, not data: %v", outsider)
	}
	for _, path := range []string{"/api/v1/creators/dashboard", "/api/v1/creators/earnings", "/api/v1/creators/me"} {
		if status, _ := harness.call(http.MethodGet, path, widgetToken, "", nil); status != http.StatusUnauthorized {
			t.Fatalf("a widget token must not read %s: %d", path, status)
		}
	}
	if status, _ := harness.call(http.MethodPost, "/api/v1/tips", widgetToken, "tip-widget-1", map[string]any{"targetType": "post", "targetId": "p1", "coins": 1}); status != http.StatusUnauthorized {
		t.Fatalf("a widget token must never move money: %d", status)
	}
	if status, _ := harness.call(http.MethodGet, "/api/v1/widgets/creator-today", "", "", nil); status != http.StatusUnauthorized {
		t.Fatalf("anonymous: %d", status)
	}
}
