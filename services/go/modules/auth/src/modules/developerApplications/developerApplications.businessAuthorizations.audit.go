package developerapplications

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

func scanBusinessAuthorization(row rowScanner) (BusinessAuthorization, error) {
	var item BusinessAuthorization
	var revokedAt sql.NullTime
	err := row.Scan(&item.ID, &item.OrganizationID, &item.Organization, &item.ApplicationID, &item.Application,
		&item.StoreID, &item.StoreName, jsonScanner{target: &item.Scopes}, &item.Status, &item.GrantedAt, nullTimeScanner{target: &revokedAt})
	if revokedAt.Valid {
		value := revokedAt.Time.UTC().Format(time.RFC3339Nano)
		item.RevokedAt = &value
	}
	return item, err
}

func writeBusinessAuthorizationAudit(ctx context.Context, tx *sql.Tx, item BusinessAuthorization, account uuid.UUID, action string, before, after []string, now time.Time) error {
	beforeJSON, err := json.Marshal(before)
	if err != nil {
		return err
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO developer_business_authorization_audit_logs
		(id, authorization_id, organization_id, application_id, store_id, actor_account_id, action, before_scopes, after_scopes, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`, uuid.New(), item.ID, item.OrganizationID, item.ApplicationID, item.StoreID, account, action, string(beforeJSON), string(afterJSON), now)
	return err
}
