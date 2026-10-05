package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/platformsettingrevision"
	"zudomart/modules/admin/src/generated/ent/predicate"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/modules/platformSettings/models"
)

func ResolveVersionAuthors(ctx context.Context, client *ent.Client, actorIds []string) (map[string]models.VersionAuthor, error) {
	authors := map[string]models.VersionAuthor{}
	staffIds := []uuid.UUID{}
	for _, actorId := range actorIds {
		authors[actorId] = models.VersionAuthor{Id: actorId, Name: actorId}
		if actorId == "system" {
			authors[actorId] = models.VersionAuthor{Id: actorId, Name: "System"}
		}
		if parsed, err := uuid.Parse(actorId); err == nil {
			staffIds = append(staffIds, parsed)
		}
	}
	if len(staffIds) == 0 {
		return authors, nil
	}
	staff, err := client.StaffAccount.Query().Where(staffaccount.IDIn(staffIds...)).Select(staffaccount.FieldID, staffaccount.FieldEmail, staffaccount.FieldDisplayName).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, member := range staff {
		name := member.DisplayName
		if name == "" {
			name = member.Email
		}
		authors[member.ID.String()] = models.VersionAuthor{Id: member.ID.String(), Name: name}
	}
	return authors, nil
}

func BuildSettingViews(ctx context.Context, client *ent.Client, rows []*ent.PlatformSetting) ([]models.PlatformSettingView, error) {
	actorIds := make([]string, 0, len(rows))
	matches := make([]predicate.PlatformSettingRevision, 0, len(rows))
	for _, row := range rows {
		actorIds = append(actorIds, row.UpdatedBy)
		matches = append(matches, platformsettingrevision.And(platformsettingrevision.Key(row.Key), platformsettingrevision.Version(row.Version)))
	}
	reasons := map[string]string{}
	if len(matches) > 0 {
		revisions, err := client.PlatformSettingRevision.Query().Where(platformsettingrevision.Or(matches...)).All(ctx)
		if err != nil {
			return nil, err
		}
		for _, revision := range revisions {
			reasons[revision.Key] = revision.Reason
		}
	}
	authors, err := ResolveVersionAuthors(ctx, client, actorIds)
	if err != nil {
		return nil, err
	}
	views := make([]models.PlatformSettingView, 0, len(rows))
	for _, row := range rows {
		views = append(views, models.ConvertSettingToView(row, authors[row.UpdatedBy], reasons[row.Key]))
	}
	return views, nil
}

func BuildRevisionViews(ctx context.Context, client *ent.Client, rows []*ent.PlatformSettingRevision) ([]models.PlatformSettingView, error) {
	actorIds := make([]string, 0, len(rows))
	for _, row := range rows {
		actorIds = append(actorIds, row.Actor)
	}
	authors, err := ResolveVersionAuthors(ctx, client, actorIds)
	if err != nil {
		return nil, err
	}
	views := make([]models.PlatformSettingView, 0, len(rows))
	for _, row := range rows {
		views = append(views, models.ConvertRevisionToView(row, authors[row.Actor]))
	}
	return views, nil
}
