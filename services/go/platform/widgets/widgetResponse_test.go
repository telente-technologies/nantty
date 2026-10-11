package widgets

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"
	"time"
)

func TestResponseCacheServesFreshValuesAndReloadsAfterExpiry(t *testing.T) {
	moment := time.Unix(1_000, 0)
	cache := NewResponseCache[int](time.Minute, 2, func() time.Time { return moment })
	loads := 0
	load := func(context.Context) (int, error) { loads++; return loads, nil }
	first, _ := cache.GetOrLoad(context.Background(), "a", load)
	second, _ := cache.GetOrLoad(context.Background(), "a", load)
	if first != 1 || second != 1 {
		t.Fatalf("cached value should be reused, got %d %d", first, second)
	}
	moment = moment.Add(2 * time.Minute)
	third, _ := cache.GetOrLoad(context.Background(), "a", load)
	if third != 2 {
		t.Fatalf("expired value should reload, got %d", third)
	}
	if _, err := cache.GetOrLoad(context.Background(), "b", func(context.Context) (int, error) { return 0, errors.New("down") }); err == nil {
		t.Fatal("load errors must surface and not be cached")
	}
	_, _ = cache.GetOrLoad(context.Background(), "b", load)
	_, _ = cache.GetOrLoad(context.Background(), "c", load)
	if len(cache.entries) > 2 {
		t.Fatalf("cache must stay bounded, has %d", len(cache.entries))
	}
}

func TestWidgetResponsesArePrivateAndAmountsCanBeHidden(t *testing.T) {
	recorder := httptest.NewRecorder()
	WriteWidgetJson(recorder, map[string]string{"ok": "yes"})
	if recorder.Header().Get("Cache-Control") != "private, max-age=60" || recorder.Code != 200 {
		t.Fatalf("unexpected headers %v", recorder.Header())
	}
	if !AmountsHidden(httptest.NewRequest("GET", "/api/v1/widgets/seller-today?amounts=hidden", nil)) || AmountsHidden(httptest.NewRequest("GET", "/x", nil)) {
		t.Fatal("amounts=hidden must be detected")
	}
}
