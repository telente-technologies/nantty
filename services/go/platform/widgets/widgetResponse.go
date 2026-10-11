package widgets

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

const (
	DefaultCacheTimeToLive = 45 * time.Second
	DefaultCacheEntries    = 20000
	clientCacheHeader      = "private, max-age=60"
)

type cacheEntry[T any] struct {
	value     T
	expiresAt time.Time
}

type ResponseCache[T any] struct {
	mutex      sync.Mutex
	entries    map[string]cacheEntry[T]
	timeToLive time.Duration
	maxEntries int
	now        func() time.Time
}

func NewResponseCache[T any](timeToLive time.Duration, maxEntries int, now func() time.Time) *ResponseCache[T] {
	if now == nil {
		now = time.Now
	}
	return &ResponseCache[T]{entries: map[string]cacheEntry[T]{}, timeToLive: timeToLive, maxEntries: maxEntries, now: now}
}

func (cache *ResponseCache[T]) GetOrLoad(ctx context.Context, key string, load func(context.Context) (T, error)) (T, error) {
	moment := cache.now()
	cache.mutex.Lock()
	entry, found := cache.entries[key]
	cache.mutex.Unlock()
	if found && moment.Before(entry.expiresAt) {
		return entry.value, nil
	}
	value, err := load(ctx)
	if err != nil {
		return value, err
	}
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	if len(cache.entries) >= cache.maxEntries {
		cache.evictExpiredOrEverything(moment)
	}
	cache.entries[key] = cacheEntry[T]{value: value, expiresAt: moment.Add(cache.timeToLive)}
	return value, nil
}

func (cache *ResponseCache[T]) Forget(key string) {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	delete(cache.entries, key)
}

func (cache *ResponseCache[T]) evictExpiredOrEverything(moment time.Time) {
	for key, entry := range cache.entries {
		if !moment.Before(entry.expiresAt) {
			delete(cache.entries, key)
		}
	}
	if len(cache.entries) >= cache.maxEntries {
		clear(cache.entries)
	}
}

func AmountsHidden(request *http.Request) bool {
	return request.URL.Query().Get("amounts") == "hidden"
}

func WriteWidgetJson(writer http.ResponseWriter, body any) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.Header().Set("Cache-Control", clientCacheHeader)
	writer.Header().Set("Vary", "Authorization")
	writer.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(writer).Encode(body)
}

func FormatWidgetTime(moment *time.Time) *string {
	if moment == nil {
		return nil
	}
	text := moment.UTC().Format(time.RFC3339)
	return &text
}
