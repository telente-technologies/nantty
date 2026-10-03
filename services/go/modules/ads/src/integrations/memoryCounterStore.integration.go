package integrations

import (
	"context"
	"sync"
	"time"
)

type memoryCounter struct {
	value     int64
	expiresAt time.Time
}

type MemoryCounterStore struct {
	mutex    sync.Mutex
	counters map[string]memoryCounter
	Now      func() time.Time
}

func NewMemoryCounterStore(now func() time.Time) *MemoryCounterStore {
	return &MemoryCounterStore{counters: map[string]memoryCounter{}, Now: now}
}

func (store *MemoryCounterStore) Increment(_ context.Context, key string, delta int64, ttl time.Duration) (int64, error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	counter, found := store.liveCounter(key)
	if !found {
		counter.expiresAt = store.Now().Add(ttl)
	}
	counter.value += delta
	store.counters[key] = counter
	return counter.value, nil
}

func (store *MemoryCounterStore) Read(_ context.Context, key string) (int64, error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	counter, _ := store.liveCounter(key)
	return counter.value, nil
}

func (store *MemoryCounterStore) RaiseToAtLeast(_ context.Context, key string, floor int64, ttl time.Duration) error {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	counter, found := store.liveCounter(key)
	if !found {
		counter.expiresAt = store.Now().Add(ttl)
	}
	counter.value = max(counter.value, floor)
	store.counters[key] = counter
	return nil
}

func (store *MemoryCounterStore) liveCounter(key string) (memoryCounter, bool) {
	counter, found := store.counters[key]
	if found && !counter.expiresAt.After(store.Now()) {
		delete(store.counters, key)
		return memoryCounter{}, false
	}
	return counter, found
}
