package verifyorderpayment

import (
	"context"
	"errors"
	"net/http"

	"nantty/modules/payments/src/constants"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/paymentintent"
	"nantty/modules/payments/src/modules/checkoutPayments/dtos"
	"nantty/modules/payments/src/modules/gateway"
	"nantty/modules/payments/src/modules/gateway/services"
	"nantty/platform/httpserver"
)

const newestPendingIntentsVerifiedWithProvider = 3

type Handler struct {
	Application *gateway.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.OrderPaymentStatusDto, error) {
	application := handler.Application
	database := application.Container.Resources.Database
	payables, err := application.Gateway.FindCheckoutPayablesForOrder(ctx, database, command.OrderId)
	if err != nil {
		return dtos.OrderPaymentStatusDto{}, err
	}
	buyerPayable := payables[0]
	for _, payable := range payables {
		if payable.OrderId == command.OrderId {
			buyerPayable = payable
			break
		}
	}
	if buyerPayable.BuyerUserId != command.BuyerUserId {
		return dtos.OrderPaymentStatusDto{}, httpserver.NewApiError(http.StatusNotFound, "ORDER_NOT_FOUND", "Order was not found.")
	}
	intents, err := application.Container.Client(database).PaymentIntent.Query().Where(
		paymentintent.PurposeEQ(paymentintent.Purpose(constants.PurposeOrderCheckout)), paymentintent.SubjectIDIn(command.OrderId, buyerPayable.CheckoutId), paymentintent.OwnerUserID(command.BuyerUserId),
	).Order(ent.Desc(paymentintent.FieldCreatedAt)).Limit(50).All(ctx)
	if err != nil {
		return dtos.OrderPaymentStatusDto{}, err
	}
	for _, intent := range intents {
		if intent.Status == paymentintent.StatusSucceeded {
			return dtos.OrderPaymentStatusDto{Status: "paid"}, nil
		}
	}
	statuses := make([]string, 0, len(intents))
	providerChecksLeft := newestPendingIntentsVerifiedWithProvider
	for _, intent := range intents {
		status := string(intent.Status)
		if intent.Status == paymentintent.StatusPending && providerChecksLeft > 0 {
			providerChecksLeft--
			view, err := application.Gateway.VerifyAndSettlePaymentIntentByReference(ctx, intent.Reference)
			if err != nil && !errors.Is(err, services.ErrPaymentAmountMismatch) {
				return dtos.OrderPaymentStatusDto{}, err
			}
			status = view.Status
		}
		statuses = append(statuses, status)
	}
	return dtos.OrderPaymentStatusDto{Status: SummarisePaymentStatuses(statuses)}, nil
}

func SummarisePaymentStatuses(newestFirst []string) string {
	for _, status := range newestFirst {
		if status == string(paymentintent.StatusSucceeded) {
			return "paid"
		}
	}
	if len(newestFirst) > 0 && newestFirst[0] == string(paymentintent.StatusFailed) {
		return "failed"
	}
	return "pending"
}
