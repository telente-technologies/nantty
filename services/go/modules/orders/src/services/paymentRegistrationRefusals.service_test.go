package services

import (
	"errors"
	"fmt"
	"testing"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestMoneyRefusalsReachTheBuyerAsReadableCheckoutErrors(t *testing.T) {
	detailed, err := status.New(codes.FailedPrecondition, "cap").WithDetails(&errdetails.ErrorInfo{Reason: "SELLER_SALES_CAP_REACHED", Domain: "money.zudomart.com"})
	if err != nil {
		t.Fatal(err)
	}
	refusal := PaymentRegistrationRefusal(fmt.Errorf("register payables: %w", detailed.Err()))
	if refusal == nil || refusal.Status != 409 || refusal.Code != "SELLER_SALES_CAP_REACHED" {
		t.Fatalf("cap refusal: %+v", refusal)
	}
	if PaymentRegistrationRefusal(status.Error(codes.Unavailable, "down")) != nil || PaymentRegistrationRefusal(errors.New("boom")) != nil {
		t.Fatal("other failures must stay a payment service error")
	}
}
