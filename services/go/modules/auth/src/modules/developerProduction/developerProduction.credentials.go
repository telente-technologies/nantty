package developerproduction

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/google/uuid"

	developerorganizations "nantty/modules/auth/src/modules/developerOrganizations"
	"nantty/platform/httpserver"
)

func (store Store) RotateCredential(ctx context.Context, orgUUID, appUUID, credentialID uuid.UUID, accountID string) (CredentialView, string, error) {
	actorID, err := uuid.Parse(accountID)
	if err != nil {
		return CredentialView{}, "", httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SESSION", "Sign in again to manage this credential.")
	}
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return CredentialView{}, "", err
	}
	secret := "ntlive_" + hex.EncodeToString(raw)
	newID := uuid.New()
	newPrefix := secret[:15]
	now := store.Container.Now().UTC()
	tx, err := store.Container.Database.BeginTx(ctx, nil)
	if err != nil {
		return CredentialView{}, "", err
	}
	defer tx.Rollback()

	var role, applicationStatus string
	var membershipID uuid.UUID
	if err := tx.QueryRowContext(ctx, `
		SELECT m.id, m.role, a.status FROM developer_organization_memberships m
		JOIN developer_applications a ON a.organization_id = m.organization_id
		WHERE m.organization_id = $1 AND m.account_id = $2 AND a.id = $3
		FOR UPDATE OF m, a`, orgUUID, actorID, appUUID).Scan(&membershipID, &role, &applicationStatus); err != nil {
		if err == sql.ErrNoRows {
			return CredentialView{}, "", httpserver.NewApiError(http.StatusForbidden, "FORBIDDEN", "You no longer have access to this application.")
		}
		return CredentialView{}, "", err
	}
	if applicationStatus != "approved" {
		return CredentialView{}, "", httpserver.NewApiError(http.StatusForbidden, "APPLICATION_NOT_APPROVED", "Production credentials require an approved application.")
	}
	if role != "owner" && role != "admin" {
		var granted bool
		if !developerorganizations.AllowsApplicationCapability(role, "credentials.manage", true) {
			return CredentialView{}, "", httpserver.NewApiError(http.StatusForbidden, "FORBIDDEN", "Role lacks application capability: credentials.manage")
		}
		if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM developer_application_member_grants WHERE organization_id = $1 AND application_id = $2 AND membership_id = $3 AND capability = 'credentials.manage')`, orgUUID, appUUID, membershipID).Scan(&granted); err != nil {
			return CredentialView{}, "", err
		}
		if !granted {
			return CredentialView{}, "", httpserver.NewApiError(http.StatusForbidden, "INSUFFICIENT_APPLICATION_PERMISSION", "Application grant required for: credentials.manage")
		}
	}

	var name string
	var scopesRaw []byte
	if err := tx.QueryRowContext(ctx, `
		SELECT name, scopes FROM developer_production_credentials
		WHERE id = $1 AND organization_id = $2 AND application_id = $3 AND status = 'active'
		FOR UPDATE`, credentialID, orgUUID, appUUID).Scan(&name, &scopesRaw); err != nil {
		if err == sql.ErrNoRows {
			return CredentialView{}, "", httpserver.NewApiError(http.StatusNotFound, "ACTIVE_CREDENTIAL_NOT_FOUND", "The active production credential was not found.")
		}
		return CredentialView{}, "", err
	}
	var scopes []string
	if err := json.Unmarshal(scopesRaw, &scopes); err != nil {
		return CredentialView{}, "", err
	}
	result, err := tx.ExecContext(ctx, `
		UPDATE developer_production_credentials SET status = 'revoked', revoked_at = $1
		WHERE id = $2 AND organization_id = $3 AND application_id = $4 AND status = 'active'`, now, credentialID, orgUUID, appUUID)
	if err != nil {
		return CredentialView{}, "", err
	}
	if affected, err := result.RowsAffected(); err != nil || affected != 1 {
		if err != nil {
			return CredentialView{}, "", err
		}
		return CredentialView{}, "", httpserver.NewApiError(http.StatusConflict, "CREDENTIAL_ROTATION_CONFLICT", "The credential changed. Reload and try again.")
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO developer_production_credentials
		(id, application_id, organization_id, name, prefix, secret_hash, scopes, status, created_by_account_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'active', $8, $9)`,
		newID, appUUID, orgUUID, name, newPrefix, Sha256Hex(secret), string(scopesRaw), actorID, now); err != nil {
		return CredentialView{}, "", err
	}
	beforeState, err := json.Marshal(map[string]string{"credentialId": credentialID.String(), "status": "active"})
	if err != nil {
		return CredentialView{}, "", err
	}
	afterState, err := json.Marshal(map[string]string{"credentialId": newID.String(), "replacesCredentialId": credentialID.String(), "status": "active"})
	if err != nil {
		return CredentialView{}, "", err
	}
	auditResult, err := tx.ExecContext(ctx, `
		INSERT INTO developer_organization_audit_logs
		(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
		VALUES ($1, $2, $3, $4, 'credential.rotated', 'production_credential', $5, $6::jsonb, $7::jsonb, $8)`,
		uuid.New(), orgUUID, actorID, role, newID.String(), string(beforeState), string(afterState), now)
	if err != nil {
		return CredentialView{}, "", err
	}
	if affected, err := auditResult.RowsAffected(); err != nil || affected != 1 {
		if err != nil {
			return CredentialView{}, "", err
		}
		return CredentialView{}, "", errors.New("credential rotation audit was not recorded")
	}
	if err := tx.Commit(); err != nil {
		return CredentialView{}, "", err
	}
	return CredentialView{Id: newID.String(), Name: name, Prefix: newPrefix, Scopes: scopes, Status: "active", CreatedAt: now}, secret, nil
}
