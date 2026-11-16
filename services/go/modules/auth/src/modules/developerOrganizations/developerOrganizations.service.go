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

func (service Service) Members(ctx context.Context, accountID, organizationID string) ([]OrganizationMember, error) {
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
	if !AllowsOrganizationCapability(actorRole, "members.manage") {
		return nil, errOrganizationForbidden
	}
	rows, err := tx.QueryContext(ctx, `
		SELECT m.id, a.id, a.username, a.name, m.role, a.status, m.created_at
		FROM developer_organization_memberships m
		JOIN accounts a ON a.id = m.account_id
		WHERE m.organization_id = $1
		ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at, m.id`, organization)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	members := make([]OrganizationMember, 0)
	for rows.Next() {
		var member OrganizationMember
		if err := rows.Scan(&member.MembershipID, &member.AccountID, &member.Username, &member.Name, &member.Role, &member.Status, &member.JoinedAt); err != nil {
			return nil, err
		}
		members = append(members, member)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return members, nil
}

func (service Service) Member(ctx context.Context, accountID, organizationID, memberID string) (OrganizationMemberDetail, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return OrganizationMemberDetail{}, errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return OrganizationMemberDetail{}, errOrganizationAccessNotFound
	}
	membership, err := uuid.Parse(memberID)
	if err != nil {
		return OrganizationMemberDetail{}, errOrganizationAccessNotFound
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return OrganizationMemberDetail{}, err
	}
	defer tx.Rollback()
	var actorRole string
	err = tx.QueryRowContext(ctx, `
		SELECT role FROM developer_organization_memberships
		WHERE account_id = $1 AND organization_id = $2`, account, organization).Scan(&actorRole)
	if errors.Is(err, sql.ErrNoRows) {
		return OrganizationMemberDetail{}, errOrganizationAccessNotFound
	}
	if err != nil {
		return OrganizationMemberDetail{}, err
	}
	if !AllowsOrganizationCapability(actorRole, "members.manage") {
		return OrganizationMemberDetail{}, errOrganizationForbidden
	}
	var detail OrganizationMemberDetail
	err = tx.QueryRowContext(ctx, `
		SELECT m.id, a.id, a.username, a.name, m.role, a.status, m.created_at
		FROM developer_organization_memberships m
		JOIN accounts a ON a.id = m.account_id
		WHERE m.organization_id = $1 AND m.id = $2`, organization, membership).
		Scan(&detail.MembershipID, &detail.AccountID, &detail.Username, &detail.Name, &detail.Role, &detail.Status, &detail.JoinedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return OrganizationMemberDetail{}, errOrganizationAccessNotFound
	}
	if err != nil {
		return OrganizationMemberDetail{}, err
	}
	organizationCapabilities, applicationCapabilities := CapabilitiesForRole(detail.Role)
	detail.OrganizationRole = OrganizationRole{
		Name: detail.Role, OrganizationCapabilities: organizationCapabilities,
		ApplicationCapabilities: applicationCapabilities,
	}
	if err := tx.Commit(); err != nil {
		return OrganizationMemberDetail{}, err
	}
	return detail, nil
}

func (service Service) UpdateMemberRole(ctx context.Context, accountID, organizationID, memberID string, request UpdateMemberRoleRequest) (OrganizationMemberDetail, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return OrganizationMemberDetail{}, errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return OrganizationMemberDetail{}, errOrganizationAccessNotFound
	}
	membership, err := uuid.Parse(memberID)
	if err != nil {
		return OrganizationMemberDetail{}, errOrganizationAccessNotFound
	}
	if !containsCapability(supportedOrganizationRoles, request.Role) {
		return OrganizationMemberDetail{}, errInvalidRole
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return OrganizationMemberDetail{}, err
	}
	defer tx.Rollback()
	var lockedOrganization uuid.UUID
	err = tx.QueryRowContext(ctx, `SELECT id FROM developer_organizations WHERE id = $1 FOR UPDATE`, organization).Scan(&lockedOrganization)
	if errors.Is(err, sql.ErrNoRows) {
		return OrganizationMemberDetail{}, errOrganizationAccessNotFound
	}
	if err != nil {
		return OrganizationMemberDetail{}, err
	}
	var actorRole string
	err = tx.QueryRowContext(ctx, `
		SELECT role FROM developer_organization_memberships
		WHERE account_id = $1 AND organization_id = $2`, account, organization).Scan(&actorRole)
	if errors.Is(err, sql.ErrNoRows) {
		return OrganizationMemberDetail{}, errOrganizationAccessNotFound
	}
	if err != nil {
		return OrganizationMemberDetail{}, err
	}
	if !AllowsOrganizationCapability(actorRole, "members.manage") {
		return OrganizationMemberDetail{}, errOrganizationForbidden
	}
	var previousRole string
	err = tx.QueryRowContext(ctx, `
		SELECT role FROM developer_organization_memberships
		WHERE id = $1 AND organization_id = $2 FOR UPDATE`, membership, organization).Scan(&previousRole)
	if errors.Is(err, sql.ErrNoRows) {
		return OrganizationMemberDetail{}, errOrganizationAccessNotFound
	}
	if err != nil {
		return OrganizationMemberDetail{}, err
	}
	if previousRole == "owner" || request.Role == "owner" {
		return OrganizationMemberDetail{}, errOwnershipTransferRequired
	}
	if !CanAssignOrganizationRole(actorRole, request.Role) {
		return OrganizationMemberDetail{}, errOrganizationForbidden
	}
	if previousRole != request.Role {
		before, _ := json.Marshal(map[string]string{"role": previousRole})
		after, _ := json.Marshal(map[string]string{"role": request.Role})
		now := service.Container.Now()
		if _, err := tx.ExecContext(ctx, `UPDATE developer_organization_memberships SET role = $1 WHERE id = $2 AND organization_id = $3`, request.Role, membership, organization); err != nil {
			return OrganizationMemberDetail{}, err
		}
		if err := pruneApplicationGrantsForRole(ctx, tx, organization, account, membership, actorRole, request.Role, now); err != nil {
			return OrganizationMemberDetail{}, err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO developer_organization_audit_logs
			(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
			VALUES ($1, $2, $3, $4, 'organization.member_role_changed', 'organization_membership', $5, $6, $7, $8)`,
			uuid.New(), organization, account, actorRole, membership.String(), before, after, now); err != nil {
			return OrganizationMemberDetail{}, err
		}
	}
	var detail OrganizationMemberDetail
	err = tx.QueryRowContext(ctx, `
		SELECT m.id, a.id, a.username, a.name, m.role, a.status, m.created_at
		FROM developer_organization_memberships m
		JOIN accounts a ON a.id = m.account_id
		WHERE m.organization_id = $1 AND m.id = $2`, organization, membership).
		Scan(&detail.MembershipID, &detail.AccountID, &detail.Username, &detail.Name, &detail.Role, &detail.Status, &detail.JoinedAt)
	if err != nil {
		return OrganizationMemberDetail{}, err
	}
	organizationCapabilities, applicationCapabilities := CapabilitiesForRole(detail.Role)
	detail.OrganizationRole = OrganizationRole{
		Name: detail.Role, OrganizationCapabilities: organizationCapabilities,
		ApplicationCapabilities: applicationCapabilities,
	}
	if err := tx.Commit(); err != nil {
		return OrganizationMemberDetail{}, err
	}
	return detail, nil
}

func (service Service) RemoveMember(ctx context.Context, accountID, organizationID, memberID string) error {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return errOrganizationAccessNotFound
	}
	membership, err := uuid.Parse(memberID)
	if err != nil {
		return errOrganizationAccessNotFound
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var lockedOrganization uuid.UUID
	err = tx.QueryRowContext(ctx, `SELECT id FROM developer_organizations WHERE id = $1 FOR UPDATE`, organization).Scan(&lockedOrganization)
	if errors.Is(err, sql.ErrNoRows) {
		return errOrganizationAccessNotFound
	}
	if err != nil {
		return err
	}
	var actorRole string
	err = tx.QueryRowContext(ctx, `
		SELECT role FROM developer_organization_memberships
		WHERE account_id = $1 AND organization_id = $2`, account, organization).Scan(&actorRole)
	if errors.Is(err, sql.ErrNoRows) {
		return errOrganizationAccessNotFound
	}
	if err != nil {
		return err
	}
	if !AllowsOrganizationCapability(actorRole, "members.manage") {
		return errOrganizationForbidden
	}
	var targetRole string
	err = tx.QueryRowContext(ctx, `
		SELECT role FROM developer_organization_memberships
		WHERE id = $1 AND organization_id = $2 FOR UPDATE`, membership, organization).Scan(&targetRole)
	if errors.Is(err, sql.ErrNoRows) {
		return errOrganizationAccessNotFound
	}
	if err != nil {
		return err
	}
	if targetRole == "owner" {
		return errOwnershipTransferRequired
	}
	if !CanAssignOrganizationRole(actorRole, targetRole) {
		return errOrganizationForbidden
	}
	before, _ := json.Marshal(map[string]string{"role": targetRole})
	if _, err := tx.ExecContext(ctx, `DELETE FROM developer_organization_memberships WHERE id = $1 AND organization_id = $2`, membership, organization); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO developer_organization_audit_logs
		(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
		VALUES ($1, $2, $3, $4, 'organization.member_removed', 'organization_membership', $5, $6, '{}'::jsonb, $7)`,
		uuid.New(), organization, account, actorRole, membership.String(), before, service.Container.Now()); err != nil {
		return err
	}
	return tx.Commit()
}

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
