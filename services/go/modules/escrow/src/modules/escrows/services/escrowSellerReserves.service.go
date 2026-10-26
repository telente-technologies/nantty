package services

import (
	"context"
	"database/sql"

	sellerreserves "nantty/modules/ledger/src/modules/sellerReserves"
)

// holdSaleInSellerWallet holds released sale money in the seller's wallet for the policy period.
// A seller under a staff reserve has the reserved share held for the longer reserve period.
func (service EscrowService) holdSaleInSellerWallet(ctx context.Context, transaction *sql.Tx, sellerUserId, reference string, amountMinor int64, currency string) error {
	hold := service.Container.Policy(ctx).SellerCreditHoldPeriod
	terms, err := sellerreserves.TermsFor(ctx, transaction, sellerUserId)
	if err != nil {
		return err
	}
	reserved := int64(0)
	if terms.HoldFor > hold {
		reserved = sellerreserves.ReserveAmount(amountMinor, terms.ReserveBps)
	}
	payments := service.Container.Payments
	if amountMinor-reserved > 0 {
		if err := payments.RecordWalletCreditHoldInTransaction(ctx, transaction, sellerUserId, reference, "sale", amountMinor-reserved, currency, hold); err != nil {
			return err
		}
	}
	if reserved <= 0 {
		return nil
	}
	return payments.RecordWalletCreditHoldInTransaction(ctx, transaction, sellerUserId, reference+":reserve", "sale", reserved, currency, terms.HoldFor)
}
