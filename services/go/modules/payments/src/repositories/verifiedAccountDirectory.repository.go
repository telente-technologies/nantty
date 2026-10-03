package repositories

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
)

type VerifiedAccountContact struct {
	Email         string
	Name          string
	EmailVerified bool
}

type VerifiedAccountDirectory interface {
	FindAccountContact(ctx context.Context, accountId string) (VerifiedAccountContact, bool, error)
}

type SqlVerifiedAccountDirectory struct {
	Database   *sql.DB
	AuthSchema string
}

func (directory SqlVerifiedAccountDirectory) FindAccountContact(ctx context.Context, accountId string) (VerifiedAccountContact, bool, error) {
	if directory.AuthSchema == "" {
		return VerifiedAccountContact{}, false, errors.New("the identity account directory schema is not configured")
	}
	query := "SELECT COALESCE(email, ''), COALESCE(name, ''), email_verified_at IS NOT NULL FROM " + pgx.Identifier{directory.AuthSchema, "accounts"}.Sanitize() + " WHERE id::text = $1 AND status = 'active'"
	var contact VerifiedAccountContact
	err := directory.Database.QueryRowContext(ctx, query, accountId).Scan(&contact.Email, &contact.Name, &contact.EmailVerified)
	if errors.Is(err, sql.ErrNoRows) {
		return VerifiedAccountContact{}, false, nil
	}
	if err != nil {
		return VerifiedAccountContact{}, false, err
	}
	return contact, true, nil
}

type StaticVerifiedAccountDirectory map[string]VerifiedAccountContact

func (directory StaticVerifiedAccountDirectory) FindAccountContact(_ context.Context, accountId string) (VerifiedAccountContact, bool, error) {
	contact, found := directory[accountId]
	return contact, found, nil
}
