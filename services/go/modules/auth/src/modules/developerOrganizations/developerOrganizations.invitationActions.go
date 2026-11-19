package developerorganizations

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/google/uuid"
	platformevents "nantty/platform/events"
)

const invitationResendCooldown = 60 * time.Second

func (service InvitationService) Resend(ctx context.Context, accountID, organizationID, invitationID string) (OrganizationInvitation, error) {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return OrganizationInvitation{}, errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return OrganizationInvitation{}, errOrganizationAccessNotFound
	}
	invitation, err := uuid.Parse(invitationID)
	if err != nil {
		return OrganizationInvitation{}, errInvitationNotFound
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
	if !AllowsOrganizationCapability(actorRole, "members.manage") {
		return OrganizationInvitation{}, errOrganizationForbidden
	}
	var invitee uuid.UUID
	var email, accountStatus, role, status string
	var emailVerified bool
	var createdAt, expiresAt, updatedAt time.Time
	err = tx.QueryRowContext(ctx, `
		SELECT i.invitee_account_id, COALESCE(a.email, ''), a.status, (a.email_verified_at IS NOT NULL), i.role, i.status, i.created_at, i.expires_at, i.updated_at
		FROM developer_organization_invitations i
		JOIN accounts a ON a.id = i.invitee_account_id
		WHERE i.id = $1 AND i.organization_id = $2
		FOR UPDATE OF i`, invitation, organization).Scan(&invitee, &email, &accountStatus, &emailVerified, &role, &status, &createdAt, &expiresAt, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return OrganizationInvitation{}, errInvitationNotFound
	}
	if err != nil {
		return OrganizationInvitation{}, err
	}
	if !CanAssignOrganizationRole(actorRole, role) {
		return OrganizationInvitation{}, errOrganizationForbidden
	}
	if status != "pending" {
		return OrganizationInvitation{}, errInvitationNotPending
	}
	now := service.Container.Now()
	if !expiresAt.After(now) {
		if _, err := tx.ExecContext(ctx, `UPDATE developer_organization_invitations SET status = 'expired', updated_at = $2 WHERE id = $1`, invitation, now); err != nil {
			return OrganizationInvitation{}, err
		}
		if err := tx.Commit(); err != nil {
			return OrganizationInvitation{}, err
		}
		return OrganizationInvitation{}, errInvitationExpired
	}
	if accountStatus != "active" || !emailVerified || email == "" {
		return OrganizationInvitation{}, errInvitationTargetUnavailable
	}
	if now.Sub(updatedAt) < invitationResendCooldown {
		return OrganizationInvitation{}, errInvitationResendCooldown
	}
	newExpiresAt := now.Add(7 * 24 * time.Hour)
	if _, err := tx.ExecContext(ctx, `UPDATE developer_organization_invitations SET expires_at = $2, updated_at = $3 WHERE id = $1`, invitation, newExpiresAt, now); err != nil {
		return OrganizationInvitation{}, err
	}
	before, _ := json.Marshal(map[string]string{"expiresAt": expiresAt.UTC().Format(time.RFC3339)})
	after, _ := json.Marshal(map[string]string{"expiresAt": newExpiresAt.UTC().Format(time.RFC3339), "status": "pending"})
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO developer_organization_audit_logs
		(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
		VALUES ($1, $2, $3, $4, 'organization.invitation_resent', 'organization_invitation', $5, $6, $7, $8)`,
		uuid.New(), organization, account, actorRole, invitation.String(), before, after, now); err != nil {
		return OrganizationInvitation{}, err
	}
	outboxEvt, err := platformevents.BuildOutboxEventWithEnvelope("developerOrganization.invitationCreated", "nantty.auth", invitation.String(), 1, now, map[string]any{
		"invitationId":     invitation.String(),
		"organizationId":   organization.String(),
		"organizationName": organizationName,
		"inviteeAccountId": invitee.String(),
		"role":             role,
		"expiresAt":        newExpiresAt.UTC().Format(time.RFC3339),
	})
	if err != nil {
		return OrganizationInvitation{}, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO outbox_events (id, created_at, event_type, subject, payload)
		VALUES ($1, $2, $3, $4, $5::jsonb)`,
		uuid.MustParse(outboxEvt.Id), now, outboxEvt.EventType, outboxEvt.Subject, outboxEvt.Payload); err != nil {
		return OrganizationInvitation{}, err
	}
	if err := tx.Commit(); err != nil {
		return OrganizationInvitation{}, err
	}
	return OrganizationInvitation{
		ID:               invitation.String(),
		OrganizationID:   organization.String(),
		OrganizationName: organizationName,
		OrganizationSlug: organizationSlug,
		InviteeEmail:     email,
		Role:             role,
		Status:           "pending",
		CreatedAt:        createdAt,
		ExpiresAt:        newExpiresAt,
	}, nil
}

func (service InvitationService) Revoke(ctx context.Context, accountID, organizationID, invitationID string) error {
	account, err := uuid.Parse(accountID)
	if err != nil {
		return errInvalidAccount
	}
	organization, err := uuid.Parse(organizationID)
	if err != nil {
		return errOrganizationAccessNotFound
	}
	invitation, err := uuid.Parse(invitationID)
	if err != nil {
		return errInvitationNotFound
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var actorRole string
	err = tx.QueryRowContext(ctx, `SELECT m.role FROM developer_organization_memberships m JOIN developer_organizations o ON o.id = m.organization_id WHERE o.id = $1 AND m.account_id = $2 FOR UPDATE OF o`, organization, account).Scan(&actorRole)
	if errors.Is(err, sql.ErrNoRows) {
		return errOrganizationAccessNotFound
	}
	if err != nil {
		return err
	}
	if !AllowsOrganizationCapability(actorRole, "members.manage") {
		return errOrganizationForbidden
	}
	now := service.Container.Now()
	result, err := tx.ExecContext(ctx, `UPDATE developer_organization_invitations SET status = 'revoked', updated_at = $3 WHERE id = $1 AND organization_id = $2 AND status = 'pending' AND expires_at > $3`, invitation, organization, now)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 0 {
		return errInvitationNotFound
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO developer_organization_audit_logs
		(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
		VALUES ($1, $2, $3, $4, 'organization.invitation_revoked', 'organization_invitation', $5, $6, $7, $8)`,
		uuid.New(), organization, account, actorRole, invitation.String(), []byte(`{"status":"pending"}`), []byte(`{"status":"revoked"}`), now); err != nil {
		return err
	}
	return tx.Commit()
}

func NormalizeInvitationEmail(value string) (string, error) {
	value = strings.TrimSpace(value)
	address, err := mail.ParseAddress(value)
	if err != nil || address.Address != value || len(value) > 254 {
		return "", errInvalidInvitation
	}
	return strings.ToLower(value), nil
}
