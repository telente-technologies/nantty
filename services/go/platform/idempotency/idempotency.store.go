package idempotency

import (
	"context"
	"crypto/rand"
	"encoding/hex"
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
	Owner       string          `json:"owner,omitempty"`
	Response    *StoredResponse `json:"response,omitempty"`
}

type ReservationOutcome int

const (
	ReservationStarted ReservationOutcome = iota
	ReservationAlreadyInFlight
	ReservationKeyReusedWithDifferentRequest
	ReservationCompletedEarlier
)

const maximumReservationAttempts = 3

var ErrReservationContended = errors.New("idempotency key kept changing while it was being reserved")

var completeOwnedReservation = redis.NewScript(`
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local decoded = cjson.decode(current)
if decoded.state ~= 'inFlight' or decoded.owner ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1
`)

var releaseOwnedReservation = redis.NewScript(`
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local decoded = cjson.decode(current)
if decoded.state ~= 'inFlight' or decoded.owner ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
return 1
`)

type RedisStore struct {
	client    *redis.Client
	keyPrefix string
}

func NewRedisStore(client *redis.Client, keyPrefix string) *RedisStore {
	return &RedisStore{client: client, keyPrefix: keyPrefix}
}

func (store *RedisStore) ReserveKeyOrLoadEarlierOutcome(ctx context.Context, scopedKey, requestHash string, ttl time.Duration) (ReservationOutcome, *StoredResponse, string, error) {
	owner := newReservationOwner()
	encoded, _ := json.Marshal(reservation{State: "inFlight", RequestHash: requestHash, Owner: owner})
	for attempt := 0; attempt < maximumReservationAttempts; attempt++ {
		reserved, err := store.client.SetNX(ctx, store.keyPrefix+scopedKey, encoded, ttl).Result()
		if err != nil {
			return 0, nil, "", fmt.Errorf("reserve idempotency key: %w", err)
		}
		if reserved {
			return ReservationStarted, nil, owner, nil
		}
		raw, err := store.client.Get(ctx, store.keyPrefix+scopedKey).Bytes()
		if errors.Is(err, redis.Nil) {
			continue
		}
		if err != nil {
			return 0, nil, "", fmt.Errorf("load idempotency key: %w", err)
		}
		var existing reservation
		if err := json.Unmarshal(raw, &existing); err != nil {
			return 0, nil, "", fmt.Errorf("decode idempotency key: %w", err)
		}
		switch {
		case existing.RequestHash != requestHash:
			return ReservationKeyReusedWithDifferentRequest, nil, "", nil
		case existing.State == "completed" && existing.Response != nil:
			return ReservationCompletedEarlier, existing.Response, "", nil
		default:
			return ReservationAlreadyInFlight, nil, "", nil
		}
	}
	return 0, nil, "", ErrReservationContended
}

func (store *RedisStore) SaveCompletedResponse(ctx context.Context, scopedKey, requestHash, owner string, response StoredResponse, ttl time.Duration) error {
	encoded, _ := json.Marshal(reservation{State: "completed", RequestHash: requestHash, Response: &response})
	return completeOwnedReservation.Run(ctx, store.client, []string{store.keyPrefix + scopedKey}, owner, encoded, ttl.Milliseconds()).Err()
}

func (store *RedisStore) ReleaseKeySoTheClientCanRetry(ctx context.Context, scopedKey, owner string) error {
	return releaseOwnedReservation.Run(ctx, store.client, []string{store.keyPrefix + scopedKey}, owner).Err()
}

func newReservationOwner() string {
	buffer := make([]byte, 16)
	_, _ = rand.Read(buffer)
	return hex.EncodeToString(buffer)
}
