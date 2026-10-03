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
	sellerbalances "zudomart/modules/ledger/src/modules/sellerBalances/services"
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
	direct := payable.PaymentMode == "direct"
	create := client.Escrow.Create().
		SetOrderID(payable.OrderId).SetOrderReference(payable.OrderReference).SetCheckoutID(payable.CheckoutId).
		SetPaymentIntentID(payment.IntentId).SetPaymentReference(payment.Reference).SetProvider(payment.Provider).
		SetBuyerUserID(payable.BuyerUserId).SetStoreID(payable.StoreId).SetSellerUserID(payable.SellerUserId).
		SetProductSummary(payable.ProductSummary).SetAmountMinor(payable.AmountMinor).SetCurrency(payable.Currency).
		SetCommissionBps(commissionBps).SetCommissionMinor(split.CommissionMinor).SetSellerAmountMinor(split.SellerAmountMinor).
		SetCreatedAt(now)
	if direct {
		create.SetPaymentMode(escrow.PaymentModeDirect).SetStatus(escrow.StatusReleased).SetReleasedAt(now).
			SetReleaseTrigger("directPayment").SetReleasedToSellerMinor(split.SellerAmountMinor)
	}
	held, err := create.Save(ctx)
	if err != nil {
		return fmt.Errorf("insert escrow for order %s: %w", payable.OrderId, err)
	}
	awaiting := ledgermodels.JournalLineRequest{Account: ledgermodels.PaymentsAwaitingApplicationAccount(payable.Currency), Direction: ledgermodels.Debit, AmountMinor: payable.AmountMinor}
	if direct {
		if err := service.creditSellerAndPlatform(ctx, transaction, held, awaiting, "direct-payment:"+payable.OrderId, "Order "+payable.OrderReference+" paid directly"); err != nil {
			return err
		}
	} else if _, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "escrow-hold:" + payable.OrderId, Kind: "escrow.held", Description: "Order " + payable.OrderReference + " paid into escrow",
		Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": payable.OrderId, "paymentReference": payment.Reference},
		Lines: []ledgermodels.JournalLineRequest{
			awaiting,
			{Account: ledgermodels.SellerEscrowAccount(held.SellerUserID, held.ID.String(), payable.Currency), Direction: ledgermodels.Credit, AmountMinor: payable.AmountMinor},
		},
	}); err != nil {
		return err
	}
	eventType, outboxType := "held", "escrow.held"
	if direct {
		eventType, outboxType = "paid_directly", "directPayment.received"
	}
	if err := service.recordEscrowEvent(ctx, client, held.ID, eventType, "system", "", map[string]any{"paymentReference": payment.Reference}); err != nil {
		return err
	}
	return service.Container.Outbox.EnqueueInTransaction(ctx, transaction, outboxType, held.OrderID, now, escrowEventData(held))
}

func (service EscrowService) creditSellerAndPlatform(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, source ledgermodels.JournalLineRequest, reference, description string) error {
	lines := []ledgermodels.JournalLineRequest{source}
	lines = appendPositiveCredit(lines, ledgermodels.SellerPendingAccount(held.SellerUserID, held.Currency), held.SellerAmountMinor)
	lines = appendPositiveCredit(lines, ledgermodels.PlatformCommissionRevenueAccount(held.Currency), held.CommissionMinor)
	if _, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: "sellerCredit.locked", Description: description,
		Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID}, Lines: lines,
	}); err != nil {
		return err
	}
	return service.Container.Sellers.ScheduleLockedCreditInTransaction(ctx, transaction, sellerbalances.LockedSellerCredit{
		SellerUserId: held.SellerUserID, Currency: held.Currency, AmountMinor: held.SellerAmountMinor,
		SourceReference: OrderCreditReference(held.OrderID), AvailableAt: service.Container.Now().Add(service.Container.Policy(ctx).SellerCreditHoldPeriod),
	})
}

func OrderCreditReference(orderId string) string { return "order-credit:" + orderId }

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
