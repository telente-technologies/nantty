package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	commonv1 "nantty/contracts/gen/go/zudomart/common/v1"
	moneyv1 "nantty/contracts/gen/go/zudomart/money/v1"
	adserrors "nantty/modules/ads/src/errors"
)

type fakeAdsMoneyServer struct {
	moneyv1.UnimplementedAdsMoneyServiceServer
	authorization string
	debited       int64
}

func (server *fakeAdsMoneyServer) DebitWalletForBoost(ctx context.Context, request *moneyv1.DebitWalletForBoostRequest) (*moneyv1.DebitWalletForBoostResponse, error) {
	incoming, _ := metadata.FromIncomingContext(ctx)
	if values := incoming.Get("authorization"); len(values) > 0 {
		server.authorization = values[0]
	}
	if request.GetAmount().GetAmountMinor() > 1_000 {
		described, _ := status.New(codes.FailedPrecondition, "low").WithDetails(&errdetails.ErrorInfo{Reason: "INSUFFICIENT_FUNDS"})
		return nil, described.Err()
	}
	server.debited += request.GetAmount().GetAmountMinor()
	return &moneyv1.DebitWalletForBoostResponse{BalanceAfter: &commonv1.Money{AmountMinor: 0, Currency: "NGN"}}, nil
}

func startFakeAdsMoneyServer(t *testing.T) (*fakeAdsMoneyServer, string) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	fake := &fakeAdsMoneyServer{}
	server := grpc.NewServer()
	moneyv1.RegisterAdsMoneyServiceServer(server, fake)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	return fake, listener.Addr().String()
}

func TestBoostFundingUsesGrpcAndMapsMoneyErrors(t *testing.T) {
	fake, address := startFakeAdsMoneyServer(t)
	gateway, err := DialGrpcMoneyFundingGateway(address, "internal-token-of-32-characters!!", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer gateway.Close()
	if err := gateway.ChargeUserWalletForBoost(context.Background(), "user-1", "NGN", 500, "boost-key-1"); err != nil || fake.debited != 500 {
		t.Fatalf("debit err %v debited %d", err, fake.debited)
	}
	if fake.authorization != "Bearer internal-token-of-32-characters!!" {
		t.Fatalf("authorization %q", fake.authorization)
	}
	if err := gateway.ChargeUserWalletForBoost(context.Background(), "user-1", "NGN", 5_000, "boost-key-2"); !errors.Is(err, adserrors.InsufficientBalance) {
		t.Fatalf("expected insufficient balance, got %v", err)
	}
}

func TestBoostFundingFallsBackToHttpWhenGrpcIsUnavailable(t *testing.T) {
	var received map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("X-Internal-Token") != "token" || request.URL.Path != "/api/v1/internal/ads/boost-refunds" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewDecoder(request.Body).Decode(&received)
		_, _ = writer.Write([]byte(`{"replayed":false}`))
	}))
	defer server.Close()
	fallback := &HttpMoneyFundingGateway{BaseUrl: server.URL, Token: "token", Http: server.Client()}
	gateway, err := DialGrpcMoneyFundingGateway("127.0.0.1:1", "token", fallback)
	if err != nil {
		t.Fatal(err)
	}
	defer gateway.Close()
	if err := gateway.RefundBoostCharge(context.Background(), "user-1", "NGN", 200, "refund-boost-key-1", "boost-key-1"); err != nil {
		t.Fatal(err)
	}
	if received["debitIdempotencyKey"] != "boost-key-1" {
		t.Fatalf("fallback body %+v", received)
	}
}
