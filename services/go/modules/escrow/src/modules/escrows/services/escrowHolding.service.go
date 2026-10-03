package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/container"
	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/modules/escrows/models"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

var (
	ErrEscrowNotFound         = httpserver.NewApiError(http.StatusNotFound, "ESCROW_NOT_FOUND", "No escrow exists for this order.")
	ErrInvalidFulfilmentStage = httpserver.NewApiError(http.StatusBadRequest, "INVALID_FULFILMENT_STAGE", "Fulfilment stage must be shipped or delivered.")
)

type EscrowService struct {
	Container *container.Container
}

func (service EscrowService) HandleSucceededPayment(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) error {
	var total int64
	for _, payable := range payment.OrderPayables {
		if payable.Currency != payment.Currency {
			return fmt.Errorf("order %s is in %s but the payment is in %s", payable.OrderId, payable.Currency, payment.Currency)
		}
		total += payable.AmountMinor
	}
	if total != payment.AmountMinor {
		return fmt.Errorf("checkout %s orders total %d but %d was paid", payment.SubjectId, total, payment.AmountMinor)
	}
	for _, payable := range payment.OrderPayables {
		if err := service.holdFundsForPaidOrder(ctx, transaction, payment, payable); err != nil {
			return err
		}
	}
	return nil
}

func (service EscrowService) HandleFailedPayment(context.Context, *sql.Tx, paymentmodels.SettledPayment) error {
	return nil
}

func (service EscrowService) holdFundsForPaidOrder(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment, payable paymentmodels.OrderPayable) error {
	client := service.Container.Client(transaction)
	exists, err := client.Escrow.Query().Where(escrow.OrderID(payable.OrderId)).Exist(ctx)
	if err != nil || exists {
		return err
	}
	commissionBps := service.Container.Settings.PlatformCommissionBps
	split, err := models.SplitAmountBetweenSellerAndPlatform(payable.AmountMinor, commissionBps)
	if err != nil {
		return err
	}
	now := service.Container.Now().UTC()
	held, err := client.Escrow.Create().
		SetOrderID(payable.OrderId).SetOrderReference(payable.OrderReference).SetCheckoutID(payable.CheckoutId).
		SetPaymentIntentID(payment.IntentId).SetPaymentReference(payment.Reference).SetProvider(payment.Provider).
		SetBuyerUserID(payable.BuyerUserId).SetStoreID(payable.StoreId).SetSellerUserID(payable.SellerUserId).
		SetProductSummary(payable.ProductSummary).SetAmountMinor(payable.AmountMinor).SetCurrency(payable.Currency).
		SetCommissionBps(commissionBps).SetCommissionMinor(split.CommissionMinor).SetSellerAmountMinor(split.SellerAmountMinor).
		SetCreatedAt(now).Save(ctx)
	if err != nil {
		return fmt.Errorf("insert escrow for order %s: %w", payable.OrderId, err)
	}
	_, err = service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "escrow-hold:" + payable.OrderId, Kind: "escrow.held", Description: "Order " + payable.OrderReference + " paid into escrow",
		Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": payable.OrderId, "paymentReference": payment.Reference},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.PaymentsAwaitingApplicationAccount(payable.Currency), Direction: ledgermodels.Debit, AmountMinor: payable.AmountMinor},
			{Account: ledgermodels.EscrowHoldingAccount(held.ID.String(), payable.Currency), Direction: ledgermodels.Credit, AmountMinor: payable.AmountMinor},
		},
	})
	if err != nil {
		return err
	}
	if err := service.recordEscrowEvent(ctx, client, held.ID, "held", "system", "", map[string]any{"paymentReference": payment.Reference}); err != nil {
		return err
	}
	return service.Container.Outbox.EnqueueInTransaction(ctx, transaction, "escrow.held", held.OrderID, now, escrowEventData(held))
}

func (service EscrowService) recordEscrowEvent(ctx context.Context, client *ent.Client, escrowId uuid.UUID, eventType, actorType, actorId string, details map[string]any) error {
	encoded, err := json.Marshal(details)
	if err != nil {
		return err
	}
	return client.EscrowEvent.Create().SetEscrowID(escrowId).SetEventType(eventType).SetActorType(actorType).SetActorID(actorId).
		SetDetails(encoded).SetCreatedAt(service.Container.Now().UTC()).Exec(ctx)
}

func (service EscrowService) LockEscrowForOrder(ctx context.Context, client *ent.Client, orderId string) (*ent.Escrow, error) {
	held, err := client.Escrow.Query().Where(escrow.OrderID(orderId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrEscrowNotFound
	}
	return held, err
}

func escrowEventData(held *ent.Escrow) map[string]any {
	return map[string]any{
		"escrowId": held.ID.String(), "orderId": held.OrderID, "checkoutId": held.CheckoutID, "storeId": held.StoreID,
		"buyerUserId": held.BuyerUserID, "sellerUserId": held.SellerUserID, "status": string(held.Status),
		"amount":           map[string]any{"amountMinor": held.AmountMinor, "currency": held.Currency},
		"commission":       map[string]any{"amountMinor": held.CommissionMinor, "currency": held.Currency},
		"refunded":         map[string]any{"amountMinor": held.RefundedMinor, "currency": held.Currency},
		"releasedToSeller": map[string]any{"amountMinor": held.ReleasedToSellerMinor, "currency": held.Currency},
	}
}
