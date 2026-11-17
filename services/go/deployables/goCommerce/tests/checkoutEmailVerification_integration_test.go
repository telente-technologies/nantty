package main

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/services"
	"nantty/platform/usersdirectory"
)

func TestCheckoutRequiresVerifiedEmailBeforeCreatingOrdersOrReservingStock(t *testing.T) {
	harness := startCommerce(t)
	ctx := context.Background()
	harness.fillCart(t, 2)
	query := "UPDATE " + pgx.Identifier{harness.orders.Container.Settings.AuthDatabaseSchema, "accounts"}.Sanitize() + " SET email_verified_at = NULL WHERE id = $1"
	if _, err := harness.orders.Container.Database.ExecContext(ctx, query, harness.buyer); err != nil {
		t.Fatal(err)
	}
	_, err := (services.CheckoutService{Container: harness.orders.Container}).Checkout(ctx, services.CheckoutRequest{BuyerId: harness.buyer, AddressId: harness.addressId, IdempotencyKey: "checkout-unverified-email"})
	if !errors.Is(err, ordererrors.VerifyEmailRequired) {
		t.Fatalf("unverified buyer error = %v, want VERIFY_EMAIL_REQUIRED", err)
	}
	if harness.orders.Container.Client.Checkout.Query().CountX(ctx) != 0 || harness.orders.Container.Client.OrderGroup.Query().CountX(ctx) != 0 {
		t.Fatal("an unverified buyer must not create a checkout or order")
	}
	if harness.reservedUnits(t) != 0 || harness.inventory.Container.Client.StockReservation.Query().CountX(ctx) != 0 {
		t.Fatal("an unverified buyer must not reserve stock")
	}
}

func TestCheckoutFailsClosedWhenEmailVerificationCannotBeChecked(t *testing.T) {
	harness := startCommerce(t)
	harness.orders.Container.AccountEmailVerifier = usersdirectory.StaticAccountEmailVerifier{Err: errors.New("auth database unavailable")}
	ctx := context.Background()
	_, err := (services.CheckoutService{Container: harness.orders.Container}).Checkout(ctx, services.CheckoutRequest{BuyerId: harness.buyer, AddressId: harness.addressId, IdempotencyKey: "checkout-email-check-unavailable"})
	if !errors.Is(err, ordererrors.EmailVerificationUnavailable) {
		t.Fatalf("verification dependency error = %v, want fail-closed service error", err)
	}
	if harness.orders.Container.Client.Checkout.Query().CountX(ctx) != 0 {
		t.Fatal("verification outage must not create a checkout")
	}
}
