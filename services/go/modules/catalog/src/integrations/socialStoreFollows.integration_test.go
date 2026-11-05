package integrations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	catalogerrors "nantty/modules/catalog/src/errors"
)

func TestSocialStoreFollowsReadsViewerSpecificStateFromSocialService(t *testing.T) {
	storeID := uuid.New()
	viewerID := uuid.New()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet || request.URL.Path != "/api/v1/internal/stores/"+storeID.String()+"/follow-stats" {
			t.Errorf("unexpected request: %s %s", request.Method, request.URL.RequestURI())
			writer.WriteHeader(http.StatusNotFound)
			return
		}
		if request.Header.Get("X-Internal-Token") != "social-internal-token" {
			t.Errorf("missing internal service authentication")
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		if request.URL.Query().Get("viewerId") != viewerID.String() {
			t.Errorf("viewer ID was not forwarded: %q", request.URL.Query().Get("viewerId"))
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"followers":19,"isFollowing":true}`))
	}))
	defer server.Close()

	followers, isFollowing, err := NewSocialStoreFollows(server.URL, "social-internal-token").StoreFollowStats(context.Background(), storeID, &viewerID)
	if err != nil || followers != 19 || !isFollowing {
		t.Fatalf("expected Social state (followers=19, following=true), got (%d, %t)", followers, isFollowing)
	}
}

func TestSocialStoreFollowsWritesAuthenticatedActorThroughInternalRoute(t *testing.T) {
	storeID := uuid.New()
	followerID := uuid.New()
	methods := []string{http.MethodPost, http.MethodDelete}
	for index, method := range methods {
		t.Run(method, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				wantPath := "/api/v1/internal/stores/" + storeID.String() + "/followers/" + followerID.String()
				if request.Method != method || request.URL.Path != wantPath {
					t.Errorf("unexpected request: %s %s", request.Method, request.URL.Path)
					writer.WriteHeader(http.StatusNotFound)
					return
				}
				if request.Header.Get("X-Internal-Token") != "social-internal-token" {
					t.Errorf("missing internal service authentication")
					writer.WriteHeader(http.StatusUnauthorized)
					return
				}
				following := index == 0
				followers := 4
				if following {
					followers = 5
				}
				writer.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(writer).Encode(map[string]any{"storeId": storeID.String(), "isFollowing": following, "followers": followers})
			}))
			defer server.Close()

			followers, isFollowing, err := NewSocialStoreFollows(server.URL, "social-internal-token").SetStoreFollow(context.Background(), storeID, followerID, index == 0)
			wantFollowers := 5 - index
			if err != nil || followers != wantFollowers || isFollowing != (index == 0) {
				t.Fatalf("store follow state = (%d, %t, %v), want (%d, %t, nil)", followers, isFollowing, err, wantFollowers, index == 0)
			}
		})
	}
}

func TestSocialStoreFollowsMapsMutationFailuresWithoutLeakingInternalErrors(t *testing.T) {
	storeID, followerID := uuid.New(), uuid.New()
	tests := []struct {
		name   string
		status int
		body   string
		want   error
	}{
		{name: "store is missing", status: http.StatusNotFound, body: `{"code":"STORE_NOT_FOUND"}`, want: catalogerrors.StoreNotFound},
		{name: "cannot follow own store", status: http.StatusConflict, body: `{"code":"CANNOT_FOLLOW_OWN"}`, want: catalogerrors.CannotFollowOwn},
		{name: "internal credentials rejected", status: http.StatusUnauthorized, body: `{"code":"UNAUTHORIZED"}`, want: catalogerrors.StoreFollowUnavailable},
		{name: "upstream unavailable", status: http.StatusBadGateway, body: `{"code":"UPSTREAM_FAILURE"}`, want: catalogerrors.StoreFollowUnavailable},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.WriteHeader(test.status)
				_, _ = writer.Write([]byte(test.body))
			}))
			defer server.Close()
			_, _, err := NewSocialStoreFollows(server.URL, "token").SetStoreFollow(context.Background(), storeID, followerID, true)
			if err != test.want {
				t.Fatalf("error = %v, want %v", err, test.want)
			}
		})
	}
}

func TestSocialStoreFollowsFailsClosedWhenProjectionUnavailable(t *testing.T) {
	storeID := uuid.New()
	tests := []struct {
		name    string
		service func() SocialStoreFollows
	}{
		{
			name: "missing configuration",
			service: func() SocialStoreFollows {
				return NewSocialStoreFollows("", "token")
			},
		},
		{
			name: "network failure",
			service: func() SocialStoreFollows {
				server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
				server.Close()
				return NewSocialStoreFollows(server.URL, "token")
			},
		},
		{
			name: "non-200 response",
			service: func() SocialStoreFollows {
				server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
					writer.WriteHeader(http.StatusBadGateway)
				}))
				t.Cleanup(server.Close)
				return NewSocialStoreFollows(server.URL, "token")
			},
		},
		{
			name: "malformed response",
			service: func() SocialStoreFollows {
				server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
					writer.Header().Set("Content-Type", "application/json")
					_, _ = writer.Write([]byte(`{"followers":`))
				}))
				t.Cleanup(server.Close)
				return NewSocialStoreFollows(server.URL, "token")
			},
		},
		{
			name: "incomplete response",
			service: func() SocialStoreFollows {
				server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
					_, _ = writer.Write([]byte(`{"followers":0}`))
				}))
				t.Cleanup(server.Close)
				return NewSocialStoreFollows(server.URL, "token")
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			followers, isFollowing, err := test.service().StoreFollowStats(context.Background(), storeID, nil)
			if err != catalogerrors.StoreFollowStatsUnavailable {
				t.Fatalf("expected retryable projection error, got (%d, %t, %v)", followers, isFollowing, err)
			}
		})
	}
}
