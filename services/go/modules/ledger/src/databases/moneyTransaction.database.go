package databases

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

const maximumAttemptsForRetryableConflicts = 5

var retryablePostgresErrorCodes = map[string]bool{"40001": true, "40P01": true}

func IsRetryablePostgresConflict(err error) bool {
	var postgresError *pgconn.PgError
	return errors.As(err, &postgresError) && retryablePostgresErrorCodes[postgresError.Code]
}

func IsUniqueViolation(err error) bool {
	var postgresError *pgconn.PgError
	return errors.As(err, &postgresError) && postgresError.Code == "23505"
}

func RunInMoneyTransaction(ctx context.Context, database *sql.DB, work func(ctx context.Context, transaction *sql.Tx) error) error {
	var lastError error
	for attempt := 1; attempt <= maximumAttemptsForRetryableConflicts; attempt++ {
		lastError = runOnce(ctx, database, work)
		if lastError == nil || !IsRetryablePostgresConflict(lastError) {
			return lastError
		}
		select {
		case <-ctx.Done():
			return errors.Join(lastError, ctx.Err())
		case <-time.After(time.Duration(attempt*attempt) * 5 * time.Millisecond):
		}
	}
	return lastError
}

func runOnce(ctx context.Context, database *sql.DB, work func(ctx context.Context, transaction *sql.Tx) error) (err error) {
	transaction, err := database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return fmt.Errorf("begin money transaction: %w", err)
	}
	defer func() {
		if recovered := recover(); recovered != nil {
			_ = transaction.Rollback()
			panic(recovered)
		}
	}()
	if err := work(ctx, transaction); err != nil {
		return errors.Join(err, ignoreAlreadyDone(transaction.Rollback()))
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit money transaction: %w", err)
	}
	return nil
}

func ignoreAlreadyDone(err error) error {
	if errors.Is(err, sql.ErrTxDone) {
		return nil
	}
	return err
}
