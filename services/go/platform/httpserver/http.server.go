package httpserver

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os/signal"
	"syscall"
	"time"
)

type ServerOptions struct {
	Address         string
	Handler         http.Handler
	Logger          *slog.Logger
	ShutdownTimeout time.Duration
	WriteTimeout    time.Duration
	OnShutdown      []func(context.Context) error
}

func RunHttpServerUntilTerminationSignal(options ServerOptions) error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	return RunHttpServerUntilContextDone(ctx, options)
}

func RunHttpServerUntilContextDone(ctx context.Context, options ServerOptions) error {
	if options.ShutdownTimeout == 0 {
		options.ShutdownTimeout = 20 * time.Second
	}
	if options.WriteTimeout == 0 {
		options.WriteTimeout = 30 * time.Second
	}
	server := &http.Server{
		Addr:              options.Address,
		Handler:           options.Handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      options.WriteTimeout,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    64 << 10,
	}
	serverErrors := make(chan error, 1)
	go func() {
		options.Logger.Info("http server listening", slog.String("address", options.Address))
		serverErrors <- server.ListenAndServe()
	}()
	select {
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
	}
	options.Logger.Info("shutting down http server")
	shutdownContext, cancel := context.WithTimeout(context.Background(), options.ShutdownTimeout)
	defer cancel()
	shutdownError := server.Shutdown(shutdownContext)
	for _, hook := range options.OnShutdown {
		shutdownError = errors.Join(shutdownError, hook(shutdownContext))
	}
	return shutdownError
}
