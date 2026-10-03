package changememberrole

import (
	"context"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccountmember"
	"zudomart/modules/ads/src/modules/adAccounts/dtos"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.AdAccountMember, error) {
	deployed := handler.Container
	if !accountservices.IsAccountRole(command.Role) {
		return dtos.AdAccountMember{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "role", Message: "Choose admin, advertiser, analyst or billing."}})
	}
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.ActorUserId, services.PermissionMembersManage); err != nil {
		return dtos.AdAccountMember{}, err
	}
	target, err := deployed.Client.AdAccountMember.Query().Where(adaccountmember.AccountID(command.AccountId), adaccountmember.UserID(command.TargetUserId)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.AdAccountMember{}, adserrors.NotFound
	}
	if err != nil {
		return dtos.AdAccountMember{}, err
	}
	if target.IsOwner {
		return dtos.AdAccountMember{}, adserrors.OwnerRoleLocked
	}
	actor := accountservices.ActorFor(ctx, deployed, command.ActorUserId)
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.AdAccountMember.UpdateOneID(target.ID).SetRole(adaccountmember.Role(command.Role)).Exec(ctx); err != nil {
			return err
		}
		return services.RecordActivityInTransaction(ctx, tx, command.AccountId, "member", command.TargetUserId.String(), actor, "Changed a member's role", map[string]string{"from": string(target.Role), "to": command.Role})
	})
	if err != nil {
		return dtos.AdAccountMember{}, err
	}
	members, err := accountservices.PresentMembers(ctx, deployed, []*ent.AdAccountMember{target})
	if err != nil {
		return dtos.AdAccountMember{}, err
	}
	members[0].Role = command.Role
	return members[0], nil
}
