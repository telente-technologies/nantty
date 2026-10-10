package identityports

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"time"
)

type CachedPlatformSettings struct {
	registry   *Registry
	timeToLive time.Duration
	logger     *slog.Logger
	now        func() time.Time
	mutex      sync.Mutex
	entries    map[string]cachedPlatformSetting
}

type cachedPlatformSetting struct {
	value     json.RawMessage
	found     bool
	fetchedAt time.Time
}

func NewCachedPlatformSettings(registry *Registry, timeToLive time.Duration, logger *slog.Logger) *CachedPlatformSettings {
	if logger == nil {
		logger = slog.Default()
	}
	return &CachedPlatformSettings{registry: registry, timeToLive: timeToLive, logger: logger, now: time.Now, entries: map[string]cachedPlatformSetting{}}
}

func (settings *CachedPlatformSettings) ReadValue(ctx context.Context, key string) (json.RawMessage, bool) {
	if settings == nil || settings.registry == nil {
		return nil, false
	}
	settings.mutex.Lock()
	defer settings.mutex.Unlock()
	cached, known := settings.entries[key]
	if known && settings.now().Sub(cached.fetchedAt) < settings.timeToLive {
		return cached.value, cached.found
	}
	value, err := settings.fetch(ctx, key)
	switch {
	case err == nil:
		cached = cachedPlatformSetting{value: value, found: true}
	case errors.Is(err, ErrSettingNotFound):
		settings.logger.Warn("platform setting missing, using the environment fallback", slog.String("key", key))
		cached = cachedPlatformSetting{}
	default:
		settings.logger.Warn("platform setting unavailable, using the last known value or the environment fallback", slog.String("key", key), slog.Any("error", err))
	}
	cached.fetchedAt = settings.now()
	settings.entries[key] = cached
	return cached.value, cached.found
}

func (settings *CachedPlatformSettings) fetch(ctx context.Context, key string) (json.RawMessage, error) {
	port, err := settings.registry.PlatformSettings()
	if err != nil {
		return nil, err
	}
	value, _, err := port.ReadSettingValue(ctx, key)
	return value, err
}
