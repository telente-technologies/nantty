package controllers_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/tracking/controllers"
	"nantty/modules/ads/src/services"
)

func TestRedirectClickNeverRedirectsOnBadTokens(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	signer := services.AdTokenSigner{ActiveKeyId: "k1", Keys: map[string][]byte{"k1": []byte("secret-secret-secret-secret-1234")}, TimeToLive: time.Hour, Now: func() time.Time { return now }}
	controller := controllers.TrackingController{Container: &container.Container{Signer: signer}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/ads/r/{token}", controller.RedirectClick)
	forged, _ := signer.SignClick(services.ClickClaims{AdId: "not-a-uuid", UserId: "u1", ImpressionToken: "nope"})
	for _, token := range []string{"x", "https:%2F%2Fevil.example", "c1.k1.e30.AAAA", forged} {
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/ads/r/"+token+"?url=https://evil.example&to=https://evil.example", nil))
		if recorder.Code != http.StatusNotFound || recorder.Header().Get("Location") != "" {
			t.Fatalf("token %q: want 404 without Location, got %d %q", token, recorder.Code, recorder.Header().Get("Location"))
		}
	}
}
