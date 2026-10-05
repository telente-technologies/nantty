package jwtauth

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	sessionDenylistKeyPrefix = "auth:revoked-session:"
	sessionDenylistTimeout   = 150 * time.Millisecond
)

type SessionDenylist interface {
	IsSessionRevoked(ctx context.Context, sessionId string) (bool, error)
	RevokeSessions(ctx context.Context, sessionIds []string, ttl time.Duration) error
}

var (
	denylistMutex         sync.RWMutex
	registeredDenylist    SessionDenylist
	denylistCheckFailures atomic.Int64
	denylistWriteFailures atomic.Int64
)

func RegisterSessionDenylist(denylist SessionDenylist) {
	denylistMutex.Lock()
	defer denylistMutex.Unlock()
	registeredDenylist = denylist
}

func RegisteredSessionDenylist() SessionDenylist {
	denylistMutex.RLock()
	defer denylistMutex.RUnlock()
	return registeredDenylist
}

func SessionDenylistCheckFailures() int64 { return denylistCheckFailures.Load() }
func SessionDenylistWriteFailures() int64 { return denylistWriteFailures.Load() }

func isSessionRevokedFailingOpen(ctx context.Context, denylist SessionDenylist, sessionId string) bool {
	if denylist == nil {
		return false
	}
	checkCtx, cancel := context.WithTimeout(ctx, sessionDenylistTimeout)
	defer cancel()
	revoked, err := denylist.IsSessionRevoked(checkCtx, sessionId)
	if err != nil {
		denylistCheckFailures.Add(1)
		slog.ErrorContext(ctx, "session denylist check failed; allowing token until it expires",
			slog.String("metric", "auth_session_denylist_check_failed_total"), slog.Any("error", err))
		return false
	}
	return revoked
}

func DenylistSessions(ctx context.Context, sessionIds []string, ttl time.Duration) {
	denylist := RegisteredSessionDenylist()
	if denylist == nil || len(sessionIds) == 0 {
		return
	}
	writeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Second)
	defer cancel()
	if err := denylist.RevokeSessions(writeCtx, sessionIds, ttl); err != nil {
		denylistWriteFailures.Add(1)
		slog.ErrorContext(ctx, "session denylist write failed; sweeper will retry",
			slog.String("metric", "auth_session_denylist_write_failed_total"), slog.Int("sessions", len(sessionIds)), slog.Any("error", err))
	}
}

type RedisSessionDenylist struct {
	client *redis.Client
}

func NewRedisSessionDenylist(client *redis.Client) *RedisSessionDenylist {
	return &RedisSessionDenylist{client: client}
}

func NewRedisSessionDenylistFromUrl(rawUrl string) (*RedisSessionDenylist, error) {
	options, err := redis.ParseURL(rawUrl)
	if err != nil {
		return nil, err
	}
	return NewRedisSessionDenylist(redis.NewClient(options)), nil
}

func (denylist *RedisSessionDenylist) IsSessionRevoked(ctx context.Context, sessionId string) (bool, error) {
	count, err := denylist.client.Exists(ctx, sessionDenylistKeyPrefix+sessionId).Result()
	return count > 0, err
}

func (denylist *RedisSessionDenylist) RevokeSessions(ctx context.Context, sessionIds []string, ttl time.Duration) error {
	if ttl <= 0 {
		return errors.New("session denylist ttl must be positive")
	}
	pipeline := denylist.client.Pipeline()
	for _, sessionId := range sessionIds {
		pipeline.Set(ctx, sessionDenylistKeyPrefix+sessionId, "1", ttl)
	}
	_, err := pipeline.Exec(ctx)
	return err
}

func (denylist *RedisSessionDenylist) Close() error { return denylist.client.Close() }
