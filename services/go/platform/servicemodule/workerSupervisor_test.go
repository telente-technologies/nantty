package servicemodule

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"
)

func TestSupervisorRestartsAWorkerThatFailsOrPanics(t *testing.T) {
	var runs atomic.Int32
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		SuperviseWorkerWithOptions(ctx, slog.New(slog.NewTextHandler(io.Discard, nil)), "test", SupervisorOptions{InitialDelay: time.Millisecond, MaximumDelay: 5 * time.Millisecond}, func(workerContext context.Context) error {
			switch runs.Add(1) {
			case 1:
				return errors.New("transient setup failure")
			case 2:
				panic("poison")
			case 3:
				return nil
			default:
				cancel()
				<-workerContext.Done()
				return nil
			}
		})
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("supervisor did not stop after the context was cancelled")
	}
	if runs.Load() != 4 {
		t.Fatalf("runs = %d, want restarts after an error, a panic and an early return", runs.Load())
	}
}

func TestSupervisorStopsAWorkerThatIsDisabledByConfiguration(t *testing.T) {
	var runs atomic.Int32
	done := make(chan struct{})
	go func() {
		defer close(done)
		SuperviseWorkerWithOptions(context.Background(), slog.New(slog.NewTextHandler(io.Discard, nil)), "test", SupervisorOptions{InitialDelay: time.Millisecond}, func(context.Context) error {
			runs.Add(1)
			return ErrWorkerDisabled
		})
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("a disabled worker must not be restarted forever")
	}
	if runs.Load() != 1 {
		t.Fatalf("runs = %d", runs.Load())
	}
}
