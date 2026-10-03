package initializeorderpayment

import (
	"context"
	"database/sql"
	"net/http"
	"strings"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/modules/checkoutPayments/dtos"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

var errOrderNotFound = httpserver.NewApiError(http.StatusNotFound, "ORDER_NOT_FOUND", "Order was not found.")

type Handler struct {
	Application *gateway.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PaymentInitializationDto, bool, error) {
	application := handler.Application
	if !application.Gateway.IsAllowedReturnUrl(command.ReturnTo) {
		return dtos.PaymentInitializationDto{}, false, httpserver.NewApiError(http.StatusUnprocessableEntity, "RETURN_URL_NOT_ALLOWED", "This return address is not allowed.")
	}
	initialized, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.PaymentInitializationDto]{
		Scope:       command.BuyerUserId + ":payments.initialize",
		Key:         command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(command.OrderId, command.CheckoutId, command.Provider, command.ReturnTo),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.PaymentInitializationDto, error) {
			payables, err := handler.findCheckoutPayables(ctx, transaction, command)
			if err != nil {
				return dtos.PaymentInitializationDto{}, err
			}
			groups, total, currency, err := application.Gateway.AllocateCheckoutPayables(ctx, transaction, payables)
			if err != nil {
				return dtos.PaymentInitializationDto{}, err
			}
			orderIds := make([]string, 0, len(payables))
			for _, payable := range payables {
				orderIds = append(orderIds, payable.OrderId)
			}
			checkoutId := payables[0].CheckoutId
			payment, err := application.Gateway.CreatePendingPaymentIntentInTransaction(ctx, transaction, models.CreatePaymentIntentRequest{
				Purpose: constants.PurposeOrderCheckout, OwnerUserId: command.BuyerUserId, SubjectId: checkoutId,
				Provider: command.Provider, AmountMinor: total, Currency: currency, ReturnTo: command.ReturnTo,
				Metadata: map[string]string{"checkoutId": checkoutId, "orderIds": strings.Join(orderIds, ","), models.CheckoutGroupsMetadataKey: models.EncodeCheckoutGroups(groups)},
			})
			if err != nil {
				return dtos.PaymentInitializationDto{}, err
			}
			return dtos.PaymentInitializationDto{
				OrderId: command.OrderId, CheckoutId: checkoutId, Reference: payment.Reference, CallbackUrl: payment.CallbackUrl, PaymentsRemainingInCheckout: 1, Payment: payment,
			}, nil
		},
	})
	if err != nil {
		return initialized, replayed, err
	}
	opened, err := application.Gateway.OpenProviderCheckoutForIntent(ctx, initialized.Payment.Id)
	if err != nil {
		return initialized, replayed, err
	}
	if opened.CheckoutUrl != nil {
		initialized.CheckoutUrl, initialized.AuthorizationUrl = *opened.CheckoutUrl, *opened.CheckoutUrl
	}
	initialized.Payment = opened
	return initialized, replayed, nil
}

func (handler Handler) findCheckoutPayables(ctx context.Context, transaction *sql.Tx, command Command) ([]models.OrderPayable, error) {
	gateway := handler.Application.Gateway
	var payables []models.OrderPayable
	var err error
	if command.CheckoutId != "" {
		payables, err = gateway.FindPayablesForCheckout(ctx, transaction, command.CheckoutId)
	} else {
		payables, err = gateway.FindCheckoutPayablesForOrder(ctx, transaction, command.OrderId)
	}
	if err != nil {
		return nil, err
	}
	if len(payables) == 0 {
		return nil, errOrderNotFound
	}
	for _, payable := range payables {
		if payable.BuyerUserId != command.BuyerUserId {
			return nil, errOrderNotFound
		}
	}
	return payables, nil
}
