package developerapplications

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type applicationQueryer interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func loadApplication(ctx context.Context, query applicationQueryer, organizationID, applicationID any) (Application, error) {
	var result Application
	err := query.QueryRowContext(ctx, `SELECT id,organization_id,name,purpose,api_product,callback_origins,redirect_uris,requested_scopes,status,created_at,updated_at FROM developer_applications WHERE organization_id=$1 AND id=$2`, organizationID, applicationID).Scan(&result.ID, &result.OrganizationID, &result.Name, &result.Purpose, &result.APIProduct, jsonScanner{target: &result.CallbackOrigins}, jsonScanner{target: &result.RedirectURIs}, jsonScanner{target: &result.RequestedScopes}, &result.Status, &result.CreatedAt, &result.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Application{}, errApplicationNotFound
	}
	return result, err
}

func loadApplicationForUpdate(ctx context.Context, tx *sql.Tx, organizationID, applicationID uuid.UUID) (Application, error) {
	var result Application
	err := tx.QueryRowContext(ctx, `SELECT id,organization_id,name,purpose,api_product,callback_origins,redirect_uris,requested_scopes,status,created_at,updated_at FROM developer_applications WHERE organization_id=$1 AND id=$2 FOR UPDATE`, organizationID, applicationID).Scan(&result.ID, &result.OrganizationID, &result.Name, &result.Purpose, &result.APIProduct, jsonScanner{target: &result.CallbackOrigins}, jsonScanner{target: &result.RedirectURIs}, jsonScanner{target: &result.RequestedScopes}, &result.Status, &result.CreatedAt, &result.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Application{}, errApplicationNotFound
	}
	return result, err
}

type applicationRows interface{ Scan(...any) error }
type jsonScanner struct{ target any }

func (scanner jsonScanner) Scan(source any) error {
	bytes, ok := source.([]byte)
	if !ok {
		return fmt.Errorf("application JSON column has type %T", source)
	}
	return json.Unmarshal(bytes, scanner.target)
}

func scanApplication(rows applicationRows) (Application, error) {
	var result Application
	err := rows.Scan(&result.ID, &result.OrganizationID, &result.Name, &result.Purpose, &result.APIProduct, jsonScanner{target: &result.CallbackOrigins}, jsonScanner{target: &result.RedirectURIs}, jsonScanner{target: &result.RequestedScopes}, &result.Status, &result.CreatedAt, &result.UpdatedAt)
	return result, err
}

func (service Service) organizationRole(ctx context.Context, accountID, organizationID uuid.UUID) (string, error) {
	var role string
	err := service.Container.Database.QueryRowContext(ctx, `SELECT role FROM developer_organization_memberships WHERE account_id=$1 AND organization_id=$2`, accountID, organizationID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", errApplicationOrganizationNotFound
	}
	return role, err
}

func canManageApplicationRegistry(role string) bool { return role == "owner" || role == "admin" }

func organizationRoleForUpdate(ctx context.Context, tx *sql.Tx, accountID, organizationID uuid.UUID) (string, error) {
	var role string
	err := tx.QueryRowContext(ctx, `SELECT m.role FROM developer_organization_memberships m JOIN developer_organizations o ON o.id=m.organization_id WHERE m.account_id=$1 AND m.organization_id=$2 FOR UPDATE OF o`, accountID, organizationID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", errApplicationOrganizationNotFound
	}
	return role, err
}

func parseApplicationRouteIDs(accountID, organizationID, applicationID string) (uuid.UUID, uuid.UUID, uuid.UUID, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, errInvalidApplicationAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, errApplicationOrganizationNotFound
	}
	if applicationID == "" {
		return account, organization, uuid.Nil, nil
	}
	application, err := uuid.Parse(applicationID)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, errApplicationNotFound
	}
	return account, organization, application, nil
}

func applicationInputFingerprint(input ApplicationInput) (string, error) {
	encoded, err := json.Marshal(input)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:]), nil
}

func writeApplicationAudit(ctx context.Context, tx *sql.Tx, organizationID, actorID uuid.UUID, actorRole, action string, applicationID uuid.UUID, before, after any, now time.Time) error {
	beforeJSON, err := json.Marshal(before)
	if err != nil {
		return err
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO developer_organization_audit_logs (id,organization_id,actor_account_id,actor_role,action,subject_type,subject_id,before_state,after_state,created_at) VALUES ($1,$2,$3,$4,$5,'developer_application',$6,$7,$8,$9)`, uuid.New(), organizationID, actorID, actorRole, action, applicationID.String(), beforeJSON, afterJSON, now)
	return err
}
