package services

import (
	"context"
	"database/sql"
	"fmt"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
)

type OutstandingDebts struct {
	AvailableMinor   int64
	SellerDebtMinor  int64
	CreatorDebtMinor int64
}

func (debts OutstandingDebts) TotalMinor() int64 {
	return debts.SellerDebtMinor + debts.CreatorDebtMinor
}

func (debts OutstandingDebts) WithdrawableMinor() int64 {
	return max(debts.AvailableMinor-debts.TotalMinor(), 0)
}

func (withdrawals Withdrawals) LockUserCashForWithdrawal(ctx context.Context, transaction *sql.Tx, userId, currency string) error {
	_, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "wallet-cash:"+userId+":"+currency)
	return err
}

func (withdrawals Withdrawals) ReadOutstandingDebts(ctx context.Context, executor databases.ExecutorQuerier, userId, currency string) (OutstandingDebts, error) {
	accounts := []ledgermodels.AccountRef{
		ledgermodels.SellerAvailableAccount(userId, currency), ledgermodels.SellerDebtAccount(userId, currency), ledgermodels.CreatorEarningsDebtAccount(userId, currency),
	}
	balances, err := withdrawals.Container.Ledger.ReadAccountBalances(ctx, executor, accounts)
	if err != nil {
		return OutstandingDebts{}, err
	}
	return OutstandingDebts{
		AvailableMinor: balances[accounts[0].Key()], SellerDebtMinor: max(balances[accounts[1].Key()], 0), CreatorDebtMinor: max(balances[accounts[2].Key()], 0),
	}, nil
}

func (withdrawals Withdrawals) settleDebtsBeforeWithdrawal(ctx context.Context, transaction *sql.Tx, userId, currency, withdrawalId string) (int64, error) {
	debts, err := withdrawals.ReadOutstandingDebts(ctx, transaction, userId, currency)
	if err != nil || debts.TotalMinor() == 0 || debts.AvailableMinor <= 0 {
		return 0, err
	}
	fromSellerDebt := min(debts.AvailableMinor, debts.SellerDebtMinor)
	fromCreatorDebt := min(debts.AvailableMinor-fromSellerDebt, debts.CreatorDebtMinor)
	settled := fromSellerDebt + fromCreatorDebt
	lines := []ledgermodels.JournalLineRequest{{Account: ledgermodels.SellerAvailableAccount(userId, currency), Direction: ledgermodels.Debit, AmountMinor: settled}}
	if fromSellerDebt > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.SellerDebtAccount(userId, currency), Direction: ledgermodels.Credit, AmountMinor: fromSellerDebt})
	}
	if fromCreatorDebt > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.CreatorEarningsDebtAccount(userId, currency), Direction: ledgermodels.Credit, AmountMinor: fromCreatorDebt})
	}
	if _, err := withdrawals.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "withdrawal-debt-settlement:" + withdrawalId, Kind: "wallet.debtSettled", Description: fmt.Sprintf("Outstanding balance of %d settled before withdrawal", settled),
		Metadata: map[string]any{"withdrawalId": withdrawalId, "sellerDebtMinor": fromSellerDebt, "creatorDebtMinor": fromCreatorDebt}, Lines: lines,
	}); err != nil {
		return 0, err
	}
	return settled, nil
}
