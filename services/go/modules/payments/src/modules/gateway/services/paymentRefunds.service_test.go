package services

import (
	"testing"

	"github.com/google/uuid"

	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/modules/gateway/models"
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
	if !sameRefundRequest(existing, request) {
		t.Fatal("an identical retry should be recognized as a replay")
	}

	changed := request
	changed.AmountMinor++
	if sameRefundRequest(existing, changed) {
		t.Fatal("a reused reference with a different amount must conflict")
	}
	changed = request
	changed.Currency = "USD"
	if sameRefundRequest(existing, changed) {
		t.Fatal("a reused reference with a different currency must conflict")
	}
	changed = request
	changed.Reason = "duplicate payment"
	if sameRefundRequest(existing, changed) {
		t.Fatal("a reused reference with a different reason must conflict")
	}
}
