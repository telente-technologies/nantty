package developerapplications

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	errInvalidBusinessConsent  = errors.New("business messaging consent is invalid")
	errBusinessConsentNotFound = errors.New("business messaging consent was not found")
)

var consentableBusinessScopes = map[string]struct{}{
	"messages:send": {}, "messages:read": {}, "conversations:read": {},
}

type BusinessConsent struct {
	ID                       string    `json:"id"`
	OrganizationID           string    `json:"organizationId"`
	Organization             string    `json:"organizationName"`
	ApplicationID            string    `json:"applicationId"`
	Application              string    `json:"applicationName"`
	StoreID                  string    `json:"storeId,omitempty"`
	Scopes                   []string  `json:"scopes"`
	Status                   string    `json:"status"`
	GrantedAt                time.Time `json:"grantedAt"`
	RevokedAt                *string   `json:"revokedAt,omitempty"`
	AuthorizationRedirectURL string    `json:"authorizationRedirectUrl,omitempty"`
}

type BusinessConsentInput struct {
	OrganizationID string                               `json:"organizationId"`
	ApplicationID  string                               `json:"applicationId"`
	StoreID        string                               `json:"storeId"`
	Scopes         []string                             `json:"scopes"`
	Authorization  *BusinessConsentAuthorizationRequest `json:"authorization,omitempty"`
}

func NormalizeBusinessConsentScopes(scopes []string) ([]string, error) {
	if len(scopes) == 0 || len(scopes) > len(consentableBusinessScopes) {
		return nil, errInvalidBusinessConsent
	}
	normalized := make([]string, 0, len(scopes))
	seen := make(map[string]struct{}, len(scopes))
	for _, scope := range scopes {
		scope = strings.TrimSpace(scope)
		if _, ok := consentableBusinessScopes[scope]; !ok {
			return nil, errInvalidBusinessConsent
		}
		if _, duplicate := seen[scope]; !duplicate {
			seen[scope] = struct{}{}
			normalized = append(normalized, scope)
		}
	}
	sort.Strings(normalized)
	return normalized, nil
}

func (service Service) ListBusinessConsents(ctx context.Context, accountID string) ([]BusinessConsent, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return nil, errInvalidApplicationAccount
	}
	rows, err := service.Container.Database.QueryContext(ctx, `
		SELECT c.id, c.organization_id, o.name, c.application_id, a.name, c.store_id, c.scopes,
		       c.status, c.granted_at, c.revoked_at
		FROM developer_business_consents c
		JOIN developer_organizations o ON o.id = c.organization_id
		JOIN developer_applications a ON a.id = c.application_id AND a.organization_id = c.organization_id
		WHERE c.recipient_account_id = $1
		ORDER BY c.granted_at DESC, c.id DESC`, account)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]BusinessConsent, 0)
	for rows.Next() {
		item, err := scanBusinessConsent(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (service Service) RevokeBusinessConsent(ctx context.Context, accountID, consentID string) error {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return errInvalidApplicationAccount
	}
	consent, err := uuid.Parse(consentID)
	if err != nil {
		return errBusinessConsentNotFound
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var result BusinessConsent
	var scopes []string
	err = tx.QueryRowContext(ctx, `
		UPDATE developer_business_consents
		SET status='revoked', revoked_at=$1
		WHERE id=$2 AND recipient_account_id=$3 AND status='active'
		RETURNING id, organization_id, application_id, store_id, scopes`, service.Container.Now().UTC(), consent, account).
		Scan(&result.ID, &result.OrganizationID, &result.ApplicationID, nullStringScanner{target: &result.StoreID}, jsonScanner{target: &scopes})
	if errors.Is(err, sql.ErrNoRows) {
		return errBusinessConsentNotFound
	}
	if err != nil {
		return err
	}
	result.Status = "revoked"
	if err := writeBusinessConsentAudit(ctx, tx, result, account, "revoked", scopes, []string{}, service.Container.Now().UTC()); err != nil {
		return err
	}
	return tx.Commit()
}

type rowScanner interface{ Scan(...any) error }

func scanBusinessConsent(row rowScanner) (BusinessConsent, error) {
	var item BusinessConsent
	var revokedAt sql.NullTime
	err := row.Scan(&item.ID, &item.OrganizationID, &item.Organization, &item.ApplicationID, &item.Application,
		nullStringScanner{target: &item.StoreID}, jsonScanner{target: &item.Scopes}, &item.Status, &item.GrantedAt, nullTimeScanner{target: &revokedAt})
	if revokedAt.Valid {
		value := revokedAt.Time.UTC().Format("2006-01-02T15:04:05.999Z07:00")
		item.RevokedAt = &value
	}
	return item, err
}

type nullTimeScanner struct{ target *sql.NullTime }

func (scanner nullTimeScanner) Scan(source any) error { return scanner.target.Scan(source) }

type nullStringScanner struct{ target *string }

func (scanner nullStringScanner) Scan(source any) error {
	var value sql.NullString
	if err := value.Scan(source); err != nil {
		return err
	}
	if value.Valid {
		*scanner.target = value.String
	}
	return nil
}

func writeBusinessConsentAudit(ctx context.Context, tx *sql.Tx, consent BusinessConsent, account uuid.UUID, action string, before, after []string, now time.Time) error {
	beforeJSON, err := json.Marshal(before)
	if err != nil {
		return err
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO developer_business_consent_audit_logs
		(id, consent_id, organization_id, application_id, store_id, recipient_account_id, actor_account_id, action, before_scopes, after_scopes, created_at)
		VALUES ($1,$2,$3,$4,NULLIF($5, '')::uuid,$6,$6,$7,$8::jsonb,$9::jsonb,$10)`, uuid.New(), consent.ID, consent.OrganizationID, consent.ApplicationID, consent.StoreID, account, action, string(beforeJSON), string(afterJSON), now)
	return err
}

func writeMerchantRevocationConsentAudit(ctx context.Context, tx *sql.Tx, consentID, organizationID, applicationID, storeID, recipientID, actorID uuid.UUID, scopes []string, now time.Time) error {
	beforeJSON, err := json.Marshal(scopes)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO developer_business_consent_audit_logs
		(id, consent_id, organization_id, application_id, store_id, recipient_account_id, actor_account_id, action, before_scopes, after_scopes, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'revoked',$8::jsonb,'[]'::jsonb,$9)`, uuid.New(), consentID, organizationID, applicationID, storeID, recipientID, actorID, string(beforeJSON), now)
	return err
}
