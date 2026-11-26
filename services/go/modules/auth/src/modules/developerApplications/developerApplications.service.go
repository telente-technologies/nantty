package developerapplications

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"nantty/modules/auth/src/container"
)

type Service struct{ Container *container.Container }

func (service Service) List(ctx context.Context, accountID, organizationID string) ([]Application, error) {
	account, organization, _, err := parseApplicationRouteIDs(accountID, organizationID, "")
	if err != nil {
		return nil, err
	}
	role, err := service.organizationRole(ctx, account, organization)
	if err != nil {
		return nil, err
	}
	if !canManageApplicationRegistry(role) {
		rows, err := service.Container.Database.QueryContext(ctx, `
			SELECT a.id, a.organization_id, a.name, a.purpose, a.api_product, a.callback_origins, a.redirect_uris, a.requested_scopes, a.status, a.created_at, a.updated_at
			FROM developer_applications a
			JOIN developer_application_member_grants g ON g.application_id = a.id AND g.organization_id = a.organization_id
			JOIN developer_organization_memberships m ON m.id = g.membership_id AND m.organization_id = g.organization_id
			WHERE a.organization_id = $1 AND a.status <> 'archived' AND m.account_id = $2 AND m.role = 'developer' AND g.capability = 'applications.read'
			ORDER BY a.created_at DESC, a.id`, organization, account)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		applications := make([]Application, 0)
		for rows.Next() {
			application, err := scanApplication(rows)
			if err != nil {
				return nil, err
			}
			applications = append(applications, application)
		}
		return applications, rows.Err()
	}
	rows, err := service.Container.Database.QueryContext(ctx, `
		SELECT id, organization_id, name, purpose, api_product, callback_origins, redirect_uris, requested_scopes, status, created_at, updated_at
		FROM developer_applications WHERE organization_id = $1 AND status <> 'archived'
		ORDER BY created_at DESC, id`, organization)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	applications := make([]Application, 0)
	for rows.Next() {
		application, err := scanApplication(rows)
		if err != nil {
			return nil, err
		}
		applications = append(applications, application)
	}
	return applications, rows.Err()
}

func (service Service) Get(ctx context.Context, accountID, organizationID, applicationID string) (Application, error) {
	account, organization, application, err := parseApplicationRouteIDs(accountID, organizationID, applicationID)
	if err != nil {
		return Application{}, err
	}
	role, err := service.organizationRole(ctx, account, organization)
	if err != nil {
		return Application{}, err
	}
	if !canManageApplicationRegistry(role) {
		allowed, err := service.HasCapability(ctx, account.String(), organization.String(), application.String(), "applications.read")
		if err != nil {
			return Application{}, err
		}
		if !allowed {
			return Application{}, errApplicationForbidden
		}
	}
	result, err := loadApplication(ctx, service.Container.Database, organization, application)
	if err != nil {
		return Application{}, err
	}
	if result.Status == "archived" {
		return Application{}, errApplicationNotFound
	}
	return result, nil
}

func (service Service) Create(ctx context.Context, accountID, organizationID, idempotencyKey string, input ApplicationInput) (Application, bool, error) {
	account, organization, _, err := parseApplicationRouteIDs(accountID, organizationID, "")
	if err != nil {
		return Application{}, false, err
	}
	input, err = NormalizeDeveloperApplicationInput(input)
	if err != nil {
		return Application{}, false, err
	}
	if len(idempotencyKey) < 16 || len(idempotencyKey) > 128 || strings.TrimSpace(idempotencyKey) != idempotencyKey {
		return Application{}, false, errApplicationIdempotencyRequired
	}
	fingerprint, err := applicationInputFingerprint(input)
	if err != nil {
		return Application{}, false, err
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return Application{}, false, err
	}
	defer tx.Rollback()
	role, err := organizationRoleForUpdate(ctx, tx, account, organization)
	if err != nil {
		return Application{}, false, err
	}
	if role != "owner" && role != "admin" {
		return Application{}, false, errApplicationForbidden
	}
	now := service.Container.Now()
	var previousApplicationID sql.NullString
	err = tx.QueryRowContext(ctx, `
		INSERT INTO developer_application_idempotency (organization_id, account_id, idempotency_key, request_fingerprint, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (organization_id, account_id, idempotency_key) DO UPDATE
		SET application_id = NULL, request_fingerprint = EXCLUDED.request_fingerprint, created_at = $6, expires_at = EXCLUDED.expires_at
		WHERE developer_application_idempotency.expires_at <= $6
		RETURNING application_id`, organization, account, idempotencyKey, fingerprint, now.Add(24*time.Hour), now).Scan(&previousApplicationID)
	if errors.Is(err, sql.ErrNoRows) {
		var previousFingerprint string
		var previousID sql.NullString
		if err := tx.QueryRowContext(ctx, `SELECT request_fingerprint, application_id FROM developer_application_idempotency WHERE organization_id=$1 AND account_id=$2 AND idempotency_key=$3`, organization, account, idempotencyKey).Scan(&previousFingerprint, &previousID); err != nil {
			return Application{}, false, err
		}
		if previousFingerprint != fingerprint {
			return Application{}, false, errApplicationIdempotencyConflict
		}
		if !previousID.Valid {
			return Application{}, false, errors.New("developer application idempotency record is incomplete")
		}
		result, err := loadApplication(ctx, tx, organization, previousID.String)
		if err != nil {
			return Application{}, false, err
		}
		if err := tx.Commit(); err != nil {
			return Application{}, false, err
		}
		return result, true, nil
	}
	if err != nil {
		return Application{}, false, err
	}
	applicationID, err := uuid.NewV7()
	if err != nil {
		return Application{}, false, err
	}
	origins, _ := json.Marshal(input.CallbackOrigins)
	redirectURIs, _ := json.Marshal(input.RedirectURIs)
	scopes, _ := json.Marshal(input.RequestedScopes)
	if _, err := tx.ExecContext(ctx, `INSERT INTO developer_applications (id, organization_id, name, purpose, api_product, callback_origins, redirect_uris, requested_scopes, status, created_by_account_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$10)`, applicationID, organization, input.Name, input.Purpose, apiProductBusinessMessaging, origins, redirectURIs, scopes, account, now); err != nil {
		return Application{}, false, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE developer_application_idempotency SET application_id=$4 WHERE organization_id=$1 AND account_id=$2 AND idempotency_key=$3`, organization, account, idempotencyKey, applicationID); err != nil {
		return Application{}, false, err
	}
	if err := writeApplicationAudit(ctx, tx, organization, account, role, "application.created", applicationID, nil, input, now); err != nil {
		return Application{}, false, err
	}
	if err := tx.Commit(); err != nil {
		return Application{}, false, err
	}
	return Application{ID: applicationID.String(), OrganizationID: organization.String(), Name: input.Name, Purpose: input.Purpose, APIProduct: apiProductBusinessMessaging, CallbackOrigins: input.CallbackOrigins, RedirectURIs: input.RedirectURIs, RequestedScopes: input.RequestedScopes, Status: "draft", CreatedAt: now, UpdatedAt: now}, false, nil
}

func (service Service) Update(ctx context.Context, accountID, organizationID, applicationID string, input ApplicationInput) (Application, error) {
	account, organization, application, err := parseApplicationRouteIDs(accountID, organizationID, applicationID)
	if err != nil {
		return Application{}, err
	}
	input, err = NormalizeDeveloperApplicationInput(input)
	if err != nil {
		return Application{}, err
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return Application{}, err
	}
	defer tx.Rollback()
	role, err := organizationRoleForUpdate(ctx, tx, account, organization)
	if err != nil {
		return Application{}, err
	}
	if role != "owner" && role != "admin" {
		return Application{}, errApplicationForbidden
	}
	previous, err := loadApplicationForUpdate(ctx, tx, organization, application)
	if err != nil {
		return Application{}, err
	}
	if previous.Status != "draft" {
		return Application{}, errApplicationConflict
	}
	origins, _ := json.Marshal(input.CallbackOrigins)
	redirectURIs, _ := json.Marshal(input.RedirectURIs)
	scopes, _ := json.Marshal(input.RequestedScopes)
	now := service.Container.Now()
	if _, err := tx.ExecContext(ctx, `UPDATE developer_applications SET name=$1,purpose=$2,callback_origins=$3,redirect_uris=$4,requested_scopes=$5,updated_at=$6 WHERE id=$7 AND organization_id=$8`, input.Name, input.Purpose, origins, redirectURIs, scopes, now, application, organization); err != nil {
		return Application{}, err
	}
	if err := writeApplicationAudit(ctx, tx, organization, account, role, "application.updated", application, previous, input, now); err != nil {
		return Application{}, err
	}
	if err := tx.Commit(); err != nil {
		return Application{}, err
	}
	return Application{ID: application.String(), OrganizationID: organization.String(), Name: input.Name, Purpose: input.Purpose, APIProduct: previous.APIProduct, CallbackOrigins: input.CallbackOrigins, RedirectURIs: input.RedirectURIs, RequestedScopes: input.RequestedScopes, Status: previous.Status, CreatedAt: previous.CreatedAt, UpdatedAt: now}, nil
}

func (service Service) Archive(ctx context.Context, accountID, organizationID, applicationID string) error {
	account, organization, application, err := parseApplicationRouteIDs(accountID, organizationID, applicationID)
	if err != nil {
		return err
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	role, err := organizationRoleForUpdate(ctx, tx, account, organization)
	if err != nil {
		return err
	}
	if role != "owner" && role != "admin" {
		return errApplicationForbidden
	}
	previous, err := loadApplicationForUpdate(ctx, tx, organization, application)
	if err != nil {
		return err
	}
	if previous.Status != "archived" {
		now := service.Container.Now()
		if _, err := tx.ExecContext(ctx, `UPDATE developer_applications SET status='archived',updated_at=$1 WHERE id=$2 AND organization_id=$3`, now, application, organization); err != nil {
			return err
		}
		if err := writeApplicationAudit(ctx, tx, organization, account, role, "application.archived", application, map[string]string{"status": previous.Status}, map[string]string{"status": "archived"}, now); err != nil {
			return err
		}
	}
	return tx.Commit()
}
