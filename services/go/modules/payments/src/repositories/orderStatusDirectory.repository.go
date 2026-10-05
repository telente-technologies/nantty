package repositories

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
)

type OrderStatusDirectory interface {
	CancelledOrderIds(ctx context.Context, orderIds []string) (map[string]bool, error)
}

type SqlOrderStatusDirectory struct {
	Database     *sql.DB
	OrdersSchema string
}

func (directory SqlOrderStatusDirectory) CancelledOrderIds(ctx context.Context, orderIds []string) (map[string]bool, error) {
	cancelled := map[string]bool{}
	if directory.OrdersSchema == "" || len(orderIds) == 0 {
		return cancelled, nil
	}
	if directory.Database == nil {
		return cancelled, errors.New("the order status directory has no database")
	}
	query := "SELECT id::text FROM " + pgx.Identifier{directory.OrdersSchema, "order_groups"}.Sanitize() + " WHERE id::text = ANY($1) AND status = 'cancelled'"
	rows, err := directory.Database.QueryContext(ctx, query, orderIds)
	if err != nil {
		return cancelled, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return cancelled, err
		}
		cancelled[id] = true
	}
	return cancelled, rows.Err()
}

type StaticOrderStatusDirectory map[string]bool

func (directory StaticOrderStatusDirectory) CancelledOrderIds(_ context.Context, orderIds []string) (map[string]bool, error) {
	cancelled := map[string]bool{}
	for _, id := range orderIds {
		if directory[id] {
			cancelled[id] = true
		}
	}
	return cancelled, nil
}
