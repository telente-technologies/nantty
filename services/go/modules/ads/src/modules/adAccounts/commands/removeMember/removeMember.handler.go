package removemember

import (
	"context"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccountmember"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.ActorUserId, services.PermissionMembersManage); err != nil {
		return err
	}
	target, err := deployed.Client.AdAccountMember.Query().Where(adaccountmember.AccountID(command.AccountId), adaccountmember.UserID(command.TargetUserId)).Only(ctx)
	if ent.IsNotFound(err) {
		return adserrors.NotFound
	}
	if err != nil {
		return err
	}
	if target.IsOwner {
		return adserrors.OwnerCannotBeRemoved
	}
	actor := accountservices.ActorFor(ctx, deployed, command.ActorUserId)
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.AdAccountMember.DeleteOneID(target.ID).Exec(ctx); err != nil {
			return err
		}
		return services.RecordActivityInTransaction(ctx, tx, command.AccountId, "member", command.TargetUserId.String(), actor, "Removed a member", map[string]string{"role": string(target.Role)})
	})
}
