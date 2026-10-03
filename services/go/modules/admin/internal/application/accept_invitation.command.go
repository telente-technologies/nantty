package application

import (
	"context"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/staffaccount"
	"zudomart/modules/admin/internal/ent/staffinvitation"
	"zudomart/platform/identityports"
)

func (application *AdminApplication) AcceptStaffInvitationAndSetPassword(ctx context.Context, invitationToken, password string) error {
	if err := AssertStaffPasswordMeetsPolicy(password); err != nil {
		return err
	}
	passwordHash, err := application.Passwords.HashPasswordWithArgon2id(password)
	if err != nil {
		return err
	}
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		invitation, err := tx.StaffInvitation.Query().
			Where(staffinvitation.TokenHash(hashOpaqueTokenForStorage(invitationToken)), staffinvitation.ConsumedAtIsNil(), staffinvitation.ExpiresAtGT(now)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidInvitation
		}
		if err != nil {
			return err
		}
		staff, err := tx.StaffAccount.Query().Where(staffaccount.ID(invitation.StaffID), staffaccount.StatusEQ(staffaccount.StatusInvited)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidInvitation
		}
		if err != nil {
			return err
		}
		if err := invitation.Update().SetConsumedAt(now).Exec(ctx); err != nil {
			return err
		}
		if err := tx.StaffAccount.UpdateOneID(staff.ID).SetPasswordHash(passwordHash).SetStatus(staffaccount.StatusActive).Exec(ctx); err != nil {
			return err
		}
		return application.recordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: staff.ID.String(), ActorRole: string(staff.Role), Action: "staff.invitation_accepted", SubjectType: "staff", SubjectId: staff.ID.String(),
		})
	})
}
