package loaders

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

const platformSettingsReadTimeout = time.Second

type PlatformSettingFetcher func(ctx context.Context, key string) (json.RawMessage, error)

type PlatformSettingsSource struct {
	fetch      PlatformSettingFetcher
	timeToLive time.Duration
	now        func() time.Time
	logger     *slog.Logger
	mutex      sync.Mutex
	entries    map[string]cachedPlatformSetting
}

type cachedPlatformSetting struct {
	value     json.RawMessage
	found     bool
	fetchedAt time.Time
}

func NewPlatformSettingsSource(database *sql.DB, adminSchema string, timeToLive time.Duration, logger *slog.Logger) *PlatformSettingsSource {
	if adminSchema == "" {
		return NewPlatformSettingsSourceFromFetcher(nil, timeToLive, logger)
	}
	query := `SELECT value FROM ` + pgx.Identifier{adminSchema, "platform_settings"}.Sanitize() + ` WHERE key = $1`
	return NewPlatformSettingsSourceFromFetcher(func(ctx context.Context, key string) (json.RawMessage, error) {
		var value []byte
		err := database.QueryRowContext(ctx, query, key).Scan(&value)
		return value, err
	}, timeToLive, logger)
}

func NewPlatformSettingsSourceFromFetcher(fetch PlatformSettingFetcher, timeToLive time.Duration, logger *slog.Logger) *PlatformSettingsSource {
	if logger == nil {
		logger = slog.Default()
	}
	return &PlatformSettingsSource{fetch: fetch, timeToLive: timeToLive, now: time.Now, logger: logger, entries: map[string]cachedPlatformSetting{}}
}

func (source *PlatformSettingsSource) ReadValue(ctx context.Context, key string) (json.RawMessage, bool) {
	if source == nil || source.fetch == nil {
		return nil, false
	}
	source.mutex.Lock()
	defer source.mutex.Unlock()
	cached, known := source.entries[key]
	if known && source.now().Sub(cached.fetchedAt) < source.timeToLive {
		return cached.value, cached.found
	}
	fetched, err := source.fetchValue(ctx, key)
	switch {
	case err == nil:
		cached = fetched
	case errors.Is(err, sql.ErrNoRows):
		source.logger.Warn("platform setting missing, using the environment fallback", slog.String("key", key))
		cached = cachedPlatformSetting{fetchedAt: source.now()}
	default:
		source.logger.Warn("platform setting unavailable, using the last known value or the environment fallback", slog.String("key", key), slog.Any("error", err))
		cached.fetchedAt = source.now()
	}
	source.entries[key] = cached
	return cached.value, cached.found
}

func (source *PlatformSettingsSource) fetchValue(ctx context.Context, key string) (cachedPlatformSetting, error) {
	ctx, cancel := context.WithTimeout(ctx, platformSettingsReadTimeout)
	defer cancel()
	value, err := source.fetch(ctx, key)
	if err != nil {
		return cachedPlatformSetting{}, err
	}
	return cachedPlatformSetting{value: value, found: true, fetchedAt: source.now()}, nil
}
