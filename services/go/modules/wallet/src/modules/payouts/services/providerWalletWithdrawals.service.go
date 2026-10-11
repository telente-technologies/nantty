package services

import (
	"context"
	"database/sql"
	"net/http"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentutils "zudomart/modules/payments/src/utils"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/platform/httpserver"
)

var (
	ErrWalletDebtOutstanding     = httpserver.NewApiError(http.StatusConflict, "WALLET_DEBT_OUTSTANDING", "Clear the amount you owe before withdrawing. Add money or wait for incoming funds.")
	ErrPayoutAccountNameMismatch = httpserver.NewApiError(http.StatusUnprocessableEntity, "PAYOUT_ACCOUNT_NAME_MISMATCH", "Withdrawals go only to a bank account in your own verified name.")
)

func (withdrawals Withdrawals) requireProviderWalletPayoutAllowed(ctx context.Context, transaction *sql.Tx, userId, currency string, account *ent.PayoutAccount) error {
	balances, err := ReadUserWalletBalances(ctx, withdrawals.Container, transaction, userId, currency)
	if err != nil {
		return err
	}
	if balances.DebtsMinor() > 0 {
		return ErrWalletDebtOutstanding
	}
	wallet, err := withdrawals.Container.Payments.FindActiveProviderWallet(ctx, transaction, userId)
	if err != nil {
		return err
	}
	if !paymentutils.NamesMatch(wallet.AccountName, account.AccountName) {
		return ErrPayoutAccountNameMismatch
	}
	return nil
}

func (withdrawals Withdrawals) payoutSourceAccount(ctx context.Context, transaction *sql.Tx, withdrawal *ent.Withdrawal, provider string) (ledgermodels.AccountRef, error) {
	wallet, err := withdrawals.Container.Payments.FindProviderWallet(ctx, transaction, withdrawal.UserID)
	if err != nil {
		return ledgermodels.AccountRef{}, err
	}
	return ledgermodels.ProviderWalletMirrorAccount(wallet.Provider, wallet.AccountRef, withdrawal.Currency), nil
}
