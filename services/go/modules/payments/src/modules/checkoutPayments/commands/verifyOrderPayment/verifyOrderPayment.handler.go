package verifyorderpayment

import (
	"context"
	"errors"
	"net/http"

	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/modules/checkoutPayments/dtos"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/platform/httpserver"
)

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
	if payables[0].BuyerUserId != command.BuyerUserId {
		return dtos.OrderPaymentStatusDto{}, httpserver.NewApiError(http.StatusNotFound, "ORDER_NOT_FOUND", "Order was not found.")
	}
	intents, err := application.Container.Client(database).PaymentIntent.Query().Where(
		paymentintent.PurposeEQ(paymentintent.Purpose(constants.PurposeOrderCheckout)), paymentintent.SubjectIDIn(command.OrderId, payables[0].CheckoutId), paymentintent.OwnerUserID(command.BuyerUserId),
	).Order(ent.Desc(paymentintent.FieldCreatedAt)).Limit(10).All(ctx)
	if err != nil {
		return dtos.OrderPaymentStatusDto{}, err
	}
	statuses := make([]string, 0, len(intents))
	for _, intent := range intents {
		status := string(intent.Status)
		if intent.Status == paymentintent.StatusPending {
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
