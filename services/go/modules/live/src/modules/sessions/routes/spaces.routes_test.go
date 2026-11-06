package routes

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"nantty/modules/live/src/container"
)

func TestSpaceMutationRoutesRejectUnauthenticatedRequests(t *testing.T) {
	mux := http.NewServeMux()
	MountSessionsRoutes(mux, &container.Container{})
	for _, path := range []string{
		"/api/v1/spaces",
		"/api/v1/spaces/00000000-0000-0000-0000-000000000001/start",
		"/api/v1/spaces/00000000-0000-0000-0000-000000000001/end",
		"/api/v1/spaces/00000000-0000-0000-0000-000000000001/cancel",
		"/api/v1/spaces/00000000-0000-0000-0000-000000000001/join",
		"/api/v1/spaces/00000000-0000-0000-0000-000000000001/invites",
		"/api/v1/spaces/00000000-0000-0000-0000-000000000001/invites/00000000-0000-0000-0000-000000000002/accept",
		"/api/v1/spaces/00000000-0000-0000-0000-000000000001/invites/00000000-0000-0000-0000-000000000002/decline",
		"/api/v1/spaces/00000000-0000-0000-0000-000000000001/announcement",
		"/api/v1/spaces/00000000-0000-0000-0000-000000000001/leave",
		"/api/v1/spaces/00000000-0000-0000-0000-000000000001/speaker-requests",
		"/api/v1/spaces/00000000-0000-0000-0000-000000000001/speaker-requests/00000000-0000-0000-0000-000000000002/approve",
	} {
		t.Run(path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, path, nil))
			if recorder.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want %d; body: %s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
			}
		})
	}
}

func TestPendingSpaceInvitationRouteRejectsUnauthenticatedRequests(t *testing.T) {
	mux := http.NewServeMux()
	MountSessionsRoutes(mux, &container.Container{})
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/spaces/invitations", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
}

func TestSpaceGiftCatalogRouteIsRetired(t *testing.T) {
	mux := http.NewServeMux()
	MountSessionsRoutes(mux, &container.Container{})
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/spaces/00000000-0000-0000-0000-000000000001/gifts", nil))
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; Space contributions use amount-only coin donations", recorder.Code, http.StatusNotFound)
	}
}

func TestSpaceCoinDonationSettingsRouteRejectsUnauthenticatedRequests(t *testing.T) {
	mux := http.NewServeMux()
	MountSessionsRoutes(mux, &container.Container{})
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodPatch, "/api/v1/spaces/00000000-0000-0000-0000-000000000001/coin-donations", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body: %s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
	}
}

func TestLiveCoinSupportRouteRejectsUnauthenticatedRequests(t *testing.T) {
	mux := http.NewServeMux()
	MountSessionsRoutes(mux, &container.Container{})
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodPatch, "/api/v1/lives/00000000-0000-0000-0000-000000000001/coin-support", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body: %s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
	}
}

func TestSpaceCoinDonationRouteRejectsUnauthenticatedRequests(t *testing.T) {
	mux := http.NewServeMux()
	MountSessionsRoutes(mux, &container.Container{})
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/spaces/00000000-0000-0000-0000-000000000001/coin-donations", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body: %s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
	}
}

func TestSpaceDetailRouteAllowsAnonymousRequestToReachPublicHandler(t *testing.T) {
	mux := http.NewServeMux()
	MountSessionsRoutes(mux, &container.Container{})
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/spaces/not-a-uuid", nil))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; optional authentication may have been removed", recorder.Code, http.StatusBadRequest)
	}
}
