package services

import (
	"context"
	"database/sql"
)

func (withdrawals Withdrawals) LockUserCashForWithdrawal(ctx context.Context, transaction *sql.Tx, userId, currency string) error {
	_, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "wallet-cash:"+userId+":"+currency)
	return err
}
