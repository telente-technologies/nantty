package initializeorderpayment

import (
	"context"
	"database/sql"
	"net/http"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/modules/checkoutPayments/dtos"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Application *gateway.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PaymentInitializationDto, bool, error) {
	application := handler.Application
	if !application.Gateway.IsAllowedReturnUrl(command.ReturnTo) {
		return dtos.PaymentInitializationDto{}, false, httpserver.NewApiError(http.StatusUnprocessableEntity, "RETURN_URL_NOT_ALLOWED", "This return address is not allowed.")
	}
	return ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.PaymentInitializationDto]{
		Scope:       command.BuyerUserId + ":payments.initialize",
		Key:         command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(command.OrderId, command.Provider, command.ReturnTo),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.PaymentInitializationDto, error) {
			payables, err := application.Gateway.FindCheckoutPayablesForOrder(ctx, transaction, command.OrderId)
			if err != nil {
				return dtos.PaymentInitializationDto{}, err
			}
			if payables[0].BuyerUserId != command.BuyerUserId {
				return dtos.PaymentInitializationDto{}, httpserver.NewApiError(http.StatusNotFound, "ORDER_NOT_FOUND", "Order was not found.")
			}
			var total int64
			for _, payable := range payables {
				total += payable.AmountMinor
			}
			payment, err := application.Gateway.CreatePaymentIntentAndInitializeChargeInTransaction(ctx, transaction, models.CreatePaymentIntentRequest{
				Purpose: constants.PurposeOrderCheckout, OwnerUserId: command.BuyerUserId, SubjectId: payables[0].CheckoutId,
				Provider: command.Provider, AmountMinor: total, Currency: payables[0].Currency, ReturnTo: command.ReturnTo,
				Metadata: map[string]string{"checkoutId": payables[0].CheckoutId, "orderId": command.OrderId},
			})
			if err != nil {
				return dtos.PaymentInitializationDto{}, err
			}
			authorizationUrl := ""
			if payment.AuthorizationUrl != nil {
				authorizationUrl = *payment.AuthorizationUrl
			}
			return dtos.PaymentInitializationDto{OrderId: command.OrderId, Reference: payment.Reference, AuthorizationUrl: authorizationUrl, CallbackUrl: payment.CallbackUrl, Payment: payment}, nil
		},
	})
}
