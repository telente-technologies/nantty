package idempotency_test

import (
	"context"
	. "nantty/platform/idempotency"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func newTestRedisStore(t *testing.T) *RedisStore {
	rawUrl := os.Getenv("PLATFORM_TEST_VALKEY_URL")
	if rawUrl == "" {
		rawUrl = "redis://localhost:16379/14"
	}
	options, err := redis.ParseURL(rawUrl)
	if err != nil {
		t.Fatal(err)
	}
	client := redis.NewClient(options)
	t.Cleanup(func() { _ = client.Close() })
	if err := client.Ping(context.Background()).Err(); err != nil {
		t.Skipf("valkey unavailable: %v", err)
	}
	return NewRedisStore(client, "test:idempotency:"+time.Now().Format("150405.000000000")+":")
}

func TestAStaleOwnerCannotOverwriteOrDeleteANewerReservation(t *testing.T) {
	store := newTestRedisStore(t)
	ctx := context.Background()
	outcome, _, firstOwner, err := store.ReserveKeyOrLoadEarlierOutcome(ctx, "k", "hash", time.Minute)
	if err != nil || outcome != ReservationStarted {
		t.Fatalf("first reserve: %v %v", outcome, err)
	}
	if err := store.ReleaseKeySoTheClientCanRetry(ctx, "k", firstOwner); err != nil {
		t.Fatal(err)
	}
	_, _, secondOwner, err := store.ReserveKeyOrLoadEarlierOutcome(ctx, "k", "hash", time.Minute)
	if err != nil || secondOwner == firstOwner {
		t.Fatalf("second reserve: owner=%q err=%v", secondOwner, err)
	}
	if err := store.SaveCompletedResponse(ctx, "k", "hash", firstOwner, StoredResponse{Status: 500}, time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := store.ReleaseKeySoTheClientCanRetry(ctx, "k", firstOwner); err != nil {
		t.Fatal(err)
	}
	outcome, _, _, err = store.ReserveKeyOrLoadEarlierOutcome(ctx, "k", "hash", time.Minute)
	if err != nil || outcome != ReservationAlreadyInFlight {
		t.Fatalf("the newer reservation must survive a stale owner: %v %v", outcome, err)
	}
	if err := store.SaveCompletedResponse(ctx, "k", "hash", secondOwner, StoredResponse{Status: 201, Body: []byte("ok")}, time.Minute); err != nil {
		t.Fatal(err)
	}
	outcome, stored, _, err := store.ReserveKeyOrLoadEarlierOutcome(ctx, "k", "hash", time.Minute)
	if err != nil || outcome != ReservationCompletedEarlier || stored.Status != 201 {
		t.Fatalf("owner save must complete the key: %v %+v %v", outcome, stored, err)
	}
}
