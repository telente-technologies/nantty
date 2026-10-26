package services

import (
	"context"
	"database/sql"
	"fmt"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/jackc/pgx/v5"

	"nantty/modules/inventory/src/generated/ent"
	"nantty/platform/commerceports"
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

func (service ReservationService) ReserveWithin(ctx context.Context, transaction *sql.Tx, callerSchema string, request commerceports.ReserveStockRequest) error {
	lines, err := mergeStockLines(request.Lines)
	if err != nil || request.Reference == "" || len(lines) == 0 {
		return firstNonNil(err, fmt.Errorf("reference and lines are required"))
	}
	own := pgx.Identifier{service.Container.Settings.DatabaseSchema}.Sanitize()
	caller := pgx.Identifier{callerSchema}.Sanitize()
	if _, err := transaction.ExecContext(ctx, "SET LOCAL search_path TO "+own); err != nil {
		return err
	}
	tx, err := ent.NewClient(ent.Driver(sharedTransactionDriver{Conn: entsql.Conn{ExecQuerier: transaction}, transaction: transaction})).Tx(ctx)
	if err != nil {
		return err
	}
	reserveError := service.reserveInTransaction(ctx, tx, lines, request)
	if _, restoreError := transaction.ExecContext(ctx, "SET LOCAL search_path TO "+caller); restoreError != nil && reserveError == nil {
		return restoreError
	}
	return reserveError
}
