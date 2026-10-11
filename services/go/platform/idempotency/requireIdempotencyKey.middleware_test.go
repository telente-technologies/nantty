package idempotency

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

type fakeStore struct {
	mutex    sync.Mutex
	saved    map[string]StoredResponse
	inFlight map[string]string
	released int
	saveErr  error
}

func newFakeStore() *fakeStore {
	return &fakeStore{saved: map[string]StoredResponse{}, inFlight: map[string]string{}}
}

func (store *fakeStore) ReserveKeyOrLoadEarlierOutcome(_ context.Context, scopedKey, _ string, _ time.Duration) (ReservationOutcome, *StoredResponse, string, error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	if response, found := store.saved[scopedKey]; found {
		return ReservationCompletedEarlier, &response, "", nil
	}
	if _, found := store.inFlight[scopedKey]; found {
		return ReservationAlreadyInFlight, nil, "", nil
	}
	store.inFlight[scopedKey] = "owner"
	return ReservationStarted, nil, "owner", nil
}

func (store *fakeStore) SaveCompletedResponse(_ context.Context, scopedKey, _, owner string, response StoredResponse, _ time.Duration) error {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	if store.saveErr != nil {
		return store.saveErr
	}
	if store.inFlight[scopedKey] == owner {
		delete(store.inFlight, scopedKey)
		store.saved[scopedKey] = response
	}
	return nil
}

func (store *fakeStore) ReleaseKeySoTheClientCanRetry(_ context.Context, scopedKey, owner string) error {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	if store.inFlight[scopedKey] == owner {
		delete(store.inFlight, scopedKey)
		store.released++
	}
	return nil
}

func discardLogger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func send(handler http.Handler, key string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "/pay", strings.NewReader(`{"amount":1}`))
	request.Header.Set("Idempotency-Key", key)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func TestARetryableClientErrorReleasesTheKeySoTheRetryRunsAgain(t *testing.T) {
	store := newFakeStore()
	calls := 0
	handler := requireIdempotencyKeyWithStore(store, time.Hour, discardLogger())(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		calls++
		if calls == 1 {
			writer.WriteHeader(http.StatusPaymentRequired)
			return
		}
		writer.WriteHeader(http.StatusCreated)
	}))
	if code := send(handler, "key-00000001").Code; code != http.StatusPaymentRequired {
		t.Fatalf("first = %d", code)
	}
	if code := send(handler, "key-00000001").Code; code != http.StatusCreated || calls != 2 {
		t.Fatalf("retry = %d after %d calls, want a fresh execution", code, calls)
	}
	if replay := send(handler, "key-00000001"); replay.Code != http.StatusCreated || calls != 2 || replay.Header().Get("Idempotent-Replayed") != "true" {
		t.Fatalf("success must be replayed without re-running: %d calls=%d", replay.Code, calls)
	}
}

func TestAPanicReleasesTheKeyInsteadOfBrickingIt(t *testing.T) {
	store := newFakeStore()
	handler := requireIdempotencyKeyWithStore(store, time.Hour, discardLogger())(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") }))
	func() {
		defer func() { _ = recover() }()
		send(handler, "key-00000002")
	}()
	if store.released != 1 || len(store.inFlight) != 0 {
		t.Fatalf("panic must release the reservation, released=%d inFlight=%d", store.released, len(store.inFlight))
	}
}

func TestTheClientSeesNothingBeforeTheResponseIsStored(t *testing.T) {
	store := newFakeStore()
	var sawOutputDuringHandler bool
	var outer *httptest.ResponseRecorder
	handler := requireIdempotencyKeyWithStore(store, time.Hour, discardLogger())(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusCreated)
		_, _ = writer.Write([]byte(`{"ok":true}`))
		sawOutputDuringHandler = outer.Body.Len() > 0 || outer.Code == http.StatusCreated
	}))
	request := httptest.NewRequest(http.MethodPost, "/pay", strings.NewReader(`{}`))
	request.Header.Set("Idempotency-Key", "key-00000003")
	outer = httptest.NewRecorder()
	handler.ServeHTTP(outer, request)
	if sawOutputDuringHandler {
		t.Fatal("response reached the client before it was stored")
	}
	if outer.Code != http.StatusCreated || outer.Body.String() != `{"ok":true}` || len(store.saved) != 1 {
		t.Fatalf("code=%d body=%q saved=%d", outer.Code, outer.Body.String(), len(store.saved))
	}
}

func TestMissingStoreFailsClosed(t *testing.T) {
	reached := false
	handler := RequireIdempotencyKeyAndReplayCompletedResponses(nil, time.Hour, discardLogger())(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { reached = true }))
	if code := send(handler, "key-00000004").Code; code != http.StatusServiceUnavailable || reached {
		t.Fatalf("code=%d reached=%v", code, reached)
	}
}
