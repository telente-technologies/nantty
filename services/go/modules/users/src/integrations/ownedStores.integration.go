package integrations

import (
	"context"
	"database/sql"
	"errors"
	"time"

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
	query := `SELECT id::text FROM ` + pgx.Identifier{stores.Schema, "stores"}.Sanitize() + ` WHERE owner_account_id = $1 AND status <> 'closed' AND channel = 'store' ORDER BY created_at, id LIMIT 1`
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

type CatalogBrand struct {
	Id             uuid.UUID
	OwnerAccountId *uuid.UUID
	Name           string
	Slug           string
	LogoUrl        *string
	SellingEnabled bool
	Active         bool
	CreatedAt      time.Time
}

type CatalogStore struct {
	Id                uuid.UUID
	OwnerAccountId    uuid.UUID
	BusinessProfileId uuid.UUID
	Status            string
	Channel           string
	CreatedAt         time.Time
}

func (stores CatalogOwnedStores) tableExists(ctx context.Context, table string) bool {
	if stores.Database == nil || stores.Schema == "" {
		return false
	}
	var found sql.NullString
	err := stores.Database.QueryRowContext(ctx, "SELECT to_regclass($1)::text", pgx.Identifier{stores.Schema, table}.Sanitize()).Scan(&found)
	return err == nil && found.Valid
}

func (stores CatalogOwnedStores) FindBrands(ctx context.Context, ownerAccountId *uuid.UUID, brandIds []uuid.UUID) ([]CatalogBrand, error) {
	if !stores.tableExists(ctx, "brands") {
		return nil, nil
	}
	query := `SELECT id, owner_account_id, name, slug, logo_url, selling_enabled, active, created_at FROM ` + pgx.Identifier{stores.Schema, "brands"}.Sanitize() + ` b WHERE `
	var arguments []any
	switch {
	case ownerAccountId != nil:
		query, arguments = query+`owner_account_id = $1`, []any{*ownerAccountId}
	case brandIds != nil:
		query, arguments = query+`id = ANY($1)`, []any{brandIds}
	default:
		query += `owner_account_id IS NOT NULL AND active`
	}
	rows, err := stores.Database.QueryContext(ctx, query+` ORDER BY created_at, id`, arguments...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var found []CatalogBrand
	for rows.Next() {
		var brand CatalogBrand
		if err := rows.Scan(&brand.Id, &brand.OwnerAccountId, &brand.Name, &brand.Slug, &brand.LogoUrl, &brand.SellingEnabled, &brand.Active, &brand.CreatedAt); err != nil {
			return nil, err
		}
		found = append(found, brand)
	}
	return found, rows.Err()
}

func (stores CatalogOwnedStores) FindStoresOfAccounts(ctx context.Context, accountIds []uuid.UUID) ([]CatalogStore, error) {
	if !stores.tableExists(ctx, "stores") || len(accountIds) == 0 {
		return nil, nil
	}
	query := `SELECT id, owner_account_id, business_profile_id, status, channel, created_at FROM ` + pgx.Identifier{stores.Schema, "stores"}.Sanitize() + ` WHERE owner_account_id = ANY($1) ORDER BY created_at, id`
	rows, err := stores.Database.QueryContext(ctx, query, accountIds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var found []CatalogStore
	for rows.Next() {
		var store CatalogStore
		if err := rows.Scan(&store.Id, &store.OwnerAccountId, &store.BusinessProfileId, &store.Status, &store.Channel, &store.CreatedAt); err != nil {
			return nil, err
		}
		found = append(found, store)
	}
	return found, rows.Err()
}
