package services

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/wallet/src/container"
	"nantty/platform/httpserver"
)

var ErrStoreAccountMismatch = httpserver.NewApiError(http.StatusConflict, "STORE_ACCOUNT_MISMATCH", "This store transaction belongs to a different Nantty account.")

type CoinStoreAccounts struct {
	Container *container.Container
}

func (accounts CoinStoreAccounts) GetOrCreateToken(ctx context.Context, userId, store string) (string, error) {
	user, err := uuid.Parse(userId)
	if err != nil {
		return "", ErrStoreAccountMismatch
	}
	table := pgx.Identifier{accounts.Container.Settings.Money.DatabaseSchema, "coin_store_account_tokens"}.Sanitize()
	token := uuid.Must(uuid.NewV7())
	err = databases.RunInMoneyTransaction(ctx, accounts.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if _, err := transaction.ExecContext(ctx, "INSERT INTO "+table+" (id, user_id, store, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, store) DO NOTHING", token, user, store, accounts.Container.Now().UTC()); err != nil {
			return err
		}
		return transaction.QueryRowContext(ctx, "SELECT id FROM "+table+" WHERE user_id = $1 AND store = $2", user, store).Scan(&token)
	})
	if err != nil {
		return "", err
	}
	return token.String(), nil
}

func (accounts CoinStoreAccounts) VerifyTokenInTransaction(ctx context.Context, transaction *sql.Tx, userId, store, accountToken string) error {
	user, userErr := uuid.Parse(userId)
	token, tokenErr := uuid.Parse(accountToken)
	if userErr != nil || tokenErr != nil {
		return ErrStoreAccountMismatch
	}
	table := pgx.Identifier{accounts.Container.Settings.Money.DatabaseSchema, "coin_store_account_tokens"}.Sanitize()
	var matched bool
	if err := transaction.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM "+table+" WHERE user_id = $1 AND store = $2 AND id = $3)", user, store, token).Scan(&matched); err != nil {
		return err
	}
	if !matched {
		return ErrStoreAccountMismatch
	}
	return nil
}
