package utils

import (
	"sync"
	"time"
)

type SavedCardHandoff struct {
	PaymentMethodId    string
	ProviderCustomerId string
	Brand              string
	Last4              string
	ExpiryMonth        int
	ExpiryYear         int
}

type SavedCardHandoffStore interface {
	Offer(reference string, handoff SavedCardHandoff)
	Take(reference string) (SavedCardHandoff, bool)
}

type MemorySavedCardHandoffStore struct {
	TimeToLive time.Duration
	Now        func() time.Time
	mutex      sync.Mutex
	entries    map[string]memoryHandoffEntry
}

type memoryHandoffEntry struct {
	handoff   SavedCardHandoff
	expiresAt time.Time
}

func NewMemorySavedCardHandoffStore(timeToLive time.Duration) *MemorySavedCardHandoffStore {
	return &MemorySavedCardHandoffStore{TimeToLive: timeToLive, Now: time.Now, entries: map[string]memoryHandoffEntry{}}
}

func (store *MemorySavedCardHandoffStore) Offer(reference string, handoff SavedCardHandoff) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	now := store.Now()
	for key, entry := range store.entries {
		if now.After(entry.expiresAt) {
			delete(store.entries, key)
		}
	}
	store.entries[reference] = memoryHandoffEntry{handoff: handoff, expiresAt: now.Add(store.TimeToLive)}
}

func (store *MemorySavedCardHandoffStore) Take(reference string) (SavedCardHandoff, bool) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	entry, found := store.entries[reference]
	delete(store.entries, reference)
	if !found || store.Now().After(entry.expiresAt) {
		return SavedCardHandoff{}, false
	}
	return entry.handoff, true
}
