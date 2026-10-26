package integrations

import (
	"context"
	"crypto/subtle"
	"errors"
	"log/slog"
	"net"
	"strings"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	authv1 "nantty/contracts/gen/go/zudomart/auth/v1"
	"nantty/platform/identityports"
)

const maximumAccountSummariesPerRequest = 200

type AccountDirectoryGrpcServer struct {
	authv1.UnimplementedAccountDirectoryServiceServer
	Directory identityports.AccountDirectory
}

func (server AccountDirectoryGrpcServer) GetAccountSummaries(ctx context.Context, request *authv1.GetAccountSummariesRequest) (*authv1.GetAccountSummariesResponse, error) {
	if len(request.GetAccountIds()) > maximumAccountSummariesPerRequest {
		return nil, status.Error(codes.InvalidArgument, "too many account ids")
	}
	response := &authv1.GetAccountSummariesResponse{}
	for _, rawIdentifier := range request.GetAccountIds() {
		identifier, err := uuid.Parse(rawIdentifier)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "account id must be a uuid")
		}
		summary, found, err := server.Directory.FindAccountSummary(ctx, identifier)
		if err != nil {
			return nil, status.Error(codes.Internal, "account lookup failed")
		}
		if !found {
			continue
		}
		accountStatus := "active"
		if !summary.Active {
			accountStatus = "deactivated"
		}
		response.Accounts = append(response.Accounts, &authv1.AccountSummary{
			AccountId: summary.ID.String(), Username: summary.Username, Name: summary.Name, Status: accountStatus,
			Roles: summary.Roles, CreatedAt: timestamppb.New(summary.CreatedAt),
		})
	}
	return response, nil
}

func ServeAccountDirectoryUntilContextDone(ctx context.Context, address, internalToken string, directory identityports.AccountDirectory, logger *slog.Logger) error {
	if address == "" {
		return nil
	}
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return err
	}
	server := grpc.NewServer(grpc.UnaryInterceptor(requireInternalBearerToken(internalToken)))
	authv1.RegisterAccountDirectoryServiceServer(server, AccountDirectoryGrpcServer{Directory: directory})
	go func() {
		<-ctx.Done()
		server.GracefulStop()
	}()
	logger.Info("account directory gRPC listening", slog.String("address", address))
	if err := server.Serve(listener); err != nil && !errors.Is(err, grpc.ErrServerStopped) {
		return err
	}
	return nil
}

func requireInternalBearerToken(expected string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, request any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
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
