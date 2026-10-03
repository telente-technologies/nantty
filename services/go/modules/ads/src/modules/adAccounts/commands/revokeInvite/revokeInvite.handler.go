package revokeinvite

import (
	"context"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccountinvite"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/services"
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
