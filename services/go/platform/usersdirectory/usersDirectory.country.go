package usersdirectory

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
)

func (reader Reader) PersonalProfileCountry(ctx context.Context, accountId uuid.UUID) (string, error) {
	var country sql.NullString
	err := reader.Database.QueryRowContext(ctx, "SELECT country_code FROM "+reader.table("profiles")+" WHERE account_id = $1 AND kind = 'personal' LIMIT 1", accountId).Scan(&country)
	if errors.Is(err, sql.ErrNoRows) || !country.Valid {
		return "", nil
	}
	return country.String, err
}
