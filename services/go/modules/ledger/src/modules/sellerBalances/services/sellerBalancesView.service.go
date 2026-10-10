package services

import (
	"context"
	"time"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/ledger/src/generated/ent"
	"zudomart/modules/ledger/src/generated/ent/sellercreditmaturity"
	"zudomart/modules/ledger/src/modules/journal/models"
)

type SellerBalancesView struct {
	Currency             string     `json:"currency"`
	AvailableMinor       int64      `json:"availableMinor"`
	LockedMinor          int64      `json:"lockedMinor"`
	InEscrowMinor        int64      `json:"inEscrowMinor"`
	PayoutRequestedMinor int64      `json:"payoutRequestedMinor"`
	DebtMinor            int64      `json:"debtMinor"`
	NextAvailableAt      *time.Time `json:"nextAvailableAt"`
}

func (view SellerBalancesView) WithdrawableMinor() int64 {
	return max(view.AvailableMinor-max(view.DebtMinor, 0), 0)
}

func (balances SellerBalances) ReadSellerBalances(ctx context.Context, executor databases.ExecutorQuerier, sellerUserId, currency string) (SellerBalancesView, error) {
	accounts := []models.AccountRef{
		models.SellerAvailableAccount(sellerUserId, currency), models.SellerPendingAccount(sellerUserId, currency),
		models.SellerReservedPayoutAccount(sellerUserId, currency), models.SellerDebtAccount(sellerUserId, currency),
	}
	values, err := balances.Ledger.ReadAccountBalances(ctx, executor, accounts)
	if err != nil {
		return SellerBalancesView{}, err
	}
	inEscrow, err := balances.Ledger.SumBalancesOfAccountsWithCodePrefix(ctx, executor, models.SellerEscrowAccountCodePrefix(sellerUserId), currency)
	if err != nil {
		return SellerBalancesView{}, err
	}
	view := SellerBalancesView{
		Currency: currency, AvailableMinor: values[accounts[0].Key()], LockedMinor: values[accounts[1].Key()],
		PayoutRequestedMinor: values[accounts[2].Key()], DebtMinor: values[accounts[3].Key()], InEscrowMinor: inEscrow,
	}
	next, err := balances.Ledger.EntClientForExecutorInLedgerSchema(executor).SellerCreditMaturity.Query().
		Where(sellercreditmaturity.SellerUserID(sellerUserId), sellercreditmaturity.Currency(currency), sellercreditmaturity.MaturedAtIsNil(), sellercreditmaturity.RemainingAmountMinorGT(0)).
		Order(ent.Asc(sellercreditmaturity.FieldAvailableAt)).First(ctx)
	if err == nil {
		availableAt := next.AvailableAt
		view.NextAvailableAt = &availableAt
	} else if !ent.IsNotFound(err) {
		return SellerBalancesView{}, err
	}
	return view, nil
}
