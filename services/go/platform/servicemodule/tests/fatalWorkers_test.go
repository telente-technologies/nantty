package servicemodule_test

import (
	"context"
	"errors"
	. "nantty/platform/servicemodule"
	"strings"
	"testing"
	"time"
)

func TestAFailingFatalWorkerStopsItsSiblingsAndSurfacesTheError(t *testing.T) {
	siblingStopped := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		done <- RunWorkersStoppingAllOnFirstFailure(context.Background(),
			NamedWorker{Name: "internal money gRPC", Run: func(context.Context) error { return errors.New("listen tcp :9103: address already in use") }},
			NamedWorker{Name: "outbox relay", Run: func(ctx context.Context) error { <-ctx.Done(); close(siblingStopped); return nil }},
		)
	}()
	select {
	case err := <-done:
		if err == nil || !strings.Contains(err.Error(), "internal money gRPC") {
			t.Fatalf("err = %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("a gRPC listen failure must end the worker run instead of being logged and ignored")
	}
	select {
	case <-siblingStopped:
	default:
		t.Fatal("siblings must be cancelled")
	}
}

func TestFatalWorkersThatFinishCleanlyDoNotFailTheRun(t *testing.T) {
	err := RunWorkersStoppingAllOnFirstFailure(context.Background(),
		NamedWorker{Name: "grpc disabled", Run: func(context.Context) error { return nil }},
	)
	if err != nil {
		t.Fatal(err)
	}
}
