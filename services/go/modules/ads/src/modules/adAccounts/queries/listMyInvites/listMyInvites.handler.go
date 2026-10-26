package listmyinvites

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adaccountinvite"
	"nantty/modules/ads/src/modules/adAccounts/dtos"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.PendingInvite, error) {
	client := handler.Container.Client
	invites, err := client.AdAccountInvite.Query().Where(adaccountinvite.InviteeUserID(query.UserId), adaccountinvite.StatusEQ(adaccountinvite.StatusPending), adaccountinvite.ExpiresAtGT(handler.Container.Now())).
		Order(ent.Desc(adaccountinvite.FieldCreatedAt)).Limit(50).All(ctx)
	if err != nil || len(invites) == 0 {
		return []dtos.PendingInvite{}, err
	}
	accountIds := make([]uuid.UUID, 0, len(invites))
	for _, invite := range invites {
		accountIds = append(accountIds, invite.AccountID)
	}
	accounts, err := client.AdAccount.Query().Where(adaccount.IDIn(accountIds...), adaccount.StatusNEQ(adaccount.StatusDisabled)).All(ctx)
	if err != nil {
		return nil, err
	}
	names := make(map[string]string, len(accounts))
	for _, account := range accounts {
		names[account.ID.String()] = account.Name
	}
	items := make([]dtos.PendingInvite, 0, len(invites))
	for _, invite := range invites {
		name, active := names[invite.AccountID.String()]
		if !active {
			continue
		}
		items = append(items, dtos.PendingInvite{Id: invite.ID.String(), AccountName: name, Role: string(invite.Role), InvitedBy: invite.InvitedByName, ExpiresAt: invite.ExpiresAt.UTC().Format(time.RFC3339)})
	}
	return items, nil
}
