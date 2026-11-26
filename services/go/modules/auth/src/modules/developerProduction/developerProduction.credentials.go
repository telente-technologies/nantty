package developerproduction

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	developerorganizations "nantty/modules/auth/src/modules/developerOrganizations"
	"nantty/platform/httpserver"
)

func (store Store) lockProductionManager(ctx context.Context, tx *sql.Tx, orgUUID, appUUID, actorID uuid.UUID, capability string, requireApproved bool) (string, error) {
	var membershipID uuid.UUID
	var role, applicationStatus string
	err := tx.QueryRowContext(ctx, `
		SELECT m.id, m.role, a.status FROM developer_organization_memberships m
		JOIN developer_applications a ON a.organization_id = m.organization_id
		WHERE m.organization_id = $1 AND m.account_id = $2 AND a.id = $3 AND a.status <> 'archived'
		FOR UPDATE OF m, a`, orgUUID, actorID, appUUID).Scan(&membershipID, &role, &applicationStatus)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", httpserver.NewApiError(http.StatusForbidden, "FORBIDDEN", "You no longer have access to this application.")
		}
		return "", err
	}
	if requireApproved && applicationStatus != "approved" {
		return "", httpserver.NewApiError(http.StatusForbidden, "APPLICATION_NOT_APPROVED", "Production access requires an approved application.")
	}
	if role == "owner" || role == "admin" {
		return role, nil
	}
	if !developerorganizations.AllowsApplicationCapability(role, capability, true) {
		return "", httpserver.NewApiError(http.StatusForbidden, "FORBIDDEN", "Role lacks application capability: "+capability)
	}
	var grantID string
	err = tx.QueryRowContext(ctx, `
		SELECT capability FROM developer_application_member_grants
		WHERE organization_id = $1 AND application_id = $2 AND membership_id = $3 AND capability = $4
		FOR SHARE`, orgUUID, appUUID, membershipID, capability).Scan(&grantID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", httpserver.NewApiError(http.StatusForbidden, "INSUFFICIENT_APPLICATION_PERMISSION", "Application grant required for: "+capability)
	}
	if err != nil {
		return "", err
	}
	return role, nil
}

func (store Store) CreateCredential(ctx context.Context, orgUUID, appUUID uuid.UUID, accountID, name string, scopes []string) (CredentialView, string, error) {
	actorID, err := uuid.Parse(accountID)
	if err != nil {
		return CredentialView{}, "", httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SESSION", "Sign in again to manage this credential.")
	}
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return CredentialView{}, "", err
	}
	secret := "ntlive_" + hex.EncodeToString(raw)
	id := uuid.New()
	now := store.Container.Now().UTC()
	scopesJSON, err := json.Marshal(scopes)
	if err != nil {
		return CredentialView{}, "", err
	}
	tx, err := store.Container.Database.BeginTx(ctx, nil)
	if err != nil {
		return CredentialView{}, "", err
	}
	defer tx.Rollback()
	role, err := store.lockProductionManager(ctx, tx, orgUUID, appUUID, actorID, "credentials.manage", true)
	if err != nil {
		return CredentialView{}, "", err
	}
	prefix := secret[:15]
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO developer_production_credentials
		(id, application_id, organization_id, name, prefix, secret_hash, scopes, status, created_by_account_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'active', $8, $9)`,
		id, appUUID, orgUUID, name, prefix, Sha256Hex(secret), string(scopesJSON), actorID, now); err != nil {
		return CredentialView{}, "", err
	}
	after, err := json.Marshal(map[string]string{"credentialId": id.String(), "status": "active"})
	if err != nil {
		return CredentialView{}, "", err
	}
	if err := writeProductionResourceAudit(ctx, tx, orgUUID, actorID, id.String(), role, "production_credential", "credential.created", `{}`, string(after), now); err != nil {
		return CredentialView{}, "", err
	}
	if err := tx.Commit(); err != nil {
		return CredentialView{}, "", err
	}
	return CredentialView{Id: id.String(), Name: name, Prefix: prefix, Scopes: scopes, Status: "active", CreatedAt: now}, secret, nil
}

func writeProductionResourceAudit(ctx context.Context, tx *sql.Tx, orgUUID, actorID uuid.UUID, subjectID, role, subjectType, action, before, after string, now time.Time) error {
	result, err := tx.ExecContext(ctx, `
		INSERT INTO developer_organization_audit_logs
		(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
		uuid.New(), orgUUID, actorID, role, action, subjectType, subjectID, before, after, now)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil || affected != 1 {
		if err != nil {
			return err
		}
		return errors.New("credential audit was not recorded")
	}
	return nil
}

func (store Store) RevokeCredential(ctx context.Context, orgUUID, appUUID, credentialID uuid.UUID, accountID string) error {
	actorID, err := uuid.Parse(accountID)
	if err != nil {
		return httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SESSION", "Sign in again to manage this credential.")
	}
	tx, err := store.Container.Database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	role, err := store.lockProductionManager(ctx, tx, orgUUID, appUUID, actorID, "credentials.manage", false)
	if err != nil {
		return err
	}
	var name string
	if err := tx.QueryRowContext(ctx, `
		SELECT name FROM developer_production_credentials
		WHERE id = $1 AND organization_id = $2 AND application_id = $3 AND status = 'active'
		FOR UPDATE`, credentialID, orgUUID, appUUID).Scan(&name); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return httpserver.NewApiError(http.StatusNotFound, "ACTIVE_CREDENTIAL_NOT_FOUND", "The active production credential was not found.")
		}
		return err
	}
	now := store.Container.Now().UTC()
	if _, err := tx.ExecContext(ctx, `UPDATE developer_production_credentials SET status = 'revoked', revoked_at = $1 WHERE id = $2 AND organization_id = $3 AND application_id = $4 AND status = 'active'`, now, credentialID, orgUUID, appUUID); err != nil {
		return err
	}
	before, err := json.Marshal(map[string]string{"credentialId": credentialID.String(), "status": "active"})
	if err != nil {
		return err
	}
	after, err := json.Marshal(map[string]string{"credentialId": credentialID.String(), "status": "revoked"})
	if err != nil {
		return err
	}
	if err := writeProductionResourceAudit(ctx, tx, orgUUID, actorID, credentialID.String(), role, "production_credential", "credential.revoked", string(before), string(after), now); err != nil {
		return err
	}
	return tx.Commit()
}

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
	role, err := store.lockProductionManager(ctx, tx, orgUUID, appUUID, actorID, "credentials.manage", true)
	if err != nil {
		return CredentialView{}, "", err
	}
	var name string
	var scopesRaw []byte
	if err := tx.QueryRowContext(ctx, `
		SELECT name, scopes FROM developer_production_credentials
		WHERE id = $1 AND organization_id = $2 AND application_id = $3 AND status = 'active'
		FOR UPDATE`, credentialID, orgUUID, appUUID).Scan(&name, &scopesRaw); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
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
	before, err := json.Marshal(map[string]string{"credentialId": credentialID.String(), "status": "active"})
	if err != nil {
		return CredentialView{}, "", err
	}
	after, err := json.Marshal(map[string]string{"credentialId": newID.String(), "replacesCredentialId": credentialID.String(), "status": "active"})
	if err != nil {
		return CredentialView{}, "", err
	}
	if err := writeProductionResourceAudit(ctx, tx, orgUUID, actorID, newID.String(), role, "production_credential", "credential.rotated", string(before), string(after), now); err != nil {
		return CredentialView{}, "", err
	}
	if err := tx.Commit(); err != nil {
		return CredentialView{}, "", err
	}
	return CredentialView{Id: newID.String(), Name: name, Prefix: newPrefix, Scopes: scopes, Status: "active", CreatedAt: now}, secret, nil
}
