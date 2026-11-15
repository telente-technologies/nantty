package payments_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
)

func TestBusinessVerificationRevocationUnverifiesTheSellerIdempotentlyAndInOrder(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	gateway, ctx, database := harness.Payments.Application.Gateway, context.Background(), harness.Database
	seller := uuid.NewString()
	start := time.Now().Add(-time.Hour)
	verified := func(want bool, step string) {
		t.Helper()
		got, err := gateway.IsSellerVerified(ctx, database, seller)
		if err != nil || got != want {
			t.Fatalf("%s: verified %v (%v), want %v", step, got, err, want)
		}
	}
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(gateway.RecordSellerVerification(ctx, seller, "approved-1", start))
	verified(true, "approved")
	must(gateway.RevokeSellerVerification(ctx, seller, "revoked-1", start.Add(time.Minute)))
	verified(false, "revoked")
	must(gateway.RevokeSellerVerification(ctx, seller, "revoked-1", start.Add(time.Minute)))
	must(gateway.RecordSellerVerification(ctx, seller, "approved-1", start))
	verified(false, "a redelivered approval must not undo a later revocation")
	must(gateway.RecordSellerVerification(ctx, seller, "approved-2", start.Add(2*time.Minute)))
	verified(true, "a newer approval reinstates the seller")
	must(gateway.RevokeSellerVerification(ctx, seller, "revoked-0", start.Add(30*time.Second)))
	verified(true, "a stale revocation is ignored")

	early := uuid.NewString()
	must(gateway.RevokeSellerVerification(ctx, early, "revoked-early", start.Add(time.Minute)))
	must(gateway.RecordSellerVerification(ctx, early, "approved-early", start))
	if got, err := gateway.IsSellerVerified(ctx, database, early); err != nil || got {
		t.Fatalf("a revocation that arrives before its older approval must win: %v %v", got, err)
	}
	if err := gateway.RevokeSellerVerification(ctx, "", "revoked-empty", start); err == nil {
		t.Fatal("an event without an account id must be refused")
	}
}
