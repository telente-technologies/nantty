package analytics_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v3/jwk"

	"nantty/modules/analytics/src/controllers"
	"nantty/modules/analytics/src/routes"
	"nantty/modules/analytics/src/services"
	"nantty/modules/analytics/src/store"
	"nantty/modules/analytics/src/types"
	"nantty/platform/commerceports"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

type stubCatalogReader struct {
	commerceports.CatalogReader
	ownedStoreId uuid.UUID
	ownerId      uuid.UUID
}

func (stub stubCatalogReader) FindStoreAccessForAccount(_ context.Context, accountId uuid.UUID, requestedStoreId *uuid.UUID) (commerceports.StoreAccess, bool, error) {
	if accountId != stub.ownerId {
		return commerceports.StoreAccess{}, false, nil
	}
	if requestedStoreId != nil && *requestedStoreId != stub.ownedStoreId {
		return commerceports.StoreAccess{}, false, nil
	}
	return commerceports.StoreAccess{StoreId: stub.ownedStoreId, OwnerAccountId: stub.ownerId, Role: "owner"}, true, nil
}

func TestAnalyticsIngestAnonymizesMinorEventsAndRejectsForgedRevenue(t *testing.T) {
	mem := store.NewMemoryStore()
	now := time.Date(2026, 11, 16, 12, 0, 0, 0, time.UTC)
	svc := services.Service{Store: mem, Now: func() time.Time { return now }, MaxBatchSize: 50}

	res, err := svc.IngestBatch(context.Background(), "minor-user-1", "minor", []types.IngestEventInput{
		{
			EventKey:   "minor-evt-1",
			Domain:     "creator",
			EventName:  "content.viewed",
			SubjectId:  "creator-1",
			Properties: map[string]any{"userIp": "1.2.3.4", "deviceId": "dev-1", "surface": "feed"},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Accepted != 1 || res.Ignored != 0 {
		t.Fatalf("unexpected result: %+v", res)
	}
	if _, err := svc.IngestBatch(context.Background(), "attacker", "adult", []types.IngestEventInput{
		{EventKey: "forged-1", Domain: "commerce", EventName: "order.completed", StoreId: "store-1", AmountMinor: 999999},
	}); err == nil {
		t.Fatal("expected forged client order.completed event to be rejected")
	}
	if _, err := svc.IngestBatch(context.Background(), "attacker", "adult", []types.IngestEventInput{
		{EventKey: "forged-2", Domain: "creator", EventName: "creator.revenue", SubjectId: "creator-1", AmountMinor: 5000},
	}); err == nil {
		t.Fatal("expected forged client creator.revenue event to be rejected")
	}
}

func TestAnalyticsRoutesEnforceAuthStoreBoundaryAndInternalIngest(t *testing.T) {
	mem := store.NewMemoryStore()
	now := time.Date(2026, 11, 16, 12, 0, 0, 0, time.UTC)
	svc := services.Service{Store: mem, Now: func() time.Time { return now }, MaxBatchSize: 50}

	ownerId := uuid.New()
	ownedStoreId := uuid.New()
	otherStoreId := uuid.New()
	ctrl := controllers.AnalyticsController{
		Service: svc,
		CatalogReader: func() (commerceports.CatalogReader, error) {
			return stubCatalogReader{ownedStoreId: ownedStoreId, ownerId: ownerId}, nil
		},
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	verifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(func(context.Context) (jwk.Set, error) {
		return jwk.NewSet(), nil
	}, "https://auth.nantty.com", "nantty-api")

	mux := http.NewServeMux()
	routes.MountRoutes(mux, ctrl, verifier, nil, staffauth.Guard{}, "analytics-internal-secret-token-32chars")

	unauthReq := httptest.NewRequest(http.MethodPost, "/api/v1/analytics/events", bytes.NewBufferString(`{"events":[]}`))
	unauthRec := httptest.NewRecorder()
	mux.ServeHTTP(unauthRec, unauthReq)
	if unauthRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", unauthRec.Code)
	}

	ctx := jwtauth.ContextWithPrincipal(context.Background(), jwtauth.Principal{UserId: ownerId.String(), SessionId: "sess-1", AgeBracket: "minor"})
	clientBody, _ := json.Marshal(map[string]any{
		"events": []map[string]any{
			{"eventKey": "evt-1", "domain": "creator", "eventName": "content.viewed", "subjectId": ownerId.String()},
			{"eventKey": "evt-1", "domain": "creator", "eventName": "content.viewed", "subjectId": ownerId.String()},
		},
	})
	rec := httptest.NewRecorder()
	ctrl.IngestEvents(rec, httptest.NewRequest(http.MethodPost, "/api/v1/analytics/events", bytes.NewReader(clientBody)).WithContext(ctx))
	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d (%s)", rec.Code, rec.Body.String())
	}

	internalBody, _ := json.Marshal(map[string]any{
		"events": []map[string]any{
			{"eventKey": "ord-1", "domain": "commerce", "eventName": "order.completed", "storeId": ownedStoreId.String(), "amountMinor": 250000, "currency": "NGN"},
		},
	})
	badIntRec := httptest.NewRecorder()
	mux.ServeHTTP(badIntRec, httptest.NewRequest(http.MethodPost, "/api/v1/internal/analytics/events", bytes.NewReader(internalBody)))
	if badIntRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without internal token, got %d", badIntRec.Code)
	}
	intReq := httptest.NewRequest(http.MethodPost, "/api/v1/internal/analytics/events", bytes.NewReader(internalBody))
	intReq.Header.Set("X-Internal-Token", "analytics-internal-secret-token-32chars")
	intRec := httptest.NewRecorder()
	mux.ServeHTTP(intRec, intReq)
	if intRec.Code != http.StatusAccepted {
		t.Fatalf("expected 202 for internal ingest, got %d (%s)", intRec.Code, intRec.Body.String())
	}

	crossStoreRec := httptest.NewRecorder()
	ctrl.SellerSummary(crossStoreRec, httptest.NewRequest(http.MethodGet, "/api/v1/analytics/seller/summary?storeId="+otherStoreId.String(), nil).WithContext(ctx))
	if crossStoreRec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for cross-store read, got %d", crossStoreRec.Code)
	}

	ownStoreRec := httptest.NewRecorder()
	ctrl.SellerSummary(ownStoreRec, httptest.NewRequest(http.MethodGet, "/api/v1/analytics/seller/summary?storeId="+ownedStoreId.String(), nil).WithContext(ctx))
	if ownStoreRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for owned store read, got %d (%s)", ownStoreRec.Code, ownStoreRec.Body.String())
	}
}
