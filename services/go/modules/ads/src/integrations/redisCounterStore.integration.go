package integrations

import (
	"context"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisCounterStore struct {
	Client *redis.Client
	Prefix string
}

var incrementWithFirstTimeExpiry = redis.NewScript(`
local value = redis.call('INCRBY', KEYS[1], ARGV[1])
if value == tonumber(ARGV[1]) then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return value`)

var raiseToAtLeast = redis.NewScript(`
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current < tonumber(ARGV[1]) then
  redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
end
return 1`)

func (store RedisCounterStore) Increment(ctx context.Context, key string, delta int64, ttl time.Duration) (int64, error) {
	return incrementWithFirstTimeExpiry.Run(ctx, store.Client, []string{store.Prefix + key}, delta, ttl.Milliseconds()).Int64()
}

func (store RedisCounterStore) Read(ctx context.Context, key string) (int64, error) {
	value, err := store.Client.Get(ctx, store.Prefix+key).Int64()
	if errors.Is(err, redis.Nil) {
		return 0, nil
	}
	return value, err
}

func (store RedisCounterStore) RaiseToAtLeast(ctx context.Context, key string, floor int64, ttl time.Duration) error {
	return raiseToAtLeast.Run(ctx, store.Client, []string{store.Prefix + key}, floor, ttl.Milliseconds()).Err()
}
