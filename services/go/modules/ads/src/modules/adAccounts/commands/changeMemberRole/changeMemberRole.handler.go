package changememberrole

import (
	"context"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccountmember"
	"nantty/modules/ads/src/modules/adAccounts/dtos"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
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
