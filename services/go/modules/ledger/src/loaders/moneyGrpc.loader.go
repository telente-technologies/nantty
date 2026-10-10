package loaders

import (
	"context"
	"crypto/subtle"
	"errors"
	"log/slog"
	"net"
	"strings"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

var (
	grpcRegistrationsMutex sync.Mutex
	grpcRegistrations      []func(*grpc.Server)
)

func RegisterMoneyGrpcService(register func(*grpc.Server)) {
	grpcRegistrationsMutex.Lock()
	defer grpcRegistrationsMutex.Unlock()
	grpcRegistrations = append(grpcRegistrations, register)
}

func NewMoneyGrpcServer(internalToken string, registrations ...func(*grpc.Server)) *grpc.Server {
	server := grpc.NewServer(grpc.UnaryInterceptor(RequireInternalBearerToken(internalToken)))
	for _, register := range registrations {
		register(server)
	}
	return server
}

func ServeRegisteredMoneyGrpcServicesUntilContextDone(ctx context.Context, address, internalToken string, logger *slog.Logger) error {
	grpcRegistrationsMutex.Lock()
	registrations := append([]func(*grpc.Server){}, grpcRegistrations...)
	grpcRegistrationsMutex.Unlock()
	if address == "" || len(registrations) == 0 {
		return nil
	}
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return err
	}
	server := NewMoneyGrpcServer(internalToken, registrations...)
	go func() {
		<-ctx.Done()
		server.GracefulStop()
	}()
	logger.Info("internal money gRPC listening", slog.String("address", address))
	if err := server.Serve(listener); err != nil && !errors.Is(err, grpc.ErrServerStopped) {
		return err
	}
	return nil
}

func RequireInternalBearerToken(expected string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, request any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if expected == "" {
			return nil, status.Error(codes.Unauthenticated, "internal token required")
		}
		values := metadata.ValueFromIncomingContext(ctx, "authorization")
		presented := ""
		if len(values) > 0 {
			presented = strings.TrimPrefix(values[0], "Bearer ")
		}
		if presented == "" || subtle.ConstantTimeCompare([]byte(presented), []byte(expected)) != 1 {
			return nil, status.Error(codes.Unauthenticated, "internal token required")
		}
		return handler(ctx, request)
	}
}
