package servicemodule

import (
	"context"
	"log/slog"
	"net/http"

	"nantty/platform/config"
	"nantty/platform/health"
)

type Dependencies struct {
	DeployableName string
	Logger         *slog.Logger
	Environment    *config.EnvironmentReader
	Health         *health.Registry
}

type Module interface {
	Name() string
	MountRoutes(mux *http.ServeMux)
	RunBackgroundWorkersUntilContextDone(ctx context.Context) error
	Close(ctx context.Context) error
}

type Factory func(ctx context.Context, dependencies Dependencies) (Module, error)

type RoutelessModule struct {
	ModuleName string
}

func (module RoutelessModule) Name() string                                               { return module.ModuleName }
func (module RoutelessModule) MountRoutes(*http.ServeMux)                                 {}
func (module RoutelessModule) RunBackgroundWorkersUntilContextDone(context.Context) error { return nil }
func (module RoutelessModule) Close(context.Context) error                                { return nil }
