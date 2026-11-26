package developerapplications

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	errBusinessAuthorizationDenied      = errors.New("business store authorization was denied")
	errBusinessAuthorizationUnavailable = errors.New("business store authorization service is unavailable")
	errBusinessAuthorizationNotFound    = errors.New("business authorization was not found")
)

type BusinessAuthorization struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organizationId"`
	Organization   string    `json:"organizationName"`
	ApplicationID  string    `json:"applicationId"`
	Application    string    `json:"applicationName"`
	StoreID        string    `json:"storeId"`
	StoreName      string    `json:"storeName"`
	Scopes         []string  `json:"scopes"`
	Status         string    `json:"status"`
	GrantedAt      time.Time `json:"grantedAt"`
	RevokedAt      *string   `json:"revokedAt,omitempty"`
}

type BusinessAuthorizationInput struct {
	OrganizationID string   `json:"organizationId"`
	ApplicationID  string   `json:"applicationId"`
	StoreID        string   `json:"storeId"`
	Scopes         []string `json:"scopes"`
}

type BusinessApplicationPreview struct {
	ID              string   `json:"applicationId"`
	OrganizationID  string   `json:"organizationId"`
	Organization    string   `json:"organizationName"`
	Name            string   `json:"applicationName"`
	RequestedScopes []string `json:"requestedScopes"`
}

func (service Service) GetBusinessApplicationPreview(ctx context.Context, applicationID string) (BusinessApplicationPreview, error) {
	identifier, err := uuid.Parse(applicationID)
	if err != nil {
		return BusinessApplicationPreview{}, errBusinessAuthorizationNotFound
	}
	var preview BusinessApplicationPreview
	err = service.Container.Database.QueryRowContext(ctx, `
		SELECT a.id, a.organization_id, o.name, a.name, a.requested_scopes
		FROM developer_applications a
		JOIN developer_organizations o ON o.id = a.organization_id
		WHERE a.id = $1 AND a.api_product = $2 AND a.status = 'approved'`, identifier, apiProductBusinessMessaging).
		Scan(&preview.ID, &preview.OrganizationID, &preview.Organization, &preview.Name, jsonScanner{target: &preview.RequestedScopes})
	if errors.Is(err, sql.ErrNoRows) {
		return BusinessApplicationPreview{}, errBusinessAuthorizationNotFound
	}
	return preview, err
}

func (service Service) ListBusinessAuthorizations(ctx context.Context, accountID string) ([]BusinessAuthorization, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return nil, errInvalidApplicationAccount
	}
	rows, err := service.Container.Database.QueryContext(ctx, `
		SELECT a.id, a.organization_id, o.name, a.application_id, p.name,
		       a.store_id, a.store_name, a.scopes, a.status, a.granted_at, a.revoked_at
		FROM developer_business_authorizations a
		JOIN developer_organizations o ON o.id = a.organization_id
		JOIN developer_applications p ON p.id = a.application_id AND p.organization_id = a.organization_id
		WHERE a.granted_by_account_id = $1
		ORDER BY a.granted_at DESC, a.id DESC`, account)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]BusinessAuthorization, 0)
	for rows.Next() {
		item, err := scanBusinessAuthorization(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (service Service) GrantBusinessAuthorization(ctx context.Context, accountID string, input BusinessAuthorizationInput) (BusinessAuthorization, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return BusinessAuthorization{}, errInvalidApplicationAccount
	}
	organizationID, err := uuid.Parse(input.OrganizationID)
	if err != nil {
		return BusinessAuthorization{}, errInvalidBusinessConsent
	}
	applicationID, err := uuid.Parse(input.ApplicationID)
	if err != nil {
		return BusinessAuthorization{}, errInvalidBusinessConsent
	}
	storeID, err := uuid.Parse(input.StoreID)
	if err != nil {
		return BusinessAuthorization{}, errInvalidBusinessConsent
	}
	scopes, err := NormalizeBusinessConsentScopes(input.Scopes)
	if err != nil {
		return BusinessAuthorization{}, err
	}
	store, err := verifyBusinessMessagingStoreAccess(ctx, service.Container.Settings.BusinessMessagingCommerceUrl, service.Container.Settings.BusinessMessagingAuthorizationToken, account, storeID)
	if err != nil {
		return BusinessAuthorization{}, err
	}
	if store.StoreID != storeID.String() || strings.TrimSpace(store.StoreName) == "" || store.OwnerAccountID == "" || store.Role == "" {
		return BusinessAuthorization{}, errBusinessAuthorizationUnavailable
	}

	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return BusinessAuthorization{}, err
	}
	defer tx.Rollback()
	var appScopes []string
	err = tx.QueryRowContext(ctx, `
		SELECT requested_scopes FROM developer_applications
		WHERE id = $1 AND organization_id = $2 AND api_product = $3 AND status = 'approved'
		FOR SHARE`, applicationID, organizationID, apiProductBusinessMessaging).
		Scan(jsonScanner{target: &appScopes})
	if errors.Is(err, sql.ErrNoRows) {
		return BusinessAuthorization{}, errBusinessConsentNotFound
	}
	if err != nil {
		return BusinessAuthorization{}, err
	}
	for _, scope := range scopes {
		if !containsGrant(appScopes, scope) {
			return BusinessAuthorization{}, errInvalidBusinessConsent
		}
	}

	var beforeScopes []string
	var previousStatus string
	lookupErr := tx.QueryRowContext(ctx, `SELECT scopes, status FROM developer_business_authorizations WHERE application_id=$1 AND store_id=$2 FOR UPDATE`, applicationID, storeID).
		Scan(jsonScanner{target: &beforeScopes}, &previousStatus)
	if lookupErr != nil && !errors.Is(lookupErr, sql.ErrNoRows) {
		return BusinessAuthorization{}, lookupErr
	}
	encoded, err := json.Marshal(scopes)
	if err != nil {
		return BusinessAuthorization{}, err
	}
	now := service.Container.Now().UTC()
	var result BusinessAuthorization
	var revokedAt sql.NullTime
	err = tx.QueryRowContext(ctx, `
		INSERT INTO developer_business_authorizations
		  (id, organization_id, application_id, store_id, store_name, granted_by_account_id, status, scopes, granted_at, revoked_at)
		VALUES ($1,$2,$3,$4,$5,$6,'active',$7::jsonb,$8,NULL)
		ON CONFLICT (application_id, store_id) DO UPDATE
		SET organization_id=EXCLUDED.organization_id, store_name=EXCLUDED.store_name,
		    granted_by_account_id=EXCLUDED.granted_by_account_id, status='active', scopes=EXCLUDED.scopes,
		    granted_at=EXCLUDED.granted_at, revoked_at=NULL
		RETURNING id, organization_id, application_id, store_id, store_name, scopes, status, granted_at, revoked_at`,
		uuid.New(), organizationID, applicationID, storeID, strings.TrimSpace(store.StoreName), account, string(encoded), now).
		Scan(&result.ID, &result.OrganizationID, &result.ApplicationID, &result.StoreID, &result.StoreName,
			jsonScanner{target: &result.Scopes}, &result.Status, &result.GrantedAt, nullTimeScanner{target: &revokedAt})
	if err != nil {
		return BusinessAuthorization{}, err
	}
	action := "granted"
	if lookupErr == nil {
		action = "updated"
		if previousStatus == "revoked" {
			action = "granted"
		}
	}
	if err := writeBusinessAuthorizationAudit(ctx, tx, result, account, action, beforeScopes, scopes, now); err != nil {
		return BusinessAuthorization{}, err
	}
	if err := tx.QueryRowContext(ctx, `SELECT name FROM developer_organizations WHERE id=$1`, organizationID).Scan(&result.Organization); err != nil {
		return BusinessAuthorization{}, err
	}
	if err := tx.QueryRowContext(ctx, `SELECT name FROM developer_applications WHERE id=$1 AND organization_id=$2`, applicationID, organizationID).Scan(&result.Application); err != nil {
		return BusinessAuthorization{}, err
	}
	if revokedAt.Valid {
		value := revokedAt.Time.UTC().Format(time.RFC3339Nano)
		result.RevokedAt = &value
	}
	if err := tx.Commit(); err != nil {
		return BusinessAuthorization{}, err
	}
	return result, nil
}

func (service Service) RevokeBusinessAuthorization(ctx context.Context, accountID, authorizationID string) error {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return errInvalidApplicationAccount
	}
	identifier, err := uuid.Parse(authorizationID)
	if err != nil {
		return errBusinessAuthorizationNotFound
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var result BusinessAuthorization
	var scopes []string
	now := service.Container.Now().UTC()
	err = tx.QueryRowContext(ctx, `UPDATE developer_business_authorizations SET status='revoked', revoked_at=$1
		WHERE id=$2 AND granted_by_account_id=$3 AND status='active'
		RETURNING id, organization_id, application_id, store_id, scopes`, now, identifier, account).
		Scan(&result.ID, &result.OrganizationID, &result.ApplicationID, &result.StoreID, jsonScanner{target: &scopes})
	if errors.Is(err, sql.ErrNoRows) {
		return errBusinessAuthorizationNotFound
	}
	if err != nil {
		return err
	}
	rows, err := tx.QueryContext(ctx, `UPDATE developer_business_consents
		SET status='revoked', revoked_at=$1
		WHERE organization_id=$2 AND application_id=$3 AND store_id=$4 AND status='active'
		RETURNING id, organization_id, application_id, store_id, recipient_account_id, scopes`, now, result.OrganizationID, result.ApplicationID, result.StoreID)
	if err != nil {
		return err
	}
	type consentRecord struct {
		id, organizationID, applicationID, storeID, recipientID uuid.UUID
		scopes                                                  []string
	}
	consents := make([]consentRecord, 0)
	for rows.Next() {
		var consent consentRecord
		if err := rows.Scan(&consent.id, &consent.organizationID, &consent.applicationID, &consent.storeID, &consent.recipientID, jsonScanner{target: &consent.scopes}); err != nil {
			_ = rows.Close()
			return err
		}
		consents = append(consents, consent)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return err
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, consent := range consents {
		if err := writeMerchantRevocationConsentAudit(ctx, tx, consent.id, consent.organizationID, consent.applicationID, consent.storeID, consent.recipientID, account, consent.scopes, now); err != nil {
			return err
		}
	}
	if err := writeBusinessAuthorizationAudit(ctx, tx, result, account, "revoked", scopes, []string{}, now); err != nil {
		return err
	}
	return tx.Commit()
}
