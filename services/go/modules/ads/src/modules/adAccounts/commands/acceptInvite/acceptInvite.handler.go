package acceptinvite

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccountinvite"
	"nantty/modules/ads/src/generated/ent/adaccountmember"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (uuid.UUID, error) {
	deployed := handler.Container
	invite, err := deployed.Client.AdAccountInvite.Query().Where(adaccountinvite.ID(command.InviteId), adaccountinvite.StatusEQ(adaccountinvite.StatusPending)).Only(ctx)
	if ent.IsNotFound(err) || (err == nil && !invite.ExpiresAt.After(deployed.Now())) {
		return uuid.Nil, adserrors.InviteNotFound
	}
	if err != nil {
		return uuid.Nil, err
	}
	if invite.InviteeUserID != command.UserId {
		return uuid.Nil, adserrors.InviteForAnotherUser
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.AdAccountInvite.UpdateOneID(invite.ID).SetStatus(adaccountinvite.StatusAccepted).Exec(ctx); err != nil {
			return err
		}
		if err := tx.AdAccountMember.Create().SetAccountID(invite.AccountID).SetUserID(command.UserId).SetRole(adaccountmember.Role(invite.Role)).Exec(ctx); err != nil {
			return err
		}
		return services.RecordActivityInTransaction(ctx, tx, invite.AccountID, "member", command.UserId.String(), actor, "Joined the ad account", map[string]string{"role": string(invite.Role)})
	})
	return invite.AccountID, err
}
