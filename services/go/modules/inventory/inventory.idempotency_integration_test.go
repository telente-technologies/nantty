package inventory

import (
	"context"
	"errors"
	"testing"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
)

func TestIdempotentCommandsRunOnceAndReplayTheStoredResult(t *testing.T) {
	module := startInventoryAgainstFreshSchema(t)
	ctx := context.Background()
	runs := 0
	execute := func(*ent.Tx) (map[string]int, error) {
		runs++
		return map[string]int{"run": runs}, nil
	}
	first, err := container.RunIdempotently(ctx, module.Container, "adjustments:test", "key-1", "hash-1", execute)
	if err != nil || first["run"] != 1 {
		t.Fatalf("a first request with a fresh key must run: %v %v", first, err)
	}
	replayed, err := container.RunIdempotently(ctx, module.Container, "adjustments:test", "key-1", "hash-1", execute)
	if err != nil || replayed["run"] != 1 || runs != 1 {
		t.Fatalf("a retry must replay the stored result without running again: %v %v runs=%d", replayed, err, runs)
	}
	if _, err := container.RunIdempotently(ctx, module.Container, "adjustments:test", "key-1", "hash-2", execute); !errors.Is(err, container.ErrIdempotencyKeyReused) {
		t.Fatalf("a reused key with another body must be refused: %v", err)
	}
}
