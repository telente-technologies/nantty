package acceptstaffinvitation

import (
	"context"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/generated/ent/staffinvitation"
	"nantty/modules/admin/src/repositories"
	secrettokens "nantty/modules/admin/src/utils/secretTokens"
	"nantty/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := handler.Container.Now()
		invitation, err := tx.StaffInvitation.Query().
			Where(staffinvitation.TokenHash(secrettokens.HashOpaqueTokenForStorage(command.InvitationToken)), staffinvitation.ConsumedAtIsNil(), staffinvitation.ExpiresAtGT(now)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return adminerrors.InvalidInvitation
		}
		if err != nil {
			return err
		}
		staff, err := tx.StaffAccount.Query().Where(staffaccount.ID(invitation.StaffID), staffaccount.StatusEQ(staffaccount.StatusInvited)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return adminerrors.InvalidInvitation
		}
		if err != nil {
			return err
		}
		if err := secrettokens.AssertStaffPasswordMeetsPolicy(command.Password, staff.Email, staff.DisplayName); err != nil {
			return err
		}
		passwordHash, err := handler.Container.Passwords.HashPasswordWithArgon2id(command.Password)
		if err != nil {
			return err
		}
		if err := invitation.Update().SetConsumedAt(now).Exec(ctx); err != nil {
			return err
		}
		if err := tx.StaffAccount.UpdateOneID(staff.ID).SetPasswordHash(passwordHash).SetStatus(staffaccount.StatusActive).Exec(ctx); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: staff.ID.String(), ActorRole: string(staff.Role), Action: "staff.invitation_accepted", SubjectType: "staff", SubjectId: staff.ID.String(),
		})
	})
}
