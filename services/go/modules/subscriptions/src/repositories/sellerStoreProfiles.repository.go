package repositories

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SellerStoreProfiles struct {
	Database      *sql.DB
	CatalogSchema string
}

func (profiles SellerStoreProfiles) FindOwnedStoreProfile(ctx context.Context, ownerUserId string, storeId *uuid.UUID) (string, bool, error) {
	query := "SELECT business_profile_id::text FROM " + pgx.Identifier{profiles.CatalogSchema, "stores"}.Sanitize() +
		" WHERE owner_account_id::text = $1 AND status <> 'closed' AND ($2::uuid IS NULL OR id = $2) ORDER BY created_at LIMIT 1"
	var profileId string
	err := profiles.Database.QueryRowContext(ctx, query, ownerUserId, storeId).Scan(&profileId)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return profileId, err == nil, err
}
