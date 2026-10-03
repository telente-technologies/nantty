package interfaces

import (
	"context"
	"time"
)

type CounterStore interface {
	Increment(ctx context.Context, key string, delta int64, ttl time.Duration) (int64, error)
	Read(ctx context.Context, key string) (int64, error)
	RaiseToAtLeast(ctx context.Context, key string, floor int64, ttl time.Duration) error
}
