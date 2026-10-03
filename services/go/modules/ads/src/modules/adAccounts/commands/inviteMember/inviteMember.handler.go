package invitemember

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccountinvite"
	"zudomart/modules/ads/src/generated/ent/adaccountmember"
	"zudomart/modules/ads/src/modules/adAccounts/dtos"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

const inviteLifetime = 7 * 24 * time.Hour

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.AdAccountInvite, error) {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.ActorUserId, services.PermissionMembersManage); err != nil {
		return dtos.AdAccountInvite{}, err
	}
	invitee, found, err := deployed.Users.FindUserByUsername(ctx, strings.TrimPrefix(strings.TrimSpace(command.Request.Username), "@"))
	if err != nil {
		return dtos.AdAccountInvite{}, err
	}
	if !found {
		return dtos.AdAccountInvite{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "username", Message: "No Zudomart user has that username."}})
	}
	inviteeId := uuid.MustParse(invitee.Id)
	if err := handler.rejectExistingMemberOrInvite(ctx, command.AccountId, inviteeId); err != nil {
		return dtos.AdAccountInvite{}, err
	}
	actor := accountservices.ActorFor(ctx, deployed, command.ActorUserId)
	var saved *ent.AdAccountInvite
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		invite, err := tx.AdAccountInvite.Create().SetAccountID(command.AccountId).SetInviteeUserID(inviteeId).SetInviteeUsername(invitee.Username).SetRole(adaccountinvite.Role(command.Request.Role)).
			SetInvitedByUserID(command.ActorUserId).SetInvitedByName(actor.Name).SetExpiresAt(deployed.Now().Add(inviteLifetime)).Save(ctx)
		if err != nil {
			return err
		}
		saved = invite
		return services.RecordActivityInTransaction(ctx, tx, command.AccountId, "invite", invite.ID.String(), actor, "Invited @"+invitee.Username, map[string]string{"role": command.Request.Role})
	})
	if err != nil {
		return dtos.AdAccountInvite{}, err
	}
	return accountservices.PresentInvite(saved), nil
}

func (handler Handler) rejectExistingMemberOrInvite(ctx context.Context, accountId, inviteeId uuid.UUID) error {
	issue := func(message string) error {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "username", Message: message}})
	}
	isMember, err := handler.Container.Client.AdAccountMember.Query().Where(adaccountmember.AccountID(accountId), adaccountmember.UserID(inviteeId)).Exist(ctx)
	if err != nil {
		return err
	}
	if isMember {
		return issue("This person is already a member.")
	}
	pending, err := handler.Container.Client.AdAccountInvite.Query().Where(adaccountinvite.AccountID(accountId), adaccountinvite.InviteeUserID(inviteeId), adaccountinvite.StatusEQ(adaccountinvite.StatusPending)).Exist(ctx)
	if err != nil {
		return err
	}
	if pending {
		return issue("This person already has a pending invite.")
	}
	return nil
}
