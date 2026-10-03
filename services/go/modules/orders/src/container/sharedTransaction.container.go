package container

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	"zudomart/modules/orders/src/generated/ent"
)

type sharedTransactionDriver struct {
	entsql.Conn
	transaction *sql.Tx
}

func (driver sharedTransactionDriver) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return driver.transaction.ExecContext(ctx, query, args...)
}

func (driver sharedTransactionDriver) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return driver.transaction.QueryContext(ctx, query, args...)
}

func (driver sharedTransactionDriver) Tx(context.Context) (dialect.Tx, error) {
	return sharedTransaction{driver}, nil
}

type sharedTransaction struct {
	sharedTransactionDriver
}

func (sharedTransaction) Commit() error   { return nil }
func (sharedTransaction) Rollback() error { return nil }

func (sharedTransactionDriver) Close() error    { return nil }
func (sharedTransactionDriver) Dialect() string { return dialect.Postgres }

func (container *Container) RunInSharedTransaction(ctx context.Context, work func(tx *ent.Tx, transaction *sql.Tx) error) error {
	var lastError error
	for attempt := 1; attempt <= 5; attempt++ {
		lastError = container.runSharedOnce(ctx, work)
		if lastError == nil || !isRetryableConflict(lastError) {
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

func (container *Container) runSharedOnce(ctx context.Context, work func(tx *ent.Tx, transaction *sql.Tx) error) error {
	transaction, err := container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return fmt.Errorf("begin shared transaction: %w", err)
	}
	tx, err := ent.NewClient(ent.Driver(sharedTransactionDriver{Conn: entsql.Conn{ExecQuerier: transaction}, transaction: transaction})).Tx(ctx)
	if err != nil {
		return errors.Join(err, transaction.Rollback())
	}
	if err := work(tx, transaction); err != nil {
		return errors.Join(err, transaction.Rollback())
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit shared transaction: %w", err)
	}
	return nil
}
