package health

import (
	"context"
	"net/http"
	"sync"
	"time"

	"nantty/platform/httpserver"
)

const (
	readinessDeadline     = 3 * time.Second
	readinessCheckTimeout = 2 * time.Second
)

type ReadinessCheck func(ctx context.Context) error

type Registry struct {
	serviceName string
	mutex       sync.RWMutex
	checks      map[string]ReadinessCheck
}

func NewRegistryForService(serviceName string) *Registry {
	return &Registry{serviceName: serviceName, checks: map[string]ReadinessCheck{}}
}

func (registry *Registry) AddReadinessCheck(name string, check ReadinessCheck) {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	registry.checks[name] = check
}

func (registry *Registry) MountLivenessAndReadinessRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", registry.respondWithLiveness)
	mux.HandleFunc("GET /readyz", registry.respondWithReadiness)
}

func (registry *Registry) respondWithLiveness(writer http.ResponseWriter, _ *http.Request) {
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]string{"status": "up"})
}

func (registry *Registry) respondWithReadiness(writer http.ResponseWriter, request *http.Request) {
	ctx, cancel := context.WithTimeout(request.Context(), readinessDeadline)
	defer cancel()
	results := registry.runChecksConcurrently(ctx)
	status := http.StatusOK
	for _, result := range results {
		if result != "up" {
			status = http.StatusServiceUnavailable
		}
	}
	body := map[string]any{"ready": status == http.StatusOK}
	if httpserver.IsFromTrustedNetwork(request) {
		body["checks"] = results
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (registry *Registry) runChecksConcurrently(ctx context.Context) map[string]string {
	registry.mutex.RLock()
	checks := make(map[string]ReadinessCheck, len(registry.checks))
	for name, check := range registry.checks {
		checks[name] = check
	}
	registry.mutex.RUnlock()
	var resultsMutex sync.Mutex
	results := make(map[string]string, len(checks))
	var wait sync.WaitGroup
	for name, check := range checks {
		wait.Go(func() {
			result := "up"
			if runCheckWithTimeout(ctx, check) != nil {
				result = "down"
			}
			resultsMutex.Lock()
			results[name] = result
			resultsMutex.Unlock()
		})
	}
	wait.Wait()
	return results
}

func runCheckWithTimeout(ctx context.Context, check ReadinessCheck) error {
	checkContext, cancel := context.WithTimeout(ctx, readinessCheckTimeout)
	defer cancel()
	outcome := make(chan error, 1)
	go func() { outcome <- check(checkContext) }()
	select {
	case err := <-outcome:
		return err
	case <-checkContext.Done():
		return checkContext.Err()
	}
}
