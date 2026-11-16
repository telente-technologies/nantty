package developerorganizations

import (
	"context"
	"database/sql"
	"errors"
	"net/mail"
	"strings"

	"github.com/google/uuid"
)

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
