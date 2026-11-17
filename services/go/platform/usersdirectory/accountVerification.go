package usersdirectory

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var ErrAccountNotFound = errors.New("account not found")

type AccountEmailVerifier interface {
	IsEmailVerified(context.Context, uuid.UUID) (bool, error)
}

type SqlAccountEmailVerifier struct {
	Database *sql.DB
	Schema   string
}

func (verifier SqlAccountEmailVerifier) IsEmailVerified(ctx context.Context, accountId uuid.UUID) (bool, error) {
	if verifier.Database == nil || verifier.Schema == "" {
		return false, errors.New("account email verifier is not configured")
	}
	var verified bool
	query := "SELECT email_verified_at IS NOT NULL FROM " + pgx.Identifier{verifier.Schema, "accounts"}.Sanitize() + " WHERE id = $1"
	if err := verifier.Database.QueryRowContext(ctx, query, accountId).Scan(&verified); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, ErrAccountNotFound
		}
		return false, err
	}
	return verified, nil
}

type StaticAccountEmailVerifier struct {
	Verified bool
	Err      error
}

func (verifier StaticAccountEmailVerifier) IsEmailVerified(context.Context, uuid.UUID) (bool, error) {
	return verifier.Verified, verifier.Err
}
