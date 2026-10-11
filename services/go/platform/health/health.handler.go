package health

import (
	"context"
	"net/http"
	"sync"
	"time"

	"zudomart/platform/httpserver"
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
	ctx, cancel := context.WithTimeout(request.Context(), 3*time.Second)
	defer cancel()
	registry.mutex.RLock()
	defer registry.mutex.RUnlock()
	results := make(map[string]string, len(registry.checks))
	status := http.StatusOK
	for name, check := range registry.checks {
		if err := check(ctx); err != nil {
			results[name] = "down"
			status = http.StatusServiceUnavailable
			continue
		}
		results[name] = "up"
	}
	body := map[string]any{"ready": status == http.StatusOK}
	if httpserver.IsFromTrustedNetwork(request) {
		body["checks"] = results
	}
	httpserver.WriteJsonResponse(writer, status, body)
}
