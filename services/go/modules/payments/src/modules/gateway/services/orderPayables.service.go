package services

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/orderpayable"
	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/platform/httpserver"
	"nantty/platform/money"
)

var (
	ErrCheckoutPayablesConflict = httpserver.NewApiError(http.StatusConflict, "CHECKOUT_PAYABLES_CONFLICT", "These orders were already registered with different amounts.")
	ErrCheckoutPayablesInvalid  = httpserver.NewApiError(http.StatusBadRequest, "CHECKOUT_PAYABLES_INVALID", "Checkout orders must have positive amounts and use one valid currency.")
	ErrDirectPaymentNotAllowed  = httpserver.NewApiError(http.StatusUnprocessableEntity, "DIRECT_PAYMENT_NOT_ALLOWED", "This store is not verified yet, so its orders can only be paid through escrow.")
)

func (gateway *PaymentGateway) RegisterCheckoutPayables(ctx context.Context, payables []models.OrderPayable) error {
	if len(payables) == 0 {
		return fmt.Errorf("a checkout needs at least one order")
	}
	if err := validateCheckoutPayableMoney(payables); err != nil {
		return err
	}
	checkoutId, buyerId, currency := payables[0].CheckoutId, payables[0].BuyerUserId, payables[0].Currency
	provider, err := gateway.Container.Provider(gateway.Container.Settings.DefaultProvider)
	if err != nil {
		return err
	}
	if !provider.SupportsCurrency(currency) {
		return ErrCurrencyNotSupported
	}
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
	if err := gateway.applyCheckoutRules(ctx, payables); err != nil {
		return err
	}
	err = gateway.registerCheckoutPayablesOnce(ctx, payables)
	if ent.IsConstraintError(err) {
		err = gateway.registerCheckoutPayablesOnce(ctx, payables)
	}
	return err
}

func validateCheckoutPayableMoney(payables []models.OrderPayable) error {
	if len(payables) == 0 {
		return fmt.Errorf("a checkout needs at least one order")
	}
	currency := payables[0].Currency
	if _, err := money.ParseCurrencyCode(currency); err != nil {
		return ErrCurrencyNotSupported
	}
	for _, payable := range payables {
		if payable.AmountMinor <= 0 {
			return ErrCheckoutPayablesInvalid
		}
		if payable.Currency != currency {
			return ErrCheckoutPayablesInvalid
		}
	}
	return nil
}

func (gateway *PaymentGateway) registerCheckoutPayablesOnce(ctx context.Context, payables []models.OrderPayable) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		fresh := []models.OrderPayable{}
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
			fresh = append(fresh, payable)
		}
		if err := gateway.enforceUnverifiedSellerRulesInTransaction(ctx, transaction, fresh); err != nil {
			return err
		}
		for _, payable := range fresh {
			err := client.OrderPayable.Create().
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

func (gateway *PaymentGateway) applyCheckoutRules(ctx context.Context, payables []models.OrderPayable) error {
	checked := map[string]bool{}
	for index, payable := range payables {
		if err := gateway.RequireOrderAmountWithinLimit(ctx, payable.Currency, payable.AmountMinor); err != nil {
			return err
		}
		if !checked[payable.SellerUserId] {
			if err := gateway.RequireSellerMaySell(ctx, payable.SellerUserId); err != nil {
				return err
			}
			checked[payable.SellerUserId] = true
		}
		if payable.Currency != walletCurrency {
			payables[index].PaymentMode = "direct"
		}
	}
	return nil
}
