package idempotency

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type StoredResponse struct {
	Status      int    `json:"status"`
	ContentType string `json:"contentType"`
	Body        []byte `json:"body"`
}

type reservation struct {
	State       string          `json:"state"`
	RequestHash string          `json:"requestHash"`
	Response    *StoredResponse `json:"response,omitempty"`
}

type ReservationOutcome int

const (
	ReservationStarted ReservationOutcome = iota
	ReservationAlreadyInFlight
	ReservationKeyReusedWithDifferentRequest
	ReservationCompletedEarlier
)

type RedisStore struct {
	client    *redis.Client
	keyPrefix string
}

func NewRedisStore(client *redis.Client, keyPrefix string) *RedisStore {
	return &RedisStore{client: client, keyPrefix: keyPrefix}
}

func (store *RedisStore) ReserveKeyOrLoadEarlierOutcome(ctx context.Context, scopedKey, requestHash string, ttl time.Duration) (ReservationOutcome, *StoredResponse, error) {
	encoded, _ := json.Marshal(reservation{State: "inFlight", RequestHash: requestHash})
	reserved, err := store.client.SetNX(ctx, store.keyPrefix+scopedKey, encoded, ttl).Result()
	if err != nil {
		return 0, nil, fmt.Errorf("reserve idempotency key: %w", err)
	}
	if reserved {
		return ReservationStarted, nil, nil
	}
	raw, err := store.client.Get(ctx, store.keyPrefix+scopedKey).Bytes()
	if errors.Is(err, redis.Nil) {
		return store.ReserveKeyOrLoadEarlierOutcome(ctx, scopedKey, requestHash, ttl)
	}
	if err != nil {
		return 0, nil, fmt.Errorf("load idempotency key: %w", err)
	}
	var existing reservation
	if err := json.Unmarshal(raw, &existing); err != nil {
		return 0, nil, fmt.Errorf("decode idempotency key: %w", err)
	}
	switch {
	case existing.RequestHash != requestHash:
		return ReservationKeyReusedWithDifferentRequest, nil, nil
	case existing.State == "completed" && existing.Response != nil:
		return ReservationCompletedEarlier, existing.Response, nil
	default:
		return ReservationAlreadyInFlight, nil, nil
	}
}

func (store *RedisStore) SaveCompletedResponse(ctx context.Context, scopedKey, requestHash string, response StoredResponse, ttl time.Duration) error {
	encoded, _ := json.Marshal(reservation{State: "completed", RequestHash: requestHash, Response: &response})
	return store.client.Set(ctx, store.keyPrefix+scopedKey, encoded, ttl).Err()
}

func (store *RedisStore) ReleaseKeySoTheClientCanRetry(ctx context.Context, scopedKey string) error {
	return store.client.Del(ctx, store.keyPrefix+scopedKey).Err()
}
