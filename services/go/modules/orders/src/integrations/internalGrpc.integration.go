package integrations

import (
	"context"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type InternalGrpcOptions struct {
	Address       string
	Token         string
	Timeout       time.Duration
	RetryAttempts int
	RetryBackoff  time.Duration
}

func dialInternalGrpcService(options InternalGrpcOptions) (*grpc.ClientConn, error) {
	return grpc.NewClient(options.Address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithChainUnaryInterceptor(attachBearerToken(options.Token), applyTimeoutPerAttempt(options.Timeout)),
	)
}

func attachBearerToken(token string) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, request, reply any, connection *grpc.ClientConn, invoker grpc.UnaryInvoker, callOptions ...grpc.CallOption) error {
		if token != "" {
			ctx = metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)
		}
		return invoker(ctx, method, request, reply, connection, callOptions...)
	}
}

func applyTimeoutPerAttempt(timeout time.Duration) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, request, reply any, connection *grpc.ClientConn, invoker grpc.UnaryInvoker, callOptions ...grpc.CallOption) error {
		if timeout > 0 {
			var cancel context.CancelFunc
			ctx, cancel = context.WithTimeout(ctx, timeout)
			defer cancel()
		}
		return invoker(ctx, method, request, reply, connection, callOptions...)
	}
}

func callWithRetryOnUnavailable[Result any](ctx context.Context, options InternalGrpcOptions, isIdempotent bool, call func(context.Context) (Result, error)) (Result, error) {
	attempts := 1
	if isIdempotent && options.RetryAttempts > 1 {
		attempts = options.RetryAttempts
	}
	var result Result
	var err error
	for attempt := 1; attempt <= attempts; attempt++ {
		result, err = call(ctx)
		if err == nil || status.Code(err) != codes.Unavailable || attempt == attempts {
			return result, err
		}
		select {
		case <-ctx.Done():
			return result, err
		case <-time.After(options.RetryBackoff * time.Duration(attempt)):
		}
	}
	return result, err
}
