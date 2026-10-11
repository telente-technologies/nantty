package users

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func TestMyProfileCarriesTheOwnedStoreId(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	adaId, adaToken := harness.newAccount("ada.store", "Ada")
	_, graceToken := harness.newAccount("grace.nostore", "Grace")
	if me := harness.expect("GET", "/api/v1/users/me", adaToken, nil, http.StatusOK); me["storeId"] != nil {
		t.Fatalf("an unreadable catalog must leave storeId empty, got %v", me["storeId"])
	}
	catalog := pgx.Identifier{harness.schema + "_catalog"}.Sanitize()
	stores := pgx.Identifier{harness.schema + "_catalog", "stores"}.Sanitize()
	harness.execSql(`CREATE SCHEMA ` + catalog)
	t.Cleanup(func() { harness.execSql(`DROP SCHEMA ` + catalog + ` CASCADE`) })
	harness.execSql(`CREATE TABLE ` + stores + ` (id uuid PRIMARY KEY, owner_account_id uuid NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL, channel text NOT NULL DEFAULT 'store')`)
	closedStore, ownStore, laterStore := uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness.execSql(`INSERT INTO `+stores+` (id, owner_account_id, status, created_at) VALUES ($1, $4, 'closed', now() - interval '3 days'), ($2, $4, 'active', now() - interval '2 days'), ($3, $4, 'active', now())`, closedStore, ownStore, laterStore, adaId)
	if me := harness.expect("GET", "/api/v1/users/me", adaToken, nil, http.StatusOK); me["storeId"] != ownStore {
		t.Fatalf("storeId must be the oldest open store the user owns, got %v", me["storeId"])
	}
	if me := harness.expect("GET", "/api/v1/users/me", graceToken, nil, http.StatusOK); me["storeId"] != nil {
		t.Fatalf("a user without a store has no storeId, got %v", me["storeId"])
	}
}
