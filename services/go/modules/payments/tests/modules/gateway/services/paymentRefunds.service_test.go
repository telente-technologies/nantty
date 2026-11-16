package services_test

import (
	"testing"

	"github.com/google/uuid"

	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/payments/src/modules/gateway/services"
)

func TestSameRefundRequestRequiresMatchingAmountCurrencyAndReason(t *testing.T) {
	intentID := uuid.New()
	request := models.RefundRequest{
		PaymentIntentId: intentID,
		Reference:       "refund-reference",
		AmountMinor:     1250,
		Currency:        "NGN",
		Reason:          "buyer request",
	}
	existing := &ent.PaymentRefund{
		PaymentIntentID: intentID,
		AmountMinor:     1250,
		Currency:        "NGN",
		Reason:          "buyer request",
	}
	if !services.SameRefundRequest(existing, request) {
		t.Fatal("an identical retry should be recognized as a replay")
	}

	changed := request
	changed.AmountMinor++
	if services.SameRefundRequest(existing, changed) {
		t.Fatal("a reused reference with a different amount must conflict")
	}
	changed = request
	changed.Currency = "USD"
	if services.SameRefundRequest(existing, changed) {
		t.Fatal("a reused reference with a different currency must conflict")
	}
	changed = request
	changed.Reason = "duplicate payment"
	if services.SameRefundRequest(existing, changed) {
		t.Fatal("a reused reference with a different reason must conflict")
	}
}
