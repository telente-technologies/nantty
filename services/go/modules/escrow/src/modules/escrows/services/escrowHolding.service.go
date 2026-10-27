package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/container"
	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/platform/httpserver"
)

var (
	ErrEscrowNotFound         = httpserver.NewApiError(http.StatusNotFound, "ESCROW_NOT_FOUND", "No escrow exists for this order.")
	ErrInvalidFulfilmentStage = httpserver.NewApiError(http.StatusBadRequest, "INVALID_FULFILMENT_STAGE", "Fulfilment stage must be shipped or delivered.")
)

type EscrowService struct {
	Container *container.Container
}

func (service EscrowService) HandleSucceededPayment(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) error {
	if len(payment.GroupAllocations) > 0 {
		groupPayments, err := SplitCheckoutPaymentIntoGroups(payment)
		if err != nil {
			return err
		}
		for index, groupPayment := range groupPayments {
			if err := service.holdFundsForPaidOrder(ctx, transaction, groupPayment, payment.OrderPayables[index]); err != nil {
				return err
			}
		}
		return nil
	}
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

func SplitCheckoutPaymentIntoGroups(payment paymentmodels.SettledPayment) ([]paymentmodels.SettledPayment, error) {
	if len(payment.GroupAllocations) != len(payment.OrderPayables) {
		return nil, fmt.Errorf("payment %s covers %d groups but %d orders are registered", payment.Reference, len(payment.GroupAllocations), len(payment.OrderPayables))
	}
	byOrder := map[string]paymentmodels.SettledGroupAllocation{}
	var total int64
	for _, group := range payment.GroupAllocations {
		byOrder[group.OrderId] = group
		total += group.AmountMinor
	}
	if total != payment.AmountMinor {
		return nil, fmt.Errorf("payment %s paid %d but its groups total %d", payment.Reference, payment.AmountMinor, total)
	}
	groups := make([]paymentmodels.SettledPayment, len(payment.OrderPayables))
	for index, payable := range payment.OrderPayables {
		group, found := byOrder[payable.OrderId]
		if !found || group.AmountMinor != payable.AmountMinor || group.SellerUserId != payable.SellerUserId || group.PaymentMode != payable.PaymentMode || payable.Currency != payment.Currency {
			return nil, fmt.Errorf("order %s does not match the paid checkout allocation", payable.OrderId)
		}
		groupPayment := payment
		groupPayment.AmountMinor, groupPayment.AppliedAmountMinor, groupPayment.BeneficiaryUserId = group.AmountMinor, group.AppliedAmountMinor, group.SellerUserId
		groupPayment.PlatformFeeMinor, groupPayment.ProviderFeeMinor, groupPayment.ConnectedAccountId = group.EscrowFeeMinor, group.ProviderFeeMinor, group.Subaccount
		groupPayment.OrderPayables, groupPayment.GroupAllocations = []paymentmodels.OrderPayable{payable}, nil
		groups[index] = groupPayment
	}
	return groups, nil
}

func (service EscrowService) HandleFailedPayment(context.Context, *sql.Tx, paymentmodels.SettledPayment) error {
	return nil
}

func (service EscrowService) holdFundsForPaidOrder(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment, payable paymentmodels.OrderPayable) error {
	if !usesBuyerWallet(payment) {
		return fmt.Errorf("order %s was paid through %q; escrow only holds funds in Flutterwave wallets", payable.OrderId, payment.Provider)
	}
	return service.holdFundsInProviderWallets(ctx, transaction, payment, payable)
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
		"escrowId": held.ID.String(), "orderId": held.OrderID, "orderNumber": held.OrderReference, "checkoutId": held.CheckoutID, "storeId": held.StoreID,
		"buyerUserId": held.BuyerUserID, "sellerUserId": held.SellerUserID, "status": string(held.Status),
		"amount":           map[string]any{"amountMinor": held.AmountMinor, "currency": held.Currency},
		"processingFee":    map[string]any{"amountMinor": held.ProcessingFeeMinor, "currency": held.Currency},
		"commission":       map[string]any{"amountMinor": held.CommissionMinor, "currency": held.Currency},
		"refunded":         map[string]any{"amountMinor": held.RefundedMinor, "currency": held.Currency},
		"releasedToSeller": map[string]any{"amountMinor": held.ReleasedToSellerMinor, "currency": held.Currency},
		"refundBreakdown":  refundBreakdown(held),
	}
}

// FeesKeptOnRefund is what Nantty keeps when an order is refunded after the seller was paid: its escrow fee and the processing fee.
func FeesKeptOnRefund(held *ent.Escrow) int64 {
	if held.Status != escrow.StatusRefunded && held.Status != escrow.StatusClawedBack {
		return 0
	}
	return max(held.AmountMinor-held.RefundedMinor, 0)
}

func refundBreakdown(held *ent.Escrow) map[string]any {
	kept := FeesKeptOnRefund(held)
	if kept == 0 {
		return nil
	}
	processingFeeKept := min(held.ProcessingFeeMinor, kept)
	amount := func(minor int64) map[string]any {
		return map[string]any{"amountMinor": minor, "currency": held.Currency}
	}
	return map[string]any{"refundedToBuyer": amount(held.RefundedMinor), "escrowFeeKept": amount(kept - processingFeeKept), "processingFeeKept": amount(processingFeeKept)}
}

func escrowFeeBpsFor(feeMinor, amountMinor int64) int64 {
	if amountMinor <= 0 || feeMinor <= 0 {
		return 0
	}
	return (feeMinor*10_000 + amountMinor/2) / amountMinor
}
