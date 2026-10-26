package integrations

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"nantty/modules/ads/src/interfaces"
)

type AuthSchemaUserDirectory struct {
	Database *sql.DB
	Schema   string
}

func (directory AuthSchemaUserDirectory) table() string {
	return pgx.Identifier{directory.Schema, "accounts"}.Sanitize()
}

func (directory AuthSchemaUserDirectory) LookupUsers(ctx context.Context, ids []string) (map[string]interfaces.UserSummary, error) {
	found := make(map[string]interfaces.UserSummary, len(ids))
	if len(ids) == 0 {
		return found, nil
	}
	placeholders, arguments := make([]string, len(ids)), make([]any, len(ids))
	for index, id := range ids {
		placeholders[index], arguments[index] = "$"+strconv.Itoa(index+1), id
	}
	rows, err := directory.Database.QueryContext(ctx, `SELECT id, username, name FROM `+directory.table()+` WHERE id IN (`+strings.Join(placeholders, ",")+`)`, arguments...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var user interfaces.UserSummary
		if err := rows.Scan(&user.Id, &user.Username, &user.Name); err != nil {
			return nil, err
		}
		found[user.Id] = user
	}
	return found, rows.Err()
}

func (directory AuthSchemaUserDirectory) FindUserByUsername(ctx context.Context, username string) (interfaces.UserSummary, bool, error) {
	var user interfaces.UserSummary
	err := directory.Database.QueryRowContext(ctx, `SELECT id, username, name FROM `+directory.table()+` WHERE lower(username) = lower($1)`, username).Scan(&user.Id, &user.Username, &user.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return user, false, nil
	}
	return user, err == nil, err
}

func (directory AuthSchemaUserDirectory) FindUserByEmail(ctx context.Context, email string) (interfaces.UserSummary, bool, error) {
	var user interfaces.UserSummary
	err := directory.Database.QueryRowContext(ctx, `SELECT id, username, name FROM `+directory.table()+` WHERE lower(email) = lower($1) AND status = 'active'`, email).Scan(&user.Id, &user.Username, &user.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return user, false, nil
	}
	return user, err == nil, err
}

type NoStoreDirectory struct{}

func (NoStoreDirectory) ListStoresManagedBy(context.Context, string) ([]interfaces.ManagedStore, error) {
	return nil, nil
}
