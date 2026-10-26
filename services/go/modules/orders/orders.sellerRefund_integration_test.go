package orders

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/databases/schema"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent/outboxevent"
	"nantty/modules/orders/src/interfaces"
	"nantty/modules/orders/src/services"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
)

type fakeEscrowMoney struct {
	interfaces.CheckoutMoney
	status string
}

func (fake fakeEscrowMoney) GetOrderEscrow(context.Context, string) (interfaces.EscrowSummary, error) {
	return interfaces.EscrowSummary{Status: fake.status}, nil
}

func TestSellerRefundIsRequestedOnceWithinTheRefundableAmount(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	store := uuid.New()
	create := func(reference, mode string) uuid.UUID {
		group, err := module.Container.Client.OrderGroup.Create().
			SetCheckoutID(uuid.New()).SetReference(reference).SetInvoiceNumber("INV-" + reference).SetStoreID(store).SetSellerAccountID(uuid.New()).
			SetBuyerAccountID(uuid.New()).SetCurrency("NGN").SetSubtotalMinor(300_000).SetShippingMinor(0).SetTotalMinor(300_000).SetStatus("processing").SetPaymentStatus("paid").
			SetPaymentMode(mode).SetAddress(schema.AddressSnapshot{RecipientName: "Ada", Phone: "+2348000000000", Line1: "1 Marina", CountryCode: "NG"}).Save(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return group.ID
	}
	seller := services.SellerContext{Store: commerceports.StoreAccess{StoreId: store}, ActorId: uuid.New(), Name: "Temi"}
	escrowOrder, directOrder := create("ZM-RF-0001", "escrow"), create("ZM-RF-0002", "direct")

	module.Container.Money = fakeEscrowMoney{status: "held"}
	var validation *httpserver.ApiError
	if err := services.RefundSellerOrder(ctx, module.Container, seller, escrowOrder, services.SellerRefundRequest{AmountMinor: 300_001, Reason: "too much"}); !errors.As(err, &validation) || validation.Code != "VALIDATION_FAILED" {
		t.Fatalf("more than the buyer paid is a validation error: %v", err)
	}
	for _, amount := range []int64{0, -5} {
		if err := services.RefundSellerOrder(ctx, module.Container, seller, escrowOrder, services.SellerRefundRequest{AmountMinor: amount, Reason: "nothing"}); !errors.Is(err, ordererrors.RefundAmountInvalid) {
			t.Fatalf("an amount of %d is refused, never treated as a full refund: %v", amount, err)
		}
	}
	other := services.SellerContext{Store: commerceports.StoreAccess{StoreId: uuid.New()}, ActorId: uuid.New()}
	if err := services.RefundSellerOrder(ctx, module.Container, other, escrowOrder, services.SellerRefundRequest{AmountMinor: 1_000, Reason: "not mine"}); !errors.Is(err, ordererrors.OrderNotFound) {
		t.Fatalf("another store's order is not found: %v", err)
	}
	if err := services.RefundSellerOrder(ctx, module.Container, seller, escrowOrder, services.SellerRefundRequest{AmountMinor: 100_000, Reason: "one item damaged"}); err != nil {
		t.Fatalf("partial refund while escrow is held: %v", err)
	}
	if err := services.RefundSellerOrder(ctx, module.Container, seller, escrowOrder, services.SellerRefundRequest{AmountMinor: 100_000, Reason: "one item damaged"}); !errors.Is(err, ordererrors.OrderNotRefundable) {
		t.Fatalf("a second refund is refused while the first is on its way: %v", err)
	}
	module.Container.Money = fakeEscrowMoney{status: "released"}
	if err := services.RefundSellerOrder(ctx, module.Container, seller, directOrder, services.SellerRefundRequest{AmountMinor: 50_000, Reason: "partial direct"}); !errors.Is(err, ordererrors.OrderRefundOnlyInFull) {
		t.Fatalf("a direct order is refunded only in full: %v", err)
	}
	if err := services.RefundSellerOrder(ctx, module.Container, seller, directOrder, services.SellerRefundRequest{AmountMinor: 300_000, Reason: "full direct"}); err != nil {
		t.Fatalf("full direct refund: %v", err)
	}
	module.Container.Money = fakeEscrowMoney{status: "disputed"}
	disputed := create("ZM-RF-0003", "escrow")
	if err := services.RefundSellerOrder(ctx, module.Container, seller, disputed, services.SellerRefundRequest{AmountMinor: 1_000, Reason: "during dispute"}); !errors.Is(err, ordererrors.OrderRefundDisputed) {
		t.Fatalf("refunds wait for the dispute: %v", err)
	}
	requested, err := module.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType("orderGroup.refundRequested")).Count(ctx)
	if err != nil || requested != 2 {
		t.Fatalf("one refund request per accepted refund: %d %v", requested, err)
	}
}
