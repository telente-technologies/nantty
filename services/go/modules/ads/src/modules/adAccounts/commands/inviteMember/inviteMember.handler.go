package invitemember

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccountinvite"
	"nantty/modules/ads/src/generated/ent/adaccountmember"
	"nantty/modules/ads/src/interfaces"
	"nantty/modules/ads/src/modules/adAccounts/dtos"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
)

const inviteLifetime = 7 * 24 * time.Hour

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.AdAccountInvite, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.ActorUserId, services.PermissionMembersManage)
	if err != nil {
		return dtos.AdAccountInvite{}, err
	}
	invitee, err := findInvitee(ctx, deployed, command.Request)
	if err != nil {
		return dtos.AdAccountInvite{}, err
	}
	inviteeId := uuid.MustParse(invitee.Id)
	_, byEmail := InviteeIdentifier(command.Request)
	if err := handler.rejectExistingMemberOrInvite(ctx, command.AccountId, inviteeId, issuePath(byEmail)); err != nil {
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
		if err := enqueueInviteCreated(ctx, tx, deployed, account, invite); err != nil {
			return err
		}
		return services.RecordActivityInTransaction(ctx, tx, command.AccountId, "invite", invite.ID.String(), actor, "Invited @"+invitee.Username, map[string]string{"role": command.Request.Role})
	})
	if err != nil {
		return dtos.AdAccountInvite{}, err
	}
	return accountservices.PresentInvite(saved), nil
}

func findInvitee(ctx context.Context, deployed *container.Container, request dtos.InviteMemberRequest) (interfaces.UserSummary, error) {
	identifier, byEmail := InviteeIdentifier(request)
	lookup, message := deployed.Users.FindUserByUsername, "No Nantty user has that username."
	if byEmail {
		lookup, message = deployed.Users.FindUserByEmail, "No Nantty user has that email. Ask them to sign up first, then invite them."
	}
	path := issuePath(byEmail)
	invitee, found, err := lookup(ctx, identifier)
	if err != nil {
		return invitee, err
	}
	if !found {
		return invitee, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
	}
	return invitee, nil
}

func (handler Handler) rejectExistingMemberOrInvite(ctx context.Context, accountId, inviteeId uuid.UUID, path string) error {
	issue := func(message string) error {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
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
