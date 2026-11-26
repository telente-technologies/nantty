package developerapplications

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
)

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
	storeID, err := uuid.Parse(input.StoreID)
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
	var appScopes, redirectURIs []string
	err = tx.QueryRowContext(ctx, `
		SELECT requested_scopes, redirect_uris FROM developer_applications
		WHERE id = $1 AND organization_id = $2 AND api_product = $3 AND status = 'approved'
		FOR SHARE`, applicationID, organizationID, apiProductBusinessMessaging).
		Scan(jsonScanner{target: &appScopes}, jsonScanner{target: &redirectURIs})
	if errors.Is(err, sql.ErrNoRows) {
		return BusinessConsent{}, errBusinessConsentNotFound
	}
	if err != nil {
		return BusinessConsent{}, err
	}
	if err := validateBusinessConsentAuthorizationRequest(input.Authorization, redirectURIs); err != nil {
		return BusinessConsent{}, err
	}
	for _, scope := range scopes {
		if !containsGrant(appScopes, scope) {
			return BusinessConsent{}, errInvalidBusinessConsent
		}
	}
	var storeScopes []string
	err = tx.QueryRowContext(ctx, `
		SELECT scopes FROM developer_business_authorizations
		WHERE organization_id = $1 AND application_id = $2 AND store_id = $3 AND status = 'active'
		FOR SHARE`, organizationID, applicationID, storeID).Scan(jsonScanner{target: &storeScopes})
	if errors.Is(err, sql.ErrNoRows) {
		return BusinessConsent{}, errBusinessConsentNotFound
	}
	if err != nil {
		return BusinessConsent{}, err
	}
	for _, scope := range scopes {
		if !containsGrant(storeScopes, scope) {
			return BusinessConsent{}, errInvalidBusinessConsent
		}
	}
	var beforeScopes []string
	var previousStatus string
	lookupErr := tx.QueryRowContext(ctx, `
		SELECT scopes, status FROM developer_business_consents
		WHERE application_id = $1 AND store_id = $2 AND recipient_account_id = $3 FOR UPDATE`, applicationID, storeID, account).
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
		  (id, organization_id, application_id, store_id, recipient_account_id, status, scopes, granted_at, revoked_at)
		VALUES ($1,$2,$3,$4,$5,'active',$6::jsonb,$7,NULL)
		ON CONFLICT (application_id, store_id, recipient_account_id) WHERE store_id IS NOT NULL DO UPDATE
		SET organization_id = EXCLUDED.organization_id, status = 'active', scopes = EXCLUDED.scopes,
		    granted_at = EXCLUDED.granted_at, revoked_at = NULL
		RETURNING id, organization_id, application_id, store_id, scopes, status, granted_at, revoked_at`,
		uuid.New(), organizationID, applicationID, storeID, account, string(encoded), now).
		Scan(&result.ID, &result.OrganizationID, &result.ApplicationID, &result.StoreID, jsonScanner{target: &result.Scopes}, &result.Status, &result.GrantedAt, nullTimeScanner{target: &revokedAt})
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
	result.AuthorizationRedirectURL, err = issueBusinessConsentAuthorizationCode(ctx, tx, result, account, input.Authorization, now)
	if err != nil {
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
