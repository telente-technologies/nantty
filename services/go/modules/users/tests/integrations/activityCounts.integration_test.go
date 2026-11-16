package integrations_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"nantty/modules/users/src/integrations"
)

func TestActivityCountsReadPostsAndLivesAndTolerateFailures(t *testing.T) {
	social := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("X-Internal-Token") != "s" || !strings.HasSuffix(request.URL.Path, "/activity-counts") {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = writer.Write([]byte(`{"posts":148}`))
	}))
	defer social.Close()
	live := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusInternalServerError) }))
	defer live.Close()
	posts, lives := integrations.NewHttpActivityCounts(social.URL, "s", live.URL, "l").PostsAndLivesLastYear(t.Context(), uuid.New())
	if posts == nil || *posts != 148 || lives != nil {
		t.Fatalf("posts=%v lives=%v", posts, lives)
	}
	posts, lives = integrations.NewHttpActivityCounts("", "", "", "").PostsAndLivesLastYear(t.Context(), uuid.New())
	if posts != nil || lives != nil {
		t.Fatal("unconfigured sources return nothing")
	}
}
