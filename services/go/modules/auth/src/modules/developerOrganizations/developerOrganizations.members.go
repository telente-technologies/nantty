package developerorganizations

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
)

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
