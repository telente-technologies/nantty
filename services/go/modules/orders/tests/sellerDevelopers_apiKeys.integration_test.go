package orders_test

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/middlewares"
	sellerdevelopers "nantty/modules/orders/src/modules/sellerDevelopers"
	"nantty/platform/commerceports"
	"nantty/platform/jwtauth"
)

func TestCreateApiKeyFailsClosedWhenDatabaseIsUnavailable(t *testing.T) {
	module := startAgainstFreshSchema(t)
	store := commerceports.StoreAccess{StoreId: uuid.New()}
	actor := uuid.New()

	brokenDatabase, err := sql.Open("pgx", "postgres://nantty:nantty@127.0.0.1:1/unavailable?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	if err := brokenDatabase.Close(); err != nil {
		t.Fatal(err)
	}
	originalDatabase := module.Container.Database
	containerWithUnavailableDatabase := *module.Container
	containerWithUnavailableDatabase.Database = brokenDatabase
	controller := sellerdevelopers.Controller{Container: &containerWithUnavailableDatabase}

	request := httptest.NewRequest(http.MethodPost, "/api/v1/seller/developers/api-keys", strings.NewReader(`{"name":"test key","scopes":["products:read"]}`))
	ctx := jwtauth.ContextWithPrincipal(request.Context(), jwtauth.Principal{UserId: actor.String()})
	request = request.WithContext(middlewares.ContextWithStoreAccess(ctx, store))
	recorder := httptest.NewRecorder()
	controller.CreateApiKey(recorder, request)
	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("database failure must fail closed, got %d %s", recorder.Code, recorder.Body.String())
	}

	var count int
	if err := originalDatabase.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM seller_api_keys WHERE store_id = $1 AND revoked_at IS NULL`, store.StoreId).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("database failure created %d API keys", count)
	}
}

func TestCreateApiKeyActiveLimitIsAtomicPerStore(t *testing.T) {
	module := startAgainstFreshSchema(t)
	controller := sellerdevelopers.Controller{Container: module.Container}
	store := commerceports.StoreAccess{StoreId: uuid.New()}
	actor := uuid.New()

	const attempts = 14
	statuses := make(chan int, attempts)
	var workers sync.WaitGroup
	for index := 0; index < attempts; index++ {
		workers.Add(1)
		go func(index int) {
			defer workers.Done()
			body := fmt.Sprintf(`{"name":"key-%d","scopes":["products:read"]}`, index)
			request := httptest.NewRequest(http.MethodPost, "/api/v1/seller/developers/api-keys", strings.NewReader(body))
			ctx := jwtauth.ContextWithPrincipal(request.Context(), jwtauth.Principal{UserId: actor.String()})
			request = request.WithContext(middlewares.ContextWithStoreAccess(ctx, store))
			recorder := httptest.NewRecorder()
			controller.CreateApiKey(recorder, request)
			statuses <- recorder.Code
		}(index)
	}
	workers.Wait()
	close(statuses)

	created, limited := 0, 0
	for status := range statuses {
		switch status {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
			limited++
		default:
			t.Fatalf("unexpected concurrent create status %d", status)
		}
	}
	if created != 10 || limited != attempts-10 {
		t.Fatalf("expected 10 created and %d limited, got %d created and %d limited", attempts-10, created, limited)
	}

	var active int
	if err := module.Container.Database.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM seller_api_keys WHERE store_id = $1 AND revoked_at IS NULL`, store.StoreId).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if active != 10 {
		t.Fatalf("per-store active key cap must remain 10, got %d", active)
	}
}
