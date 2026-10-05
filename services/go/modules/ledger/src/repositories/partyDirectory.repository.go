package repositories

import (
	"context"
	"database/sql"
	"log/slog"

	"github.com/jackc/pgx/v5"

	"zudomart/modules/ledger/src/utils"
)

type PartySummary struct {
	Id       string  `json:"id"`
	Name     *string `json:"name"`
	Username *string `json:"username"`
}

type StoreSummary struct {
	Id   string  `json:"id"`
	Name *string `json:"name"`
}

type PartyDirectory struct {
	Database      *sql.DB
	AccountSchema string
	CatalogSchema string
	Logger        *slog.Logger
}

func (directory PartyDirectory) DescribeAccounts(ctx context.Context, accountIds []string) map[string]PartySummary {
	summaries := map[string]PartySummary{}
	identifiers := []string{}
	for _, accountId := range accountIds {
		if _, seen := summaries[accountId]; !seen && accountId != "" {
			summaries[accountId] = PartySummary{Id: accountId}
			if utils.IsUuid(accountId) {
				identifiers = append(identifiers, accountId)
			}
		}
	}
	if directory.Database == nil || directory.AccountSchema == "" || len(identifiers) == 0 {
		return summaries
	}
	query := "SELECT id::text, COALESCE(name, ''), COALESCE(username, '') FROM " + pgx.Identifier{directory.AccountSchema, "accounts"}.Sanitize() + " WHERE id::text = ANY($1)"
	rows, err := directory.Database.QueryContext(ctx, query, identifiers)
	if err != nil {
		directory.warn(ctx, "account directory lookup failed", err)
		return summaries
	}
	defer rows.Close()
	for rows.Next() {
		var id, name, username string
		if err := rows.Scan(&id, &name, &username); err != nil {
			directory.warn(ctx, "account directory row unreadable", err)
			return summaries
		}
		summaries[id] = PartySummary{Id: id, Name: optional(name), Username: optional(username)}
	}
	return summaries
}

func (directory PartyDirectory) DescribeStores(ctx context.Context, storeIds []string) map[string]StoreSummary {
	summaries := map[string]StoreSummary{}
	identifiers := []string{}
	for _, storeId := range storeIds {
		if _, seen := summaries[storeId]; !seen && storeId != "" {
			summaries[storeId] = StoreSummary{Id: storeId}
			if utils.IsUuid(storeId) {
				identifiers = append(identifiers, storeId)
			}
		}
	}
	if directory.Database == nil || directory.CatalogSchema == "" || len(identifiers) == 0 {
		return summaries
	}
	query := "SELECT id::text, COALESCE(name, '') FROM " + pgx.Identifier{directory.CatalogSchema, "stores"}.Sanitize() + " WHERE id::text = ANY($1)"
	rows, err := directory.Database.QueryContext(ctx, query, identifiers)
	if err != nil {
		directory.warn(ctx, "store directory lookup failed", err)
		return summaries
	}
	defer rows.Close()
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			directory.warn(ctx, "store directory row unreadable", err)
			return summaries
		}
		summaries[id] = StoreSummary{Id: id, Name: optional(name)}
	}
	return summaries
}

func (directory PartyDirectory) warn(ctx context.Context, message string, err error) {
	if directory.Logger != nil {
		directory.Logger.WarnContext(ctx, message, slog.Any("error", err))
	}
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
