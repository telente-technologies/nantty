package jwtauth_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"nantty/platform/jwtauth"
)

func TestRequireAdultAccountBlocksMinorsAndUnknownAge(t *testing.T) {
	okHandler := jwtauth.RequireAdultAccount()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for _, bracket := range []string{"", "unknown", "minor"} {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/coins/purchases", nil).WithContext(
			jwtauth.ContextWithPrincipal(context.Background(), jwtauth.Principal{UserId: "u1", SessionId: "s1", AgeBracket: bracket}),
		)
		rec := httptest.NewRecorder()
		okHandler.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("expected 403 for bracket %q, got %d", bracket, rec.Code)
		}
	}

	adultReq := httptest.NewRequest(http.MethodPost, "/api/v1/coins/purchases", nil).WithContext(
		jwtauth.ContextWithPrincipal(context.Background(), jwtauth.Principal{UserId: "u1", SessionId: "s1", AgeBracket: "adult"}),
	)
	adultRec := httptest.NewRecorder()
	okHandler.ServeHTTP(adultRec, adultReq)
	if adultRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for adult bracket, got %d", adultRec.Code)
	}
}
