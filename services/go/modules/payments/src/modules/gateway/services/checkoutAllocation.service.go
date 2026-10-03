package services

import (
	"context"
	"errors"
	"fmt"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

func (gateway *PaymentGateway) AllocateCheckoutPayables(ctx context.Context, executor databases.ExecutorQuerier, payables []models.OrderPayable) ([]models.CheckoutGroupAllocation, int64, string, error) {
	if len(payables) == 0 {
		return nil, 0, "", ErrPaymentNotFound
	}
	currency := payables[0].Currency
	groups := make([]models.CheckoutGroupAllocation, 0, len(payables))
	var total int64
	for _, payable := range payables {
		if payable.Currency != currency {
			return nil, 0, "", fmt.Errorf("checkout %s mixes currencies", payable.CheckoutId)
		}
		group := models.CheckoutGroupAllocation{OrderId: payable.OrderId, PaymentMode: payable.PaymentMode, SellerUserId: payable.SellerUserId, AmountMinor: payable.AmountMinor}
		if group.IsDirect() {
			account, err := gateway.FindConnectedAccountForUser(ctx, executor, payable.SellerUserId)
			if errors.Is(err, ErrConnectedAccountMissing) || (err == nil && !ConnectedAccountCanAcceptPayments(account)) {
				return nil, 0, "", ErrSellerNotReadyForPayments
			}
			if err != nil {
				return nil, 0, "", err
			}
			group.Subaccount = account.SettlementSubaccountCode
		} else {
			group.EscrowFeeMinor = EscrowFeeForAmount(payable.AmountMinor, gateway.EscrowFeeBpsForSeller(ctx, payable.SellerUserId))
		}
		groups = append(groups, group)
		total += payable.AmountMinor
	}
	allocated, err := models.AllocateCheckoutGroups(groups)
	return allocated, total, currency, err
}

func SplitSharesForGroups(groups []models.CheckoutGroupAllocation) []interfaces.SplitShare {
	var shares []interfaces.SplitShare
	for _, group := range groups {
		if group.IsDirect() && group.ShareMinor > 0 {
			shares = append(shares, interfaces.SplitShare{Subaccount: group.Subaccount, ShareMinor: group.ShareMinor})
		}
	}
	return shares
}
