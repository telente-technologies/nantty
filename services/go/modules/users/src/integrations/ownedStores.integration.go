package integrations

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type CatalogOwnedStores struct {
	Database *sql.DB
	Schema   string
}

func (stores CatalogOwnedStores) FindOwnedStoreId(ctx context.Context, accountId uuid.UUID) (*string, error) {
	if stores.Database == nil || stores.Schema == "" {
		return nil, nil
	}
	query := `SELECT id::text FROM ` + pgx.Identifier{stores.Schema, "stores"}.Sanitize() + ` WHERE owner_account_id = $1 AND status <> 'closed' ORDER BY created_at, id LIMIT 1`
	var storeId string
	err := stores.Database.QueryRowContext(ctx, query, accountId).Scan(&storeId)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &storeId, nil
}
