package services

import (
	"time"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/modules/adAccounts/dtos"
)

func PresentInvite(invite *ent.AdAccountInvite) dtos.AdAccountInvite {
	return dtos.AdAccountInvite{
		Id: invite.ID.String(), Username: invite.InviteeUsername, Role: string(invite.Role), InvitedBy: invite.InvitedByName, Status: string(invite.Status),
		CreatedAt: invite.CreatedAt.UTC().Format(time.RFC3339), ExpiresAt: invite.ExpiresAt.UTC().Format(time.RFC3339),
	}
}
