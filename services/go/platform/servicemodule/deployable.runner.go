package servicemodule

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os/signal"
	"syscall"

	"golang.org/x/sync/errgroup"

	"zudomart/platform/config"
	"zudomart/platform/events"
	"zudomart/platform/health"
	"zudomart/platform/httpserver"
	"zudomart/platform/logging"
	"zudomart/platform/telemetry"
	"zudomart/platform/viewerregion"
)

func RunDeployableWithModulesUntilTerminationSignal(deployableName string, factories ...Factory) error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	environment := config.NewEnvironmentReader()
	logger := logging.NewJsonLoggerForService(deployableName, environment.ReadStringOrDefault("LOG_LEVEL", "info"))
	address := environment.ReadStringOrDefault("HTTP_ADDRESS", ":8080")
	shutDownTracing, err := telemetry.StartTracingWhenCollectorIsConfigured(ctx, deployableName)
	if err != nil {
		return err
	}
	dependencies := Dependencies{DeployableName: deployableName, Logger: logger, Environment: environment, Health: health.NewRegistryForService(deployableName)}
	modules, err := createModulesInOrder(ctx, dependencies, factories)
	if err != nil {
		return err
	}
	if err := environment.CombinedConfigurationError(); err != nil {
		return err
	}
	mux := http.NewServeMux()
	dependencies.Health.MountLivenessAndReadinessRoutes(mux)
	for _, module := range modules {
		module.MountRoutes(mux)
		logger.Info("module mounted", slog.String("module", module.Name()))
	}
	handler := httpserver.ChainMiddlewares(mux,
		httpserver.AssignRequestIdToEveryRequest,
		telemetry.TraceEveryHttpRequest(deployableName),
		httpserver.RecoverFromPanicsAsInternalErrors(logger),
		viewerregion.CaptureSignals(environment.ReadStringOrDefault("TRUSTED_COUNTRY_HEADER", viewerregion.DefaultTrustedCountryName)),
		httpserver.LogEveryRequestWithDuration(logger),
	)
	group, groupContext := errgroup.WithContext(ctx)
	for _, module := range modules {
		group.Go(func() error { return module.RunBackgroundWorkersUntilContextDone(groupContext) })
	}
	group.Go(func() error {
		return httpserver.RunHttpServerUntilContextDone(groupContext, httpserver.ServerOptions{
			Address: address, Handler: handler, Logger: logger,
			OnShutdown: append(closersForModules(modules), events.CloseSharedRabbitConnections, shutDownTracing),
		})
	})
	return group.Wait()
}

func createModulesInOrder(ctx context.Context, dependencies Dependencies, factories []Factory) ([]Module, error) {
	modules := make([]Module, 0, len(factories))
	for _, factory := range factories {
		module, err := factory(ctx, dependencies)
		if err != nil {
			for _, created := range modules {
				_ = created.Close(ctx)
			}
			return nil, fmt.Errorf("start module: %w", err)
		}
		modules = append(modules, module)
	}
	return modules, nil
}

func closersForModules(modules []Module) []func(context.Context) error {
	return []func(context.Context) error{func(ctx context.Context) error {
		var combined error
		for index := len(modules) - 1; index >= 0; index-- {
			combined = errors.Join(combined, modules[index].Close(ctx))
		}
		return combined
	}}
}
