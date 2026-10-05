package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/modules/storeTeam/dtos"
	"zudomart/platform/usersdirectory"
)

func PresentStaffMembers(ctx context.Context, deployed *container.Container, members []*ent.StoreMember) ([]dtos.StaffMemberView, error) {
	accountIds := make([]uuid.UUID, 0, len(members))
	for _, member := range members {
		accountIds = append(accountIds, member.AccountID)
	}
	profiles, err := deployed.Users.PersonalProfilesByAccount(ctx, accountIds)
	if err != nil {
		return nil, err
	}
	views := make([]dtos.StaffMemberView, 0, len(members))
	for _, member := range members {
		views = append(views, PresentStaffMember(member, profiles[member.AccountID]))
	}
	return views, nil
}

func PresentStaffMember(member *ent.StoreMember, profile usersdirectory.ProfileName) dtos.StaffMemberView {
	locationIds := member.LocationIds
	if locationIds == nil {
		locationIds = []string{}
	}
	var lastActive *string
	if member.LastActiveAt != nil {
		formatted := member.LastActiveAt.UTC().Format(time.RFC3339)
		lastActive = &formatted
	}
	name := profile.Name
	if name == "" {
		name = "Zudomart user"
	}
	return dtos.StaffMemberView{
		Id: member.ID.String(), UserId: member.AccountID.String(), Name: name, Username: profile.Handle, AvatarUrl: optionalText(profile.AvatarUrl),
		Role: member.Role, Status: member.Status, Permissions: member.Permissions, LocationIds: locationIds, LastActiveAt: lastActive,
		InvitedAt: member.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func PresentCandidates(profiles []usersdirectory.ProfileName) dtos.CandidateList {
	candidates := make([]dtos.ZudomartUserCandidateView, 0, len(profiles))
	for _, profile := range profiles {
		candidates = append(candidates, dtos.ZudomartUserCandidateView{UserId: profile.AccountId.String(), Name: profile.Name, Username: profile.Handle, AvatarUrl: optionalText(profile.AvatarUrl)})
	}
	return dtos.CandidateList{Data: candidates}
}

func PresentAuditEntry(row *ent.StoreAuditEntry) dtos.AuditLogEntryView {
	return dtos.AuditLogEntryView{
		Id: row.ID.String(), Actor: dtos.AuditActorView{Id: row.ActorID, Name: row.ActorName, Role: row.ActorRole}, Action: row.Action,
		TargetType: row.TargetType, TargetId: row.TargetID, Summary: row.Summary, IpAddress: row.IPAddress, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func optionalText(text string) *string {
	if text == "" {
		return nil
	}
	return &text
}
