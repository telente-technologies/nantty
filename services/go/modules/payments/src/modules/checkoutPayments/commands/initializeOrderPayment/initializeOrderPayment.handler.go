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
	"zudomart/modules/payments/src/modules/gateway/services"
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
	initialized, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.PaymentInitializationDto]{
		Scope:       command.BuyerUserId + ":payments.initialize",
		Key:         command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(command.OrderId, command.Provider, command.ReturnTo),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.PaymentInitializationDto, error) {
			payables, err := application.Gateway.FindCheckoutPayablesForOrder(ctx, transaction, command.OrderId)
			if err != nil {
				return dtos.PaymentInitializationDto{}, err
			}
			payable, found := payableForOrder(payables, command.OrderId)
			if !found || payable.BuyerUserId != command.BuyerUserId {
				return dtos.PaymentInitializationDto{}, httpserver.NewApiError(http.StatusNotFound, "ORDER_NOT_FOUND", "Order was not found.")
			}
			direct := payable.PaymentMode == "direct"
			escrowFee := int64(0)
			if !direct {
				escrowFee = services.EscrowFeeForAmount(payable.AmountMinor, application.Gateway.EscrowFeeBpsForSeller(ctx, payable.SellerUserId))
			}
			payment, err := application.Gateway.CreatePendingPaymentIntentInTransaction(ctx, transaction, models.CreatePaymentIntentRequest{
				Purpose: constants.PurposeOrderCheckout, OwnerUserId: command.BuyerUserId, SubjectId: payable.OrderId,
				Provider: command.Provider, AmountMinor: payable.AmountMinor, Currency: payable.Currency, ReturnTo: command.ReturnTo,
				BeneficiaryUserId: payable.SellerUserId, PlatformFeeMinor: escrowFee, SettleToSellerSubaccount: direct,
				Metadata: map[string]string{"checkoutId": payable.CheckoutId, "orderId": payable.OrderId, "paymentMode": payable.PaymentMode},
			})
			if err != nil {
				return dtos.PaymentInitializationDto{}, err
			}
			return dtos.PaymentInitializationDto{
				OrderId: command.OrderId, Reference: payment.Reference, CallbackUrl: payment.CallbackUrl, PaymentsRemainingInCheckout: len(payables), Payment: payment,
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

func payableForOrder(payables []models.OrderPayable, orderId string) (models.OrderPayable, bool) {
	for _, payable := range payables {
		if payable.OrderId == orderId {
			return payable, true
		}
	}
	return models.OrderPayable{}, false
}
