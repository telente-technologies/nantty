package repositories

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
)

type AccountDirectory struct {
	Database   *sql.DB
	AuthSchema string
}

func (directory AccountDirectory) IsActiveAccount(ctx context.Context, accountId string) (bool, error) {
	if directory.AuthSchema == "" {
		return true, nil
	}
	var status string
	err := directory.Database.QueryRowContext(ctx, "SELECT status FROM "+pgx.Identifier{directory.AuthSchema, "accounts"}.Sanitize()+" WHERE id = $1", accountId).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return status == "active", err
}
