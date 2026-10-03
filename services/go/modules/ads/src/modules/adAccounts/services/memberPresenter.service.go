package services

import (
	"context"
	"time"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/modules/adAccounts/dtos"
)

func PresentMembers(ctx context.Context, deployed *container.Container, members []*ent.AdAccountMember) ([]dtos.AdAccountMember, error) {
	ids := make([]string, 0, len(members))
	for _, member := range members {
		ids = append(ids, member.UserID.String())
	}
	users, err := deployed.Users.LookupUsers(ctx, ids)
	if err != nil {
		return nil, err
	}
	presented := make([]dtos.AdAccountMember, 0, len(members))
	for _, member := range members {
		user := users[member.UserID.String()]
		item := dtos.AdAccountMember{UserId: member.UserID.String(), Name: user.Name, Username: user.Username, Role: string(member.Role), AddedAt: member.CreatedAt.UTC().Format(time.RFC3339), IsOwner: member.IsOwner}
		if member.LastActiveAt != nil {
			last := member.LastActiveAt.UTC().Format(time.RFC3339)
			item.LastActiveAt = &last
		}
		presented = append(presented, item)
	}
	return presented, nil
}
