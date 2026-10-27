package integrations

import (
	"context"
	"errors"
	"testing"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	"nantty/modules/live/src/interfaces"
)

type spaceGiftMoneyServiceClient struct {
	moneyv1.LiveMoneyServiceClient
	request  *moneyv1.ChargeSpaceCoinGiftRequest
	response *moneyv1.ChargeSpaceCoinGiftResponse
	err      error
	calls    int
}

func (client *spaceGiftMoneyServiceClient) ChargeSpaceCoinGift(_ context.Context, request *moneyv1.ChargeSpaceCoinGiftRequest, _ ...grpc.CallOption) (*moneyv1.ChargeSpaceCoinGiftResponse, error) {
	client.calls++
	client.request = request
	return client.response, client.err
}

func TestChargeSpaceCoinGiftMapsRequestAndReceipt(t *testing.T) {
	service := &spaceGiftMoneyServiceClient{response: &moneyv1.ChargeSpaceCoinGiftResponse{
		GiftTransactionId: "gift-tx", LedgerTransactionId: "ledger-tx", SenderUserId: "sender", HostUserId: "host",
		SpaceId: "space", GiftId: "gift", Quantity: 3, UnitPriceCoins: 25, TotalCoins: 75,
		PlatformFeeCoins: 15, CreatorAmountCoins: 60, SenderCoinBalance: 925, Replayed: true,
	}}
	client := &MoneyClient{service: service}
	request := interfaces.ChargeSpaceCoinGiftRequest{
		SenderUserId: "authenticated-sender", SpaceId: "authoritative-space", GiftId: "catalog-gift",
		Quantity: 3, IdempotencyKey: "gift-attempt-123",
	}

	receipt, err := client.ChargeSpaceCoinGift(context.Background(), request)
	if err != nil {
		t.Fatalf("ChargeSpaceCoinGift() error = %v", err)
	}
	if service.calls != 1 {
		t.Fatalf("RPC calls = %d, want 1", service.calls)
	}
	if got := service.request; got == nil || got.GetSenderUserId() != "authenticated-sender" || got.GetSpaceId() != "authoritative-space" || got.GetGiftId() != "catalog-gift" || got.GetQuantity() != 3 || got.GetIdempotencyKey() != "gift-attempt-123" {
		t.Fatalf("RPC request = %+v, does not match the narrow caller request", got)
	}
	if receipt.GiftTransactionId != "gift-tx" || receipt.LedgerTransactionId != "ledger-tx" || receipt.SenderUserId != "sender" || receipt.HostUserId != "host" || receipt.SpaceId != "space" || receipt.GiftId != "gift" || receipt.Quantity != 3 || receipt.UnitPriceCoins != 25 || receipt.TotalCoins != 75 || receipt.PlatformFeeCoins != 15 || receipt.CreatorAmountCoins != 60 || receipt.SenderCoinBalance != 925 || !receipt.Replayed {
		t.Fatalf("receipt = %+v, does not match RPC response", receipt)
	}
}

func TestChargeSpaceCoinGiftRetriesOnlyWithIdempotencyKey(t *testing.T) {
	service := &spaceGiftMoneyServiceClient{err: status.Error(codes.Unavailable, "temporarily unavailable")}
	client := &MoneyClient{service: service, options: InternalGrpcOptions{RetryAttempts: 3}}
	_, _ = client.ChargeSpaceCoinGift(context.Background(), interfaces.ChargeSpaceCoinGiftRequest{IdempotencyKey: "retry-safe"})
	if service.calls != 3 {
		t.Fatalf("idempotent RPC calls = %d, want 3", service.calls)
	}

	service.calls = 0
	_, _ = client.ChargeSpaceCoinGift(context.Background(), interfaces.ChargeSpaceCoinGiftRequest{})
	if service.calls != 1 {
		t.Fatalf("RPC calls without idempotency key = %d, want 1", service.calls)
	}
}

func TestTranslateSpaceCoinGiftErrors(t *testing.T) {
	tests := []struct {
		reason string
		code   codes.Code
		want   error
	}{
		{"INSUFFICIENT_COINS", codes.FailedPrecondition, interfaces.ErrInsufficientCoins},
		{"SPACE_GIFTS_DISABLED", codes.FailedPrecondition, interfaces.ErrSpaceGiftsDisabled},
		{"SPACE_GIFT_UNAVAILABLE", codes.FailedPrecondition, interfaces.ErrSpaceGiftUnavailable},
		{"SPACE_NOT_FOUND", codes.FailedPrecondition, interfaces.ErrSpaceGiftUnavailable},
		{"SPACE_HOST_NOT_CREATOR", codes.FailedPrecondition, interfaces.ErrSpaceHostNotCreator},
		{"SPACE_GIFT_BLOCKED", codes.FailedPrecondition, interfaces.ErrSpaceGiftBlocked},
		{"IDEMPOTENCY_KEY_REUSED", codes.AlreadyExists, interfaces.ErrIdempotencyKeyReused},
	}
	for _, test := range tests {
		t.Run(test.reason, func(t *testing.T) {
			base := status.New(test.code, "safe service message")
			detailed, err := base.WithDetails(&errdetails.ErrorInfo{Reason: test.reason, Domain: "money.nantty.com"})
			if err != nil {
				t.Fatalf("WithDetails() error = %v", err)
			}
			if got := translateMoneyError(detailed.Err()); !errors.Is(got, test.want) {
				t.Fatalf("translateMoneyError() = %v, want errors.Is(_, %v)", got, test.want)
			}
		})
	}

	unknown := status.Error(codes.Internal, "internal error")
	if got := translateMoneyError(unknown); got != unknown {
		t.Fatalf("unknown error was changed: got %v, want original status", got)
	}
}
