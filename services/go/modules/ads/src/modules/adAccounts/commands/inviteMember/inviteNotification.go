package invitemember

import (
	"context"
	"strings"
	"time"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/events"
	"zudomart/modules/ads/src/generated/ent"
)

func issuePath(byEmail bool) string {
	if byEmail {
		return "email"
	}
	return "username"
}

func enqueueInviteCreated(ctx context.Context, tx *ent.Tx, deployed *container.Container, account *ent.AdAccount, invite *ent.AdAccountInvite) error {
	now := deployed.Now()
	return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdInviteCreated, invite.ID.String(), now, events.AdInviteCreatedEventData{
		InviteId: invite.ID.String(), AccountId: account.ID.String(), AccountName: account.Name, Role: string(invite.Role), InvitedBy: invite.InvitedByName,
		InvitedByUserId: invite.InvitedByUserID.String(), InviteeUserId: invite.InviteeUserID.String(), ExpiresAt: invite.ExpiresAt.UTC().Format(time.RFC3339),
		InviteUrl: strings.TrimRight(deployed.Settings.AdsAppUrl, "/") + "/invites/" + invite.ID.String(),
	})
}
