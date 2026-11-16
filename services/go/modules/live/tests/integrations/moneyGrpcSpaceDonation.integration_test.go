package integrations_test

import (
	"context"
	"errors"
	"testing"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	"nantty/modules/live/src/integrations"
	"nantty/modules/live/src/interfaces"
)

type spaceDonationMoneyServiceClient struct {
	moneyv1.LiveMoneyServiceClient
	request  *moneyv1.DonateSpaceCoinsRequest
	response *moneyv1.DonateSpaceCoinsResponse
	err      error
	calls    int
}

func (client *spaceDonationMoneyServiceClient) DonateSpaceCoins(_ context.Context, request *moneyv1.DonateSpaceCoinsRequest, _ ...grpc.CallOption) (*moneyv1.DonateSpaceCoinsResponse, error) {
	client.calls++
	client.request = request
	return client.response, client.err
}

func TestDonateSpaceCoinsMapsAmountAndReceipt(t *testing.T) {
	service := &spaceDonationMoneyServiceClient{response: &moneyv1.DonateSpaceCoinsResponse{
		DonationId: "donation-id", LedgerTransactionId: "ledger-id", SenderUserId: "sender", HostUserId: "host", SpaceId: "space",
		TotalCoins: 51, PlatformFeeCoins: 26, CreatorAmountCoins: 25, SenderCoinBalance: 149, Replayed: true,
	}}
	client := integrations.NewMoneyClient(service, integrations.InternalGrpcOptions{})
	receipt, err := client.DonateSpaceCoins(context.Background(), interfaces.DonateSpaceCoinsRequest{
		SenderUserId: "auth-sender", SpaceId: "space-id", Coins: 51, IdempotencyKey: "donation-key-01",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := service.request; got == nil || got.GetSenderUserId() != "auth-sender" || got.GetSpaceId() != "space-id" || got.GetCoins() != 51 || got.GetIdempotencyKey() != "donation-key-01" {
		t.Fatalf("internal donation request = %+v", got)
	}
	if receipt.DonationId != "donation-id" || receipt.LedgerTransactionId != "ledger-id" || receipt.SenderUserId != "sender" || receipt.HostUserId != "host" || receipt.SpaceId != "space" ||
		receipt.TotalCoins != 51 || receipt.PlatformFeeCoins != 26 || receipt.CreatorAmountCoins != 25 || receipt.SenderCoinBalance != 149 || !receipt.Replayed {
		t.Fatalf("donation receipt = %+v", receipt)
	}
}

func TestTranslateDonationPolicyAndAuthorizationErrors(t *testing.T) {
	policyStatus := status.New(codes.InvalidArgument, "outside policy")
	detailed, err := policyStatus.WithDetails(&errdetails.ErrorInfo{Reason: "INVALID_DONATION_AMOUNT", Domain: "money.nantty.com", Metadata: map[string]string{"minimumCoins": "7", "maximumCoins": "250"}})
	if err != nil {
		t.Fatal(err)
	}
	var policy *interfaces.DonationAmountPolicyError
	if got := integrations.TranslateMoneyError(detailed.Err()); !errors.As(got, &policy) || policy.MinimumCoins != 7 || policy.MaximumCoins != 250 {
		t.Fatalf("translated donation policy error = %#v", got)
	}

	for _, reason := range []struct {
		reason string
		want   error
	}{{"SPACE_DONATIONS_DISABLED", interfaces.ErrSpaceDonationsDisabled}, {"CANNOT_DONATE_TO_SELF", interfaces.ErrCannotGiftSelf}, {"SPACE_DONATION_BLOCKED", interfaces.ErrSpaceDonationBlocked}, {"SPACE_DONATION_UNAVAILABLE", interfaces.ErrSpaceDonationUnavailable}} {
		base := status.New(codes.FailedPrecondition, reason.reason)
		annotated, err := base.WithDetails(&errdetails.ErrorInfo{Reason: reason.reason, Domain: "money.nantty.com"})
		if err != nil {
			t.Fatal(err)
		}
		if got := integrations.TranslateMoneyError(annotated.Err()); !errors.Is(got, reason.want) {
			t.Errorf("reason %s translated to %v, want %v", reason.reason, got, reason.want)
		}
	}
}
