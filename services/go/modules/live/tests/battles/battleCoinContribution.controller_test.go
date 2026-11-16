package controllers_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/battles/controllers"
	"nantty/modules/live/src/modules/battles/routes"
	"nantty/platform/jwtauth"
)

func TestBattleCoinContributionRouteRequiresAuthentication(t *testing.T) {
	mux := http.NewServeMux()
	routes.MountBattlesRoutes(mux, &container.Container{})
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/battles/00000000-0000-0000-0000-000000000001/coins", strings.NewReader(`{"recipientUserId":"00000000-0000-0000-0000-000000000002","coins":1}`)))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d, want %d; body=%s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
	}
}

func TestBattleCoinContributionControllerRejectsInvalidBodyBeforeDependencies(t *testing.T) {
	actorID := uuid.New()
	controller := controllers.BattlesController{Container: &container.Container{}}
	for _, body := range []string{
		`{"recipientUserId":"not-a-uuid","coins":1}`,
		`{"recipientUserId":"` + uuid.NewString() + `","coins":0}`,
		`{"recipientUserId":"` + uuid.NewString() + `","coins":1,"price":1}`,
		`{"recipientUserId":"` + uuid.NewString() + `","coins":1} {}`,
	} {
		t.Run(body, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/api/v1/battles/"+uuid.NewString()+"/coins", strings.NewReader(body))
			request.SetPathValue("battleId", uuid.NewString())
			request = request.WithContext(jwtauth.ContextWithPrincipal(context.Background(), jwtauth.Principal{UserId: actorID.String()}))
			recorder := httptest.NewRecorder()
			controller.ContributeCoins(recorder, request)
			if recorder.Code < 400 || recorder.Code >= 500 {
				t.Fatalf("invalid contribution body should be rejected, status=%d body=%s", recorder.Code, recorder.Body.String())
			}
		})
	}
}
