package removemember

import (
	"context"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccountmember"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/services"
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
