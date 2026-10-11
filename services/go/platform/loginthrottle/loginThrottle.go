package loginthrottle

import (
	"sync"
	"time"
)

const maximumTrackedIdentifiers = 100_000

type attempts struct {
	failures    int
	windowStart time.Time
	lockedUntil time.Time
}

type Throttle struct {
	mutex       sync.Mutex
	maxFailures int
	window      time.Duration
	lockout     time.Duration
	now         func() time.Time
	entries     map[string]*attempts
}

func New(maxFailures int, window, lockout time.Duration) *Throttle {
	return &Throttle{maxFailures: maxFailures, window: window, lockout: lockout, now: time.Now, entries: map[string]*attempts{}}
}

func (throttle *Throttle) WithClock(now func() time.Time) *Throttle {
	throttle.now = now
	return throttle
}

func (throttle *Throttle) LockedFor(identifier string) time.Duration {
	throttle.mutex.Lock()
	defer throttle.mutex.Unlock()
	entry, found := throttle.entries[identifier]
	if !found {
		return 0
	}
	return max(entry.lockedUntil.Sub(throttle.now()), 0)
}

func (throttle *Throttle) RecordFailure(identifier string) {
	throttle.mutex.Lock()
	defer throttle.mutex.Unlock()
	now := throttle.now()
	entry, found := throttle.entries[identifier]
	if !found || now.Sub(entry.windowStart) > throttle.window {
		if !found && len(throttle.entries) >= maximumTrackedIdentifiers {
			throttle.evictExpired(now)
		}
		entry = &attempts{windowStart: now}
		throttle.entries[identifier] = entry
	}
	entry.failures++
	if entry.failures >= throttle.maxFailures {
		entry.lockedUntil = now.Add(throttle.lockout)
		entry.failures = 0
		entry.windowStart = now
	}
}

func (throttle *Throttle) RecordSuccess(identifier string) {
	throttle.mutex.Lock()
	defer throttle.mutex.Unlock()
	delete(throttle.entries, identifier)
}

func (throttle *Throttle) evictExpired(now time.Time) {
	for identifier, entry := range throttle.entries {
		if now.Sub(entry.windowStart) > throttle.window && !entry.lockedUntil.After(now) {
			delete(throttle.entries, identifier)
		}
	}
	if len(throttle.entries) < maximumTrackedIdentifiers {
		return
	}
	for identifier, entry := range throttle.entries {
		if !entry.lockedUntil.After(now) {
			delete(throttle.entries, identifier)
		}
	}
}
