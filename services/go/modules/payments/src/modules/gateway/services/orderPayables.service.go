package services

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/orderpayable"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

var (
	ErrCheckoutPayablesConflict = httpserver.NewApiError(http.StatusConflict, "CHECKOUT_PAYABLES_CONFLICT", "These orders were already registered with different amounts.")
	ErrDirectPaymentNotAllowed  = httpserver.NewApiError(http.StatusUnprocessableEntity, "DIRECT_PAYMENT_NOT_ALLOWED", "This store is not verified yet, so its orders can only be paid through escrow.")
)

func (gateway *PaymentGateway) RegisterCheckoutPayables(ctx context.Context, payables []models.OrderPayable) error {
	if len(payables) == 0 {
		return fmt.Errorf("a checkout needs at least one order")
	}
	checkoutId, buyerId, currency := payables[0].CheckoutId, payables[0].BuyerUserId, payables[0].Currency
	for index, payable := range payables {
		if payable.PaymentMode == "" {
			payables[index].PaymentMode, payable.PaymentMode = "escrow", "escrow"
		}
		if payable.PaymentMode != "escrow" && payable.PaymentMode != "direct" {
			return fmt.Errorf("payment mode must be escrow or direct")
		}
		if payable.PaymentMode == "direct" && !payable.StoreVerified {
			return ErrDirectPaymentNotAllowed
		}
		if payable.CheckoutId != checkoutId || payable.BuyerUserId != buyerId || payable.Currency != currency || payable.AmountMinor <= 0 {
			return fmt.Errorf("every order in a checkout must share checkout, buyer and currency and have a positive amount")
		}
	}
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		for _, payable := range payables {
			existing, err := client.OrderPayable.Query().Where(orderpayable.OrderID(payable.OrderId)).Only(ctx)
			if err == nil {
				if ConvertOrderPayable(existing) != payable {
					return ErrCheckoutPayablesConflict
				}
				continue
			}
			if !ent.IsNotFound(err) {
				return err
			}
			err = client.OrderPayable.Create().
				SetCheckoutID(payable.CheckoutId).SetOrderID(payable.OrderId).SetOrderReference(payable.OrderReference).
				SetBuyerUserID(payable.BuyerUserId).SetStoreID(payable.StoreId).SetSellerUserID(payable.SellerUserId).
				SetAmountMinor(payable.AmountMinor).SetCurrency(payable.Currency).SetProductSummary(truncate(payable.ProductSummary, 300)).
				SetPaymentMode(orderpayable.PaymentMode(payable.PaymentMode)).SetStoreVerified(payable.StoreVerified).
				SetCreatedAt(gateway.Container.Now()).Exec(ctx)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (gateway *PaymentGateway) FindCheckoutPayablesForOrder(ctx context.Context, executor databases.ExecutorQuerier, orderId string) ([]models.OrderPayable, error) {
	client := gateway.Container.Client(executor)
	payable, err := client.OrderPayable.Query().Where(orderpayable.OrderID(orderId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, httpserver.NewApiError(http.StatusNotFound, "ORDER_NOT_FOUND", "Order was not found.")
	}
	if err != nil {
		return nil, err
	}
	return gateway.FindPayablesForCheckout(ctx, executor, payable.CheckoutID)
}

func (gateway *PaymentGateway) FindPayablesForCheckout(ctx context.Context, executor databases.ExecutorQuerier, checkoutId string) ([]models.OrderPayable, error) {
	siblings, err := gateway.Container.Client(executor).OrderPayable.Query().Where(orderpayable.CheckoutID(checkoutId)).Order(ent.Asc(orderpayable.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	converted := make([]models.OrderPayable, len(siblings))
	for index, sibling := range siblings {
		converted[index] = ConvertOrderPayable(sibling)
	}
	return converted, nil
}
