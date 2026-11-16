package developerorganizations

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"nantty/modules/auth/src/container"
)

type InvitationService struct{ Container *container.Container }

func (service InvitationService) Create(ctx context.Context, accountID, organizationID string, request CreateInvitationRequest) (OrganizationInvitation, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return OrganizationInvitation{}, errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return OrganizationInvitation{}, errOrganizationAccessNotFound
	}
	email, err := NormalizeInvitationEmail(request.Email)
	if err != nil || !containsCapability(supportedOrganizationRoles, request.Role) || request.Role == "owner" {
		return OrganizationInvitation{}, errInvalidInvitation
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return OrganizationInvitation{}, err
	}
	defer tx.Rollback()
	var organizationName, organizationSlug, actorRole string
	err = tx.QueryRowContext(ctx, `
		SELECT o.name, o.slug, m.role
		FROM developer_organizations o
		JOIN developer_organization_memberships m ON m.organization_id = o.id
		WHERE o.id = $1 AND m.account_id = $2
		FOR UPDATE OF o`, organization, account).Scan(&organizationName, &organizationSlug, &actorRole)
	if errors.Is(err, sql.ErrNoRows) {
		return OrganizationInvitation{}, errOrganizationAccessNotFound
	}
	if err != nil {
		return OrganizationInvitation{}, err
	}
	if !AllowsOrganizationCapability(actorRole, "members.manage") || !CanAssignOrganizationRole(actorRole, request.Role) {
		return OrganizationInvitation{}, errOrganizationForbidden
	}
	var invitee uuid.UUID
	err = tx.QueryRowContext(ctx, `
		SELECT id FROM accounts
		WHERE lower(email) = $1 AND email_verified_at IS NOT NULL AND status = 'active'`, email).Scan(&invitee)
	if errors.Is(err, sql.ErrNoRows) {
		return OrganizationInvitation{}, errInvitationTargetUnavailable
	}
	if err != nil {
		return OrganizationInvitation{}, err
	}
	var alreadyMember bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM developer_organization_memberships WHERE organization_id = $1 AND account_id = $2)`, organization, invitee).Scan(&alreadyMember); err != nil {
		return OrganizationInvitation{}, err
	}
	if alreadyMember {
		return OrganizationInvitation{}, errInvitationAlreadyExists
	}
	var pending bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM developer_organization_invitations WHERE organization_id = $1 AND invitee_account_id = $2 AND status = 'pending' AND expires_at > $3)`, organization, invitee, service.Container.Now()).Scan(&pending); err != nil {
		return OrganizationInvitation{}, err
	}
	if pending {
		return OrganizationInvitation{}, errInvitationAlreadyExists
	}
	now := service.Container.Now()
	if _, err := tx.ExecContext(ctx, `UPDATE developer_organization_invitations SET status = 'expired', updated_at = $3 WHERE organization_id = $1 AND invitee_account_id = $2 AND status = 'pending' AND expires_at <= $3`, organization, invitee, now); err != nil {
		return OrganizationInvitation{}, err
	}
	id := uuid.New()
	expiresAt := now.Add(7 * 24 * time.Hour)
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO developer_organization_invitations
		(id, organization_id, inviter_account_id, invitee_account_id, role, status, created_at, expires_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $6)`, id, organization, account, invitee, request.Role, now, expiresAt); err != nil {
		if isUniqueViolation(err) {
			return OrganizationInvitation{}, errInvitationAlreadyExists
		}
		return OrganizationInvitation{}, err
	}
	before, _ := json.Marshal(map[string]string{})
	after, _ := json.Marshal(map[string]string{"inviteeAccountId": invitee.String(), "role": request.Role, "status": "pending"})
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO developer_organization_audit_logs
		(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
		VALUES ($1, $2, $3, $4, 'organization.invitation_created', 'organization_invitation', $5, $6, $7, $8)`,
		uuid.New(), organization, account, actorRole, id.String(), before, after, now); err != nil {
		return OrganizationInvitation{}, err
	}
	if err := tx.Commit(); err != nil {
		return OrganizationInvitation{}, err
	}
	return OrganizationInvitation{ID: id.String(), OrganizationID: organization.String(), OrganizationName: organizationName, OrganizationSlug: organizationSlug, InviteeEmail: email, Role: request.Role, Status: "pending", CreatedAt: now, ExpiresAt: expiresAt}, nil
}

func (service InvitationService) ListForOrganization(ctx context.Context, accountID, organizationID string) ([]OrganizationInvitation, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return nil, errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return nil, errOrganizationAccessNotFound
	}
	var role string
	err = service.Container.Database.QueryRowContext(ctx, `SELECT role FROM developer_organization_memberships WHERE organization_id = $1 AND account_id = $2`, organization, account).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errOrganizationAccessNotFound
	}
	if err != nil {
		return nil, err
	}
	if !AllowsOrganizationCapability(role, "members.manage") {
		return nil, errOrganizationForbidden
	}
	rows, err := service.Container.Database.QueryContext(ctx, `
		SELECT i.id, i.organization_id, o.name, o.slug, COALESCE(a.email, ''), i.role, i.status, i.created_at, i.expires_at
		FROM developer_organization_invitations i
		JOIN developer_organizations o ON o.id = i.organization_id
		JOIN accounts a ON a.id = i.invitee_account_id
		WHERE i.organization_id = $1 AND i.status = 'pending' AND i.expires_at > $2
		ORDER BY i.created_at DESC, i.id DESC`, organization, service.Container.Now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	invitations := make([]OrganizationInvitation, 0)
	for rows.Next() {
		var item OrganizationInvitation
		if err := rows.Scan(&item.ID, &item.OrganizationID, &item.OrganizationName, &item.OrganizationSlug, &item.InviteeEmail, &item.Role, &item.Status, &item.CreatedAt, &item.ExpiresAt); err != nil {
			return nil, err
		}
		invitations = append(invitations, item)
	}
	return invitations, rows.Err()
}

func (service InvitationService) ListForAccount(ctx context.Context, accountID string) ([]OrganizationInvitation, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return nil, errInvalidAccount
	}
	rows, err := service.Container.Database.QueryContext(ctx, `
		SELECT i.id, i.organization_id, o.name, o.slug, COALESCE(inviter.name, ''), i.role, i.status, i.created_at, i.expires_at
		FROM developer_organization_invitations i
		JOIN developer_organizations o ON o.id = i.organization_id
		JOIN accounts inviter ON inviter.id = i.inviter_account_id
		WHERE i.invitee_account_id = $1 AND i.status = 'pending' AND i.expires_at > $2
		ORDER BY i.created_at DESC, i.id DESC`, account, service.Container.Now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	invitations := make([]OrganizationInvitation, 0)
	for rows.Next() {
		var item OrganizationInvitation
		if err := rows.Scan(&item.ID, &item.OrganizationID, &item.OrganizationName, &item.OrganizationSlug, &item.InviterName, &item.Role, &item.Status, &item.CreatedAt, &item.ExpiresAt); err != nil {
			return nil, err
		}
		invitations = append(invitations, item)
	}
	return invitations, rows.Err()
}

func (service InvitationService) Respond(ctx context.Context, accountID, invitationID, response string) error {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return errInvalidAccount
	}
	invitation, err := uuid.Parse(invitationID)
	if err != nil || (response != "accept" && response != "decline") {
		return errInvitationNotFound
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var organization uuid.UUID
	var role, status string
	var expiresAt time.Time
	err = tx.QueryRowContext(ctx, `
		SELECT organization_id, role, status, expires_at FROM developer_organization_invitations
		WHERE id = $1 AND invitee_account_id = $2 FOR UPDATE`, invitation, account).Scan(&organization, &role, &status, &expiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return errInvitationNotFound
	}
	if err != nil {
		return err
	}
	if status != "pending" {
		return errInvitationNotPending
	}
	now := service.Container.Now()
	if !expiresAt.After(now) {
		_, err := tx.ExecContext(ctx, `UPDATE developer_organization_invitations SET status = 'expired', updated_at = $2 WHERE id = $1`, invitation, now)
		if err != nil {
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		return errInvitationExpired
	}
	if response == "accept" {
		var accountStatus string
		if err := tx.QueryRowContext(ctx, `SELECT status FROM accounts WHERE id = $1`, account).Scan(&accountStatus); err != nil || accountStatus != "active" {
			return errInvitationNotFound
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO developer_organization_memberships (id, organization_id, account_id, role, created_at) VALUES ($1, $2, $3, $4, $5)`, uuid.New(), organization, account, role, now); err != nil {
			if isUniqueViolation(err) {
				return errInvitationAlreadyExists
			}
			return err
		}
	}
	newStatus := "declined"
	afterState := json.RawMessage(`{"status":"declined"}`)
	action := "organization.invitation_declined"
	if response == "accept" {
		newStatus, action = "accepted", "organization.invitation_accepted"
		afterState = json.RawMessage(`{"status":"accepted"}`)
	}
	if _, err := tx.ExecContext(ctx, `UPDATE developer_organization_invitations SET status = $2, updated_at = $3 WHERE id = $1`, invitation, newStatus, now); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO developer_organization_audit_logs
		(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
		VALUES ($1, $2, $3, 'invitee', $4, 'organization_invitation', $5, $6, $7, $8)`,
		uuid.New(), organization, account, action, invitation.String(), json.RawMessage(`{"status":"pending"}`), afterState, now); err != nil {
		return err
	}
	return tx.Commit()
}
