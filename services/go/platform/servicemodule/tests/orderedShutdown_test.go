package servicemodule_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"nantty/platform/servicemodule"
)

func TestShutdownHooksRunOnlyAfterWorkersDrainWithAFreshContext(t *testing.T) {
	var mutex sync.Mutex
	order := []string{}
	record := func(step string) {
		mutex.Lock()
		defer mutex.Unlock()
		order = append(order, step)
	}
	ctx, cancel := context.WithCancel(context.Background())
	worker := func(workerContext context.Context) error {
		<-workerContext.Done()
		time.Sleep(30 * time.Millisecond)
		record("worker drained")
		return nil
	}
	serve := func(serveContext context.Context) error {
		cancel()
		<-serveContext.Done()
		record("server stopped")
		return nil
	}
	hook := func(hookContext context.Context) error {
		if hookContext.Err() != nil {
			return errors.New("hook context already expired")
		}
		record("hook")
		return nil
	}
	err := servicemodule.RunWithOrderedShutdown(ctx, servicemodule.ShutdownPlan{Workers: []func(context.Context) error{worker}, Serve: serve, Hooks: []func(context.Context) error{hook}})
	if err != nil {
		t.Fatal(err)
	}
	if len(order) != 3 || order[2] != "hook" {
		t.Fatalf("hooks must run after workers drain, got %v", order)
	}
}

func TestShutdownHooksRunWhenTheServerFailsToStart(t *testing.T) {
	ran := false
	bindFailure := errors.New("address in use")
	err := servicemodule.RunWithOrderedShutdown(context.Background(), servicemodule.ShutdownPlan{
		Serve: func(context.Context) error { return bindFailure },
		Hooks: []func(context.Context) error{func(context.Context) error { ran = true; return nil }},
	})
	if !errors.Is(err, bindFailure) || !ran {
		t.Fatalf("hooks must run after a bind failure, err=%v ran=%v", err, ran)
	}
}
