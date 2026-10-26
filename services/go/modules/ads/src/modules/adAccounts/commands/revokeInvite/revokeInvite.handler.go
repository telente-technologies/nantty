package revokeinvite

import (
	"context"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccountinvite"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.ActorUserId, services.PermissionMembersManage); err != nil {
		return err
	}
	invite, err := deployed.Client.AdAccountInvite.Query().Where(adaccountinvite.ID(command.InviteId), adaccountinvite.AccountID(command.AccountId), adaccountinvite.StatusEQ(adaccountinvite.StatusPending)).Only(ctx)
	if ent.IsNotFound(err) {
		return adserrors.NotFound
	}
	if err != nil {
		return err
	}
	actor := accountservices.ActorFor(ctx, deployed, command.ActorUserId)
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.AdAccountInvite.UpdateOneID(invite.ID).SetStatus(adaccountinvite.StatusRevoked).Exec(ctx); err != nil {
			return err
		}
		return services.RecordActivityInTransaction(ctx, tx, command.AccountId, "invite", invite.ID.String(), actor, "Revoked the invite for @"+invite.InviteeUsername, nil)
	})
}
