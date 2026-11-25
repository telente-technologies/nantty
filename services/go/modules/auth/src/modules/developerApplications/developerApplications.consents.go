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
	ID             string    `json:"id"`
	OrganizationID string    `json:"organizationId"`
	Organization   string    `json:"organizationName"`
	ApplicationID  string    `json:"applicationId"`
	Application    string    `json:"applicationName"`
	Scopes         []string  `json:"scopes"`
	Status         string    `json:"status"`
	GrantedAt      time.Time `json:"grantedAt"`
	RevokedAt      *string   `json:"revokedAt,omitempty"`
}

type BusinessConsentInput struct {
	OrganizationID string   `json:"organizationId"`
	ApplicationID  string   `json:"applicationId"`
	Scopes         []string `json:"scopes"`
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
		SELECT c.id, c.organization_id, o.name, c.application_id, a.name, c.scopes,
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

func (service Service) GrantBusinessConsent(ctx context.Context, accountID string, input BusinessConsentInput) (BusinessConsent, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return BusinessConsent{}, errInvalidApplicationAccount
	}
	organizationID, err := uuid.Parse(input.OrganizationID)
	if err != nil {
		return BusinessConsent{}, errInvalidBusinessConsent
	}
	applicationID, err := uuid.Parse(input.ApplicationID)
	if err != nil {
		return BusinessConsent{}, errInvalidBusinessConsent
	}
	scopes, err := NormalizeBusinessConsentScopes(input.Scopes)
	if err != nil {
		return BusinessConsent{}, err
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return BusinessConsent{}, err
	}
	defer tx.Rollback()
	var appScopes []string
	err = tx.QueryRowContext(ctx, `
		SELECT requested_scopes FROM developer_applications
		WHERE id = $1 AND organization_id = $2 AND api_product = $3 AND status = 'approved'
		FOR SHARE`, applicationID, organizationID, apiProductBusinessMessaging).
		Scan(jsonScanner{target: &appScopes})
	if errors.Is(err, sql.ErrNoRows) {
		return BusinessConsent{}, errBusinessConsentNotFound
	}
	if err != nil {
		return BusinessConsent{}, err
	}
	for _, scope := range scopes {
		if !containsGrant(appScopes, scope) {
			return BusinessConsent{}, errInvalidBusinessConsent
		}
	}
	var beforeScopes []string
	var previousStatus string
	lookupErr := tx.QueryRowContext(ctx, `
		SELECT scopes, status FROM developer_business_consents
		WHERE application_id = $1 AND recipient_account_id = $2 FOR UPDATE`, applicationID, account).
		Scan(jsonScanner{target: &beforeScopes}, &previousStatus)
	if lookupErr != nil && !errors.Is(lookupErr, sql.ErrNoRows) {
		return BusinessConsent{}, lookupErr
	}
	encoded, err := json.Marshal(scopes)
	if err != nil {
		return BusinessConsent{}, err
	}
	var result BusinessConsent
	var revokedAt sql.NullTime
	now := service.Container.Now().UTC()
	err = tx.QueryRowContext(ctx, `
		INSERT INTO developer_business_consents
		  (id, organization_id, application_id, recipient_account_id, status, scopes, granted_at, revoked_at)
		VALUES ($1,$2,$3,$4,'active',$5::jsonb,$6,NULL)
		ON CONFLICT (application_id, recipient_account_id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id, status = 'active', scopes = EXCLUDED.scopes,
		    granted_at = EXCLUDED.granted_at, revoked_at = NULL
		RETURNING id, organization_id, application_id, scopes, status, granted_at, revoked_at`,
		uuid.New(), organizationID, applicationID, account, string(encoded), now).
		Scan(&result.ID, &result.OrganizationID, &result.ApplicationID, jsonScanner{target: &result.Scopes}, &result.Status, &result.GrantedAt, nullTimeScanner{target: &revokedAt})
	if err != nil {
		return BusinessConsent{}, err
	}
	action := "granted"
	if lookupErr == nil {
		action = "updated"
		if previousStatus == "revoked" {
			action = "granted"
		}
	}
	if err := writeBusinessConsentAudit(ctx, tx, result, account, action, beforeScopes, scopes, now); err != nil {
		return BusinessConsent{}, err
	}
	if err := tx.QueryRowContext(ctx, `SELECT name FROM developer_organizations WHERE id=$1`, organizationID).Scan(&result.Organization); err != nil {
		return BusinessConsent{}, err
	}
	if err := tx.QueryRowContext(ctx, `SELECT name FROM developer_applications WHERE id=$1 AND organization_id=$2`, applicationID, organizationID).Scan(&result.Application); err != nil {
		return BusinessConsent{}, err
	}
	if revokedAt.Valid {
		value := revokedAt.Time.UTC().Format("2006-01-02T15:04:05.999Z07:00")
		result.RevokedAt = &value
	}
	if err := tx.Commit(); err != nil {
		return BusinessConsent{}, err
	}
	return result, nil
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
		RETURNING id, organization_id, application_id, scopes`, service.Container.Now().UTC(), consent, account).
		Scan(&result.ID, &result.OrganizationID, &result.ApplicationID, jsonScanner{target: &scopes})
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
		jsonScanner{target: &item.Scopes}, &item.Status, &item.GrantedAt, nullTimeScanner{target: &revokedAt})
	if revokedAt.Valid {
		value := revokedAt.Time.UTC().Format("2006-01-02T15:04:05.999Z07:00")
		item.RevokedAt = &value
	}
	return item, err
}

type nullTimeScanner struct{ target *sql.NullTime }

func (scanner nullTimeScanner) Scan(source any) error { return scanner.target.Scan(source) }

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
		(id, consent_id, organization_id, application_id, recipient_account_id, action, before_scopes, after_scopes, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`, uuid.New(), consent.ID, consent.OrganizationID, consent.ApplicationID, account, action, string(beforeJSON), string(afterJSON), now)
	return err
}
