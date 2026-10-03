package previewinvite

import (
	"context"
	"time"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccountinvite"
	"zudomart/modules/ads/src/modules/adAccounts/dtos"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.InvitePreview, error) {
	deployed := handler.Container
	invite, err := deployed.Client.AdAccountInvite.Query().Where(adaccountinvite.ID(query.InviteId), adaccountinvite.StatusEQ(adaccountinvite.StatusPending)).Only(ctx)
	if ent.IsNotFound(err) || (err == nil && (invite.InviteeUserID != query.UserId || !invite.ExpiresAt.After(deployed.Now()))) {
		return dtos.InvitePreview{}, adserrors.InviteNotFound
	}
	if err != nil {
		return dtos.InvitePreview{}, err
	}
	account, err := deployed.Client.AdAccount.Get(ctx, invite.AccountID)
	if err != nil {
		return dtos.InvitePreview{}, err
	}
	return dtos.InvitePreview{AccountName: account.Name, Role: string(invite.Role), InvitedBy: invite.InvitedByName, ExpiresAt: invite.ExpiresAt.UTC().Format(time.RFC3339)}, nil
}
