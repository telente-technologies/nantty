package developerorganizations

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"
	"nantty/modules/auth/src/container"
)

var (
	errInvalidName                  = errors.New("organization name is invalid")
	errInvalidSlug                  = errors.New("organization slug is invalid")
	errSlugTaken                    = errors.New("organization slug is already in use")
	errInvalidAccount               = errors.New("authenticated account is invalid")
	errOrganizationAccessNotFound   = errors.New("organization access was not found")
	errOrganizationForbidden        = errors.New("organization capability is required")
	errInvalidRole                  = errors.New("organization role is invalid")
	errOwnershipTransferRequired    = errors.New("organization ownership must be transferred separately")
	errOwnershipTargetNotFound      = errors.New("organization ownership target was not found")
	errOwnershipTargetInvalid       = errors.New("organization ownership target is invalid")
	errTransferConfirmationRequired = errors.New("ownership transfer confirmation is required")
	errIdempotencyNeeded            = errors.New("a valid idempotency key is required")
	errInvitationTargetUnavailable  = errors.New("no eligible account matches this invitation")
	errInvitationAlreadyExists      = errors.New("an active invitation or membership already exists")
	errInvitationNotFound           = errors.New("the organization invitation was not found")
	errInvitationExpired            = errors.New("the organization invitation has expired")
	errInvitationNotPending         = errors.New("the organization invitation is no longer pending")
	errInvitationResendCooldown     = errors.New("please wait before resending this invitation")
	errInvalidInvitation            = errors.New("organization invitation details are invalid")
)

type Service struct{ Container *container.Container }

func (service Service) List(ctx context.Context, accountID string) ([]Organization, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return nil, errInvalidAccount
	}
	rows, err := service.Container.Database.QueryContext(ctx, `
		SELECT o.id, o.name, o.slug, m.role, o.created_at
		FROM developer_organization_memberships m
		JOIN developer_organizations o ON o.id = m.organization_id
		WHERE m.account_id = $1
		ORDER BY o.created_at, o.id`, account)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	organizations := make([]Organization, 0)
	for rows.Next() {
		var organization Organization
		if err := rows.Scan(&organization.ID, &organization.Name, &organization.Slug, &organization.Role, &organization.CreatedAt); err != nil {
			return nil, err
		}
		organizations = append(organizations, organization)
	}
	return organizations, rows.Err()
}

func (service Service) Get(ctx context.Context, accountID, organizationID string) (Organization, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return Organization{}, errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return Organization{}, errOrganizationAccessNotFound
	}
	var result Organization
	err = service.Container.Database.QueryRowContext(ctx, `
		SELECT o.id, o.name, o.slug, m.role, o.created_at
		FROM developer_organization_memberships m
		JOIN developer_organizations o ON o.id = m.organization_id
		WHERE m.account_id = $1 AND o.id = $2`, account, organization).
		Scan(&result.ID, &result.Name, &result.Slug, &result.Role, &result.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Organization{}, errOrganizationAccessNotFound
	}
	if err != nil {
		return Organization{}, err
	}
	return result, nil
}

func (service Service) Update(ctx context.Context, accountID, organizationID string, request UpdateOrganizationRequest) (Organization, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return Organization{}, errInvalidAccount
	}
	organizationIDValue, err := uuid.Parse(organizationID)
	if err != nil {
		return Organization{}, errOrganizationAccessNotFound
	}
	if err := ValidateCreateRequest(CreateRequest{Name: request.Name, Slug: request.Slug}); err != nil {
		return Organization{}, err
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return Organization{}, err
	}
	defer tx.Rollback()
	var result Organization
	err = tx.QueryRowContext(ctx, `
		SELECT o.name, o.slug, o.created_at, m.role
		FROM developer_organizations o
		JOIN developer_organization_memberships m ON m.organization_id = o.id
		WHERE o.id = $1 AND m.account_id = $2
		FOR UPDATE OF o`, organizationIDValue, account).
		Scan(&result.Name, &result.Slug, &result.CreatedAt, &result.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return Organization{}, errOrganizationAccessNotFound
	}
	if err != nil {
		return Organization{}, err
	}
	if !AllowsOrganizationCapability(result.Role, "organization.manage") {
		return Organization{}, errOrganizationForbidden
	}
	previousName, previousSlug := result.Name, result.Slug
	result.Name, result.Slug = strings.TrimSpace(request.Name), request.Slug
	if previousName != result.Name || previousSlug != result.Slug {
		if _, err := tx.ExecContext(ctx, `UPDATE developer_organizations SET name = $1, slug = $2 WHERE id = $3`, result.Name, result.Slug, organizationIDValue); err != nil {
			if isUniqueViolation(err) {
				return Organization{}, errSlugTaken
			}
			return Organization{}, err
		}
		before, _ := json.Marshal(map[string]string{"name": previousName, "slug": previousSlug})
		after, _ := json.Marshal(map[string]string{"name": result.Name, "slug": result.Slug})
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO developer_organization_audit_logs
			(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
			VALUES ($1, $2, $3, $4, 'organization.updated', 'organization', $8, $5, $6, $7)`,
			uuid.New(), organizationIDValue, account, result.Role, before, after, service.Container.Now(), organizationIDValue.String()); err != nil {
			return Organization{}, err
		}
	}
	result.ID = organizationIDValue.String()
	if err := tx.Commit(); err != nil {
		return Organization{}, err
	}
	return result, nil
}

func (service Service) AuditLog(ctx context.Context, accountID, organizationID string, limit int) ([]OrganizationAuditEntry, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return nil, errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return nil, errOrganizationAccessNotFound
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var actorRole string
	err = tx.QueryRowContext(ctx, `
		SELECT role FROM developer_organization_memberships
		WHERE account_id = $1 AND organization_id = $2`, account, organization).Scan(&actorRole)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errOrganizationAccessNotFound
	}
	if err != nil {
		return nil, err
	}
	if !AllowsOrganizationCapability(actorRole, "security.manage") {
		return nil, errOrganizationForbidden
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	rows, err := tx.QueryContext(ctx, `
		SELECT id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at
		FROM developer_organization_audit_logs
		WHERE organization_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT $2`, organization, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := make([]OrganizationAuditEntry, 0)
	for rows.Next() {
		var entry OrganizationAuditEntry
		var before, after []byte
		if err := rows.Scan(&entry.ID, &entry.ActorAccountID, &entry.ActorRole, &entry.Action, &entry.SubjectType, &entry.SubjectID, &before, &after, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entry.BeforeState = append(json.RawMessage{}, before...)
		entry.AfterState = append(json.RawMessage{}, after...)
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return entries, nil
}

func (service Service) Access(ctx context.Context, accountID, organizationID string) (OrganizationAccess, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return OrganizationAccess{}, errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return OrganizationAccess{}, errOrganizationAccessNotFound
	}
	var role string
	err = service.Container.Database.QueryRowContext(ctx, `
		SELECT role
		FROM developer_organization_memberships
		WHERE account_id = $1 AND organization_id = $2`, account, organization).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return OrganizationAccess{}, errOrganizationAccessNotFound
	}
	if err != nil {
		return OrganizationAccess{}, err
	}
	organizationCapabilities, _ := CapabilitiesForRole(role)
	applicationCapabilities, eligibleApplicationCapabilities := ApplicationCapabilitiesForGrant(role, nil)
	return OrganizationAccess{
		OrganizationID: organization.String(), Role: role,
		OrganizationCapabilities:        organizationCapabilities,
		ApplicationCapabilities:         applicationCapabilities,
		EligibleApplicationCapabilities: eligibleApplicationCapabilities,
		ApplicationGrantRequired:        len(eligibleApplicationCapabilities) > 0,
	}, nil
}

func (service Service) Roles(ctx context.Context, accountID, organizationID string) ([]OrganizationRole, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return nil, errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return nil, errOrganizationAccessNotFound
	}
	var exists bool
	err = service.Container.Database.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM developer_organization_memberships
			WHERE account_id = $1 AND organization_id = $2
		)`, account, organization).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, errOrganizationAccessNotFound
	}
	roleNames := []string{"owner", "admin", "developer", "analyst", "billing"}
	roles := make([]OrganizationRole, 0, len(roleNames))
	for _, name := range roleNames {
		organizationCapabilities, applicationCapabilities := CapabilitiesForRole(name)
		roles = append(roles, OrganizationRole{
			Name: name, OrganizationCapabilities: organizationCapabilities,
			ApplicationCapabilities: applicationCapabilities,
		})
	}
	return roles, nil
}
