package inviteadmin

import (
	"context"
	"strings"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	adminevents "zudomart/modules/admin/src/events"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	staffevents "zudomart/modules/admin/src/modules/staffAdmins/events"
	"zudomart/modules/admin/src/modules/staffAdmins/services"
	"zudomart/modules/admin/src/repositories"
	"zudomart/modules/admin/src/types"
	jsonencoding "zudomart/modules/admin/src/utils/jsonEncoding"
	secrettokens "zudomart/modules/admin/src/utils/secretTokens"
	"zudomart/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.StaffView, error) {
	email, valid := secrettokens.NormalizeStaffEmail(command.Email)
	if !valid {
		return types.StaffView{}, adminerrors.Unprocessable("Enter a valid email address.")
	}
	permissions, err := services.NormalizePermissions(command.Permissions)
	if err != nil {
		return types.StaffView{}, err
	}
	displayName := types.TruncateToLength(strings.TrimSpace(command.DisplayName), 80)
	invitationToken, err := secrettokens.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return types.StaffView{}, err
	}
	var invited *ent.StaffAccount
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		inviter, err := services.RequireActiveSuperadminInTransaction(ctx, tx, command.Actor)
		if err != nil {
			return err
		}
		if taken, err := tx.StaffAccount.Query().Where(staffaccount.Email(email)).Exist(ctx); err != nil || taken {
			return adminerrors.FirstError(err, adminerrors.EmailAlreadyInUse)
		}
		now := handler.Container.Now()
		if invited, err = tx.StaffAccount.Create().SetEmail(email).SetDisplayName(displayName).SetRole(staffaccount.RoleAdmin).
			SetPermissions(permissions).SetCreatedBy(inviter.ID).Save(ctx); err != nil {
			return err
		}
		if err := tx.StaffInvitation.Create().SetStaffID(invited.ID).SetTokenHash(secrettokens.HashOpaqueTokenForStorage(invitationToken)).
			SetExpiresAt(now.Add(handler.Container.Settings.InvitationTtl)).Exec(ctx); err != nil {
			return err
		}
		if err := adminevents.EnqueueOutboxEventInTransaction(ctx, tx, "staff.invited", invited.ID.String(), now, staffevents.StaffInvitedEventData{
			StaffId: invited.ID.String(), Email: email, Role: string(invited.Role), InvitedBy: inviter.ID.String(),
		}); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: inviter.ID.String(), ActorRole: string(inviter.Role), Action: "staff.invited", SubjectType: "staff", SubjectId: invited.ID.String(),
			After: jsonencoding.MustMarshalJson(map[string]any{"email": email, "permissions": permissions}),
		})
	})
	if err != nil {
		return types.StaffView{}, err
	}
	return types.ConvertStaffToView(invited), handler.Container.Delivery.DeliverStaffInvitation(ctx, email, displayName, invitationToken)
}
