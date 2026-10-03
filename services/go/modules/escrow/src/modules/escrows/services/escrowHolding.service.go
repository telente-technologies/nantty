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
	if len(payment.OrderPayables) != 1 {
		return fmt.Errorf("payment %s must cover exactly one seller order, got %d", payment.Reference, len(payment.OrderPayables))
	}
	payable := payment.OrderPayables[0]
	if payable.Currency != payment.Currency || payable.AmountMinor != payment.AmountMinor {
		return fmt.Errorf("order %s expects %d %s but %d %s was paid", payable.OrderId, payable.AmountMinor, payable.Currency, payment.AmountMinor, payment.Currency)
	}
	if payment.BeneficiaryUserId != payable.SellerUserId {
		return fmt.Errorf("order %s was paid into another seller's account", payable.OrderId)
	}
	return service.holdFundsForPaidOrder(ctx, transaction, payment, payable)
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
	sellerNet := payable.AmountMinor - payment.PlatformFeeMinor - payment.ProviderFeeMinor
	if sellerNet < 0 {
		return fmt.Errorf("order %s fees exceed the amount paid", payable.OrderId)
	}
	now := service.Container.Now().UTC()
	direct := payable.PaymentMode == "direct"
	create := client.Escrow.Create().
		SetOrderID(payable.OrderId).SetOrderReference(payable.OrderReference).SetCheckoutID(payable.CheckoutId).
		SetPaymentIntentID(payment.IntentId).SetPaymentReference(payment.Reference).SetProvider(payment.Provider).
		SetBuyerUserID(payable.BuyerUserId).SetStoreID(payable.StoreId).SetSellerUserID(payable.SellerUserId).
		SetProductSummary(payable.ProductSummary).SetAmountMinor(payable.AmountMinor).SetCurrency(payable.Currency).
		SetCommissionBps(service.Container.Settings.PlatformCommissionBps).SetCommissionMinor(payment.PlatformFeeMinor).
		SetProcessingFeeMinor(payment.ProviderFeeMinor).SetSellerAmountMinor(sellerNet).SetCreatedAt(now)
	if direct {
		create.SetPaymentMode(escrow.PaymentModeDirect).SetStatus(escrow.StatusReleased).SetReleasedAt(now).
			SetReleaseTrigger("directPayment").SetReleasedToSellerMinor(sellerNet)
	}
	held, err := create.Save(ctx)
	if err != nil {
		return fmt.Errorf("insert escrow for order %s: %w", payable.OrderId, err)
	}
	awaiting := ledgermodels.JournalLineRequest{Account: ledgermodels.PaymentsAwaitingApplicationAccount(payable.Currency), Direction: ledgermodels.Debit, AmountMinor: payment.AppliedAmountMinor}
	if direct {
		err = service.creditSellerAndPlatform(ctx, transaction, held, awaiting, ledgermodels.PlatformCommissionRevenueAccount(held.Currency), "direct-payment:"+payable.OrderId, "Order "+payable.OrderReference+" paid directly")
	} else {
		lines := []ledgermodels.JournalLineRequest{awaiting}
		lines = appendPositiveCredit(lines, ledgermodels.SellerEscrowAccount(held.SellerUserID, held.ID.String(), payable.Currency), sellerNet)
		lines = appendPositiveCredit(lines, ledgermodels.PlatformFeesUnearnedAccount(payable.Currency), held.CommissionMinor)
		_, err = service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: "escrow-hold:" + payable.OrderId, Kind: "escrow.held", Description: "Order " + payable.OrderReference + " held in escrow inside the seller's provider account",
			Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": payable.OrderId, "paymentReference": payment.Reference}, Lines: lines,
		})
	}
	if err != nil {
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

func (service EscrowService) creditSellerAndPlatform(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, source ledgermodels.JournalLineRequest, platformFeeSource ledgermodels.AccountRef, reference, description string) error {
	lines := []ledgermodels.JournalLineRequest{source}
	lines = appendPositiveCredit(lines, ledgermodels.SellerPendingAccount(held.SellerUserID, held.Currency), held.SellerAmountMinor)
	if platformFeeSource.Code == ledgermodels.PlatformCommissionRevenueAccount(held.Currency).Code {
		lines = appendPositiveCredit(lines, platformFeeSource, held.CommissionMinor)
	} else if held.CommissionMinor > 0 {
		lines = append(lines,
			ledgermodels.JournalLineRequest{Account: platformFeeSource, Direction: ledgermodels.Debit, AmountMinor: held.CommissionMinor},
			ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformCommissionRevenueAccount(held.Currency), Direction: ledgermodels.Credit, AmountMinor: held.CommissionMinor})
	}
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
		"escrowId": held.ID.String(), "orderId": held.OrderID, "orderNumber": held.OrderReference, "checkoutId": held.CheckoutID, "storeId": held.StoreID,
		"buyerUserId": held.BuyerUserID, "sellerUserId": held.SellerUserID, "status": string(held.Status),
		"amount":           map[string]any{"amountMinor": held.AmountMinor, "currency": held.Currency},
		"processingFee":    map[string]any{"amountMinor": held.ProcessingFeeMinor, "currency": held.Currency},
		"commission":       map[string]any{"amountMinor": held.CommissionMinor, "currency": held.Currency},
		"refunded":         map[string]any{"amountMinor": held.RefundedMinor, "currency": held.Currency},
		"releasedToSeller": map[string]any{"amountMinor": held.ReleasedToSellerMinor, "currency": held.Currency},
	}
}
