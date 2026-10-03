package databases

import (
	"context"
	"database/sql"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
)

type ExecutorQuerier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

type sharedTransactionDriver struct {
	entsql.Conn
}

func (driver sharedTransactionDriver) Tx(context.Context) (dialect.Tx, error) {
	return dialect.NopTx(driver), nil
}

func (sharedTransactionDriver) Close() error    { return nil }
func (sharedTransactionDriver) Dialect() string { return dialect.Postgres }

func EntDriverBoundToTransaction(transaction *sql.Tx) dialect.Driver {
	return sharedTransactionDriver{Conn: entsql.Conn{ExecQuerier: transaction}}
}

func EntDriverForExecutor(executor ExecutorQuerier) dialect.Driver {
	if transaction, isTransaction := executor.(*sql.Tx); isTransaction {
		return EntDriverBoundToTransaction(transaction)
	}
	if database, isDatabase := executor.(*sql.DB); isDatabase {
		return entsql.OpenDB(dialect.Postgres, database)
	}
	return sharedTransactionDriver{Conn: entsql.Conn{ExecQuerier: executor}}
}
