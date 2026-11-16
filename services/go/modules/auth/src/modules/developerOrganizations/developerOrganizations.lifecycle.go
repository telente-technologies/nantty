package developerorganizations

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

func (service Service) TransferOwnership(ctx context.Context, accountID, organizationID string, request TransferOwnershipRequest) (TransferOwnershipResult, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return TransferOwnershipResult{}, errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return TransferOwnershipResult{}, errOrganizationAccessNotFound
	}
	targetMembership, err := uuid.Parse(request.MemberID)
	if err != nil {
		return TransferOwnershipResult{}, errOwnershipTargetNotFound
	}
	if request.Confirmation != "TRANSFER OWNERSHIP" {
		return TransferOwnershipResult{}, errTransferConfirmationRequired
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return TransferOwnershipResult{}, err
	}
	defer tx.Rollback()
	var lockedOrganization uuid.UUID
	if err := tx.QueryRowContext(ctx, `SELECT id FROM developer_organizations WHERE id = $1 FOR UPDATE`, organization).Scan(&lockedOrganization); errors.Is(err, sql.ErrNoRows) {
		return TransferOwnershipResult{}, errOrganizationAccessNotFound
	} else if err != nil {
		return TransferOwnershipResult{}, err
	}
	var actorMembership uuid.UUID
	var actorRole string
	err = tx.QueryRowContext(ctx, `
		SELECT id, role FROM developer_organization_memberships
		WHERE account_id = $1 AND organization_id = $2 FOR UPDATE`, account, organization).Scan(&actorMembership, &actorRole)
	if errors.Is(err, sql.ErrNoRows) {
		return TransferOwnershipResult{}, errOrganizationAccessNotFound
	}
	if err != nil {
		return TransferOwnershipResult{}, err
	}
	if actorRole != "owner" {
		return TransferOwnershipResult{}, errOrganizationForbidden
	}
	var targetAccount uuid.UUID
	var targetRole string
	err = tx.QueryRowContext(ctx, `
		SELECT account_id, role FROM developer_organization_memberships
		WHERE id = $1 AND organization_id = $2 FOR UPDATE`, targetMembership, organization).Scan(&targetAccount, &targetRole)
	if errors.Is(err, sql.ErrNoRows) {
		return TransferOwnershipResult{}, errOwnershipTargetNotFound
	}
	if err != nil {
		return TransferOwnershipResult{}, err
	}
	if targetAccount == account || targetRole == "owner" {
		return TransferOwnershipResult{}, errOwnershipTargetInvalid
	}
	if _, err := tx.ExecContext(ctx, `UPDATE developer_organization_memberships SET role = 'admin' WHERE id = $1`, actorMembership); err != nil {
		return TransferOwnershipResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE developer_organization_memberships SET role = 'owner' WHERE id = $1`, targetMembership); err != nil {
		return TransferOwnershipResult{}, err
	}
	before, err := json.Marshal(map[string]string{"previousOwnerMembershipId": actorMembership.String(), "newOwnerPreviousRole": targetRole})
	if err != nil {
		return TransferOwnershipResult{}, err
	}
	after, err := json.Marshal(map[string]string{"previousOwnerMembershipId": actorMembership.String(), "newOwnerMembershipId": targetMembership.String()})
	if err != nil {
		return TransferOwnershipResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO developer_organization_audit_logs
		(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
		VALUES ($1, $2, $3, 'owner', 'organization.ownership_transferred', 'organization_membership', $4, $5, $6, $7)`,
		uuid.New(), organization, account, targetMembership.String(), before, after, service.Container.Now()); err != nil {
		return TransferOwnershipResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return TransferOwnershipResult{}, err
	}
	return TransferOwnershipResult{PreviousOwnerMembershipID: actorMembership.String(), NewOwnerMembershipID: targetMembership.String()}, nil
}

func (service Service) Create(ctx context.Context, accountID, idempotencyKey string, request CreateRequest) (Organization, bool, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return Organization{}, false, errInvalidAccount
	}
	if len(idempotencyKey) < 16 || len(idempotencyKey) > 128 || strings.TrimSpace(idempotencyKey) != idempotencyKey {
		return Organization{}, false, errIdempotencyNeeded
	}
	if err := ValidateCreateRequest(request); err != nil {
		return Organization{}, false, err
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return Organization{}, false, err
	}
	defer tx.Rollback()
	now := service.Container.Now()
	var previousID sql.NullString
	if _, err := tx.ExecContext(ctx, `DELETE FROM developer_organization_idempotency WHERE account_id = $1 AND idempotency_key = $2 AND expires_at <= $3`, account, idempotencyKey, now); err != nil {
		return Organization{}, false, fmt.Errorf("remove expired idempotency record: %w", err)
	}
	err = tx.QueryRowContext(ctx, `
		INSERT INTO developer_organization_idempotency (account_id, idempotency_key, created_at, expires_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (account_id, idempotency_key) DO NOTHING
		RETURNING organization_id`, account, idempotencyKey, now, now.Add(24*time.Hour)).Scan(&previousID)
	if errors.Is(err, sql.ErrNoRows) {
		var organizationID string
		if err := tx.QueryRowContext(ctx, `SELECT organization_id FROM developer_organization_idempotency WHERE account_id = $1 AND idempotency_key = $2`, account, idempotencyKey).Scan(&organizationID); err != nil {
			return Organization{}, false, err
		}
		organization, err := loadOrganization(ctx, tx, account.String(), organizationID)
		if err != nil {
			return Organization{}, false, err
		}
		if err := tx.Commit(); err != nil {
			return Organization{}, false, err
		}
		return organization, true, nil
	}
	if err != nil {
		return Organization{}, false, fmt.Errorf("reserve idempotency record: %w", err)
	}
	organizationID, err := uuid.NewV7()
	if err != nil {
		return Organization{}, false, err
	}
	name := strings.TrimSpace(request.Name)
	_, err = tx.ExecContext(ctx, `INSERT INTO developer_organizations (id, name, slug, created_by_account_id, created_at) VALUES ($1, $2, $3, $4, $5)`, organizationID, name, request.Slug, account, now)
	if err != nil {
		if isUniqueViolation(err) {
			return Organization{}, false, errSlugTaken
		}
		return Organization{}, false, fmt.Errorf("insert developer organization: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO developer_organization_memberships (id, organization_id, account_id, role, created_at) VALUES ($1, $2, $3, 'owner', $4)`, uuid.New(), organizationID, account, now); err != nil {
		return Organization{}, false, fmt.Errorf("insert developer organization owner: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `UPDATE developer_organization_idempotency SET organization_id = $3 WHERE account_id = $1 AND idempotency_key = $2`, account, idempotencyKey, organizationID); err != nil {
		return Organization{}, false, fmt.Errorf("link organization idempotency record: %w", err)
	}
	after, _ := json.Marshal(map[string]string{"name": name, "slug": request.Slug})
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO developer_organization_audit_logs
		(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
		VALUES ($1, $2, $3, 'owner', 'organization.created', 'organization', $6, '{}'::jsonb, $4, $5)`,
		uuid.New(), organizationID, account, after, now, organizationID.String()); err != nil {
		return Organization{}, false, fmt.Errorf("record organization creation audit event: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return Organization{}, false, err
	}
	return Organization{ID: organizationID.String(), Name: name, Slug: request.Slug, Role: "owner", CreatedAt: now}, false, nil
}

type rowQueryer interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func loadOrganization(ctx context.Context, queryer rowQueryer, accountID, organizationID string) (Organization, error) {
	var organization Organization
	err := queryer.QueryRowContext(ctx, `
		SELECT o.id, o.name, o.slug, m.role, o.created_at
		FROM developer_organization_memberships m
		JOIN developer_organizations o ON o.id = m.organization_id
		WHERE m.account_id = $1 AND o.id = $2`, accountID, organizationID).
		Scan(&organization.ID, &organization.Name, &organization.Slug, &organization.Role, &organization.CreatedAt)
	return organization, err
}

func isUniqueViolation(err error) bool {
	var databaseError *pgconn.PgError
	return errors.As(err, &databaseError) && databaseError.Code == "23505"
}
