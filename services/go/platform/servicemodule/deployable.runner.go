package servicemodule

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os/signal"
	"strings"
	"syscall"

	"zudomart/platform/config"
	"zudomart/platform/events"
	"zudomart/platform/health"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
	"zudomart/platform/logging"
	"zudomart/platform/telemetry"
	"zudomart/platform/viewerregion"
)

func RunDeployableWithModulesUntilTerminationSignal(deployableName string, factories ...Factory) error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	environment := config.NewEnvironmentReader()
	logger := logging.NewJsonLoggerForService(deployableName, environment.ReadStringOrDefault("LOG_LEVEL", "info"))
	appEnv := environment.ReadStringOrDefault("APP_ENV", "")
	if !IsKnownAppEnvironment(appEnv) {
		environment.ReportProblem("APP_ENV must be set to development, staging, or production")
	}
	if appEnv == "production" {
		environment.RejectPlaceholderSecretsInProcessEnvironment()
		if strings.TrimSpace(environment.ReadStringOrDefault("AUTH_SESSION_DENYLIST_URL", "")) == "" {
			environment.ReportProblem("AUTH_SESSION_DENYLIST_URL is required in production")
		}
	}
	address := environment.ReadStringOrDefault("HTTP_ADDRESS", ":8080")
	shutDownTracing, err := telemetry.StartTracingWhenCollectorIsConfigured(ctx, deployableName)
	if err != nil {
		return err
	}
	closeDenylist, pingDenylist, err := registerSessionDenylistFromEnvironment(environment, logger)
	if err != nil {
		return err
	}
	defer closeDenylist()
	dependencies := Dependencies{DeployableName: deployableName, Logger: logger, Environment: environment, Health: health.NewRegistryForService(deployableName)}
	modules, err := createModulesInOrder(ctx, dependencies, factories)
	if err != nil {
		return err
	}
	if err := environment.CombinedConfigurationError(); err != nil {
		return err
	}
	registerSharedDependencyReadiness(dependencies.Health, pingDenylist, deployableName, logger)
	isProduction := appEnv == "production"
	mux := http.NewServeMux()
	dependencies.Health.MountLivenessAndReadinessRoutes(mux)
	httpMetrics := telemetry.NewHttpMetrics()
	httpMetrics.AddCounter("auth_session_denylist_check_failed_total", jwtauth.SessionDenylistCheckFailures)
	httpMetrics.AddCounter("auth_session_denylist_write_failed_total", jwtauth.SessionDenylistWriteFailures)
	mux.HandleFunc("GET /metrics", httpMetrics.ServeLoopbackOnly)
	for _, module := range modules {
		module.MountRoutes(mux)
		logger.Info("module mounted", slog.String("module", module.Name()))
	}
	handler := httpserver.ChainMiddlewares(httpMetrics.Middleware(mux),
		httpserver.AssignRequestIdToEveryRequest,
		telemetry.TraceEveryHttpRequest(deployableName),
		httpserver.RecoverFromPanicsAsInternalErrors(logger),
		httpserver.LimitEveryRequestBody(int64(environment.ReadIntegerOrDefault("HTTP_MAX_REQUEST_BODY_BYTES", int(httpserver.DefaultMaximumRequestBodyBytes)))),
		httpserver.ApplySecurityHeaders,
		httpserver.ApplyCors,
		httpserver.RateLimitEveryRequest(isProduction),
		viewerregion.CaptureSignals(environment.ReadStringOrDefault("TRUSTED_COUNTRY_HEADER", viewerregion.DefaultTrustedCountryName)),
		httpserver.LogEveryRequestWithDuration(logger),
	)
	workers := make([]func(context.Context) error, 0, len(modules))
	for _, module := range modules {
		workers = append(workers, module.RunBackgroundWorkersUntilContextDone)
	}
	return runWorkersAndServerThenShutDown(ctx, orderedRun{
		Workers: workers,
		Serve: func(serveContext context.Context) error {
			return httpserver.RunHttpServerUntilContextDone(serveContext, httpserver.ServerOptions{Address: address, Handler: handler, Logger: logger})
		},
		Hooks: append(closersForModules(modules), events.CloseSharedRabbitConnections, shutDownTracing),
	})
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

func registerSessionDenylistFromEnvironment(environment *config.EnvironmentReader, logger *slog.Logger) (func(), health.ReadinessCheck, error) {
	rawUrl := environment.ReadStringOrDefault("AUTH_SESSION_DENYLIST_URL", environment.ReadStringOrDefault("VALKEY_URL", ""))
	if rawUrl == "" {
		if environment.ReadStringOrDefault("APP_ENV", "development") == "production" {
			return nil, nil, errors.New("AUTH_SESSION_DENYLIST_URL or VALKEY_URL is required in production")
		}
		logger.Warn("no session denylist configured: revoked user sessions stay usable until their access token expires")
		return func() {}, nil, nil
	}
	denylist, err := jwtauth.NewRedisSessionDenylistFromUrl(rawUrl)
	if err != nil {
		return nil, nil, fmt.Errorf("AUTH_SESSION_DENYLIST_URL: %w", err)
	}
	jwtauth.RegisterSessionDenylist(denylist)
	return func() { _ = denylist.Close() }, denylist.Ping, nil
}

func registerSharedDependencyReadiness(registry *health.Registry, pingDenylist health.ReadinessCheck, deployableName string, logger *slog.Logger) {
	if pingDenylist != nil {
		registry.AddReadinessCheck("valkey", pingDenylist)
	}
	if brokerCheck, ok := events.BrokerReadinessCheckFromEnvironment(deployableName, logger); ok {
		registry.AddReadinessCheck("rabbitmq", brokerCheck)
	}
}
