package services

import (
	"context"
	"time"

	"nantty/modules/catalog/src/configs"
	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/martfeature"
	"nantty/modules/catalog/src/modules/martFeatures/dtos"
)

const SubjectType = "martHomeFeature"

func StatusOf(row *ent.MartFeature, now time.Time) string {
	switch {
	case !row.IsPublished:
		return "DRAFT"
	case row.EndsAt != nil && !row.EndsAt.After(now):
		return "EXPIRED"
	case row.StartsAt.After(now):
		return "SCHEDULED"
	}
	return "LIVE"
}

func Present(settings configs.CatalogSettings, row *ent.MartFeature, now time.Time) dtos.MartHomeFeature {
	imageUrl, _ := ImageUrlOf(settings, row.ImageID)
	countries := row.Countries
	if countries == nil {
		countries = []string{}
	}
	return dtos.MartHomeFeature{
		Id: row.ID.String(), Title: row.Title, Subtitle: row.Subtitle, Kind: row.Kind, ImageId: row.ImageID, ImageUrl: imageUrl, TargetType: row.TargetType,
		TargetValue: row.TargetValue, Countries: countries, StartsAt: row.StartsAt, EndsAt: row.EndsAt, Priority: row.Priority, IsPublished: row.IsPublished,
		Status: StatusOf(row, now), UpdatedAt: row.UpdatedAt,
	}
}

func Ordered(ctx context.Context, client *ent.Client) ([]*ent.MartFeature, error) {
	return client.MartFeature.Query().Order(ent.Asc(martfeature.FieldPriority), ent.Asc(martfeature.FieldID)).All(ctx)
}

func PresentAll(ctx context.Context, deployed *container.Container) ([]dtos.MartHomeFeature, error) {
	rows, err := Ordered(ctx, deployed.Client)
	if err != nil {
		return nil, err
	}
	now := deployed.Now()
	views := make([]dtos.MartHomeFeature, 0, len(rows))
	for _, row := range rows {
		views = append(views, Present(deployed.Settings, row, now))
	}
	return views, nil
}

func LiveFeatures(ctx context.Context, deployed *container.Container, country string) ([]*ent.MartFeature, error) {
	now := deployed.Now()
	rows, err := deployed.Client.MartFeature.Query().Where(martfeature.IsPublished(true), martfeature.StartsAtLTE(now),
		martfeature.Or(martfeature.EndsAtIsNil(), martfeature.EndsAtGT(now))).Order(ent.Asc(martfeature.FieldPriority)).All(ctx)
	if err != nil || country == "" {
		return rows, err
	}
	visible := make([]*ent.MartFeature, 0, len(rows))
	for _, row := range rows {
		for _, code := range row.Countries {
			if code == country {
				visible = append(visible, row)
				break
			}
		}
	}
	return visible, nil
}
