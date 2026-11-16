package services_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"nantty/modules/orders/src/services"
	"nantty/platform/httpserver"
)

func TestBuyerSeesTheSellerDebtAndOrderLimitRefusalsWithTheirDetails(t *testing.T) {
	if refusal := services.PaymentRegistrationRefusal(httpserver.NewApiError(http.StatusForbidden, "SELLER_DEBT_LIMIT", "owes")); refusal == nil || refusal.Code != "SELLER_DEBT_LIMIT" || refusal.Status != http.StatusForbidden || refusal.Details["audience"] != "buyer" {
		t.Fatalf("a seller over the debt limit is a buyer-facing refusal: %+v", refusal)
	}
	details, _ := json.Marshal(map[string]any{"reason": "contactSupportForLargeOrders", "maximum": map[string]any{"amountMinor": 500_000_000, "currency": "NGN"}})
	overGrpc, _ := status.New(codes.InvalidArgument, "too large").WithDetails(&errdetails.ErrorInfo{Reason: "PAYMENT_AMOUNT_OUT_OF_RANGE", Metadata: map[string]string{"details": string(details)}})
	refusal := services.PaymentRegistrationRefusal(overGrpc.Err())
	if refusal == nil || refusal.Code != "PAYMENT_AMOUNT_OUT_OF_RANGE" || refusal.Details["reason"] != "contactSupportForLargeOrders" {
		t.Fatalf("the order limit and its contact-support reason survive the money gRPC hop: %+v", refusal)
	}
	if services.PaymentRegistrationRefusal(httpserver.NewApiError(http.StatusInternalServerError, "INTERNAL", "x")) != nil {
		t.Fatal("unknown failures are not passed to the buyer")
	}
}
